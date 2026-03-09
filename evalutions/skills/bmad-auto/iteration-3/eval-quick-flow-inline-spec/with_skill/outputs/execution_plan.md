# Execution Plan: Rate Limiting with Inline Tech-Spec

## 1. Flow Detection: Quick Flow

**Decision:** Quick Flow (not Phase 4).

**Reasoning:**
- The user provided an **inline tech-spec** directly in their message (problem statement, solution, ordered tasks, acceptance criteria). This matches the Quick Flow Startup rule #4: "User provided inline spec -> save as `tech-spec-{slug}.md` -> Step 2."
- The user did not reference any Phase 4 artifacts (epics, stories, sprint planning).
- There is no indication that `sprint-status.yaml` exists or that a Phase 4 pipeline is active.
- The request is a self-contained, well-understood feature (rate limiting on a single endpoint) -- exactly the kind of change Quick Flow is designed for.
- Multiple trigger phrases match: the user says "Here's my tech spec" which maps to the skill description's trigger "(4) implement from a tech-spec or quick-spec."

---

## 2. Startup Steps

### 2.1 Create Team

**Tool call:** `TeamCreate`
```
team_name: "bmad-auto"
description: "BMAD implementation orchestration"
```

### 2.2 Scan for Project Knowledge Base

The orchestrator scans for knowledge sources in this order:

**Tool calls (parallel):**

1. `Glob` -- pattern: `**/project-context.md` (looking for BMAD project context)
2. `Glob` -- pattern: `.knowledge-base/**` (custom knowledge base directory)
3. `Glob` -- pattern: `.memory/**`
4. `Glob` -- pattern: `.knowledge/**`
5. `Glob` -- pattern: `.standards/**`
6. `Glob` -- pattern: `.conventions/**`
7. `Bash` -- check for `CLAUDE.md`, `.cursorrules`, `.windsurfrules` at project root

All found paths are collected into `{KNOWLEDGE_PATHS}`. If none found, the list is empty (the orchestrator does not halt).

### 2.3 Save Inline Spec to File

Per Quick Flow Startup rule #4, the inline spec is saved to disk before proceeding.

**Tool call:** `Write`
```
file_path: _bmad-output/implementation-artifacts/tech-spec-rate-limiter.md
content: <the user's inline spec, formatted as a proper tech-spec document>
```

### 2.4 Report to User

The orchestrator reports:
- "Detected Quick Flow. You provided an inline tech-spec for adding rate limiting to `/api/users`."
- "Saved spec to `tech-spec-rate-limiter.md`. Proceeding to Step 2: Implementation."
- Skipping Step 1 (Create Tech-Spec) because the user already provided one.

---

## 3. Quick Flow Step 2: Implement from Tech-Spec

### 3.1 Spawn Sub-Agent: "quick-developer"

**Tool call:** `AgentSpawn` (or equivalent sub-agent creation)
```
name: "quick-developer"
team_name: "bmad-auto"
prompt: |
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  {CONTEXT_BLOCK}
  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  <list of {KNOWLEDGE_PATHS} found during startup>
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-quick-dev", args: "_bmad-output/implementation-artifacts/tech-spec-rate-limiter.md"

  Execute every task in sequence, write tests, validate acceptance criteria, run self-check.
  Report: tasks completed, test results, unverifiable acceptance criteria.

  ## Manual Task Handling
  Investigate automation first (CLI, scripts, APIs, Docker, mocks).
  If automatable -- do it. If truly impossible -- report to team lead with details and wait.
```

### 3.2 Orchestrator Waits for Report

The orchestrator waits for `quick-developer` to send a message via `SendMessage` to `"team-lead"`.

**Expected work by sub-agent:**
1. Reads the tech-spec file
2. Invokes `bmad-quick-dev` skill with the spec path
3. Executes the 5 tasks in order:
   - Installs `ioredis` dependency
   - Creates `RateLimiterService` in `src/common/rate-limiter.service.ts`
   - Creates `RateLimiterGuard` in `src/common/rate-limiter.guard.ts`
   - Applies guard to `UsersController`
   - Adds unit tests for `RateLimiterService`
4. Runs tests, validates acceptance criteria
5. Reports results back

### 3.3 Orchestrator Reviews Report

**On success:** Shut down `quick-developer`, proceed to Step 3.

**On issues (up to 2 feedback rounds):**
- **Tool call:** `SendMessage` to `quick-developer` with fix instructions (e.g., "Round 1/2: Tests are failing because X. Fix by doing Y.")
- Wait for updated report.
- If still failing after 2 rounds -> collaborative escalation (spawn `tech-researcher` to collaborate peer-to-peer with `quick-developer`, up to 3 rounds).
- If still failing -> halt for user.

**On blocked (manual task):**
- Review the sub-agent's investigation of automation approaches.
- Suggest automation if missed.
- If truly manual, halt for user.

---

## 4. Quick Flow Step 3: Code Review

### 4.1 Spawn Sub-Agent: "quick-reviewer"

