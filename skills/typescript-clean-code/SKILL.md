---
name: typescript-clean-code
description: |
  Clean Code for TypeScript — code smell catalogs (Martin's per-line heuristics, Fowler's change-shape smells, TypeScript-native type smells), a linter-first detection policy, and step-by-step review, refactoring, TDD, and estimation workflows.

  Use when the user:
  - Writes, reviews, or refactors TypeScript/JavaScript code, or asks whether code is clean, maintainable, or well-designed
  - Names a smell — Shotgun Surgery, Feature Envy, Data Clumps, Long Method, Divergent Change, Duplicated Code, Large Class, Long Parameter List, Primitive Obsession, Message Chains, Dead Code, Speculative Generality, god class, copy-paste, stringly typed, premature abstraction
  - Asks about TypeScript type hygiene — `any` leakage, `as` assertions, non-null `!`, discriminated unions, exhaustiveness, strict flags, branded types
  - Asks what to enforce with lint or tsconfig versus what needs judgment, or names knip, jscpd, dependency-cruiser, typescript-eslint, type-coverage
  - Runs TDD, fixes a bug with test coverage, or plans test strategy
  - Estimates tasks, negotiates a deadline, or works through a commitment or team problem
---

# Clean Code

## The twelve change-shape smells

Shotgun Surgery · Feature Envy · Data Clumps · Long Method · Divergent Change ·
Duplicated Code · Large Class · Long Parameter List · Primitive Obsession ·
Message Chains · Dead Code · Speculative Generality

You know each one and its refactoring. The value is the checklist, not the
definitions — without the names a diff "looks fine"; with them you find the shape.
Run all twelve against any change you review or write.

## The smell catalog has four layers

Each examines a different unit, so each sees what the others miss.

| Load | Unit | For |
|------|------|-----|
| `references/smells/tooling.md` | the repository | **First, in every review.** Which smells a linter decides, so those become one "wire this into CI" finding instead of twenty hand-written ones |
| `references/smells/rules.md` | a line, a function | Per-line heuristics (C/E/F/G/N/T), plus the review posture and severity vocabulary that govern all four layers |
| `references/smells/fowler.md` | a modification | The twelve above — detection question, TypeScript remedy, and **when NOT to fix** for each |
| `references/smells/typescript.md` | a type | TS1-TS10: `any` leakage, assertion versus validation, exhaustiveness, strictness flags, branded types |

A diff can satisfy every rule in `rules.md` and still be badly shaped — that is what
`fowler.md` is for. Reviewing a change means all four.

## Review posture

Three rules that change output more than any catalog entry. Full text in
`references/smells/rules.md` → "Review posture".

1. **Approve when the change improves code health**, not when it is perfect. There
   is no perfect code, only better code.
2. **A correct finding nobody acts on is a false positive.** Scan broadly, report
   selectively — three actionable findings beat twenty true ones.
3. **Mark polish as ignorable.** Conventional Comments labels — `issue`,
   `suggestion`, `nitpick`, `question`, `praise` — with `(blocking)` /
   `(non-blocking)`. An author who cannot tell which comments are optional treats
   all of them as mandatory, or none of them.

**A review is done when** all four layers have run, every surviving finding carries
a label and (for an `issue`) a fix, and the report states how many findings were cut
as unlikely to be acted on.

## Contested rules

Three rules in these references are positions with live counter-arguments, marked
**contested** where they appear. Present both sides and prefer the author's
demonstrated reasoning over the number:

- **Function length** — `references/functions/rules.md` Rule 1. Detect by *"can I
  name each section?"*; the "2-5 lines" figure over-extracts when applied literally.
- **Comments** — `references/comments/rules.md`. Keep rationale, invariants, and
  non-obvious why; delete restatement and stale comments.
- **G23 polymorphism** — `references/smells/rules.md`. An exhaustive `switch` over a
  discriminated union is idiomatic TypeScript, not a smell.

## Workflows

Load the `workflow.md`, then its step files in order. Each step names the references
it needs and updates `stepsCompleted` in the output document's frontmatter, so a
compacted context resumes from the last completed step via `step-01b-continue.md`.

| Workflow | For |
|----------|-----|
| `workflows/code-review/workflow.md` | Reviewing code for quality |
| `workflows/pr-review/workflow.md` | Reviewing pull requests |
| `workflows/refactoring/workflow.md` | Safe refactoring with tests (step 3 sweeps all twelve; steps 5-8 loop) |
| `workflows/tdd.md` | Test-driven development cycle |
| `workflows/new-feature.md` | Building new functionality |
| `workflows/bug-fix.md` | Fixing bugs properly |
| `workflows/test-strategy.md` | Planning test coverage |
| `workflows/estimation.md` | Estimating tasks (PERT) |
| `workflows/deadline-negotiation.md` | Handling unrealistic deadlines |

## References

`references/<topic>/` holds `rules.md` (the rules), `examples.md` (curated
TypeScript bad/good pairs — prefer these over inventing your own), and
`knowledge.md` (concepts).

**Code quality**: naming · functions · classes · comments · error-handling ·
unit-tests · formatting · smells

**Professional practice**: professionalism · saying-no · commitment ·
coding-practices · tdd · practicing · acceptance-testing · testing-strategies ·
time-management · estimation · pressure · collaboration

Load the topic's `rules.md` before advising on it, and cite the rule you applied —
the design problem it names, not the metric that pointed at it. Where a reference
contradicts your general knowledge, the reference wins: it carries this skill's
TypeScript adaptations and thresholds.

`guidelines.md` maps symptom → reference file and task → workflow.
