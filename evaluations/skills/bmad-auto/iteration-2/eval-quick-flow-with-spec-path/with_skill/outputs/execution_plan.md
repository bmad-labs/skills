# Execution Plan: Implement Tech-Spec for Login Validation Bug Fix

## Context

- **Skill**: `bmad-auto` (BMAD Auto-Implementation Orchestrator)
- **User Request**: "I have a tech spec for fixing the login validation bug. The spec is at `_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md`. Go ahead and implement it."
- **Input files**: None (tech-spec path provided by user)

## Flow Detection

**Decision**: Route to **Quick Flow**.

**Reasoning**:
- The user explicitly provides a `tech-spec-*.md` file path (`tech-spec-fix-login-validation.md`)
- This matches Quick Flow trigger: "The user provides or references a `tech-spec-*.md` file"
- No need to check for `sprint-status.yaml` — the tech-spec reference is unambiguous

## Quick Flow Startup

**Decision**: Skip Step 1 (Spec Creation), proceed directly to Step 2 (Implement).

**Reasoning**: Per SKILL.md Quick Flow Startup rule #1: "If the user provided a tech-spec file path -> read the file, confirm it's a valid tech-spec, and proceed to Quick Flow Step 2 (Implement)."

### Pre-Step Actions

1. **Read the tech-spec file** at `_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md`
2. **Validate** that it is a well-formed tech-spec (has problem statement, tasks, acceptance criteria)
3. **Report to the user**: "Detected Quick Flow. Tech-spec found: fixing login validation bug. Proceeding to implementation (Step 2)."

## Step-by-Step Execution Plan

### Step 0: Team Setup

**Tool call**: `TeamCreate`
```
TeamCreate: {
  team_name: "bmad-auto",
  description: "BMAD Quick Flow implementation"
}
```

---

### Step 1: SKIPPED (Tech-spec already provided)

The user provided the tech-spec path directly, so Quick Flow Step 1 (Create Tech-Spec) is skipped entirely.

---

### Step 2: Implement from Tech-Spec

**Tool call**: Spawn `Agent` as team sub-agent

```
Agent tool:
  name: "quick-developer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-quick-dev"
    - args: "_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md"

    Follow the quick-dev workflow completely:
    1. Read the tech-spec and execute every task in sequence
    2. Write tests as specified in the testing strategy
    3. Validate all acceptance criteria (Given/When/Then)
    4. Run self-check audit against all tasks and acceptance criteria

    Report results to the team lead via SendMessage when implementation is complete.
    Include: which tasks were completed, test results, and any acceptance criteria
    that could not be verified automatically.

    ## Manual Task Handling

    When you encounter a task that appears to require manual intervention:
    1. Investigate automation first (CLI tools, scripts, APIs, Docker, mocks).
    2. If automatable -> implement and continue.
    3. If truly impossible to automate -> report to team lead with details and wait.

    If you encounter blockers or technical issues, report them with full details and wait
    for instructions — do NOT proceed on your own.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports**:

- **If successful**: Send `shutdown_request` to "quick-developer" -> proceed to Step 3 (Code Review).
- **If blocked (round 1-2)**: Review blocker details, send feedback to "quick-developer" via `SendMessage` with fix instructions. Wait for re-report.
- **If blocked (after 2 rounds)**: Trigger **Collaborative Escalation**:
  - Spawn "tech-researcher" sub-agent in the same team
  - Notify "quick-developer" that a researcher is assigned
  - Let them collaborate peer-to-peer via `SendMessage`
  - Monitor via idle notifications
  - If resolved -> shut down "tech-researcher" -> continue
  - If not resolved after 3 collaboration rounds -> shut down both -> report to user and pause

---

### Step 3: Code Review

**Tool call**: Spawn `Agent` as team sub-agent

```
Agent tool:
  name: "quick-reviewer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-code-review"

    Review the code changes from the most recent Quick Flow implementation.
    Also verify alignment with the tech-spec at:
    _bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md

    Report the review results to the team lead via SendMessage — pass or fail with specific
    issues found. If issues need a decision, report and wait.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports**:

- **If review passes**: Send `shutdown_request` to "quick-reviewer" -> proceed to Step 4 (Functional Validation).
- **If review finds issues**:
  1. Send `shutdown_request` to "quick-reviewer".
  2. Send fix instructions to "quick-developer" (which still has full implementation context — note: per the plan, "quick-developer" was already shut down after Step 2 success; so a **new** "quick-developer" would be spawned with the review findings included in the prompt).
  3. After fixes, spawn a new "quick-reviewer".
  4. Retry up to 2 times. If still failing -> report to user and pause.

**Decision point**: The SKILL.md says to send fix instructions to "quick-developer" (which still has full context). However, per Step 2, the developer was shut down on success. This means:
- If review fails, spawn a **new** "quick-developer" sub-agent with the review findings and the tech-spec path in the prompt context.
- After fixes, re-run code review with a new "quick-reviewer".

