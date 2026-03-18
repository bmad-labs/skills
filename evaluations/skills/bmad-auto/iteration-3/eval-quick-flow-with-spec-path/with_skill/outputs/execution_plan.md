# Execution Plan: "Implement tech spec at given path"

**User Request:** "I have a tech spec for fixing the login validation bug. The spec is at _bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md. Go ahead and implement it."

---

## 1. Flow Detection: Quick Flow

**Decision:** Quick Flow is selected.

**Why:**
- The user explicitly provides a `tech-spec-*.md` file path (`tech-spec-fix-login-validation.md`). This matches the Quick Flow trigger: "The user provides or references a `tech-spec-*.md` file" (SKILL.md line 37).
- The user says "implement it" which matches "implement this spec" (line 39).
- There is no mention of epics, stories, Phase 4, or sprint status.
- Per the Quick Flow Startup rules (line 159): "User provided a tech-spec file path -> read file, proceed to Step 2 (Implement)."

**Result:** Quick Flow, starting at Step 2 (skipping Step 1: Create Tech-Spec since a spec already exists).

---

## 2. Startup Steps

### 2.1 Create Team

**Tool call:** `TeamCreate`
```
{ team_name: "bmad-auto", description: "BMAD implementation orchestration" }
```

This creates the persistent agent team used for all sub-agent spawning. Done once at startup per Critical Rule #10.

### 2.2 Read the Tech-Spec File

**Tool call:** `Read`
```
file_path: "_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md"
```

Parse the tech-spec to understand the change: problem statement, approach, task list, acceptance criteria, and testing strategy.

### 2.3 Project Knowledge Base Scan

Scan for project knowledge sources to build `{KNOWLEDGE_PATHS}`. The following tool calls are made in parallel:

**Tool calls (parallel):**

1. `Glob` — pattern: `_bmad-output/project-context.md`
2. `Glob` — pattern: `**/project-context.md`
3. `Glob` — pattern: `.knowledge-base/**`
4. `Glob` — pattern: `.memory/**`
5. `Glob` — pattern: `.knowledge/**`
6. `Glob` — pattern: `.standards/**`
7. `Glob` — pattern: `.conventions/**`
8. `Read` — file_path: `CLAUDE.md` (check if exists at project root)
9. `Glob` — pattern: `.cursorrules`
10. `Glob` — pattern: `.windsurfrules`

Collect all found paths into `{KNOWLEDGE_PATHS}`. If none found, list is empty (do not halt).

### 2.4 Report to User

Output a message to the user:
> "Quick Flow detected. Tech-spec found at `_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md`. This spec addresses the login validation bug fix. Proceeding to Step 2: Implementation."

---

## 3. Sub-Agent Sequence

### 3.1 Quick Flow Step 2: Implement from Tech-Spec

**Sub-agent spawned:**

- **Name:** `"quick-developer"`
- **Team:** `"bmad-auto"`
- **Prompt content:**
  ```
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  {CONTEXT_BLOCK}
  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  <list of {KNOWLEDGE_PATHS} found during startup>
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-quick-dev", args: "_bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md"

  Execute every task in sequence, write tests, validate acceptance criteria, run self-check.
  Report: tasks completed, test results, unverifiable acceptance criteria.

  ## Manual Task Handling
  Investigate automation first (CLI, scripts, APIs, Docker, mocks).
  If automatable -> do it. If truly impossible -> report to team lead with details and wait.
  ```

**Orchestrator actions after sub-agent reports:**

| Sub-agent Report | Orchestrator Action |
|---|---|
| **Successful** (all tasks done, tests pass) | Shut down `quick-developer`. Proceed to Step 3 (Code Review). |
| **Blocked on manual task** | Review the investigation. Suggest automation if missed. If truly manual, halt for user input. |
| **Failed / errors** | Enter escalation ladder: (1) Send feedback to same `quick-developer` agent, up to 2 rounds. (2) If still failing, spawn `"tech-researcher"` in same team for collaborative escalation, up to 3 rounds. (3) If still failing, halt for user. |
| **Scope exceeds Quick Flow** | Report to user with two options: Light (re-run bmad-quick-spec for more detailed spec) or Heavy (switch to full BMAD Phases 1-4). Wait for decision. |
| **No response (timeout)** | After 2 idle cycles, send status check. After 2 status checks with no response, shut down and respawn. |

---

### 3.2 Quick Flow Step 3: Code Review

**Sub-agent spawned:**

- **Name:** `"quick-reviewer"`
- **Team:** `"bmad-auto"`
- **Prompt content:**
  ```
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  {CONTEXT_BLOCK}
  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  <list of {KNOWLEDGE_PATHS} found during startup>
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-bmm-code-review"
  Review changes from the Quick Flow implementation.
  Verify alignment with tech-spec at: _bmad-output/implementation-artifacts/tech-spec-fix-login-validation.md
  Report pass/fail with specific issues.
  ```

**Orchestrator actions after sub-agent reports:**

