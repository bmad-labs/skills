# Execution Plan: "Refactor UserService to repository pattern"

## Task

> "I need to refactor the UserService to use the repository pattern instead of direct database calls. It's a focused change across 3 files in src/users/. Can you spec it out and implement it?"

---

## 1. Flow Detection: Quick Flow

**Decision: Quick Flow** (not Phase 4)

Reasons:
- The user describes a **small, self-contained change** (refactoring 3 files in one directory) -- matches Quick Flow trigger: "small, well-understood changes".
- The user explicitly says "spec it out and implement it" -- matches Quick Flow trigger: "create a tech spec" + "implement this change".
- No mention of epics, stories, sprints, or Phase 4 artifacts.
- The word "refactoring" directly matches the Quick Flow criteria: "bug fix, refactoring, small feature, patch".
- Even if `sprint-status.yaml` exists, the user's request is clearly a focused refactoring, so Quick Flow would still be appropriate per the ambiguity rule ("sounds like a small change, default to Quick Flow").

**Quick Flow Startup sub-path:** The user wants a new spec AND implementation (option 3: "User wants a new spec or described a change without one") -- so start at Quick Flow Step 1 (Create Tech-Spec), then proceed through all steps.

---

## 2. Startup Steps

### Step 2a: Create the Team

**Tool call:** `TeamCreate`
```
team_name: "bmad-auto"
description: "BMAD implementation orchestration"
```

This team is created once and persists through all sub-agent spawns for the entire workflow.

### Step 2b: Check for sprint-status.yaml (flow confirmation)

**Tool call:** `Read` or `Bash`
```
file_path: "_bmad-output/implementation-artifacts/sprint-status.yaml"
```

Purpose: Confirm Quick Flow selection. If the file exists with pending work, the orchestrator would still choose Quick Flow because the user's request is clearly a small refactoring. If it doesn't exist, Quick Flow is confirmed.

### Step 2c: Scan for Project Knowledge Base

The orchestrator scans for knowledge sources in this order:

**Tool calls (parallel):**

1. `Glob` -- pattern: `**/project-context.md` (looking for `_bmad-output/project-context.md`)
2. `Glob` -- pattern: `.knowledge-base/**` (knowledge base directory)
3. `Glob` -- pattern: `.memory/**` (memory directory)
4. `Glob` -- pattern: `.knowledge/**` (knowledge directory)
5. `Glob` -- pattern: `.standards/**` (standards directory)
6. `Glob` -- pattern: `.conventions/**` (conventions directory)
7. `Bash: ls CLAUDE.md .cursorrules .windsurfrules 2>/dev/null` (IDE rule files)

All found paths are collected into `{KNOWLEDGE_PATHS}`. For this plan, assume some are found (e.g., `CLAUDE.md` exists at the repo root).

### Step 2d: Report to User

The orchestrator tells the user:
> "This is a focused refactoring -- I'll use the Quick Flow. Starting with Step 1: creating a tech-spec for the UserService repository pattern refactoring, then proceeding to implementation, code review, and validation."

---

## 3. Sub-Agent Sequence

### Sub-Agent 1: quick-spec-creator (Quick Flow Step 1)

**Tool call:** `SpawnAgent` (or equivalent sub-agent spawn)
```yaml
name: "quick-spec-creator"
team_name: "bmad-auto"
prompt: |
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  - CLAUDE.md
  - _bmad-output/project-context.md
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-quick-spec"

  The user's request: Refactor the UserService in src/users/ to use the repository pattern
  instead of direct database calls. This is a focused change across 3 files in src/users/.

  Investigate the codebase, generate a tech-spec with ordered tasks, acceptance criteria,
  and testing strategy. Report the tech-spec file path when done.
```

**What the sub-agent does internally:**
- Invokes the `bmad-quick-spec` skill
- Reads files in `src/users/` to understand current UserService implementation
- Reads knowledge base files for project conventions
- Generates a tech-spec file (e.g., `_bmad-output/implementation-artifacts/tech-spec-userservice-repository-pattern.md`)
- Reports back via `SendMessage` to `"team-lead"` with the tech-spec file path

### Orchestrator Action After quick-spec-creator Reports

**Tool calls (sequential):**

