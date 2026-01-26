# Chapter Formatting Workflow for Subagents

## Overview

This document defines the workflow for formatting individual chapters from the Clean Code Collection book.

---

## Input Files

1. **Formatting Standards:** `books/MARKDOWN_BOOK_FORMATTING_STANDARDS.md`
2. **Fix Plan:** `books/clean-code/FORMATTING_FIX_PLAN.md`
3. **Source File:** `books/clean-code/clean-code-parsed.md`

## Output Files

1. **Chapter File:** `books/clean-code/clean-code/<chapter-name>.md`
2. **Progress File:** `books/clean-code/progress.md`

---

## Chapter Map

Use this to locate chapters in the source file:

### Book 1: Clean Code

| Chapter | Output Filename | Start Line | End Line |
|---------|-----------------|------------|----------|
| Front Matter | `front-matter.md` | 1 | 1467 |
| Foreword | `foreword.md` | 1468 | 1715 |
| Introduction | `introduction.md` | 1716 | 1933 |
| Chapter 1: Clean Code | `chapter-01-clean-code.md` | 1934 | 2654 |
| Chapter 2: Meaningful Names | `chapter-02-meaningful-names.md` | 2655 | 3369 |
| Chapter 3: Functions | `chapter-03-functions.md` | 3370 | 4579 |
| Chapter 4: Comments | `chapter-04-comments.md` | 4580 | 5819 |
| Chapter 5: Formatting | `chapter-05-formatting.md` | 5820 | 6687 |
| Chapter 6: Objects and Data Structures | `chapter-06-objects-and-data-structures.md` | 6688 | 7144 |
| Chapter 7: Error Handling | `chapter-07-error-handling.md` | 7145 | 7694 |
| Chapter 8: Boundaries | `chapter-08-boundaries.md` | 7695 | 8049 |
| Chapter 9: Unit Tests | `chapter-09-unit-tests.md` | 8050 | 8739 |
| Chapter 10: Classes | `chapter-10-classes.md` | 8740 | 9634 |
| Chapter 11: Systems | `chapter-11-systems.md` | 9635 | 10479 |
| Chapter 12: Emergence | `chapter-12-emergence.md` | 10480 | 10844 |
| Chapter 13: Concurrency | `chapter-13-concurrency.md` | 10845 | 11599 |
| Chapter 14: Successive Refinement | `chapter-14-successive-refinement.md` | 11600 | 16944 |
| Chapter 15: JUnit Internals | `chapter-15-junit-internals.md` | 16945 | 18693 |
| Chapter 16: Refactoring SerialDate | `chapter-16-refactoring-serialdate.md` | 18694 | 20317 |
| Chapter 17: Smells and Heuristics | `chapter-17-smells-and-heuristics.md` | 20318 | 24818 |
| Appendix A: Concurrency II | `appendix-a-concurrency-ii.md` | 24819 | 25368 |

### Book 2: The Clean Coder

| Chapter | Output Filename | Start Line | End Line |
|---------|-----------------|------------|----------|
| Front Matter | `coder-front-matter.md` | 25369 | 25521 |
| Foreword | `coder-foreword.md` | 25522 | 25864 |
| Pre-Requisite Introduction | `coder-introduction.md` | 25865 | 26949 |
| Chapter 1: Professionalism | `coder-chapter-01-professionalism.md` | 26950 | 27500 |
| Chapter 2: Saying No | `coder-chapter-02-saying-no.md` | 27501 | 28200 |
| Chapter 3: Saying Yes | `coder-chapter-03-saying-yes.md` | 28201 | 28700 |
| Chapter 4: Coding | `coder-chapter-04-coding.md` | 28701 | 29157 |
| Chapter 5: Test Driven Development | `coder-chapter-05-tdd.md` | 29158 | 29443 |
| Chapter 6: Practicing | `coder-chapter-06-practicing.md` | 29444 | 29810 |
| Chapter 7: Acceptance Testing | `coder-chapter-07-acceptance-testing.md` | 29811 | 30300 |
| Chapter 8: Testing Strategies | `coder-chapter-08-testing-strategies.md` | 30301 | 30773 |
| Chapter 9: Time Management | `coder-chapter-09-time-management.md` | 30774 | 31300 |
| Chapter 10: Estimation | `coder-chapter-10-estimation.md` | 31301 | 31778 |
| Chapter 11: Pressure | `coder-chapter-11-pressure.md` | 31779 | 32200 |
| Chapter 12: Collaboration | `coder-chapter-12-collaboration.md` | 32201 | 32514 |
| Chapter 13: Teams and Projects | `coder-chapter-13-teams-and-projects.md` | 32515 | 32900 |
| Chapter 14: Mentoring, Apprenticeship | `coder-chapter-14-mentoring.md` | 32901 | 34796 |
| Appendix A: Tooling | `coder-appendix-a-tooling.md` | 34797 | 35011 |

