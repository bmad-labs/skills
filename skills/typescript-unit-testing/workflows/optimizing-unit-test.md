# Optimizing Unit Test Workflow

## Purpose

Improve unit test performance, maintainability, and reliability through systematic optimization techniques. Ensure tests run fast and exit cleanly without open handles.

---

## Pre-Workflow Knowledge Loading

Before optimizing, load and review the following reference files:

1. **MANDATORY**: Read `references/common/performance-optimization.md` - Worker config, caching, CI optimization
2. **MANDATORY**: Read `references/common/detect-open-handles.md` - Open handle detection and cleanup
3. **MANDATORY**: Read `references/common/rules.md` - Ensure optimizations maintain compliance
4. **If testing repositories**: Read `references/repository/mongodb.md` or `references/repository/postgres.md`
5. **If testing Kafka**: Read `references/kafka/kafka.md`
6. **If testing Redis**: Read `references/redis/redis.md`

---

## Execution Rules

- Measure before optimizing
- Optimize one thing at a time
- Verify optimizations don't break tests
- Document performance improvements
- Don't sacrifice test quality for speed
- **CRITICAL**: Ensure no open handles remain after tests complete
- **ALWAYS output test results to temp files** - Avoids context bloat

---

## Context Efficiency: Temp File Output

**Why**: Performance optimization requires multiple test runs. Direct output bloats agent context.

**IMPORTANT**: Redirect output to temp files only (NO console output). Use unique session ID to prevent conflicts.

```bash
# Initialize session (once at start of optimization)
export UT_SESSION=$(date +%s)-$$

# Capture timing data (no console output)
{ time npm test > /tmp/ut-${UT_SESSION}-timing.log 2>&1 ; } 2>> /tmp/ut-${UT_SESSION}-timing.log

# Read summary only
tail -50 /tmp/ut-${UT_SESSION}-timing.log

# Extract timing info
grep -E "Time:|Duration:|passed|failed|real|user|sys" /tmp/ut-${UT_SESSION}-timing.log

# Cleanup when done
rm -f /tmp/ut-${UT_SESSION}-*.log
```

**Temp File Locations** (with `${UT_SESSION}` unique per agent):
- `/tmp/ut-${UT_SESSION}-baseline.log` - Baseline run
- `/tmp/ut-${UT_SESSION}-optimized.log` - Optimized run
- `/tmp/ut-${UT_SESSION}-timing.log` - Timing data

---

## Workflow Steps

### Step 1: Measure Current Performance and Detect Open Handles

**Actions:**

1. Run tests with timing and open handle detection (no console output):
   ```bash
   npm test -- --verbose --detectOpenHandles --forceExit > /tmp/ut-${UT_SESSION}-baseline.log 2>&1
   tail -50 /tmp/ut-${UT_SESSION}-baseline.log
   ```

2. Check for open handles specifically:
   ```bash
   grep -A 20 "open handle" /tmp/ut-${UT_SESSION}-baseline.log
   ```

