# E2E Test Debugging Guide

## Contents

- [Context Efficiency: Temp File Output](#context-efficiency-temp-file-output)
- [VS Code Debugging](#vs-code-debugging)
- [Command Line Debugging](#command-line-debugging)
- [Log Analysis](#log-analysis)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Systematic Failure Resolution](#systematic-failure-resolution)

## Context Efficiency: Temp File Output

**CRITICAL**: Always redirect E2E test output to temp files. E2E output is verbose and bloats agent context.

**IMPORTANT**: Create one temp directory per session with `mktemp -d` and paste its literal path into every later command: each Bash tool call starts a fresh shell, so an exported session variable would be empty in later calls and parallel agents would collide on the same file names.

```bash
# Create the session temp directory (once at start)
mktemp -d /tmp/e2e-XXXXXX   # prints e.g. /tmp/e2e-a1B2c3 — paste that literal path wherever <E2E_DIR> appears

# Standard pattern - redirect to temp file only (no console output)
npm run test:e2e -- -t "{test name}" > <E2E_DIR>/debug.log 2>&1

# Read summary only
tail -50 <E2E_DIR>/debug.log

# Get failure details
grep -B 5 -A 20 "FAIL\|Error:" <E2E_DIR>/debug.log

# Cleanup when done
rm -rf <E2E_DIR>
```

**Temp File Locations** (inside `<E2E_DIR>`, created once per session):
- `<E2E_DIR>/debug.log` - Debug runs
- `<E2E_DIR>/output.log` - General test output
- `<E2E_DIR>/verify.log` - Verification runs
- `<E2E_DIR>/failures.md` - Tracking file

---

## VS Code Debugging

### launch.json Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug E2E Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--config", "test/jest-e2e.config.ts",
        "--runInBand",
        "--no-cache"
      ],
      "console": "integratedTerminal",
      "env": { "NODE_ENV": "test" }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current Test File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--config", "test/jest-e2e.config.ts",
        "--runInBand",
        "${relativeFile}"
      ],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Specific Test",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--config", "test/jest-e2e.config.ts",
        "--runInBand",
        "-t", "${input:testName}"
      ],
      "console": "integratedTerminal"
    }
  ],
  "inputs": [
    {
      "id": "testName",
      "type": "promptString",
      "description": "Test name pattern"
    }
  ]
}
```

### Debugging Tips

1. Set breakpoints in both test files and source code
2. Disable coverage during debugging (add `--coverage=false`)
3. Use `debugger` statement when breakpoints don't work
4. Watch expressions: `response.body`, `response.status`, `error.message`

---

## Command Line Debugging

**All commands redirect to temp files only (no console output).**

### Node Inspector

```bash
# Basic debug mode (requires console for interactive debugging)
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand

# With specific test file
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand test/e2e/user.e2e-spec.ts

# With test name pattern
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand -t "should create user"
```

Open Chrome → `chrome://inspect` to connect.

### Verbose Output

```bash
# Verbose output - redirect then read summary (no console output)
npm run test:e2e -- --verbose > <E2E_DIR>/debug.log 2>&1
tail -100 <E2E_DIR>/debug.log

npm run test:e2e -- --verbose --expand > <E2E_DIR>/debug.log 2>&1
tail -100 <E2E_DIR>/debug.log
```

### Single Test Execution

```bash
# Run specific file (no console output)
npm run test:e2e -- test/e2e/user.e2e-spec.ts > <E2E_DIR>/output.log 2>&1
tail -50 <E2E_DIR>/output.log

# Run tests matching pattern
npm run test:e2e -- -t "should create user" > <E2E_DIR>/output.log 2>&1
tail -50 <E2E_DIR>/output.log

# Run single describe block
npm run test:e2e -- -t "User API" > <E2E_DIR>/output.log 2>&1
tail -50 <E2E_DIR>/output.log
```

---

## Log Analysis

### Viewing Logs

```bash
# View application logs (limited output)
tail -100 logs/e2e-test.log

# Search for errors in test output
grep -i "error\|fail\|exception" <E2E_DIR>/output.log

# Search with context (5 lines before/after)
grep -B5 -A5 "FAIL" <E2E_DIR>/output.log

# Find specific request in app logs
grep "POST /users" logs/e2e-test.log | tail -20
```

### Adding Debug Logs in Tests

```typescript
it('should process order', async () => {
  console.log('=== DEBUG: Starting test ===');
  console.log('Order ID:', orderId);

  const response = await request(httpServer)
    .post('/orders')
    .send(orderData);

  console.log('=== DEBUG: Response ===');
  console.log('Status:', response.status);
  console.log('Body:', JSON.stringify(response.body, null, 2));
});
```

### Request/Response Logging

