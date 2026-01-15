# Debugging E2E Test Workflow

## Objective

Systematically debug failing E2E tests by identifying root causes and applying targeted fixes without introducing new issues.

---

## Mandatory Execution Rules

- **ALWAYS load debugging reference before starting**
- **ALWAYS create tracking file for multiple failures**
- **ALWAYS fix ONE test at a time**
- **NEVER change multiple things simultaneously**
- **ALWAYS verify fix with multiple runs before moving on**

---

## Pre-Workflow: Load Knowledge Base

**Mandatory Reading** - Load before debugging:

1. **Debugging Guide**: `references/common/debugging.md` - VS Code config, log analysis, systematic resolution
2. **Best Practices**: `references/common/best-practices.md` - Common issues and solutions
3. **Rules**: `references/common/rules.md` - Verify test follows required patterns

**Technology-Specific** - Load based on failing test:
- **Kafka tests**: `references/kafka/isolation.md`, `references/kafka/performance.md`
- **Database tests**: `references/{postgres|mongodb}/rules.md`
- **API tests**: `references/api/mocking.md`

---

## Workflow Steps

### Step 1: Capture Failure Information

**Goal**: Document the failure completely before investigating.

**Actions**:

1. **Create or Update Tracking File**:
```markdown
<!-- _e2e-failures.md -->
# E2E Test Failures - {date}

## Test 1: "{test name}"
- **File**: {file}:{line}
- **Error Type**: {Timeout/Assertion/Connection/etc}
- **Error Message**:
  ```
  {full error message}
  ```
- **Stack Trace**:
  ```
  {relevant stack trace}
  ```
- **Status**: INVESTIGATING
- **Related Tests**: {list if part of a pattern}
```

2. **Gather Context**:
   - When did it start failing?
   - Does it fail consistently or intermittently?
   - Does it fail alone or only with other tests?
   - What changed recently?

**Present to User**:
```
## Failure Captured

Test: "{test name}"
File: {file}:{line}

Error Type: {type}
Error: {message}

Questions:
1. Is this a new failure or existing?
2. Does it fail consistently?
3. Did anything change recently (code, deps, config)?

[C] Continue investigation / [P] Provide more context
```

---

### Step 2: Classify the Failure

**Goal**: Determine the category of failure to guide debugging approach.

**Failure Categories**:

1. **Timeout Failures**
   - Test didn't complete in time
   - Async operation never resolved
   - Infrastructure slow/unavailable

2. **Assertion Failures**
   - Expected value doesn't match actual
   - Data not in expected state
   - Wrong error code returned

3. **Connection Failures**
   - Cannot connect to database
   - Kafka broker unavailable
   - External API unreachable

4. **Race Conditions**
   - Passes alone, fails with others
   - Intermittent failures
   - Order-dependent results

5. **State Leakage**
   - Data from previous test interferes
   - Shared resources not cleaned
   - Global state modified

**Present to User**:
```
## Failure Classification

Based on the error, this appears to be a:

**{Category}** failure

Characteristics:
- {characteristic 1}
- {characteristic 2}

Debugging approach for this type:
1. {step 1}
2. {step 2}
3. {step 3}

[C] Continue with this approach / [R] Reclassify
```

---

### Step 3: Isolate the Failure

**Goal**: Reproduce the failure in isolation.

**Isolation Steps**:

1. **Run Test Alone**:
```bash
npm run test:e2e -- -t "{exact test name}"
```

2. **Run Multiple Times**:
```bash
for i in {1..5}; do
  echo "Run $i:"
  npm run test:e2e -- -t "{test name}"
done
```

3. **Run in Different Contexts**:
```bash
# Just this file
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts

# With the test before it
npm run test:e2e -- -t "{prev test name}" -t "{failing test name}"
```

**Present to User**:
```
## Isolation Results

Test Alone: {passes/fails}
5 Consecutive Runs: {x}/5 passed
With Previous Test: {passes/fails}
In Full Suite: {passes/fails}

Analysis:
- {conclusion based on results}

Likely Cause: {hypothesis}

[C] Continue to root cause / [T] Try different isolation
```

---

### Step 4: Investigate Root Cause

**Goal**: Identify the specific cause of the failure.

**Investigation by Category**:

#### Timeout Failures

```bash
# Check infrastructure
docker-compose -f docker-compose.e2e.yml ps

# Check specific service logs
docker logs postgres-e2e --tail 100
docker logs kafka-e2e --tail 100

# Run with extended timeout
npm run test:e2e -- -t "{test}" --testTimeout=60000
```

**Common Causes**:
- Kafka consumer not subscribed before test
- Database query slow
- External API mock not configured
- Async operation never completes

#### Assertion Failures

```typescript
// Add debug logging to test
it('should do something', async () => {
  // GIVEN
  console.log('=== GIVEN ===');
  console.log('Setup data:', JSON.stringify(data, null, 2));

  // WHEN
  console.log('=== WHEN ===');
  const response = await request(httpServer).post('/endpoint').send(data);
  console.log('Response:', JSON.stringify(response.body, null, 2));

  // THEN
  console.log('=== THEN ===');
  // assertions...
});
```

**Common Causes**:
- Data not seeded correctly
- Wrong expected value
- Async state not ready
- Previous test left unexpected data

#### Connection Failures

```bash
# Check service availability
docker exec postgres-e2e pg_isready
docker exec mongo-e2e mongosh --eval "db.runCommand('ping')"
docker exec redis-e2e redis-cli ping

# Check ports
lsof -i :5433  # PostgreSQL E2E port
lsof -i :27018 # MongoDB E2E port
```

