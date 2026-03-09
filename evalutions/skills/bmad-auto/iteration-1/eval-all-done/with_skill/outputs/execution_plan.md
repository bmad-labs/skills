# Execution Plan: DRY RUN — "auto implement" (all done scenario)

## Trigger

User says: "auto implement - all epics and stories in the sprint-status.yaml are marked as done already"

This matches the skill's trigger patterns: "auto implement", "start implementation", "begin phase 4".

## Skill Invoked

**Skill:** `bmad-auto` (BMAD Phase 4 Auto-Implementation Orchestrator)

## Execution Steps (following SKILL.md Startup Sequence)

### Step 1: Check if sprint-status.yaml exists

Per SKILL.md section "Startup Sequence", step 1:

> Check if `_bmad-output/implementation-artifacts/sprint-status.yaml` exists.

- **Action:** Read `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Expected result:** The file exists (since the user states all epics/stories are marked done).
- **Branch taken:** File exists — continue to step 2.

### Step 2: Check if all epics and stories are done

Per SKILL.md section "Startup Sequence", step 2:

> Check if all epics and stories in `sprint-status.yaml` are `done`.

- **Action:** Parse the YAML content. Inspect the status of every epic and every story within each epic.
- **Expected result:** All epics have status `done`. All stories within every epic have status `done`.
- **Branch taken:** "If all finished" path.

### Step 3: Report completion and invoke bmad-help

Per SKILL.md section "Startup Sequence", step 2 (all finished branch):

> Report completion to the user, invoke `skill: "bmad-help"` to suggest next actions (e.g., deployment, documentation, retrospective), and **stop**.

- **Action 1:** Report to the user that all implementation work is complete. Example message: "All epics and stories in sprint-status.yaml are marked as done. Phase 4 implementation is complete."
- **Action 2:** Invoke the Skill tool with `skill: "bmad-help"` to get suggestions for next actions.
- **Action 3:** Relay the suggestions from bmad-help to the user (e.g., deployment, documentation, retrospective).
- **Action 4:** **Stop.** Do NOT proceed to the main loop.

## What Does NOT Happen

Per the "all finished" branch, the following are explicitly skipped:

1. **No team creation** — `TeamCreate` is only called "before starting the main loop" (Startup step 3+), and the main loop is never entered.
2. **No sub-agents spawned** — No story-creator, story-developer, code-reviewer, or func-validator agents.
3. **No reading of epics.md** — Step 3 of startup ("Read epics.md to get the full list") is only reached if work remains.
4. **No sprint planning** — Only triggered for epics in `backlog` status.
5. **No git commits** — Nothing to commit.

## Expected Assertions Validation

| Assertion | Met? | Reasoning |
|---|---|---|
| Correctly identifies that all epics and stories are done | Yes | Step 2 parses sprint-status.yaml and confirms all statuses are `done`. |
| Invokes bmad-help skill to suggest next actions | Yes | Step 3 explicitly invokes `skill: "bmad-help"` per the startup sequence. |
| Does NOT create a team or start working on stories | Yes | The "all finished" branch says "stop" — main loop is never entered. |

## Summary

This is the simplest execution path through the skill. The orchestrator performs exactly two reads (sprint-status.yaml check + parse), one completion report, one skill invocation (bmad-help), and then stops. Total steps: 3. No sub-agents, no teams, no implementation work.
