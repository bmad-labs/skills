# Reviewing Unit Test Workflow

## Purpose

Systematically review existing unit tests to ensure they meet quality standards, follow conventions, and provide adequate coverage.

---

## Pre-Workflow Knowledge Loading

Before reviewing tests, load and review the following reference files:

1. **MANDATORY**: Read `references/common/rules.md` - AAA pattern, naming conventions, coverage requirements
2. **MANDATORY**: Read `references/common/assertions.md` - Assertion patterns and matchers
3. **MANDATORY**: Read `references/common/knowledge.md` - Testing philosophy and what to test

---

## Execution Rules

- Review each test file systematically
- Document all issues found with severity level
- Provide specific actionable feedback
- Complete full review before presenting findings

---

## Workflow Steps

### Step 1: Identify Tests to Review

**Actions:**

1. Identify test files to review:
   - Specific file: `[path/to/component.spec.ts]`
   - Or directory: `[path/to/module/]`

2. Also read the corresponding source file(s) to understand what should be tested

3. List files to review:
   ```
   **Files to Review:**
   - Test: [path/to/file.spec.ts]
   - Source: [path/to/file.ts]
   ```

**Checkpoint:** Files identified and source code understood.

---

### Step 2: Review Test Structure

**Actions:**

1. Check test file structure against conventions:

   | Criterion | Expected | Status |
   |-----------|----------|--------|
   | File naming | `*.spec.ts` | [ ] |
   | File location | Co-located with source | [ ] |
   | SUT variable | Named `target` | [ ] |
   | Mock variables | Prefixed with `mock` | [ ] |
   | Mock types | Using `DeepMocked<T>` | [ ] |
   | Logger | Using `MockLoggerService` | [ ] |

2. Check describe/it structure:
   ```typescript
   describe('ClassName', () => {
     describe('methodName', () => {
       it('should [expected] when [condition]', () => {});
     });
   });
   ```

3. Document structural issues:
   ```
   **Structural Issues:**
   - [CRITICAL/MAJOR/MINOR]: [Description]
   ```

**Checkpoint:** Structural review complete.

---

### Step 3: Review Setup and Teardown

**Actions:**

1. Verify beforeEach setup:

   | Criterion | Status | Issue |
   |-----------|--------|-------|
   | Mocks created fresh | [ ] | |
   | TestingModule built | [ ] | |
   | `.setLogger()` included | [ ] | |
   | Target retrieved from module | [ ] | |

2. Verify afterEach cleanup:

   | Criterion | Status | Issue |
   |-----------|--------|-------|
   | `jest.clearAllMocks()` called | [ ] | |
   | No shared mutable state | [ ] | |

3. Check for setup anti-patterns:
   - Shared state between tests
   - Missing mock reset
   - Expensive setup in beforeEach (should be beforeAll)

**Checkpoint:** Setup/teardown review complete.

---

### Step 4: Review AAA Pattern Compliance

**Actions:**

1. For each test, verify AAA pattern:

   | Test | Arrange | Act | Assert | Comments |
   |------|---------|-----|--------|----------|
   | test name | [ ] | [ ] | [ ] | [ ] |

2. Check for AAA violations:
   - Missing phase comments
   - Multiple actions in single test
   - Assertions in Arrange phase
   - Missing assertions

3. Document AAA issues:
   ```
   **AAA Pattern Issues:**
   - [test name]: [issue description]
   ```

**Checkpoint:** AAA pattern review complete.

---

### Step 5: Review Assertions Quality

**Actions:**

1. Check each assertion for quality:

   | Anti-Pattern | Found | Location |
   |--------------|-------|----------|
   | `toBeDefined()` only | [ ] | |
   | `toBeTruthy()` only | [ ] | |
   | Missing property assertions | [ ] | |
   | Conditional assertions (if/else) | [ ] | |
   | No mock call verification | [ ] | |

2. Verify assertions are specific:
   ```typescript
   // BAD
   expect(result).toBeDefined();

   // GOOD
   expect(result).toEqual({ id: 'user-123', email: 'test@example.com' });
   ```

3. Verify mock interactions verified:
   ```typescript
   expect(mockService.method).toHaveBeenCalledWith(expectedArgs);
   expect(mockService.method).toHaveBeenCalledTimes(1);
   ```

4. Document assertion issues:
   ```
   **Assertion Issues:**
   - [CRITICAL]: [test name] - Only checks existence, not values
   - [MAJOR]: [test name] - Missing mock call verification
   ```

**Checkpoint:** Assertion quality review complete.

---

### Step 6: Review Test Coverage

**Actions:**

