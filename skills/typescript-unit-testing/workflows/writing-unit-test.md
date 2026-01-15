# Writing Unit Test Workflow

## Purpose

Guide the process of writing high-quality unit tests for NestJS/TypeScript components following established patterns and conventions.

---

## Pre-Workflow Knowledge Loading

Before writing any tests, load and review the following reference files:

1. **MANDATORY**: Read `references/common/rules.md` - AAA pattern, naming conventions, coverage requirements
2. **MANDATORY**: Read `references/common/assertions.md` - Assertion patterns and matchers
3. **Component-specific** (load based on target):
   - Services/Usecases: Read `references/nestjs/services.md`
   - Controllers: Read `references/nestjs/controllers.md`
   - Guards: Read `references/nestjs/guards.md`
   - Interceptors: Read `references/nestjs/interceptors.md`
   - Pipes/Filters: Read `references/nestjs/pipes-filters.md`
4. **Mocking** (load as needed):
   - Read `references/mocking/deep-mocked.md` - DeepMocked patterns
   - Read `references/mocking/jest-native.md` - Native Jest patterns
   - Read `references/mocking/factories.md` - Test data factories
5. **Infrastructure** (load if testing):
   - MongoDB repositories: Read `references/repository/mongodb.md`
   - PostgreSQL repositories: Read `references/repository/postgres.md`
   - Kafka handlers: Read `references/kafka/kafka.md`
   - Redis operations: Read `references/redis/redis.md`

---

## Execution Rules

- Always follow AAA (Arrange-Act-Assert) pattern
- Use `target` for system under test (SUT)
- Use `mock` prefix for all mock variables
- Use `DeepMocked<T>` type for all mocks
- Write explicit assertions, never just check existence
- Complete each step before proceeding

---

## Workflow Steps

### Step 1: Identify Target Component

**Actions:**

1. Identify the source file to test:
   - File path: `[path/to/component.ts]`
   - Component type: [Service | Controller | Guard | Interceptor | Pipe | Filter | Repository]

2. Read the source file completely to understand:
   - All public methods
   - Constructor dependencies
   - Exception handling
   - Business logic branches

3. List all dependencies that need mocking:
   ```
   **Dependencies to Mock:**
   - [DependencyName]: [DependencyType]
   - [DependencyName]: [DependencyType]
   ```

**Checkpoint:** Confirm understanding of component before writing tests.

---

### Step 2: Create Test File Structure

**Actions:**

1. Create spec file co-located with source:
   - Source: `src/path/to/component.ts`
   - Test: `src/path/to/component.spec.ts`

2. Set up test file skeleton:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { MockLoggerService } from 'src/shared/logger/services/mock-logger.service';
import { ComponentName } from './component-name';
// Import all dependencies

