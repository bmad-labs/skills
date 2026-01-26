# Clean Code Collection - High-Quality Formatting Fix Plan

## Overview

- **File:** `clean-code-parsed.md`
- **Total Lines:** ~35,000
- **Content:** Two books combined
  - Book 1: *Clean Code: A Handbook of Agile Software Craftsmanship* (Lines 1-18,693)
  - Book 2: *The Clean Coder: A Code of Conduct for Professional Programmers* (Lines 25,369+)
- **Strategy:** Section-by-section manual review with AI assistance

---

## Quality Principles

1. **No blind automation** - Every change reviewed in context
2. **Preserve author intent** - Don't alter meaning or style
3. **Consistent formatting** - Follow the standards document
4. **Readable output** - Test in markdown preview
5. **Incremental progress** - Complete one section before moving to next

---

## Document Structure Map

### Book 1: Clean Code (Lines 1 - ~18,693)

| Section | Lines | Content |
|---------|-------|---------|
| Front Matter | 1-1363 | Cover, TOC, Copyright |
| Foreword | 1468-1715 | James O. Coplien |
| Introduction | 1716-1819 | |
| **Chapter 1:** Clean Code | 1934-2631 | |
| **Chapter 2:** Meaningful Names | 2655-3358 | |
| **Chapter 3:** Functions | 3370-4563 | Heavy code |
| **Chapter 4:** Comments | 4580-5803 | Code examples |
| **Chapter 5:** Formatting | 5820-6687 | Code examples |
| **Chapter 6:** Objects & Data Structures | 6688-7132 | |
| **Chapter 7:** Error Handling | 7145-7680 | Code examples |
| **Chapter 8:** Boundaries | 7695-8032 | |
| **Chapter 9:** Unit Tests | 8050-8724 | Heavy code |
| **Chapter 10:** Classes | 8740-9616 | Heavy code |
| **Chapter 11:** Systems | 9635-10465 | Code examples |
| **Chapter 12:** Emergence | 10480-10830 | |
| **Chapter 13:** Concurrency | 10845-11586 | |
| **Chapter 14:** Successive Refinement | 11600-16931 | **Very heavy code** |
| **Chapter 15:** JUnit Internals | 16945-18657 | Heavy code |
| **Chapter 16:** Refactoring SerialDate | 18670-? | Heavy code |
| **Chapter 17:** Smells and Heuristics | ?-? | |
| **Appendix A:** Concurrency II | 18694-20317 | |
| **Appendix B:** org.jfree.date.SerialDate | 20318-20510 | |
| **Appendix C:** Cross References | 20511-? | |

### Book 2: The Clean Coder (Lines 25,369+)

| Section | Start Line | Content |
|---------|------------|---------|
| Front Matter | 25369 | Cover, TOC |
| Foreword | 25522 | |
| Chapters 1-14 | 25865+ | Professional conduct |
| Appendix A | 34977+ | |

---

## Work Units

Each unit is a focused task that can be completed in one session (30-60 min).

### Phase 1: Front Matter & TOC (Priority: HIGH)

| Unit | Section | Task | Est. Time |
|------|---------|------|-----------|
| 1.1 | Lines 1-95 | Fix cover, title, copyright formatting | 20 min |
| 1.2 | Lines 96-1363 | **Rebuild TOC completely** - proper links | 60 min |
| 1.3 | Lines 1364-1467 | Fix book title page | 15 min |
| 1.4 | Lines 1468-1819 | Fix Foreword & Introduction | 30 min |

### Phase 2: Book 1 Chapters (Priority: HIGH)

| Unit | Chapter | Lines | Code Density | Est. Time |
|------|---------|-------|--------------|-----------|
| 2.1 | Ch 1: Clean Code | 1934-2631 | Low | 30 min |
| 2.2 | Ch 2: Meaningful Names | 2655-3358 | Medium | 40 min |
| 2.3 | Ch 3: Functions | 3370-4563 | **High** | 60 min |
| 2.4 | Ch 4: Comments | 4580-5803 | High | 50 min |
| 2.5 | Ch 5: Formatting | 5820-6687 | High | 45 min |
| 2.6 | Ch 6: Objects & Data | 6688-7132 | Medium | 30 min |
| 2.7 | Ch 7: Error Handling | 7145-7680 | High | 40 min |
| 2.8 | Ch 8: Boundaries | 7695-8032 | Medium | 25 min |
| 2.9 | Ch 9: Unit Tests | 8050-8724 | **High** | 50 min |
| 2.10 | Ch 10: Classes | 8740-9616 | **High** | 55 min |
| 2.11 | Ch 11: Systems | 9635-10465 | High | 50 min |
| 2.12 | Ch 12: Emergence | 10480-10830 | Medium | 25 min |
| 2.13 | Ch 13: Concurrency | 10845-11586 | Medium | 40 min |
| 2.14 | Ch 14: Successive Refinement | 11600-16931 | **Very High** | 120 min |
| 2.15 | Ch 15: JUnit Internals | 16945-18657 | **High** | 90 min |
| 2.16 | Ch 16: Refactoring | 18670-? | **High** | 90 min |
| 2.17 | Ch 17: Smells & Heuristics | ?-? | Low | 45 min |

### Phase 3: Book 1 Appendices

