---
name: 'step-02-run-tests'
description: 'Execute tests with output captured to temp files'
nextStepFile: './step-03-interpret-results.md'
---

# Step 2: Run Tests

## STEP GOAL

Execute the determined test command with all output captured to temp files. Never output test results directly to console.

## EXECUTION

### 1. Context Efficiency: Temp File Output

**Why**: Test output can be verbose. Direct terminal output bloats agent context.

**IMPORTANT**: Redirect output to temp files only (NO console output). Create one temp directory per session with `mktemp -d` and paste its literal path into every later command: each Bash tool call starts a fresh shell, so an exported session variable would be empty in later calls and parallel agents would collide on the same file names.

```bash
# Create the session temp directory (skip if step 1 already created it)
mktemp -d /tmp/ut-XXXXXX   # prints e.g. /tmp/ut-a1B2c3 — paste that literal path wherever <UT_DIR> appears

# Standard pattern for all test runs - redirect to file only (no console)
npm test > <UT_DIR>/output.log 2>&1

# Read only summary
tail -50 <UT_DIR>/output.log

# Get failure details
grep -B 2 -A 15 "FAIL\|✕" <UT_DIR>/output.log

# Cleanup when done
rm -rf <UT_DIR>
```

### 2. Execute Test Command

Run the test command determined in Step 1, redirecting all output to the temp file:

```bash
# Standard run
npm test -- [path/to/file.spec.ts] > <UT_DIR>/output.log 2>&1
tail -50 <UT_DIR>/output.log

# With verbose output
npm test -- [path/to/file.spec.ts] --verbose > <UT_DIR>/output.log 2>&1
tail -100 <UT_DIR>/output.log

# Specific test only
npm test -- -t "test name" > <UT_DIR>/output.log 2>&1
tail -50 <UT_DIR>/output.log
```

### 3. Read Results from Temp File

After execution, read only the relevant portions:

```bash
# Get summary (last 50 lines)
tail -50 <UT_DIR>/output.log

# Get failure details
grep -B 2 -A 15 "FAIL\|✕" <UT_DIR>/output.log
```

## PRESENT FINDINGS

Confirm to the user:
- Tests executed with the determined command
- Output captured to `<UT_DIR>/output.log`
- Quick summary of pass/fail status from the tail output

Then ask: **[C] Continue to Step 3: Interpret Results**

## FRONTMATTER UPDATE

Update the output document frontmatter:
- Add `2` to `stepsCompleted`

## NEXT STEP

After user confirms `[C]`, load `step-03-interpret-results.md`.
