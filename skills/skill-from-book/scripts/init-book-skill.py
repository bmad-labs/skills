#!/usr/bin/env python3
"""
Initialize a new skill from a book.

Creates the basic structure for a book-based skill:
- SKILL.md (template)
- progress.md (with phases)
- guidelines.md (template)
- references/ directory

Usage:
    python init-book-skill.py <skill-name> <output-path> [--categories cat1,cat2,...]

Example:
    python init-book-skill.py clean-code ./skills/clean-code --categories naming,functions,classes
"""

import argparse
import os
from pathlib import Path
from datetime import datetime


def create_skill_md(skill_name: str, categories: list[str]) -> str:
    """Generate SKILL.md content."""
    category_table = "\n".join(
        f"| {cat} | `references/{cat}/` | [description] |"
        for cat in categories
    )
    
    return f'''---
name: {skill_name}
description: |
  [Brief description of what this skill provides]
  
  Use this skill when:
  - [Trigger condition 1]
  - [Trigger condition 2]
  - [Trigger condition 3]
---

# {skill_name.replace("-", " ").title()}

[One paragraph overview of the skill and its purpose]

## Quick Start

1. Check `guidelines.md` for which files to load
2. Load only the files relevant to your task
3. Apply the knowledge to your work

## Contents

### References

| Category | Path | Purpose |
|----------|------|---------|
{category_table}

## How to Use

See `guidelines.md` for:
- Task-based file selection
- Code element mapping  
- Problem/symptom lookup
- Decision tree for common scenarios
'''


def create_progress_md(skill_name: str, categories: list[str]) -> str:
    """Generate progress.md content."""
    today = datetime.now().strftime("%Y-%m-%d")
    
    category_sections = ""
    total_files = 3  # SKILL.md, progress.md, guidelines.md
    
    for i, cat in enumerate(categories, start=2):
        category_sections += f'''
## Phase {i}: {cat.title()}

Source: [Chapter X, lines N-M]

- [ ] {cat}/{cat}-rules.md
- [ ] {cat}/{cat}-examples.md
'''
        total_files += 2
    
    return f'''# {skill_name.replace("-", " ").title()} - Creation Progress

Created: {today}
Last Updated: {today}

## Status Overview

| Phase | Description | Complete |
|-------|-------------|----------|
| 1 | Foundation | 0/3 |
{chr(10).join(f"| {i+2} | {cat.title()} | 0/2 |" for i, cat in enumerate(categories))}
| **Total** | | **0/{total_files}** |

## Legend

- [ ] Not started
- [~] In progress
- [x] Completed
- [-] Skipped

## Phase 1: Foundation

- [ ] SKILL.md - Main skill file
- [ ] progress.md - This file
- [ ] guidelines.md - Use case routing
{category_sections}

## Notes

[Add any decisions, blockers, or context for future sessions]
'''


def create_guidelines_md(skill_name: str, categories: list[str]) -> str:
    """Generate guidelines.md template."""
    
    by_task_rows = "\n".join(
        f"| [Task related to {cat}] | `references/{cat}/{cat}-rules.md` |"
        for cat in categories
    )
    
    by_element_rows = "\n".join(
        f"| [{cat.title()}] | `{cat}/{cat}-rules.md` | `{cat}/{cat}-examples.md` |"
        for cat in categories
    )
    
    file_index = ""
    for cat in categories:
        file_index += f'''
### {cat.title()}

| File | Purpose | Lines |
|------|---------|-------|
| `{cat}-rules.md` | Core rules for {cat} | ~100 |
| `{cat}-examples.md` | Code examples | ~150 |
'''
    
    return f'''# {skill_name.replace("-", " ").title()} Guidelines

Quick reference for finding the right knowledge file.

**How to use**: Find your situation below, then load ONLY the listed files.

---

## By Task

### Code Review

| Reviewing... | Load these files |
|--------------|------------------|
{by_task_rows}

### Writing Code

| Creating... | Load these files |
|-------------|------------------|
| [New component] | `references/[category]/[topic]-rules.md` |

### Refactoring

| Problem | Load these files |
|---------|------------------|
| [Issue type] | `references/[category]/[topic]-rules.md` |

---

## By Code Element

| Working with... | Primary | Secondary |
|-----------------|---------|-----------|
{by_element_rows}

---

## By Problem/Symptom

| If you notice... | Load these files |
|------------------|------------------|
| [Symptom 1] | `references/[file].md` |
| [Symptom 2] | `references/[file].md` |

---

## Decision Tree

```
What are you doing?
│
├─► Reviewing code?
│   └─► What aspect? → [relevant files]
│
├─► Writing new code?
│   └─► What type? → [relevant files]
│
└─► Refactoring?
    └─► What problem? → [relevant files]
```

---

## File Index
{file_index}

---

## Common Combinations

| Scenario | Files to load |
|----------|---------------|
| [Common task 1] | `[file1]` + `[file2]` |
| [Common task 2] | `[file1]` + `[file2]` |
'''


def init_skill(skill_name: str, output_path: str, categories: list[str]) -> None:
    """Initialize a new book skill structure."""
    
    base_path = Path(output_path)
    
    # Create directories
    base_path.mkdir(parents=True, exist_ok=True)
    (base_path / "references").mkdir(exist_ok=True)
    
    for cat in categories:
        (base_path / "references" / cat).mkdir(exist_ok=True)
    
    # Create files
    files = {
        "SKILL.md": create_skill_md(skill_name, categories),
        "progress.md": create_progress_md(skill_name, categories),
        "guidelines.md": create_guidelines_md(skill_name, categories),
    }
    
    for filename, content in files.items():
        filepath = base_path / filename
        filepath.write_text(content)
        print(f"Created: {filepath}")
    
    # Create placeholder files in each category
    for cat in categories:
        for suffix in ["rules", "examples"]:
            filepath = base_path / "references" / cat / f"{cat}-{suffix}.md"
            filepath.write_text(f"# {cat.title()} {suffix.title()}\n\nTODO: Extract from book\n")
            print(f"Created: {filepath}")
    
    print(f"\nSkill initialized at: {base_path}")
    print(f"Total files created: {len(files) + len(categories) * 2}")
    print("\nNext steps:")
    print("1. Update SKILL.md with book-specific description")
    print("2. Fill in progress.md with source chapter references")
    print("3. Begin extraction tasks for each category")


def main():
    parser = argparse.ArgumentParser(
        description="Initialize a new skill from a book"
    )
    parser.add_argument(
        "skill_name",
        help="Name of the skill (e.g., clean-code)"
    )
    parser.add_argument(
        "output_path", 
        help="Path where skill will be created"
    )
    parser.add_argument(
        "--categories",
        "-c",
        default="principles,concepts,examples",
        help="Comma-separated list of categories (default: principles,concepts,examples)"
    )
    
    args = parser.parse_args()
    
    categories = [c.strip() for c in args.categories.split(",")]
    
    init_skill(args.skill_name, args.output_path, categories)


if __name__ == "__main__":
    main()