---

### Step 4: Functional Validation

**Tool call**: Spawn `Agent` as team sub-agent

```
Agent tool:
  name: "func-validator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    ## Task: Functional Validation for tech-spec-fix-login-validation

    Validate that the implementation actually works by building, running, and testing it.

    Read the full validation instructions from:
    `skills/bmad-auto/references/functional-validation-prompt.md`

    Follow all steps described there (detect project type, read validation guide,
    check tool availability, execute validation, report results).

    Report results to the team lead via SendMessage as PASS, PARTIAL, or FAIL.
    If you encounter issues needing a decision, report and wait for instructions.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports**:

- **PASS**: Send `shutdown_request` to "func-validator" -> proceed to Step 5 (Commit).
- **PARTIAL**: Send `shutdown_request` to "func-validator" -> log warning -> proceed to Step 5.
- **FAIL**:
  1. Review failure details.
  2. If quick fix apparent: send instructions to "func-validator" to attempt fix. Wait for re-report.
  3. If re-development needed: shut down "func-validator" -> spawn new "quick-developer" with failure details -> after fixes, re-run Step 3 (Code Review) and Step 4 (Functional Validation).
  4. If still failing after 2 rounds -> collaborative escalation with "tech-researcher".
  5. If still failing after 3 collaboration rounds -> shut down all -> report to user and pause.

---

### Step 5: Commit

**Actions** (performed by orchestrator directly, no sub-agent):

1. Run `git status` and `git diff` to see all changes.
2. **Ask the user for commit approval** — show the changes summary and proposed commit message.
3. Proposed commit message format: `fix(login): fix login validation bug` (derived from tech-spec title).
4. Include functional validation results in the commit summary.
5. Only commit after the user explicitly approves.
6. Report: "Quick Flow complete. All changes committed."

---

### Step 6: Team Cleanup

1. Send `shutdown_request` to any remaining active sub-agents.
2. Wait for shutdown confirmations.
3. Delete the team via `TeamDelete`.

---

## Decision Tree Summary

```
Start
  |
  v
Read tech-spec file at provided path
  |
  v
Is it a valid tech-spec? --NO--> Ask user for correct path or clarification
  |YES
  v
Report: "Quick Flow detected. Proceeding to implement."
  |
  v
TeamCreate "bmad-auto"
  |
  v
[Step 2] Spawn "quick-developer" with skill "bmad-quick-dev"
  |
  +--SUCCESS--> Shut down "quick-developer"
  |               |
  |               v
  |             [Step 3] Spawn "quick-reviewer" with skill "bmad-bmm-code-review"
  |               |
  |               +--PASS--> Shut down "quick-reviewer"
  |               |            |
  |               |            v
  |               |          [Step 4] Spawn "func-validator"
  |               |            |
  |               |            +--PASS/PARTIAL--> Shut down "func-validator"
  |               |            |                    |
  |               |            |                    v
  |               |            |                  [Step 5] Show diff, ask user to approve commit
  |               |            |                    |
  |               |            |                    +--APPROVED--> Commit -> Done
  |               |            |                    +--REJECTED--> Report and stop
  |               |            |
  |               |            +--FAIL--> Fix loop (up to 2 rounds) -> Escalation -> Halt
  |               |
  |               +--FAIL--> Spawn new developer with review findings -> Re-review (up to 2 retries)
  |
  +--BLOCKED--> Feedback (2 rounds) -> Collaborative Escalation (3 rounds) -> Halt for user
```

## Key Tool Invocations

| Step | Tool | Sub-Agent Name | Skill Invoked | Args |
|------|------|---------------|---------------|------|
| 0 | TeamCreate | — | — | `team_name: "bmad-auto"` |
| 2 | Agent | quick-developer | bmad-quick-dev | `_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md` |
| 3 | Agent | quick-reviewer | bmad-bmm-code-review | — |
| 4 | Agent | func-validator | — (reads references) | — |
| 5 | Bash (git) | — | — | `git status`, `git diff`, `git commit` |
| 6 | TeamDelete | — | — | — |

## Escalation Ladder (applies to all steps)

1. **Orchestrator feedback** — up to 2 rounds of direct feedback to the sub-agent via `SendMessage`
2. **Collaborative escalation** — spawn "tech-researcher" to collaborate peer-to-peer with the stuck sub-agent (up to 3 rounds)
3. **Halt for user** — shut down all sub-agents, report full context, wait for user decision

## Critical Rules Enforced

- Sub-agents NEVER commit (all prompts include "Do NOT make any git commits")
- One sub-agent per workflow step
- Feedback goes to existing sub-agent via SendMessage (not by spawning new ones), except when transitioning between steps
- Team created once at the start
- User approval required before any git commit
- Automate before asking for help (manual task handling instructions in developer prompt)
