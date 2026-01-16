# Optimize E2E Test Workflow

## Objective

Improve E2E test suite performance, reliability, and maintainability without sacrificing test quality or coverage.

---

## Mandatory Execution Rules

- **ALWAYS load knowledge references before optimizing**
- **ALWAYS measure baseline performance before changes**
- **NEVER sacrifice test isolation for speed**
- **ALWAYS verify tests still pass after optimization**
- **NEVER reduce assertion quality for performance**
- **ALWAYS output test results to temp files** - Avoids context bloat from verbose output

---

## Context Efficiency: Temp File Output

**Why**: Performance optimization requires multiple test runs. Direct output bloats agent context.

**IMPORTANT**: Redirect output to temp files only (NO console output). Use unique session ID to prevent conflicts.

**Standard Pattern**:
```bash
# Initialize session (once at start of optimization)
export E2E_SESSION=$(date +%s)-$$

# Capture timing data (no console output)
{ time npm run test:e2e > /tmp/e2e-${E2E_SESSION}-timing.log 2>&1 ; } 2>> /tmp/e2e-${E2E_SESSION}-timing.log

# Read summary only
tail -50 /tmp/e2e-${E2E_SESSION}-timing.log

# Extract timing info
grep -E "Time:|Duration:|passed|failed|real|user|sys" /tmp/e2e-${E2E_SESSION}-timing.log

# Cleanup when done
rm -f /tmp/e2e-${E2E_SESSION}-*.log
```

**Temp File Locations** (with `${E2E_SESSION}` unique per agent):
- Baseline run: `/tmp/e2e-${E2E_SESSION}-baseline.log`
- Optimized run: `/tmp/e2e-${E2E_SESSION}-optimized.log`
- Timing data: `/tmp/e2e-${E2E_SESSION}-timing.log`
- Stability check: `/tmp/e2e-${E2E_SESSION}-stability.log`

---

## Pre-Workflow: Load Knowledge Base

**Mandatory Reading** - Load before optimizing:

1. **Best Practices**: `references/common/best-practices.md` - Performance patterns
2. **Knowledge**: `references/common/knowledge.md` - Test lifecycle understanding
3. **Rules**: `references/common/rules.md` - Ensure optimizations don't violate rules

**Technology-Specific Performance**:
- **Kafka**: `references/kafka/performance.md` - Kafka-specific optimizations
- **Database**: `references/{postgres|mongodb}/rules.md` - Query optimization
- **API**: `references/api/rules.md` - Request optimization

---

## Workflow Steps

### Step 1: Baseline Assessment

**Goal**: Measure current test suite performance.

**Actions** (all redirect to temp files only, no console):

1. **Run Full Suite with Timing**:
```bash
{ time npm run test:e2e > /tmp/e2e-${E2E_SESSION}-baseline.log 2>&1 ; } 2>> /tmp/e2e-${E2E_SESSION}-baseline.log
tail -50 /tmp/e2e-${E2E_SESSION}-baseline.log
```

2. **Capture Metrics**:
```bash
# Extract timing summary
grep -E "Time:|Tests:|passed|failed|Duration|real|user|sys" /tmp/e2e-${E2E_SESSION}-baseline.log
```

3. **Identify Bottlenecks**:
```bash
# Run with verbose timing (no console output)
npm run test:e2e -- --verbose > /tmp/e2e-${E2E_SESSION}-baseline.log 2>&1
tail -100 /tmp/e2e-${E2E_SESSION}-baseline.log

# Profile specific file
npm run test:e2e -- test/e2e/{file}.e2e-spec.ts --verbose > /tmp/e2e-${E2E_SESSION}-timing.log 2>&1
tail -50 /tmp/e2e-${E2E_SESSION}-timing.log
```

**Present to User**:
```
## Baseline Performance

Total Duration: {X} minutes
Test Count: {N}
Average per Test: {Y} seconds

**Slowest Tests:**
1. {test name} - {time}s
2. {test name} - {time}s
3. {test name} - {time}s

**By Category:**
- Setup (beforeAll): {time}s
- Cleanup (beforeEach): {time}s
- Assertions: {time}s

[C] Continue to analysis / [D] Get more detail
```

