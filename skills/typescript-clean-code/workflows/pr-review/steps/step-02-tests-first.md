---
name: 'step-02-tests-first'
description: 'Review tests first — coverage, meaningfulness, edge cases'
nextStepFile: './step-03-high-level.md'
referenceFiles:
  - 'references/unit-tests/rules.md'
  - 'references/tdd/rules.md'
  - 'references/smells/rules.md'
---

# Step 2: Review the Tests First

## STEP GOAL

Understand what the code should do by reading the tests first. Verify test coverage, meaningfulness, and edge case handling.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

1. **Check test coverage** for new/changed code
2. **Read test names** to understand expected behavior
3. **Verify tests are meaningful** (not just coverage padding)
4. **Look for missing test cases**

### Questions to Answer

- Do tests cover the acceptance criteria?
- Are edge cases tested?
- Are error cases handled?
- Would the tests catch regressions?

### Red Flags

Watch for and report:
- No tests for new functionality
- Tests that don't actually assert anything
- Tests that test implementation, not behavior

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 2: Tests First
===================

Test Coverage:
  - New code covered: YES/NO/PARTIAL
  - Edge cases: covered/missing: [list]
  - Error cases: covered/missing: [list]

<label> (<decoration>): test_name (file:line)
  - Problem: description
  Rule: unit-tests/rules.md — Rule N

Summary: N tests reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every test in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 3: High-Level Review**

## FRONTMATTER UPDATE

Update the output document:
- Add `2` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-03-high-level.md`.
