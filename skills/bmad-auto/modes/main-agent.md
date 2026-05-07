# Mode: main-agent

You (the leader) do **all** the work yourself in this conversation. No `TeamCreate`, no `Agent` spawns, no `SendMessage`. You invoke skills (e.g. `bmad-bmm-create-story`, `bmad-bmm-dev-story`, `bmad-bmm-code-review`) directly.

## When this mode is the right call

- Single small change (Quick Flow with one tech-spec).
- Very small Phase 4 epics (1-2 stories).
- The user wants maximum control and minimal token spend.
- The model context window is generous AND the work is bounded.

## How to execute each step

For every step that the flow file lists (Phase 4: create story → validate → develop → review → functional test → commit; Quick Flow: spec → implement → review → functional test → commit):

1. **Invoke the skill the step calls for** via the `Skill` tool, in this conversation.
2. **Apply the skill's output** to the workspace yourself (write files, run tests, etc.).
3. **Validate the result yourself** — for story validation and code review, this is your job in every mode anyway.
4. **Commit yourself** when the user approves (or auto-commit if `auto_progression: auto-commit` and the step is on the happy path).

## What you skip in this mode

- The Delegation Packet template (you're not handing off to anyone).
- `{AGENT_HEADER}` (no sub-agents).
- Team naming (no team).

## What you keep in this mode

- The flow file's step ordering.
- Story validation and code review as explicit steps you run yourself before commit.
- Functional validation per the light/full epic-aware policy in `references/functional-validation.md`.
- The leader-makes-all-decisions and leader-only-commits rules.
- Resumability via `sprint-status.yaml` (Phase 4) or tech-spec + git state (Quick Flow).

## Researcher in this mode

`main` mode has no worker sub-agents, so the researcher is **always one-shot consultation**, never peer collaboration. Use it freely for:

- Planning-phase questions during quick-spec or story creation: library choice, design pattern, architectural approach.
- Decision points where you'd otherwise be guessing: idiomatic-code questions, API/SDK behavior, performance trade-offs.
- Any "best-practices for X?" question memory and project rules don't answer.

**Before spawning, run the quick check from `references/escalation.md`:**
1. Memory check — `{MEMORY_SOURCES}` and `{KNOWLEDGE_PATHS}`. If the answer's there, apply it and skip the researcher.
2. Is the question technical-research-shaped? Scope / PRD gaps / business decisions go to the user, not a researcher.
3. Can you state the question concretely? One specific paragraph.

If memory has the answer → apply it. If the question's not research-shaped → halt to user. Otherwise → spawn the researcher (no team needed in main mode; use `subagent_type: "general-purpose"` and the planning-phase spawn prompt from `references/escalation.md`).

After the researcher reports, factor in the recommendation and continue. Shut it down — don't keep it alive across unrelated questions.

The researcher's prompt must still start with the `{AGENT_HEADER}` from SKILL.md, with the bmad-auto context block filled in:
- Flow: <Phase 4 | Quick Flow>
- Mode: main
- Your specific role: one-shot tech-researcher for the leader (no peer worker — main mode)
- What the leader will do with your output: read your findings and decide the next step in the leader's own workflow

After the researcher reports, you decide and continue. Read `references/escalation.md` for the full researcher prompt template (skip the peer-collaboration parts — they don't apply here).

This is the only sub-agent spawn allowed in `main` mode, and only as a research aid after the gate is cleared.

## Reporting cadence

Brief status messages at step boundaries: "Story 1-3 spec validated, starting development." "Story 1-3 functional validation: PASS, committing." Don't narrate intermediate skill output unless it surfaces a decision the user needs to make.
