---
name: skill-from-book
description: |
  Create Claude skills from book content (markdown files). Transforms long-form book knowledge into structured, context-efficient skill packages with granular reference files and use-case guidelines.
  
  Use this skill when:
  - Converting a book (markdown) into a reusable Claude skill
  - Creating knowledge bases from technical books, guides, or documentation
  - Building skills that need progressive disclosure of large content
  - Structuring book knowledge for efficient context loading
---

# Skill From Book

Transform book content into structured, context-efficient Claude skills.

## Overview

This skill guides you through converting a book (in markdown format) into a well-organized skill with:
- Granular knowledge files (one concept per file)
- Use-case guidelines (mapping tasks to relevant files)
- Progress tracking for multi-session work
- Subagent-friendly extraction tasks

## Workflow

### Phase 1: Analysis

1. **Read the book structure**
   ```
   - Identify chapters, sections, subsections
   - Count total lines/size
   - Note key concepts per chapter
   ```

2. **Identify knowledge categories**
   - Core principles/philosophy
   - Rules and guidelines
   - Examples (good vs bad)
   - Patterns and anti-patterns
   - Checklists and quick references

3. **Define use cases**
   - Who will use this skill?
   - What tasks will they perform?
   - What questions will they ask?

See: `references/analysis-guide.md`

### Phase 2: Planning

1. **Design file structure**
   ```
   skill-name/
   ├── SKILL.md
   ├── progress.md
   ├── guidelines.md
   └── references/
       ├── category-1/
       │   ├── topic-a.md
       │   └── topic-b.md
       └── category-2/
           └── ...
   ```

2. **Create progress.md**
   - List all files to create
   - Group by phase/priority
   - Track completion status

3. **Plan extraction tasks**
   - One task per knowledge file
   - Define input (book section) and output (file)
   - Identify dependencies between tasks

See: `references/extraction-patterns.md`

### Phase 3: Extraction

For each knowledge file, use a subagent with:

```
Task: Extract [TOPIC] from [BOOK]
Input: [Chapter/Section reference]
Output: references/[category]/[topic].md

Instructions:
1. Read the specified section
2. Extract key rules/principles
3. Include code examples (good vs bad)
4. Format using the knowledge file template
5. Keep focused on ONE concept
```

See: `references/file-templates.md`

### Phase 4: Guidelines Creation

Create `guidelines.md` that maps:
- Tasks → relevant files
- Code elements → relevant files
- Symptoms/problems → relevant files
- Decision trees for common scenarios

See: `references/guidelines-template.md`

### Phase 5: Finalization

1. Review all files for consistency
2. Update progress.md (mark complete)
3. Test with sample queries
4. Refine guidelines based on testing

## Key Principles

### Granularity
- One concept per file
- Files should be 50-200 lines
- Split large topics into subtopics

### Context Efficiency
- Only load what's needed
- Guidelines file routes to specific knowledge
- Avoid duplication across files

### Actionable Content
- Rules over explanations
- Examples over theory
- Checklists for quick reference

### Subagent-Friendly
- Each extraction task is independent
- Clear input/output specification
- Can run multiple extractions in parallel

## File Naming Conventions

```
references/
├── [category]/           # Noun, plural (e.g., functions, classes)
│   ├── [topic]-rules.md  # Core rules for a topic
│   ├── [topic]-examples.md  # Good/bad examples
│   ├── [topic]-patterns.md  # Common patterns
│   └── [topic]-checklist.md # Quick reference
```

## Progress Tracking

Always maintain `progress.md`:

```markdown
# [Skill Name] - Creation Progress

## Status: [X/Y files complete]

## Phase 1: Foundation
- [x] SKILL.md
- [x] progress.md
- [ ] guidelines.md

## Phase 2: [Category Name]
- [ ] category/topic-a.md
- [ ] category/topic-b.md
...
```

## Quick Start

1. Provide the book markdown file path
2. Run analysis to identify structure
3. Confirm skill name and target folder
4. Create initial files (SKILL.md, progress.md)
5. Begin extraction phase by phase