| Sub-agent Report | Orchestrator Action |
|---|---|
| **Passes** | Shut down `quick-reviewer`. Proceed to Step 4 (Functional Validation). |
| **Issues found** | Shut down `quick-reviewer`. Send fix instructions to `"quick-developer"` (still alive with context from Step 2). After developer fixes and reports back, spawn a new `"quick-reviewer"`. Retry up to 2 rounds. If still failing, enter escalation ladder. |

---

### 3.3 Quick Flow Step 4: Functional Validation

**Sub-agent spawned:**

- **Name:** `"func-validator"`
- **Team:** `"bmad-auto"`
- **Prompt content:**
  ```
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Task: Functional Validation for tech-spec-fix-login-validation
  Read validation instructions from: <skill_directory>/references/functional-validation-prompt.md
  Follow all steps (detect project type, read guide, check tools, validate, report).
  Report as PASS, PARTIAL, or FAIL.
  ```

**Orchestrator actions after sub-agent reports:**

| Sub-agent Report | Orchestrator Action |
|---|---|
| **PASS** | Shut down `func-validator`. Proceed to Step 5 (Commit). |
| **PARTIAL** | Log warning. Shut down `func-validator`. Proceed to Step 5 with partial validation note included in commit message. |
| **FAIL** | Send fix instructions to `func-validator` or re-spawn `quick-developer`. Re-run Steps 3 + 4. Enter escalation ladder if still failing. |

---

### 3.4 Quick Flow Step 5: Commit

This step is handled by the orchestrator directly (no sub-agent).

**Tool calls (parallel):**

1. `Bash` — command: `git status`
2. `Bash` — command: `git diff`

**Orchestrator actions:**

1. Review the changes shown by git status/diff.
2. Present commit proposal to user with:
   - Proposed commit message: `fix(auth): fix login validation bug` (following the `fix|feat|refactor(<scope>): <description>` format)
   - Validation results (PASS/PARTIAL details)
   - Summary of files changed
3. **Wait for explicit user approval** before committing. Do NOT auto-commit (per Critical Rule #1 and user's CLAUDE.md instruction "Never automatic do git commit").
4. After user approves, execute: `git add <specific files>` then `git commit -m "<approved message>"`
5. Report: "Quick Flow complete."

---

## 4. Team Cleanup

After Step 5 completes (or if user stops):

**Tool call:** `TeamDelete`
```
{ team_name: "bmad-auto" }
```

Shut down any remaining sub-agents and delete the team.

---

## 5. Complete Sequence of Tool Calls (Summary)

| # | Tool | Purpose | Parallel? |
|---|---|---|---|
| 1 | `TeamCreate` | Create "bmad-auto" team | No |
| 2 | `Read` | Read the tech-spec file | No |
| 3a-3j | `Glob` x8 + `Read` x2 | Scan for knowledge base paths | Yes (all parallel) |
| 4 | (Output to user) | Report: Quick Flow Step 2 starting | No |
| 5 | `SubAgentCreate` | Spawn `"quick-developer"` with bmad-quick-dev skill | No |
| 6 | (Wait) | Wait for sub-agent SendMessage report | No |
| 7 | (Review) | Orchestrator reviews dev report; feedback or proceed | No |
| 8 | `SendMessage` / shutdown | Shut down developer if proceeding to review | No |
| 9 | `SubAgentCreate` | Spawn `"quick-reviewer"` with bmad-bmm-code-review skill | No |
| 10 | (Wait) | Wait for sub-agent SendMessage report | No |
| 11 | (Review) | Orchestrator reviews; if issues, feedback loop with developer + new reviewer | No |
| 12 | `SendMessage` / shutdown | Shut down reviewer | No |
| 13 | `SubAgentCreate` | Spawn `"func-validator"` with functional-validation-prompt | No |
| 14 | (Wait) | Wait for sub-agent SendMessage report | No |
| 15 | (Review) | Orchestrator reviews PASS/PARTIAL/FAIL | No |
| 16 | `SendMessage` / shutdown | Shut down validator | No |
| 17a | `Bash: git status` | Check working tree state | Yes (parallel) |
| 17b | `Bash: git diff` | Check code changes | Yes (parallel) |
| 18 | (Output to user) | Present commit proposal, ask for approval | No |
| 19 | (Wait) | Wait for user approval | No |
| 20 | `Bash: git add` + `Bash: git commit` | Commit approved changes | No |
| 21 | (Output to user) | Report: "Quick Flow complete." | No |
| 22 | `TeamDelete` | Clean up team | No |

---

## Key Observations

1. **Step 1 (Create Tech-Spec) is entirely skipped** because the user provided an explicit file path to an existing tech-spec.
2. **The `quick-developer` sub-agent is kept alive** through Steps 2-3 so that if code review finds issues, the orchestrator can send fix instructions to the same agent without losing implementation context.
3. **Three distinct sub-agents** are spawned sequentially: `quick-developer`, `quick-reviewer`, `func-validator`.
4. **The orchestrator never writes code itself** — it only reviews sub-agent reports, makes routing decisions, and handles git operations.
5. **User approval is required before committing** — the orchestrator proposes a message and waits.
