---
name: 'step-08-smells'
description: 'Scan for code smells — per-line, change-shape, TypeScript-native'
nextStepFile: './step-09-feedback.md'
referenceFiles:
  - 'references/smells/tooling.md'
  - 'references/smells/rules.md'
  - 'references/smells/fowler.md'
  - 'references/smells/typescript.md'
---

# Step 8: Check for Smells

## STEP GOAL

Scan all four smell layers, then report only what the author would plausibly act on.

Load `tooling.md` first — it decides how much of the rest is even yours to reason
about. Cite the file and entry id in every finding.

## ANALYSIS PROCESS

### 8a. Establish what the tooling already covers

Read `package.json`, `eslint.config.*` / `.eslintrc*`, and `tsconfig.json`. Answer
each from the file, not from assumption:

- Is `knip` (or any dead-code detection) present?
- Does the ESLint config set `project` or `projectService`? Typed linting is the
  precondition for every `no-unsafe-*` rule.
- Is `@typescript-eslint/no-unsafe-type-assertion` enabled explicitly? It ships in
  **no** preset, `strict-type-checked` included.
- Does `tsconfig.json` set `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`? Both sit outside `strict`.

Whatever the tooling covers becomes zero findings. Whatever it fails to cover
becomes **one** finding against the project config.

### 8b. Per-line scan — `rules.md`

Scan the catalog for what survived 8a. Apply each entry's **when NOT to fix** field
before writing it down; that field is what keeps G5 from manufacturing the wrong
abstraction and G23 from flagging an idiomatic exhaustive switch.

### 8c. Change-shape scan — `fowler.md`

Run all twelve against the **change**, not the file:

Shotgun Surgery · Feature Envy · Data Clumps · Long Method · Divergent Change ·
Duplicated Code · Large Class · Long Parameter List · Primitive Obsession ·
Message Chains · Dead Code · Speculative Generality

The detection question for each is in `fowler.md`'s quick checklist. Shotgun
Surgery, Divergent Change, Data Clumps, Primitive Obsession, and Speculative
Generality are the ones a diff-shaped review misses most often.

### 8d. Type scan — `typescript.md`

Run TS1-TS10 when the target is TypeScript. TS1 (`any` leakage), TS3 (assertion
instead of validation), and TS7 (strictness assumed but not enabled) carry the most
weight, and 8a already gave you the evidence for TS7.

### 8e. Filter before reporting

Required, not polish. For each candidate ask: **would the author plausibly act on
this?** Cut every no. A correct finding nobody acts on is a false positive, and it
spends the trust that makes the next finding land.

Three actionable findings beat twenty true ones.

## PRESENT FINDINGS

Conventional Comments labels — see `rules.md` → Severity vocabulary.

```
Step 8: Code Smells
===================

Tooling coverage
  - knip: [present / absent]
  - typed linting: [enabled / not enabled]
  - no-unsafe-type-assertion: [enabled / not enabled — ships in no preset]
  - noUncheckedIndexedAccess / exactOptionalPropertyTypes: [set / not set]

Findings

issue (blocking): <short subject> (file:line)
  Why: <what breaks, or what future change this makes expensive>
  Fix: <concrete suggestion>
  Rule: smells/<file>.md — <id>

suggestion (non-blocking): <short subject> (file:line)
  ...

nitpick (non-blocking): <short subject> (file:line)
  ...

Considered and not reported: <N> findings judged unlikely to be acted on
Summary: N findings (X blocking, Y suggestions, Z nitpicks)
```

**This step is done when** all four layers have run, the tooling-coverage block is
filled from actual config files, and every reported finding survived 8e.

An empty findings list is a legitimate result — say so plainly.

Then ask: **[C] Continue to Step 9: Feedback**

## FRONTMATTER UPDATE

Update the output document:
- Add `8` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-09-feedback.md`.
