# Unit Testing Rules

## Core Rules

| Rule | Requirement |
|------|-------------|
| Variable for SUT | Use `target` (MANDATORY) |
| Mock prefix | `mockServiceName` |
| Mock type | `DeepMocked<T>` |
| Pattern | Arrange-Act-Assert with comments |
| Coverage | 80%+ for new code |
| Logger | `.setLogger(new MockLoggerService())` |

## AAA Pattern (Mandatory)

ALL unit tests MUST follow Arrange-Act-Assert:

```typescript
it('should return user when found', async () => {
  // Arrange
  const userId = 'user-123';
  mockRepository.findById.mockResolvedValue({
    id: userId,
    email: 'test@example.com',
  });

  // Act
  const result = await target.getUser(userId);

  // Assert
  expect(result).toEqual({ id: userId, email: 'test@example.com' });
  expect(mockRepository.findById).toHaveBeenCalledWith(userId);
});
```

### Formatting Guidelines

| Test Length | Format |
|-------------|--------|
| <= 3 lines | No blank lines needed |
| > 3 lines | Blank line between phases |
| Complex phases | Comment labels for each phase |

## Naming Conventions

### Test Files
- Pattern: `*.spec.ts`
- Location: Co-located with source file

### Test Structure
```typescript
describe('ClassName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {});
  });
});
```

### Test Naming Pattern
`should [verb] [expected] when [condition]`

```typescript
describe('UserService', () => {
  describe('findById', () => {
    it('should return user when user exists', async () => {...});
    it('should return null when user not found', async () => {...});
    it('should throw NotFoundException when id is invalid', async () => {...});
  });
});
```

## Variable Naming

| Variable | Convention | Example |
|----------|------------|---------|
| SUT | `target` | `let target: UserService;` |
| Mocks | `mock` prefix | `let mockRepository: DeepMocked<UserRepository>;` |
| Mock Type | `DeepMocked<T>` | `DeepMocked<UserRepository>` |
| Test Module | `module` | `let module: TestingModule;` |

## Setup Requirements

```typescript
beforeEach(async () => {
  // 1. Create mocks
  mockRepository = createMock<UserRepository>();

  // 2. Create testing module
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UserService,
      { provide: UserRepository, useValue: mockRepository },
    ],
  })
    .setLogger(new MockLoggerService())  // REQUIRED
    .compile();

  // 3. Get target
  target = module.get<UserService>(UserService);
});

afterEach(() => {
  jest.clearAllMocks();  // REQUIRED
});
```

## Test Isolation Rules

1. **Fresh mocks per test**: Create mocks in `beforeEach`
2. **Clear mocks after**: Use `jest.clearAllMocks()` in `afterEach`
3. **No shared state**: Never share mutable state between tests
4. **Deterministic results**: Tests must produce same results on every run

## Coverage Requirements

| Category | Priority | Must Test |
|----------|----------|-----------|
| Happy path | MANDATORY | All public methods |
| Edge cases | MANDATORY | Empty, null, boundaries |
| Error cases | MANDATORY | Not found, validation |
| Exceptions | MANDATORY | Type, code, message |
| Business rules | MANDATORY | Domain logic |

**Coverage Target:** 80%+ for new code

## Mock Rules

### Always verify mock calls:
```typescript
expect(mockRepository.save).toHaveBeenCalledWith({
  email: 'test@example.com',
  name: 'John',
});
expect(mockRepository.save).toHaveBeenCalledTimes(1);
```

### Never mock internal implementation:
```typescript
// BAD - Mocking internal mapper
expect(mockMapper.toEntity).toHaveBeenCalled();

// GOOD - Verify behavior
expect(result).toEqual(expectedUser);
expect(mockRepository.save).toHaveBeenCalledWith(
  expect.objectContaining({ email: input.email })
);
```

## Checklist

**Setup:**
- [ ] Use `target` for system under test
- [ ] Use `mock` prefix for all mocks
- [ ] Use `DeepMocked<T>` type
- [ ] Include `.setLogger(new MockLoggerService())`
- [ ] Follow AAA pattern with comments
- [ ] Direct mock methods, not `jest.spyOn()`
- [ ] Reset mocks in `afterEach`

**Test Coverage (MANDATORY):**
- [ ] Happy path tests for all public methods
- [ ] Edge case tests (empty inputs, null values, boundaries)
- [ ] Error case tests (not found, validation failures)
- [ ] Exception behavior tests (correct type, error code, message)
- [ ] Business rule tests (domain logic, calculations)

**Assertions:**
- [ ] Assert specific values, not just types or existence
- [ ] Validate ALL result properties with expected values
- [ ] Verify mock functions called with correct parameters
- [ ] Check mock call counts (`.toHaveBeenCalledTimes()`)
- [ ] No conditional assertions (no `if` statements)
- [ ] Tests fail when any field differs from expectations