---

### Step 2: Identify Optimization Opportunities

**Goal**: Categorize potential optimizations by impact.

**Optimization Categories**:

1. **Infrastructure Optimization**
   - Parallel container startup
   - Container reuse between tests
   - Lighter alternatives (Redpanda vs Kafka)

2. **Setup Optimization**
   - Reduce beforeAll time
   - Minimize beforeEach cleanup
   - Shared app instance

3. **Test Execution Optimization**
   - Replace fixed waits with polling
   - Batch database operations
   - Optimize Kafka subscriptions

4. **Code Organization**
   - Group related tests
   - Share setup where safe
   - Remove redundant assertions

**Analysis Checklist**:
- [ ] Are containers starting sequentially?
- [ ] Is app recreated for each file?
- [ ] Are there fixed `setTimeout` waits?
- [ ] Is cleanup more aggressive than needed?
- [ ] Are there redundant database queries?

**Present to User**:
```
## Optimization Opportunities

**High Impact (>30% improvement potential):**
1. {opportunity} - Currently {current}, could be {improved}
2. {opportunity}

**Medium Impact (10-30%):**
1. {opportunity}
2. {opportunity}

**Low Impact (<10%):**
1. {opportunity}

Recommended Priority:
1. {most impactful change}
2. {second most impactful}

[C] Continue with optimizations / [S] Select specific areas
```

---

### Step 3: Infrastructure Optimization

**Goal**: Optimize Docker and infrastructure setup.

**Optimizations**:

1. **Parallel Container Startup**:
```typescript
// ❌ Sequential (slow)
await postgresContainer.start();
await kafkaContainer.start();
await redisContainer.start();

// ✅ Parallel (fast)
const [postgres, kafka, redis] = await Promise.all([
  new PostgresContainer().start(),
  new KafkaContainer().start(),
  new RedisContainer().start(),
]);
```

2. **Use Lightweight Alternatives**:
```yaml
# docker-compose.e2e.yml
# ❌ Full Kafka (slow startup)
kafka:
  image: confluentinc/cp-kafka:latest

# ✅ Redpanda (faster, Kafka-compatible)
kafka:
  image: vectorized/redpanda:latest
  command: >
    redpanda start --smp 1 --memory 512M
```

3. **Pre-warm Containers**:
```bash
# Start containers before running tests
npm run docker:e2e && sleep 10 && npm run test:e2e
```

**Present to User**:
```
## Infrastructure Optimization

Current Setup Time: {X}s

Proposed Changes:
1. Parallel container startup
   - Before: Sequential, {X}s
   - After: Parallel, ~{Y}s
   - Savings: {Z}s

2. Use Redpanda instead of Kafka
   - Before: Kafka startup {X}s
   - After: Redpanda startup ~{Y}s
   - Savings: {Z}s

[A] Apply all / [S] Select specific / [K] Skip
```

---

### Step 4: Test Setup Optimization

**Goal**: Reduce setup and teardown overhead.

**Optimizations**:

1. **Reuse App Instance**:
```typescript
// ❌ App per file (slow)
describe('Feature', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
});

// ✅ Global app (if tests are isolated)
// In setup.ts
let app: INestApplication;
export const getTestApp = async () => {
  if (!app) {
    app = await createTestApp();
  }
  return app;
};
```

2. **Optimize beforeEach**:
```typescript
// ❌ Over-aggressive cleanup
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 2000)); // Too long
  await userRepository.clear();
  await orderRepository.clear();
  await productRepository.clear();
  await auditRepository.clear(); // Unnecessary if not used
});

// ✅ Targeted cleanup
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 500)); // Shorter wait
  // Only clean tables used in this describe block
  await userRepository.clear();
});
```