1. Run coverage report:
   ```bash
   npm run test:cov -- [path/to/file.spec.ts]
   ```

2. Check coverage against requirements:

   | Category | Required | Actual | Status |
   |----------|----------|--------|--------|
   | Statement | 80% | [ ]% | |
   | Branch | 80% | [ ]% | |
   | Function | 80% | [ ]% | |
   | Line | 80% | [ ]% | |

3. Identify missing test cases by category:

   | Category | Coverage | Missing Tests |
   |----------|----------|---------------|
   | Happy path | [ ] | |
   | Edge cases | [ ] | |
   | Error cases | [ ] | |
   | Business rules | [ ] | |

4. List uncovered code paths:
   ```
   **Uncovered Code:**
   - Line [X-Y]: [description of uncovered logic]
   ```

**Checkpoint:** Coverage review complete.

---

### Step 7: Review Exception Testing

**Actions:**

1. For each exception in source code, verify test exists:

   | Exception | Condition | Test Exists | Verifies Type | Verifies Message | Verifies Code |
   |-----------|-----------|-------------|---------------|------------------|---------------|
   | NotFoundException | not found | [ ] | [ ] | [ ] | [ ] |
   | BadRequestException | validation | [ ] | [ ] | [ ] | [ ] |

2. Check exception test patterns:
   ```typescript
   // Should verify type
   await expect(target.method()).rejects.toThrow(NotFoundException);

   // Should verify message
   await expect(target.method()).rejects.toThrow('Expected message');

   // Should verify error code if applicable
   await expect(target.method()).rejects.toMatchObject({
     errorCode: 'EXPECTED_CODE',
   });
   ```

3. Document exception testing issues:
   ```
   **Exception Testing Issues:**
   - [exception type]: [missing verification]
   ```

**Checkpoint:** Exception testing review complete.

---

### Step 8: Compile Review Report

**Actions:**

1. Compile all findings into a structured report:

```
## Unit Test Review Report

### File: [path/to/file.spec.ts]
### Source: [path/to/source.ts]
### Date: [current date]

---

### Summary

| Metric | Status |
|--------|--------|
| Overall Quality | [PASS/NEEDS WORK/FAIL] |
| Coverage | [X]% |
| Critical Issues | [count] |
| Major Issues | [count] |
| Minor Issues | [count] |

---

### Critical Issues (Must Fix)

1. **[Issue Title]**
   - Location: [test name / line number]
   - Problem: [description]
   - Fix: [specific action to take]

---

### Major Issues (Should Fix)

1. **[Issue Title]**
   - Location: [test name / line number]
   - Problem: [description]
   - Fix: [specific action to take]

---

### Minor Issues (Consider Fixing)

1. **[Issue Title]**
   - Location: [test name / line number]
   - Problem: [description]
   - Fix: [specific action to take]

---

### Missing Test Cases

| Method | Missing Category | Priority |
|--------|-----------------|----------|
| [method] | [category] | [HIGH/MEDIUM/LOW] |

---

### Recommendations

1. [Specific recommendation]
2. [Specific recommendation]
```

**Checkpoint:** Report compiled and presented to user.

---

## Post-Workflow Verification

After presenting the review:

1. **Re-read** `references/common/rules.md` to confirm all issues identified
2. Prioritize fixes with user
3. Offer to help fix critical issues first

---

## Issue Severity Definitions

| Severity | Definition | Examples |
|----------|------------|----------|
| CRITICAL | Test provides false confidence or is fundamentally broken | Only checks `toBeDefined()`, testing wrong behavior |
| MAJOR | Test has significant gaps or doesn't follow conventions | Missing mock verification, no exception testing |
| MINOR | Test works but could be improved | Missing comments, inconsistent naming |

---

## Quick Review Checklist

```
**Review Checklist:**

Structure:
- [ ] File named *.spec.ts
- [ ] Co-located with source
- [ ] Using `target` for SUT
- [ ] Using `mock` prefix for mocks
- [ ] Using `DeepMocked<T>` type

Setup:
- [ ] Fresh mocks in beforeEach
- [ ] `.setLogger(new MockLoggerService())`
- [ ] `jest.clearAllMocks()` in afterEach

AAA Pattern:
- [ ] Arrange-Act-Assert structure
- [ ] Comments for each phase
- [ ] Single action per test

Assertions:
- [ ] Specific value assertions
- [ ] Mock call verification
- [ ] Mock call count verification
- [ ] No conditional assertions

Coverage:
- [ ] Happy path tests
- [ ] Edge case tests
- [ ] Error case tests
- [ ] Exception tests with type/message/code
- [ ] 80%+ coverage achieved
```
