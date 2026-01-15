# Writing E2E Test Workflow

## Objective

Write high-quality E2E tests following GWT pattern with proper isolation, assertions, and cleanup for TypeScript/NestJS applications.

---

## Mandatory Execution Rules

- **ALWAYS load knowledge references before writing any test**
- **ALWAYS follow GWT (Given-When-Then) pattern**
- **ALWAYS ensure test isolation (no shared state between tests)**
- **NEVER write tests with conditional assertions**
- **NEVER mock databases or message brokers in E2E tests**

---

## Pre-Workflow: Load Knowledge Base

**Mandatory Reading** - Load these references before writing any test:

1. **Rules**: `references/common/rules.md` - GWT pattern, timeout rules, isolation requirements
2. **Test Case Guide**: `references/common/test-case-creation-guide.md` - Templates for all scenarios
3. **Best Practices**: `references/common/best-practices.md` - Test design patterns

**Technology-Specific** - Load based on what the test covers:
- **Kafka tests**: `references/kafka/rules.md`, `references/kafka/isolation.md`, `references/kafka/examples.md`
- **PostgreSQL tests**: `references/postgres/rules.md`, `references/postgres/examples.md`
- **MongoDB tests**: `references/mongodb/rules.md`, `references/mongodb/examples.md`
- **Redis tests**: `references/redis/rules.md`, `references/redis/examples.md`
- **API tests**: `references/api/rules.md`, `references/api/examples.md`, `references/api/mocking.md`

---

## Workflow Steps

### Step 1: Understand Test Requirements

**Goal**: Clarify what behavior needs to be tested.

**Questions to Ask User**:
1. What feature/flow are you testing?
2. What is the expected behavior (happy path)?
3. What error cases should be covered?
4. What technologies are involved (DB, Kafka, external APIs)?

**Present to User**:
```
I understand you want to test: {feature}

Involved Technologies:
- {list technologies}

Test Cases to Write:
1. {happy path case}
2. {error case 1}
3. {error case 2}
...

Loading relevant references for {technologies}...

[C] Continue / [M] Modify test cases
```

---

### Step 2: Analyze Existing Code

**Goal**: Understand the implementation being tested.

**Actions**:
1. Read the source file(s) being tested
2. Identify:
   - Input parameters and validation rules
   - Database operations (what gets created/updated/deleted)
   - External API calls (what needs mocking)
   - Async operations (Kafka events, webhooks)
   - Error handling paths

**Present to User**:
```
Code Analysis:

**Endpoint/Function**: {name}
**Input Validation**: {rules}
**Database Operations**:
- Creates: {entities}
- Updates: {entities}
- Queries: {entities}

**Async Operations**:
- Publishes to: {topics}
- Consumes from: {topics}

**External Dependencies** (need mocking):
- {API 1}
- {API 2}

[C] Continue / [Q] Ask questions
```

---

### Step 3: Design Test Structure

**Goal**: Plan the test file structure following patterns from references.

**Actions**:
1. Design describe blocks based on feature organization
2. Plan test cases with descriptive names
3. Identify shared setup vs per-test setup
4. Determine cleanup requirements

**Test File Template**:
```typescript
describe('{Feature} E2E', () => {
  let app: INestApplication;
  let httpServer: any;
  // Technology-specific helpers

  beforeAll(async () => {
    // App initialization
    // Helper initialization (pre-subscription for Kafka)
  }, 90000);

  afterAll(async () => {
    // Cleanup connections
    // Close app
  }, 30000);

  beforeEach(async () => {
    // Wait for in-flight operations
    // Clear database/message buffers
  });

  describe('{Sub-feature}', () => {
    it('should {expected behavior}', async () => {
      // GIVEN: {setup}
      // WHEN: {action}
      // THEN: {assertions}
    });
  });
});
```

**Present to User**:
```
Proposed Test Structure:

{show structure}

Test Cases:
1. should {case 1} - Tests {scenario}
2. should {case 2} - Tests {scenario}
...

[C] Continue / [M] Modify
```

---

### Step 4: Write Test Setup (beforeAll/beforeEach)

**Goal**: Write proper test lifecycle hooks.

**Actions**:
1. Write `beforeAll`:
   - Create NestJS test module
   - Initialize app with proper config
   - Set up technology-specific helpers
   - For Kafka: Pre-subscribe to output topics

2. Write `beforeEach`:
   - Wait for in-flight operations (500-1000ms)
   - Clear database tables/collections
   - Clear message buffers

3. Write `afterAll`:
   - Disconnect helpers
   - Close app

**Reference Check**: Verify setup patterns against:
- `references/common/nestjs-setup.md`
- Technology-specific `test-helper.md` files

**Present to User**:
```
Test Setup Code:

{show beforeAll code}

{show beforeEach code}

{show afterAll code}

This follows patterns from:
- references/common/nestjs-setup.md
- references/{tech}/test-helper.md

[C] Continue / [M] Modify
```

---

### Step 5: Write Individual Test Cases

**Goal**: Write each test case following GWT pattern.

**For Each Test Case**:

1. **GIVEN Section** (Setup):
   - Create test data using factories
   - Seed database if needed
   - Configure mocks for external APIs
   - Use unique identifiers (timestamp + random)

2. **WHEN Section** (Action):
   - Execute EXACTLY ONE action
   - Capture response/result
   - For async: Trigger event and wait for result

