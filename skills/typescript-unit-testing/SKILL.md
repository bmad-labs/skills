---
name: typescript-unit-testing
description: |
  Comprehensive unit testing skill for TypeScript/NestJS projects using Jest, @golevelup/ts-jest, and in-memory databases.

  Use this skill when:
  - Writing unit tests for NestJS services, usecases, controllers, guards, interceptors, pipes, or filters
  - Setting up mocks with DeepMocked and createMock from golevelup/ts-jest
  - Testing repository implementations with mongodb-memory-server or pg-mem
  - Testing NestJS Kafka with ClientKafka, @MessagePattern, and @EventPattern
  - Testing Redis cache operations, health checks, and graceful degradation
  - Following AAA (Arrange-Act-Assert) pattern with proper assertions
  - Validating exception handling, error codes, and edge cases
  - Optimizing test performance and coverage

  Keywords: unit test, jest, typescript, nestjs, mocking, DeepMocked, createMock, AAA pattern, mongodb-memory-server, pg-mem, kafka, ClientKafka, MessagePattern, EventPattern, redis, cache, test coverage, TDD
---

# Unit Testing Skill

Unit testing validates individual functions, methods, and classes in isolation by mocking all external dependencies.

## Knowledge Base Structure

```
references/
├── common/              # Core testing fundamentals
│   ├── knowledge.md     # Testing philosophy and test pyramid
│   ├── rules.md         # Mandatory testing rules (AAA, naming, coverage)
│   ├── assertions.md    # Assertion patterns and matchers
│   └── examples.md      # Comprehensive examples by category
│
├── nestjs/              # NestJS component testing
│   ├── services.md      # Service/usecase testing patterns
│   ├── controllers.md   # Controller testing patterns
│   ├── guards.md        # Guard testing patterns
│   ├── interceptors.md  # Interceptor testing patterns
│   └── pipes-filters.md # Pipe and filter testing
│
├── mocking/             # Mock patterns and strategies
│   ├── deep-mocked.md   # @golevelup/ts-jest patterns
│   ├── jest-native.md   # Jest.fn, spyOn, mock patterns
│   └── factories.md     # Test data factory patterns
│
├── repository/          # Repository testing
│   ├── mongodb.md       # mongodb-memory-server patterns
│   └── postgres.md      # pg-mem patterns
│
├── kafka/               # NestJS Kafka microservices testing
│   └── kafka.md         # ClientKafka, @MessagePattern, @EventPattern handlers
│
└── redis/               # Redis cache testing
    └── redis.md         # Cache operations, health checks, graceful degradation
```

## Quick Reference by Task

### Write Unit Tests
1. **MANDATORY**: Read `references/common/rules.md` - AAA pattern, naming, coverage
2. Read `references/common/assertions.md` - Assertion best practices
3. Read component-specific files:
   - **Services**: `references/nestjs/services.md`
   - **Controllers**: `references/nestjs/controllers.md`
   - **Guards**: `references/nestjs/guards.md`
   - **Interceptors**: `references/nestjs/interceptors.md`
   - **Pipes/Filters**: `references/nestjs/pipes-filters.md`

### Setup Mocking
1. Read `references/mocking/deep-mocked.md` - DeepMocked patterns
2. Read `references/mocking/jest-native.md` - Native Jest patterns
3. Read `references/mocking/factories.md` - Test data factories

### Test Repositories
1. **MongoDB**: `references/repository/mongodb.md`
2. **PostgreSQL**: `references/repository/postgres.md`

### Test Kafka (NestJS Microservices)
- Read `references/kafka/kafka.md` - ClientKafka mocking, @MessagePattern/@EventPattern handlers, emit/send testing

### Test Redis
- Read `references/redis/redis.md` - Cache operations, health checks, graceful degradation

### Examples
- Read `references/common/examples.md` for comprehensive patterns

---

## Core Principles

