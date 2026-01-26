# Knowledge File Templates

Copy and adapt these templates for each knowledge file type.

## Required Files Per Category

Each category MUST have these 3 basic files:
1. **knowledge.md** - Core concepts, definitions, foundational understanding
2. **rules.md** - Specific guidelines, do's and don'ts
3. **examples.md** - Good/bad code examples, before/after comparisons

Optional files (add as needed):
- **patterns.md** - Reusable solutions to common problems
- **smells.md** - Anti-patterns and what to avoid
- **checklist.md** - Quick reference checklists

## Workflows

Workflows are step-by-step processes for repeatable tasks. See `workflow-templates.md` for:
- When to create workflows
- Workflow best practices
- Complete workflow template
- Example workflows by category

---

## Template: Knowledge File (REQUIRED)

```markdown
# [Topic] Knowledge

Core concepts and foundational understanding for [topic].

## Overview

[2-3 sentences summarizing what this topic covers and why it matters]

## Key Concepts

### [Concept 1]

**Definition**: [Clear, concise definition]

[1-2 sentences of explanation]

**Key points**:
- [Important aspect]
- [Important aspect]

### [Concept 2]

**Definition**: [Clear, concise definition]

[Explanation]

### [Concept 3]

**Definition**: [Clear, concise definition]

[Explanation]

## Terminology

| Term | Definition |
|------|------------|
| [Term] | [Brief definition] |
| [Term] | [Brief definition] |

## How It Relates To

- **[Related Topic 1]**: [How they connect]
- **[Related Topic 2]**: [How they connect]

## Common Misconceptions

- **Myth**: [Common misconception]
  **Reality**: [The truth]

- **Myth**: [Common misconception]
  **Reality**: [The truth]

## Quick Reference

| Concept | One-Line Summary |
|---------|-----------------|
| [Name] | [Summary] |
| [Name] | [Summary] |
```

---

## Template: Rules File (REQUIRED)

```markdown
# [Topic] Rules

[One sentence describing what these rules cover.]

## Core Rules

### 1. [Rule Name]

[Brief description of the rule.]

- [Supporting detail]
- [Supporting detail]

**Example**:
​```[language]
// Bad
[bad example]

// Good
[good example]
​```

### 2. [Rule Name]

[Brief description.]

### 3. [Rule Name]

[Brief description.]

## Guidelines

Less strict recommendations:

- [Guideline 1]
- [Guideline 2]

## Exceptions

When these rules may be relaxed:

- **[Context]**: [When and why exception applies]

## Quick Reference

| Rule | Summary |
|------|---------|
| [Name] | [One-line summary] |
| [Name] | [One-line summary] |
```

---

## Template: Examples File (REQUIRED)

```markdown
# [Topic] Examples

Code examples demonstrating [topic] principles.

## Bad Examples

### [Problem Name]

​```[language]
[bad code example]
​```

**Problems**:
- [Issue 1]
- [Issue 2]

### [Problem Name]

​```[language]
[bad code example]
​```

**Problems**:
- [Issue]

## Good Examples

### [Pattern Name]

​```[language]
[good code example]
​```

**Why it works**:
- [Reason 1]
- [Reason 2]

## Refactoring Walkthrough

### Before

​```[language]
[original problematic code]
​```

### After

​```[language]
[refactored clean code]
​```

### Changes Made

1. [Change 1 and why]
2. [Change 2 and why]
3. [Change 3 and why]
```

---

## Template: Smells File (OPTIONAL)

```markdown
# [Category] Smells

Code smells related to [category]. Use for code review and refactoring.

---

## [ID]: [Smell Name]

**What it is**: [One-line description]

**How to detect**:
- [Detection method 1]
- [Detection method 2]

**Why it's bad**:
- [Negative impact]

**How to fix**:
- [Solution approach]

**Example**:
​```[language]
// Smell
[problematic code]

// Fixed
[improved code]
​```

---

## [ID]: [Smell Name]

**What it is**: [Description]

**How to detect**:
- [Method]

**Why it's bad**:
- [Impact]

**How to fix**:
- [Solution]

---

## Quick Detection Table

| ID | Smell | Key Indicator |
|----|-------|---------------|
| [X] | [Name] | [Quick check] |
| [X] | [Name] | [Quick check] |
```

---

## Template: Checklist File (OPTIONAL)

