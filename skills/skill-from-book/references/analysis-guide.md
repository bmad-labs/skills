# Book Analysis Guide

How to analyze a book before creating a skill from it.

## CRITICAL: Context Efficiency

**DO NOT read the full book content in this phase.**

The purpose of analysis is to understand structure and plan extraction tasks. Reading full content wastes context and should only happen during extraction phase by subagents.

### What TO DO:
- Extract headers/TOC only
- Count lines to estimate size
- Identify chapter boundaries
- Plan file structure

### What NOT TO DO:
- Read full chapters
- Read code examples in detail
- Read explanatory prose
- Load large sections into context

## Step 1: Structural Analysis

### Get Book Metrics
```bash
# Count total lines
wc -l book.md

# View table of contents (headers) - THIS IS SUFFICIENT
grep -E "^#{1,3} " book.md
```

**STOP HERE** - Do not read beyond the headers. The TOC gives you everything needed for analysis.

### Identify Structure Elements FROM HEADERS ONLY
| Element | How to Find | Example |
|---------|-------------|---------|
| Chapters | `# Chapter` or `# 1.` patterns | `# Chapter 3: Functions` |
| Sections | `## ` headers | `## Small Functions` |
| Subsections | `### ` headers | `### Do One Thing` |

**Note**: Code examples, lists, and quotes will be found during extraction phase - NOT now.

### Document Structure Map
Create a structure map from the TOC output:
```markdown
## Book Structure

- Chapter 1: [Name] (estimate lines from position)
  - Section 1.1: [Name]
  - Section 1.2: [Name]
- Chapter 2: [Name]
  ...
```

**Line estimates**: Use header positions from grep output to estimate chapter boundaries. Exact line numbers are not critical - subagents will read specific sections.

## Step 2: Content Classification (Based on Headers)

### Knowledge Types
**Infer content types from section/chapter names** - do not read content:

| Type | Description | File Suffix |
|------|-------------|-------------|
| Principles | Core philosophy, "why" explanations | `-principles.md` |
| Rules | Specific guidelines, "do this/don't do that" | `-rules.md` |
| Examples | Code samples showing good/bad practices | `-examples.md` |
| Patterns | Reusable solutions to common problems | `-patterns.md` |
| Anti-patterns | What to avoid (smells, bad practices) | `-smells.md` |
| Checklists | Quick reference lists | `-checklist.md` |
| Definitions | Terminology and concepts | `-glossary.md` |

### Content Density Estimation
Based on chapter/section titles, estimate:
- Which chapters likely have rules (e.g., "Functions", "Naming")
- Which likely have examples (e.g., "Refactoring", "Case Study")
- Which are reference material (e.g., "Smells and Heuristics")

**Do not read chapter content to verify** - make reasonable assumptions from titles.

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
