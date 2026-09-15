---
name: 'step-04-code-details'
description: 'Detailed code review — functions, naming, error handling, comments, smells'
nextStepFile: './step-05-security.md'
referenceFiles:
  - 'references/functions/rules.md'
  - 'references/naming/rules.md'
  - 'references/error-handling/rules.md'
  - 'references/comments/rules.md'
  - 'references/smells/rules.md'
---

# Step 4: Review the Code - Details

## STEP GOAL

Check code quality line by line across all changed files, applying the full code review checklist.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

For each changed file, check:

### Functions
- Small (5-20 lines)
- Do one thing
- Good names
- Few arguments

### Naming
- Intention-revealing
- Consistent terminology
- No abbreviations

### Error Handling
- Exceptions used properly
- No null returns
- Proper error context

### Comments
- Only necessary comments
- No commented-out code
- Comments are accurate

### Smells
- No duplication
- No feature envy
- No god classes

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 4: Code Details
====================

File: {{filename}}
  <label> (<decoration>): (line N) category: description
    Rule: {{category}}/rules.md — Rule N
    Suggestion: fix

File: {{filename}}
  ...

Summary: N changed files reviewed, N reported, N cut as unlikely to be acted on
  - Functions: N issues
  - Naming: N issues
  - Error Handling: N issues
  - Comments: N issues
  - Smells: N issues
```

**This step is done when** every changed file in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 5: Security**

## FRONTMATTER UPDATE

Update the output document:
- Add `4` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-05-security.md`.
