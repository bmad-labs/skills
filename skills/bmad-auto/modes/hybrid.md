# Mode: hybrid

You (the leader) handle the **decision-heavy steps directly** in this conversation, and delegate only the **execution-heavy steps** to teammates. This is the middle ground between `main` and the team modes — you save tokens on validation/review/planning (no sub-agent context to load) and you save your own tokens on long-horizon coding (let a sub-agent burn its window on it).

**Agent teams vs normal sub-agents:** Agent teams let teammates message each other directly and coordinate on shared tasks. Prefer agent teams when available. Spawn teammates with `team_name: "{TEAM_NAME}"` and `run_in_background: true`. If agent teams are not available, fall back to normal sub-agents (same spawn format but without `team_name` and `run_in_background: true`).

## What you do yourself (always, no sub-agent)

- **Mode + flow detection** (Step 0 / Step 1 from SKILL.md).
- **Story creation reading** — if `bmad-create-story` is the right tool, you can either invoke it yourself (cheap) or delegate, but **the resulting story file you validate yourself**.
- **Story validation** — you read the story file and decide pass/fail. No `story-validator` sub-agent.
- **Code review** — you read the diff and decide pass/fail. No `code-reviewer` sub-agent.
- **All git commits** and all `sprint-status.yaml` updates.
- **All decisions**: scope, escalation, retry vs halt, accept PARTIAL validation or block on it.
- **Retro action item triage** at epic boundary.

## What you delegate (sub-agents)

- **`developer`** — `bmad-dev-story` or `bmad-quick-dev`. The long-running coding work.
- **`tester`** — functional validation per story (light or full per the policy in `references/functional-validation.md`); full epic suite at epic completion.
- **`tech-researcher`** — escalation only.

You do **not** spawn `story-creator`, `story-validator`, or `code-reviewer` in this mode. If you want story creation as a sub-agent task, switch to `team-persistent` or `team-respawn`.

## Persistence inside hybrid

Default: **persist developer + tester for the epic** (same lifecycle as `team-persistent.md`), because the savings are real and your decision-heavy work doesn't push their context. If you're on a 200k-context model and notice the developer's window filling, switch to per-story respawn for the developer only — keep the tester persistent (its scope is bounded).

Hold the choice in conversation memory; you'll act on it consistently across the epic without needing a separate state file. If you decide to switch persistence sub-mode mid-epic (e.g., the developer's window is filling), just shut down the affected agent and respawn per-story going forward.

## Team naming

Same convention as the other team modes. Generate `{TEAM_NAME}` once and reuse.

## Effort tuning

Use the same table as the corresponding pure mode:
- 1M context → `team-persistent.md` table.
- 200k context → `team-respawn.md` table.

## Spawning the developer

Spawn at epic start (if `developer_persistence: epic`) or at the start of every story (if `developer_persistence: story`). Use the developer prompt from `team-persistent.md` (just delete the line saying "you'll be reused for every story" if you're in story-persistence sub-mode).

The first message after spawn is the Delegation Packet for the story or quick-spec.

## Spawning the tester

Always persist for the epic. Use the tester prompt from `team-persistent.md`. The leader sends "light" or "full" per story.

## Context-budget check between stories

Hybrid persists the developer and tester across stories, same as `team-persistent`. Run the same per-story context-usage check (`scripts/context-usage.py`) on each — see `team-persistent.md` → "Context-budget check between stories" + "Respawn-with-handover protocol" for the procedure. If you're running the developer in story-persistence sub-mode (respawn-per-story), you can skip the check on the developer; keep it on the tester.

## Code review handoff in hybrid

The leader does code review in-conversation. When fixes are needed:

1. Send a fix-request Delegation Packet to the **developer** (already alive if persistent; respawn if not).
2. *Prior findings verbatim* = your review notes, copy-paste, no compression.
3. Developer fixes, reports back, you re-review in conversation.
4. 2 rounds → escalation.

## Why hybrid is often the right answer

- Story validation and code review need **judgment grounded in the project's whole picture** — that's exactly what you have in this conversation. Sub-agents would have to re-load the architecture doc and PRD just to do a job you already have context for.
- Coding and testing are **bounded execution work** — they benefit from a sub-agent's clean window and dedicated focus.
- You commit anyway (Critical Rule #1), so giving review-and-commit to the leader is just consistent.

## When to drop out of hybrid

- The user wants the absolute cheapest path → switch to `main`.
- The user wants strict separation of duties (e.g. CI-style review) → switch to `team-persistent` or `team-respawn` and accept the higher token cost.

You can switch mid-session by shutting down whichever agents the new mode doesn't use.
