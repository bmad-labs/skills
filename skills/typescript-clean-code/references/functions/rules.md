# Functions Rules

Guidelines for writing clean, readable, and maintainable functions.

## Core Rules

### 1. Keep Functions Small

Functions should be small enough to understand at a glance.

- Blocks in `if`/`else`/`while` are usually one line (a function call)
- Shallow indentation — one or two levels
- Each function should be transparently obvious

**Detect by naming, not by counting.** The reliable test is: *can I name each
section of this function?* If yes, those names are the functions that want to exist.
If no — the body is one linear idea — length alone is not a reason to split it.

> **Contested — do not apply a line count as law.**
>
> Clean Code's "2-5 lines ideal, rarely exceeding 20" is a **position**, not a
> measurement, and following the number literally produces a specific, common
> failure: logic scattered across many tiny functions, none of which mean anything
> alone, where understanding any one behavior requires jumping through six files.
> The reader's cost moved rather than shrank.
>
> The counter-position is John Ousterhout's, in *A Philosophy of Software Design*:
> modules should be **deep** — a simple interface hiding substantial implementation.
> On that view excessive decomposition is itself a design smell, because shallow
> functions add interface cost without hiding anything. Ousterhout and Martin have
> published a written debate on exactly this.
>
> Neither position is settled by evidence. So treat length as a **trigger to look**,
> never as a finding on its own. A 40-line function that does one linear thing with
> good names is fine. A 12-line function doing three things is not. Report
> *"this function does three things"*, citing Rule 2 — never *"this function is 40
> lines"*.
>
> Per `references/smells/rules.md` → Review posture: on disputed design questions,
> weigh principles rather than imposing a threshold, and where the author shows a
> valid alternative, prefer the author's.

**Example**:
```typescript
// Bad - too long, multiple levels
const processOrder = (order: Order): void => {
  if (order.isValid()) {
    for (const item of order.items) {
      if (item.inStock) {
        inventory.reserve(item);
        // ... 20 more lines
      }
    }
  }
};

// Good - small, delegating
const processOrder = (order: Order): void => {
  if (order.isValid()) {
    reserveItems(order);
    calculateTotals(order);
    notifyCustomer(order);
  }
};
```

### 2. Do One Thing

Functions should do one thing, do it well, and do it only.

- All steps should be one level of abstraction below the function name
- If you can extract a meaningful function, it's doing too much
- If it has sections, it's doing too much

### 3. One Level of Abstraction

All statements in a function should be at the same abstraction level.

- Don't mix `getUser()` with `str.toLowerCase()`
- High-level calls with high-level, low-level with low-level

### 4. Minimize Arguments

Zero arguments is ideal. Three is the maximum.

- Zero (niladic): Best
- One (monadic): Good for questions or transformations
- Two (dyadic): Acceptable, but harder to understand
- Three (triadic): Avoid - very hard to understand
- More: Never

**Example**:
```typescript
// Bad - too many arguments
const createUser = (
  name: string,
  email: string,
  age: number,
  address: string,
  phone: string
): User => { /* ... */ };

// Good - use an object
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
}

const createUser = (params: CreateUserParams): User => { /* ... */ };
```

### 5. No Flag Arguments

Never pass a boolean to control function behavior.

- Flag arguments mean the function does more than one thing
- Split into two functions instead

**Example**:
```typescript
// Bad
const render = (data: Data, isSuite: boolean): string => { /* ... */ };

// Good
const renderSuite = (data: Data): string => { /* ... */ };
const renderSingleTest = (data: Data): string => { /* ... */ };
```

### 6. No Side Effects

Functions should not have hidden behaviors beyond their stated purpose.

- Don't modify global state unexpectedly
- Don't modify input parameters unexpectedly
- If side effects are necessary, make them explicit in the name

### 7. Command Query Separation

Functions should either do something OR answer something, never both.

- Commands: Change state, return nothing (or void)
- Queries: Return information, change nothing

**Example**:
```typescript
// Bad - does both
const set = (attr: string, value: string): boolean => { /* ... */ };
if (set("username", "bob")) { /* confusing! */ }

// Good - separated
const attributeExists = (attr: string): boolean => { /* ... */ };
const setAttribute = (attr: string, value: string): void => { /* ... */ };

if (attributeExists("username")) {
  setAttribute("username", "bob");
}
```

### 8. Use Exceptions, Not Error Codes

Throw exceptions instead of returning error codes.

- Error codes force immediate handling, causing deep nesting
- Exceptions separate happy path from error handling
- Error code enums become dependency magnets

### 9. Extract Try/Catch Blocks

Error handling is one thing - functions that handle errors should do nothing else.

- If `try` exists, it should be the first word in the function
- Nothing should come after `catch`/`finally` blocks
- Extract the try body and catch body into separate functions

### 10. Use Descriptive Names

Long descriptive names are better than short cryptic ones.

- Names should say what the function does
- Be consistent: use same phrases, nouns, verbs
- Spend time choosing names - it clarifies design

## Guidelines

- Use verb/noun pairs for monadic functions: `writeField(name)`
- Encode argument names in function name: `assertExpectedEqualsActual(expected, actual)`
- Avoid output arguments - use return values or `this`
- Multiple `return`/`break`/`continue` are fine in small functions

## Exceptions

- **Switch statements**: Acceptable if used once, to create polymorphic objects, hidden behind a factory
- **Multiple returns**: Fine in small functions where it improves clarity
- **Two arguments**: Acceptable for ordered pairs like `Point(x, y)` or natural pairs

## Quick Reference

| Rule | Guideline |
|------|-----------|
| Size | Small enough to grasp at a glance — detect by "can I name each section?", not by a line count (Rule 1 is contested; see the note there) |
| Arguments | 0-2 preferred, max 3 |
| Flag args | Never use |
| Side effects | Make explicit or eliminate |
| Command/Query | Separate state changes from returns |
| Error handling | Use exceptions, extract try/catch |
| Naming | Long and descriptive beats short |
