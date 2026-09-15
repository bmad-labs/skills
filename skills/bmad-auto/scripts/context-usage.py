#!/usr/bin/env python3
"""
context-usage.py — measure a Claude Code sub-agent's actual context window usage
by reading its session JSONL transcript.

Used by bmad-auto's leader between stories to decide whether the dev (or tester)
can keep going, needs `/compact`, or needs a full respawn.

The token math here is a faithful port of ccstatusline's algorithm
(github.com/sirmalloc/ccstatusline) so the numbers reflect the same context
length Claude Code itself displays.

USAGE
    # By agent name (most common — leader knows the spawn name):
    python3 context-usage.py --agent-name "bmad-dev-{TEAM_NAME}" --context-window 1000000

    # By team name (any agent in the team):
    python3 context-usage.py --team-name "bmad-auto-myproj-20260507-101730" \\
        --agent-name "bmad-dev-bmad-auto-myproj-20260507-101730"

    # Direct session id:
    python3 context-usage.py --session-id "9e646f4a-..." --context-window 1000000

POLICY
    --policy 1m   (default when --context-window >= 1000000):
        ok if used <= 50%; otherwise recommend "respawn-with-handover".

    --policy 200k (default when --context-window < 1000000):
        ok if used <= 70% AND compaction_count == 0;
        otherwise recommend "respawn-with-handover".

    Why "respawn" not "compact": the leader can't trigger compaction in a
    sub-agent remotely. We tested — an assistant emitting `/compact` is inert
    content, and Claude Code's auto-compact only fires very close to the actual
    context limit, not at a configurable threshold. The respawn-with-handover
    protocol uses the document-first handoff: sub-agent writes a Handover note
    to its story file, leader shuts it down and spawns a fresh agent that reads
    the Handover as its onboarding. Cleaner reasoning than post-compaction
    summaries; one extra round-trip is the cost.

    The 1M policy fires earlier (50% vs 70%) because 1M agents accumulate more
    cache to lose when reasoning degrades, and the user-facing token-cost delta
    of respawning at 50% vs 70% on a 1M window is huge anyway — better to
    respawn while the thinking is still sharp.

OUTPUT (JSON, one object on stdout)
    {
      "agent_name": "bmad-dev-...",
      "session_id": "9e646f4a-...",
      "transcript_path": "...",
      "model": "claude-opus-4-7",
      "context_window": 1000000,
      "tokens_used": 501950,
      "input_tokens": 1,
      "cache_read_input_tokens": 498911,
      "cache_creation_input_tokens": 3038,
      "headroom_pct": 49.8,
      "headroom_tokens": 498050,
      "used_pct": 50.2,
      "compaction_count": 0,
      "policy": "1m",
      "recommendation": "ok"   # or "respawn-with-handover" / "unknown"
    }

EXIT CODES
    0  computed successfully (recommendation is in the JSON)
    1  no matching transcript found
    2  bad arguments / unrecoverable parse error
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Constants — match ccstatusline so the numbers agree with its statusline
# ---------------------------------------------------------------------------

DEFAULT_CONTEXT_WINDOW = 200_000           # ccstatusline's fallback
COMPACTION_DROP_THRESHOLD_PCT = 2.0        # >2 point drop = compaction


# ---------------------------------------------------------------------------
# Transcript discovery
# ---------------------------------------------------------------------------

def claude_projects_dir() -> Path:
    """Return ~/.claude/projects on every platform Claude Code targets."""
    return Path.home() / ".claude" / "projects"


def iter_transcripts() -> list[Path]:
    """All *.jsonl files under ~/.claude/projects/, newest first by mtime."""
    root = claude_projects_dir()
    if not root.exists():
        return []
    return sorted(
        root.rglob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )


def find_transcript_by_session_id(session_id: str) -> Optional[Path]:
    """Locate a JSONL file named <session-id>.jsonl. Falls back to scanning
    contents if the filename doesn't match (rare but possible after renames)."""
    for path in iter_transcripts():
        if path.stem == session_id:
            return path
    # Fallback: search inside files for the session id field.
    for path in iter_transcripts():
        try:
            with path.open("r", encoding="utf-8") as fh:
                for line in fh:
                    if f'"sessionId":"{session_id}"' in line:
                        return path
        except OSError:
            continue
    return None


