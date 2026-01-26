# Book Analysis Guide

How to analyze a book before creating a skill from it.

## Step 1: Structural Analysis

### Get Book Metrics
```bash
# Count total lines
wc -l book.md

# View table of contents (headers)
grep -E "^#{1,3} " book.md
```

### Identify Structure Elements
| Element | How to Find | Example |
|---------|-------------|---------|
| Chapters | `# Chapter` or `# 1.` patterns | `# Chapter 3: Functions` |
| Sections | `## ` headers | `## Small Functions` |
| Subsections | `### ` headers | `### Do One Thing` |
| Code examples | Fenced code blocks | ``` ```java ``` |
| Lists/Rules | Numbered or bulleted lists | `1. Functions should be small` |
| Key quotes | Blockquotes | `> FUNCTIONS SHOULD DO ONE THING` |

### Document Structure Map
Create a structure map:
```markdown
## Book Structure

- Chapter 1: [Name] (lines 1-500)
  - Section 1.1: [Name]
  - Section 1.2: [Name]
- Chapter 2: [Name] (lines 501-1200)
  ...
```

## Step 2: Content Classification

### Knowledge Types
Classify content into these categories:

| Type | Description | File Suffix |
|------|-------------|-------------|
| Principles | Core philosophy, "why" explanations | `-principles.md` |
| Rules | Specific guidelines, "do this/don't do that" | `-rules.md` |
| Examples | Code samples showing good/bad practices | `-examples.md` |
| Patterns | Reusable solutions to common problems | `-patterns.md` |
| Anti-patterns | What to avoid (smells, bad practices) | `-smells.md` |
| Checklists | Quick reference lists | `-checklist.md` |
| Definitions | Terminology and concepts | `-glossary.md` |

### Content Density Analysis
For each chapter, note:
- High-value sections (core concepts)
- Example-heavy sections (code samples)
- Theory-heavy sections (explanations)
- Reference sections (lists, tables)

## Step 3: Use Case Identification

### Primary Users
Ask: Who will use this skill?
- Developers writing code
- Reviewers checking code
- Learners studying concepts
- Architects designing systems

### Primary Tasks
Ask: What will they do with this skill?
- Review code for issues
- Refactor existing code
- Write new code
- Learn/understand concepts
- Make design decisions

### Task-Content Mapping
Create initial mapping:
```markdown
| User Task | Relevant Chapters/Sections |
|-----------|---------------------------|
| Review function quality | Ch 3: Functions |
| Fix naming issues | Ch 2: Meaningful Names |
| Add proper error handling | Ch 7: Error Handling |
```

## Step 4: Granularity Planning

### File Size Guidelines
- Target: 50-200 lines per file
- Maximum: 300 lines (split if larger)
- Minimum: 30 lines (merge if smaller)

### Split Criteria
Split a topic when:
- Content exceeds 200 lines
- Multiple distinct subtopics exist
- Different use cases need different parts
- Examples can stand alone

### Merge Criteria
Merge topics when:
- Content is under 30 lines
- Topics are tightly coupled
- Always used together

### Example Split Decision
```
Chapter: Functions (500 lines)
├── functions/function-size.md (80 lines)
│   - Small functions rule
│   - Line count guidelines
├── functions/function-arguments.md (120 lines)
│   - Argument count rules
│   - Argument objects
│   - Flag arguments
├── functions/function-naming.md (60 lines)
│   - Verb naming
│   - Descriptive names
├── functions/side-effects.md (70 lines)
│   - Pure functions
│   - Output arguments
└── functions/examples.md (150 lines)
    - Before/after code samples
```

## Step 5: Dependency Analysis

### Content Dependencies
Identify which topics reference others:
```
functions-rules.md
  └── requires: naming-rules.md (for function naming)
  
classes-srp.md
  └── requires: functions-rules.md (for method design)
```

### Reading Order
Determine if order matters:
- Foundation topics (read first)
- Core topics (main content)
- Advanced topics (read after core)

## Step 6: Output Planning

### Deliverables Checklist
- [ ] Skill name defined
- [ ] Target folder path
- [ ] File structure diagram
- [ ] Progress.md template
- [ ] Guidelines.md outline
- [ ] Extraction task list

### Extraction Task Template
For each file to create:
```markdown
## Task: [file-name.md]
- Source: Chapter X, Section Y (lines N-M)
- Category: [rules|examples|patterns|etc]
- Dependencies: [other files needed]
- Estimated lines: [50-200]
- Priority: [high|medium|low]
```

## Analysis Output Template

```markdown
# Book Analysis: [Book Title]

## Metrics
- Total lines: X
- Chapters: Y
- Estimated knowledge files: Z

## Structure
[Chapter/section outline]

## Categories
[List of reference categories]

## Use Cases
[User tasks and relevant content]

## File Plan
[Proposed file structure]

## Extraction Tasks
[Ordered list of tasks]
```
