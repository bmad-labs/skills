# Chapter Map - {BOOK_NAME}

This file maps the structure of the book and defines line ranges for each chapter in the raw markdown file.

**Source File**: `raw/book-parsed.md`
**Total Lines**: {TOTAL_LINES}
**Date Created**: {DATE}

---

## Chapter Structure

| Chapter | Output Filename | Start Line | End Line | Notes |
|---------|-----------------|------------|----------|-------|
| Front Matter | front-matter.md | 1 | TBD | Title page, copyright, dedication |
| Foreword | foreword.md | TBD | TBD | Author's preface |
| Preface | preface.md | TBD | TBD | Introduction to the book |
| Table of Contents | toc.md | TBD | TBD | Original TOC (optional) |
| Introduction | introduction.md | TBD | TBD | Book introduction |
| Chapter 1: {TITLE} | chapter-01-{slug}.md | TBD | TBD | |
| Chapter 2: {TITLE} | chapter-02-{slug}.md | TBD | TBD | |
| Chapter 3: {TITLE} | chapter-03-{slug}.md | TBD | TBD | |
| Chapter 4: {TITLE} | chapter-04-{slug}.md | TBD | TBD | |
| Chapter 5: {TITLE} | chapter-05-{slug}.md | TBD | TBD | |
| Chapter 6: {TITLE} | chapter-06-{slug}.md | TBD | TBD | |
| Chapter 7: {TITLE} | chapter-07-{slug}.md | TBD | TBD | |
| Chapter 8: {TITLE} | chapter-08-{slug}.md | TBD | TBD | |
| Chapter 9: {TITLE} | chapter-09-{slug}.md | TBD | TBD | |
| Chapter 10: {TITLE} | chapter-10-{slug}.md | TBD | TBD | |
| Appendix A: {TITLE} | appendix-a-{slug}.md | TBD | TBD | |
| Appendix B: {TITLE} | appendix-b-{slug}.md | TBD | TBD | |
| Bibliography | bibliography.md | TBD | TBD | References and citations |
| Index | index.md | TBD | TBD | Book index (optional) |
| About the Author | about-author.md | TBD | TBD | Author bio |

---

## Instructions for Filling This Template

### 1. Identify Chapter Boundaries

Read through `raw/book-parsed.md` and look for:
- Chapter headers (usually `# Chapter X:` or `## Chapter X:`)
- Section markers (horizontal rules, page breaks)
- Major heading changes

### 2. Record Line Numbers

For each section:
- Note the **start line** (first line of content)
- Note the **end line** (last line before next section)
- Use line numbers from the file (tools show line numbers)

### 3. Create Output Filenames

Follow this naming pattern:
- Front/back matter: `{section-name}.md` (e.g., `foreword.md`)
- Chapters: `chapter-{NN}-{slug}.md` (e.g., `chapter-01-introduction.md`)
- Appendices: `appendix-{X}-{slug}.md` (e.g., `appendix-a-references.md`)

**Slug**: Lowercase, hyphens instead of spaces, no special characters
- "Getting Started" → `getting-started`
- "Advanced Topics & Best Practices" → `advanced-topics-best-practices`

### 4. Add Notes

Use the Notes column for:
- Large chapters that might need splitting
- Sections with special formatting
- Content that needs manual review
- Any anomalies or issues found

---

## Example Completed Entry

```markdown
| Chapter 3: Functions | chapter-03-functions.md | 3370 | 4579 | Large chapter with many code examples |
```

---

## Tips

- **Use grep to find chapters**: `grep -n "^# Chapter" raw/book-parsed.md`
- **Count lines**: `wc -l raw/book-parsed.md`
- **Check ranges**: Ensure no gaps or overlaps between chapters
- **Validate**: Total of all chapters should match source file line count
- **Order matters**: List chapters in reading order (this determines merge order)

---

## Validation Checklist

Before proceeding to Phase 3:

- [ ] All chapters identified and mapped
- [ ] Line ranges are sequential (no gaps)
- [ ] Line ranges don't overlap
- [ ] Output filenames follow naming convention
- [ ] Front matter sections included
- [ ] Back matter sections included
- [ ] Notes added for special cases
- [ ] Total lines account for entire source file

---

*Template Version: 1.0*
