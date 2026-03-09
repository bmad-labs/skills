# Execution Plan: "quick dev — find existing tech-spec and implement auth token refresh fix"

## 1. Flow Detection: Quick Flow

**Decision:** Quick Flow (not Phase 4).

**Reasons:**
- The user explicitly said "quick dev", which is a direct trigger phrase listed under Quick Flow detection: `"quick dev"`.
- The user references an existing tech-spec ("there's already a tech-spec somewhere for the auth token refresh fix").
- The request describes a small, well-understood change (a bug fix for auth token refresh).
- No Phase 4 triggers are present (no mention of "start implementation", "begin phase 4", "process epics", or status queries).

**Quick Flow Startup sub-path:** Path 2 — "User referenced an existing spec". The user did not provide a file path, but stated a tech-spec exists from a previous session. The skill instructs: search `_bmad-output/implementation-artifacts/` for matching `tech-spec-*.md`. If found, proceed to Step 2 (Implement). If not, ask user for the path.

---

## 2. Startup Steps

### Step 2.1: Create Team

**Tool call:** `TeamCreate`
```
team_name: "bmad-auto"
description: "BMAD implementation orchestration"
```

This is done once at startup per the skill's "Team-Based Sub-Agent Architecture" section. The team persists for the entire workflow.

### Step 2.2: Scan for Project Knowledge Base

The orchestrator scans for knowledge sources to build `{KNOWLEDGE_PATHS}`. The following tool calls would be made (in parallel where possible):

1. **Glob** — pattern: `**/project-context.md` (looking for `_bmad-output/project-context.md` or any nested variant)
2. **Glob** — pattern: `.knowledge-base/**` (check for `.knowledge-base/` directory)
3. **Glob** — pattern: `.memory/**` (check for `.memory/` directory)
4. **Glob** — pattern: `.knowledge/**` (check for `.knowledge/` directory)
5. **Glob** — pattern: `.standards/**` (check for `.standards/` directory)
6. **Glob** — pattern: `.conventions/**` (check for `.conventions/` directory)
7. **Glob** — pattern: `CLAUDE.md` (IDE project rules)
8. **Glob** — pattern: `.cursorrules` (IDE project rules)
9. **Glob** — pattern: `.windsurfrules` (IDE project rules)

All found paths are collected into `{KNOWLEDGE_PATHS}`. If none are found, the list is empty and the workflow continues without halting.

### Step 2.3: Search for Existing Tech-Spec

**Tool call:** `Glob`
```
pattern: "tech-spec-*.md"
path: "_bmad-output/implementation-artifacts/"
```

This searches the standard BMAD output directory for any tech-spec files matching the `tech-spec-{slug}.md` naming convention.

**If no results:** Also try a broader search:

**Tool call:** `Glob`
```
pattern: "**/tech-spec-*.md"
```

This catches tech-specs that might have been saved outside the standard directory.

**Matching logic:** Look for files with slugs related to "auth", "token", "refresh" — e.g., `tech-spec-auth-token-refresh.md`, `tech-spec-auth-refresh-fix.md`, etc. If multiple tech-spec files exist, select the one whose name most closely matches the user's description ("auth token refresh fix").

### Step 2.4: Read the Found Tech-Spec

**Tool call:** `Read`
```
file_path: "<path-to-matched-tech-spec>"
```

Read the spec to confirm it matches the user's intent (auth token refresh fix) and to extract the spec details for the implementation prompt.

### Step 2.5: Report to User

Per the skill: "Report to the user which step will execute and what the change is about."

**Output to user:** Something like:
> "Found tech-spec at `_bmad-output/implementation-artifacts/tech-spec-auth-token-refresh.md`. This spec covers [brief summary of the fix]. Proceeding to Quick Flow Step 2: Implement from Tech-Spec."

---

## 3. Sub-Agents Spawned

### Sub-Agent A: quick-developer (Quick Flow Step 2)

**Name:** `"quick-developer"`
**Team:** `"bmad-auto"`
**Prompt:**
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
<list of paths found in Step 2.2, or empty>
Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
These define the project's standards, conventions, and implementation rules.
Follow them when making decisions. If no knowledge sources exist, use general best practices.

Invoke the Skill tool with skill: "bmad-quick-dev", args: "<path-to-tech-spec>"