---

## Workflow Steps

### Step 1: Read Standards and Plan

Read and understand:
- `books/MARKDOWN_BOOK_FORMATTING_STANDARDS.md` - The formatting rules
- `books/clean-code/FORMATTING_FIX_PLAN.md` - Issue quick reference

### Step 2: Read Chapter from Source

Read the chapter content from `books/clean-code/clean-code-parsed.md` using the line ranges from the Chapter Map above.

### Step 3: Identify Issues

Scan the content for these issues (in priority order):

1. **Headers**
   - `**Title**` on its own line → Convert to `## Title` or `### Title`
   - `[Title]` on its own line → Convert to proper header
   
2. **Code Blocks**
   - Missing language identifier → Add `java` (or appropriate language)
   - Shattered blocks (code split across multiple blocks) → Merge into one
   - Backslash line continuations (`\` at EOL) → Remove and join properly
   - Array brackets as italics (`args*0*`) → Fix to `args[0]`

3. **Text & Paragraphs**
   - Split sentences (line breaks mid-sentence) → Join into paragraphs
   - `[text]` used for emphasis → Convert to `*text*`
   - Orphaned brackets on their own line → Fix appropriately
   
4. **Blockquotes**
   - Excessive nesting (`> > >`) → Simplify to single `>`
   - Quote attributions → Format as `> — Author Name`

5. **Footnotes**
   - Corrupted format (`^**[1**(#link)]{.small}^`) → Convert to `[^1]`
   - Add footnote definitions at chapter end

6. **Images**
   - Generic paths → Keep but note for later
   - Missing alt text → Add descriptive alt text

7. **Links**
   - Broken PDF links (`](#file.html_pos123)`) → Remove or fix to valid anchor

### Step 4: Create Output File

Write the corrected chapter to `books/clean-code/clean-code/<chapter-name>.md`

**File Structure:**
```markdown
# Chapter X: Title

[Chapter content with all fixes applied]

---

## Footnotes

[^1]: Footnote content here.
```

### Step 5: Update Progress

Update `books/clean-code/progress.md` with:
- Chapter name
- Completion status
- Summary of fixes made
- Any issues that need manual review

---

## Fix Examples

### Headers

```markdown
# BEFORE
**The Total Cost of Owning a Mess**

# AFTER
## The Total Cost of Owning a Mess
```

### Code Blocks

```markdown
# BEFORE (shattered with backslashes)
   public Money calculatePay(Employee e)\
   throws InvalidEmployeeType {\
       switch (e.type) {\

# AFTER (merged with language)
```java
public Money calculatePay(Employee e) throws InvalidEmployeeType {
    switch (e.type) {
        case COMMISSIONED:
            return calculateCommissionedPay(e);
        // ...
    }
}
```

### Text Emphasis

```markdown
# BEFORE
Have [you] ever been significantly impeded by bad code?

# AFTER
Have *you* ever been significantly impeded by bad code?
```

### Blockquotes

```markdown
# BEFORE
> > > [I like my code to be elegant and efficient.]

# AFTER
> "I like my code to be elegant and efficient."
>
> — Bjarne Stroustrup
```

### Footnotes

```markdown
# BEFORE
...too much time?^**[2**(#The_Robert_C._Martin_Clean_Code_split_032.html_filepos1147371)]{.small}^

# AFTER
...too much time?[^2]

## Footnotes

[^2]: Reference details here.
```

---

## Quality Checklist

Before marking a chapter complete, verify:

- [ ] All headers use proper `#` syntax
- [ ] All code blocks have language identifiers
- [ ] No shattered code blocks remain
- [ ] No backslash line continuations in code
- [ ] Text flows naturally (no mid-sentence breaks)
- [ ] Blockquotes are properly formatted
- [ ] Footnotes converted to standard format
- [ ] No orphaned brackets `[text]` remain
- [ ] Images have alt text

---

## Notes

- **Preserve content** - Never alter the meaning or remove content
- **When uncertain** - Keep original and note in progress file
- **Code accuracy** - Ensure code blocks are complete and syntactically valid
- **Large chapters** - Chapter 14 (Successive Refinement) is ~5,300 lines; may need to process in parts
