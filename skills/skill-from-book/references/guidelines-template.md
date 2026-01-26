# Guidelines File Template

The guidelines file is the routing layer that maps use cases to knowledge files.
It should be loaded early and used to decide which specific files to read.

---

## Template: guidelines.md

```markdown
# [Skill Name] Guidelines

Quick reference for finding the right knowledge file for your task.

**How to use**: Find your situation below, then load ONLY the listed files.

---

## By Task

### [Task Category 1] (e.g., Code Review)

| What you're doing | Load these files |
|-------------------|------------------|
| [Specific task] | `[path/file.md]` |
| [Specific task] | `[path/file.md]`, `[path/file2.md]` |
| [Specific task] | `[path/file.md]` |

### [Task Category 2] (e.g., Writing Code)

| What you're doing | Load these files |
|-------------------|------------------|
| [Specific task] | `[path/file.md]` |
| [Specific task] | `[path/file.md]` |

### [Task Category 3] (e.g., Refactoring)

| What you're doing | Load these files |
|-------------------|------------------|
| [Specific task] | `[path/file.md]` |
| [Specific task] | `[path/file.md]` |

---

## By Code Element

| Working with... | Primary | Secondary |
|-----------------|---------|-----------|
| [Element type] | `[file]` | `[file]` |
| [Element type] | `[file]` | `[file]` |
| [Element type] | `[file]` | `[file]` |

---

## By Problem/Symptom

| If you notice... | Load these files |
|------------------|------------------|
| [Symptom/smell] | `[path/file.md]` |
| [Symptom/smell] | `[path/file.md]` |
| [Symptom/smell] | `[path/file.md]` |

---

## By Topic

### [Topic Area 1]

- **Rules**: `[category]/[topic]-rules.md`
- **Examples**: `[category]/[topic]-examples.md`
- **Smells**: `[category]/[topic]-smells.md`

### [Topic Area 2]

- **Rules**: `[category]/[topic]-rules.md`
- **Examples**: `[category]/[topic]-examples.md`

---

## Decision Tree

​```
What are you doing?
│
├─► Reviewing code
│   ├─► Function quality → functions/function-rules.md
│   ├─► Naming issues → naming/naming-rules.md
│   └─► General quality → smells/general-smells.md
│
├─► Writing new code
│   ├─► New function → functions/function-rules.md
│   ├─► New class → classes/class-rules.md
│   └─► New test → tests/test-rules.md
│
├─► Refactoring
│   ├─► Long function → functions/function-rules.md
│   ├─► Complex logic → smells/general-smells.md
│   └─► Duplicate code → smells/duplication.md
│
└─► Learning
    └─► Start with → principles/overview.md
​```

---

## File Index

Complete list of all knowledge files:

### [Category 1]
| File | Purpose | Lines |
|------|---------|-------|
| `[file.md]` | [Brief purpose] | ~XX |

### [Category 2]
| File | Purpose | Lines |
|------|---------|-------|
| `[file.md]` | [Brief purpose] | ~XX |

---

## Common Combinations

Frequently used together:

| Scenario | Files to load |
|----------|---------------|
| [Common task] | `[file1]` + `[file2]` |
| [Common task] | `[file1]` + `[file2]` + `[file3]` |
```

---

## Guidelines Design Principles

### 1. Multiple Entry Points

Users find information differently:
- **By task**: "I'm reviewing code"
- **By element**: "I'm working on a function"
- **By symptom**: "This code is hard to read"
- **By topic**: "I need naming rules"

Include all entry points in your guidelines.

### 2. Minimal File Sets

Each mapping should recommend the **minimum** files needed:
- Primary file (required)
- Secondary file (if needed)
- Rarely more than 2-3 files

### 3. Avoid Overlapping Recommendations

If two tasks map to the same files, consider:
- Are they really different tasks?
- Should they be combined?
- Is the file too broad?

### 4. Decision Tree for Complex Routing

When selection depends on multiple factors:
```
Is it a review task?
├─► Yes: What aspect?
│   ├─► Names → naming-rules.md
│   └─► Structure → function-rules.md
└─► No: Is it writing new code?
    └─► ...
```

### 5. File Index for Discovery

Include a complete file list so users can:
- See everything available
- Find files not covered by mappings
- Understand the skill's scope

---

## Example: Clean Code Guidelines

```markdown
# Clean Code Guidelines

## By Task

### Code Review

| Reviewing... | Files |
|--------------|-------|
| Function length | `functions/function-rules.md` |
| Variable names | `naming/naming-rules.md` |
| Error handling | `errors/exception-rules.md` |
| Test quality | `tests/clean-tests.md` |

### Writing Code

| Creating... | Files |
|-------------|-------|
| New function | `functions/function-rules.md`, `naming/naming-rules.md` |
| New class | `classes/srp.md`, `classes/cohesion.md` |
| Unit tests | `tests/clean-tests.md`, `tests/first-principles.md` |

## By Smell

| Symptom | Files |
|---------|-------|
| Function > 20 lines | `functions/function-rules.md` |
| Too many arguments | `functions/function-arguments.md` |
| Commented-out code | `smells/comment-smells.md` |
| Duplicate blocks | `smells/general-smells.md` (G5) |

## Decision Tree

​```
START
├─► Reviewing? → What aspect?
│   ├─► Names → naming/naming-rules.md
│   ├─► Functions → functions/function-rules.md
│   └─► Classes → classes/srp.md
├─► Writing? → What type?
│   ├─► Function → functions/function-rules.md
│   └─► Class → classes/srp.md
└─► Refactoring? → What problem?
    ├─► Too long → functions/function-rules.md
    └─► Duplicate → smells/general-smells.md
​```
```

---

## Validation Checklist

After creating guidelines.md:

- [ ] Every knowledge file is referenced at least once
- [ ] Common tasks have clear mappings
- [ ] File recommendations are minimal (1-3 files)
- [ ] Decision tree covers main scenarios
- [ ] File index is complete and accurate
- [ ] No circular or confusing paths