**Common Causes**:
- Docker service not running
- Port conflict
- Environment variables wrong
- Connection pool exhausted

#### Race Conditions / State Leakage

```typescript
// Add delay to verify race condition
beforeEach(async () => {
  console.log('=== BEFORE EACH ===');
  console.log('Waiting for in-flight...');
  await new Promise(r => setTimeout(r, 2000)); // Extended wait

  console.log('Cleaning data...');
  await repository.clear();

  const count = await repository.count();
  console.log('After cleanup count:', count);
});
```

**Common Causes**:
- Missing cleanup wait
- Shared consumer group (Kafka)
- Global mock state
- Singleton service state

**Present to User**:
```
## Root Cause Analysis

Investigation:
{what was checked}

Findings:
{what was discovered}

Root Cause:
**{specific cause}**

Evidence:
{log output or observation}

[F] Apply fix / [I] Investigate further
```

---

### Step 5: Apply Targeted Fix

**Goal**: Fix the specific root cause without broad changes.

**Fix Principles**:
1. Make the MINIMUM change needed
2. Don't refactor unrelated code
3. Don't "clean up" while fixing
4. Document what was changed

**Common Fixes by Category**:

#### Timeout Fixes
```typescript
// Increase specific timeout
it('should process event', async () => {
  // ...
}, 30000); // Increase from default

// Add polling instead of fixed wait
const result = await waitFor(
  () => repository.findOne({ id }),
  15000,  // timeout
  100     // poll interval
);

// Ensure Kafka subscription before test
beforeAll(async () => {
  await kafkaHelper.subscribeToTopic(outputTopic);
  await new Promise(r => setTimeout(r, 2000)); // Wait for subscription
}, 90000);
```

#### Assertion Fixes
```typescript
// Fix expected value
expect(response.body.code).toBe('SUCCESS'); // Was 'success'

// Use partial matching for flexible assertions
expect(response.body).toMatchObject({
  code: 'SUCCESS',
  // Don't assert on timestamps that vary
});

// Verify precondition
const setupCount = await repository.count();
expect(setupCount).toBe(1); // Verify setup worked
```

#### Connection Fixes
```typescript
// Add retry logic
const connectWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await dataSource.initialize();
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};
```

#### Race Condition Fixes
```typescript
// Ensure cleanup complete
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 1000)); // Wait for in-flight
  await repository.clear();
  kafkaHelper.clearMessages(topic); // Clear message buffer
  jest.clearAllMocks();
});

// Use unique identifiers
const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

**Present to User**:
```
## Proposed Fix

File: {file}
Line: {line}

Change:
```diff
- {old code}
+ {new code}
```

Rationale: {why this fixes the issue}

[A] Apply fix / [M] Modify fix / [S] Suggest alternative
```

---

### Step 6: Verify the Fix

**Goal**: Confirm the fix works reliably.

**Verification Process**:

1. **Run Fixed Test Multiple Times**:
```bash
for i in {1..5}; do
  echo "=== Run $i ==="
  npm run test:e2e -- -t "{test name}"
done
```

2. **Run With Related Tests**:
```bash
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts
```

3. **Check for Regressions**:
```bash
# Run full suite (only if all were passing before)
npm run test:e2e
```

**Present to User**:
```
## Fix Verification

Test: "{test name}"

Isolated Runs: {5}/5 passed ✅
With File: {passes/fails}
Full Suite: {passes/fails}

{if all pass}
Fix verified! Updating tracking file...
{/if}

{if failures}
Fix incomplete. Additional issues:
- {issue}

[R] Retry fix / [I] Investigate new issue
{/if}
```

---

### Step 7: Update Tracking and Continue

**Goal**: Document resolution and move to next failure.

**Actions**:

1. **Update Tracking File**:
```markdown
## Test 1: "{test name}"
- **Status**: FIXED ✅
- **Root Cause**: {description}
- **Fix Applied**: {description}
- **Verified**: {date}
```

2. **Move to Next Failure** (if any):
   - Repeat from Step 1 for next test
   - Look for patterns across failures

3. **Delete Tracking File** when all fixed:
```bash
rm _e2e-failures.md
```

**Present to User**:
```
## Progress Update

Fixed: {n} tests
Remaining: {m} tests

{if remaining > 0}
Next Failure: "{next test name}"

[C] Continue to next / [S] Stop for now
{/if}

{if remaining == 0}
All failures resolved!

Final Verification:
npm run test:e2e

[V] Run final verification / [D] Done
{/if}
```

---

## Debugging Tools Reference

### VS Code Debug Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Failing Test",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--config", "test/jest-e2e.config.ts",
    "--runInBand",
    "-t", "{test name}"
  ],
  "console": "integratedTerminal"
}
```

### Command Line Debugging
```bash
# Node inspector
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand -t "{test}"

# Verbose output
npm run test:e2e -- -t "{test}" --verbose

# With logging
DEBUG=* npm run test:e2e -- -t "{test}"
```

### Log Analysis
```bash
# Real-time log watching
tail -f logs/e2e-test.log

# Search for errors
grep -i "error\|fail\|exception" logs/e2e-test.log

# Context around error
grep -B5 -A10 "FAIL" logs/e2e-test.log
```

---

## Post-Workflow: Knowledge Review

After debugging, review and consider updating:
1. `references/common/debugging.md` - If new patterns discovered
2. Technology-specific references - If configuration issues found
3. Test helpers - If common fixes can be built in

---

## Success Criteria

- [ ] Each failure documented in tracking file
- [ ] Root cause identified for each failure
- [ ] Targeted fix applied (minimal change)
- [ ] Fix verified with multiple runs
- [ ] No regressions introduced
- [ ] Tracking file cleaned up when done
