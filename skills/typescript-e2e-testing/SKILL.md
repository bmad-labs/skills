---
name: typescript-e2e-testing
description: |
  Comprehensive E2E testing skill for TypeScript/NestJS projects. Provides setup, writing, running, and debugging capabilities for end-to-end tests with real infrastructure.

  Use this skill when:
  - Setting up E2E test structure with Jest for a TypeScript/NestJS project
  - Writing E2E test cases following GWT (Given-When-Then) pattern
  - Configuring infrastructure (Kafka, PostgreSQL, MongoDB, Redis) via docker-compose
  - Running and debugging E2E tests
  - Troubleshooting flaky or failing E2E tests
  - Testing REST APIs, GraphQL, gRPC endpoints
  - Mocking external APIs with MSW or nock
  - Optimizing E2E test performance

  Keywords: e2e, end-to-end, integration test, Jest, supertest, NestJS, Kafka, PostgreSQL, MongoDB, Redis, docker-compose, GWT pattern
---

# E2E Testing Skill

E2E testing validates complete workflows from user perspective, using real infrastructure via Docker.

---

## Workflows

For comprehensive step-by-step guidance, use the appropriate workflow:

| Workflow | When to Use |
|----------|-------------|
| [Setup E2E Test](workflows/setup-e2e-test.md) | Setting up E2E infrastructure for a new or existing project |
| [Writing E2E Test](workflows/writing-e2e-test.md) | Creating new E2E test cases with proper GWT pattern |
| [Review E2E Test](workflows/review-e2e-test.md) | Reviewing existing tests for quality and correctness |
| [Running E2E Test](workflows/running-e2e-test.md) | Executing tests with proper verification |
| [Debugging E2E Test](workflows/debugging-e2e-test.md) | Systematically fixing failing tests |
| [Optimize E2E Test](workflows/optimize-e2e-test.md) | Improving test suite performance |

**Important**: Each workflow includes instructions to load relevant knowledge from the `references/` folder before and after completing tasks.

---

## Knowledge Base Structure

```
references/
├── common/              # Shared testing fundamentals
│   ├── knowledge.md     # Core E2E concepts and test pyramid
│   ├── rules.md         # Mandatory testing rules (GWT, timeouts, logging)
│   ├── best-practices.md # Test design and cleanup patterns
│   ├── test-case-creation-guide.md # GWT templates for all scenarios
│   ├── nestjs-setup.md  # NestJS app bootstrap and Jest config
│   ├── debugging.md     # VS Code config and log analysis
│   └── examples.md      # Comprehensive examples by category
│
├── kafka/               # Kafka-specific testing
│   ├── knowledge.md     # Why common approaches fail, architecture
│   ├── rules.md         # Kafka-specific testing rules
│   ├── test-helper.md   # KafkaTestHelper implementation
│   ├── docker-setup.md  # Redpanda/Kafka Docker configs
│   ├── performance.md   # Optimization techniques
│   ├── isolation.md     # Pre-subscription pattern details
│   └── examples.md      # Kafka test examples
│
├── postgres/            # PostgreSQL-specific testing
│   ├── knowledge.md     # PostgreSQL testing concepts
│   ├── rules.md         # Cleanup, transaction, assertion rules
│   ├── test-helper.md   # PostgresTestHelper implementation
│   └── examples.md      # CRUD, transaction, constraint examples
│
├── mongodb/             # MongoDB-specific testing
│   ├── knowledge.md     # MongoDB testing concepts
│   ├── rules.md         # Document cleanup and assertion rules
│   ├── test-helper.md   # MongoDbTestHelper implementation
│   ├── docker-setup.md  # Docker and Memory Server setup
│   └── examples.md      # Document and aggregation examples
│
├── redis/               # Redis-specific testing
│   ├── knowledge.md     # Redis testing concepts
│   ├── rules.md         # TTL and pub/sub rules
│   ├── test-helper.md   # RedisTestHelper implementation
│   ├── docker-setup.md  # Docker configuration
│   └── examples.md      # Cache, session, rate limit examples
│
└── api/                 # API testing (REST, GraphQL, gRPC)
    ├── knowledge.md     # API testing concepts
    ├── rules.md         # Request/response assertion rules
    ├── test-helper.md   # Auth and Supertest helpers
    ├── examples.md      # REST, GraphQL, validation examples
    └── mocking.md       # MSW and Nock external API mocking
```

## Quick Reference by Task

