# Debugging Unit Test Workflow

## Purpose

Systematically diagnose and fix failing unit tests using structured debugging techniques.

---

## Pre-Workflow Knowledge Loading

Before debugging, load and review the following reference files:

1. **MANDATORY**: Read `references/common/rules.md` - Understand expected patterns
2. **MANDATORY**: Read `references/common/knowledge.md` - Understand test lifecycle
3. **If mock issues**: Read `references/mocking/deep-mocked.md` - DeepMocked patterns
4. **If mock issues**: Read `references/mocking/jest-native.md` - Native Jest patterns

---

## Execution Rules

- Diagnose before fixing
- Isolate the problem systematically
- Fix root cause, not symptoms
- Verify fix doesn't break other tests
- Document the issue and resolution

---

## Workflow Steps

### Step 1: Reproduce the Failure

**Actions:**

1. Run the failing test in isolation:
   ```bash
   npm test -- -t "[exact test name]"
   ```

2. Capture the complete error output:
   - Error message
   - Expected vs received values
   - Stack trace
   - Line numbers

3. Document the failure:
   ```
   **Failure Information:**
   - Test: [test name]
   - File: [path/to/file.spec.ts:line]
   - Error: [error type]
   - Expected: [expected value]
   - Received: [received value]
   ```

**Checkpoint:** Failure consistently reproduced.

---

### Step 2: Classify the Failure Type

**Actions:**

1. Identify failure category:

   | Type | Indicators | Common Causes |
   |------|------------|---------------|
   | Assertion Failure | "Expected X, received Y" | Wrong mock return, logic error |
   | Exception | "Error: [message]" | Thrown error not caught/expected |
   | Timeout | "exceeded timeout" | Unresolved promise, missing mock |
   | Mock Error | "is not a function" | Missing mock setup |
   | Module Error | "Cannot find module" | Import/path issue |
   | Type Error | "is not defined" | Missing variable/import |

2. Determine failure category:
   ```
   **Failure Category:** [category]
   **Likely Cause:** [initial hypothesis]
   ```

**Checkpoint:** Failure categorized.

---

### Step 3: Analyze Based on Failure Type

#### Type A: Assertion Failure

1. Compare expected vs received in detail:
   ```
   Expected: { id: 'user-123', email: 'test@example.com' }
   Received: { id: 'user-123', email: undefined }
   ```

2. Check possible causes:
   - [ ] Mock not returning expected data
   - [ ] Wrong mock method being called
   - [ ] Logic error in target code
   - [ ] Test expectation incorrect

3. Add debug logging:
   ```typescript
   it('failing test', async () => {
     // Arrange
     console.log('Mock setup:', mockService.method.getMockImplementation());

     // Act
     const result = await target.methodName(input);
     console.log('Result:', JSON.stringify(result, null, 2));

     // Assert
     expect(result).toEqual(expected);
   });
   ```

#### Type B: Unexpected Exception

1. Identify where exception is thrown:
   ```typescript
   it('failing test', async () => {
     try {
       const result = await target.methodName(input);
       console.log('Success:', result);
     } catch (error) {
       console.log('Error type:', error.constructor.name);
       console.log('Error message:', error.message);
       console.log('Stack:', error.stack);
       throw error;
     }
   });
   ```

2. Check possible causes:
   - [ ] Mock throwing instead of resolving
   - [ ] Missing required mock return value
   - [ ] Validation failing in target code
   - [ ] Dependency not properly mocked

#### Type C: Timeout

1. Check for unresolved promises:
   - Mock method called but not configured
   - Async operation waiting forever
   - Event that never fires

2. Debug technique:
   ```typescript
   it('timing out test', async () => {
     console.log('Before call');
     const promise = target.methodName(input);
     console.log('After call, waiting...');
     const result = await promise;
     console.log('Resolved:', result);
   }, 30000); // Extended timeout for debugging
   ```

3. Common fixes:
   - Add `mockResolvedValue` to async mocks
   - Add `mockReturnValue` to sync mocks
   - Check if mock method name matches actual call

#### Type D: Mock Error

1. Verify mock is properly created:
   ```typescript
   beforeEach(() => {
     mockService = createMock<ServiceType>();
     console.log('Mock created:', Object.keys(mockService));
   });
   ```