3. **THEN Section** (Assertions):
   - Assert specific values, not just existence
   - Use `toMatchObject` for partial matching
   - Verify database state changes
   - Verify async side effects (Kafka messages)
   - Check NO side effects on error cases

**GWT Template**:
```typescript
it('should {expected behavior}', async () => {
  // GIVEN: {describe setup}
  const testData = createTestData({
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  await repository.save(testData);

  // WHEN: {describe action}
  const response = await request(httpServer)
    .post('/endpoint')
    .send(requestBody)
    .expect(201);

  // THEN: {describe expectations}
  expect(response.body).toMatchObject({
    code: 'SUCCESS',
    data: {
      id: expect.any(String),
      field: expectedValue,
    },
  });

  // Verify database state
  const saved = await repository.findOne({ where: { id: response.body.data.id } });
  expect(saved).toMatchObject({ field: expectedValue });
});
```

**Present to User**:
```
Test Case: should {description}

{show code}

This test verifies:
- {verification 1}
- {verification 2}

Pattern Reference: references/common/test-case-creation-guide.md

[C] Continue to next case / [M] Modify
```

---

### Step 6: Write Error Case Tests

**Goal**: Test error handling paths.

**Actions**:
1. Test validation errors (400)
2. Test not found errors (404)
3. Test authorization errors (401/403)
4. Test business logic errors
5. Verify NO side effects occur on error

**Error Test Template**:
```typescript
it('should return 400 when {invalid condition}', async () => {
  // GIVEN: Invalid input
  const invalidData = { field: 'invalid-value' };

  // WHEN: Attempting action
  const response = await request(httpServer)
    .post('/endpoint')
    .send(invalidData)
    .expect(400);

  // THEN: Validation error returned
  expect(response.body).toMatchObject({
    code: 'VALIDATION_ERROR',
    errors: expect.arrayContaining([
      expect.objectContaining({ field: 'field' }),
    ]),
  });

  // AND: No side effects
  const count = await repository.count();
  expect(count).toBe(0);
});
```

**Present to User**:
```
Error Case: should return {status} when {condition}

{show code}

Verifies:
- Correct error response
- No database changes
- No events published

[C] Continue / [M] Modify
```

---

### Step 7: Write Async Tests (If Applicable)

**Goal**: Test asynchronous operations (Kafka, webhooks).

**For Kafka Tests**:
1. Load `references/kafka/isolation.md` for pre-subscription pattern
2. Use smart polling instead of fixed waits
3. Verify message content with specific assertions

**Async Test Template**:
```typescript
it('should process event and produce output', async () => {
  // GIVEN: Valid event
  kafkaHelper.clearMessages(outputTopic);
  const event = createTestEvent({ id: `event-${Date.now()}` });

  // WHEN: Publishing event
  await kafkaHelper.publishEvent(inputTopic, event, event.id);

  // THEN: Output event published with correct data
  const messages = await kafkaHelper.waitForMessages(outputTopic, 1, 20000);
  expect(messages).toHaveLength(1);
  expect(messages[0].value).toMatchObject({
    id: event.id,
    status: 'PROCESSED',
  });

  // AND: Database updated
  const record = await repository.findOne({ where: { eventId: event.id } });
  expect(record).toMatchObject({ status: 'COMPLETED' });
});
```

**Present to User**:
```
Async Test: should {description}

{show code}

Pattern: Pre-subscription + smart polling (from references/kafka/isolation.md)

[C] Continue / [M] Modify
```

---

### Step 8: Final Review

**Goal**: Review complete test file against rules.

**Checklist**:
- [ ] All tests follow GWT pattern
- [ ] Each test has exactly ONE action in WHEN
- [ ] No conditional assertions
- [ ] Unique identifiers used (no hardcoded IDs)
- [ ] Database cleaned in beforeEach
- [ ] Specific assertions (not just `toBeDefined`)
- [ ] Error cases verify no side effects
- [ ] Timeouts appropriate for operations
- [ ] Async tests use polling, not fixed waits

**Present to User**:
```
Test File Review:

✅ {check 1}
✅ {check 2}
⚠️ {warning if any}

Complete test file:
{show final code}

[C] Confirm and save / [M] Modify
```

---

## Post-Workflow: Knowledge Review

After writing tests, recommend reviewing:
1. `references/common/examples.md` - Verify patterns match examples
2. Technology-specific `examples.md` - Compare with reference implementations
3. `references/common/debugging.md` - For when tests fail

---

## Success Criteria

- [ ] All test cases follow GWT pattern
- [ ] Test isolation verified (no shared state)
- [ ] Assertions are specific and meaningful
- [ ] Error cases cover validation, not found, and authorization
- [ ] Async tests use proper waiting strategies
- [ ] Code matches patterns from reference documentation

---

## Anti-Patterns to Avoid

Reference: `references/common/rules.md`

1. ❌ Multiple WHEN actions in one test
2. ❌ Conditional assertions (`if/else` in THEN)
3. ❌ Hardcoded test IDs
4. ❌ Mocking databases
5. ❌ Generic assertions (`toBeDefined`, `toBeTruthy`)
6. ❌ Fixed waits for async operations
7. ❌ Shared state between tests
8. ❌ fromBeginning: true for Kafka consumers
