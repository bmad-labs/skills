---
name: 'step-06-run-tests'
description: 'Verify tests still pass after the change'
nextStepFile: './step-07-commit.md'
---

# Step 6: Run Tests

## STEP GOAL

Verify the change didn't break anything. All tests must still pass.

## EXECUTION

```bash
npm test
```

### Check

- All tests pass
- No new failures
- Coverage hasn't dropped

### If Tests Fail

1. **STOP**
2. Undo the change (`git checkout`)
3. Make a smaller change
4. Or fix the issue if it's obvious

**Important**: Do NOT proceed with failing tests. The safety net must stay intact.

## PRESENT RESULTS

```
Step 6: Test Results
====================

Iteration: {{N}}
Result: PASS / FAIL
Tests Run: {{N}}
Tests Passed: {{N}}
Tests Failed: {{N}} — [list if any]
Coverage: {{percentage}} (change: +/-N%)

Action: {{proceed / undo and retry}}
```

If PASS, ask: **[C] Continue to Step 7: Commit**

If FAIL, inform the user and undo the change. Return to `step-05-make-change.md` for a smaller change.

## FRONTMATTER UPDATE

Update the output document:
- Add `6` to `stepsCompleted` (or update if looping)
- Set `testsGreen` to `true` or `false`
- Append test results to the log

## NEXT STEP

If tests pass and user confirms `[C]`, load `step-07-commit.md`.

If tests fail, load `step-05-make-change.md` after undoing the change.
