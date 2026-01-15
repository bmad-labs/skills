# E2E Test Debugging Guide

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

### Node Inspector

```bash
# Basic debug mode
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand

# With specific test file
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand test/e2e/user.e2e-spec.ts

# With test name pattern
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand -t "should create user"
```

Open Chrome → `chrome://inspect` to connect.

### Verbose Output

```bash
npm run test:e2e -- --verbose
npm run test:e2e -- --verbose --expand
npm run test:e2e -- --silent=false
```

### Single Test Execution

```bash
# Run specific file
npm run test:e2e -- test/e2e/user.e2e-spec.ts

# Run tests matching pattern
npm run test:e2e -- -t "should create user"

# Run single describe block
npm run test:e2e -- -t "User API"
```

---

## Log Analysis

### Viewing Logs

```bash
# Real-time watching
tail -f logs/e2e-test.log

# Search for errors
grep -i "error" logs/e2e-test.log

# Search with context (5 lines before/after)
grep -B5 -A5 "FAIL" logs/e2e-test.log

# Find specific request
grep "POST /users" logs/e2e-test.log
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
  await new Promise(r => setTimeout(r, 500));
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

### Step 1: Create Tracking File

```markdown
<!-- _e2e-failures.md -->
# E2E Test Failures

## Test: "should create user and publish event"
- **File**: `test/e2e/user.e2e-spec.ts:42`
- **Error**: `Timeout - Async callback was not invoked within 25000ms`
- **Status**: IN_PROGRESS
- **Notes**: Kafka consumer might not be ready

## Test: "should return 404 for missing user"
- **File**: `test/e2e/user.e2e-spec.ts:78`
- **Error**: `Expected 404, received 500`
- **Status**: PENDING
```

### Step 2: Fix ONE Test at a Time

```bash
# Run only the failing test
npm run test:e2e -- -t "should create user and publish event"

# Check logs for that specific test
grep "should create user" logs/e2e-test.log
```

### Step 3: Analyze Root Cause

1. Check test setup: Is beforeAll/beforeEach complete?
2. Check test isolation: Is state leaking from other tests?
3. Check async operations: Are waits long enough?
4. Check mocks: Are external dependencies mocked?
5. Check database state: Is data being cleaned properly?

### Step 4: Verify Fix

```bash
# Run the fixed test multiple times
for i in {1..5}; do npm run test:e2e -- -t "should create user"; done
```

### Step 5: Update Tracking

```markdown
## Test: "should create user and publish event"
- **Status**: FIXED
- **Root Cause**: Kafka consumer group not ready
- **Fix**: Added 5s delay in beforeAll after startAllMicroservices()
```

### Step 6: Run Full Suite

```bash
# Only after all individual tests pass
npm run test:e2e
```

### Step 7: Clean Up

```bash
rm _e2e-failures.md
```
