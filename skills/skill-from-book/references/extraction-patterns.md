# Knowledge Extraction Patterns

Patterns for extracting knowledge from book content into skill files.

## Extraction Principles

### 1. One Concept Per File
- Each file should answer ONE question
- If you need "and" to describe the file, split it
- Bad: `naming-and-functions.md`
- Good: `naming-rules.md`, `function-rules.md`

### 2. Transform, Don't Copy
- Restructure content for quick reference
- Convert prose to bullet points
- Extract rules from explanations
- Create tables from scattered info

### 3. Preserve Value, Remove Fluff
- Keep: Rules, examples, checklists
- Remove: Historical context, anecdotes, motivation
- Summarize: Long explanations into key points

### 4. Add Structure
- Add headers for scanability
- Create tables for comparisons
- Use consistent formatting
- Include quick reference sections

## Extraction Task Format

### Subagent Prompt Template
```markdown
## Task: Extract [TOPIC] Knowledge

**Source**: [Book path], [Chapter/Section], lines [N-M]

**Output**: [output-file-path.md]

**Instructions**:
1. Read the source content carefully
2. Extract according to the [PATTERN] below
3. Format using the provided template
4. Keep file under 200 lines
5. Focus ONLY on [TOPIC], ignore tangential content

**Pattern**: [rules|examples|patterns|smells|checklist]

**Template**:
[Include relevant template from file-templates.md]
```

## Pattern: Rules Extraction

### What to Extract
- Explicit rules ("Functions should...")
- Implicit guidelines (derived from examples)
- Do's and Don'ts
- Numbered principles

### Transformation Example
**Source (book prose)**:
> The first rule of functions is that they should be small. The second rule of functions is that they should be smaller than that. This is not an assertion that I can justify with research... functions should hardly ever be 20 lines long.

**Output (structured)**:
```markdown
## Function Size Rules

1. **Keep functions small** - Aim for 5-15 lines
2. **Smaller is better** - If in doubt, make it shorter
3. **Maximum 20 lines** - Rarely exceed this limit
```

### Rules File Structure
```markdown
# [Topic] Rules

Brief intro (1-2 sentences max).

## Core Rules

1. **[Rule Name]** - [Brief description]
   - Detail point
   - Detail point

2. **[Rule Name]** - [Brief description]

## Guidelines

- [Softer recommendation]
- [Contextual advice]

## Exceptions

- When [context], you may [exception]

## Quick Reference

| Rule | Guideline |
|------|-----------|
| X | Do Y |
```

## Pattern: Examples Extraction

### What to Extract
- Code samples (before/after)
- Good vs bad comparisons
- Real-world illustrations
- Edge cases

### Transformation Example
**Source (scattered in book)**:
Various code examples across 50 pages

**Output (consolidated)**:
```markdown
## Bad Example
​```java
public void pay() {
  for (Employee e : employees) {
    if (e.isPayday()) {
      Money pay = e.calculatePay();
      e.deliverPay(pay);
    }
  }
}
​```
Problem: Does three things in one function.

## Good Example
​```java
public void pay() {
  for (Employee e : employees)
    payIfNecessary(e);
}

private void payIfNecessary(Employee e) {
  if (e.isPayday())
    calculateAndDeliverPay(e);
}
​```
Improvement: Each function does one thing.
```

### Examples File Structure
```markdown
# [Topic] Examples

## Bad Examples

### [Problem Category 1]
​```[language]
[bad code]
​```
**Problem**: [What's wrong]

### [Problem Category 2]
...

## Good Examples

### [Solution Category 1]
​```[language]
[good code]
​```
**Why it's good**: [Explanation]

## Refactoring Examples

### Before
​```[language]
[original code]
​```

### After
​```[language]
[improved code]
​```

**Changes made**:
- [Change 1]
- [Change 2]
```

## Pattern: Smells/Anti-patterns Extraction

### What to Extract
- Named code smells
- Warning signs
- Things to avoid
- Detection criteria

### Transformation Example
**Source (Chapter 17 style)**:
> G5: Duplication. This is one of the most important rules... Every time you see duplication in the code, it represents a missed opportunity for abstraction.

**Output (actionable)**:
```markdown
## G5: Duplication

**Smell**: Repeated code blocks or similar logic patterns.

**Detection**:
- Copy-pasted code blocks
- Similar switch/case chains
- Repeated conditionals

**Solution**:
- Extract to shared function
- Use polymorphism for type-based logic
- Apply Template Method pattern

**Example**:
[code sample]
```

### Smells File Structure
```markdown
# [Category] Smells

## [ID]: [Smell Name]

**Smell**: [One-line description]

**Detection**:
- [How to spot it]

**Impact**:
- [Why it's bad]

**Solution**:
- [How to fix]

---

## [ID]: [Next Smell Name]
...
```

## Pattern: Checklist Extraction

### What to Extract
- Review criteria
- Quality gates
- Verification steps
- Pre-commit checks

### Checklist File Structure
```markdown
# [Topic] Checklist

Use this checklist when [context].

## [Category 1]
- [ ] [Check item]
- [ ] [Check item]

## [Category 2]
- [ ] [Check item]

## Quick Checks
| Aspect | Check |
|--------|-------|
| [X] | [Is Y?] |
```

## Parallel Extraction Strategy

### Independent Tasks (can run in parallel)
- Different chapters
- Different categories within a chapter
- Examples separate from rules

### Dependent Tasks (run sequentially)
- Guidelines file (needs all knowledge files first)
- Cross-reference sections
- Summary/overview files

### Batch Organization
```markdown
## Batch 1 (Parallel)
- naming/naming-rules.md
- functions/function-rules.md
- comments/comment-rules.md

## Batch 2 (Parallel, after Batch 1)
- naming/naming-examples.md
- functions/function-examples.md
- comments/comment-examples.md

## Batch 3 (Sequential, after all)
- guidelines.md
```

## Quality Checks

### After Each Extraction
- [ ] File is under 200 lines
- [ ] Single focused topic
- [ ] Has concrete examples
- [ ] Uses consistent formatting
- [ ] No duplicate content with other files
- [ ] Actionable (rules, not just theory)

### After All Extractions
- [ ] All planned files created
- [ ] Cross-references are valid
- [ ] Guidelines cover all files
- [ ] No orphan files (not in guidelines)