1. `Read` -- Read the tech-spec file at the path reported by the sub-agent
2. **Present summary to user**: problem statement, approach (repository pattern), task list, acceptance criteria
3. **Ask user**: "Does this spec look good? I can proceed to implementation, or you can request changes."

**If user approves:**
- `SendMessage` to "quick-spec-creator" with `shutdown_request`
- Proceed to Step 2

**If user requests changes (up to 3 rounds):**
- `SendMessage` to "quick-spec-creator" with feedback (e.g., "Round 1/3: User wants X changed...")
- Wait for sub-agent to report updated spec
- Re-read spec, present to user again
- Repeat until approved or 3 rounds exhausted (then escalation ladder)

---

### Sub-Agent 2: quick-developer (Quick Flow Step 2)

**Tool call:** `SpawnAgent`
```yaml
name: "quick-developer"
team_name: "bmad-auto"
prompt: |
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  - CLAUDE.md
  - _bmad-output/project-context.md
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-quick-dev", args: "_bmad-output/implementation-artifacts/tech-spec-userservice-repository-pattern.md"

  Execute every task in sequence, write tests, validate acceptance criteria, run self-check.
  Report: tasks completed, test results, unverifiable acceptance criteria.

  ## Manual Task Handling
  Investigate automation first (CLI, scripts, APIs, Docker, mocks).
  If automatable -- do it. If truly impossible -- report to team lead with details and wait.
```

**What the sub-agent does internally:**
- Invokes `bmad-quick-dev` skill with the tech-spec path
- Reads the tech-spec to get ordered tasks
- Implements each task (e.g., create repository interface, refactor UserService, update imports)
- Writes/updates tests
- Validates acceptance criteria
- Reports results via `SendMessage` to `"team-lead"`

### Orchestrator Action After quick-developer Reports

**If successful:**
- Note the completion status
- Do NOT shut down quick-developer yet (it stays alive for potential fixes from code review)
- Proceed to Step 3

**If blocked:**
- Enter escalation ladder:
  1. Send feedback to quick-developer (up to 2 rounds)
  2. Spawn "tech-researcher" for collaborative escalation (up to 3 rounds)
  3. Halt for user

---

### Sub-Agent 3: quick-reviewer (Quick Flow Step 3)

**Tool call:** `SpawnAgent`
```yaml
name: "quick-reviewer"
team_name: "bmad-auto"
prompt: |
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  - CLAUDE.md
  - _bmad-output/project-context.md
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-bmm-code-review"
  Review changes from the Quick Flow implementation.
  Verify alignment with tech-spec at: _bmad-output/implementation-artifacts/tech-spec-userservice-repository-pattern.md
  Report pass/fail with specific issues.
```

### Orchestrator Action After quick-reviewer Reports

**If passes:**
- `SendMessage` to "quick-reviewer" with `shutdown_request`
- `SendMessage` to "quick-developer" with `shutdown_request` (no longer needed)
- Proceed to Step 4

**If issues found (up to 2 rounds):**
1. `SendMessage` to "quick-reviewer" with `shutdown_request`
2. `SendMessage` to "quick-developer" with fix instructions (e.g., "Round 1/2: Reviewer found these issues: ...")
3. Wait for quick-developer to report fixes
4. Spawn **new** "quick-reviewer" sub-agent
5. Wait for new review result
6. Repeat if needed; after 2 rounds, enter escalation ladder

---

### Sub-Agent 4: func-validator (Quick Flow Step 4)

**Tool call:** `SpawnAgent`
```yaml
name: "func-validator"
team_name: "bmad-auto"
prompt: |
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Task: Functional Validation for UserService Repository Pattern Refactoring
  Read validation instructions from: <skill_directory>/references/functional-validation-prompt.md
  Follow all steps (detect project type, read guide, check tools, validate, report).
  Report as PASS, PARTIAL, or FAIL.
```

### Orchestrator Action After func-validator Reports

**If PASS:**
- `SendMessage` to "func-validator" with `shutdown_request`
- Proceed to Step 5

**If PARTIAL:**
- Log warning, note which criteria couldn't be verified
- `SendMessage` to "func-validator" with `shutdown_request`
- Proceed to Step 5 (include PARTIAL details in commit message)

