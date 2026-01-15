# Running E2E Test Workflow

## Objective

Execute E2E tests reliably with proper infrastructure setup, environment configuration, and result interpretation.

---

## Mandatory Execution Rules

- **ALWAYS verify infrastructure is running before tests**
- **ALWAYS run tests sequentially (maxWorkers: 1)**
- **NEVER run full suite when individual tests are failing**
- **ALWAYS review logs when tests fail**

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

**Execution Commands**:

```bash
# Standard run
npm run test:e2e {scope}

# Verbose output
npm run test:e2e {scope} -- --verbose

# With coverage
npm run test:e2e {scope} -- --coverage

# Force sequential (if not in config)
npm run test:e2e {scope} -- --runInBand

# With specific timeout
npm run test:e2e {scope} -- --testTimeout=60000
```

**During Execution, Monitor**:
- Test output in terminal
- Docker container logs (for issues)
- Application logs

**Present to User**:
```
## Running Tests

Command: {command}
Scope: {scope description}

Starting test execution...

{real-time output}
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

Next Steps:
1. Load references/common/debugging.md
2. Create _e2e-failures.md tracking file
3. Fix ONE test at a time

[I] Investigate first failure / [T] Create tracking file / [L] View logs
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

**Goal**: Systematically address test failures.

**Reference**: Load `references/common/debugging.md` for detailed debugging steps.

**Failure Protocol**:

1. **Create Tracking File**:
```markdown
<!-- _e2e-failures.md -->
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

2. **Isolate Failing Test**:
```bash
# Run only the failing test
npm run test:e2e -- -t "{exact test name}"
```

3. **Analyze Logs**:
```bash
# View application logs
tail -f logs/e2e-test.log

# Search for errors
grep -i "error" logs/e2e-test.log

# View Docker logs
docker-compose -f docker-compose.e2e.yml logs -f
```

4. **Debug if Needed**:
```bash
# With Node inspector
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

1. **Run Fixed Test Multiple Times**:
```bash
# Run 5 times to verify stability
for i in {1..5}; do
  npm run test:e2e -- -t "{test name}"
done
```

2. **Run Related Tests**:
```bash
# Run the entire file
npm run test:e2e -- {file}
```

3. **Run Full Suite (Only When All Individual Tests Pass)**:
```bash
npm run test:e2e
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
rm _e2e-failures.md
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

```bash
# Start infrastructure
npm run docker:e2e

# Run all E2E tests
npm run test:e2e

# Run specific file
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts

# Run specific test
npm run test:e2e -- -t "{test name}"

# Run with verbose output
npm run test:e2e -- --verbose

# Run with debugging
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand

# View logs
tail -f logs/e2e-test.log

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
