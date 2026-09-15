---
name: 'step-07-comments'
description: 'Review comments — necessity, accuracy, noise'
nextStepFile: './step-08-smells.md'
referenceFiles:
  - 'references/comments/rules.md'
  - 'references/smells/rules.md'
---

# Step 7: Check Comments

## STEP GOAL

Review all comments in the target code for necessity, accuracy, and noise.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

Check all comments in the target code:

1. **Necessary**: Could the code explain itself instead?
2. **Accurate**: Do comments match the code?
3. **No noise**: No redundant or obvious comments?
4. **No commented-out code**: Old code removed, not commented?

### Red Flags

Watch for and report:
- Comments explaining "what" instead of "why"
- Commented-out code blocks
- TODO comments that should be tickets
- Outdated comments

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 7: Comments
================

<label> (<decoration>): comment (file:line)
  - Problem: unnecessary / inaccurate / noise / dead code
  - Suggestion: remove / rewrite / convert to ticket
  Rule: comments/rules.md — Rule N

Summary: N comments reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every comment in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 8: Code Smells**

## FRONTMATTER UPDATE

Update the output document:
- Add `7` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-08-smells.md`.
