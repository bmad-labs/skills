# Running E2E Test Workflow

## Objective

Execute E2E tests reliably with proper infrastructure setup, environment configuration, and result interpretation.

---

## Mandatory Execution Rules

- **ALWAYS verify infrastructure is running before tests**
- **ALWAYS run tests sequentially (maxWorkers: 1)**
- **NEVER run full suite when individual tests are failing**
- **NEVER run full suite repeatedly while debugging** - Fix one test at a time
- **ALWAYS review logs when tests fail**
- **ALWAYS output test results to temp files** - Avoids context bloat from verbose output

### Critical: One-by-One Fixing Rule

**When tests fail, NEVER keep running the full suite.** Instead:
1. Note all failing tests in `/tmp/e2e-${E2E_SESSION}-failures.md`
2. Fix ONE test at a time using `-t "test name"`
3. Verify each fix with 3-5 runs of that specific test
4. Only run full suite ONCE after ALL individual tests pass

---

## Context Efficiency: Temp File Output

**Why**: E2E test output can be extremely verbose (thousands of lines). Direct terminal output bloats agent context and reduces efficiency.

**IMPORTANT**: Redirect output to temp files only (NO console output). Use unique session ID to prevent conflicts.

```bash
# Initialize session (once at start of E2E work)
export E2E_SESSION=$(date +%s)-$$

# Standard pattern for all test runs - redirect to file only (no console)
npm run test:e2e > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# Then read only what's needed:
# - Last 50 lines for summary
tail -50 /tmp/e2e-${E2E_SESSION}-output.log

# - Search for failures
grep -A 10 "FAIL\|Error\|✕" /tmp/e2e-${E2E_SESSION}-output.log

# Cleanup when done
rm -f /tmp/e2e-${E2E_SESSION}-*.log /tmp/e2e-${E2E_SESSION}-*.md
```

**Temp File Locations** (with `${E2E_SESSION}` unique per agent):
- Full output: `/tmp/e2e-${E2E_SESSION}-output.log`
- Filtered failures: `/tmp/e2e-${E2E_SESSION}-failures.log`
- Tracking file: `/tmp/e2e-${E2E_SESSION}-failures.md`
- Debug runs: `/tmp/e2e-${E2E_SESSION}-debug.log`
- Verification: `/tmp/e2e-${E2E_SESSION}-verify.log`

---

## Pre-Workflow: Load Knowledge Base

**Load these references before running tests**:

1. **Knowledge**: `references/common/knowledge.md` - Understand test lifecycle
2. **Debugging**: `references/common/debugging.md` - Command line debugging and log analysis
3. **NestJS Setup**: `references/common/nestjs-setup.md` - Configuration verification

---

## Workflow Steps

### Step 1: Pre-Run Verification

**Goal**: Ensure environment is ready for E2E tests.

**Actions**:

1. **Check Docker Infrastructure**:
```bash
# Verify Docker is running
docker info

# Check if E2E services are up
docker-compose -f docker-compose.e2e.yml ps
```

2. **Start Infrastructure if Needed**:
```bash
# Start E2E Docker services
npm run docker:e2e
# OR
docker-compose -f docker-compose.e2e.yml up -d

# Wait for services to be healthy
docker-compose -f docker-compose.e2e.yml ps
```

3. **Verify Service Health**:
```bash
# PostgreSQL
docker exec postgres-e2e pg_isready

# MongoDB
docker exec mongo-e2e mongosh --eval "db.runCommand('ping')"

# Redis
docker exec redis-e2e redis-cli ping

# Kafka/Redpanda
docker exec kafka-e2e rpk cluster info
```

**Present to User**:
```
## Pre-Run Verification

Docker Status: {running/stopped}
Services:
- PostgreSQL: {healthy/unhealthy/not running}
- MongoDB: {healthy/unhealthy/not running}
- Redis: {healthy/unhealthy/not running}
- Kafka: {healthy/unhealthy/not running}

{if issues}
Issues Found:
- {issue 1}

Fix: {command}
{/if}

[C] Continue with tests / [S] Start infrastructure / [F] Fix issues
```

---

### Step 2: Determine Run Scope

**Goal**: Identify which tests to run.

**Options**:
1. **Full Suite**: Run all E2E tests
2. **Specific File**: Run tests in one file
3. **Specific Test**: Run a single test by name
4. **By Pattern**: Run tests matching a pattern

**Commands**:
```bash
# Full suite
npm run test:e2e

# Specific file
npm run test:e2e -- test/e2e/user.e2e-spec.ts

# Specific test by name
npm run test:e2e -- -t "should create user"

# Pattern matching
npm run test:e2e -- -t "User API"

# Multiple files
npm run test:e2e -- test/e2e/user.e2e-spec.ts test/e2e/order.e2e-spec.ts
```

