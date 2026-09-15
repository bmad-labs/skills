---
name: 'step-02-function-quality'
description: 'Review function quality — size, SRP, arguments, side effects'
nextStepFile: './step-03-naming.md'
referenceFiles:
  - 'references/functions/rules.md'
  - 'references/functions/checklist.md'
  - 'references/smells/rules.md'
---

# Step 2: Check Function Quality

## STEP GOAL

Review every function in the target code for size, single responsibility, argument count, abstraction level consistency, and side effects.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

For each function in the target code, verify:

1. **Single Responsibility**: Does it do ONE thing? Test by naming its sections — if
   each section has a name, those are the functions that want to exist
2. **Size**: Graspable at a glance? Length is a trigger to look, not a finding on its
   own. `references/functions/rules.md` Rule 1 marks the "2-5 lines" figure contested
   and explains the over-extraction failure mode — read it before citing a number
3. **Abstraction Level**: Is it consistent throughout?
4. **Arguments**: Readable at the call site? Consecutive same-typed parameters are
   the signal, not the count
5. **Side Effects**: Are there hidden side effects?
6. **Name**: Does the name describe what it does, including its effects?

### Red Flags

Watch for and report:
- A function whose sections can each be named (report *that*, not the line count)
- Arguments you cannot identify at the call site; adjacent same-typed parameters
- Boolean flag arguments
- Output arguments
- Mixed abstraction levels

### Not a red flag

- A long function that is flat, linear, and un-branching — a builder, a config
  literal, an exhaustive mapping table. Splitting it produces shallow functions and
  moves the reader's cost rather than removing it.

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 2: Function Quality
========================

<label> (<decoration>): function_name (file:line)
  - Size: OK / TOO LARGE (N lines)
  - SRP: OK / MULTIPLE RESPONSIBILITIES
  - Arguments: OK / TOO MANY (N args)
  - Side Effects: NONE / FOUND: description
  Rule: functions/rules.md — Rule N

Summary: N functions reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every function in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 3: Naming**

## FRONTMATTER UPDATE

Update the output document:
- Add `2` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-03-naming.md`.