3. Identify slow tests (use Jest's built-in timing):
   ```bash
   grep -E "^\s*\d+.*ms$" /tmp/ut-${UT_SESSION}-baseline.log
   ```

4. Document baseline metrics:
   ```
   **Current Test Performance:**

   | Metric | Value |
   |--------|-------|
   | Total test count | [X] |
   | Total execution time | [T]s |
   | Slowest test file | [file] ([T]s) |
   | Slowest individual test | [name] ([T]ms) |
   | Average test time | [T]ms |
   | Open handles detected | [count] |
   ```

5. Categorize tests by speed:

   | Category | Threshold | Count |
   |----------|-----------|-------|
   | Fast | < 50ms | [X] |
   | Medium | 50-200ms | [X] |
   | Slow | > 200ms | [X] |

**Checkpoint:** Baseline performance and open handles documented.

---

### Step 2: Identify Optimization Opportunities and Open Handle Sources

**Actions:**

1. Analyze slow tests for common issues:

   | Issue | Indicator | Impact |
   |-------|-----------|--------|
   | Heavy setup | beforeEach > 100ms | HIGH |
   | Unnecessary async | await where not needed | MEDIUM |
   | Module recreation | Full module per test | HIGH |
   | Real timeouts | setTimeout in test | HIGH |
   | Large mock data | Complex test data | LOW |
   | Open handles | Jest warning message | CRITICAL |

2. Identify open handle sources:

   | Handle Type | Common Source | Solution |
   |-------------|---------------|----------|
   | TCPSERVERWRAP | Unclosed HTTP server | Close in afterAll |
   | TCPWRAP | Database connections | Disconnect in afterAll |
   | HTTPINCOMINGMESSAGE | Pending HTTP requests | Abort/close connections |
   | Timeout | setTimeout not cleared | Use fake timers or clearTimeout |
   | KAFKAPRODUCER | Kafka client not closed | Disconnect producer |
   | KAFKACONSUMER | Kafka consumer running | Disconnect consumer |
   | REDISCLIENT | Redis connection open | Quit/disconnect client |
   | MONGOCLIENT | MongoDB connection open | Close connection |

3. Check for anti-patterns:

   ```
   **Optimization Opportunities Found:**

   1. [Issue]: [Description]
      - Location: [file:line or test name]
      - Estimated improvement: [X]ms
      - Priority: [HIGH/MEDIUM/LOW]

   **Open Handles Found:**

   1. [Handle Type]: [Description]
      - Location: [file:line or test name]
      - Source: [what created the handle]
      - Priority: CRITICAL
   ```

**Checkpoint:** Optimization opportunities and open handles identified.

---

### Step 3: Optimize Test Setup

#### Technique A: Share Expensive Setup

Move one-time setup to `beforeAll`:

```typescript
// BEFORE (slow)
describe('Service', () => {
  let target: Service;

  beforeEach(async () => {
    // Expensive: compiles module for every test
    const module = await Test.createTestingModule({
      providers: [Service, ...manyProviders],
    }).compile();
    target = module.get(Service);
  });
});

// AFTER (fast)
describe('Service', () => {
  let module: TestingModule;
  let target: Service;

  beforeAll(async () => {
    // One-time: compiles module once
    module = await Test.createTestingModule({
      providers: [Service, ...manyProviders],
    }).compile();
  });

  beforeEach(() => {
    target = module.get(Service);
    jest.clearAllMocks(); // Reset mock state
  });
});
```

#### Technique B: Lazy Mock Creation

Only create mocks when needed:

```typescript
// BEFORE
beforeEach(() => {
  mockServiceA = createMock<ServiceA>();
  mockServiceB = createMock<ServiceB>();
  mockServiceC = createMock<ServiceC>();
  // Creates all mocks even if test only uses one
});

// AFTER
const getMockServiceA = () => createMock<ServiceA>();
const getMockServiceB = () => createMock<ServiceB>();

it('test using only service A', () => {
  const mockA = getMockServiceA();
  // Only creates what's needed
});
```

#### Technique C: Reduce Module Complexity

Only include required providers:

```typescript
// BEFORE (slow)
const module = await Test.createTestingModule({
  imports: [AppModule], // Imports everything
}).compile();

// AFTER (fast)
const module = await Test.createTestingModule({
  providers: [
    TargetService,
    { provide: DependencyA, useValue: mockA },
    { provide: DependencyB, useValue: mockB },
  ],
}).compile();
```

**Checkpoint:** Setup optimizations applied.

---

### Step 4: Fix Open Handles (CRITICAL)

**Actions:**

Open handles prevent Jest from exiting cleanly and indicate resource leaks. Fix ALL open handles before other optimizations.

#### Technique A: Proper Module Cleanup

```typescript
describe('Service', () => {
  let module: TestingModule;
  let target: Service;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [Service],
    }).compile();

    target = module.get(Service);
  });

  afterAll(async () => {
    // CRITICAL: Close the module to release resources
    await module.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

#### Technique B: Close Database Connections

```typescript
// MongoDB
describe('Repository', () => {
  let mongoServer: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    // CRITICAL: Close in correct order
    await connection.close();
    await mongoServer.stop();
  });
});

