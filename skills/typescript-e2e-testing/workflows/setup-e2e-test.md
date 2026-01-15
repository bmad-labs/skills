# Setup E2E Test Workflow

## Objective

Set up a complete E2E testing infrastructure for a TypeScript/NestJS project with all necessary configuration, helpers, and Docker infrastructure.

---

## Mandatory Execution Rules

- **NEVER proceed without understanding project context first**
- **ALWAYS load and review knowledge references before taking action**
- **ALWAYS ask user for confirmation before creating files**
- **ALWAYS verify Docker and dependencies are available**

---

## Pre-Workflow: Load Knowledge Base

Before starting any setup tasks, load and review these references:

1. **Core Knowledge**: `references/common/knowledge.md` - Understand E2E fundamentals and test pyramid
2. **NestJS Setup**: `references/common/nestjs-setup.md` - Project structure and Jest configuration
3. **Rules**: `references/common/rules.md` - Mandatory patterns (GWT, timeouts, isolation)

Then identify which technology-specific references to load based on project needs:
- **Kafka**: `references/kafka/docker-setup.md`, `references/kafka/knowledge.md`
- **PostgreSQL**: `references/postgres/knowledge.md`, `references/postgres/docker-setup.md` (if exists)
- **MongoDB**: `references/mongodb/docker-setup.md`, `references/mongodb/knowledge.md`
- **Redis**: `references/redis/docker-setup.md`, `references/redis/knowledge.md`
- **API**: `references/api/knowledge.md`

---

## Workflow Steps

### Step 1: Project Analysis

**Goal**: Understand the existing project structure and testing requirements.

**Actions**:
1. Analyze `package.json` for:
   - Existing test frameworks (Jest, Vitest, etc.)
   - Database drivers (pg, mongoose, ioredis, kafkajs, etc.)
   - NestJS version and dependencies
2. Check for existing test configuration:
   - `jest.config.ts` or `jest.config.js`
   - `test/` directory structure
   - Existing E2E tests
3. Identify infrastructure dependencies from source code:
   - Database connections (TypeORM, Mongoose, Prisma)
   - Message brokers (Kafka, RabbitMQ)
   - Cache systems (Redis)
   - External APIs

**Present to User**:
```
I've analyzed your project:

**Framework**: NestJS v{version}
**Existing Tests**: {yes/no}
**Infrastructure Detected**:
- Database: {PostgreSQL/MongoDB/None}
- Message Broker: {Kafka/None}
- Cache: {Redis/None}
- External APIs: {list or None}

**Recommended Setup**:
- [ ] Jest E2E configuration
- [ ] Docker Compose for {services}
- [ ] Test helpers for {technologies}

Shall I proceed with this setup? [C] Continue / [M] Modify
```

---

### Step 2: Create Directory Structure

**Goal**: Set up the E2E test directory structure.

**Actions**:
1. Create the following structure:
```
test/
├── e2e/
│   ├── setup.ts           # Global test setup
│   └── helpers/           # Test utilities
│       ├── test-app.helper.ts
│       └── {technology}.helper.ts
└── jest-e2e.config.ts     # E2E Jest configuration
```

2. Present the structure to user for confirmation before creating.

**Present to User**:
```
I'll create this directory structure:

{show tree structure}

[C] Continue / [S] Skip (keep existing) / [M] Modify
```

---

### Step 3: Configure Jest for E2E

**Goal**: Create or update Jest E2E configuration.

**Actions**:
1. Create `test/jest-e2e.config.ts` with:
   - `preset: 'ts-jest'`
   - `testEnvironment: 'node'`
   - `testMatch: ['**/*.e2e-spec.ts']`
   - `testTimeout: 25000`
   - `maxWorkers: 1` (CRITICAL for E2E isolation)
   - `setupFilesAfterEnv` if needed
   - `forceExit: true`
   - `detectOpenHandles: true`

2. Update `package.json` scripts:
   - `"test:e2e": "jest --config test/jest-e2e.config.ts"`