Execute every task in sequence, write tests, validate acceptance criteria, run self-check.
Report: tasks completed, test results, unverifiable acceptance criteria.

## Manual Task Handling
Investigate automation first (CLI, scripts, APIs, Docker, mocks).
If automatable -> do it. If truly impossible -> report to team lead with details and wait.
```

### Sub-Agent B: quick-reviewer (Quick Flow Step 3)

**Name:** `"quick-reviewer"`
**Team:** `"bmad-auto"`
**Prompt:**
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
<list of paths found in Step 2.2, or empty>
Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
These define the project's standards, conventions, and implementation rules.
Follow them when making decisions. If no knowledge sources exist, use general best practices.

Invoke the Skill tool with skill: "bmad-bmm-code-review"
Review changes from the Quick Flow implementation.
Verify alignment with tech-spec at: <path-to-tech-spec>
Report pass/fail with specific issues.
```

### Sub-Agent C: func-validator (Quick Flow Step 4)

**Name:** `"func-validator"`
**Team:** `"bmad-auto"`
**Prompt:**
```
{AGENT_HEADER}
You are a BMAD team sub-agent. Do NOT make any git commits.
After completing your work, report results to the team lead via SendMessage.
If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
When you receive a shutdown_request, approve it.

## Task: Functional Validation for auth-token-refresh-fix
Read validation instructions from: <skill_directory>/references/functional-validation-prompt.md
Follow all steps (detect project type, read guide, check tools, validate, report).
Report as PASS, PARTIAL, or FAIL.
```

### Sub-Agent D (conditional): tech-researcher

**Name:** `"tech-researcher"`
**Team:** `"bmad-auto"`
**When spawned:** Only if any sub-agent (A, B, or C) fails after 2 rounds of orchestrator feedback, per the Escalation Ladder. The researcher collaborates peer-to-peer with the stuck worker via `SendMessage`.

---

## 4. Orchestrator Actions After Each Sub-Agent Reports

### After quick-developer (Sub-Agent A) reports:

1. **Successful completion:** Shut down `quick-developer`. Proceed to Step 3 (Code Review) by spawning `quick-reviewer`.
2. **Blocked / issues found:** Enter escalation ladder:
   - Tier 1: Send feedback to the same `quick-developer` sub-agent (up to 2 rounds, numbered "Round 1/2", "Round 2/2").
   - Tier 2: Spawn `tech-researcher` in the same team to collaborate with `quick-developer` (up to 3 rounds). Orchestrator monitors but does not relay messages.
   - Tier 3: Shut down all sub-agents, report full context to user, wait for user decision.
3. **Scope escalation reported:** Present user with two options: (a) Light — re-run `bmad-quick-spec` for a more detailed spec, (b) Heavy — switch to full BMAD Phases 1-4. Wait for user decision.

### After quick-reviewer (Sub-Agent B) reports:

1. **Pass:** Shut down `quick-reviewer`. Proceed to Step 4 (Functional Validation) by spawning `func-validator`.
2. **Issues found:** Shut down `quick-reviewer`. Send fix instructions to `quick-developer` (respawn if previously shut down, providing review context). After developer fixes, spawn a new `quick-reviewer`. Retry up to 2 rounds. If still failing, enter escalation ladder.

### After func-validator (Sub-Agent C) reports:

1. **PASS:** Shut down `func-validator`. Proceed to Step 5 (Commit).
2. **PARTIAL:** Log warning. Shut down `func-validator`. Proceed to Step 5 (Commit). Include partial validation details in commit message.
3. **FAIL:** Send fix instructions to validator or re-spawn developer. Re-run Steps 3 (Code Review) and 4 (Functional Validation). Escalation ladder if still failing.

### Step 5 (Commit) — orchestrator handles directly:

1. Run `git status` and `git diff` to see changes.
2. Present user with proposed commit message in format: `fix(auth): auth token refresh fix` (or similar conventional commit format).
3. Include validation results (PASS/PARTIAL details).
4. Wait for explicit user approval before committing.
5. Report: "Quick Flow complete."
6. Shut down all remaining sub-agents. `TeamDelete` the `"bmad-auto"` team.

---

## 5. Complete Sequence of Tool Calls