describe('ComponentName', () => {
  let target: ComponentName;
  // Declare all mocks with DeepMocked<T>

  beforeEach(async () => {
    // Create mocks with createMock<T>()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentName,
        // Provide all mocks
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ComponentName>(ComponentName);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test cases will be added here
});
```

**Checkpoint:** Test file structure created with proper imports and setup.

---

### Step 3: Plan Test Cases

**Actions:**

1. For each public method, identify required test cases:

   **Method: `[methodName]`**
   | Category | Test Case | Priority |
   |----------|-----------|----------|
   | Happy path | should [expected] when [valid input] | MANDATORY |
   | Edge case | should [expected] when [empty/null/boundary] | MANDATORY |
   | Error case | should throw [Exception] when [condition] | MANDATORY |
   | Business rule | should [expected] when [business condition] | MANDATORY |

2. Present test plan to user for confirmation

**Checkpoint:** User confirms test plan before implementation.

---

### Step 4: Implement Happy Path Tests

**Actions:**

1. Write happy path tests for each method:

```typescript
describe('methodName', () => {
  it('should return expected result when valid input provided', async () => {
    // Arrange
    const input = { /* valid input data */ };
    mockDependency.method.mockResolvedValue({ /* expected return */ });

    // Act
    const result = await target.methodName(input);

    // Assert
    expect(result).toEqual({ /* expected output */ });
    expect(mockDependency.method).toHaveBeenCalledWith(/* expected args */);
    expect(mockDependency.method).toHaveBeenCalledTimes(1);
  });
});
```

2. Verify assertions are specific, not just existence checks

**Checkpoint:** All happy path tests passing.

---

### Step 5: Implement Edge Case Tests

**Actions:**

1. Write edge case tests:

```typescript
it('should handle empty array when no items found', async () => {
  // Arrange
  mockRepository.findAll.mockResolvedValue([]);

  // Act
  const result = await target.getAllItems();

  // Assert
  expect(result).toEqual([]);
  expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
});

it('should handle null value when optional field missing', async () => {
  // Arrange
  const input = { requiredField: 'value', optionalField: null };
  mockService.process.mockResolvedValue({ processed: true });

  // Act
  const result = await target.process(input);

  // Assert
  expect(result.optionalField).toBeNull();
});
```

2. Cover boundary conditions:
   - Empty arrays/strings
   - Null/undefined values
   - Maximum/minimum values
   - Zero values

**Checkpoint:** All edge case tests passing.

---

### Step 6: Implement Error Case Tests

**Actions:**

1. Write exception tests:

```typescript
it('should throw NotFoundException when resource not found', async () => {
  // Arrange
  mockRepository.findById.mockResolvedValue(null);

  // Act & Assert
  await expect(target.getById('invalid-id')).rejects.toThrow(NotFoundException);
});

it('should throw BadRequestException with correct message when validation fails', async () => {
  // Arrange
  const invalidInput = { email: 'invalid-email' };

  // Act & Assert
  await expect(target.create(invalidInput)).rejects.toThrow(
    expect.objectContaining({
      message: expect.stringContaining('Invalid email'),
    })
  );
});

it('should throw exception with correct error code', async () => {
  // Arrange
  mockService.process.mockRejectedValue(new Error('External failure'));

  // Act & Assert
  await expect(target.execute()).rejects.toMatchObject({
    errorCode: 'EXTERNAL_SERVICE_ERROR',
  });
});
```

2. Verify exception type, message, and error code

**Checkpoint:** All error case tests passing.

---

### Step 7: Implement Business Rule Tests

**Actions:**

1. Write tests for domain logic:

```typescript
it('should apply discount when user is premium member', async () => {
  // Arrange
  const user = { id: 'user-1', isPremium: true };
  const order = { total: 100 };
  mockUserService.getUser.mockResolvedValue(user);

  // Act
  const result = await target.calculateTotal(order, user.id);

  // Assert
  expect(result.discount).toBe(10); // 10% premium discount
  expect(result.finalTotal).toBe(90);
});

it('should not apply discount when user is not premium member', async () => {
  // Arrange
  const user = { id: 'user-1', isPremium: false };
  const order = { total: 100 };
  mockUserService.getUser.mockResolvedValue(user);

  // Act
  const result = await target.calculateTotal(order, user.id);

  // Assert
  expect(result.discount).toBe(0);
  expect(result.finalTotal).toBe(100);
});
```

2. Test all business logic branches

**Checkpoint:** All business rule tests passing.

---

### Step 8: Verify Mock Interactions

**Actions:**

1. Ensure all mock calls are verified:

```typescript
// Verify exact parameters
expect(mockService.method).toHaveBeenCalledWith(
  expectedArg1,
  expectedArg2
);

// Verify call count
expect(mockService.method).toHaveBeenCalledTimes(1);

// Verify NOT called when appropriate
expect(mockService.method).not.toHaveBeenCalled();

// Verify call order when relevant
expect(mockService.methodA).toHaveBeenCalledBefore(mockService.methodB);
```

**Checkpoint:** All mock interactions verified.

---

## Post-Workflow Verification

After completing all tests:

1. **Re-read** `references/common/rules.md` to verify compliance
2. Run all tests: `npm test -- [path/to/component.spec.ts]`
3. Check coverage: `npm run test:cov -- [path/to/component.spec.ts]`
4. Verify 80%+ coverage on the component

---

## Completion Checklist

Present final checklist to user:

```
**Unit Tests Written for [ComponentName]:**

Setup:
- [ ] Using `target` for SUT
- [ ] Using `mock` prefix for all mocks
- [ ] Using `DeepMocked<T>` type
- [ ] Including `.setLogger(new MockLoggerService())`
- [ ] Following AAA pattern with comments
- [ ] Resetting mocks in `afterEach`

Coverage:
- [ ] Happy path tests for all public methods
- [ ] Edge case tests (empty, null, boundaries)
- [ ] Error case tests (not found, validation)
- [ ] Exception type and error code verification
- [ ] Business rule tests (domain logic)
- [ ] Mock call verification (parameters + count)

Quality:
- [ ] 80%+ coverage achieved
- [ ] Specific assertions (not just existence)
- [ ] No conditional assertions
- [ ] Tests fail when any field differs
```

---

## Anti-Patterns to Avoid

| Don't | Why | Do Instead |
|-------|-----|------------|
| `expect(result).toBeDefined()` | Doesn't catch wrong values | Assert specific values |
| `if (result) expect(...)` | Non-deterministic | Separate test cases |
| Test private methods | Couples to implementation | Test via public interface |
| Share state between tests | Causes flaky tests | Fresh setup in beforeEach |
| Skip mock verification | Doesn't validate behavior | Verify all mock calls |
