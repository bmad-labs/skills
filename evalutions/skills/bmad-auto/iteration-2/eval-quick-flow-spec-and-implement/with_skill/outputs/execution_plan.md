# Execution Plan: Refactor UserService to Repository Pattern

## Task Summary

The user wants to refactor `UserService` to use the repository pattern instead of direct database calls. This is a focused change across 3 files in `src/users/`. No input files are provided — the user described the change verbally.

## Flow Detection Decision

**Selected Flow: Quick Flow**

Rationale:
- The user describes a small, self-contained refactoring change
- No `sprint-status.yaml` is referenced or expected
- The change is well-understood ("repository pattern" is a known pattern)
- It spans only 3 files in a single directory — clearly scoped
- The user explicitly says "spec it out and implement it" which maps to Quick Flow Steps 1 + 2

**Quick Flow Startup Path:** The user described a change without a spec (path 3 from SKILL.md), so we start at Quick Flow Step 1 (Create Tech-Spec).

---

## Pre-Execution Setup

### Step 0: Create Team

```
TeamCreate: { team_name: "bmad-auto", description: "BMAD Quick Flow implementation" }
```

---

## Step 1: Create Tech-Spec (Quick Flow Step 1)

### 1.1 Spawn Sub-Agent: "quick-spec-creator"

```
Agent tool:
  name: "quick-spec-creator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-quick-spec"

    Follow the quick-spec workflow completely:
    1. Understand the user's goal and scan the codebase for context
    2. Investigate relevant files and map code patterns
    3. Generate a tech-spec with ordered implementation tasks, acceptance criteria,
       and testing strategy
    4. Present the spec for review

    The user's request: "Refactor the UserService to use the repository pattern
    instead of direct database calls. It's a focused change across 3 files in
    src/users/."

    Report results to the team lead via SendMessage when the spec is ready for review.
    Include the tech-spec file path in your report.

    If you encounter issues needing a decision, report the issue details and wait
    for instructions — do NOT proceed on your own.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

### 1.2 Orchestrator Actions After Sub-Agent Reports

1. Read the generated tech-spec file (expected path: `_bmad-output/implementation-artifacts/tech-spec-userservice-repository-pattern.md` or similar).
2. Present a summary to the user:
   - Problem statement: UserService currently makes direct database calls
   - Solution approach: Introduce a UserRepository interface/class, move DB calls there, inject into UserService
   - Task list from the spec
3. Ask: "Does this spec look good? I can proceed to implementation, or you can request changes."

### 1.3 Decision Points

- **User approves** -> Send `shutdown_request` to "quick-spec-creator" -> Proceed to Step 2
- **User wants changes** -> Send feedback via `SendMessage` to "quick-spec-creator" with requested changes. Wait for re-report. Retry up to 3 times.
- **User rejects** -> Send `shutdown_request` -> Stop

---

## Step 2: Implement from Tech-Spec (Quick Flow Step 2)

### 2.1 Spawn Sub-Agent: "quick-developer"

```
Agent tool:
  name: "quick-developer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-quick-dev"
    - args: "<path-to-tech-spec-file>"

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

### 2.2 Orchestrator Actions After Sub-Agent Reports

- **Successful** -> Proceed to Step 3 (Code Review)
- **Blocked** -> Follow escalation ladder:
  1. Send feedback to "quick-developer" with suggestions (up to 2 rounds)
  2. If still blocked -> Collaborative Escalation: spawn "tech-researcher" in team "bmad-auto" to investigate the blocker. Notify "quick-developer" that researcher is assigned. Let them collaborate peer-to-peer via SendMessage. Monitor via idle notifications.
  3. If resolved -> shut down "tech-researcher" -> proceed to Step 3
  4. If not resolved after 3 collaboration rounds -> shut down both sub-agents -> report to user and pause

### 2.3 Scope Escalation Check

If the sub-agent reports the scope exceeds Quick Flow capacity:
- Report escalation recommendation to user
- Offer: (a) Light escalation — run bmad-quick-spec for a more detailed spec, (b) Heavy escalation — switch to full BMAD Phase 4 flow
- Wait for user decision

---

## Step 3: Code Review (Quick Flow Step 3)

### 3.1 Spawn Sub-Agent: "quick-reviewer"