> **Tip**: For detailed step-by-step guidance, use the [Workflows](#workflows) section above.

### Setup New E2E Structure
**Workflow**: [Setup E2E Test](workflows/setup-e2e-test.md)
1. Read `references/common/knowledge.md` - Understand E2E fundamentals
2. Read `references/common/nestjs-setup.md` - Project setup
3. Read technology-specific `docker-setup.md` files as needed

### Write Test Cases
**Workflow**: [Writing E2E Test](workflows/writing-e2e-test.md)
1. **MANDATORY**: Read `references/common/rules.md` - GWT pattern, timeouts
2. Read `references/common/test-case-creation-guide.md` - Templates
3. Read technology-specific files:
   - **Kafka**: `references/kafka/knowledge.md` → `test-helper.md` → `isolation.md`
   - **PostgreSQL**: `references/postgres/rules.md` → `test-helper.md`
   - **MongoDB**: `references/mongodb/rules.md` → `test-helper.md`
   - **Redis**: `references/redis/rules.md` → `test-helper.md`
   - **API**: `references/api/rules.md` → `test-helper.md`

### Review Test Quality
**Workflow**: [Review E2E Test](workflows/review-e2e-test.md)
1. Read `references/common/rules.md` - Check against mandatory patterns
2. Read `references/common/best-practices.md` - Quality standards
3. Read technology-specific `rules.md` files

### Run E2E Tests
**Workflow**: [Running E2E Test](workflows/running-e2e-test.md)
1. Verify Docker infrastructure is running
2. Run tests sequentially with `npm run test:e2e`
3. Follow failure protocol if tests fail

### Debug Failing Tests
**Workflow**: [Debugging E2E Test](workflows/debugging-e2e-test.md)
1. Read `references/common/debugging.md`
2. Create `_e2e-failures.md` tracking file
3. Fix ONE test at a time

### Optimize Test Performance
**Workflow**: [Optimize E2E Test](workflows/optimize-e2e-test.md)
1. Read `references/common/best-practices.md` - Performance patterns
2. Read `references/kafka/performance.md` for Kafka tests
3. Measure baseline before making changes

### Examples
- Read `references/common/examples.md` for general patterns
- Read technology-specific `examples.md` for detailed scenarios

---

## Core Principles

### 1. Real Infrastructure
Test against actual services via Docker. Never mock databases or message brokers for E2E tests.

### 2. GWT Pattern (Mandatory)
ALL E2E tests MUST follow Given-When-Then:
```typescript
it('should create user and return 201', async () => {
  // GIVEN: Valid user data
  const userData = { email: 'test@example.com', name: 'Test' };

  // WHEN: Creating user
  const response = await request(httpServer)
    .post('/users')
    .send(userData)
    .expect(201);

  // THEN: User created with correct data
  expect(response.body.data.email).toBe('test@example.com');
});
```

### 3. Test Isolation
Each test MUST be independent:
- Clean database state in `beforeEach`
- Use unique identifiers (consumer groups, topics)
- Wait for async operations to complete

### 4. Specific Assertions
Assert exact values, not just existence:
```typescript
// WRONG
expect(response.body.data).toBeDefined();

// CORRECT
expect(response.body).toMatchObject({
  code: 'SUCCESS',
  data: { email: 'test@example.com', name: 'Test' }
});
```

---

## Project Structure

```
project-root/
├── src/
├── test/
│   ├── e2e/
│   │   ├── feature.e2e-spec.ts
│   │   ├── setup.ts
│   │   └── helpers/
│   │       ├── test-app.helper.ts
│   │       ├── postgres.helper.ts
│   │       ├── mongodb.helper.ts
│   │       ├── redis.helper.ts
│   │       └── kafka.helper.ts
│   └── jest-e2e.config.ts
├── docker-compose.e2e.yml
├── .env.e2e
└── package.json
```

---

## Essential Jest Configuration

```typescript
// test/jest-e2e.config.ts
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e-spec.ts'],
  testTimeout: 25000,
  maxWorkers: 1,           // CRITICAL: Sequential execution
  clearMocks: true,
  forceExit: true,
  detectOpenHandles: true,
};
```

---

## Technology-Specific Timeouts

| Technology | Wait Time | Strategy |
|------------|-----------|----------|
| Kafka | 10-20s max (polling) | Smart polling with 50ms intervals |
| PostgreSQL | <1s | Direct queries |
| MongoDB | <1s | Direct queries |
| Redis | <100ms | In-memory operations |
| External API | 1-5s | Network latency |

---

## Failure Resolution Protocol

When E2E tests fail:

1. **Create tracking file**: `_e2e-failures.md`
2. **Fix ONE test at a time**
3. **Run individual test**: `npm run test:e2e -- -t "test name"`
4. **Verify fix**: Run same test 3-5 times
5. **Update tracking file**: Mark as FIXED
6. **Repeat** for next failing test
7. **Run full suite** only after all individual tests pass
8. **Delete tracking file**

---

## Common Patterns

### Database Cleanup (PostgreSQL/MongoDB)
```typescript
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 500)); // Wait for in-flight
  await repository.clear();  // PostgreSQL
  // OR
  await model.deleteMany({}); // MongoDB
});
```

### Kafka Test Helper Pattern
```typescript
// Use pre-subscription + buffer clearing (NOT fromBeginning: true)
const kafkaHelper = new KafkaTestHelper();
await kafkaHelper.subscribeToTopic(outputTopic, false);
// In beforeEach: kafkaHelper.clearMessages(outputTopic);
```

### Redis Cleanup
```typescript
beforeEach(async () => {
  await redis.flushdb();
});
```

### External API Mock (MSW)
```typescript
mockServer.use(
  http.post('https://api.external.com/endpoint', () => {
    return HttpResponse.json({ status: 'success' });
  })
);
```

### Async Event Verification (Kafka)
```typescript
// Use smart polling instead of fixed waits
await kafkaHelper.publishEvent(inputTopic, event, event.id);
const messages = await kafkaHelper.waitForMessages(outputTopic, 1, 20000);
expect(messages[0].value).toMatchObject({ id: event.id });
```

---

## Debugging Commands

```bash
# Run specific test
npm run test:e2e -- -t "should create user"

# Run specific file
npm run test:e2e -- test/e2e/user.e2e-spec.ts

# Debug with breakpoints
node --inspect-brk node_modules/.bin/jest --config test/jest-e2e.config.ts --runInBand

# View logs
tail -f logs/e2e-test.log
grep -i error logs/e2e-test.log
```

---

## Anti-Patterns to Avoid

1. **Multiple WHEN actions** - Split into separate tests
2. **Conditional assertions** - Create deterministic test cases
3. **Shared state between tests** - Clean in beforeEach
4. **Mocking databases** - Use real connections
5. **Skipping cleanup** - Always clean before AND after
6. **Fixing multiple tests at once** - Fix one at a time
7. **Generic assertions** - Assert specific values
8. **fromBeginning: true for Kafka** - Use pre-subscription + buffer clearing
