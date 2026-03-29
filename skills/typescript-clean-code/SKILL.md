---
name: typescript-clean-code
description: |
  Applies Robert C. Martin's Clean Code and Clean Coder principles to TypeScript. Enforces naming conventions, function size limits (2-5 lines ideal), SOLID principles, and a 50+ code smell catalog — all adapted for TypeScript with concrete thresholds from curated reference files.

  Use this skill when:
  - Improving naming clarity, function length, or class design in TypeScript
  - Detecting code smells (long methods, feature envy, data clumps, etc.)
  - Applying SOLID principles or DRY refactoring
  - Running TDD red-green-refactor cycles
  - Reviewing code or PRs against Clean Code standards
  - Estimating tasks with PERT or negotiating deadlines
---

# Clean Code

Principles, practices, and workflows for TypeScript developers.

## Reference-First Approach

**Before applying any principle, load the relevant `rules.md` and `examples.md` from `references/`.** Reference content overrides general knowledge — it contains TypeScript-specific thresholds, checklists, and smell catalogs. When making recommendations, cite specific rules (e.g., "per `references/functions/rules.md` Rule 1: Keep Functions Small, 2-5 lines ideal"). Prefer curated examples from reference files over generated ones. For multi-step tasks, load the corresponding workflow and follow each step.

## Quick Start

1. **For a task**: Check `guidelines.md` → find the right workflow → load it → follow each step
2. **For reference**: Load the specific `rules.md` and `examples.md` for the topic → apply them
3. **Follow the workflow**: Step-by-step process for consistent results

## Workflows

Step-by-step processes for common tasks:

| Workflow | When to Use |
|----------|-------------|
| `workflows/code-review/workflow.md` | Reviewing code for quality |
| `workflows/pr-review/workflow.md` | Reviewing pull requests |
| `workflows/tdd.md` | Test-driven development cycle |
| `workflows/refactoring/workflow.md` | Safe refactoring with tests |
| `workflows/new-feature.md` | Building new functionality |
| `workflows/bug-fix.md` | Fixing bugs properly |
| `workflows/test-strategy.md` | Planning test coverage |
| `workflows/estimation.md` | Estimating tasks (PERT) |
| `workflows/deadline-negotiation.md` | Handling unrealistic deadlines |

### Step-File Architecture (Code Review, PR Review, Refactoring)

The code review, PR review, and refactoring workflows use a **step-file architecture** for context-safe execution:

- Each workflow has a `workflow.md` entry point that describes steps and loads `steps/step-01-init.md`
- Each step is a separate file in `steps/`, loaded sequentially
- Progress is tracked via `stepsCompleted` array in the output document's YAML frontmatter
- If context is compacted mid-workflow, `step-01-init.md` detects the existing output and `step-01b-continue.md` resumes from the last completed step
- Each step loads specific reference files before analysis and cites rules in findings
- The refactoring workflow includes a loop (steps 4-7) for iterative change-test-commit cycles

## Reference Categories

### Part 1: Code Quality (Clean Code book)

| Category | Files | Purpose |
|----------|-------|---------|
| naming | 3 | Variable, function, class naming |
| functions | 4 | Function design and review |
| classes | 3 | Class/module design |
| comments | 3 | Comment best practices |
| error-handling | 3 | Exception handling |
| unit-tests | 3 | Clean test principles |
| formatting | 3 | Code layout |
| smells | 3 | Code smell catalog (50+) |

### Part 2: Professional Practices (Clean Coder book)

| Category | Files | Purpose |
|----------|-------|---------|
| professionalism | 3 | Professional ethics |
| saying-no | 3 | Declining requests |
| commitment | 3 | Making promises |
| coding-practices | 3 | Daily habits, flow, debugging |
| tdd | 3 | TDD workflow and benefits |
| practicing | 3 | Deliberate practice |
| acceptance-testing | 3 | Requirements as tests |
| testing-strategies | 3 | Test pyramid |
| time-management | 3 | Meetings, focus |
| estimation | 3 | PERT estimation |
| pressure | 3 | Working under pressure |
| collaboration | 3 | Working with teams |

## Key Principles

### Code Quality
1. **Readability** → `references/formatting/rules.md`, `references/naming/rules.md`
2. **Single Responsibility** → `references/classes/rules.md`, `references/functions/rules.md`
3. **Small Units** → `references/functions/rules.md` (Rule 1: 2-5 lines ideal)
4. **Meaningful Names** → `references/naming/rules.md`
5. **DRY** → `references/smells/rules.md` (G5)
6. **Clean Tests** → `references/unit-tests/rules.md`

### Professional Practices
1. **Take Responsibility** → `references/professionalism/rules.md`
2. **Say No** → `references/saying-no/rules.md`
3. **Commit Clearly** → `references/commitment/rules.md`
4. **Estimates != Commitments** → `references/estimation/rules.md`
5. **Stay Clean Under Pressure** → `references/pressure/rules.md`

## Guidelines

See `guidelines.md` for:
- Task → workflow mapping
- Situation → reference file mapping
- Decision tree for common scenarios

## Inline Example: Naming Transformation

A quick before/after applying `references/naming/rules.md`:

```typescript
// Bad: unclear abbreviation, boolean without predicate
const d: number = getElapsed();
const status: boolean = check(user);

// Good: intention-revealing name, boolean reads as question
const elapsedDays: number = getElapsedSinceCreation();
const isEligibleForDiscount: boolean = hasActiveSubscription(user);
```

## Inline Example: TDD Red-Green-Refactor Cycle

Per `workflows/tdd.md`, every change follows three steps:

1. **Red** — Write a failing test: `it('rejects negative amounts', () => expect(() => transfer(-1)).toThrow());`
2. **Green** — Write the minimum code to pass: add an `if (amount < 0) throw ...` guard.
3. **Refactor** — Extract the guard into a reusable `assertPositive(amount)` helper, re-run tests to confirm green.
