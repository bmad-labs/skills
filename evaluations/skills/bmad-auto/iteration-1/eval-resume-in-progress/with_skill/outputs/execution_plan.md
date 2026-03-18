# Execution Plan: Resume In-Progress IoT Project Auto-Implementation

## Scenario

An IoT project with BMAD planning docs complete. `sprint-status.yaml` exists with 3 epics.
Epic 1 is `in-progress`, and Story 1.2 has status `ready-for-dev`. The task is to auto-implement
the rest of the project from this point forward.

---

## Phase 1: Startup Sequence

### Step 1.1: Check sprint-status.yaml existence
- **Tool:** `Read` on `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Decision:** File exists (per scenario) -> proceed to step 1.2.
- **If missing:** Would invoke `Skill` with `skill: "bmad-help"` and stop.

### Step 1.2: Check if all work is done
- **Tool:** Parse the YAML content from sprint-status.yaml.
- **Decision:** Not all done (Epic 1 in-progress, Epics 2-3 in backlog) -> proceed.

### Step 1.3: Read epics.md
- **Tool:** `Read` on `_bmad-output/planning-artifacts/epics.md`
- **Purpose:** Get the full list of epics and stories with their identifiers and titles.

### Step 1.4: Determine current epic and story
- **Analysis:** Epic 1 is `in-progress`. Within Epic 1, determine the first non-done story.
- **Assumed sprint-status.yaml state:**
  - Epic 1: `in-progress`
    - Story 1.1: `done`
    - Story 1.2: `ready-for-dev`
    - Story 1.3: `backlog` (or more stories)
  - Epic 2: `backlog`
  - Epic 3: `backlog`
- **Decision:** Current work target is Story 1.2 with status `ready-for-dev`.

### Step 1.5: Report to user
- **Output:** "Resuming Epic 1, Story 1.2. 1 of N stories complete. Story 1.2 is ready-for-dev, starting development."

---

## Phase 2: Create Team

- **Tool:** `TeamCreate` with `team_name: "bmad-auto"`, `description: "BMAD Phase 4 implementation orchestration"`
- **Purpose:** Create the persistent team for sub-agent communication throughout the session.
- **Timing:** Done once before entering the main loop.

---

## Phase 3: Main Loop - Epic 1 (in-progress)

Epic 1 is already `in-progress`, so we skip Sprint Planning (Section A) for this epic.

### Story 1.2 (status: `ready-for-dev`)

Per the SKILL.md status-to-step mapping:
- `ready-for-dev` -> start at **Step 3** (Develop Story)
- Steps 1 (Create Story) and 2 (Validate Story) are skipped because the story file already exists and was validated.

#### Step 3: Develop Story 1.2

1. **Spawn sub-agent:**
   - **Tool:** `Agent` with `name: "story-developer"`, `team_name: "bmad-auto"`
   - **Prompt:** Instructs the sub-agent to invoke `Skill` with `skill: "bmad-bmm-dev-story"`. Includes the standard sub-agent preamble ("Do NOT make any git commits"), manual task handling instructions, and collaboration/shutdown instructions.
   - The sub-agent reads the story file, implements all tasks per the dev-story workflow.

2. **Wait for sub-agent report via `SendMessage`.**

3. **Orchestrator reviews results:**
   - **Tool:** `Read` on `sprint-status.yaml` to confirm story status changed to `review`.
   - **If successful:** Send `shutdown_request` to "story-developer" -> proceed to Step 4.
   - **If manual task reported:** Review the sub-agent's automation investigation. If an automation approach was missed, send instructions via `SendMessage` to the same "story-developer". If truly manual, halt and ask the user.
   - **If blocked (round 1):** Send feedback with fix suggestions to "story-developer" via `SendMessage`.
   - **If blocked (round 2):** Send feedback again to "story-developer".
   - **If blocked (round 3 - escalation):** Spawn "tech-researcher" sub-agent in the same team. Notify "story-developer" that a researcher is assigned. Let them collaborate peer-to-peer. Monitor idle notifications.
   - **If collaboration resolves:** Shut down "tech-researcher", "story-developer" reports success.
   - **If collaboration fails after 3 rounds:** Shut down both. Invoke `skill: "bmad-bmm-correct-course"`. Report to user and pause.

#### Step 4: Code Review for Story 1.2

1. **Spawn sub-agent:**
   - **Tool:** `Agent` with `name: "code-reviewer"`, `team_name: "bmad-auto"`
   - **Prompt:** Instructs the sub-agent to invoke `Skill` with `skill: "bmad-bmm-code-review"`. Standard preamble included.

2. **Wait for sub-agent report.**

3. **Orchestrator reviews results:**
   - **If review passes (no critical issues):** Send `shutdown_request` to "code-reviewer" -> proceed to Step 4.5.
   - **If review finds issues:**
     1. Review the specific issues reported.
     2. Send `shutdown_request` to "code-reviewer".
     3. Spawn a new "story-developer" sub-agent with the review findings included in the prompt for context.
     4. After fixes, spawn a new "code-reviewer" sub-agent.
     5. Retry up to 2 times. If still failing -> report to user and pause.

#### Step 4.5: Functional Validation for Story 1.2

1. **Spawn sub-agent:**
   - **Tool:** `Agent` with `name: "func-validator"`, `team_name: "bmad-auto"`
   - **Prompt:** Instructs the sub-agent to read `<skill_directory>/references/functional-validation-prompt.md` and follow all validation steps (detect project type, read appropriate guide from `references/guides/`, check tool availability, execute validation). Standard preamble included.

2. **Wait for sub-agent report (PASS, PARTIAL, or FAIL).**

3. **Orchestrator reviews results:**
   - **PASS:** Send `shutdown_request` to "func-validator" -> proceed to Step 5.
   - **PARTIAL:** Send `shutdown_request` to "func-validator" -> log warning about what could not be validated -> proceed to Step 5. Include partial validation details in commit message.
   - **FAIL:**
     1. If quick fix apparent: send instructions to "func-validator" (retains context). Wait for re-report.
     2. If re-development needed: shut down "func-validator" -> spawn new "story-developer" with failure details -> after fixes, re-run Step 4 and Step 4.5.
     3. If still failing after 2 rounds -> collaborative escalation: spawn "tech-researcher" to work peer-to-peer with "story-developer".
     4. If collaboration resolves -> shut down "tech-researcher" -> re-run Step 4 and Step 4.5.
     5. If not resolved after 3 collaboration rounds -> shut down all -> report to user and pause.

#### Step 5: Commit for Story 1.2

1. **Tool:** `Read` on `sprint-status.yaml` to confirm story is `done`.
2. **Tool:** `Bash` with `git status` and `git diff` to see all changes.
3. **Ask user for commit approval.** Present:
   - Changes summary
   - Proposed commit message: `feat(epic-1): implement story 1.2 - <story title>`
   - Functional validation results (e.g., "Build: OK, Tests: OK" or "Build: OK, Hardware tests: skipped")
4. **Only commit after explicit user approval.**
5. Report: "Story 1.2 complete. Moving to next story."

---

### Story 1.3 (and any remaining stories in Epic 1, assumed `backlog`)

For each remaining story in Epic 1 with status `backlog`:

#### Step 1: Create Story
- Spawn "story-creator" sub-agent -> invoke `skill: "bmad-bmm-create-story"` with args `"1.3"`.
- Orchestrator re-reads sprint-status.yaml after report.
- If successful -> shutdown "story-creator" -> Step 2.
- If issues -> send feedback (up to 2 rounds) -> escalate -> halt.

#### Step 2: Validate Story
- Spawn "story-validator" sub-agent -> invoke `skill: "bmad-bmm-create-story"` with args `"validate 1.3"`.
- If passes -> shutdown "story-validator" -> Step 3.
- If fails -> send feedback (up to 2 rounds) -> escalate -> halt.

#### Steps 3-5: Same as Story 1.2 above
- Develop -> Code Review -> Functional Validation -> Commit (with user approval).

### Epic 1 Completion

When all stories in Epic 1 are `done`:
1. **Tool:** `Skill` with `skill: "bmad-bmm-sprint-status"` to generate status report.
2. **Tool:** `Skill` with `skill: "bmad-bmm-retrospective"` for the completed epic.
3. Report: "Epic 1 complete. Moving to next epic."

---

## Phase 4: Main Loop - Epic 2 (backlog)

### Section A: Epic Start
- Epic 2 status is `backlog`.
- **Tool:** `Skill` with `skill: "bmad-bmm-sprint-planning"` to start the epic.
- **Tool:** `Read` on `sprint-status.yaml` to confirm Epic 2 is now tracked.

### Section B: Story Loop
- For each story in Epic 2 (all starting as `backlog`):
  - Execute Steps 1-5 in full (Create -> Validate -> Develop -> Code Review -> Functional Validation -> Commit).
  - Each step uses the team-based sub-agent pattern described above.
  - Each commit requires user approval.

### Section C: Epic Completion
- Sprint status report + retrospective (same as Epic 1).

---

## Phase 5: Main Loop - Epic 3 (backlog)

- Identical to Epic 2: Sprint Planning -> Story Loop (Steps 1-5 for each story) -> Epic Completion.

---

## Phase 6: All Epics Complete

1. **Tool:** `Read` on `sprint-status.yaml` to confirm all epics and stories are `done`.
2. Report completion to the user.
3. **Tool:** `Skill` with `skill: "bmad-help"` to suggest next actions (deployment, documentation, retrospective, etc.).

---

## Phase 7: Team Cleanup

1. Send `shutdown_request` to all active sub-agents (should be none if properly shut down after each step).
2. Wait for shutdown confirmations.
3. **Tool:** `TeamDelete` to clean up the "bmad-auto" team and associated task files.

---

## Key Decisions and Rules Applied

### Resume Logic
- Story 1.1 is `done` -> **skipped entirely**.
- Story 1.2 is `ready-for-dev` -> **started at Step 3** (Develop), skipping Create and Validate.
- All subsequent stories start from Step 1 (Create) since they are in `backlog`.

### Sub-Agent Lifecycle
- **One sub-agent per step.** Never combine multiple workflow steps in a single agent.
- **Feedback before respawn.** When a sub-agent reports fixable issues, send feedback to the same agent (preserving context) rather than spawning a new one.
- **Always shutdown.** Every sub-agent gets a `shutdown_request` when its step is complete.

### Escalation Ladder (applied at every step)
1. Orchestrator feedback to worker (up to 2 rounds).
2. Collaborative escalation: spawn "tech-researcher" for peer-to-peer collaboration with worker (up to 3 rounds).
3. Halt for user with full context.

### Git Commits
- Sub-agents NEVER commit. All commits are handled by the orchestrator.
- Every commit requires explicit user approval before execution.
- Commit messages include functional validation results.

### Automation-First for Manual Tasks
- Sub-agents must investigate automation approaches (CLI, scripts, APIs, Docker, mocks) before reporting a task as manual.
- Orchestrator reviews the investigation and may suggest missed automation approaches.
- Only halts for user when automation is truly impossible.

---

## Tools Called (Summary by Phase)

| Phase | Tools Used |
|-------|-----------|
| Startup | `Read` (sprint-status.yaml, epics.md) |
| Team Setup | `TeamCreate` |
| Story Dev | `Agent` (story-developer), `SendMessage`, `Read` (sprint-status.yaml) |
| Code Review | `Agent` (code-reviewer), `SendMessage` |
| Func Validation | `Agent` (func-validator), `SendMessage` |
| Commit | `Bash` (git status, git diff), user prompt, `Bash` (git commit) |
| Escalation | `Agent` (tech-researcher), `SendMessage` |
| Epic Completion | `Skill` (bmad-bmm-sprint-status, bmad-bmm-retrospective) |
| Epic Start | `Skill` (bmad-bmm-sprint-planning) |
| Cleanup | `SendMessage` (shutdown_request), `TeamDelete` |

## Sub-Agent Skills Invoked (via Skill tool inside sub-agents)

| Sub-Agent | Skill Invoked |
|-----------|---------------|
| story-creator | `bmad-bmm-create-story` with args `"<story_id>"` |
| story-validator | `bmad-bmm-create-story` with args `"validate <story_id>"` |
| story-developer | `bmad-bmm-dev-story` |
| code-reviewer | `bmad-bmm-code-review` |
| func-validator | Reads `references/functional-validation-prompt.md` directly |
| tech-researcher | `bmad-bmm-technical-research` |

## Estimated Flow for This Scenario

Assuming 3 epics with ~3 stories each (9 stories total), Story 1.1 already done:

1. **Story 1.2** (ready-for-dev): Steps 3-5 (Dev, Review, Validate, Commit)
2. **Story 1.3** (backlog): Steps 1-5 (Create, Validate, Dev, Review, Validate, Commit)
3. **Epic 1 completion**: Status report + retrospective
4. **Epic 2 start**: Sprint planning
5. **Stories 2.1-2.3** (backlog): Steps 1-5 each
6. **Epic 2 completion**: Status report + retrospective
7. **Epic 3 start**: Sprint planning
8. **Stories 3.1-3.3** (backlog): Steps 1-5 each
9. **Epic 3 completion**: Status report + retrospective
10. **All done**: Final report + bmad-help suggestions + team cleanup

Total sub-agents spawned (happy path, no retries): 8 stories x 4 agents each = 32 sub-agents + 2 sprint planning invocations + 3 status reports + 3 retrospectives.