**Present to User**:
```
## Test Run Scope

Available Options:
1. [A] All E2E tests ({n} files, {m} tests)
2. [F] Specific file
3. [T] Specific test by name
4. [P] Tests matching pattern

Current recommendation: {based on context}

Select option:
```

---

### Step 3: Execute Tests

**Goal**: Run tests with appropriate configuration.

**Execution Commands** (all redirect to temp file only, no console):

```bash
# Standard run - redirect to temp file only (no console)
npm run test:e2e {scope} > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# Verbose output
npm run test:e2e {scope} -- --verbose > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# With coverage
npm run test:e2e {scope} -- --coverage > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# Force sequential (if not in config)
npm run test:e2e {scope} -- --runInBand > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# With specific timeout
npm run test:e2e {scope} -- --testTimeout=60000 > /tmp/e2e-${E2E_SESSION}-output.log 2>&1
```

**After Execution, Read Results**:
```bash
# Get summary (last 50 lines)
tail -50 /tmp/e2e-${E2E_SESSION}-output.log

# If failures exist, get failure details
grep -B 2 -A 15 "FAIL\|✕" /tmp/e2e-${E2E_SESSION}-output.log > /tmp/e2e-${E2E_SESSION}-failures.log && cat /tmp/e2e-${E2E_SESSION}-failures.log

# Count passed/failed
grep -c "✓\|✕" /tmp/e2e-${E2E_SESSION}-output.log
```

**During Execution, Monitor** (in separate terminal if needed):
- Docker container logs (for issues)
- Application logs

**Present to User**:
```
## Running Tests

Command: {command}
Scope: {scope description}
Output: /tmp/e2e-${E2E_SESSION}-output.log

Test execution complete. Reading results...

{summary from tail -50}
```

---

### Step 4: Interpret Results

**Goal**: Analyze test results and determine next steps.

**Possible Outcomes**:

1. **All Passed**:
```
✅ All tests passed ({n} tests, {duration})

Summary:
- Test Files: {x} passed
- Tests: {y} passed
- Duration: {time}

[D] Done / [R] Run again / [C] Run with coverage
```

2. **Some Failed**:
```
❌ Tests Failed

Failed Tests ({n}):
1. {test name} - {file}:{line}
   Error: {message}

2. {test name} - {file}:{line}
   Error: {message}

Passed: {x}
Failed: {y}
Duration: {time}

⚠️ STOP: Do NOT run full suite again!

Next Steps:
1. Create /tmp/e2e-${E2E_SESSION}-failures.md with ALL failing tests listed
2. Select FIRST failing test
3. Run ONLY that test: npm run test:e2e -- -t "{test name}" > /tmp/e2e-${E2E_SESSION}-debug.log 2>&1
4. Fix and verify with 3-5 runs
5. Move to next test
6. Run full suite ONLY ONCE after all individual tests pass

[I] Investigate first failure / [T] Create tracking file
```

3. **Infrastructure Error**:
```
⚠️ Infrastructure Error

Error: {connection/timeout/etc}

Likely Causes:
- Docker service not running
- Port conflict
- Service unhealthy

Fix Steps:
1. {specific command}
2. {specific command}

[F] Fix and retry / [L] View Docker logs
```

---

### Step 5: Handle Failures (If Any)

**Goal**: Systematically address test failures ONE AT A TIME.

**CRITICAL**: Do NOT run full suite again. Fix each test individually.

**Reference**: Load `references/common/debugging.md` for detailed debugging steps.

**Failure Protocol**:

1. **Create Tracking File**:
```markdown
<!-- /tmp/e2e-${E2E_SESSION}-failures.md -->
# E2E Test Failures - {date}

## Test: "{test name}"
- **File**: {file}:{line}
- **Error**: {error message}
- **Status**: INVESTIGATING

### Analysis
{notes}

### Fix Applied
{description}
```

2. **Isolate Failing Test** (no console output):
```bash
# Run only the failing test
npm run test:e2e -- -t "{exact test name}" > /tmp/e2e-${E2E_SESSION}-output.log 2>&1

# Read the result
tail -50 /tmp/e2e-${E2E_SESSION}-output.log
```

3. **Analyze Logs**:
```bash
# Search for errors in test output
grep -i "error\|fail\|exception" /tmp/e2e-${E2E_SESSION}-output.log

# View application logs (last 100 lines)
tail -100 logs/e2e-test.log

# View Docker logs (last 50 lines per service)
docker-compose -f docker-compose.e2e.yml logs --tail=50
```