```
Agent tool:
  name: "quick-reviewer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-code-review"

    Review the code changes from the most recent Quick Flow implementation.
    Also verify alignment with the tech-spec at: <path-to-tech-spec-file>

    Report the review results to the team lead via SendMessage — pass or fail with specific
    issues found. If issues need a decision, report and wait.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

### 3.2 Orchestrator Actions After Sub-Agent Reports

- **Review passes** -> Send `shutdown_request` to "quick-reviewer" -> Proceed to Step 4
- **Review finds issues**:
  1. Shut down "quick-reviewer"
  2. Send fix instructions to "quick-developer" (still alive with full implementation context) via SendMessage
  3. After "quick-developer" reports fixes -> spawn a new "quick-reviewer"
  4. Retry up to 2 times
  5. If still failing -> report to user and pause

---

## Step 4: Functional Validation (Quick Flow Step 4)

### 4.1 Spawn Sub-Agent: "func-validator"

```
Agent tool:
  name: "func-validator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    ## Task: Functional Validation for UserService Repository Pattern Refactoring

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

### 4.2 Orchestrator Actions After Sub-Agent Reports

- **PASS** -> Send `shutdown_request` to "func-validator" -> Proceed to Step 5
- **PARTIAL** -> Send `shutdown_request` to "func-validator" -> Log warning -> Proceed to Step 5
- **FAIL**:
  1. If quick fix is apparent -> send instructions to "func-validator" to attempt fix. Wait for re-report.
  2. If re-development needed -> shut down "func-validator" -> send fix instructions to "quick-developer" -> after fixes, re-run Steps 3 and 4.
  3. If still failing after 2 rounds -> collaborative escalation with "tech-researcher" and "quick-developer" peer-to-peer.
  4. If resolved -> shut down "tech-researcher" -> re-run Steps 3 and 4.
  5. If not resolved after 3 collaboration rounds -> shut down all sub-agents -> report to user with full error context and pause.

---

## Step 5: Commit (Quick Flow Step 5)

### 5.1 Orchestrator Actions (no sub-agent needed)

1. Run `git status` and `git diff` to see all changes
2. Present changes summary to user with proposed commit message:
   ```
   refactor(users): extract repository pattern from UserService
   ```
3. Include functional validation results in summary (e.g., "Build: OK, Tests: OK")
4. **Wait for user approval** before committing
5. Only commit after explicit user approval
6. Report: "Quick Flow complete. All changes committed."

---

## Team Cleanup

After Step 5 completes (or if user stops at any point):
1. Send `shutdown_request` to all active sub-agents ("quick-developer" if still alive, any others)
2. Wait for shutdown confirmations
3. Delete the team via `TeamDelete`

---

## Summary of Sub-Agents and Their Lifecycles

| Sub-Agent | Created At | Shut Down At | Notes |
|---|---|---|---|
| quick-spec-creator | Step 1.1 | Step 1.3 (after user approves spec) | Receives feedback if user wants spec changes |
| quick-developer | Step 2.1 | Step 5 (end of workflow) | Stays alive through Steps 3-4 for fix instructions |
| quick-reviewer | Step 3.1 | Step 3.2 (after review result) | May be respawned if fixes are needed |
| func-validator | Step 4.1 | Step 4.2 (after validation result) | May be respawned after fixes |
| tech-researcher | Only if escalation | After blocker resolved | Peer-to-peer with stuck worker |

## Key Decision Points

1. **Flow Detection**: Quick Flow (not Phase 4) — small refactoring, no sprint-status.yaml
2. **Spec Approval**: User must approve the tech-spec before implementation begins
3. **Scope Escalation**: If spec creation reveals the change is larger than expected, offer escalation options
4. **Code Review Loop**: Review failures route back to quick-developer (max 2 retries)
5. **Functional Validation Loop**: Build/test failures route back to developer with escalation ladder
6. **Commit Approval**: User must explicitly approve the commit

## Tools That Would Be Called

1. `TeamCreate` — once at the start
2. `Agent` tool — for each sub-agent spawn (quick-spec-creator, quick-developer, quick-reviewer, func-validator, and optionally tech-researcher)
3. `SendMessage` — for orchestrator-to-sub-agent communication (feedback, shutdown requests)
4. `Skill` tool — invoked BY sub-agents (bmad-quick-spec, bmad-quick-dev, bmad-bmm-code-review)
5. `Read` tool — orchestrator reads tech-spec after creation, reads sprint-status if needed
6. `Bash` tool — git status, git diff, git commit (Step 5 only)
7. `TeamDelete` — cleanup at the end
