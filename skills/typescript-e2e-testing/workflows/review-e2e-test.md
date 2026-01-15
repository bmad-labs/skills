# Review E2E Test Workflow

## Objective

Review existing E2E tests for quality, correctness, and adherence to best practices. Identify issues and provide actionable improvements.

---

## Mandatory Execution Rules

- **ALWAYS load knowledge references before reviewing**
- **ALWAYS check against mandatory rules from references/common/rules.md**
- **ALWAYS provide specific, actionable feedback**
- **NEVER approve tests with anti-patterns**

---

## Pre-Workflow: Load Knowledge Base

**Mandatory Reading** - Load these references before reviewing:

1. **Rules**: `references/common/rules.md` - Mandatory patterns to enforce
2. **Best Practices**: `references/common/best-practices.md` - Quality standards
3. **Examples**: `references/common/examples.md` - Reference implementations

**Technology-Specific** - Load based on technologies in test:
- **Kafka tests**: `references/kafka/rules.md`, `references/kafka/isolation.md`
- **PostgreSQL tests**: `references/postgres/rules.md`
- **MongoDB tests**: `references/mongodb/rules.md`
- **Redis tests**: `references/redis/rules.md`
- **API tests**: `references/api/rules.md`

---

## Workflow Steps

### Step 1: Identify Tests to Review

**Goal**: Determine scope of review.

**Actions**:
1. Ask user for:
   - Specific test file(s) to review
   - Or review all E2E tests
2. List test files to be reviewed

**Present to User**:
```
Tests to Review:

1. {file1.e2e-spec.ts} - {number} test cases
2. {file2.e2e-spec.ts} - {number} test cases
...

Total: {n} test files, {m} test cases

[C] Continue with review / [M] Modify scope
```

---

### Step 2: Review Test Structure

**Goal**: Verify test file organization and lifecycle hooks.

**Checklist**:
- [ ] Test file uses `.e2e-spec.ts` suffix
- [ ] Proper describe block organization
- [ ] beforeAll: App initialization, helper setup
- [ ] beforeEach: Cleanup and isolation
- [ ] afterAll: Proper teardown
- [ ] Appropriate timeouts set

**Issues to Flag**:
```typescript
// ❌ Missing sequential execution
// Fix: maxWorkers: 1 in jest config

// ❌ Missing cleanup in beforeEach
beforeEach(async () => {
  // Must clean database
  await repository.clear();
});

// ❌ Missing timeout on long operations
beforeAll(async () => {
  // Add timeout
}, 90000);

// ❌ Not closing app properly
afterAll(async () => {
  await app?.close(); // Must close
}, 30000);
```

**Present to User**:
```
## Structure Review: {filename}

✅ Test file naming correct
❌ Missing beforeEach cleanup
⚠️ No explicit timeout on beforeAll

Issues Found: {n}

{detailed findings}

[C] Continue to pattern review / [F] Fix issues first
```

---

### Step 3: Review GWT Pattern Compliance

**Goal**: Verify all tests follow Given-When-Then pattern correctly.

**For Each Test, Check**:

1. **GIVEN Section**:
   - [ ] Has explicit GIVEN comment
   - [ ] Setup is clear and complete
   - [ ] Uses unique identifiers
   - [ ] Test data created via factories

2. **WHEN Section**:
   - [ ] Has explicit WHEN comment
   - [ ] EXACTLY ONE action
   - [ ] Action clearly matches test name

3. **THEN Section**:
   - [ ] Has explicit THEN comment
   - [ ] Specific assertions (not generic)
   - [ ] No conditional logic
   - [ ] Verifies all expected outcomes

**Pattern Violations**:
```typescript
// ❌ Multiple WHEN actions
it('should create and update user', async () => {
  const createRes = await request(httpServer).post('/users');
  const updateRes = await request(httpServer).patch(`/users/${id}`);
  // Split into separate tests!
});

// ❌ Generic assertion
expect(response.body.data).toBeDefined();
// Fix: expect(response.body.data.email).toBe('expected@email.com');

// ❌ Conditional assertion
if (response.status === 200) {
  expect(response.body.data).toBeDefined();
}
// Fix: Create separate tests for each scenario
```

**Present to User**:
```
## GWT Pattern Review: {filename}

Test: "should {name}"
- GIVEN: ✅ Present / ❌ Missing
- WHEN: ✅ Single action / ❌ Multiple actions
- THEN: ✅ Specific / ❌ Generic

Issues:
{list issues with line numbers}

Recommendations:
{specific fixes}

[C] Continue / [F] Fix now
```

---

### Step 4: Review Assertions Quality

**Goal**: Verify assertions are meaningful and specific.

**Quality Checks**:
- [ ] Uses `toMatchObject` for partial matching
- [ ] Checks specific values, not just types
- [ ] Verifies database state changes
- [ ] Verifies async side effects
- [ ] Error cases verify NO side effects

