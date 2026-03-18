# Execution Plan: "Start the automatic implementation phase" (No sprint-status.yaml)

**Task prompt:** "Start the automatic implementation phase. Note: there is no sprint-status.yaml file yet, I only have the planning docs ready."

**Context:** No skill guidance available. Acting purely on general knowledge and what can be inferred from the project structure.

---

## How I Would Approach This

Without any skill to guide me, I have no predefined workflow, no knowledge of the BMAD framework's Phase 4 orchestration process, and no awareness of the expected file conventions (e.g., `sprint-status.yaml`, story file formats, sub-agent architecture). I would have to reason from first principles about what "automatic implementation phase" means in a software project.

### What I Know

- The user says planning docs are ready.
- There is no `sprint-status.yaml` file.
- The user wants to "start the automatic implementation phase."

### What I Do NOT Know (Without the Skill)

- That `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` is a prerequisite gating file.
- That the absence of this file means the project is NOT ready for Phase 4.
- That I should invoke a `bmad-help` skill to guide the user to the correct next step.
- That I should NOT create a team, spawn sub-agents, or begin any implementation work.
- The entire BMAD Phase 4 orchestration workflow (story creation, validation, development, code review, functional validation, commit).

---

## Step-by-Step Execution Plan (What I Would Actually Do)

### Step 1: Understand the Project Structure
- Scan the repository for planning documents (PRD, architecture, epics).
- Look for directories like `_bmad-output/planning-artifacts/` or similar.
- Try to understand what has already been planned.

### Step 2: Look for Implementation Tracking
- Search for any existing implementation status files (sprint status, kanban, task lists).
- Check if there is a `sprint-status.yaml` or equivalent.
- **Finding:** No `sprint-status.yaml` exists.

### Step 3: Interpret "Automatic Implementation Phase"
Without the skill, I would likely interpret this as:
- Read the planning docs (PRD, architecture, epics).
- Parse out the stories/tasks from the epics.
- Begin implementing them one by one.

**This is where things go wrong without the skill.**

### Step 4: Likely (Incorrect) Actions
Without skill guidance, I would probably:
1. Read `_bmad-output/planning-artifacts/epics.md` to find the list of stories.
2. Create a sprint-status tracking file myself (e.g., generate `sprint-status.yaml` from scratch).
3. Begin creating story files and implementing code directly.
4. Possibly create sub-agents or start coding story implementations.

### Step 5: What Would Be Missing
- **No gating check:** I would skip the critical check that `sprint-status.yaml` must already exist (created by a prior phase like sprint planning).
- **No `bmad-help` invocation:** I would not know to invoke the `bmad-help` skill to guide the user.
- **Premature action:** I would likely start creating files and writing code when the project is not ready.
- **Wrong workflow:** I would not follow the correct BMAD sequence (sprint planning must happen first to generate the sprint-status.yaml).

---

## Expected Correct Behavior (What the Skill Would Do)

For comparison, the correct behavior per the bmad-auto skill is:

1. Check if `_bmad-output/implementation-artifacts/sprint-status.yaml` exists.
2. **It does NOT exist** --> the project is not yet in Phase 4.
3. Invoke `bmad-help` skill to suggest the correct next action (likely sprint planning).
4. Report suggestions to the user.
5. **STOP.** Do NOT create a team, spawn sub-agents, or begin implementation.

---

## Evaluation Assertions vs. My Likely Behavior

| Assertion | Expected | Without Skill |
|-----------|----------|---------------|
| Checks if sprint-status.yaml exists before proceeding | YES - would check | PARTIAL - might check, but would not treat absence as a hard stop |
| Invokes bmad-help skill when sprint-status.yaml is missing | NO - would not know about bmad-help | FAIL |
| Does NOT create a team or spawn sub-agents | LIKELY FAIL - would probably start working | FAIL |

---

## Summary

Without the bmad-auto skill, I would fail this evaluation scenario. The key failure mode is: **I would not know that the absence of `sprint-status.yaml` is a gating condition that should halt all progress and redirect the user to a prerequisite step.** Instead, I would likely attempt to create the missing file myself and start implementing, which is the wrong behavior. The skill provides critical domain knowledge about the BMAD workflow phases and their prerequisites.