3. **Lazy Initialization**:
```typescript
// ❌ Always initialize everything
beforeAll(async () => {
  kafkaHelper = new KafkaTestHelper();
  await kafkaHelper.connect();
  await kafkaHelper.subscribeToAllTopics(); // Expensive
});

// ✅ Initialize on demand
let kafkaHelper: KafkaTestHelper;
const getKafkaHelper = async () => {
  if (!kafkaHelper) {
    kafkaHelper = new KafkaTestHelper();
    await kafkaHelper.connect();
  }
  return kafkaHelper;
};
```

**Present to User**:
```
## Setup Optimization

Current beforeAll time: {X}s
Current beforeEach time: {Y}s per test

Proposed Changes:
1. {optimization 1}
   - Savings: {time}

2. {optimization 2}
   - Savings: {time}

Estimated Total Savings: {time}

[A] Apply / [M] Modify / [S] Skip
```

---

### Step 5: Test Execution Optimization

**Goal**: Speed up individual test execution.

**Optimizations**:

1. **Replace Fixed Waits with Polling**:
```typescript
// ❌ Fixed wait (always waits full time)
await new Promise(r => setTimeout(r, 10000));
const result = await repository.findOne({ id });

// ✅ Smart polling (returns as soon as ready)
const result = await waitFor(
  () => repository.findOne({ id }),
  10000,  // max wait
  50      // poll interval
);
```

2. **Batch Database Operations**:
```typescript
// ❌ Individual inserts
for (const item of items) {
  await repository.save(item);
}

// ✅ Batch insert
await repository.save(items);
```

3. **Optimize Kafka Waiting**:
```typescript
// ❌ Long fixed timeout
const messages = await kafkaHelper.waitForMessages(topic, 1, 30000);

// ✅ Adaptive timeout based on expected load
const messages = await kafkaHelper.waitForMessages(
  topic,
  expectedCount,
  Math.max(5000, expectedCount * 1000) // Scale with count
);
```

4. **Parallel Assertions** (when independent):
```typescript
// ❌ Sequential verification
const dbRecord = await repository.findOne({ id });
const kafkaMessage = await kafkaHelper.getLastMessage(topic);
const redisValue = await redis.get(key);

// ✅ Parallel verification
const [dbRecord, kafkaMessage, redisValue] = await Promise.all([
  repository.findOne({ id }),
  kafkaHelper.getLastMessage(topic),
  redis.get(key),
]);
```

**Present to User**:
```
## Execution Optimization

Identified Slow Patterns:
1. Fixed waits: {n} occurrences, ~{time}s wasted
2. Sequential DB operations: {n} occurrences
3. Suboptimal Kafka timeouts: {n} occurrences

Proposed Fixes:
{list with code changes}

[A] Apply all / [S] Select / [V] View details
```

---

### Step 6: Code Organization Optimization

**Goal**: Improve test organization for better performance.

**Optimizations**:

1. **Group Related Tests**:
```typescript
// ❌ Scattered setup
describe('User API', () => {
  it('create user', async () => {
    const user = await createUser();
    // ...
  });
  it('get user', async () => {
    const user = await createUser(); // Duplicate setup
    // ...
  });
});

// ✅ Grouped with shared setup
describe('User API', () => {
  describe('with existing user', () => {
    let user: User;
    beforeEach(async () => {
      user = await createUser();
    });

    it('should get user', async () => { /* uses shared user */ });
    it('should update user', async () => { /* uses shared user */ });
    it('should delete user', async () => { /* uses shared user */ });
  });
});
```

2. **Extract Common Helpers**:
```typescript
// ❌ Repeated setup logic
it('test 1', async () => {
  const token = await login('admin', 'password');
  const response = await request(httpServer)
    .get('/users')
    .set('Authorization', `Bearer ${token}`);
});

// ✅ Shared helper
const authenticatedRequest = async () => {
  const token = await authHelper.getToken('admin');
  return request(httpServer).set('Authorization', `Bearer ${token}`);
};

it('test 1', async () => {
  const response = await (await authenticatedRequest()).get('/users');
});
```

3. **Remove Redundant Assertions**:
```typescript
// ❌ Redundant checks
expect(response).toBeDefined();
expect(response.body).toBeDefined();
expect(response.body.data).toBeDefined();
expect(response.body.data.id).toBe('123');

// ✅ Single meaningful assertion
expect(response.body.data.id).toBe('123');
```