**Present to User**:
```
Jest E2E Configuration:

{show configuration}

[C] Continue / [M] Modify
```

---

### Step 4: Create Docker Compose

**Goal**: Set up Docker infrastructure for E2E tests.

**Actions**:
1. Based on detected technologies, create `docker-compose.e2e.yml`:
   - PostgreSQL: Port 5433 (non-conflicting)
   - MongoDB: Port 27018 (non-conflicting)
   - Redis: Port 6380 (non-conflicting)
   - Kafka/Redpanda: Ports 9093/19093

2. Create `.env.e2e` with test-specific environment variables.

3. Add npm script: `"docker:e2e": "docker-compose -f docker-compose.e2e.yml up -d"`

**Load Reference**: For each technology, load the corresponding `docker-setup.md` from references.

**Present to User**:
```
Docker Compose Configuration:

{show docker-compose.e2e.yml}

Environment Variables (.env.e2e):
{show variables}

[C] Continue / [M] Modify
```

---

### Step 5: Create Test Helpers

**Goal**: Create reusable test helper classes.

**Actions**:
1. Create `test/e2e/helpers/test-app.helper.ts`:
   - NestJS app bootstrap
   - HTTP server access
   - Cleanup utilities

2. For each detected technology, create helpers:
   - Load `references/{technology}/test-helper.md`
   - Create `{technology}.helper.ts` based on reference

**Present to User**:
```
Test Helpers to Create:

1. test-app.helper.ts - NestJS app bootstrap
{show code preview}

2. {technology}.helper.ts
{show code preview}

[C] Continue / [M] Modify
```

---

### Step 6: Create Global Setup

**Goal**: Create the global E2E test setup file.

**Actions**:
1. Create `test/e2e/setup.ts`:
   - Environment variable loading
   - Test timeout configuration
   - Global beforeAll/afterAll hooks

**Present to User**:
```
Global Setup (test/e2e/setup.ts):

{show code}

[C] Continue / [M] Modify
```

---

### Step 7: Create Example Test

**Goal**: Create a sample E2E test file demonstrating patterns.

**Actions**:
1. Create `test/e2e/example.e2e-spec.ts`:
   - Proper GWT pattern
   - beforeAll/beforeEach/afterAll lifecycle
   - Helper usage examples
   - Cleanup patterns

**Present to User**:
```
Example E2E Test:

{show code}

This demonstrates:
- GWT pattern usage
- Test isolation
- Helper integration
- Proper cleanup

[C] Continue / [S] Skip
```

---

### Step 8: Verification

**Goal**: Verify the setup works correctly.

**Actions**:
1. Start Docker infrastructure:
   ```bash
   npm run docker:e2e
   ```
2. Wait for services to be healthy
3. Run example test:
   ```bash
   npm run test:e2e -- test/e2e/example.e2e-spec.ts
   ```
4. Report results

**Present to User**:
```
Setup Verification:

✅ Docker services started
✅ Database connection successful
✅ Example test passed

Your E2E testing infrastructure is ready!

Next steps:
1. Review references/common/rules.md for mandatory patterns
2. Use references/common/test-case-creation-guide.md for writing tests
3. Check technology-specific examples in references/{tech}/examples.md
```

---

## Post-Workflow: Knowledge Review

After completing setup, recommend the user review:
1. `references/common/rules.md` - Mandatory patterns they must follow
2. `references/common/best-practices.md` - Test design guidelines
3. Technology-specific `rules.md` files for their stack

---

## Success Criteria

- [ ] Jest E2E configuration created and valid
- [ ] Docker Compose with all required services
- [ ] Test helpers for each technology
- [ ] Global setup file configured
- [ ] Example test passes
- [ ] User understands where to find reference documentation

---

## Failure Recovery

If any step fails:
1. Report the specific error
2. Reference relevant documentation from `references/`
3. Offer manual troubleshooting steps
4. Ask user if they want to retry or skip
