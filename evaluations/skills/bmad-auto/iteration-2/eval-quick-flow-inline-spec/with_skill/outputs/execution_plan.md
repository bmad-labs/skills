# Execution Plan: Add Rate Limiting to /api/users Endpoint

## Flow Detection Decision

**Selected Flow: Quick Flow**

Rationale: The user provided a tech-spec inline (pasted detailed spec with problem, solution, tasks, and acceptance criteria). Per the SKILL.md Flow Detection rules:
- No `sprint-status.yaml` referenced or expected
- The user describes a small, self-contained feature (rate limiting on one endpoint)
- The spec content is provided inline in the prompt

Per Quick Flow Startup rule #4: "If the user provided a tech-spec inline (pasted content or described a detailed change) -> save it as `_bmad-output/implementation-artifacts/tech-spec-{slug}.md` and proceed to Quick Flow Step 2."

## Pre-Execution Setup

### 1. Save Inline Tech-Spec

**Action:** Write the user's inline spec to a tech-spec file.

- **Tool:** `Write`
- **Path:** `_bmad-output/implementation-artifacts/tech-spec-rate-limiter.md`
- **Content:** The user's provided spec (problem, solution, tasks 1-5, acceptance criteria), formatted as a standard tech-spec markdown file.

### 2. Create Team

**Action:** Create the BMAD team for Quick Flow orchestration.

- **Tool:** `TeamCreate`
- **Parameters:**
  - `team_name: "bmad-auto"`
  - `description: "BMAD Quick Flow implementation"`

### 3. Report to User

**Action:** Inform the user that Quick Flow Step 2 (Implement) will execute, since the spec was provided inline. Summarize:
- Problem: No rate limiting on user API endpoints
- Solution: Sliding window rate limiter with ioredis
- 5 implementation tasks
- 2 acceptance criteria
- Skipping Step 1 (spec creation) since spec was provided inline

---

## Quick Flow Step 2: Implement from Tech-Spec

### Spawn Sub-Agent: "quick-developer"

**Tool:** `Agent`

**Parameters:**
- `name: "quick-developer"`
- `team_name: "bmad-auto"`
- `prompt:` (see below)

**Sub-Agent Prompt:**
```
You are a BMAD team sub-agent. Do NOT make any git commits.

Invoke the Skill tool with:
- skill: "bmad-quick-dev"
- args: "_bmad-output/implementation-artifacts/tech-spec-rate-limiter.md"

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
for instructions -- do NOT proceed on your own.

You may receive messages from other teammates (e.g., a researcher). Collaborate
with them directly via SendMessage to resolve issues together.

When you receive a shutdown_request, approve it.
```

### Expected Sub-Agent Work

The "quick-developer" sub-agent would invoke `bmad-quick-dev` skill which would:

1. **Task 1 - Install ioredis dependency:** Run `npm install ioredis` (and `npm install -D @types/ioredis` if TypeScript project)
2. **Task 2 - Create RateLimiterService:** Create `src/common/rate-limiter.service.ts` implementing sliding window algorithm with Redis sorted sets (ZADD/ZRANGEBYSCORE/ZREMRANGEBYSCORE pattern)
3. **Task 3 - Create RateLimiterGuard:** Create `src/common/rate-limiter.guard.ts` implementing NestJS CanActivate guard that calls RateLimiterService and throws 429 HttpException
4. **Task 4 - Apply guard to UsersController:** Add `@UseGuards(RateLimiterGuard)` decorator to the UsersController
5. **Task 5 - Add unit tests:** Create `src/common/rate-limiter.service.spec.ts` with tests covering both acceptance criteria

### Orchestrator Decision Points After Sub-Agent Reports

- **If successful:** Send `shutdown_request` to "quick-developer" -> proceed to Step 3 (Code Review)
- **If blocked (e.g., no Redis available, project structure differs from expected):**
  1. Review blocker details
  2. Send feedback to "quick-developer" with suggestions (up to 2 rounds)
  3. If still blocked -> spawn "tech-researcher" sub-agent for collaborative escalation
  4. If still unresolved after 3 collaboration rounds -> halt for user

---

## Quick Flow Step 3: Code Review

### Spawn Sub-Agent: "quick-reviewer"

**Tool:** `Agent`

**Parameters:**
- `name: "quick-reviewer"`
- `team_name: "bmad-auto"`
- `prompt:` (see below)

**Sub-Agent Prompt:**
```
You are a BMAD team sub-agent. Do NOT make any git commits.

Invoke the Skill tool with:
- skill: "bmad-bmm-code-review"

Review the code changes from the most recent Quick Flow implementation.
Also verify alignment with the tech-spec at: _bmad-output/implementation-artifacts/tech-spec-rate-limiter.md

Report the review results to the team lead via SendMessage -- pass or fail with specific
issues found. If issues need a decision, report and wait.

You may receive messages from other teammates (e.g., a researcher). Collaborate
with them directly via SendMessage to resolve issues together.

When you receive a shutdown_request, approve it.
```

