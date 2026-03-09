---
name: bmad-auto
description: >
  Orchestrates the full BMAD Phase 4 implementation workflow automatically. Processes each epic and
  story sequentially: creates story files, validates them, develops the implementation, runs code
  review, and performs functional validation — all using team-based sub-agents with persistent context.
  Use this skill whenever the user wants to: (1) automate the BMAD implementation phase ("auto
  implement", "start implementation", "begin phase 4", "automatic working on phase 4", "run the
  implementation hands-free", "implement all stories", "process the epics"), (2) check implementation
  progress or status ("what's the status?", "how many stories are done?", "how's phase 4 going?",
  "any blockers?"), (3) resume a previously interrupted implementation session ("continue from where
  we left off", "resume auto implementation"). Also triggers on any mention of automating BMAD story
  development, orchestrating epic workflows, or running the implementation pipeline end-to-end. If
  unsure whether to use this skill, use it — it will check sprint-status.yaml and guide the user to
  the right next step even if the project isn't ready for Phase 4 yet.
---

# BMAD Phase 4 Auto-Implementation Orchestrator

You are an implementation orchestrator. Your job is to drive the BMAD Phase 4 workflow by invoking
existing BMAD slash commands in sequence, tracking progress via sprint-status.yaml, and handling
errors. You do NOT implement stories yourself — you delegate each workflow step to a **team-based
sub-agent** that stays alive throughout its workflow, allowing you to review issues, make decisions,
and send feedback without losing the sub-agent's context.

## Key Paths

- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Research: `_bmad-output/planning-artifacts/research/`
- Story files: `_bmad-output/implementation-artifacts/`

## Team-Based Sub-Agent Architecture

Instead of disposable sub-agents that terminate after each step, use **Agent teams** so sub-agents
persist with full context. This enables an interactive feedback loop:

1. **Orchestrator spawns a team sub-agent** for a workflow step (e.g., develop story).
2. **Sub-agent works** and reports results via `SendMessage` back to the orchestrator.
3. **Orchestrator reviews** the results. If issues are found, the orchestrator sends feedback
   via `SendMessage` to the **same sub-agent** (preserving its full context).
4. **Sub-agent fixes** the issues using its retained context and reports back again.
5. **Repeat** until the step is complete or retry limit is reached.
6. **Orchestrator shuts down** the sub-agent via `SendMessage` with `type: "shutdown_request"`.

### Team Setup

At the start of the main loop, create a team:
```
TeamCreate: { team_name: "bmad-auto", description: "BMAD Phase 4 implementation orchestration" }
```

### Spawning Team Sub-Agents

For each workflow step, spawn a sub-agent with `team_name: "bmad-auto"`:
```
Agent tool:
  name: "story-worker"  (or "validator", "reviewer", etc.)
  team_name: "bmad-auto"
  prompt: <the step prompt>
```

The sub-agent stays alive after completing its initial work. It sends results back via
`SendMessage` and waits for further instructions.

### Communication Pattern

**Sub-agent reports results:**
```
SendMessage: {
  type: "message",
  recipient: "team-lead",
  content: "Step completed. Results: ...",
  summary: "Story creation complete"
}
```

**Orchestrator sends feedback (if issues found):**
```
SendMessage: {
  type: "message",
  recipient: "story-worker",
  content: "Issues found: ... Please fix these and report back.",
  summary: "Fix validation issues"
}
```

**Orchestrator shuts down sub-agent (when step is fully done):**
```
SendMessage: {
  type: "shutdown_request",
  recipient: "story-worker",
  content: "Step complete, shutting down."
}
```

### Sub-Agent Instructions Template

Every sub-agent prompt MUST include:
```
You are a BMAD team sub-agent. Do NOT make any git commits.

After completing your work, report results back to the team lead via SendMessage.
If you encounter issues that need a decision, report the issue details and wait
for instructions — do NOT proceed on your own.

You may receive messages from other teammates (e.g., a researcher). Collaborate
with them directly via SendMessage to resolve issues together.

When you receive a shutdown_request, approve it.
```

### Collaborative Escalation Pattern

When a sub-agent (e.g., "story-developer") cannot resolve an issue after multiple feedback
rounds from the orchestrator, escalate by spawning a **researcher sub-agent** that collaborates
directly with the stuck sub-agent. This preserves the original sub-agent's full implementation
context while bringing in fresh research capability.

**Escalation flow:**

1. **Orchestrator detects persistent blocker** — the worker sub-agent has failed to resolve
   an issue after 2 rounds of orchestrator feedback.
2. **Orchestrator spawns a researcher sub-agent** in the same team:
   ```
   Agent tool:
     name: "tech-researcher"
     team_name: "bmad-auto"
     prompt: |
       You are a BMAD team sub-agent. Do NOT make any git commits.

       ## Task: Technical Research for Blocker

       A teammate "<worker-name>" is blocked on: <blocker description>

       1. Invoke the Skill tool with:
          - skill: "bmad-bmm-technical-research"
          - args: "<research topic>"
       2. After research completes, read the research output file.
       3. Send the research findings directly to "<worker-name>" via SendMessage,
          including the research file path and a summary of key findings.
       4. Collaborate with "<worker-name>" to resolve the issue. Communicate via
          SendMessage — discuss approaches, answer questions, suggest alternatives.
       5. Report back to the team lead when the issue is resolved or when you both
          agree it cannot be resolved.

       You may receive messages from other teammates (e.g., a researcher). Collaborate
       with them directly via SendMessage to resolve issues together.

       When you receive a shutdown_request, approve it.
   ```
3. **Orchestrator notifies the worker** — send a message to the stuck sub-agent:
   ```
   SendMessage: {
     type: "message",
     recipient: "<worker-name>",
     content: "A researcher 'tech-researcher' is investigating your blocker.
       They will send you findings shortly. Collaborate with them directly
       via SendMessage to resolve the issue.",
     summary: "Researcher assigned to help"
   }
   ```
4. **Researcher and worker collaborate** — they exchange messages directly via `SendMessage`,
   sharing findings, discussing approaches, and iterating on fixes. The orchestrator monitors
   via idle notifications but does not intervene unless needed.
5. **Resolution or timeout** — the worker reports back to the orchestrator:
   - **Resolved**: Worker reports success → orchestrator shuts down "tech-researcher" →
     workflow continues.
   - **Not resolved after 3 collaboration rounds**: Worker or researcher reports failure →
     orchestrator shuts down both → reports to user with full context and pauses.

**Key principle:** The orchestrator does NOT relay messages between sub-agents. The researcher
and worker communicate **peer-to-peer** via `SendMessage`. The orchestrator only intervenes
to spawn, monitor, and shut down.

## Model Recommendations

These are informational — Claude Code uses a single model per session, so this is guidance for
manual runs if the user wants to optimize:
- `/bmad-bmm-create-story` and `/bmad-bmm-code-review`: Opus 4.6 (thorough analysis)
- `/bmad-bmm-dev-story`: Sonnet 4.6 (execution-focused, fast)

## Startup Sequence

When triggered, execute these steps in order:

1. Check if `_bmad-output/implementation-artifacts/sprint-status.yaml` exists.
   - **If the file does NOT exist** → the project is not yet in Phase 4. Invoke the Skill tool
     with `skill: "bmad-help"` to get suggestions for the next action. Report the suggestions
     to the user and stop.
   - **If the file exists** → read it and continue to step 2.
2. Check if all epics and stories in `sprint-status.yaml` are `done`.
   - **If all finished** → report completion to the user, invoke `skill: "bmad-help"` to
     suggest next actions (e.g., deployment, documentation, retrospective), and stop.
   - **If work remains** → continue to step 3.
3. Read `_bmad-output/planning-artifacts/epics.md` to get the full list of epics and stories.
4. Determine the **current epic** — the first epic with status `backlog` or `in-progress`.
5. Determine the **current story** — the first story within that epic that is not `done`.
6. Report to the user: which epic and story will be worked on next, and the overall progress
   (e.g., "Starting Epic 1, Story 1-1. 0 of 9 stories complete.").

## Status Query

If the user asks about implementation status (e.g., "What's the status?", "How's progress?"):

1. Read `sprint-status.yaml`.
2. Summarize: which epic is in progress, which stories are done/in-progress/remaining.
3. Report any known issues or blockers.
4. Do NOT continue the main loop — just report and wait.

## Main Loop

Before starting, create the team:
```
TeamCreate: { team_name: "bmad-auto", description: "BMAD Phase 4 implementation orchestration" }
```

For each epic (in order, starting from the current one):

### A. Epic Start

If the epic status is `backlog`:
1. Invoke the Skill tool: `skill: "bmad-bmm-sprint-planning"`.
2. Re-read `sprint-status.yaml` to confirm the epic is now tracked.

### B. Story Loop

For each story in the current epic (in order), execute these steps. **Each step spawns a team
sub-agent that stays alive** until the orchestrator shuts it down. The sub-agent reports results
via `SendMessage`; the orchestrator reviews and either sends feedback or shuts down the sub-agent.

Determine the story's current status from `sprint-status.yaml` and resume from the appropriate step:
- `backlog` → start at Step 1
- `ready-for-dev` → start at Step 3
- `in-progress` → start at Step 3
- `review` → start at Step 4 (if code review result is unknown, re-run; if code review already
  passed in this session, skip to Step 4.5)
- `done` → skip this story

#### Step 1: Create Story

Spawn a team sub-agent:
```
Agent tool:
  name: "story-creator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-create-story"
    - args: "<story_identifier>"

    Where <story_identifier> is: <the story ID from epics.md, e.g., "1.1">

    Follow the workflow instructions completely. When done, report results to the team lead
    via SendMessage. If you encounter issues needing a decision, report the issue details
    and wait for instructions.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
1. Re-read `sprint-status.yaml` to confirm the story status changed.
2. If successful → send `shutdown_request` to "story-creator" → proceed to Step 2.
3. If issues reported → review the issues, send feedback via `SendMessage` to "story-creator"
   with instructions to fix. Wait for the sub-agent to report again. Retry up to 2 times.
   If still failing → shut down sub-agent → report to user and pause.

#### Step 2: Validate Story

Spawn a team sub-agent:
```
Agent tool:
  name: "story-validator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-create-story"
    - args: "validate <story_identifier>"

    Follow the validation workflow completely. Report the validation results to the team lead
    via SendMessage — pass or fail with details. If issues need a decision, report and wait.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
- If validation passes → send `shutdown_request` to "story-validator" → proceed to Step 3.
- If validation finds issues → review the issues, send feedback to "story-validator" with
  instructions to fix and re-validate. The sub-agent retains full context of what it validated.
  Retry up to 2 times. If still failing → shut down sub-agent → report to user and pause.

#### Step 3: Develop Story

Spawn a team sub-agent:
```
Agent tool:
  name: "story-developer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-dev-story"

    The dev-story workflow will read the current story file and implement it.
    Follow all workflow instructions completely. Report results to the team lead via SendMessage.

    ## Manual Task Handling

    When you encounter a task that appears to require manual intervention (e.g., UI testing,
    hardware setup, third-party account creation, manual configuration):

    1. **Investigate automation first.** Before reporting it as manual, check if the task can
       be automated via CLI tools, scripts, APIs, Docker, mock services, or environment variables.
    2. **If automatable** → implement the automated approach and continue.
    3. **If truly impossible to automate** → report to the team lead with:
       - What the manual task is
       - What automation approaches were considered and why they don't work
       - What specific user action is needed
       Then wait for instructions.

    If you encounter blockers or technical issues, report them with full details and wait
    for instructions — do NOT proceed on your own.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**

After report, re-read `sprint-status.yaml`. The story should be in `review` status.

- If successful → send `shutdown_request` to "story-developer" → proceed to Step 4.
- If manual task reported:
  1. Review the sub-agent's automation investigation results.
  2. If the orchestrator sees an automation approach the sub-agent missed → send instructions
     to try it. Wait for re-report.
  3. If truly manual → halt and ask the user: describe the manual step needed, what was
     investigated, and why automation is not possible. Wait for user to complete the manual
     step and confirm before resuming.
- If blocked or encountering technical issues:
  1. Review the blocker details reported by "story-developer".
  2. Send feedback to "story-developer" with suggestions to resolve. Wait for re-report.
  3. If still blocked after 2 rounds of feedback → **trigger Collaborative Escalation**:
     - Spawn "tech-researcher" sub-agent (see Collaborative Escalation Pattern above).
     - Notify "story-developer" that a researcher is assigned.
     - Let "tech-researcher" and "story-developer" collaborate peer-to-peer via `SendMessage`.
     - Monitor via idle notifications.
  4. If collaboration resolves the issue → shut down "tech-researcher" → "story-developer"
     reports success → proceed to Step 4.
  5. If not resolved after 3 collaboration rounds → shut down both sub-agents →
     invoke `skill: "bmad-bmm-correct-course"` to propose changes → report to user and pause.

#### Step 4: Code Review

Spawn a team sub-agent:
```
Agent tool:
  name: "code-reviewer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-code-review"

    Review the code changes from the most recent story implementation.
    Report the review results to the team lead via SendMessage — pass or fail with specific
    issues found. If issues need a decision, report and wait.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
- If review passes (no critical issues) → send `shutdown_request` to "code-reviewer" →
  proceed to Step 4.5.
- If review finds issues:
  1. Review the issues reported by the code-reviewer.
  2. Send `shutdown_request` to "code-reviewer".
  3. Spawn a new "story-developer" sub-agent with instructions to fix the specific issues
     (include the review findings in the prompt for context).
  4. After fixes, spawn a new "code-reviewer" sub-agent.
  5. Retry up to 2 times. If still failing → report to user and pause.

#### Step 4.5: Functional Validation

After code review passes, spawn a team sub-agent to perform functional validation — build, run,
and test the implementation to verify it works as specified. This step catches issues that code
review cannot: build failures, runtime errors, and behavioral regressions.

> **Reference:** The sub-agent should read `references/functional-validation-strategies.md` in
> this skill's directory for the full project-type detection logic, and the appropriate guide
> file from `references/guides/` for the detected project type.

Spawn a team sub-agent:
```
Agent tool:
  name: "func-validator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    ## Task: Functional Validation for Story <story_identifier>

    Validate that the implementation actually works by building, running, and testing it.

    Read the full validation instructions from:
    `<skill_directory>/references/functional-validation-prompt.md`

    Follow all steps described there (detect project type, read validation guide,
    check tool availability, execute validation, report results).

    Report results to the team lead via SendMessage as PASS, PARTIAL, or FAIL.
    If you encounter issues needing a decision, report and wait for instructions.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
- If **PASS** → send `shutdown_request` to "func-validator" → proceed to Step 5.
- If **PARTIAL** → send `shutdown_request` to "func-validator" → log warning → proceed to Step 5.
- If **FAIL**:
  1. Review the failure details from "func-validator".
  2. If a quick fix is apparent, send instructions to "func-validator" to attempt the fix
     (it retains full context of what failed and why). Wait for re-report.
  3. If the fix requires re-development, shut down "func-validator" → spawn a new
     "story-developer" with the failure details → after fixes, re-run Step 4 and Step 4.5.
  4. If "story-developer" cannot fix after 2 rounds of feedback → **trigger Collaborative
     Escalation**: spawn "tech-researcher" to collaborate with "story-developer" on the
     build/test failure. Let them work peer-to-peer.
  5. If collaboration resolves the issue → shut down "tech-researcher" → re-run Step 4
     and Step 4.5.
  6. If not resolved after 3 collaboration rounds → shut down all sub-agents → report to
     user with full error context and pause.

#### Step 5: Commit

After a story reaches `done`:

1. Re-read `sprint-status.yaml` to confirm the status.
2. Run `git status` and `git diff` to see all changes.
3. **Ask the user for commit approval** — show the changes summary and proposed commit message.
4. Proposed commit message format: `feat(epic-X): implement story X-Y - <story title>`
5. Include functional validation results in the commit summary:
   - If PASS: note what was validated (e.g., "Build: OK, Simulator: OK")
   - If PARTIAL: note what was validated and what was skipped
6. Only commit after the user explicitly approves.
7. Report: "Story <story_id> complete. Moving to next story."

### C. Epic Completion

When all stories in an epic are `done`:

1. Invoke `skill: "bmad-bmm-sprint-status"` to generate the status report.
2. Invoke `skill: "bmad-bmm-retrospective"` for the completed epic.
3. Report: "Epic <epic_id> complete. Moving to next epic."
4. Continue to the next epic (go back to Section A).

## Error Handling

### Escalation Ladder

All steps follow the same escalation progression:

1. **Orchestrator feedback** (up to 2 rounds) — orchestrator reviews issue, sends fix instructions
   to the worker sub-agent directly.
2. **Collaborative escalation** (up to 3 rounds) — spawn "tech-researcher" to collaborate
   peer-to-peer with the worker sub-agent. They exchange findings and iterate on fixes.
3. **Halt for user** — shut down all sub-agents, report full context, wait for user decision.

### Validation/Review Failures
- Orchestrator sends fix feedback to the sub-agent (up to 2 rounds).
- If still failing → trigger collaborative escalation with "tech-researcher".
- If still failing after collaboration → halt and report to user.

### Functional Validation Failures
- If build/test fails: send error details to "func-validator" or "story-developer" (up to 2 rounds).
- If still failing → trigger collaborative escalation.
- If tools are missing (PARTIAL): warn user but do not block. Include in commit message.
- If still failing after collaboration → halt and report to user.

### Blocked Stories
- Orchestrator feedback first (2 rounds) → collaborative escalation with "tech-researcher" →
  `/bmad-bmm-correct-course` → halt for user.
- Always provide: (a) what is blocked, (b) what was researched, (c) proposed course correction.

### Unresolvable Issues
- Shut down all active sub-agents.
- Output a clear summary: current epic, current story, the nature of the problem, what was
  attempted (including orchestrator feedback rounds and collaborative escalation attempts).
- Wait for user input before continuing.

## Resumability

This orchestrator is fully resumable. If the session ends or the user stops:
- All progress is tracked in `sprint-status.yaml` and story files.
- Saying "Automatic working on phase 4" again will re-read the status and pick up from the next
  incomplete step.

## Team Cleanup

When all epics are complete or the user stops the orchestrator:
1. Send `shutdown_request` to all active sub-agents.
2. Wait for shutdown confirmations.
3. Delete the team: `TeamDelete` (automatically cleans up team and task files).

## Critical Rules

1. **Sub-agents must NEVER commit.** All git commits are handled by the main orchestrator only.
   Every sub-agent prompt must include: "Do NOT make any git commits."
2. **One sub-agent per workflow step.** Never combine create-story + dev-story in the same agent.
3. **Always re-read sprint-status.yaml** after each sub-agent reports to get ground truth.
4. **Follow existing BMAD workflows.** Do not bypass or shortcut the slash command workflows.
5. **Respect epic order.** Epics are sequentially dependent.
6. **Always align with architecture and PRD.** If a story seems misaligned, use `/bmad-bmm-correct-course`.
7. **Always attempt build validation.** Even if runtime testing is not possible, always try to
   build the project before committing. A commit should never contain code that does not compile.
8. **Always shut down sub-agents** when their step is complete. Do not leave idle sub-agents
   running across steps — each step gets its own sub-agent.
9. **Send feedback, don't respawn.** When a sub-agent reports fixable issues, send feedback to
   the same sub-agent via `SendMessage` instead of spawning a new one. Only spawn a new
   sub-agent when the step transitions (e.g., from review back to development).
10. **Create the team once.** Call `TeamCreate` at the start of the main loop. Do not recreate
    the team for each story or epic.
11. **Escalate before halting.** Before pausing for user input, always attempt collaborative
    escalation: spawn "tech-researcher" to work peer-to-peer with the stuck sub-agent.
12. **Peer-to-peer collaboration.** During collaborative escalation, the orchestrator does NOT
    relay messages. The researcher and worker communicate directly via `SendMessage`. The
    orchestrator monitors and only intervenes to shut down or halt.
13. **Shut down researcher after resolution.** Always send `shutdown_request` to "tech-researcher"
    once the issue is resolved or escalation fails. Do not leave researchers running.
14. **Automate before asking for help.** When a story task appears to require manual work,
    the sub-agent must investigate automation approaches first (CLI tools, scripts, APIs,
    Docker, mocks). Only halt for user help when automation is truly impossible.
