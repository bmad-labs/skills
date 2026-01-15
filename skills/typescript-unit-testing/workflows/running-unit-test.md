# Running Unit Test Workflow

## Purpose

Execute unit tests effectively with proper configuration, filtering, and result interpretation.

---

## Pre-Workflow Knowledge Loading

Before running tests, review the following reference files if troubleshooting is needed:

1. **If tests fail**: Read `references/common/knowledge.md` - Understand test lifecycle
2. **If mocks fail**: Read `references/mocking/deep-mocked.md` - DeepMocked patterns

---

## Execution Rules

- Always run tests in a clean state
- Interpret results correctly before taking action
- Document any unexpected failures
- Complete full test run before making changes

---

## Workflow Steps

### Step 1: Determine Test Scope

**Actions:**

1. Identify what tests to run:

   | Scope | Command | Use When |
   |-------|---------|----------|
   | All tests | `npm test` | Full validation |
   | Single file | `npm test -- [path]` | Focused testing |
   | Pattern match | `npm test -- --testPathPattern=[pattern]` | Module testing |
   | Single test | `npm test -- -t "[test name]"` | Debugging specific test |

2. Confirm scope with user:
   ```
   **Test Scope:**
   - Running: [description]
   - Command: [command to execute]
   ```

**Checkpoint:** Test scope confirmed.

---

### Step 2: Run Tests

**Actions:**

1. Execute test command:
   ```bash
   # Standard run
   npm test -- [path/to/file.spec.ts]

   # With verbose output
   npm test -- [path/to/file.spec.ts] --verbose

   # In watch mode (for development)
   npm test -- [path/to/file.spec.ts] --watch
   ```

2. Capture output including:
   - Test results (pass/fail)
   - Execution time
   - Any error messages
   - Stack traces for failures

**Checkpoint:** Tests executed successfully or failures captured.

---

### Step 3: Interpret Results

**Actions:**

1. Parse test output:

   ```
   **Test Results:**

   Passed: [X] tests
   Failed: [Y] tests
   Skipped: [Z] tests
   Total time: [T]s
   ```

2. For each failure, extract:
   - Test name
   - Describe block path
   - Error type
   - Expected vs received
   - Stack trace location

3. Categorize failures:

   | Failure Type | Count | Description |
   |--------------|-------|-------------|
   | Assertion failure | [X] | Expected value mismatch |
   | Exception thrown | [X] | Unexpected error |
   | Timeout | [X] | Test exceeded time limit |
   | Setup failure | [X] | beforeEach/beforeAll error |

**Checkpoint:** Results interpreted and categorized.

---

### Step 4: Run Coverage (If Requested)

**Actions:**

1. Execute coverage command:
   ```bash
   npm run test:cov -- [path/to/file.spec.ts]
   ```

2. Parse coverage output:

   ```
   **Coverage Report:**

   | Metric | Coverage | Threshold | Status |
   |--------|----------|-----------|--------|
   | Statements | [X]% | 80% | [PASS/FAIL] |
   | Branches | [X]% | 80% | [PASS/FAIL] |
   | Functions | [X]% | 80% | [PASS/FAIL] |
   | Lines | [X]% | 80% | [PASS/FAIL] |
   ```

3. Identify uncovered lines:
   ```
   **Uncovered Code:**
   - [file:line-range]: [description]
   ```

**Checkpoint:** Coverage analyzed if requested.

---

### Step 5: Handle Common Scenarios

#### Scenario A: All Tests Pass

```
**Result: ALL TESTS PASSED**

- Total: [X] tests in [Y] test suites
- Time: [T]s
- Coverage: [X]% (if run)

No action required.
```

#### Scenario B: Some Tests Fail

1. Present failure summary:
   ```
   **Result: [X] TESTS FAILED**

   Failed Tests:
   1. [describe path] > [test name]
      - Error: [error message]
      - Expected: [expected value]
      - Received: [received value]
      - Location: [file:line]
   ```

2. Recommend next steps:
   - Use `debugging-unit-test.md` workflow for investigation
   - Run single failing test: `npm test -- -t "[test name]"`

#### Scenario C: Setup Failures

1. Identify setup issue:
   ```
   **Result: SETUP FAILURE**

   - Phase: [beforeAll/beforeEach]
   - Error: [error message]
   - Stack: [relevant stack trace]
   ```

2. Common causes:
   - Missing mock setup
   - Module resolution error
   - Dependency injection failure

#### Scenario D: Timeout

1. Identify timeout issue:
   ```
   **Result: TIMEOUT**

   - Test: [test name]
   - Timeout: [default or custom]
   ```

2. Possible causes:
   - Unresolved promise
   - Missing `mockResolvedValue`
   - Infinite loop

**Checkpoint:** Appropriate scenario handled.

---

### Step 6: Present Summary Report

**Actions:**

1. Compile execution report:

```
## Test Execution Report

### Command Executed
```bash
[exact command run]
```

### Results Summary

| Status | Count |
|--------|-------|
| Passed | [X] |
| Failed | [Y] |
| Skipped | [Z] |
| Total | [X+Y+Z] |

### Execution Time
- Total: [T]s
- Slowest: [test name] ([T]s)

### Coverage (if run)
- Statements: [X]%
- Branches: [X]%
- Functions: [X]%
- Lines: [X]%

### Issues Found
[List any failures or concerns]

### Recommended Actions
[Based on results]
```

**Checkpoint:** Summary presented to user.

---

## Common Commands Reference

| Task | Command |
|------|---------|
| Run all tests | `npm test` |
| Run single file | `npm test -- path/to/file.spec.ts` |
| Run with pattern | `npm test -- --testPathPattern="user"` |
| Run single test | `npm test -- -t "should return user"` |
| Watch mode | `npm test -- --watch` |
| Coverage | `npm run test:cov` |
| Coverage single file | `npm run test:cov -- path/to/file.spec.ts` |
| Verbose output | `npm test -- --verbose` |
| Bail on first failure | `npm test -- --bail` |
| Update snapshots | `npm test -- -u` |
| Clear cache | `npx jest --clearCache` |

---

## Post-Workflow Actions

Based on results, recommend next workflow:

| Result | Recommended Workflow |
|--------|---------------------|
| All pass | None required |
| Failures found | `debugging-unit-test.md` |
| Low coverage | `writing-unit-test.md` |
| Slow tests | `optimizing-unit-test.md` |

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Cannot find module" | Path alias issue | Check jest.config moduleNameMapper |
| "is not a function" | Mock not configured | Add mockResolvedValue/mockReturnValue |
| Timeout | Unresolved promise | Check async/await usage |
| "Received: undefined" | Missing mock return | Configure mock return value |
| Snapshot mismatch | Output changed | Review changes, update if correct |
