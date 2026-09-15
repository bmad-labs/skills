---
name: 'step-06-tests'
description: 'Review test quality — coverage, readability, FIRST principles'
nextStepFile: './step-07-comments.md'
referenceFiles:
  - 'references/unit-tests/rules.md'
  - 'references/smells/rules.md'
---

# Step 6: Check Tests

## STEP GOAL

Review tests for the target code — coverage, readability, single concept per test, and F.I.R.S.T. principles.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

Check all tests related to the target code:

1. **Coverage**: Are the changes tested?
2. **Readability**: Can you understand what's being tested?
3. **Single Concept**: One concept per test?
4. **F.I.R.S.T.**: Fast, Independent, Repeatable, Self-validating, Timely?
5. **Naming**: Test names describe the scenario?

### Red Flags

Watch for and report:
- No tests for new code
- Tests that test multiple things
- Tests that depend on each other
- Slow tests

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 6: Tests
=============

<label> (<decoration>): test_name (file:line)
  - Coverage: OK / MISSING for: description
  - Readability: OK / UNCLEAR: reason
  - F.I.R.S.T.: OK / VIOLATION: which principle
  Rule: unit-tests/rules.md — Rule N

Summary: N tests reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every test in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 7: Comments**

## FRONTMATTER UPDATE

Update the output document:
- Add `6` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-07-comments.md`.
