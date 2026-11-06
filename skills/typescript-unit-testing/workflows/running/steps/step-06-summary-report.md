---
name: 'step-06-summary-report'
description: 'Compile and present test execution summary'
---

# Step 6: Present Summary Report

## STEP GOAL

Compile the full test execution report with all findings from previous steps, including command executed, results summary, execution time, coverage, issues found, and recommended actions.

## EXECUTION

### 1. Compile Execution Report

Append the full summary to the output document:

```markdown
## Test Execution Report

### Command Executed
```bash
[exact command run]
```

### Results Summary

| Status | Count |
|--------|-------|
| Passed | [X] |
| Failed | [Y] |
| Skipped | [Z] |
| Total | [X+Y+Z] |

### Execution Time
- Total: [T]s
- Slowest: [test name] ([T]s)

### Coverage (if run)
- Statements: [X]%
- Branches: [X]%
- Functions: [X]%
- Lines: [X]%

### Issues Found
[List any failures or concerns]

### Recommended Actions
[Based on results]
```

### 2. Common Commands Reference

Include the reference table for future use:

**All commands redirect output to temp files only (no console output).**

```bash
# Create the session temp directory (skip if step 1 already created it)
mktemp -d /tmp/ut-XXXXXX   # prints e.g. /tmp/ut-a1B2c3 — paste that literal path wherever <UT_DIR> appears
```

| Task | Command |
|------|---------|
| Run all tests | `npm test > <UT_DIR>/output.log 2>&1 && tail -50 <UT_DIR>/output.log` |
| Run single file | `npm test -- path/to/file.spec.ts > <UT_DIR>/output.log 2>&1 && tail -50 <UT_DIR>/output.log` |
| Run single test | `npm test -- -t "should return user" > <UT_DIR>/output.log 2>&1 && tail -50 <UT_DIR>/output.log` |
| Get failure details | `grep -B 2 -A 15 "FAIL\|✕" <UT_DIR>/output.log` |
| Coverage | `npm run test:cov > <UT_DIR>/coverage.log 2>&1 && tail -50 <UT_DIR>/coverage.log` |
| Verbose output | `npm test -- --verbose > <UT_DIR>/output.log 2>&1 && tail -100 <UT_DIR>/output.log` |
| Clear cache | `npx jest --clearCache` |
| Cleanup | `rm -rf <UT_DIR>` |

### 3. Post-Workflow Actions

Based on results, recommend next workflow:

| Result | Recommended Workflow |
|--------|---------------------|
| All pass | None required |
| Failures found | `workflows/debugging/workflow.md` |
| Low coverage | `workflows/writing/workflow.md` |
| Slow tests | `workflows/optimizing/workflow.md` |

### 4. Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Cannot find module" | Path alias issue | Check jest.config moduleNameMapper |
| "is not a function" | Mock not configured | Add mockResolvedValue/mockReturnValue |
| Timeout | Unresolved promise | Check async/await usage |
| "Received: undefined" | Missing mock return | Configure mock return value |
| Snapshot mismatch | Output changed | Review changes, update if correct |

## PRESENT FINDINGS

Show the compiled report to the user:
- Full summary with all sections
- Post-workflow action recommendations
- Troubleshooting reference for any issues encountered

### 5. Cleanup Temp Files

Remind the user to clean up session temp files:

```bash
rm -rf <UT_DIR>
```

## FRONTMATTER UPDATE

Update the output document frontmatter:
- Add `6` to `stepsCompleted`
- Set `status` to `'complete'`

## WORKFLOW COMPLETE

The test execution workflow is complete. The full report is saved at the output path.
