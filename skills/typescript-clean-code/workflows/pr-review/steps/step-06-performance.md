---
name: 'step-06-performance'
description: 'Check for performance issues — N+1, memory, blocking'
referenceFiles:
  - 'references/smells/rules.md'
nextStepFile: './step-07-run-code.md'
---

# Step 6: Check for Performance Issues

## STEP GOAL

Identify obvious performance problems in the PR changes.

## ANALYSIS PROCESS

Check all changed code for:

1. **N+1 query problems**?
2. **Large data sets in memory**?
3. **Unnecessary database calls**?
4. **Missing indexes for queries**?
5. **Blocking operations in async code**?

### Common Issues

```typescript
// BAD: N+1 query
for (const user of users) {
  const orders = await db.getOrdersForUser(user.id);
}

// GOOD: Single query
const orders = await db.getOrdersForUsers(userIds);
```

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 6: Performance
===================

<label> (<decoration>): issue_type (file:line)
  - Impact: HIGH/MEDIUM/LOW
  - Description: what the performance issue is
  - Suggestion: how to optimize

Summary: N performance findings reported, N cut as unlikely to be acted on
```

**This step is done when** every performance finding in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 7: Run Code**

## FRONTMATTER UPDATE

Update the output document:
- Add `6` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-07-run-code.md`.
