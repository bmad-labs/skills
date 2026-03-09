# Execution Plan: Quick Flow — Find Existing Tech-Spec

**Task:** "quick dev — there's already a tech-spec somewhere for the auth token refresh fix, I created it last session. just find it and implement it."
**Skill:** `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/bmad-auto`

---

## Step 0: Flow Detection

**Decision Point:** Determine which flow to use based on user input.

- The user said **"quick dev"** — this matches the Quick Flow trigger keywords listed in SKILL.md ("quick dev").
- The user **referenced an existing tech-spec** ("there's already a tech-spec somewhere for the auth token refresh fix").
- **Result:** Route to **Quick Flow**.
- Per SKILL.md Quick Flow Startup rule #2: "If the user referenced an existing tech-spec (e.g., 'implement the auth fix spec') → search `_bmad-output/implementation-artifacts/` for matching `tech-spec-*.md` files."

---

## Step 1: Search for Existing Tech-Spec

**Action:** Search `_bmad-output/implementation-artifacts/` for matching `tech-spec-*.md` files related to "auth token refresh fix".

**Tools I WOULD call:**
1. `Glob` with pattern `_bmad-output/implementation-artifacts/tech-spec-*.md` to find all tech-spec files.
2. If multiple results, `Read` each file to find the one related to "auth token refresh" by scanning titles/descriptions.
3. If no results found in the standard path, broaden the search:
   - `Glob` with pattern `**/tech-spec-*.md` across the entire project to check alternate locations.
   - `Grep` for "auth token refresh" across `**/*.md` files to locate the spec by content.

**Decision Point:**
- **If exactly one matching spec is found** → Confirm with user and proceed to Step 2.
- **If multiple candidates found** → Present the list to the user and ask which one to use.
- **If no spec is found** → Report to user: "I couldn't find a tech-spec matching 'auth token refresh fix' in `_bmad-output/implementation-artifacts/`. Could you provide the file path, or would you like me to create a new tech-spec?" (This triggers Quick Flow Startup rule #3 if the user opts to create one.)

**Critical behavior:** Do NOT start spec creation (Quick Flow Step 1) at this point. The user explicitly said the spec already exists, so the correct action is to search, not create.

---

## Step 2: Confirm Spec and Report to User

**Action:** Once the tech-spec file is located (e.g., `_bmad-output/implementation-artifacts/tech-spec-auth-token-refresh.md`):

1. `Read` the tech-spec file.
2. Report to the user:
   - "Found your tech-spec: `<path>`. It covers: <brief summary of problem statement and tasks>."
   - "Proceeding to Quick Flow Step 2 (Implementation)."

---

## Step 3: Create Team

**Action:** Set up the team for sub-agent orchestration.

**Tool I WOULD call:**
```
TeamCreate: { team_name: "bmad-auto", description: "BMAD Quick Flow implementation" }
```

---

## Step 4: Quick Flow Step 2 — Implement from Tech-Spec

**Action:** Spawn a team sub-agent to implement the tech-spec.

**Tool I WOULD call:**
```
Agent tool:
  name: "quick-developer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-quick-dev"
    - args: "<path-to-found-tech-spec-file>"

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
    2. If automatable → implement and continue.
    3. If truly impossible to automate → report to team lead with details and wait.

    If you encounter blockers or technical issues, report them with full details and wait
    for instructions — do NOT proceed on your own.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
- **If successful** → Shut down "quick-developer" → Proceed to Step 5 (Code Review).
- **If blocked** → Follow escalation ladder:
  1. Send feedback to "quick-developer" (up to 2 rounds).
  2. If still blocked → Spawn "tech-researcher" for collaborative escalation.
  3. If still blocked after 3 collaboration rounds → Halt for user.

---

## Step 5: Quick Flow Step 3 — Code Review

**Action:** Spawn a team sub-agent for adversarial code review.

**Tool I WOULD call:**
```
Agent tool:
  name: "quick-reviewer"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    Invoke the Skill tool with:
    - skill: "bmad-bmm-code-review"

    Review the code changes from the most recent Quick Flow implementation.
    Also verify alignment with the tech-spec at: <path-to-found-tech-spec-file>

    Report the review results to the team lead via SendMessage — pass or fail with specific
    issues found. If issues need a decision, report and wait.

    You may receive messages from other teammates (e.g., a researcher). Collaborate
    with them directly via SendMessage to resolve issues together.

    When you receive a shutdown_request, approve it.
```

**Orchestrator actions after sub-agent reports:**
- **If review passes** → Shut down "quick-reviewer" → Proceed to Step 6.
- **If review finds issues:**
  1. Shut down "quick-reviewer".
  2. Send fix instructions to "quick-developer" (which still has full context).
  3. After fixes, spawn a new "quick-reviewer".
  4. Retry up to 2 times. If still failing → report to user and pause.

---

## Step 6: Quick Flow Step 4 — Functional Validation

**Action:** Spawn a team sub-agent for build/run/test validation.

**Tool I WOULD call:**
```
Agent tool:
  name: "func-validator"
  team_name: "bmad-auto"
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.

    ## Task: Functional Validation for Auth Token Refresh Fix

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
- **PASS** → Shut down "func-validator" → Proceed to Step 7.
- **PARTIAL** → Shut down "func-validator" → Log warning → Proceed to Step 7.
- **FAIL** → Follow escalation ladder (feedback to validator or re-development → collaborative escalation → halt for user).

---

## Step 7: Quick Flow Step 5 — Commit

**Action:** Prepare commit for user approval.

**Tools I WOULD call:**
1. `Bash`: `git status` — see all changed files.
2. `Bash`: `git diff` — see the full diff.

**Then present to user:**
- Summary of all changes.
- Proposed commit message: `fix(auth): implement auth token refresh fix` (derived from tech-spec title).
- Include functional validation results in the summary.
- **Wait for explicit user approval before committing.**

**Only after user approves:**
3. `Bash`: `git add <specific files>`
4. `Bash`: `git commit -m "<approved message>"`

---

## Step 8: Team Cleanup

**Action:** Clean up all sub-agents and the team.

1. Send `shutdown_request` to any remaining active sub-agents.
2. `TeamDelete` to clean up the team.
3. Report: "Quick Flow complete. All changes committed."

---

## Summary of Key Decision Points

| Decision Point | Condition | Action |
|---|---|---|
| Flow detection | "quick dev" keyword | Route to Quick Flow |
| Spec search | User says spec exists | Search, do NOT create new spec |
| Spec not found | No matching tech-spec files | Ask user for path or offer to create |
| Multiple specs found | >1 match | Ask user which one |
| Implementation blocked | Sub-agent reports blocker | Escalation ladder: feedback → researcher → halt |
| Code review fails | Issues found | Fix cycle with developer, retry up to 2x |
| Functional validation | PASS/PARTIAL/FAIL | PASS/PARTIAL proceed; FAIL escalate |
| Commit | Changes ready | Ask user for explicit approval |

## Eval Assertions Coverage

1. **detects_quick_flow_from_keyword** — Covered in Step 0: "quick dev" triggers Quick Flow routing.
2. **searches_for_existing_spec** — Covered in Step 1: Glob/Grep search of `_bmad-output/implementation-artifacts/` for `tech-spec-*.md` files matching "auth token refresh".
3. **does_not_create_new_spec** — Covered in Step 1: The plan explicitly avoids invoking Quick Flow Step 1 (spec creation). It searches first and only offers spec creation as a fallback if nothing is found, per the user's statement that the spec already exists.
