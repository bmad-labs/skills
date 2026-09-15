---
name: 'step-04-class-design'
description: 'Review class/module design — SRP, cohesion, dependencies'
nextStepFile: './step-05-error-handling.md'
referenceFiles:
  - 'references/classes/rules.md'
  - 'references/smells/rules.md'
---

# Step 4: Check Class/Module Design

## STEP GOAL

Review classes and modules in the target code for single responsibility, cohesion, size, and proper dependency management.

Cite specific rules when reporting findings.

## ANALYSIS PROCESS

For each class/module in the target code, verify:

1. **Single Responsibility**: One reason to change?
2. **Cohesion**: Methods use most instance variables?
3. **Size**: Small and focused?
4. **Dependencies**: Depends on abstractions, not concretions?

### Red Flags

Watch for and report:
- God classes with many responsibilities
- Low cohesion (methods don't use shared state)
- Concrete dependencies that should be injected

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 4: Class/Module Design
============================

<label> (<decoration>): ClassName (file:line)
  - SRP: OK / MULTIPLE RESPONSIBILITIES: list
  - Cohesion: HIGH / LOW — reason
  - Dependencies: OK / CONCRETE: list
  Rule: classes/rules.md — Rule N

Summary: N class or modules reviewed, N reported, N cut as unlikely to be acted on
```

**This step is done when** every class or module in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 5: Error Handling**

## FRONTMATTER UPDATE

Update the output document:
- Add `4` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-05-error-handling.md`.
