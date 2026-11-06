---
name: 'step-04-execute'
description: 'Execute tests with appropriate configuration — redirect output to temp files'
nextStepFile: './step-05-interpret-results.md'
---

# Step 4: Execute Tests

## STEP GOAL

Run tests with appropriate configuration, capturing output to temp files.

## EXECUTION

### 1. Run Tests

All commands redirect to temp file only (no console):

```bash
# Standard run
npm run test:e2e {scope} > <E2E_DIR>/output.log 2>&1

# Verbose output
npm run test:e2e {scope} -- --verbose > <E2E_DIR>/output.log 2>&1

# With coverage
npm run test:e2e {scope} -- --coverage > <E2E_DIR>/output.log 2>&1

# Force sequential (if not in config)
npm run test:e2e {scope} -- --runInBand > <E2E_DIR>/output.log 2>&1

# With specific timeout
npm run test:e2e {scope} -- --testTimeout=60000 > <E2E_DIR>/output.log 2>&1
```

### 2. Read Results

```bash
# Get summary (last 50 lines)
tail -50 <E2E_DIR>/output.log

# If failures exist, get failure details
grep -B 2 -A 15 "FAIL\|✕" <E2E_DIR>/output.log > <E2E_DIR>/failures.log && cat <E2E_DIR>/failures.log

# Count passed/failed
grep -c "✓\|✕" <E2E_DIR>/output.log
```

### 3. Append to Output

Append to the output document:

```markdown
## Step 4: Execution

**Command**: {{command}}
**Output File**: <E2E_DIR>/output.log
**Result Summary**: {{summary from tail -50}}
```

## PRESENT FINDINGS

```
Running Tests

Command: {command}
Scope: {scope description}
Output: <E2E_DIR>/output.log

Test execution complete. Reading results...

{summary from tail -50}
```

## FRONTMATTER UPDATE

Update the output document:
- Add `4` to `stepsCompleted`

## NEXT STEP

After execution, load `step-05-interpret-results.md`.