def find_transcript_by_agent(
    agent_name: Optional[str], team_name: Optional[str]
) -> Optional[Path]:
    """Find the most recently modified transcript whose entries match the
    given agentName and/or teamName. Either field may be omitted."""
    if not agent_name and not team_name:
        return None
    for path in iter_transcripts():
        try:
            with path.open("r", encoding="utf-8") as fh:
                for line in fh:
                    # Cheap substring check first to avoid JSON-parsing every line.
                    if agent_name and f'"agentName":"{agent_name}"' not in line:
                        if team_name and f'"teamName":"{team_name}"' not in line:
                            continue
                    if team_name and f'"teamName":"{team_name}"' not in line:
                        if not agent_name:
                            continue
                    # Confirm via parse — substring could be misleading for partials.
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if agent_name and obj.get("agentName") != agent_name:
                        continue
                    if team_name and obj.get("teamName") != team_name:
                        continue
                    return path
        except OSError:
            continue
    return None


# ---------------------------------------------------------------------------
# Window-size inference (ported from ccstatusline/utils/model-context.ts)
# ---------------------------------------------------------------------------

# Matches "[1m]", "(200k)", "{500_000}", with k/m unit. Case-insensitive.
_DELIMITED_RE = re.compile(
    r"[(\[{]\s*(\d+(?:[,_]\d+)*(?:\.\d+)?)\s*([km])\s*[)\]}]",
    re.IGNORECASE,
)
# Matches free-form "1m context", "200k", "500k token context".
_FREE_RE = re.compile(
    r"\b(\d+(?:[,_]\d+)*(?:\.\d+)?)\s*([km])(?:\s*(?:token\s*)?context)?\b",
    re.IGNORECASE,
)


def parse_context_window(model_identifier: str) -> Optional[int]:
    """Extract a context window size from a model identifier string."""
    if not model_identifier:
        return None
    for regex in (_DELIMITED_RE, _FREE_RE):
        m = regex.search(model_identifier)
        if not m:
            continue
        value_str = m.group(1).replace(",", "").replace("_", "")
        try:
            value = float(value_str)
        except ValueError:
            continue
        if value <= 0:
            continue
        unit = m.group(2).lower()
        return int(round(value * (1_000_000 if unit == "m" else 1_000)))
    return None


# ---------------------------------------------------------------------------
# Transcript parsing — context length & compaction detection
# ---------------------------------------------------------------------------

class TranscriptParseError(RuntimeError):
    pass


def _coerce_nonneg_int(val: Any) -> int:
    if not isinstance(val, (int, float)) or val != val or val < 0:  # NaN check
        return 0
    return int(val)