```
# ── STARTUP ──────────────────────────────────────────────────

1.  TeamCreate({ team_name: "bmad-auto", description: "BMAD implementation orchestration" })

2.  [PARALLEL] Scan for knowledge base:
    a. Glob("**/project-context.md")
    b. Glob(".knowledge-base/**")
    c. Glob(".memory/**")
    d. Glob(".knowledge/**")
    e. Glob(".standards/**")
    f. Glob(".conventions/**")
    g. Glob("CLAUDE.md")
    h. Glob(".cursorrules")
    i. Glob(".windsurfrules")

    → Collect found paths into {KNOWLEDGE_PATHS}

3.  Glob("tech-spec-*.md", path="_bmad-output/implementation-artifacts/")
    → Search for existing tech-spec matching "auth token refresh"
    → If not found: Glob("**/tech-spec-*.md") (broader search)
    → If still not found: Ask user for the path. STOP.

4.  Read(<matched-tech-spec-path>)
    → Confirm content matches user's intent (auth token refresh fix)

5.  Output to user: Report which step will execute and what the change is about.

# ── QUICK FLOW STEP 2: IMPLEMENT ─────────────────────────────

6.  SpawnAgent({
      name: "quick-developer",
      team_name: "bmad-auto",
      prompt: "<AGENT_HEADER + CONTEXT_BLOCK + bmad-quick-dev invocation>"
    })

7.  [WAIT] Receive report from quick-developer via SendMessage.

8.  [DECISION POINT]
    IF successful → ShutdownAgent("quick-developer") → go to step 9
    IF issues → SendMessage feedback to "quick-developer" (up to 2 rounds)
      IF still failing → SpawnAgent("tech-researcher") for collaborative escalation (up to 3 rounds)
        IF still failing → ShutdownAll, report to user, STOP.

# ── QUICK FLOW STEP 3: CODE REVIEW ───────────────────────────

9.  SpawnAgent({
      name: "quick-reviewer",
      team_name: "bmad-auto",
      prompt: "<AGENT_HEADER + CONTEXT_BLOCK + bmad-bmm-code-review invocation>"
    })

10. [WAIT] Receive report from quick-reviewer via SendMessage.

11. [DECISION POINT]
    IF pass → ShutdownAgent("quick-reviewer") → go to step 12
    IF issues →
      ShutdownAgent("quick-reviewer")
      SendMessage to "quick-developer" with fix instructions (or respawn with context)
      [WAIT] for developer fix
      SpawnAgent new "quick-reviewer"
      [WAIT] for review result
      Retry up to 2 rounds. If still failing → escalation ladder.

# ── QUICK FLOW STEP 4: FUNCTIONAL VALIDATION ─────────────────

12. SpawnAgent({
      name: "func-validator",
      team_name: "bmad-auto",
      prompt: "<AGENT_HEADER + functional validation instructions>"
    })

13. [WAIT] Receive report from func-validator via SendMessage.

14. [DECISION POINT]
    IF PASS → ShutdownAgent("func-validator") → go to step 15
    IF PARTIAL → ShutdownAgent("func-validator"), log warning → go to step 15
    IF FAIL → re-spawn developer/validator, re-run steps 9-13. Escalation ladder if needed.

# ── QUICK FLOW STEP 5: COMMIT ────────────────────────────────

15. Bash("git status")
16. Bash("git diff")

17. Output to user: Proposed commit message + validation results. Ask for approval.

18. [WAIT] for user approval.

19. Bash("git add <specific-files>")
20. Bash("git commit -m 'fix(auth): implement auth token refresh fix'")

21. Output to user: "Quick Flow complete."

# ── CLEANUP ──────────────────────────────────────────────────

22. ShutdownAgent (any remaining agents)
23. TeamDelete("bmad-auto")
```

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Flow** | Quick Flow |
| **Detection trigger** | "quick dev" keyword + existing spec reference |
| **Startup sub-path** | Path 2 — search for existing tech-spec |
| **Steps executed** | Step 2 (Implement) -> Step 3 (Code Review) -> Step 4 (Functional Validation) -> Step 5 (Commit) |
| **Step 1 skipped?** | Yes — spec already exists, no need to create one |
| **Sub-agents spawned** | quick-developer, quick-reviewer, func-validator (+ tech-researcher only if escalation needed) |
| **User interactions** | Initial report, commit approval (minimum 2 touchpoints) |
| **Escalation model** | 3-tier: orchestrator feedback (2 rounds) -> collaborative peer (3 rounds) -> halt for user |
