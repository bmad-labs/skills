#!/usr/bin/env python3
"""Grade iteration-4 messages against assertions. Writes grading.json per run
in the layout the aggregator expects: eval-*/config/run-1/grading.json."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent

def has_any(text, patterns, flags=re.IGNORECASE):
    return any(re.search(p, text, flags) for p in patterns)

def has_all(text, patterns, flags=re.IGNORECASE):
    return all(re.search(p, text, flags) for p in patterns)

def grade_reviewer_fixes(text):
    checks = []
    def add(desc, passed, evidence=""):
        checks.append({"text": desc, "passed": bool(passed), "evidence": evidence})

    task_ok = has_any(text, [r"^##\s*task\b", r"^#\s*task\b", r"^\*\*task\*\*"], re.IGNORECASE | re.MULTILINE)
    add("Has a clearly labeled Task section", task_ok, "")

    why_ok = has_any(text, [r"^##\s*why", r"^\*\*why", r"why this matters"], re.IGNORECASE | re.MULTILINE)
    add("Has a Why-this-matters section", why_ok, "")

    # Pastes the reviewer's report verbatim (not paraphrased): look for a blockquote
    # containing the exact "Key findings:" header or the exact tests-only-check-connect phrasing.
    verbatim_ok = has_any(text, [r">\s*Key findings:", r">\s*1\.\s*Weak assertions", r"redundant with UT-004"])
    add("Pastes reviewer's prior report verbatim (blockquote with original header/phrasing)",
        verbatim_ok, "")

    findings = {
        "UT-001 weak assertions": [r"UT-001", r"weak assertion"],
        "acks alias conflict": [r"acks.*request\.required\.acks|request\.required\.acks.*acks", r"alias"],
        "mapSendOptions export": [r"mapSendOptions.*(export|internal|public)", r"keep.*internal", r"unexport"],
        "AC4 headers invariant": [r"AC4", r"headers invariant", r"ServerSendOptions"],
    }
    hits = sum(1 for ps in findings.values() if has_any(text, ps))
    add("Mentions all 4 specific findings", hits == 4, f"{hits}/4")

    ks_ok = has_all(text, [r"CLAUDE\.md", r"kafka-conventions\.md"])
    add("Names knowledge sources: CLAUDE.md and docs/kafka-conventions.md", ks_ok, "")

    skills_ok = has_any(text, [r"typescript-clean-code", r"typescript-unit-testing", r"bmad-bmm-code-review"])
    add("Invokes at least one relevant skill", skills_ok, "")

    sc_ok = has_any(text, [r"success criteria", r"tests pass", r"lint.*clean|lint/typecheck"])
    add("Defines success criteria", sc_ok, "")

    round_ok = has_any(text, [r"round\s*1\s*/\s*2", r"1\s*of\s*2\s*rounds?"])
    add("Includes Round 1/2 marker", round_ok, "")

    # New check: does the message have the 8-slot packet structure (≥6 of the 8 labeled headings)?
    slots = [r"##\s*task\b", r"##\s*why", r"##\s*prior (findings|report)", r"##\s*specific",
             r"##\s*knowledge", r"##\s*(relevant )?skills\b", r"##\s*success", r"##\s*report back"]
    slot_hits = sum(1 for s in slots if re.search(s, text, re.IGNORECASE))
    add("Uses Delegation Packet structure (≥6 of 8 labeled slots)",
        slot_hits >= 6, f"{slot_hits}/8 slots present")

    return checks

def grade_story_dev_feedback(text):
    checks = []
    def add(desc, passed, evidence=""):
        checks.append({"text": desc, "passed": bool(passed), "evidence": evidence})

    task_ok = has_any(text, [r"^##\s*task\b", r"^#\s*task\b", r"^\*\*task\*\*"], re.IGNORECASE | re.MULTILINE)
    add("Has a clearly labeled Task section", task_ok, "")

    why_ok = has_any(text, [r"^##\s*why", r"^\*\*why", r"why this matters"], re.IGNORECASE | re.MULTILINE)
    add("Has a Why-this-matters section", why_ok, "")

    verbatim_ok = has_any(text, [r">\s*Report:\s*Implementation complete",
                                  r">\s*Implementation complete\. 3 unit tests"])
    add("Pastes developer's prior report verbatim", verbatim_ok, "")

    both_gaps = has_all(text, [r"retry", r"structured|logger\.info\(\{|JSON.*log"])
    add("Names both gaps: retry tests AND structured-log format", both_gaps, "")

    file_lines = has_all(text, [r"consumer\.ts:82", r"consumer\.ts:95"])
    add("Cites exact file lines (:82-140 and :95)", file_lines, "")

    logging_doc = has_any(text, [r"docs/logging\.md", r"Structured log events"])
    add("References docs/logging.md", logging_doc, "")

    ac3 = has_any(text, [r"AC3\b", r"AC 3\b", r"acceptance criterion 3", r"AC#3"])
    add("References story AC3", ac3, "")

    skills = has_any(text, [r"typescript-unit-testing", r"typescript-clean-code"])
    add("Invokes at least one relevant skill", skills, "")

    sc_ok = has_any(text, [r"success criteria", r"tests pass", r"npm test", r"lint.*(clean|pass)"])
    add("Defines success criteria", sc_ok, "")

    round_ok = has_any(text, [r"round\s*1\s*/\s*2", r"1\s*of\s*2\s*rounds?"])
    add("Includes Round 1/2 marker", round_ok, "")

    slots = [r"##\s*task\b", r"##\s*why", r"##\s*prior (findings|report)", r"##\s*specific",
             r"##\s*knowledge", r"##\s*(relevant )?skills\b", r"##\s*success", r"##\s*report back"]
    slot_hits = sum(1 for s in slots if re.search(s, text, re.IGNORECASE))
    add("Uses Delegation Packet structure (≥6 of 8 labeled slots)",
        slot_hits >= 6, f"{slot_hits}/8 slots present")

    return checks

def grade_escalation(text):
    checks = []
    def add(desc, passed, evidence=""):
        checks.append({"text": desc, "passed": bool(passed), "evidence": evidence})

    task_ok = has_any(text, [r"^##\s*task\b", r"^#\s*task\b", r"^\*\*task\*\*"], re.IGNORECASE | re.MULTILINE)
    add("Has a clearly labeled Task section", task_ok, "")

    why_ok = has_any(text, [r"critical path", r"blocks? (6|six) (downstream|stories)", r"epic 3"])
    add("Has a Why-this-matters section citing Epic 3 critical path", why_ok, "")

    # Verbatim: both reports use specific phrases that are load-bearing and unlikely to survive paraphrase.
    verbatim_ok = has_any(text, [r">\s*Round 1 attempt", r">\s*Round 2 attempt",
                                  r"per suggestion\.\s*Failure:"])
    add("Pastes developer's prior 2 reports verbatim (not paraphrased)", verbatim_ok, "")

    both_attempts = has_all(text, [r"ERR_REQUIRE_ESM", r"TLS handshake|intermediate CA|cert chain"])
    add("Mentions both failure causes (ESM + TLS)", both_attempts, "")

    tls = has_any(text, [r"no.*(TLS|cert).*(bypass|disable|compromise|workaround)",
                          r"(TLS|cert).*must (stay|remain|keep).*on",
                          r"not (acceptable|permitted|allowed).*TLS",
                          r"verification.*(stay|remain).*on",
                          r"TLS verification.*(stays|stay|must|remains|remain)",
                          r"cert(ificate)? verification.*on",
                          r"preserve.*(certificate|cert|TLS)"])
    add("Explicitly states TLS verification must stay on", tls, "")

    direct = has_any(text, [r"(message|contact|communicate|reach).*(story-developer|developer).*directly",
                             r"directly.*(story-developer|developer)",
                             r"not.*relay", r"peer.to.peer",
                             r"do NOT.*relay", r"will NOT relay"])
    add("Instructs researcher to message developer directly / no relay", direct, "")

    ks_ok = has_all(text, [r"package\.json", r"architecture\.md"])
    add("Names knowledge sources: package.json and architecture.md", ks_ok, "")

    skills = has_any(text, [r"typescript-clean-code", r"claude-api", r"bmad-bmm-technical-research"])
    add("Invokes at least one relevant skill", skills, "")

    sc_ok = has_any(text, [r"success criteria", r"AC.*pass", r"sandbox"])
    add("Defines success criteria", sc_ok, "")

    slots = [r"##\s*task\b", r"##\s*why", r"##\s*prior (findings|report)", r"##\s*specific",
             r"##\s*knowledge", r"##\s*(relevant )?skills\b", r"##\s*success", r"##\s*report back"]
    slot_hits = sum(1 for s in slots if re.search(s, text, re.IGNORECASE))
    add("Uses Delegation Packet structure (≥6 of 8 labeled slots)",
        slot_hits >= 6, f"{slot_hits}/8 slots present")

    return checks

GRADERS = {
    "eval-reviewer-fixes-handoff": grade_reviewer_fixes,
    "eval-story-dev-feedback": grade_story_dev_feedback,
    "eval-escalation-packet": grade_escalation,
}

def main():
    summary = []
    for eval_dir, grader in GRADERS.items():
        for config in ("with_skill", "old_skill"):
            config_dir = ROOT / eval_dir / config
            msg_path = config_dir / "outputs" / "message.md"
            if not msg_path.exists():
                print(f"missing: {msg_path}")
                continue
            text = msg_path.read_text()
            checks = grader(text)
            passed = sum(1 for c in checks if c["passed"])
            total = len(checks)

            # Put grading.json into run-1/ so aggregator finds it
            run_dir = config_dir / "run-1"
            run_dir.mkdir(parents=True, exist_ok=True)
            # Mirror timing.json if present so aggregator can read it
            t_in = config_dir / "timing.json"
            if t_in.exists():
                shutil.copy(t_in, run_dir / "timing.json")

            grading = {
                "expectations": checks,
                "summary": {
                    "passed": passed,
                    "failed": total - passed,
                    "total": total,
                    "pass_rate": passed / total if total else 0.0,
                },
            }
            (run_dir / "grading.json").write_text(json.dumps(grading, indent=2))
            summary.append((f"{eval_dir}/{config}", passed, total))

    print("\nGrading summary:")
    for run_id, p, t in summary:
        bar = "█" * p + "·" * (t - p)
        print(f"  {run_id:55s} {p}/{t}  {bar}")

if __name__ == "__main__":
    main()
