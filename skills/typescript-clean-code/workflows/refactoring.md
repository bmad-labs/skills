# Refactoring Workflow

Safe refactoring process with tests as a safety net.

## When to Use

- Improving code quality without changing behavior
- Before adding new features to messy code
- After getting tests passing (the REFACTOR phase of TDD)
- When you encounter code smells

## Prerequisites

- **Tests exist and pass** - This is non-negotiable
- Understand what the code does
- Have a specific improvement goal

**Reference**: `smells/rules.md`, `functions/rules.md`, `classes/rules.md`

---

## The Golden Rule

> **Never refactor without tests. Never.**

If tests don't exist, write them first. See `test-strategy.md` workflow.

---

## Workflow Steps

### Step 1: Verify Tests Pass

**Goal**: Establish a green baseline.

```bash
npm test  # All tests must pass
```

- [ ] All existing tests pass
- [ ] Coverage is adequate for the code you'll change
- [ ] You understand what the tests verify

**If tests fail**: Fix them first. Don't refactor broken code.

**If no tests exist**: Write characterization tests first.

---

### Step 2: Identify the Smell

**Goal**: Know exactly what you're fixing.

**Reference**: `smells/rules.md`

Common smells to look for:

| Smell | Symptom | Refactoring |
|-------|---------|-------------|
| G5: Duplication | Copy-pasted code | Extract Method/Class |
| Long Function | > 20 lines | Extract Method |
| Long Parameter List | > 3 params | Introduce Parameter Object |
| Feature Envy | Uses other class's data | Move Method |
| God Class | Too many responsibilities | Extract Class |
| Primitive Obsession | Primitives instead of objects | Replace with Value Object |

- [ ] Identify the specific smell
- [ ] Understand why it's a problem
- [ ] Know the target state

---

### Step 3: Plan Small Steps

**Goal**: Break refactoring into tiny, safe changes.

**Rule**: Each step should take < 5 minutes and keep tests green.

**Example**: Extracting a long function
```
Step 1: Identify code block to extract
Step 2: Create new function with extracted code
Step 3: Replace original code with function call
Step 4: Run tests
Step 5: Rename function for clarity
Step 6: Run tests
Step 7: Move function if needed
Step 8: Run tests
```

- [ ] List the steps
- [ ] Each step is independently testable
- [ ] No step changes behavior

---

### Step 4: Make ONE Change

**Goal**: Execute one small refactoring step.

**Checklist**:
- [ ] Make exactly ONE change
- [ ] The change is purely structural (no behavior change)
- [ ] You can describe the change in one sentence

**Common Refactorings**:

**Extract Method**:
```typescript
// Before
function processOrder(order: Order) {
  // validate
  if (!order.items.length) throw new Error('Empty order');
  if (!order.customer) throw new Error('No customer');
  
  // calculate
  const subtotal = order.items.reduce((sum, i) => sum + i.price, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;
  
  // save
  db.save({ ...order, total });
}

// After (one extraction)
function processOrder(order: Order) {
  validateOrder(order);  // Extracted
  
  const subtotal = order.items.reduce((sum, i) => sum + i.price, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;
  
  db.save({ ...order, total });
}

function validateOrder(order: Order) {
  if (!order.items.length) throw new Error('Empty order');
  if (!order.customer) throw new Error('No customer');
}
```

---

### Step 5: Run Tests

**Goal**: Verify the change didn't break anything.

```bash
npm test
```

- [ ] All tests pass
- [ ] No new failures
- [ ] Coverage hasn't dropped

**If tests fail**:
1. STOP
2. Undo the change (git checkout)
3. Make a smaller change
4. Or fix the issue if it's obvious

---

### Step 6: Commit

**Goal**: Save progress frequently.

```bash
git add -A
git commit -m "refactor: extract validateOrder function"
```

- [ ] Commit after each successful step
- [ ] Commit message describes the refactoring
- [ ] You can revert to this point if needed

---

### Step 7: Repeat

**Goal**: Continue until the smell is eliminated.

```
Change → Test → Commit → Change → Test → Commit → ...
```

Continue until:
- [ ] The smell is gone
- [ ] Code meets clean code standards
- [ ] No obvious improvements remain

---

## Common Refactoring Patterns

### Extract Method
**When**: Function is too long or does multiple things
```typescript
// Extract related lines into a named function
```

### Rename
**When**: Name doesn't reveal intent
```typescript
// Rename variable, function, or class to better name
```

### Introduce Parameter Object
**When**: Too many parameters
```typescript
// Before
function createUser(name: string, email: string, age: number, city: string)

// After
function createUser(userData: UserData)
```

### Replace Conditional with Polymorphism
**When**: Switch statements on type
```typescript
// Before: switch on employee type
// After: Employee interface with subclasses
```

### Extract Class
**When**: Class has multiple responsibilities
```typescript
// Split God class into focused classes
```

---

## Safety Checklist

Before each refactoring session:
- [ ] Tests exist and pass
- [ ] Version control is clean (committed state)
- [ ] You have time to complete (don't start before a meeting)

During refactoring:
- [ ] One change at a time
- [ ] Test after every change
- [ ] Commit after every green test
- [ ] Never refactor and add features simultaneously

---

## Exit Criteria

Refactoring is complete when:
- [ ] The identified smell is eliminated
- [ ] All tests still pass
- [ ] Code is cleaner than before
- [ ] Changes are committed