```markdown
# [Topic] Checklist

Use when [context for using this checklist].

## Before You Start

- [ ] [Prerequisite check]
- [ ] [Prerequisite check]

## [Category 1]

- [ ] [Check item with clear pass/fail criteria]
- [ ] [Check item]
- [ ] [Check item]

## [Category 2]

- [ ] [Check item]
- [ ] [Check item]

## [Category 3]

- [ ] [Check item]
- [ ] [Check item]

## Red Flags

Stop and address if you find:

- [Critical issue indicator]
- [Critical issue indicator]

## Quick Reference

| Aspect | Ideal | Acceptable | Red Flag |
|--------|-------|------------|----------|
| [X] | [Best] | [OK] | [Bad] |
| [X] | [Best] | [OK] | [Bad] |
```

---

## Template: Patterns File (OPTIONAL)

```markdown
# [Topic] Patterns

Reusable patterns for [context].

## Pattern: [Pattern Name]

### Intent

[What problem this pattern solves]

### When to Use

- [Situation 1]
- [Situation 2]

### Structure

​```[language]
[pattern structure/skeleton]
​```

### Example

​```[language]
[concrete example]
​```

### Benefits

- [Benefit 1]
- [Benefit 2]

### Considerations

- [Trade-off or caveat]

---

## Pattern: [Pattern Name]

### Intent

[Problem solved]

### When to Use

- [Situation]

### Structure

​```[language]
[structure]
​```

---

## Pattern Selection Guide

| Situation | Recommended Pattern |
|-----------|-------------------|
| [Context] | [Pattern Name] |
| [Context] | [Pattern Name] |
```

---

## Template: Principles File (OPTIONAL - merge into knowledge.md if small)

```markdown
# [Topic] Principles

Core philosophy and foundational concepts for [topic].

## Overview

[2-3 sentences summarizing the key philosophy]

## Core Principles

### [Principle Name]

> [Key quote or motto if available]

[Explanation in 2-3 sentences]

**In practice**:
- [Practical application]
- [Practical application]

### [Principle Name]

[Explanation]

**In practice**:
- [Application]

## Guiding Questions

Ask yourself:

1. [Question to evaluate code against principle]
2. [Question]
3. [Question]

## Summary

| Principle | One-Line Summary |
|-----------|-----------------|
| [Name] | [Summary] |
| [Name] | [Summary] |
```

---

## Template: Progress File

```markdown
# [Skill Name] - Creation Progress

## Status Overview

| Phase | Files | Complete |
|-------|-------|----------|
| Foundation | 3 | 0/3 |
| [Category] | X | 0/X |
| [Category] | X | 0/X |
| **Total** | **Y** | **0/Y** |

## Legend

- [ ] Not started
- [~] In progress  
- [x] Completed
- [-] Skipped/Not needed

## Phase 1: Foundation

- [ ] SKILL.md
- [ ] progress.md
- [ ] guidelines.md

## Phase 2: [Category Name]

Source: Chapter X (lines N-M)

Required files:
- [ ] [category]/knowledge.md
- [ ] [category]/rules.md
- [ ] [category]/examples.md

Optional files:
- [ ] [category]/patterns.md
- [ ] [category]/checklist.md

## Phase 3: [Category Name]

Source: Chapter Y (lines N-M)

Required files:
- [ ] [category]/knowledge.md
- [ ] [category]/rules.md
- [ ] [category]/examples.md

Optional files:
- [ ] [category]/smells.md

## Notes

[Any blockers, decisions, or context for future sessions]
```

---

## Template: SKILL.md (for generated skill)

```markdown
---
name: [skill-name]
description: |
  [What this skill provides - 1-2 sentences]
  
  Use this skill when:
  - [Trigger condition 1]
  - [Trigger condition 2]
  - [Trigger condition 3]
---

# [Skill Name]

[One paragraph overview]

## Quick Start

1. Check `guidelines.md` for which files to load
2. Load only the files relevant to your task
3. Apply the knowledge to your work

## Contents

### References

| Category | Files | Purpose |
|----------|-------|---------|
| [category] | [files] | [when to use] |

### Workflows

- `workflows/[name].md` - [purpose]

## Workflows

| Task | Workflow |
|------|----------|
| [task] | `workflows/[name].md` |

## Guidelines

See `guidelines.md` for:
- Task-based file selection
- Code element mapping
- Problem/symptom lookup
```

---

## Formatting Guidelines

### Headers
- `#` - File title only
- `##` - Major sections
- `###` - Subsections (rules, examples)

### Code Blocks
- Always specify language
- Keep examples short (5-15 lines)
- Show bad/good pairs when possible

### Tables
- Use for quick reference sections
- Keep columns narrow
- Left-align text columns

### Lists
- Bullet for unordered items
- Numbers for sequences or ranked items
- Checkboxes for actionable checklists

### Length
- Target: 50-150 lines
- Maximum: 200 lines
- If longer, split the file