### 1. AAA Pattern (Mandatory)
ALL unit tests MUST follow Arrange-Act-Assert:
```typescript
it('should return user when found', async () => {
  // Arrange
  const userId = 'user-123';
  mockRepository.findById.mockResolvedValue({
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
  });

  // Act
  const result = await target.getUser(userId);

  // Assert
  expect(result).toEqual({
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
  });
  expect(mockRepository.findById).toHaveBeenCalledWith(userId);
});
```

### 2. Use `target` for SUT
Always name the system under test as `target`:
```typescript
let target: UserService;
let mockRepository: DeepMocked<UserRepository>;
```

### 3. DeepMocked Pattern
Use `@golevelup/ts-jest` for type-safe mocks:
```typescript
import { createMock, DeepMocked } from '@golevelup/ts-jest';

let mockService: DeepMocked<UserService>;

beforeEach(() => {
  mockService = createMock<UserService>();
});
```

### 4. Specific Assertions
Assert exact values, not just existence:
```typescript
// WRONG
expect(result).toBeDefined();
expect(result.id).toBeDefined();

// CORRECT
expect(result).toEqual({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
});
```

### 5. Mock All Dependencies
Mock external services, never real databases for unit tests:
```typescript
// Unit Test: Mock repository
{ provide: UserRepository, useValue: mockRepository }

// Repository Test: Use in-memory database
const mongoServer = await createMongoMemoryServer();
```

---

## Standard Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { MockLoggerService } from 'src/shared/logger/services/mock-logger.service';

describe('UserService', () => {
  let target: UserService;
  let mockRepository: DeepMocked<UserRepository>;

  beforeEach(async () => {
    // Arrange: Create mocks
    mockRepository = createMock<UserRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockRepository },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      // Act
      const result = await target.getUser('user-123');

      // Assert
      expect(result).toEqual({ id: 'user-123', email: 'test@example.com' });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(target.getUser('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## Test Coverage Requirements

| Category | Priority | Description |
|----------|----------|-------------|
| Happy path | MANDATORY | Valid inputs producing expected outputs |
| Edge cases | MANDATORY | Empty arrays, null values, boundaries |
| Error cases | MANDATORY | Not found, validation failures |
| Exception behavior | MANDATORY | Correct type, error code, message |
| Business rules | MANDATORY | Domain logic, calculations |
| Input validation | MANDATORY | Invalid inputs, type mismatches |

**Coverage Target:** 80%+ for new code

---

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

### Variable Names
| Variable | Convention |
|----------|------------|
| SUT | `target` |
| Mocks | `mock` prefix (`mockRepository`, `mockService`) |
| Mock Type | `DeepMocked<T>` |

---

## Anti-Patterns to Avoid

| Don't | Why | Do Instead |
|-------|-----|------------|
| Assert only existence | Doesn't catch wrong values | Assert specific values |
| Conditional assertions | Non-deterministic | Separate test cases |
| Test private methods | Couples to implementation | Test via public interface |
| Share state between tests | Causes flaky tests | Fresh setup in beforeEach |
| Mock repositories in services | Tests implementation | Mock interfaces |
| Skip mock verification | Doesn't validate behavior | Verify mock calls |

---

## Checklist

**Setup:**
- [ ] Use `target` for system under test
- [ ] Use `mock` prefix for all mocks
- [ ] Use `DeepMocked<T>` type
- [ ] Include `.setLogger(new MockLoggerService())`
- [ ] Follow AAA pattern with comments
- [ ] Reset mocks in `afterEach`

**Coverage:**
- [ ] Happy path tests for all public methods
- [ ] Edge case tests (empty, null, boundaries)
- [ ] Error case tests (not found, validation failures)
- [ ] Exception type and error code verification
- [ ] Mock call verification (parameters + count)

**Quality:**
- [ ] 80%+ coverage on new code
- [ ] No assertions on log calls
- [ ] No test interdependence
- [ ] Tests fail when any field differs