4. **Debug if Needed**:
```bash
# With Node inspector (requires console for interactive debugging)
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand -t "{test name}"
```

**Present to User**:
```
## Failure Investigation: "{test name}"

Error: {message}

Possible Causes:
1. {cause 1} - Check: {verification}
2. {cause 2} - Check: {verification}

Recommended Actions:
1. {action}
2. {action}

[R] Re-run test / [D] Debug with inspector / [L] View logs / [F] Fix
```

---

### Step 6: Verify Fixes

**Goal**: Confirm fixes are stable.

**Verification Process**:

1. **Run Fixed Test Multiple Times** (no console output):
```bash
# Run 5 times to verify stability
for i in {1..5}; do
  npm run test:e2e -- -t "{test name}" > /tmp/e2e-${E2E_SESSION}-run$i.log 2>&1
  if [ $? -eq 0 ]; then echo "Run $i: PASS"; else echo "Run $i: FAIL"; fi
done
```

2. **Run Related Tests** (no console output):
```bash
# Run the entire file
npm run test:e2e -- {file} > /tmp/e2e-${E2E_SESSION}-output.log 2>&1
tail -50 /tmp/e2e-${E2E_SESSION}-output.log
```

3. **Run Full Suite (Only When All Individual Tests Pass)**:
```bash
npm run test:e2e > /tmp/e2e-${E2E_SESSION}-output.log 2>&1
tail -50 /tmp/e2e-${E2E_SESSION}-output.log
```

**Present to User**:
```
## Fix Verification

Test: "{test name}"

Run 1: ✅ Passed
Run 2: ✅ Passed
Run 3: ✅ Passed
Run 4: ✅ Passed
Run 5: ✅ Passed

Fix is stable!

[N] Fix next failure / [F] Run full suite / [U] Update tracking file
```

---

### Step 7: Post-Run Cleanup

**Goal**: Clean up after test run.

**Actions**:
1. Stop Docker if not needed:
```bash
docker-compose -f docker-compose.e2e.yml down
```

2. Delete tracking file if all fixed:
```bash
rm /tmp/e2e-${E2E_SESSION}-failures.md
```

3. Review and commit any test fixes

**Present to User**:
```
## Test Run Complete

Results Summary:
- Passed: {x}
- Failed: {y}
- Fixed: {z}

Cleanup Options:
[D] Stop Docker services
[K] Keep Docker running
[C] Commit test fixes
```

---

## Quick Command Reference

**All test commands redirect to temp file only (no console output).**

```bash
# Start infrastructure
npm run docker:e2e

# Run all E2E tests (no console output)
npm run test:e2e > /tmp/e2e-${E2E_SESSION}-output.log 2>&1 && tail -50 /tmp/e2e-${E2E_SESSION}-output.log

# Run specific file
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts > /tmp/e2e-${E2E_SESSION}-output.log 2>&1 && tail -50 /tmp/e2e-${E2E_SESSION}-output.log

# Run specific test
npm run test:e2e -- -t "{test name}" > /tmp/e2e-${E2E_SESSION}-output.log 2>&1 && tail -50 /tmp/e2e-${E2E_SESSION}-output.log

# Run with verbose output
npm run test:e2e -- --verbose > /tmp/e2e-${E2E_SESSION}-output.log 2>&1 && tail -100 /tmp/e2e-${E2E_SESSION}-output.log

# Get failure details from last run
grep -B 2 -A 15 "FAIL\|✕" /tmp/e2e-${E2E_SESSION}-output.log

# Run with debugging (requires console for interactive debugging)
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand

# View application logs
tail -100 logs/e2e-test.log

# Stop infrastructure
docker-compose -f docker-compose.e2e.yml down
```

---

## Post-Workflow: Knowledge Review

After running tests, if failures occurred:
1. Review `references/common/debugging.md` for systematic debugging
2. Review technology-specific guides for common issues
3. Check `references/common/examples.md` for correct patterns

---

## Success Criteria

- [ ] Infrastructure verified before running
- [ ] Tests run sequentially
- [ ] Failures investigated systematically
- [ ] Fixes verified with multiple runs
- [ ] Tracking file used for failures
- [ ] Full suite only run when individual tests pass

---

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Docker not running | `npm run docker:e2e` |
| Test timeout | Slow infrastructure | Increase timeout or check service health |
| Flaky tests | Race condition | Add wait in beforeEach, use polling |
| Port conflict | Another service | Change E2E ports in docker-compose |
| Memory issues | Too many containers | Restart Docker, increase memory |
