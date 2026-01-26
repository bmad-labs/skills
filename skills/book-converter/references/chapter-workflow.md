# Chapter Formatting Workflow for Subagents

## Overview

This document defines the workflow for formatting individual chapters from EPUB-converted books.

---

## Input Files

1. **Formatting Standards:** `references/formatting-standards.md`
2. **Chapter Map:** `CHAPTER_MAP.md` (created in Phase 2)
3. **Source File:** `raw/book-parsed.md` (pandoc output)
4. **Formatting Plan:** `FORMATTING_PLAN.md` (created in Phase 2)

## Output Files

1. **Chapter File:** `chapters/<chapter-name>.md`
2. **Progress File:** `progress.md`

---

## Chapter Map Reference

The `CHAPTER_MAP.md` file contains line ranges for each chapter:

```markdown
| Chapter | Output Filename | Start Line | End Line |
|---------|-----------------|------------|----------|
| Front Matter | front-matter.md | 1 | 150 |
| Foreword | foreword.md | 151 | 300 |
| Chapter 1: Title | chapter-01-title.md | 301 | 850 |
| Chapter 2: Title | chapter-02-title.md | 851 | 1400 |
...
```

Use this to locate and extract each chapter's content.

---

## Workflow Steps

### Step 1: Read Standards and Chapter Map

Read and understand:
- `references/formatting-standards.md` - Complete formatting rules
- `CHAPTER_MAP.md` - Line ranges for your assigned chapter
- `FORMATTING_PLAN.md` - Known issues to watch for

### Step 2: Extract Chapter Content

Read the chapter content from `raw/book-parsed.md` using the line ranges from the Chapter Map.

**Example:**
If Chapter 3 spans lines 1000-1500, read exactly those lines.

### Step 3: Identify Issues

Scan the content for these issues (in priority order):

1. **Headers**
   - `**Title**` on its own line → Convert to `## Title` or `### Title`
   - `[Title]` on its own line → Convert to proper header
   - All caps headers → Convert to title case with proper `#` syntax
   
2. **Code Blocks**
   - Missing language identifier → Add appropriate language (java, python, javascript, etc.)
   - Shattered blocks (code split across multiple blocks) → Merge into one
   - Backslash line continuations (`\` at EOL) → Remove and join properly
   - Array brackets as italics (`args*0*`) → Fix to `args[0]`

3. **Text & Paragraphs**
   - Split sentences (line breaks mid-sentence) → Join into paragraphs
   - `[text]` used for emphasis → Convert to `*text*`
   - Orphaned brackets on their own line → Fix appropriately
   - Double spaces → Convert to single space
   
4. **Blockquotes**
   - Excessive nesting (`> > >`) → Simplify to single `>`
   - Quote attributions → Format as `> — Author Name`
   - Missing quote marks → Add proper quotation marks

5. **Footnotes**
   - Corrupted format (`^**[1**(#link)]{.small}^`) → Convert to `[^1]`
   - Add footnote definitions at chapter end in `## Footnotes` section
   - Ensure all footnote references have corresponding definitions

6. **Images**
   - Missing alt text → Add descriptive alt text
   - Generic filenames → Keep path but improve alt text description
   - Broken image links → Note in progress file for manual review

7. **Links**
   - Broken PDF links (`](#file.html_pos123)`) → Remove or fix to valid anchor
   - Cross-references → Ensure anchors match actual headers
   - External URLs → Verify format is correct

8. **Lists**
   - Mixed bullet styles (`*`, `-`, `+`) → Standardize to `-`
   - Incorrect indentation → Fix to 2 spaces for nested items
   - Numbered lists → Ensure sequential numbering

### Step 4: Apply Formatting Fixes

Process the content systematically:

1. **First pass: Structure**
   - Convert all headers to proper `#` syntax
   - Merge shattered code blocks
   - Add language identifiers to all code blocks

2. **Second pass: Content**
   - Join split paragraphs
   - Fix emphasis artifacts
   - Clean up blockquotes
   - Standardize list formatting

3. **Third pass: Details**
   - Convert footnotes to standard format
   - Add image alt text
   - Fix links
   - Remove trailing whitespace

### Step 5: Create Output File

Write the corrected chapter to `chapters/<chapter-name>.md`

**File Structure:**
```markdown
# Chapter X: Title

[Chapter content with all fixes applied]

---

## Bibliography
[If present in source]

## Footnotes

[^1]: Footnote content here.
[^2]: Another footnote.
```

### Step 6: Update Progress

Update `progress.md` with:
- Chapter name marked as complete
- Date completed
- Summary of major fixes applied
- Any issues that need manual review

**Example entry:**
```markdown
- [x] Chapter 3: Advanced Topics - 2024-01-26
  - Fixed 47 split paragraphs
  - Merged 12 shattered code blocks
  - Converted 8 footnotes
  - Added alt text to 5 images
```

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
        case HOURLY:
            return calculateHourlyPay(e);
        default:
            throw new InvalidEmployeeType(e.type);
    }
}
```
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
...too much time?^**[2**(#link)]{.small}^

# AFTER
...too much time?[^2]

## Footnotes

[^2]: Reference details here.
```

### Split Paragraphs

```markdown
# BEFORE
We've all looked at the mess we've just made and then have chosen to
leave it for another day. We've all felt the relief of seeing our messy
program work and deciding that a
working
mess is better than nothing.

# AFTER
We've all looked at the mess we've just made and then have chosen to leave it for another day. We've all felt the relief of seeing our messy program work and deciding that a working mess is better than nothing.
```

---

## Quality Checklist

Before marking a chapter complete, verify:

- [ ] All headers use proper `#` syntax (not bold)
- [ ] All code blocks have language identifiers
- [ ] No shattered code blocks remain
- [ ] No backslash line continuations in code
- [ ] Text flows naturally (no mid-sentence breaks)
- [ ] Paragraphs are properly joined
- [ ] Blockquotes are properly formatted
- [ ] Footnotes converted to standard format
- [ ] All footnote references have definitions
- [ ] No orphaned brackets `[text]` remain
- [ ] Images have descriptive alt text
- [ ] Links use clean anchors
- [ ] Lists use consistent formatting
- [ ] No trailing whitespace

---

## Notes

- **Preserve content** - Never alter the meaning or remove content
- **When uncertain** - Keep original and note in progress file
- **Code accuracy** - Ensure code blocks are complete and syntactically valid
- **Large chapters** - Chapters >2,000 lines may need extra attention
- **Context matters** - Use judgment for ambiguous line breaks
- **Be thorough** - This is the only formatting pass for each chapter