**Common Issues**:
```typescript
// ❌ Type-only assertion
expect(typeof response.body.id).toBe('string');
// ✅ Value assertion
expect(response.body.id).toMatch(/^user-/);

// ❌ Existence-only assertion
expect(response.body.data).toBeDefined();
// ✅ Content assertion
expect(response.body.data).toMatchObject({
  email: 'test@example.com',
  status: 'active',
});

// ❌ Missing side effect verification in error case
it('should reject invalid input', async () => {
  await request(httpServer).post('/users').send(invalid).expect(400);
  // Missing: verify no database record created
});
// ✅ With side effect check
it('should reject invalid input', async () => {
  await request(httpServer).post('/users').send(invalid).expect(400);
  const count = await userRepository.count();
  expect(count).toBe(0);
});
```

**Present to User**:
```
## Assertion Quality: {filename}

Weak Assertions Found: {n}
- Line {x}: toBeDefined → should use toMatchObject
- Line {y}: Missing database verification
- Line {z}: Error case missing side effect check

Recommendations:
{specific improvements}

[C] Continue / [F] Fix now
```

---

### Step 5: Review Test Isolation

**Goal**: Verify tests don't share state and are truly independent.

**Isolation Checks**:
- [ ] Unique identifiers per test (not hardcoded)
- [ ] Database cleaned before each test
- [ ] No global variables modified
- [ ] Message buffers cleared (Kafka)
- [ ] Mocks reset between tests

**Isolation Issues**:
```typescript
// ❌ Hardcoded ID (causes conflicts)
const userId = 'user-123';
// ✅ Unique ID
const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ❌ Missing cleanup wait
beforeEach(async () => {
  await repository.clear();
});
// ✅ With wait for in-flight
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 500));
  await repository.clear();
});

// ❌ Kafka: Using fromBeginning
await consumer.subscribe({ topic, fromBeginning: true });
// ✅ Use pre-subscription + buffer clearing
```

**Present to User**:
```
## Isolation Review: {filename}

Issues Found:
- Hardcoded IDs: {lines}
- Missing cleanup waits: {lines}
- Shared state risk: {details}

Impact: Tests may fail intermittently when run together

Fixes Required:
{specific changes}

[C] Continue / [F] Fix now
```

---

### Step 6: Review Technology-Specific Patterns

**Goal**: Verify correct usage of technology-specific test patterns.

**Load and Check Against**:
- `references/{technology}/rules.md`
- `references/{technology}/test-helper.md`
- `references/{technology}/examples.md`

**Common Technology Issues**:

**Kafka**:
```typescript
// ❌ Fixed wait instead of polling
await new Promise(r => setTimeout(r, 10000));
// ✅ Smart polling
const messages = await kafkaHelper.waitForMessages(topic, 1, 20000);

// ❌ fromBeginning: true
// ✅ Pre-subscription with buffer clearing
```

**PostgreSQL**:
```typescript
// ❌ Wrong cleanup order (FK violations)
await orderRepository.clear();
await userRepository.clear();
// ✅ Children first
await orderRepository.clear();
await userRepository.clear();
```

**MongoDB**:
```typescript
// ❌ Not waiting for indexes
await collection.createIndex({ field: 1 });
// Immediately querying...
// ✅ Wait or use ensureIndex in beforeAll
```

**External APIs**:
```typescript
// ❌ Not resetting mocks
// ✅ afterEach: mockServer.resetHandlers();
```

**Present to User**:
```
## Technology Pattern Review

### {Technology} Tests

Comparing against: references/{technology}/rules.md

Issues Found:
{list issues}

Correct Patterns:
{show expected patterns from references}

[C] Continue / [F] Fix now
```

---

### Step 7: Generate Review Summary

**Goal**: Provide comprehensive review summary with prioritized fixes.

**Summary Template**:
```
# E2E Test Review Summary

## Files Reviewed
- {file1}: {n} tests
- {file2}: {m} tests

## Critical Issues (Must Fix)
1. {issue} - {file}:{line}
2. {issue} - {file}:{line}

## Important Issues (Should Fix)
1. {issue} - {file}:{line}

## Minor Issues (Nice to Fix)
1. {issue} - {file}:{line}

## Good Practices Found
- {positive finding}
- {positive finding}

## Recommended Reading
- references/common/{relevant}.md
- references/{technology}/{relevant}.md

## Next Steps
1. Fix critical issues first
2. Run tests to verify fixes
3. Address important issues
4. Consider refactoring for minor issues
```

**Present to User**:
```
{review summary}

Would you like me to:
[F] Fix critical issues now
[D] Generate detailed fix instructions
[E] Export review as markdown file
```

---

## Post-Workflow: Knowledge Review

After review, recommend:
1. Re-read `references/common/rules.md` if many GWT violations
2. Re-read technology-specific guides if patterns incorrect
3. Review `references/common/examples.md` for reference implementations

---

## Review Severity Levels

### Critical (Must Fix)
- Tests with multiple WHEN actions
- Conditional assertions
- Missing database cleanup
- Hardcoded IDs in Kafka consumer groups
- fromBeginning: true in Kafka tests

### Important (Should Fix)
- Generic assertions (toBeDefined)
- Missing side effect verification
- Hardcoded test IDs
- Missing GWT comments
- Inappropriate timeouts

### Minor (Nice to Fix)
- Suboptimal test organization
- Missing factory functions
- Verbose setup code
- Missing error case tests

---

## Success Criteria

- [ ] All tests reviewed against rules
- [ ] Issues categorized by severity
- [ ] Specific line numbers provided
- [ ] Fix recommendations given
- [ ] Relevant references cited
- [ ] Clear next steps provided