| Unit | Section | Est. Time |
|------|---------|-----------|
| 3.1 | Appendix A: Concurrency II | 60 min |
| 3.2 | Appendix B: SerialDate | 30 min |
| 3.3 | Appendix C: Cross References | 30 min |

### Phase 4: Book 2 - The Clean Coder

| Unit | Section | Est. Time |
|------|---------|-----------|
| 4.1 | Front Matter & TOC | 45 min |
| 4.2 | Chapters 1-4 | 60 min |
| 4.3 | Chapters 5-8 | 60 min |
| 4.4 | Chapters 9-12 | 60 min |
| 4.5 | Chapters 13-14 & Appendix | 45 min |

---

## Per-Unit Workflow

For each work unit, follow this process:

### Step 1: Read & Identify Issues
```
1. Read the section in raw markdown
2. Note specific issues with line numbers
3. Categorize issues (header, code block, text, etc.)
```

### Step 2: Fix by Category (in order)

1. **Headers** - Convert `**Title**` to proper `## Title`
2. **Code Blocks** - Merge shattered blocks, add language tags
3. **Text** - Join split paragraphs, fix brackets `[text]` → `*text*`
4. **Blockquotes** - Simplify nesting, fix quote attributions
5. **Footnotes** - Convert `^**[1**` to `[^1]`
6. **Links** - Fix internal references
7. **Images** - Add alt text, verify paths

### Step 3: Verify
```
1. Preview in markdown renderer
2. Check code syntax highlighting works
3. Verify no broken formatting
```

### Step 4: Mark Complete
```
Update progress tracker below
```

---

## Issue Quick Reference

| Issue | Pattern | Fix |
|-------|---------|-----|
| Bold header | `**Title**` alone on line | `## Title` |
| Bracket text | `[text]` for emphasis | `*text*` |
| Split paragraph | Line breaks mid-sentence | Join lines |
| Backslash EOL | `text\` | Remove `\`, join if needed |
| Nested quotes | `> > > text` | `> text` (usually) |
| Bad footnote | `^**[1**(#link)]{.small}^` | `[^1]` |
| Broken TOC link | `](#file.html_pos123)` | `](#section-anchor)` |
| Code no language | ` ``` ` | ` ```java ` |
| Shattered code | Multiple blocks = 1 listing | Merge into single block |

---

## Progress Tracker

### Phase 1: Front Matter
- [ ] 1.1 Cover & Copyright (Lines 1-95)
- [ ] 1.2 Table of Contents (Lines 96-1363)
- [ ] 1.3 Book Title Page (Lines 1364-1467)
- [ ] 1.4 Foreword & Introduction (Lines 1468-1819)

### Phase 2: Book 1 Chapters
- [ ] 2.1 Chapter 1: Clean Code
- [ ] 2.2 Chapter 2: Meaningful Names
- [ ] 2.3 Chapter 3: Functions
- [ ] 2.4 Chapter 4: Comments
- [ ] 2.5 Chapter 5: Formatting
- [ ] 2.6 Chapter 6: Objects & Data Structures
- [ ] 2.7 Chapter 7: Error Handling
- [ ] 2.8 Chapter 8: Boundaries
- [ ] 2.9 Chapter 9: Unit Tests
- [ ] 2.10 Chapter 10: Classes
- [ ] 2.11 Chapter 11: Systems
- [ ] 2.12 Chapter 12: Emergence
- [ ] 2.13 Chapter 13: Concurrency
- [ ] 2.14 Chapter 14: Successive Refinement
- [ ] 2.15 Chapter 15: JUnit Internals
- [ ] 2.16 Chapter 16: Refactoring SerialDate
- [ ] 2.17 Chapter 17: Smells and Heuristics

### Phase 3: Book 1 Appendices
- [ ] 3.1 Appendix A: Concurrency II
- [ ] 3.2 Appendix B: SerialDate
- [ ] 3.3 Appendix C: Cross References

### Phase 4: Book 2 - The Clean Coder
- [ ] 4.1 Front Matter & TOC
- [ ] 4.2 Chapters 1-4
- [ ] 4.3 Chapters 5-8
- [ ] 4.4 Chapters 9-12
- [ ] 4.5 Chapters 13-14 & Appendix

---

## Estimated Total Time

| Phase | Units | Time |
|-------|-------|------|
| Phase 1 | 4 | ~2 hours |
| Phase 2 | 17 | ~15 hours |
| Phase 3 | 3 | ~2 hours |
| Phase 4 | 5 | ~4.5 hours |
| **Total** | **29** | **~23.5 hours** |

---

## Session Log

| Date | Unit | Status | Notes |
|------|------|--------|-------|
| | | | |

---

## How to Use This Plan

### Option A: Work with AI Assistant
1. Tell me which unit to work on: "Let's do Unit 2.3 - Chapter 3: Functions"
2. I'll read the section and identify all issues
3. I'll fix them one by one with your approval
4. We mark it complete and move to next unit

### Option B: Work Independently
1. Use this plan as a checklist
2. Follow the per-unit workflow
3. Reference the formatting standards document
4. Mark progress in the tracker

### Option C: Hybrid
1. I identify issues and propose fixes
2. You review and approve/modify
3. I apply the changes
4. We verify together

---

*Plan Created: 2026-01-26*
*Last Updated: 2026-01-26*