**Tool call:** `AgentSpawn`
```
name: "quick-reviewer"
team_name: "bmad-auto"
prompt: |
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  {CONTEXT_BLOCK}
  ## Project Context
  Read and follow these project knowledge sources (skip any that don't exist):
  <list of {KNOWLEDGE_PATHS}>
  Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
  These define the project's standards, conventions, and implementation rules.
  Follow them when making decisions. If no knowledge sources exist, use general best practices.

  Invoke the Skill tool with skill: "bmad-bmm-code-review"
  Review changes from the Quick Flow implementation.
  Verify alignment with tech-spec at: _bmad-output/implementation-artifacts/tech-spec-rate-limiter.md
  Report pass/fail with specific issues.
```

### 4.2 Orchestrator Waits and Reviews

**On pass:** Shut down `quick-reviewer`, proceed to Step 4.

**On issues found (up to 2 rounds):**
1. Shut down `quick-reviewer`.
2. **Tool call:** `SendMessage` to `quick-developer` (still alive with context) with fix instructions from the review.
3. Wait for `quick-developer` to fix and report.
4. Spawn a **new** `quick-reviewer` to re-review.
5. If still failing after 2 rounds -> escalation ladder.

---

## 5. Quick Flow Step 4: Functional Validation

### 5.1 Spawn Sub-Agent: "func-validator"

**Tool call:** `AgentSpawn`
```
name: "func-validator"
team_name: "bmad-auto"
prompt: |
  {AGENT_HEADER}
  You are a BMAD team sub-agent. Do NOT make any git commits.
  After completing your work, report results to the team lead via SendMessage.
  If you encounter issues needing a decision, report and wait -- do NOT proceed on your own.
  You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
  When you receive a shutdown_request, approve it.

  ## Task: Functional Validation for rate-limiter implementation
  Read validation instructions from: <skill_directory>/references/functional-validation-prompt.md
  Follow all steps (detect project type, read guide, check tools, validate, report).
  Report as PASS, PARTIAL, or FAIL.
```

### 5.2 Orchestrator Reviews Validation

**PASS:** Shut down `func-validator`, proceed to Step 5.

**PARTIAL:** Log warning, shut down `func-validator`, proceed to Step 5. Include partial validation details in eventual commit message.

**FAIL:** Send fix instructions to `func-validator` or re-spawn `quick-developer` to fix. Re-run Steps 3 + 4 (code review + functional validation). Escalation ladder if still failing.

---

## 6. Quick Flow Step 5: Commit

### 6.1 Inspect Changes

**Tool calls (parallel):**
1. `Bash` -- `git status`
2. `Bash` -- `git diff`

### 6.2 Present Commit for Approval

The orchestrator presents a summary to the user:
- Proposed commit message: `feat(users): add sliding window rate limiter with Redis`
- Validation results (PASS/PARTIAL details)
- List of changed files
- Asks: "Approve this commit?"

### 6.3 Commit (only after explicit user approval)

**Tool call:** `Bash` -- `git add <specific files>` then `git commit -m "feat(users): add sliding window rate limiter with Redis"`

### 6.4 Report Completion

"Quick Flow complete. Rate limiting has been added to `/api/users` with sliding window algorithm using ioredis."

---

## 7. Team Cleanup

**Tool call:** Shut down all remaining sub-agents, then `TeamDelete` for team `"bmad-auto"`.

---

## Complete Sequence of Tool Calls (Summary)

| # | Tool | Purpose |
|---|------|---------|
| 1 | `TeamCreate` | Create "bmad-auto" team |
| 2 | `Glob` x5-7 (parallel) | Scan for knowledge base files |
| 3 | `Bash` | Check for CLAUDE.md, .cursorrules, .windsurfrules |
| 4 | `Write` | Save inline spec to `tech-spec-rate-limiter.md` |
| 5 | `AgentSpawn` | Spawn `quick-developer` with bmad-quick-dev skill |
| 6 | *wait* | Orchestrator waits for developer report |
| 7 | `SendMessage` (0-2x) | Feedback rounds if issues arise |
| 8 | `shutdown_request` | Shut down developer (if review passes first time) |
| 9 | `AgentSpawn` | Spawn `quick-reviewer` with bmad-bmm-code-review skill |
| 10 | *wait* | Orchestrator waits for review report |
| 11 | `SendMessage` to developer (0-2x) | Fix instructions if review finds issues |
| 12 | `AgentSpawn` (0-2x) | Respawn reviewer after fixes |
| 13 | `shutdown_request` | Shut down reviewer |
| 14 | `shutdown_request` | Shut down developer (after review cycle complete) |
| 15 | `AgentSpawn` | Spawn `func-validator` |
| 16 | *wait* | Orchestrator waits for validation report |
| 17 | `shutdown_request` | Shut down validator |
| 18 | `Bash` x2 (parallel) | `git status` and `git diff` |
| 19 | *wait for user* | Present commit for approval |
| 20 | `Bash` | `git add` + `git commit` (after approval) |
| 21 | `TeamDelete` | Clean up team |

**Total sub-agents spawned (happy path):** 3 (quick-developer, quick-reviewer, func-validator)

**Potential additional sub-agents (escalation):** `tech-researcher` if any step enters collaborative escalation.