**If FAIL:**
- Send fix instructions to validator or respawn developer
- Re-run Steps 3 + 4
- Escalation ladder if still failing

---

### Quick Flow Step 5: Commit (Orchestrator handles directly -- no sub-agent)

**Tool calls (sequential):**

1. `Bash: git status` -- see all changed files
2. `Bash: git diff` -- see the actual changes
3. **Present to user:**
   > "Implementation complete. Here are the changes:
   > - Modified: src/users/user.service.ts (refactored to use repository)
   > - Created: src/users/user.repository.ts (new repository layer)
   > - Modified: src/users/user.module.ts (updated DI registrations)
   > - Modified: src/users/user.service.spec.ts (updated tests)
   >
   > Validation: PASS
   >
   > Proposed commit message: `refactor(users): extract repository pattern from UserService`
   >
   > Shall I commit these changes?"
4. **Wait for explicit user approval**
5. If approved: `Bash: git add <specific files> && git commit -m "refactor(users): extract repository pattern from UserService"`
6. Report: "Quick Flow complete."

---

## 4. Team Cleanup

**Tool call:** `TeamDelete`
```
team_name: "bmad-auto"
```

This shuts down any remaining sub-agents and removes the team.

---

## 5. Complete Sequence of Tool Calls

| #  | Tool            | Purpose                                              | Caller        |
|----|-----------------|------------------------------------------------------|---------------|
| 1  | TeamCreate      | Create "bmad-auto" team                              | Orchestrator  |
| 2  | Read            | Check `sprint-status.yaml` (flow confirmation)       | Orchestrator  |
| 3  | Glob (x7)      | Scan for knowledge base paths (parallel)             | Orchestrator  |
| 4  | SpawnAgent      | Spawn "quick-spec-creator"                           | Orchestrator  |
| 5  | *(sub-agent)*   | Skill: bmad-quick-spec, reads codebase, writes spec  | quick-spec-creator |
| 6  | SendMessage     | Sub-agent reports spec path to team-lead             | quick-spec-creator |
| 7  | Read            | Read the generated tech-spec                         | Orchestrator  |
| 8  | *(user interaction)* | Present spec summary, ask for approval          | Orchestrator  |
| 9  | SendMessage     | Shutdown quick-spec-creator                          | Orchestrator  |
| 10 | SpawnAgent      | Spawn "quick-developer"                              | Orchestrator  |
| 11 | *(sub-agent)*   | Skill: bmad-quick-dev, implements all tasks           | quick-developer |
| 12 | SendMessage     | Sub-agent reports implementation results             | quick-developer |
| 13 | SpawnAgent      | Spawn "quick-reviewer"                               | Orchestrator  |
| 14 | *(sub-agent)*   | Skill: bmad-bmm-code-review, reviews changes         | quick-reviewer |
| 15 | SendMessage     | Sub-agent reports pass/fail                          | quick-reviewer |
| 16 | SendMessage     | Shutdown quick-reviewer                              | Orchestrator  |
| 17 | SendMessage     | Shutdown quick-developer (if review passed)          | Orchestrator  |
| 18 | SpawnAgent      | Spawn "func-validator"                               | Orchestrator  |
| 19 | *(sub-agent)*   | Reads validation prompt, runs tests, validates       | func-validator |
| 20 | SendMessage     | Sub-agent reports PASS/PARTIAL/FAIL                  | func-validator |
| 21 | SendMessage     | Shutdown func-validator                              | Orchestrator  |
| 22 | Bash            | `git status`                                         | Orchestrator  |
| 23 | Bash            | `git diff`                                           | Orchestrator  |
| 24 | *(user interaction)* | Present changes, ask for commit approval        | Orchestrator  |
| 25 | Bash            | `git add` + `git commit` (after user approval)       | Orchestrator  |
| 26 | TeamDelete      | Clean up team                                        | Orchestrator  |

**Total sub-agents spawned (happy path): 4**
- quick-spec-creator (Step 1)
- quick-developer (Step 2, stays alive through Step 3 for fixes)
- quick-reviewer (Step 3)
- func-validator (Step 4)

**User interaction points: 3**
1. Approve/revise the tech-spec (after Step 1)
2. Approve the commit (Step 5)
3. Any escalation halts (only if problems occur)
