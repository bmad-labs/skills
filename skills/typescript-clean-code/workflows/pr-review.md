# Pull Request Review Workflow

Comprehensive process for reviewing pull requests.

## When to Use

- Reviewing a teammate's PR
- Doing a final check before merge
- Conducting formal code review

## Prerequisites

- Access to the PR and codebase
- Understanding of the feature/fix context
- Time to do a thorough review

**Reference**: `code-review.md`, `collaboration/rules.md`

---

## Workflow Steps

### Step 1: Understand the Context

**Goal**: Know what the PR is trying to accomplish.

- [ ] Read the PR title and description
- [ ] Read the linked ticket/issue
- [ ] Understand the acceptance criteria
- [ ] Check the scope (how big is this change?)

**Questions to answer**:
- What problem does this solve?
- Is this a feature, bug fix, or refactor?
- What should I focus on?

**Time estimate**:
```
Small PR (< 100 lines): 15-30 min
Medium PR (100-400 lines): 30-60 min
Large PR (> 400 lines): Consider requesting split
```

---

### Step 2: Review the Tests First

**Goal**: Understand what the code should do through tests.

- [ ] Check test coverage for new/changed code
- [ ] Read test names to understand expected behavior
- [ ] Verify tests are meaningful (not just coverage)
- [ ] Look for missing test cases

**Questions**:
- Do tests cover the acceptance criteria?
- Are edge cases tested?
- Are error cases handled?
- Would the tests catch regressions?

**Reference**: `unit-tests/rules.md`, `tdd/rules.md`

**Red Flags**:
- [ ] No tests for new functionality
- [ ] Tests that don't actually assert anything
- [ ] Tests that test implementation, not behavior

---

### Step 3: Review the Code - High Level

**Goal**: Understand the overall approach.

- [ ] Look at the file structure changes
- [ ] Understand the architecture decisions
- [ ] Check if the approach makes sense
- [ ] Identify any major concerns

**Questions**:
- Does the solution fit the problem?
- Is the architecture appropriate?
- Are there simpler alternatives?

**Look at**:
- New files created
- Files with significant changes
- Changes to shared/core code

---

### Step 4: Review the Code - Details

**Goal**: Check code quality line by line.

**Use the code review workflow**: `code-review.md`

**Checklist for each file**:

**Functions** (`functions/rules.md`):
- [ ] Small (5-20 lines)
- [ ] Do one thing
- [ ] Good names
- [ ] Few arguments

**Naming** (`naming/rules.md`):
- [ ] Intention-revealing
- [ ] Consistent terminology
- [ ] No abbreviations

**Error Handling** (`error-handling/rules.md`):
- [ ] Exceptions used properly
- [ ] No null returns
- [ ] Proper error context

**Comments** (`comments/rules.md`):
- [ ] Only necessary comments
- [ ] No commented-out code
- [ ] Comments are accurate

**Smells** (`smells/rules.md`):
- [ ] No duplication
- [ ] No feature envy
- [ ] No god classes

---

### Step 5: Check for Security Issues

**Goal**: Identify potential security vulnerabilities.

- [ ] Input validation present?
- [ ] SQL injection possible?
- [ ] XSS vulnerabilities?
- [ ] Sensitive data exposed?
- [ ] Authentication/authorization checked?
- [ ] Secrets in code?

**Common issues**:
```typescript
// BAD: SQL injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD: Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

---

### Step 6: Check for Performance Issues

**Goal**: Identify obvious performance problems.

- [ ] N+1 query problems?
- [ ] Large data sets in memory?
- [ ] Unnecessary database calls?
- [ ] Missing indexes for queries?
- [ ] Blocking operations in async code?

**Common issues**:
```typescript
// BAD: N+1 query
for (const user of users) {
  const orders = await db.getOrdersForUser(user.id);
}

// GOOD: Single query
const orders = await db.getOrdersForUsers(userIds);
```

---

### Step 7: Run the Code (if needed)

**Goal**: Verify it actually works.

For complex changes:
- [ ] Pull the branch locally
- [ ] Run the tests
- [ ] Test manually if needed
- [ ] Verify edge cases

**When to run locally**:
- Complex logic changes
- UI changes
- Integration changes
- When you're unsure

---

### Step 8: Provide Feedback

**Goal**: Give constructive, actionable feedback.

**Feedback Categories**:

| Prefix | Meaning | Action Required |
|--------|---------|-----------------|
| `[BLOCKING]` | Must fix before merge | Yes |
| `[SUGGESTION]` | Nice to have | No |
| `[QUESTION]` | Need clarification | Depends |
| `[NIT]` | Minor style issue | No |
| `[PRAISE]` | Something good | No |

**Good Feedback Format**:
```
[BLOCKING] src/services/userExporter.ts:45

This function is doing too many things. It validates, fetches, formats, 
and saves in one place.

Reference: functions/rules.md - "Do One Thing"

Suggestion: Extract into separate functions:
- validateExportRequest()
- fetchUser()
- formatUser()
- saveExport()
```

**Bad Feedback**:
```
This is wrong.
```

**Reference**: `collaboration/rules.md`

---

### Step 9: Make the Decision

**Goal**: Approve, request changes, or comment.

**Approve when**:
- [ ] All blocking issues resolved
- [ ] Tests are adequate
- [ ] Code quality is acceptable
- [ ] You'd be comfortable maintaining this code

**Request Changes when**:
- [ ] Blocking issues exist
- [ ] Tests are missing for critical paths
- [ ] Security vulnerabilities found
- [ ] Major design problems

**Comment when**:
- [ ] You have questions but no blockers
- [ ] You want to discuss approaches
- [ ] You're not the final approver

---

## PR Review Checklist

```
Context:
[ ] PR description read
[ ] Ticket/issue understood
[ ] Scope is appropriate

Tests:
[ ] New code has tests
[ ] Tests are meaningful
[ ] Edge cases covered

Code Quality:
[ ] Functions are small
[ ] Names are clear
[ ] No code smells
[ ] Error handling is proper

Security:
[ ] No vulnerabilities
[ ] Input validated
[ ] No secrets in code

Performance:
[ ] No obvious issues
[ ] No N+1 queries

Feedback:
[ ] Constructive and specific
[ ] Clear blocking vs suggestions
[ ] Actionable recommendations

Decision:
[ ] Clear approve/request changes/comment
```

---

## Common PR Issues

| Issue | How to Spot | What to Say |
|-------|-------------|-------------|
| No tests | Missing test files | "[BLOCKING] Please add tests for..." |
| Large PR | > 400 lines | "Could this be split into smaller PRs?" |
| God function | > 50 lines | "[BLOCKING] This function does too much..." |
| Magic numbers | Hardcoded values | "[SUGGESTION] Extract to named constant" |
| Copy-paste | Duplicate blocks | "[BLOCKING] DRY violation - extract to..." |
| Poor naming | Unclear names | "[SUGGESTION] Rename to reveal intent" |

---

## Exit Criteria

PR review is complete when:
- [ ] All code has been reviewed
- [ ] Feedback has been provided
- [ ] Decision has been made (approve/request changes)
- [ ] Any blocking issues are clearly marked