// PostgreSQL (pg-mem)
describe('Repository', () => {
  let db: IMemoryDb;

  beforeAll(() => {
    db = newDb();
  });

  afterAll(() => {
    // pg-mem doesn't need explicit cleanup, but real connections do
  });
});
```

#### Technique C: Close Kafka Connections

```typescript
describe('KafkaService', () => {
  let module: TestingModule;
  let kafkaClient: ClientKafka;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [KafkaService],
    }).compile();

    kafkaClient = module.get(ClientKafka);
    await kafkaClient.connect();
  });

  afterAll(async () => {
    // CRITICAL: Disconnect Kafka client
    await kafkaClient.close();
    await module.close();
  });
});
```

#### Technique D: Close Redis Connections

```typescript
describe('CacheService', () => {
  let module: TestingModule;
  let redisClient: Redis;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    redisClient = module.get(REDIS_CLIENT);
  });

  afterAll(async () => {
    // CRITICAL: Quit Redis client
    await redisClient.quit();
    await module.close();
  });
});
```

#### Technique E: Clear Timers

```typescript
describe('Service with timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // CRITICAL: Clear all timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});

// Alternative: Track and clear specific timers
describe('Service', () => {
  let timerId: NodeJS.Timeout;

  it('should set timer', () => {
    timerId = setTimeout(() => {}, 1000);
  });

  afterEach(() => {
    if (timerId) {
      clearTimeout(timerId);
    }
  });
});
```

#### Technique F: Close HTTP Servers

```typescript
describe('Controller E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // CRITICAL: Close the application
    await app.close();
  });
});
```

#### Technique G: Verify No Open Handles

After applying fixes, verify:

```bash
npm test -- --detectOpenHandles [path/to/file.spec.ts]
```

Expected output should NOT contain:
- "Jest has detected the following X open handles"
- Any TCPWRAP, TCPSERVERWRAP, or similar warnings

**Checkpoint:** All open handles fixed, tests exit cleanly.

---

### Step 5: Optimize Async Operations

#### Technique A: Remove Unnecessary Async

```typescript
// BEFORE
it('should return value', async () => {
  const result = await target.syncMethod(); // Method is not async
  expect(result).toBe(expected);
});

// AFTER
it('should return value', () => {
  const result = target.syncMethod();
  expect(result).toBe(expected);
});
```

#### Technique B: Mock Time Instead of Waiting

```typescript
// BEFORE (slow - waits 1 second)
it('should retry after delay', async () => {
  mockService.call
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValue('success');

  const result = await target.callWithRetry();
  expect(result).toBe('success');
}, 5000);

// AFTER (fast - mocks time)
it('should retry after delay', async () => {
  jest.useFakeTimers();

  mockService.call
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValue('success');

  const promise = target.callWithRetry();
  jest.advanceTimersByTime(1000);
  const result = await promise;

  expect(result).toBe('success');
  jest.useRealTimers();
});
```

#### Technique C: Parallel Test Execution

Ensure tests are independent for parallel execution:

```typescript
// jest.config.ts
export default {
  maxWorkers: '50%', // Use half of CPU cores
  // OR
  maxWorkers: 4, // Fixed number
};
```

**Checkpoint:** Async optimizations applied.

---

### Step 6: Optimize Test Data

#### Technique A: Use Factories

```typescript
// BEFORE (verbose, repeated)
it('test 1', () => {
  const user = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    createdAt: new Date(),
  };
});

it('test 2', () => {
  const user = {
    id: 'user-2',
    email: 'test2@example.com',
    name: 'Test User 2',
    role: 'user',
    createdAt: new Date(),
  };
});

// AFTER (concise, reusable)
const createUser = (overrides = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date(),
  ...overrides,
});

it('test 1', () => {
  const user = createUser({ role: 'admin' });
});

it('test 2', () => {
  const user = createUser({ id: 'user-2', email: 'test2@example.com' });
});
```

#### Technique B: Minimize Mock Data

```typescript
// BEFORE (excessive data)
mockRepository.findById.mockResolvedValue({
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  address: { street: '123 Main', city: 'NYC', zip: '10001' },
  preferences: { theme: 'dark', notifications: true },
  // ... 20 more fields
});

// AFTER (minimal required data)
mockRepository.findById.mockResolvedValue({
  id: 'user-1',
  email: 'test@example.com',
  // Only fields actually used by the test
});
```

**Checkpoint:** Test data optimized.

---

### Step 7: Optimize Test Organization

#### Technique A: Group Related Tests

```typescript
describe('UserService', () => {
  // Group by method
  describe('findById', () => {
    // All findById tests share context
  });

  describe('create', () => {
    // All create tests share context
  });
});
```

#### Technique B: Skip Redundant Tests

```typescript
// If testing same logic through multiple paths, skip redundant ones
it.skip('redundant test covered by other tests', () => {});

// Or use conditional skipping
const skipIfCI = process.env.CI ? it.skip : it;
skipIfCI('expensive test skipped in CI', () => {});
```

#### Technique C: Use Test Tags

```bash
# Run only fast tests
npm test -- --testPathIgnorePatterns="slow"

