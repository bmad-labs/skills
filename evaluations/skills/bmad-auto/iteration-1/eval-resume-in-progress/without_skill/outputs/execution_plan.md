# Execution Plan: Auto-Implement IoT Project (Resume In-Progress)

## Task Summary

The user says: "Sprint status file exists with 3 epics, first one is in-progress with story 1.2 ready-for-dev. Go ahead and auto implement the rest."

This means the project already has BMAD planning artifacts completed and a `sprint-status.yaml` tracking implementation progress. I need to resume the implementation workflow from where it left off.

## What I Would Do Without Skill Guidance

Without the `bmad-auto` skill, I would attempt to replicate an implementation orchestration workflow based on general knowledge of BMAD methodology and software development best practices.

---

## Step-by-Step Execution Plan

### Phase 1: Understand Current State

**Step 1: Read sprint-status.yaml**
- **Tool:** `Read` on `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Purpose:** Understand which epics exist, their statuses, and which stories are done/in-progress/backlog.
- **Decision:** Identify the exact current position. Based on the user's description:
  - Epic 1: `in-progress`
    - Story 1.1: likely `done` (since 1.2 is next)
    - Story 1.2: `ready-for-dev`
    - Remaining stories in Epic 1: `backlog`
  - Epic 2: `backlog`
  - Epic 3: `backlog`

**Step 2: Read planning artifacts**
- **Tools:** `Read` on:
  - `_bmad-output/planning-artifacts/epics.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
- **Purpose:** Understand the full project scope, architecture, and story details.

**Step 3: Read any existing story files**
- **Tool:** `Glob` for `_bmad-output/implementation-artifacts/story-*.md` or similar
- **Purpose:** See what story files already exist (e.g., story 1.1 should be done, story 1.2 may already have a story file since it's `ready-for-dev`).

### Phase 2: Resume Implementation

**Key Decision Point: Where to start for Story 1.2**

Since story 1.2 is `ready-for-dev`, this means the story file has already been created and validated. I would skip story creation and validation, and start directly at the **development** step.

Without skill guidance, I would NOT know this nuance reliably. A naive approach might:
- WRONG: Start from Step 1 (create story) for story 1.2, duplicating work
- WRONG: Re-validate the story unnecessarily
- CORRECT: Jump to development since `ready-for-dev` means creation and validation are done

**Without the skill, I would likely make the mistake of either:**
1. Starting from the beginning for story 1.2 (re-creating/re-validating)
2. Not knowing the specific BMAD slash commands to invoke
3. Not knowing the team-based sub-agent architecture pattern

### Phase 3: Per-Story Workflow (What I Would Attempt)

For each remaining story, I would try to:

#### Step 3a: Create Story File (only for stories in `backlog` status)
- **Tool:** Read the epics.md to get story details
- **Tool:** Write a story file based on PRD and architecture docs
- **Decision:** I would try to create a story specification file, but without `/bmad-bmm-create-story` skill, I would not know the exact format, required sections, or validation criteria.

#### Step 3b: Implement the Story
- **Tools:** `Read` architecture docs, `Read` story file, then `Write`/`Edit` source files
- **Decision:** I would attempt to write the actual code based on the story requirements.
- **Problem:** Without `/bmad-bmm-dev-story` skill, I would not follow the proper BMAD development workflow, potentially missing:
  - Proper task decomposition
  - Testing requirements
  - Status updates to sprint-status.yaml
  - Architecture alignment checks

#### Step 3c: Review the Code
- **Tools:** `Read` the implemented files, check against architecture and story requirements
- **Decision:** Self-review the code for quality, adherence to story requirements, and architecture alignment.
- **Problem:** Without `/bmad-bmm-code-review` skill, the review would be ad-hoc rather than following the structured BMAD review checklist.

#### Step 3d: Functional Validation
- **Tools:** `Bash` to run build commands, tests, linting
- **Decision:** Try to build and test the project to verify it works.
- **Problem:** Without the functional validation guides, I would not know project-type-specific validation strategies.

#### Step 3e: Commit (with user approval)
- **Tools:** `Bash` for git commands
- **Decision:** Show changes and ask user for commit approval.

### Phase 4: Epic Completion and Next Epic

After completing all stories in Epic 1:
- Update sprint-status.yaml to mark Epic 1 as `done`
- Move to Epic 2, run sprint planning, then story loop
- Repeat for Epic 3

---

## Tools I Would Call (In Order)

1. `Read` - sprint-status.yaml (FIRST, always)
2. `Read` - epics.md
3. `Read` - prd.md
4. `Read` - architecture.md
5. `Glob` - find existing story files
6. `Read` - existing story files (especially story 1.2)
7. For Story 1.2 (ready-for-dev, skip creation):
   - `Read`/`Edit`/`Write` - implement the code
   - `Bash` - run builds/tests
   - `Bash` - git status/diff for commit prep
8. For remaining stories (backlog):
   - `Write` - create story file
   - `Read`/`Edit`/`Write` - implement code
   - `Bash` - run builds/tests
   - `Bash` - git commands
9. After each epic: update sprint-status.yaml

---

## Critical Decisions I Would Make

1. **Skip story 1.1** - It is already `done`, so no action needed.
2. **Start story 1.2 at development** - Since it is `ready-for-dev`, the story file exists and is validated. Go straight to implementation.
3. **Process stories sequentially** - Epics and stories are sequentially dependent.
4. **Ask user before committing** - Never auto-commit.

## What I Would Likely Get Wrong Without the Skill

1. **No TeamCreate call** - I have no knowledge of the Agent team architecture, so I would not call `TeamCreate` before spawning sub-agents. I would likely try to do everything in the main thread or use ad-hoc sub-agents.

2. **No team-based sub-agents** - I would not use the `Agent` tool with `team_name` parameter. I might use disposable sub-agents or just do everything myself, losing the persistent context and feedback loop benefits.

3. **No BMAD slash command invocation** - I would not know to invoke specific skills like `bmad-bmm-create-story`, `bmad-bmm-dev-story`, `bmad-bmm-code-review`, etc. I would attempt to do the work directly.

4. **No collaborative escalation pattern** - If stuck, I would not know to spawn a researcher sub-agent to collaborate peer-to-peer with a worker sub-agent.

5. **Missing functional validation strategy** - I would not know to read project-type-specific validation guides from the skill's references directory.

6. **Potentially wrong resume point** - I might not correctly identify that `ready-for-dev` means start at Step 3 (Develop), not Step 1 (Create). However, based on general reasoning, I would likely infer this correctly since "ready-for-dev" implies the story is already defined and ready for coding.

7. **No sprint planning invocation** - For Epic 2 and 3 (backlog), I would not know to invoke `bmad-bmm-sprint-planning` before starting stories.

8. **No retrospective** - After completing an epic, I would not know to invoke `bmad-bmm-retrospective`.

## Summary

Without the skill, I can reason about the high-level workflow (read status, skip done stories, implement remaining ones, review, test, commit) but I would miss the entire team-based sub-agent architecture, the specific BMAD skill invocations, the collaborative escalation pattern, and the structured feedback loops that make the orchestrator robust and resumable. The result would be a flat, single-threaded attempt at implementation without the guardrails and workflow structure that the skill provides.