def parse_transcript(
    transcript_path: Path,
    agent_name: Optional[str] = None,
) -> dict[str, Any]:
    """Compute the most recent main-chain context length and the compaction
    count, applying ccstatusline's streaming-aware and sidechain-aware
    filtering. If `agent_name` is given, restrict to lines tagged with that
    agentName (so a multi-agent transcript file is filtered correctly).

    Returns a dict with keys: tokens_used, input_tokens, cache_read_input_tokens,
    cache_creation_input_tokens, model, session_id, compaction_count, used_pct
    (None if window unknown), and the most_recent_timestamp.
    """
    # First pass: collect all entries with usage. We need them all up front so
    # we can apply ccstatusline's "if any entry has stop_reason, only count
    # finalized + latest" filter correctly.
    entries: list[dict[str, Any]] = []
    has_stop_reason_field = False
    last_session_id: Optional[str] = None
    last_model: Optional[str] = None
    is_compact_summary_seen = False

    try:
        with transcript_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    # Tolerate partial / truncated lines at end-of-file.
                    continue

                if agent_name and obj.get("agentName") != agent_name:
                    continue

                if obj.get("isCompactSummary") is True:
                    is_compact_summary_seen = True

                msg = obj.get("message")
                if not isinstance(msg, dict):
                    continue
                usage = msg.get("usage")
                if not isinstance(usage, dict):
                    continue

                if "stop_reason" in msg:
                    has_stop_reason_field = True

                last_session_id = obj.get("sessionId") or last_session_id
                last_model = msg.get("model") or last_model

                entries.append(obj)
    except OSError as exc:
        raise TranscriptParseError(f"could not read {transcript_path}: {exc}") from exc

    # Apply ccstatusline's streaming-aware filter:
    #   - If any entry has stop_reason, keep entries with truthy stop_reason
    #     PLUS the very last entry (which may still be unfinalized).
    #   - Otherwise keep all entries.
    if has_stop_reason_field:
        last_idx = len(entries) - 1
        kept: list[dict[str, Any]] = []
        for i, obj in enumerate(entries):
            stop_reason = obj["message"].get("stop_reason")
            if stop_reason or (stop_reason is None and i == last_idx):
                kept.append(obj)
        entries = kept

    # Find the most recent main-chain assistant entry. Sidechains
    # (isSidechain === true) and api-error stub messages don't count.
    most_recent: Optional[dict[str, Any]] = None
    most_recent_ts: Optional[str] = None
    for obj in entries:
        if obj.get("isSidechain") is True:
            continue
        if obj.get("isApiErrorMessage"):
            continue
        ts = obj.get("timestamp")
        if not ts:
            continue
        if most_recent_ts is None or ts > most_recent_ts:
            most_recent_ts = ts
            most_recent = obj

    if most_recent is None:
        return {
            "tokens_used": 0,
            "input_tokens": 0,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
            "model": last_model,
            "session_id": last_session_id,
            "compaction_count": 0,
            "compaction_summary_seen": is_compact_summary_seen,
            "most_recent_timestamp": None,
        }

    usage = most_recent["message"]["usage"]
    input_tokens = _coerce_nonneg_int(usage.get("input_tokens"))
    cache_read = _coerce_nonneg_int(usage.get("cache_read_input_tokens"))
    cache_create = _coerce_nonneg_int(usage.get("cache_creation_input_tokens"))
    tokens_used = input_tokens + cache_read + cache_create

    # Compaction detection: walk forward, track context % across entries (using
    # the same window size for percentage math), count drops >threshold. We
    # need a window size for percentage-based detection; if the caller didn't
    # supply one, infer from the model identifier on the latest entry.
    inferred_window = (
        parse_context_window(last_model or "") or DEFAULT_CONTEXT_WINDOW
    )

    compaction_count = 0
    prev_pct: Optional[float] = None
    for obj in entries:
        if obj.get("isSidechain") is True or obj.get("isApiErrorMessage"):
            continue
        u = obj["message"].get("usage")
        if not isinstance(u, dict):
            continue
        i = _coerce_nonneg_int(u.get("input_tokens"))
        cr = _coerce_nonneg_int(u.get("cache_read_input_tokens"))
        cc = _coerce_nonneg_int(u.get("cache_creation_input_tokens"))
        used = i + cr + cc
        pct = (used / inferred_window) * 100.0 if inferred_window > 0 else 0.0
        if prev_pct is not None and pct < prev_pct - COMPACTION_DROP_THRESHOLD_PCT:
            compaction_count += 1
        prev_pct = pct

    if is_compact_summary_seen and compaction_count == 0:
        # Definitive marker present but the percentage drop didn't register
        # (e.g. compaction happened at session boundaries). Trust the marker.
        compaction_count = 1

    return {
        "tokens_used": tokens_used,
        "input_tokens": input_tokens,
        "cache_read_input_tokens": cache_read,
        "cache_creation_input_tokens": cache_create,
        "model": last_model,
        "session_id": last_session_id,
        "compaction_count": compaction_count,
        "compaction_summary_seen": is_compact_summary_seen,
        "most_recent_timestamp": most_recent_ts,
    }


# ---------------------------------------------------------------------------
# Recommendation policy
# ---------------------------------------------------------------------------

DEFAULT_THRESHOLDS_PCT = {"1m": 50.0, "200k": 70.0}