2. Verify mock is injected:
   ```typescript
   const module = await Test.createTestingModule({
     providers: [
       Target,
       { provide: ServiceType, useValue: mockService },
     ],
   }).compile();

   // Verify injection
   const injected = module.get(ServiceType);
   console.log('Injected same as mock:', injected === mockService);
   ```

**Checkpoint:** Root cause identified.

---

### Step 4: Implement Fix

**Actions:**

1. Based on root cause, apply appropriate fix:

   | Root Cause | Fix |
   |------------|-----|
   | Missing mock return | Add `mockResolvedValue`/`mockReturnValue` |
   | Wrong mock method | Fix method name or use correct mock |
   | Logic error in test | Fix test arrangement or expectations |
   | Logic error in target | Fix target code (separate task) |
   | Missing mock | Add mock to provider list |
   | Import error | Fix import path |

2. Apply minimal fix:
   ```
   **Fix Applied:**
   - File: [path]
   - Change: [description]
   - Reason: [why this fixes the issue]
   ```

**Checkpoint:** Fix implemented.

---

### Step 5: Verify Fix

**Actions:**

1. Run the fixed test:
   ```bash
   npm test -- -t "[test name]"
   ```

2. Run related tests to check for regressions:
   ```bash
   npm test -- [path/to/file.spec.ts]
   ```

3. Run full test suite if change could have wider impact:
   ```bash
   npm test
   ```

4. Verify results:
   ```
   **Verification Results:**
   - Fixed test: [PASS/FAIL]
   - Related tests: [X] passed, [Y] failed
   - Full suite: [X] passed, [Y] failed
   ```

**Checkpoint:** Fix verified, no regressions.

---

### Step 6: Document Resolution

**Actions:**

1. Record the debugging session:

```
## Debug Resolution Report

### Original Failure
- Test: [test name]
- Error: [error message]
- Date: [date]

### Root Cause
[Description of what caused the failure]

### Fix Applied
- File: [path]
- Change: [specific change made]

### Lessons Learned
[Any insights for preventing similar issues]

### Verification
- Fixed test: PASS
- Related tests: PASS
- Regression check: PASS
```

**Checkpoint:** Resolution documented.

---

## Debug Techniques Reference

### Console Logging

```typescript
it('test with logging', async () => {
  console.log('Input:', input);
  console.log('Mock calls before:', mockService.method.mock.calls);

  const result = await target.methodName(input);

  console.log('Result:', result);
  console.log('Mock calls after:', mockService.method.mock.calls);
});
```

### Check Mock State

```typescript
// Check if mock was called
console.log('Called:', mockService.method.mock.calls.length);

// Check call arguments
console.log('Args:', mockService.method.mock.calls[0]);

// Check return value
console.log('Returns:', mockService.method.mock.results);
```

### Step Through with Debugger

```bash
# Run Jest with debugger
node --inspect-brk node_modules/.bin/jest --runInBand -t "[test name]"
```

Then attach VS Code debugger or Chrome DevTools.

### Isolate Setup Issues

```typescript
describe('Target', () => {
  it('should create module', async () => {
    const module = await Test.createTestingModule({
      providers: [Target],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should get target', async () => {
    const module = await Test.createTestingModule({
      providers: [Target],
    }).compile();

    const target = module.get<Target>(Target);
    expect(target).toBeDefined();
  });
});
```

---

## Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Mock not returning | `undefined` result | Add `mockResolvedValue()` |
| Mock not called | Call count is 0 | Verify mock injection |
| Wrong mock called | Different mock has calls | Check dependency injection |
| Async not awaited | Promise object in result | Add `await` to call |
| Mock reset missing | State from other tests | Add `jest.clearAllMocks()` |
| Private method tested | Cannot access | Test via public interface |
| Logger errors | Console noise | Add `MockLoggerService` |

---

## Post-Workflow Verification

After debugging is complete:

1. **Re-read** `references/common/rules.md` to ensure fix follows conventions
2. Confirm all tests pass
3. Run coverage to ensure fix didn't reduce coverage
4. Consider if similar issues exist elsewhere
