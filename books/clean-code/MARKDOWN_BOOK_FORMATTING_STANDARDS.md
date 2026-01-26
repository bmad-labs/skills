# Markdown Book Formatting Standards

A comprehensive guide for formatting technical books (especially those containing code) converted from PDF to Markdown.

---

## Table of Contents

1. [Document Structure](#1-document-structure)
2. [Table of Contents (TOC)](#2-table-of-contents-toc)
3. [Headers](#3-headers)
4. [Text and Paragraphs](#4-text-and-paragraphs)
5. [Code Blocks](#5-code-blocks)
6. [Inline Code](#6-inline-code)
7. [Blockquotes](#7-blockquotes)
8. [Lists](#8-lists)
9. [Images and Figures](#9-images-and-figures)
10. [Links and Cross-References](#10-links-and-cross-references)
11. [Footnotes and Citations](#11-footnotes-and-citations)
12. [Tables](#12-tables)
13. [Special Characters and Symbols](#13-special-characters-and-symbols)
14. [Common PDF Conversion Issues](#14-common-pdf-conversion-issues)

---

## 1. Document Structure

### 1.1 Book Hierarchy

```
Book Title (H1)
├── Front Matter (Preface, Acknowledgments, etc.)
├── Part I: Title (H1 with prefix)
│   ├── Chapter 1: Title (H1)
│   │   ├── Section (H2)
│   │   │   ├── Subsection (H3)
│   │   │   │   └── Sub-subsection (H4)
```

### 1.2 File Organization

- **Single-file books:** Use clear chapter separators with horizontal rules (`---`)
- **Multi-file books:** One file per chapter with consistent naming: `chapter-01-title.md`
- **Assets:** Store images in a dedicated folder: `images/` or `book-name-images/`

### 1.3 Spacing Rules

- One blank line between paragraphs
- Two blank lines before chapter headers (H1)
- One blank line before and after:
  - Headers (H2, H3, H4)
  - Code blocks
  - Blockquotes
  - Lists
  - Images
  - Horizontal rules

---

## 2. Table of Contents (TOC)

### 2.1 Standard TOC Format

```markdown
## Table of Contents

- [Chapter 1: Introduction](#chapter-1-introduction)
  - [1.1 Background](#11-background)
  - [1.2 Motivation](#12-motivation)
- [Chapter 2: Getting Started](#chapter-2-getting-started)
  - [2.1 Installation](#21-installation)
    - [Prerequisites](#prerequisites)
    - [Setup Steps](#setup-steps)
```

### 2.2 TOC Rules

- Use unordered lists with hyphens (`-`)
- Indent sub-items with 2 spaces
- Link text should match header text exactly
- Anchors use lowercase with hyphens replacing spaces
- Remove special characters from anchors: `Chapter 1: Title` → `#chapter-1-title`

### 2.3 Avoid These Common Conversion Issues

```markdown
# BAD - Broken links from PDF conversion
[[Chapter 1: Clean Code]](#The_Robert_C._Martin_Clean_Code_split_010.html_filepos84895)
> [[Section Title]](#broken_anchor)

# GOOD - Clean markdown links
- [Chapter 1: Clean Code](#chapter-1-clean-code)
  - [Section Title](#section-title)
```

---

## 3. Headers

### 3.1 Header Levels

| Level | Usage | Example |
|-------|-------|---------|
| H1 (`#`) | Book title, Chapter titles | `# Chapter 1: Clean Code` |
| H2 (`##`) | Major sections | `## The Boy Scout Rule` |
| H3 (`###`) | Subsections | `### Code Examples` |
| H4 (`####`) | Sub-subsections | `#### Edge Cases` |
| H5+ | Rarely used; consider restructuring | - |

### 3.2 Header Formatting Rules

```markdown
# GOOD
# Chapter 1: Clean Code
## Use Intention-Revealing Names
### Hungarian Notation

# BAD - Using bold instead of headers
**The Total Cost of Owning a Mess**

# BAD - Brackets from PDF conversion
[The Grand Redesign in the Sky]
[[What Is Clean Code?]]
```

### 3.3 Chapter Header Format

```markdown
---

# Chapter 3: Functions

> *"The first rule of functions is that they should be small."*

## Introduction

Content begins here...
```

---

## 4. Text and Paragraphs

### 4.1 Paragraph Rules

- Each paragraph is a continuous block of text
- Join lines that were split mid-sentence during PDF conversion
- One blank line between paragraphs
- No trailing whitespace at end of lines

### 4.2 Text Emphasis

| Style | Markdown | Usage |
|-------|----------|-------|
| Bold | `**text**` | Key terms, important concepts |
| Italic | `*text*` | Emphasis, book titles, first use of terms |
| Bold+Italic | `***text***` | Rare; strong emphasis |
| ~~Strikethrough~~ | `~~text~~` | Deprecated content |

### 4.3 Common Text Issues to Fix

```markdown
# BAD - Split sentences from PDF conversion
We've all looked at the mess we've just made and then have chosen to
leave it for another day. We've all felt the relief of seeing our messy
program work and deciding that a
working
mess is better than nothing.

# GOOD - Joined sentences
We've all looked at the mess we've just made and then have chosen to leave it for another day. We've all felt the relief of seeing our messy program work and deciding that a working mess is better than nothing.

# BAD - Bracket artifacts
[you] ever been significantly impeded by bad code?
the mess will slow you down [instantly]

# GOOD - Clean emphasis
Have *you* ever been significantly impeded by bad code?
the mess will slow you down *instantly*
```

### 4.4 Line Breaks

- **Soft break (same paragraph):** End line with two spaces or `<br>`
- **Hard break (new paragraph):** Blank line between text blocks
- **Avoid:** Backslash line continuations (`\`) unless intentional

---

## 5. Code Blocks

### 5.1 Fenced Code Block Format

Always use fenced code blocks with language identifier:

````markdown
```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```
````

### 5.2 Supported Language Identifiers

| Language | Identifier |
|----------|------------|
| Java | `java` |
| Python | `python` |
| JavaScript | `javascript` or `js` |
| TypeScript | `typescript` or `ts` |
| C/C++ | `c`, `cpp` |
| C# | `csharp` |
| Shell/Bash | `bash` or `shell` |
| SQL | `sql` |
| XML | `xml` |
| JSON | `json` |
| YAML | `yaml` |
| Plain text | `text` or `plaintext` |

### 5.3 Code Block Rules

1. **Always specify language** for syntax highlighting
2. **Consistent indentation:** Use 4 spaces (not tabs)
3. **No trailing whitespace** inside code blocks
4. **Preserve original formatting** when possible

### 5.4 Listing Titles

Place listing titles in a blockquote immediately above the code block:

````markdown
> *Listing 3-1* `HtmlUtil.java`

```java
public static String testableHtml(
        PageData pageData,
        boolean includeSuiteSetup) throws Exception {
    // ...
}
```
````

### 5.5 Common Code Block Issues to Fix

````markdown
# BAD - Missing language identifier
```
public class Foo {
}
```

# BAD - Shattered code blocks (common PDF conversion issue)
```
public Money calculatePay(Employee e)
```
throws InvalidEmployeeType {
```
    switch (e.type) {
```

# GOOD - Single cohesive block
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

# BAD - Backslash continuations from PDF conversion
   public static String renderPageWith\
       SetupsAndTeardowns(\
   PageData pageData, boolean isSuite) throws Exception {\

# GOOD - Clean code
```java
public static String renderPageWithSetupsAndTeardowns(
        PageData pageData, boolean isSuite) throws Exception {
    // ...
}
```

# BAD - Array brackets converted to italics
args*0*, array*i*, map*key*

# GOOD
args[0], array[i], map[key]
````

---

## 6. Inline Code

### 6.1 When to Use Inline Code

Use backticks for:
- Variable names: `userName`
- Function/method names: `calculatePay()`
- Class names: `Employee`
- File names: `config.json`
- Command-line commands: `npm install`
- Keywords: `null`, `true`, `false`
- Short code snippets: `if (x > 0)`

### 6.2 Inline Code Rules

```markdown
# GOOD
The `getHtml()` method returns a `String` object.
Set the `includeSuiteSetup` parameter to `true`.

# BAD - Using formatting for code
The **getHtml()** method returns a *String* object.

# BAD - Double backticks or brackets from conversion
The ``getHtml()`` method...
The [`getHtml()`] method...
```

---

## 7. Blockquotes

### 7.1 Standard Blockquote Format

```markdown
> Clean code is simple and direct. Clean code reads like well-written
> prose. Clean code never obscures the designer's intent but rather is
> full of crisp abstractions and straightforward lines of control.
>
> — Grady Booch
```

### 7.2 Nested Blockquotes

```markdown
> First level quote
>
> > Second level (nested) quote
> >
> > > Third level (rarely needed)
```

### 7.3 Blockquote Usage

| Use Case | Example |
|----------|---------|
| Quotes from authors | `> "The only way to go fast is to go well."` |
| Important callouts | `> **Note:** This is important.` |
| Figure/listing captions | `> *Figure 1-1* Productivity vs. time` |
| Definitions | `> **Term:** Definition of the term.` |

### 7.4 Common Issues

```markdown
# BAD - Inconsistent quote markers
> > > [I like my code to be elegant and efficient. The logic should be
> > > straightforward to make it hard for bugs to hide...]

# GOOD - Clean single-level quote
> "I like my code to be elegant and efficient. The logic should be
> straightforward to make it hard for bugs to hide..."
>
> — Bjarne Stroustrup
```

---

## 8. Lists

### 8.1 Unordered Lists

```markdown
- First item
- Second item
  - Nested item (2 spaces indent)
  - Another nested item
- Third item
```

### 8.2 Ordered Lists

```markdown
1. First step
2. Second step
   1. Sub-step (3 spaces indent)
   2. Another sub-step
3. Third step
```

### 8.3 List Rules

- Use `-` for unordered lists (consistent with most style guides)
- Indent nested items with 2 spaces (unordered) or 3 spaces (ordered)
- Blank line before and after list blocks
- No blank lines between list items (unless multi-paragraph items)

### 8.4 Common Issues

```markdown
# BAD - Mixed list markers
* Item one
- Item two
+ Item three

# BAD - Incorrect nesting with blockquotes
> > [1.] First item
> > [2.] Second item

# GOOD
1. First item
2. Second item
```

---

## 9. Images and Figures

### 9.1 Image Syntax

```markdown
![Alt text description](images/figure-1-1.jpg)
```

### 9.2 Figure with Caption

```markdown
> *Figure 1-1* Productivity vs. time

![Productivity vs. time graph showing declining productivity as code mess grows](images/figure-1-1.jpg)
```

### 9.3 Image Rules

- Always include meaningful alt text for accessibility
- Use relative paths to image files
- Organize images in a dedicated folder
- Use descriptive file names: `figure-01-01-productivity-graph.jpg`

### 9.4 Common Issues

```markdown
# BAD - Generic path from PDF conversion
![](clean-code-md-images/images/00087.jpg)

# GOOD - Descriptive naming and alt text
![Productivity vs. time graph](images/ch01-figure-01-productivity.jpg)
```

---

## 10. Links and Cross-References

### 10.1 External Links

```markdown
[Link text](https://example.com)
[Link with title](https://example.com "Title text")
```

### 10.2 Internal Cross-References

```markdown
See [Chapter 3: Functions](#chapter-3-functions) for more details.
Refer to [Listing 3-1](#listing-3-1) above.
```

### 10.3 Reference-Style Links

```markdown
This is explained in [the documentation][docs].

[docs]: https://example.com/docs "Documentation"
```

### 10.4 Common Issues

```markdown
# BAD - Broken PDF conversion links
[[Listing 3-2]](#The_Robert_C._Martin_Clean_Code_split_012.html_filepos170445)

# GOOD - Clean internal reference
[Listing 3-2](#listing-3-2)
```

---

## 11. Footnotes and Citations

### 11.1 Footnote Syntax

```markdown
This is a statement that needs citation[^1].

Another claim requiring a reference[^2].

[^1]: First footnote content with source information.
[^2]: Second footnote content.
```

### 11.2 Bibliography Section

```markdown
## Bibliography

1. Martin, Robert C. *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall, 2008.
2. Fowler, Martin. *Refactoring: Improving the Design of Existing Code*. Addison-Wesley, 1999.
```

### 11.3 Common Issues

```markdown
# BAD - Corrupted footnote markers from PDF
^**[2**(#The_Robert_C._Martin_Clean_Code_split_032.html_filepos1147371)]{.small}^
*^1* This is a footnote

# GOOD - Clean footnotes
This needs a citation[^1].

[^1]: Source information here.
```

---

## 12. Tables

### 12.1 Standard Table Format

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### 12.2 Alignment

```markdown
| Left     | Center   | Right    |
|:---------|:--------:|---------:|
| text     | text     | text     |
```

### 12.3 Table Rules

- Header row is required
- Separator row with at least 3 dashes per column
- Pipes at start and end of rows
- Use alignment colons when needed

---

## 13. Special Characters and Symbols

### 13.1 Escaping Special Characters

| Character | Escaped | Usage |
|-----------|---------|-------|
| `*` | `\*` | When not for emphasis |
| `_` | `\_` | When not for emphasis |
| `` ` `` | `` \` `` | When not for code |
| `#` | `\#` | When not for headers |
| `[` `]` | `\[` `\]` | When not for links |
| `<` `>` | `\<` `\>` or `&lt;` `&gt;` | When not for HTML |

### 13.2 Common Symbols

| Symbol | Markdown/HTML |
|--------|---------------|
| Em dash (—) | `---` or `&mdash;` |
| En dash (–) | `--` or `&ndash;` |
| Ellipsis (…) | `...` or `&hellip;` |
| Copyright (©) | `&copy;` |
| Trademark (™) | `&trade;` |
| Registered (®) | `&reg;` |

---

## 14. Common PDF Conversion Issues

### 14.1 Issue Checklist

| Issue | Example | Fix |
|-------|---------|-----|
| Broken TOC links | `](#file.html_pos123)` | Use clean anchors `](#section-name)` |
| Shattered code blocks | Code split across multiple blocks | Merge into single fenced block |
| Line breaks in paragraphs | Random newlines mid-sentence | Join into continuous text |
| Bold as headers | `**Section Title**` | Use proper `##` headers |
| Brackets around text | `[emphasized text]` | Use `*emphasized text*` |
| Backslash continuations | `code line\` | Remove backslashes |
| Array bracket corruption | `array*0*` | Fix to `array[0]` |
| Footnote corruption | `^**[1**` | Fix to `[^1]` |
| Smart quotes | `"text"` | Optionally normalize to `"text"` |
| Non-breaking spaces | Hidden characters | Replace with regular spaces |
| Page numbers in text | `42\nContinued text` | Remove orphaned numbers |
| Headers/footers | Book title appearing in text | Remove repeated elements |

### 14.2 Search Patterns for Common Issues

Use these regex patterns to find issues:

```
# Broken PDF links
\]\(#[A-Za-z_]+\.html[^)]*\)

# Backslash line continuations
\\$

# Corrupted array brackets
\*\d+\*

# Corrupted footnotes
\^\*\*\[\d+

# Bold text that should be headers
^\*\*[A-Z][^*]+\*\*$

# Orphaned brackets
^\[[^\]]+\]$
```

---

## Quick Reference Card

```
# Headers
# H1 - Chapter Title
## H2 - Section
### H3 - Subsection

# Emphasis
*italic* or _italic_
**bold** or __bold__
`inline code`

# Code Block
```language
code here
```

# Links
[text](url)
[text](#anchor)

# Images
![alt text](path/to/image.jpg)

# Lists
- Unordered item
1. Ordered item

# Blockquote
> Quoted text

# Footnote
Text[^1]
[^1]: Footnote content

# Table
| H1 | H2 |
|----|-----|
| A  | B   |
```

---

*Document Version: 1.0*
*Last Updated: 2026-01-26*