**Present to User**:
```
## Code Organization Improvements

Findings:
- Duplicate setup: {n} occurrences
- Redundant assertions: {n} occurrences
- Ungrouped related tests: {n} cases

Recommended Refactoring:
{specific suggestions}

[A] Apply / [V] View details / [S] Skip
```

---

### Step 7: Verify Optimizations

**Goal**: Ensure optimizations don't break tests.

**Verification Process** (all redirect to temp files only, no console):

1. **Run Full Suite**:
```bash
npm run test:e2e > /tmp/e2e-${E2E_SESSION}-optimized.log 2>&1
tail -50 /tmp/e2e-${E2E_SESSION}-optimized.log
```

2. **Compare Performance**:
```bash
# Extract timing from both logs
echo "=== BASELINE ===" && grep -E "Time:|Duration:|real|user|sys" /tmp/e2e-${E2E_SESSION}-baseline.log
echo "=== OPTIMIZED ===" && grep -E "Time:|Duration:|real|user|sys" /tmp/e2e-${E2E_SESSION}-optimized.log
```

3. **Run Multiple Times for Stability**:
```bash
for i in {1..3}; do
  npm run test:e2e > /tmp/e2e-${E2E_SESSION}-run$i.log 2>&1
  if [ $? -eq 0 ]; then echo "Run $i: PASS"; else echo "Run $i: FAIL"; fi
done
```

4. **Check for Flakiness**:
```bash
# Run 10 times to detect intermittent failures
for i in {1..10}; do
  npm run test:e2e > /tmp/e2e-${E2E_SESSION}-flaky$i.log 2>&1
  if [ $? -eq 0 ]; then echo "Run $i: PASS"; else echo "Run $i: FAIL"; fi
done
```

**Present to User**:
```
## Optimization Results

### Performance Comparison
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Time | {X}m | {Y}m | {Z}% |
| Avg per Test | {X}s | {Y}s | {Z}% |
| Setup Time | {X}s | {Y}s | {Z}% |

### Stability Check
Runs: 10/10 passed ✅

### Test Count
Before: {N} tests
After: {N} tests (unchanged)

[D] Done / [R] Rollback changes / [F] Further optimization
```

---

### Step 8: Document Optimizations

**Goal**: Record what was changed for future reference.

**Documentation**:
```markdown
## E2E Test Optimizations - {date}

### Changes Applied
1. **Infrastructure**: Parallel container startup
   - Impact: -{X}s setup time

2. **Setup**: Reduced beforeEach wait from 2s to 500ms
   - Impact: -{Y}s per test

3. **Execution**: Replaced fixed waits with polling
   - Impact: -{Z}s average per affected test

### Performance Results
- Total time: {before} → {after} ({improvement}%)
- All tests passing

### Notes
- {any caveats or limitations}
```

**Present to User**:
```
## Optimization Complete

Summary:
- Total improvement: {X}%
- Time saved: {Y} minutes per run

Changes documented in: {location if saved}

Recommendations for ongoing performance:
1. Monitor for new fixed waits in PR reviews
2. Re-run baseline monthly
3. Consider parallel test execution if tests are fully isolated

[D] Done
```

---

## Quick Wins Checklist

Fast optimizations with high impact:

- [ ] Parallel container startup
- [ ] Reduce beforeEach wait time
- [ ] Replace `setTimeout` with polling
- [ ] Batch database operations
- [ ] Remove redundant assertions
- [ ] Use Redpanda instead of Kafka

---

## Post-Workflow: Knowledge Review

After optimization, review and update:
1. `references/common/best-practices.md` - Add new patterns discovered
2. `references/kafka/performance.md` - Update Kafka-specific optimizations
3. Test helpers - Incorporate optimized patterns

---

## Success Criteria

- [ ] Baseline measured before changes
- [ ] Each optimization verified independently
- [ ] Full suite passes after all changes
- [ ] No flakiness introduced
- [ ] Performance improvement documented
- [ ] Test quality maintained (no reduced assertions)
