# Execution Plan: "auto implement" when all epics/stories are done

## Task

The user says: "auto implement - all epics and stories in the sprint-status.yaml are marked as done already"

## DRY RUN - My Approach (Without Skill Guidance)

### What I would do

1. **Locate sprint-status.yaml**: Search for `_bmad-output/implementation-artifacts/sprint-status.yaml` (the conventional BMAD path) or any `sprint-status.yaml` in the project.

2. **Read and parse it**: Load the YAML file and inspect the status of every epic and every story.

3. **Determine if work remains**: Iterate through all epics and their stories, checking each status field.

4. **Reach conclusion**: Since the user states all epics and stories are already marked as `done`, I would confirm this by reading the file, then report that all implementation work is complete.

5. **Suggest next steps**: Based on general knowledge of software projects, I would suggest actions like:
   - Deployment / release preparation
   - Documentation finalization
   - Retrospective
   - End-to-end integration testing
   - Demo preparation

### What I would NOT do

- I would NOT create a team or spawn sub-agents.
- I would NOT attempt to start working on any stories (there are none to work on).
- I would NOT invoke any story creation, development, or review workflows.

### Key Gap: No awareness of `bmad-help` skill

Without the bmad-auto SKILL.md guidance, I would NOT know to invoke the `bmad-help` skill to suggest next actions. The SKILL.md explicitly says (Startup Sequence, step 2):

> If all finished -> report completion to the user, invoke `skill: "bmad-help"` to suggest next actions (e.g., deployment, documentation, retrospective), and stop.

Instead, I would likely just say "everything is done" and offer my own generic suggestions, which may miss project-specific next steps that `bmad-help` would provide.

### Critical Differences vs. Skill-Guided Execution

| Aspect | Without Skill | With Skill (bmad-auto) |
|--------|--------------|----------------------|
| Reads sprint-status.yaml | Yes (if I can find it) | Yes (knows exact path) |
| Identifies all-done state | Yes | Yes |
| Invokes `bmad-help` | No - unaware of this skill | Yes - explicit instruction |
| Reports completion | Generic message | Structured report + skill-driven suggestions |
| Avoids unnecessary work | Likely yes | Guaranteed yes (explicit guard) |
| Knows BMAD conventions | Partial at best | Full awareness |

### Predicted Outcome

I would correctly identify that all work is done and would NOT start creating teams or working on stories. However, I would miss the `bmad-help` invocation, resulting in generic rather than project-aware next-step suggestions.

### Evaluation Criteria Assessment (from eval_metadata.json)

1. **"Correctly identifies that all epics and stories are done"** - PASS: I would read the file and confirm this.
2. **"Invokes bmad-help skill to suggest next actions"** - FAIL: Without skill guidance, I have no knowledge of the `bmad-help` skill.
3. **"Does NOT create a team or start working on stories"** - PASS: No reason to start work if everything is done.

**Expected score: 2/3 assertions would pass.**