def recommend(
    *,
    used_pct: Optional[float],
    compaction_count: int,
    policy: str,
    threshold_pct: Optional[float] = None,
) -> str:
    """Map (utilization, compaction count, policy, threshold) to an action.

    Possible return values: "ok", "respawn-with-handover", "unknown".
    The leader's runbook for "respawn-with-handover" is in
    modes/team-persistent.md → "Respawn-with-handover protocol".

    `threshold_pct` overrides the default for the policy. Use it when a
    specific role can run hotter than the conservative default — e.g. the
    team-respawn mode spawns short-lived per-step agents whose Handover
    cost is wasted at 70% (they'd respawn anyway at step boundary), so
    that mode raises the threshold to 90% to mostly only catch real
    runaway-context within a single step.
    """
    if used_pct is None:
        return "unknown"

    # Auto-compaction (whether triggered automatically by Claude Code at
    # ~99% used, or manually by the user) is itself a respawn signal —
    # post-compaction summaries lose nuance and reasoning quality drops
    # even if the usage number is now low. Apply on every policy.
    if compaction_count > 0:
        return "respawn-with-handover"

    threshold = (
        threshold_pct
        if threshold_pct is not None
        else DEFAULT_THRESHOLDS_PCT.get(policy, 70.0)
    )
    return "respawn-with-handover" if used_pct > threshold else "ok"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Measure a Claude Code sub-agent's actual context window usage.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--session-id", help="Direct session id (filename stem).")
    p.add_argument("--agent-name", help="Match transcripts by agentName field.")
    p.add_argument("--team-name", help="Match transcripts by teamName field.")
    p.add_argument(
        "--context-window",
        type=int,
        help="Override context window size in tokens (e.g. 1000000 for 1M). "
             "If omitted, inferred from the model identifier in the transcript "
             "(falls back to 200k).",
    )
    p.add_argument(
        "--policy",
        choices=("1m", "200k", "auto"),
        default="auto",
        help="Recommendation policy. 'auto' picks 1m if context window >= 1M, "
             "else 200k. Default: auto.",
    )
    p.add_argument(
        "--transcript-path",
        help="Skip discovery; read this exact JSONL file.",
    )
    p.add_argument(
        "--threshold-pct",
        type=float,
        help="Override the policy's default usage threshold (1m=50, 200k=70). "
             "Pass a number 0-100. Use 90 for team-respawn per-step agents — "
             "their respawn cost is wasted near the step boundary anyway, so "
             "keep them alive until they actually approach context exhaustion. "
             "Use the policy default everywhere else.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()

    # Locate the transcript.
    if args.transcript_path:
        transcript = Path(args.transcript_path)
        if not transcript.exists():
            print(json.dumps({"error": f"transcript not found: {transcript}"}))
            return 1
    elif args.session_id:
        transcript = find_transcript_by_session_id(args.session_id)
    elif args.agent_name or args.team_name:
        transcript = find_transcript_by_agent(args.agent_name, args.team_name)
    else:
        print(json.dumps({
            "error": "must provide --session-id, --agent-name, --team-name, "
                     "or --transcript-path",
        }))
        return 2

    if transcript is None:
        print(json.dumps({
            "error": "no transcript matched the given criteria",
            "agent_name": args.agent_name,
            "team_name": args.team_name,
            "session_id": args.session_id,
        }))
        return 1

    # Parse it.
    try:
        result = parse_transcript(transcript, agent_name=args.agent_name)
    except TranscriptParseError as exc:
        print(json.dumps({"error": str(exc), "transcript_path": str(transcript)}))
        return 2

    # Determine context window.
    if args.context_window:
        window = args.context_window
        window_source = "flag"
    else:
        inferred = parse_context_window(result.get("model") or "")
        if inferred:
            window = inferred
            window_source = "model"
        else:
            window = DEFAULT_CONTEXT_WINDOW
            window_source = "default"

    # Apply policy.
    if args.policy == "auto":
        policy = "1m" if window >= 1_000_000 else "200k"
    else:
        policy = args.policy

    used_pct: Optional[float] = None
    headroom_tokens: Optional[int] = None
    headroom_pct: Optional[float] = None
    if window > 0:
        used_pct = (result["tokens_used"] / window) * 100.0
        headroom_tokens = max(0, window - result["tokens_used"])
        headroom_pct = max(0.0, 100.0 - used_pct)

    threshold_pct_used = (
        args.threshold_pct
        if args.threshold_pct is not None
        else DEFAULT_THRESHOLDS_PCT.get(policy, 70.0)
    )
    rec = recommend(
        used_pct=used_pct,
        compaction_count=result.get("compaction_count", 0),
        policy=policy,
        threshold_pct=args.threshold_pct,
    )

    out = {
        "agent_name": args.agent_name,
        "team_name": args.team_name,
        "session_id": result.get("session_id"),
        "transcript_path": str(transcript),
        "model": result.get("model"),
        "context_window": window,
        "context_window_source": window_source,
        "tokens_used": result["tokens_used"],
        "input_tokens": result["input_tokens"],
        "cache_read_input_tokens": result["cache_read_input_tokens"],
        "cache_creation_input_tokens": result["cache_creation_input_tokens"],
        "used_pct": round(used_pct, 2) if used_pct is not None else None,
        "headroom_tokens": headroom_tokens,
        "headroom_pct": round(headroom_pct, 2) if headroom_pct is not None else None,
        "compaction_count": result.get("compaction_count", 0),
        "compaction_summary_seen": result.get("compaction_summary_seen", False),
        "most_recent_timestamp": result.get("most_recent_timestamp"),
        "policy": policy,
        "threshold_pct": threshold_pct_used,
        "recommendation": rec,
    }

    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