### Orchestrator Decision Points After Sub-Agent Reports

- **If review passes:** Send `shutdown_request` to "quick-reviewer" -> proceed to Step 4 (Functional Validation)
- **If review finds issues:**
  1. Shut down "quick-reviewer"
  2. Send fix instructions to "quick-developer" (which still has full implementation context) via `SendMessage`
  3. After fixes, spawn a new "quick-reviewer"
  4. Retry up to 2 times. If still failing -> report to user and pause

---

## Quick Flow Step 4: Functional Validation

### Spawn Sub-Agent: "func-validator"

**Tool:** `Agent`

**Parameters:**
- `name: "func-validator"`
- `team_name: "bmad-auto"`
- `prompt:` (see below)

**Sub-Agent Prompt:**
```
You are a BMAD team sub-agent. Do NOT make any git commits.

## Task: Functional Validation for Rate Limiter Implementation

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

### Expected Validation Work

- Run `npm run build` (or `tsc`) to verify compilation
- Run `npm test` (or `jest`) to execute unit tests for RateLimiterService
- Verify acceptance criteria:
  - 100 requests within 60s allowed, 101st returns 429
  - After window expires, new requests succeed

### Orchestrator Decision Points After Sub-Agent Reports

- **If PASS:** Send `shutdown_request` to "func-validator" -> proceed to Step 5 (Commit)
- **If PARTIAL (e.g., Redis not available for integration test):** Send `shutdown_request` -> log warning -> proceed to Step 5
- **If FAIL:**
  1. Send error details to "func-validator" for quick fix attempt (up to 2 rounds)
  2. If needs re-development -> shut down "func-validator" -> send fix instructions to "quick-developer" -> re-run Steps 3 and 4
  3. If still failing -> collaborative escalation with "tech-researcher"
  4. If unresolved -> halt for user

---

## Quick Flow Step 5: Commit

### Orchestrator Actions (No Sub-Agent)

1. **Run `git status`** to see all changed/new files
2. **Run `git diff`** to see the full diff
3. **Present commit summary to user:**
   - Files changed: `package.json`, `src/common/rate-limiter.service.ts`, `src/common/rate-limiter.guard.ts`, `src/users/users.controller.ts`, `src/common/rate-limiter.service.spec.ts`
   - Proposed commit message: `feat(users): add sliding window rate limiting with Redis`
   - Functional validation results (PASS/PARTIAL/FAIL details)
4. **Wait for user approval** before committing
5. **If approved:** Execute `git add` and `git commit` with the approved message
6. **Report:** "Quick Flow complete. All changes committed."

---

## Team Cleanup

After Step 5 completes (or if halted at any point):

1. Send `shutdown_request` to all active sub-agents
2. Wait for shutdown confirmations
3. Delete the team via `TeamDelete`

---

## Escalation Scenarios

### Scenario A: Sub-agent reports Redis connection issues during testing
1. Orchestrator sends feedback: "Use mock Redis or in-memory implementation for unit tests. Only integration tests need real Redis."
2. Sub-agent retries with mocked Redis
3. If resolved -> continue. If not -> spawn "tech-researcher"

### Scenario B: Code review finds security issues (e.g., no IP extraction, missing error handling)
1. Shut down "quick-reviewer"
2. Send detailed fix list to "quick-developer"
3. "quick-developer" fixes and reports back
4. Spawn new "quick-reviewer" for re-review
5. Up to 2 retry cycles

### Scenario C: Scope escalation (e.g., rate limiter needs distributed support, multiple endpoints)
1. Report escalation to user
2. Offer options: light escalation (run bmad-quick-spec for more detailed spec) or heavy escalation (full BMAD Phase 4)
3. Wait for user decision

---

## Summary of Tool Calls (in order)

| Step | Tool | Purpose |
|------|------|---------|
| Pre-1 | `Write` | Save inline tech-spec to `_bmad-output/implementation-artifacts/tech-spec-rate-limiter.md` |
| Pre-2 | `TeamCreate` | Create "bmad-auto" team |
| 2 | `Agent` | Spawn "quick-developer" with `bmad-quick-dev` skill |
| 2b | `SendMessage` | (conditional) Send feedback or shutdown to "quick-developer" |
| 3 | `Agent` | Spawn "quick-reviewer" with `bmad-bmm-code-review` skill |
| 3b | `SendMessage` | (conditional) Send feedback, shutdown, or escalation messages |
| 4 | `Agent` | Spawn "func-validator" with functional validation |
| 4b | `SendMessage` | (conditional) Send feedback or shutdown to "func-validator" |
| 5 | `Bash` | Run `git status` and `git diff` |
| 5b | Orchestrator | Present commit summary and wait for user approval |
| 5c | `Bash` | (on approval) `git add` and `git commit` |
| Cleanup | `SendMessage` | Shutdown all remaining sub-agents |
| Cleanup | `TeamDelete` | Delete "bmad-auto" team |