```typescript
function logRequest(response: request.Response): void {
  console.log('\n=== REQUEST ===');
  console.log(`${response.request.method} ${response.request.url}`);
  console.log('Body:', response.request._data);

  console.log('\n=== RESPONSE ===');
  console.log('Status:', response.status);
  console.log('Body:', JSON.stringify(response.body, null, 2));
}

// Usage
const response = await request(httpServer).post('/users').send(data);
logRequest(response);
expect(response.status).toBe(201);
```

---

## Common Issues and Solutions

### Test hangs indefinitely

```typescript
// Cause 1: Unclosed database connection
afterAll(async () => {
  await dataSource?.destroy();
  await app?.close();
}, 30000);

// Cause 2: Unresolved promise - add timeout
const result = await Promise.race([
  someAsyncOperation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  ),
]);

// Cause 3: Kafka consumer not closed
afterAll(async () => {
  await producer?.disconnect();
  await consumer?.disconnect();
  await app?.close();
});
```

### Tests pass individually but fail together

```typescript
// Cause: Shared state between tests
beforeEach(async () => {
  await waitFor(() => isIdle()); // poll, do not sleep (helper in SKILL.md)
  await userRepository.clear();
  await orderRepository.clear();
  jest.clearAllMocks();
});
```

### Database constraint errors

```typescript
// Clean in correct order (children first)
beforeEach(async () => {
  await orderItemRepository.delete({});
  await orderRepository.delete({});
  await userRepository.delete({});
});

// Or use CASCADE
await dataSource.query('SET session_replication_role = replica');
await dataSource.query('TRUNCATE users, orders CASCADE');
await dataSource.query('SET session_replication_role = DEFAULT');
```

### Flaky async tests

```typescript
// Solution: Poll until condition met
async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeout = 10000,
  interval = 200
): Promise<T> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Timeout waiting for condition');
}

const order = await waitFor(() =>
  orderRepository.findOne({ where: { id: event.orderId } })
);
```

---

## Systematic Failure Resolution

**CRITICAL: Fix ONE test at a time. NEVER run full suite repeatedly while debugging.**

```
❌ WRONG: Run full suite → See 5 failures → Run full suite again → Still failures → ...
✅ RIGHT: Run full suite → See 5 failures → Fix test 1 → Verify → Fix test 2 → ... → Full suite ONCE
```

### Step 1: Create Tracking File

List ALL failing tests from the initial run. Work through them one by one.

```markdown
<!-- <E2E_DIR>/failures.md -->
# E2E Test Failures

## Test 1: "should create user and publish event"
- **File**: `test/e2e/user.e2e-spec.ts:42`
- **Error**: `Timeout - Async callback was not invoked within 25000ms`
- **Status**: IN_PROGRESS
- **Notes**: Kafka consumer might not be ready

## Test 2: "should return 404 for missing user"
- **File**: `test/e2e/user.e2e-spec.ts:78`
- **Error**: `Expected 404, received 500`
- **Status**: PENDING
```

### Step 2: Fix ONE Test at a Time

**Run ONLY the specific test, NEVER the full suite:**

```bash
# Run only the failing test (no console output)
npm run test:e2e -- -t "should create user and publish event" > <E2E_DIR>/debug.log 2>&1
tail -50 <E2E_DIR>/debug.log

# Check for errors in output
grep -i "error\|fail" <E2E_DIR>/debug.log
```

### Step 3: Analyze Root Cause

1. Check test setup: Is beforeAll/beforeEach complete?
2. Check test isolation: Is state leaking from other tests?
3. Check async operations: Are waits long enough?
4. Check mocks: Are external dependencies mocked?
5. Check database state: Is data being cleaned properly?

### Step 4: Verify Fix

**Run the SAME test 3-5 times to ensure stability:**

```bash
# Run the fixed test multiple times (no console output)
for i in {1..5}; do
  npm run test:e2e -- -t "should create user" > <E2E_DIR>/run$i.log 2>&1
  if [ $? -eq 0 ]; then echo "Run $i: PASS"; else echo "Run $i: FAIL"; fi
done
```

### Step 5: Update Tracking and Move to Next

```markdown
## Test 1: "should create user and publish event"
- **Status**: FIXED ✅
- **Root Cause**: Kafka consumer group not ready
- **Fix**: Added 5s delay in beforeAll after startAllMicroservices()
```

**Now move to Test 2. Repeat steps 2-5 for each failing test.**

### Step 6: Run Full Suite ONLY ONCE

**Only after ALL individual tests pass:**

```bash
npm run test:e2e > <E2E_DIR>/output.log 2>&1
tail -50 <E2E_DIR>/output.log
```

### Step 7: Clean Up

```bash
rm <E2E_DIR>/failures.md
rm -f /tmp/e2e-*.log
```