# Run only specific category
npm test -- --testPathPattern="unit"
```

**Checkpoint:** Test organization optimized.

---

### Step 8: Measure Improvement

**Actions:**

1. Re-run performance measurement with open handle detection (no console output):
   ```bash
   npm test -- --verbose --detectOpenHandles > /tmp/ut-${UT_SESSION}-optimized.log 2>&1
   tail -50 /tmp/ut-${UT_SESSION}-optimized.log
   ```

2. Verify clean exit (no --forceExit needed):
   ```bash
   npm test -- --verbose > /tmp/ut-${UT_SESSION}-output.log 2>&1
   tail -30 /tmp/ut-${UT_SESSION}-output.log
   # Should exit cleanly without hanging
   ```

3. Compare with baseline:
   ```bash
   echo "=== BASELINE ===" && grep -E "Time:|passed|failed" /tmp/ut-${UT_SESSION}-baseline.log
   echo "=== OPTIMIZED ===" && grep -E "Time:|passed|failed" /tmp/ut-${UT_SESSION}-optimized.log
   ```

4. Document comparison:
   ```
   **Performance Improvement:**

   | Metric | Before | After | Improvement |
   |--------|--------|-------|-------------|
   | Total time | [T]s | [T]s | [X]% faster |
   | Slowest file | [T]s | [T]s | [X]% faster |
   | Slowest test | [T]ms | [T]ms | [X]% faster |
   | Average test | [T]ms | [T]ms | [X]% faster |
   | Open handles | [X] | 0 | Fixed |
   | Clean exit | No | Yes | Fixed |
   ```

4. Verify no regressions:
   - All tests still pass
   - Coverage unchanged or improved
   - Test quality maintained
   - **No open handles detected**
   - **Tests exit cleanly without --forceExit**

**Checkpoint:** Improvements measured, no open handles, clean exit verified.

---

### Step 9: Document Optimizations

**Actions:**

1. Record optimization session:

```
## Test Optimization Report

### Date: [date]

### Before
- Total tests: [X]
- Total time: [T]s
- Slowest: [test] ([T]ms)

### After
- Total tests: [X]
- Total time: [T]s
- Slowest: [test] ([T]ms)
- Open handles: 0
- Clean exit: Yes

### Optimizations Applied

1. **[Technique Name]**
   - Files affected: [list]
   - Improvement: [X]ms saved

### Recommendations for Future
- [Patterns to follow]
- [Anti-patterns to avoid]
```

**Checkpoint:** Documentation complete.

---

## Post-Workflow Verification

After optimizing:

1. **Re-read** `references/common/rules.md` to ensure optimizations maintain quality standards
2. Run full test suite to verify no regressions
3. Check coverage hasn't decreased
4. **Verify no open handles**: `npm test -- --detectOpenHandles`
5. **Verify clean exit**: Tests should exit without `--forceExit`
6. Document any new patterns for team reference

---

## Optimization Quick Reference

| Technique | Typical Improvement | Effort |
|-----------|--------------------:|--------|
| Fix open handles | Clean exit | CRITICAL |
| beforeAll for module | 30-50% | Low |
| Remove unnecessary async | 5-10% | Low |
| Mock timers | 50-90% per test | Medium |
| Minimal mock data | 5-15% | Low |
| Test factories | Maintainability | Medium |
| Parallel execution | 30-60% | Low |

---

## Open Handle Quick Reference

| Handle Type | Source | Fix |
|-------------|--------|-----|
| TCPSERVERWRAP | HTTP server | `await app.close()` in afterAll |
| TCPWRAP | DB connection | Close connection in afterAll |
| MONGOCLIENT | MongoDB | `await connection.close()` |
| KAFKAPRODUCER | Kafka producer | `await client.close()` |
| KAFKACONSUMER | Kafka consumer | `await consumer.disconnect()` |
| REDISCLIENT | Redis | `await client.quit()` |
| Timeout | setTimeout | `jest.useFakeTimers()` or `clearTimeout()` |
| HTTPINCOMINGMESSAGE | Pending request | Abort controller or close connection |

---

## Anti-Patterns to Avoid

| Don't | Why | Do Instead |
|-------|-----|------------|
| Use `--forceExit` | Hides resource leaks | Fix open handles properly |
| Remove assertions for speed | Reduces test quality | Keep assertions, optimize setup |
| Share mutable state | Causes flaky tests | Reset state in beforeEach |
| Skip slow tests | Reduces coverage | Optimize the tests |
| Use real timeouts | Slows tests significantly | Mock time |
| Over-parallelize | Can cause resource contention | Find optimal worker count |
| Skip afterAll cleanup | Causes open handles | Always close resources |
