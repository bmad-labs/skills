# Execution Plan: Find Existing Tech-Spec and Implement (Without Skill Guidance)

**Task:** "quick dev — there's already a tech-spec somewhere for the auth token refresh fix, I created it last session. just find it and implement it."
**Skill:** None (general-purpose agent behavior only)

---

## Step 1: Search for the Tech-Spec

**Action:** Attempt to locate a tech-spec document related to "auth token refresh fix" somewhere in the project.

**Tools I WOULD call:**
1. `Grep` — search all `.md` files for "auth token refresh" or similar keywords across the entire repo.
2. `Glob` — try broad patterns like `**/*tech-spec*`, `**/*tech_spec*`, `**/*spec*.md` to find any spec-like documents.
3. If the above turn up nothing, broaden further:
   - `Grep` for "token refresh", "refresh token", "auth fix" across all file types.
   - `Glob` for `**/*.md` and scan recently modified files.
4. `Bash`: `git log --diff-filter=A --name-only --pretty=format: --since="2 weeks ago"` to find recently added files that might be the spec.

**Decision Point:**
- **If found** — Read the file and proceed.
- **If not found** — Ask the user for the file path or more details about where it was saved.

---

## Step 2: Read and Understand the Tech-Spec

**Action:** Read the located tech-spec file in full.

**Tools I WOULD call:**
1. `Read` the spec file.
2. Identify: problem statement, tasks/requirements, affected files, testing strategy, acceptance criteria.

**Output:** Mental model of what needs to be implemented.

---

## Step 3: Implement the Changes

**Action:** Execute the implementation tasks described in the tech-spec, one by one.

**Tools I WOULD call (per task):**
1. `Read` target source files that need modification.
2. `Edit` to make the required code changes.
3. `Write` if new files need to be created (e.g., new utility modules, test files).
4. `Bash` to run linting or type-checking if applicable.

**Approach:**
- Work through tasks sequentially as listed in the spec.
- After each change, verify the edit was applied correctly by reading the file again if needed.

---

## Step 4: Write Tests

**Action:** Implement tests as described in the tech-spec's testing strategy section.

**Tools I WOULD call:**
1. `Read` existing test files for patterns/conventions.
2. `Edit` or `Write` test files.
3. `Bash` to run the test suite and verify tests pass.

---

## Step 5: Verify Acceptance Criteria

**Action:** Manually check each acceptance criterion from the spec.

**Tools I WOULD call:**
1. `Bash` to run tests, build, or any validation commands.
2. `Read` to inspect output files or confirm code structure.

---

## Step 6: Report to User

**Action:** Summarize what was done. Present changed files and test results. Wait for user to decide on committing.

---

## What This Plan Lacks (Compared to Skill-Guided Execution)

1. **No flow detection logic.** Without the skill, there is no concept of "Quick Flow" vs "Full Flow" vs "Chat Mode." The agent simply interprets the task literally.
2. **No standard search path.** Without the skill, the agent does not know to look in `_bmad-output/implementation-artifacts/` for `tech-spec-*.md` files. It must resort to broad searches across the entire repo.
3. **No sub-agent orchestration.** Without the skill, there is no team creation, no dedicated developer/reviewer/validator sub-agents. Everything is done by a single agent in sequence.
4. **No adversarial code review step.** The agent would implement and test, but would not spawn a separate reviewer to catch issues from a different perspective.
5. **No functional validation step.** There is no separate validation phase with a dedicated validation prompt/guide.
6. **No structured escalation ladder.** If something goes wrong, the agent either tries to fix it or asks the user. There is no formal feedback-round or researcher-escalation protocol.
7. **No spec-creation fallback routing.** If the spec is not found, the agent would just ask the user. It would not know to offer Quick Flow Step 1 (spec creation from a one-liner) as an alternative path.

---

## Eval Assertions Coverage

1. **detects_quick_flow_from_keyword** — NOT covered. Without the skill, the agent has no concept of "Quick Flow." The phrase "quick dev" is treated as conversational context, not as a routing keyword. The agent simply tries to fulfill the literal request.
2. **searches_for_existing_spec** — PARTIALLY covered. The agent would search the repo, but would not know the canonical location (`_bmad-output/implementation-artifacts/`) or the naming convention (`tech-spec-*.md`). It would use broad grep/glob instead of a targeted search.
3. **does_not_create_new_spec** — LIKELY covered. Since the user explicitly said "there's already a tech-spec," a reasonable agent would search first rather than create. However, without skill guardrails, there is no formal rule preventing premature spec creation if the search fails.
