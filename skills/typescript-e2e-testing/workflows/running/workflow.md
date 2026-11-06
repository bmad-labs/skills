---
name: 'running'
description: 'Execute E2E tests reliably with proper infrastructure setup, environment configuration, and result interpretation'
firstStepFile: './steps/step-01-init.md'
templateFile: './templates/output-template.md'
---

# Running E2E Test Workflow

Execute E2E tests reliably with proper infrastructure setup, environment configuration, and result interpretation.

## When to Use

- Running E2E tests
- Starting/stopping Docker infrastructure for testing
- Analyzing E2E test results
- Verifying Docker services are healthy
- Interpreting test output and failures

## Prerequisites

Have E2E tests written and Docker infrastructure configured.

## Fast Path

For a plain "run the tests" request, skip the run log and the `[C]` gates: create the
session temp directory, confirm the Docker infrastructure is up (step 2's checks), run
the requested scope with output redirected to `<E2E_DIR>/output.log`, read the summary
and failures from that file, and summarise the result in chat. Use the full step flow
below only when the user asks for a run log or wants failures worked through.

## Step-File Architecture

This workflow uses a **step-file architecture** for context-safe execution:

- Each step is a separate file loaded sequentially
- Progress is tracked via `stepsCompleted` in the output document's YAML frontmatter
- If context is compacted mid-workflow, step-01 detects existing output and resumes from the last completed step via step-01b

### Steps

| Step | File | Description |
|------|------|-------------|
| 1 | `step-01-init.md` | Initialize workflow, set output path, detect continuation |
| 1b | `step-01b-continue.md` | Resume from last completed step |
| 2 | `step-02-pre-run.md` | Verify infrastructure is ready |
| 3 | `step-03-determine-scope.md` | Determine which tests to run |
| 4 | `step-04-execute.md` | Execute tests with appropriate configuration |
| 5 | `step-05-interpret-results.md` | Analyze test results |
| 6 | `step-06-handle-failures.md` | Systematically address failures (if any) |
| 7 | `step-07-verify-fixes.md` | Verify fixes are stable |
| 8 | `step-08-cleanup.md` | Post-run cleanup, mark complete |

### Rules

1. **Load one step at a time** - Read the step file, execute it, then load the next
2. **Update frontmatter after each step** - Add the step number to `stepsCompleted`
3. **Wait for user confirmation** - Present findings and wait for `[C]` before proceeding (skipped on the fast path)
4. **Load reference files** - Each step specifies which reference files to load before action

### Mandatory Execution Rules

- **ALWAYS verify infrastructure is running before tests**
- **ALWAYS run tests sequentially (maxWorkers: 1)**
- **NEVER run full suite when individual tests are failing**
- **NEVER run full suite repeatedly while debugging** - Fix one test at a time
- **ALWAYS review logs when tests fail**
- **ALWAYS output test results to temp files** - Avoids context bloat from verbose output

### Context Efficiency: Temp File Output

**IMPORTANT**: Redirect output to temp files only (NO console output). Create one temp directory per session with `mktemp -d` and paste its literal path into every later command: each Bash tool call starts a fresh shell, so an exported session variable would be empty in later calls and parallel agents would collide on the same file names.

```bash
# Create the session temp directory (once at start)
mktemp -d /tmp/e2e-XXXXXX   # prints e.g. /tmp/e2e-a1B2c3 — paste that literal path wherever <E2E_DIR> appears

# Standard pattern for all test runs
npm run test:e2e > <E2E_DIR>/output.log 2>&1

# Then read only what's needed
tail -50 <E2E_DIR>/output.log

# Cleanup when done
rm -rf <E2E_DIR>
```

### Quick Command Reference

```bash
npm run docker:e2e                                                                    # Start infrastructure
npm run test:e2e > <E2E_DIR>/output.log 2>&1 && tail -50 <E2E_DIR>/output.log  # Run all
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts > <E2E_DIR>/output.log 2>&1 && tail -50 <E2E_DIR>/output.log  # Run file
npm run test:e2e -- -t "{test name}" > <E2E_DIR>/output.log 2>&1 && tail -50 <E2E_DIR>/output.log  # Run test
grep -B 2 -A 15 "FAIL\|✕" <E2E_DIR>/output.log                        # Get failures
docker compose -f docker-compose.e2e.yml down                                         # Stop infrastructure
```

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Docker not running | `npm run docker:e2e` |
| Test timeout | Slow infrastructure | Increase timeout or check service health |
| Flaky tests | Race condition | Add wait in beforeEach, use polling |
| Port conflict | Another service | Change E2E ports in docker-compose.e2e.yml |
| Memory issues | Too many containers | Restart Docker, increase memory |

## Begin

Load `steps/step-01-init.md` to start.
