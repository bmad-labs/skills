---
name: 'step-05-error-handling'
description: 'Review error handling — exceptions, null safety, context'
nextStepFile: './step-06-tests.md'
referenceFiles:
  - 'references/error-handling/rules.md'
  - 'references/smells/rules.md'
---

# Step 5: Check Error Handling

## STEP GOAL

Review error handling patterns in the target code for proper exception usage, null safety, and error context.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

Check all error handling in the target code:

1. **Exceptions over codes**: Using exceptions, not error codes?
2. **No null returns**: Returning empty collections or Optional instead?
3. **No null passes**: Not passing null to functions?
4. **Context**: Exceptions include enough context?
5. **Normal flow**: Happy path is clear and uncluttered?

### Red Flags

Watch for and report:
- Returning null
- Swallowing exceptions silently
- Error handling mixed with business logic

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 5: Error Handling
======================

<label> (<decoration>): location (file:line)
  - Problem: description
  - Pattern: null return / swallowed exception / mixed logic
  - Suggestion: fix description
  Rule: error-handling/rules.md — Rule N

Summary: N error paths reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every error path in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 6: Tests**

## FRONTMATTER UPDATE

Update the output document:
- Add `5` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-06-tests.md`.
