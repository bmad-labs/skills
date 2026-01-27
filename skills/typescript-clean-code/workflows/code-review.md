# Code Review Workflow

Step-by-step process for reviewing code quality.

## When to Use

- Reviewing your own code before committing
- Reviewing a colleague's code
- Performing a quality check on a module

## Prerequisites

Have the code to review accessible and understand its purpose.

---

## Workflow Steps

### Step 1: Understand Context

**Goal**: Understand what the code is supposed to do before judging how it does it.

- [ ] Read the related ticket/story/requirement
- [ ] Understand the business purpose
- [ ] Identify the scope of changes

**Ask**: "What problem is this code solving?"

---

### Step 2: Check Function Quality

**Reference**: `functions/checklist.md`, `functions/rules.md`

For each function, verify:

- [ ] **Size**: Is it small (5-20 lines)?
- [ ] **Single Responsibility**: Does it do ONE thing?
- [ ] **Abstraction Level**: Is it consistent throughout?
- [ ] **Arguments**: Are there 3 or fewer?
- [ ] **Side Effects**: Are there hidden side effects?
- [ ] **Name**: Does the name describe what it does?

**Red Flags**:
- Function > 20 lines
- More than 3 arguments
- Boolean flag arguments
- Output arguments
- Mixed abstraction levels

---

### Step 3: Check Naming

**Reference**: `naming/rules.md`

- [ ] **Variables**: Reveal intent without comments?
- [ ] **Functions**: Verb phrases that describe action?
- [ ] **Classes**: Noun phrases that describe responsibility?
- [ ] **No Encodings**: No Hungarian notation or prefixes?
- [ ] **Searchable**: Can you grep for important names?
- [ ] **Consistent**: Same concept = same word throughout?

**Red Flags**:
- Single-letter variables (except loop counters)
- Abbreviations that aren't universal
- Names that require comments to explain
- Different words for the same concept

---

### Step 4: Check Class/Module Design

**Reference**: `classes/rules.md`

- [ ] **Single Responsibility**: One reason to change?
- [ ] **Cohesion**: Methods use most instance variables?
- [ ] **Size**: Small and focused?
- [ ] **Dependencies**: Depends on abstractions, not concretions?

**Red Flags**:
- God classes with many responsibilities
- Low cohesion (methods don't use shared state)
- Concrete dependencies that should be injected

---

### Step 5: Check Error Handling

**Reference**: `error-handling/rules.md`

- [ ] **Exceptions over codes**: Using exceptions, not error codes?
- [ ] **No null returns**: Returning empty collections or Optional instead?
- [ ] **No null passes**: Not passing null to functions?
- [ ] **Context**: Exceptions include enough context?
- [ ] **Normal flow**: Happy path is clear and uncluttered?

**Red Flags**:
- Returning null
- Swallowing exceptions silently
- Error handling mixed with business logic

---

### Step 6: Check Tests

**Reference**: `unit-tests/rules.md`

- [ ] **Coverage**: Are the changes tested?
- [ ] **Readability**: Can you understand what's being tested?
- [ ] **Single Concept**: One concept per test?
- [ ] **F.I.R.S.T.**: Fast, Independent, Repeatable, Self-validating, Timely?
- [ ] **Naming**: Test names describe the scenario?

**Red Flags**:
- No tests for new code
- Tests that test multiple things
- Tests that depend on each other
- Slow tests

---

### Step 7: Check Comments

**Reference**: `comments/rules.md`

- [ ] **Necessary**: Could the code explain itself instead?
- [ ] **Accurate**: Do comments match the code?
- [ ] **No noise**: No redundant or obvious comments?
- [ ] **No commented-out code**: Old code removed, not commented?

**Red Flags**:
- Comments explaining "what" instead of "why"
- Commented-out code blocks
- TODO comments that should be tickets
- Outdated comments

---

### Step 8: Check for Smells

**Reference**: `smells/rules.md`

Scan for common smells:

- [ ] **G5 - Duplication**: Any copy-pasted code?
- [ ] **G14 - Feature Envy**: Methods using other class's data excessively?
- [ ] **G30 - Functions Do One Thing**: Any functions doing multiple things?
- [ ] **G31 - Hidden Temporal Coupling**: Hidden order dependencies?
- [ ] **C5 - Commented-Out Code**: Any dead code?

---

### Step 9: Provide Feedback

**Reference**: `collaboration/rules.md`

When providing feedback:

1. **Be specific**: Point to exact lines/functions
2. **Explain why**: Reference principles, not just preferences
3. **Suggest alternatives**: Don't just criticize, propose solutions
4. **Prioritize**: Distinguish blocking issues from nice-to-haves
5. **Be respectful**: Critique code, not the person

**Feedback Template**:
```
[BLOCKING/SUGGESTION] [File:Line]
Issue: [What's wrong]
Why: [Reference to principle]
Suggestion: [How to fix]
```

---

## Quick Checklist

```
[ ] Context understood
[ ] Functions: small, single purpose, few arguments
[ ] Names: reveal intent, consistent
[ ] Classes: SRP, cohesive
[ ] Errors: exceptions, no null, context
[ ] Tests: exist, readable, F.I.R.S.T.
[ ] Comments: necessary, accurate
[ ] Smells: none detected
[ ] Feedback: specific, respectful, actionable
```

---

## Exit Criteria

Review is complete when:
- [ ] All steps above have been checked
- [ ] Feedback has been provided (or code approved)
- [ ] Blocking issues are clearly identified
