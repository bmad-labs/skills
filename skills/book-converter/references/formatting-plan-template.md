# Formatting Plan - {BOOK_NAME}

This document identifies common formatting issues found in the raw markdown and provides guidance for fixing them during Phase 3.

**Source File**: `raw/book-parsed.md`
**Analyzed**: {DATE}
**Book Type**: {BOOK_TYPE} (e.g., Technical, Narrative, Reference)

---

## Issue Summary

| Category | Count | Severity | Priority |
|----------|-------|----------|----------|
| Headers (bold → #) | TBD | High | 1 |
| Shattered code blocks | TBD | High | 1 |
| Split paragraphs | TBD | High | 2 |
| Missing code language IDs | TBD | Medium | 2 |
| Emphasis artifacts [word] | TBD | Medium | 3 |
| Corrupted footnotes | TBD | Medium | 3 |
| Missing image alt text | TBD | Low | 4 |
| Broken links | TBD | Low | 4 |

---

## Common Issues Found

### 1. Headers Using Bold Instead of Markdown

**Issue**: Section headers formatted as `**Bold Text**` instead of `## Header`

**Example Found**:
```markdown
**The Total Cost of Owning a Mess**

This is paragraph text...
```

**Fix**:
```markdown
## The Total Cost of Owning a Mess

This is paragraph text...
```

**Locations**: Throughout the book, especially in sections/subsections

**Search Pattern**: `^\*\*[A-Z][^*]+\*\*$`

---

### 2. Shattered Code Blocks

**Issue**: Code blocks split across multiple fenced blocks due to PDF conversion

**Example Found**:
```markdown
```
public Money calculatePay(Employee e)
```
throws InvalidEmployeeType {
```
    switch (e.type) {
```
```

**Fix**:
```markdown
```java
public Money calculatePay(Employee e) throws InvalidEmployeeType {
    switch (e.type) {
        case COMMISSIONED:
            return calculateCommissionedPay(e);
        // ...
    }
}
```
```

**Locations**: Chapters {LIST_CHAPTERS}

**Note**: Must add language identifier when merging

---

### 3. Split Paragraphs

**Issue**: Sentences broken mid-line due to PDF page breaks or line wrapping

**Example Found**:
```markdown
We've all looked at the mess we've just made and then have chosen to
leave it for another day. We've all felt the relief of seeing our messy
program work and deciding that a
working
mess is better than nothing.
```

**Fix**:
```markdown
We've all looked at the mess we've just made and then have chosen to leave it for another day. We've all felt the relief of seeing our messy program work and deciding that a working mess is better than nothing.
```

**Frequency**: Very common throughout (estimated {N} occurrences)

**Approach**: Manual review required - context-dependent

---

### 4. Missing Code Language Identifiers

**Issue**: Code blocks without language specified

**Example Found**:
````markdown
```
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
```
````

**Fix**:
````markdown
```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
```
````

**Languages in Book**: {LIST_LANGUAGES} (e.g., Java, Python, JavaScript, SQL, Bash)

**Approach**: Identify language from context and syntax

---

### 5. Emphasis Artifacts

**Issue**: Square brackets used for emphasis instead of asterisks

**Example Found**:
```markdown
Have [you] ever been significantly impeded by bad code?
The mess will slow you down [instantly].
```

**Fix**:
```markdown
Have *you* ever been significantly impeded by bad code?
The mess will slow you down *instantly*.
```

**Search Pattern**: `\[[a-z]+\]`

**Note**: Be careful not to change actual links like `[text](url)`

---

### 6. Corrupted Footnotes

**Issue**: Footnote markers corrupted during conversion

**Example Found**:
```markdown
...too much time?^**[2**(#link)]{.small}^
```

**Fix**:
```markdown
...too much time?[^2]

## Footnotes

[^2]: Reference details here.
```

**Search Pattern**: `\^\*\*\[\d+`

**Approach**: Convert to standard format, add definitions at chapter end

---

### 7. Missing Image Alt Text

**Issue**: Images with generic or missing alt text

**Example Found**:
```markdown
![](images/00087.jpg)
```

**Fix**:
```markdown
![Productivity vs. time graph showing declining productivity as code mess grows](images/ch01-productivity-graph.jpg)
```

**Approach**: Review context to write descriptive alt text

---

### 8. Broken PDF Links

**Issue**: Internal links with PDF-specific anchors

**Example Found**:
```markdown
See [Chapter 3](#The_Robert_C._Martin_Book_split_012.html_filepos170445)
```

**Fix**:
```markdown
See [Chapter 3](#chapter-3-functions)
```

**Search Pattern**: `\]\(#[A-Za-z_]+\.html`

**Approach**: Replace with clean markdown anchors

---

### 9. Backslash Line Continuations

**Issue**: Code blocks with backslash continuations from PDF

**Example Found**:
```java
public static String renderPageWith\
    SetupsAndTeardowns(\
    PageData pageData, boolean isSuite) \
```

**Fix**:
```java
public static String renderPageWithSetupsAndTeardowns(
    PageData pageData, boolean isSuite)
```

**Note**: Common in code blocks, remove and rejoin properly

---

### 10. Excessive Blockquote Nesting

**Issue**: Quotes with too many `>` levels from conversion

**Example Found**:
```markdown
> > > [I like my code to be elegant and efficient.]
```

**Fix**:
```markdown
> "I like my code to be elegant and efficient."
>
> — Bjarne Stroustrup
```

**Approach**: Simplify to single level, add attribution

---

## Book-Specific Issues

### Issue: {SPECIFIC_ISSUE_1}
**Description**: {DETAILS}
**Affected Chapters**: {CHAPTERS}
**Fix Approach**: {SOLUTION}

### Issue: {SPECIFIC_ISSUE_2}
**Description**: {DETAILS}
**Affected Chapters**: {CHAPTERS}
**Fix Approach**: {SOLUTION}

---

## Special Formatting Requirements

### Code Languages
Primary languages in this book:
- {LANGUAGE_1}: {USAGE_NOTES}
- {LANGUAGE_2}: {USAGE_NOTES}

### Mathematical Notation
- [ ] Book contains math formulas
- [ ] Requires LaTeX notation
- [ ] Example chapters: {CHAPTERS}

### Dialogue/Conversations
- [ ] Book contains dialogue
- [ ] Format as blockquotes
- [ ] Example chapters: {CHAPTERS}

### Tables
- [ ] Book contains tables
- [ ] Ensure proper markdown table format
- [ ] Example chapters: {CHAPTERS}

---

## Validation Rules

Apply these checks to every chapter:

1. **Headers**: All use `#` syntax, none use bold
2. **Code Blocks**: All have language identifiers
3. **Code Integrity**: No shattered blocks remain
4. **Text Flow**: Sentences read naturally without mid-breaks
5. **Emphasis**: Uses `*italic*` and `**bold**`, not `[brackets]`
6. **Footnotes**: Standard `[^N]` format with definitions
7. **Images**: All have descriptive alt text
8. **Links**: Clean anchors, no PDF artifacts
9. **Consistency**: Chapter follows same style as others

---

## Phase 3 Workflow Reminder

For each chapter:
1. Extract content using line ranges from CHAPTER_MAP.md
2. Apply fixes from this plan systematically
3. Follow references/chapter-workflow.md for detailed steps
4. Use references/formatting-standards.md for style rules
5. Update progress.md when complete

---

## Notes

- **Manual Review Required**: Paragraph joining requires context judgment
- **Code Accuracy Critical**: Ensure code blocks are syntactically complete
- **Preserve Meaning**: Never alter the author's intended message
- **When Uncertain**: Note in progress.md for manual review

---

*Template Version: 1.0*
