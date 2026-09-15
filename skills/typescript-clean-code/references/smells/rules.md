# Code Smells Reference

Catalog of code smells organized by category. Use for code review and refactoring.

**Read the three sections below before using the catalog.** They decide what you
report, not just what you look for. A catalog used without them produces correct
findings nobody acts on, which is the failure mode this reference is shaped to
avoid.

This file is the **per-line** layer: names, sizes, arguments, conditionals. A diff
can pass every rule here and still be badly shaped — that blind spot is `fowler.md`.
`typescript.md` covers type honesty, and `tooling.md` says which entries below a
tool already decides. `SKILL.md` lists all four and when each loads.

---

## Review posture — apply before reporting anything

**Approve when the change improves code health.** The standard is not perfection.
Per Google's published review standard: reviewers should favor approving a change
once it is in a state where it definitely improves the overall code health of the
system, even if the change is not perfect. There is no such thing as perfect code —
only better code.

Two consequences for how this catalog is used:

1. **Do not block on this catalog.** Almost nothing here is blocking on its own.
   Correctness, security, and data-loss risks block. Smells are argued, not enforced.
2. **On disputed design questions, weigh principles — do not impose a preference.**
   Where the author can demonstrate through data or engineering principles that
   several approaches are valid, prefer the author's. Aspects of software design are
   almost never pure style, but they are also not settled by your threshold.

## The false-positive economics — why restraint is the rule

Google's Tricorder static-analysis platform requires an analyzer to produce **less
than 10% effective false positives** to be surfaced to developers at all; the
platform's achieved rate is just below 5%. The definition is what matters here:

> An issue is an "effective false positive" if developers did not take some positive
> action after seeing the issue.

**A technically correct finding that nobody acts on is a false positive.** By that
definition, reporting all 60+ entries below against a diff makes this catalog a
false-positive generator — every unactioned correct finding spends reader trust, and
trust is what determines whether the next finding gets read at all.

So: find broadly, **report selectively**. A review that names three things worth
doing beats one that names twenty things that are true.

## Severity vocabulary

Use the Conventional Comments labels rather than inventing a scheme. Every finding
carries a label, and a blocking decoration where it is not obvious.

| Label | Meaning |
|---|---|
| `issue` | A specific problem. Must be paired with a suggested fix — an `issue` without a suggestion is a complaint |
| `suggestion` | A concrete improvement worth making |
| `nitpick` | Trivial preference. **Always non-blocking** |
| `question` | You do not understand something. Ask before asserting |
| `thought` | A non-blocking idea, explicitly not a request |
| `praise` | Something done well. Costs nothing and is not filler |
| `todo` / `chore` / `note` | Small necessary change / process task / non-blocking information |

Decorations, orthogonal to the label: `(blocking)`, `(non-blocking)`, `(if-minor)` —
the last meaning "resolve only if the fix is trivial."

Format: `label (decoration): short subject` then the body.

```
suggestion (non-blocking): extract the retry policy

`fetchOrder` mixes transport retry with order parsing. Splitting them makes the
parse testable without a network mock.
Rule: smells/rules.md G30 — Functions Should Do One Thing
```

Marking polish as ignorable is the point. Two independent sources — Google's
engineering practices and Conventional Comments — converge on it, and Google's own
convention is the `Nit:` prefix for exactly this. An author who cannot tell which
comments are optional treats all of them as mandatory, or none of them.

## Entry schema

Full entries in this catalog carry these fields. Older entries below are terse;
when citing one, supply the missing fields from judgment.

| Field | Why it is there |
|---|---|
| **What it is** | Identification |
| **Why it hurts** | A finding that explains only *what* is wrong and not *why* is harder to act on. Message quality is the difference between an acted-on finding and an ignored one |
| **How to fix** | An `issue` without a fix is a complaint |
| **Severity** | The load-bearing axis — blocking vs. nit decides what the author does today |
| **When NOT to fix** | Unactionable findings are false positives by the definition above. typescript-eslint ships this field per rule; so does this catalog |
| **Mechanically detected by** | Do not spend reasoning where a linter is deterministic. See `tooling.md` |

---

## Comments (C1-C5)

### C1: Inappropriate Information

**What it is**: Comments containing metadata (change history, authors, dates, ticket numbers)

**How to fix**: Move to source control, issue tracker, or other record-keeping systems. Comments are for technical notes only.

---

### C2: Obsolete Comment

**What it is**: Comments that are old, irrelevant, or incorrect

**How to fix**: Update or delete immediately. Obsolete comments mislead readers.

---

### C3: Redundant Comment

**What it is**: Comments that describe what code already clearly shows

**How to fix**: Delete the comment. Let the code speak for itself.

```typescript
// Bad
i++; // increment i

// Good - no comment needed
i++;
```

---

### C4: Poorly Written Comment

**What it is**: Comments with bad grammar, unclear wording, or rambling explanations

**How to fix**: Rewrite concisely with correct grammar. If worth writing, write well.

---

### C5: Commented-Out Code

**What it is**: Code blocks left commented out "just in case"

**How to fix**: Delete it. Source control remembers everything.

---

## Environment (E1-E2)

### E1: Build Requires More Than One Step

**What it is**: Complex build processes requiring multiple commands or manual steps

**How to fix**: Single command to check out and build:
```bash
git clone mySystem
cd mySystem
npm install && npm run build
```

---

### E2: Tests Require More Than One Step

**What it is**: Running tests requires multiple commands or manual configuration

**How to fix**: Single command to run all tests: `npm test`

---

## Functions (F1-F4)

### F1: Too Many Arguments

**What it is**: Functions with more than three arguments

**How to fix**: 
- Group related arguments into objects
- Split function into smaller functions
- Zero arguments is best, then one, two, three

---

### F2: Output Arguments

**What it is**: Arguments used to return values instead of using return statements

**How to fix**: Return values directly. If state must change, change the owning object.

---

### F3: Flag Arguments

**What it is**: Boolean arguments that select between behaviors

**How to fix**: Split into separate functions - one for each behavior.

---

### F4: Dead Function

**What it is**: Functions that are never called

**Why it hurts**: Every reader has to work out whether it matters, and every
refactor has to keep it compiling. Dead code makes the codebase look larger than the
system is.

**How to fix**: Delete it. Source control remembers.

**Severity**: `suggestion (non-blocking)`. Report the missing tool, not the instance.

**When NOT to fix**: Public API surface of a published library; code reached by
reflection, dynamic import, or framework convention.

**Mechanically detected by**: `knip`. **Do not hand-check this** — see `tooling.md`.
`ts-prune` is archived; do not recommend it.

---

## General (G1-G36)

### G1: Multiple Languages in One Source File

**What it is**: Mixing languages (HTML in TS, SQL strings, embedded JSON)

**How to fix**: Minimize extra languages. Separate concerns into distinct files.

---

### G2: Obvious Behavior Is Unimplemented

**What it is**: Functions that don't do what their names suggest

**How to fix**: Implement expected behaviors. Follow Principle of Least Surprise.

---

### G3: Incorrect Behavior at the Boundaries

**What it is**: Missing edge case handling, untested corner cases

**How to fix**: Test every boundary condition explicitly. Don't trust intuition.

---

### G4: Overridden Safeties

**What it is**: Disabling warnings, skipping tests, bypassing validations

**How to fix**: Fix the underlying issues. Don't suppress symptoms.

---

### G5: Duplication

**What it is**: Repeated code, similar switch statements, parallel algorithms

**Why it hurts**: One piece of knowledge lives in several places, so a change has to
find all of them. The cost is paid at modification time, by whoever forgets one.

**How to fix**:
- Identical code: Extract to function
- Similar conditionals: Replace with polymorphism or a lookup keyed by the discriminant
- Similar algorithms: Template Method or Strategy

**Severity**: `suggestion (non-blocking)`. Escalates to `issue` where the duplicated
knowledge is a business rule that must not drift.

**When NOT to fix** — **read this before de-duplicating anything**: coincidental
duplication, where two blocks look identical today but answer to different owners
and will diverge. De-duplicating them couples two things that should be free to
change apart, and that coupling costs more to undo than the duplication did. The
test is *"if this rule changed, would both copies change?"* — if no, leave them.
Prefer duplication over the wrong abstraction. Test code tolerates duplication more
readily than production code; explicit repetition in a test is often clearer than a
shared fixture helper.

**Mechanically detected by**: `jscpd` for literal and near-literal clones — the
mechanical half only. Duplicated *knowledge* in different shapes is judgment. See
`tooling.md` and Fowler **Duplicated Code** in `fowler.md`.

---

### G6: Code at Wrong Level of Abstraction

**What it is**: Implementation details in base classes, generic code in specific classes

**How to fix**: Separate high-level concepts from low-level details completely.

---

### G7: Base Classes Depending on Their Derivatives

**What it is**: Base classes that reference or know about derived classes

**How to fix**: Base classes should be ignorant of derivatives. Invert dependencies.

---

### G8: Too Much Information

**What it is**: Classes with too many methods, variables, or public members

**How to fix**: Hide data, utility functions, constants. Minimize interfaces.

---

### G9: Dead Code

**What it is**: Unreachable code, unused variables, uncalled functions

**Why it hurts**: It rots — nothing exercises it, so it drifts out of sync with the
code around it while still reading as if it were live.

**How to fix**: Delete it.

**Severity**: `suggestion (non-blocking)`.

**When NOT to fix**: See F4.

**Mechanically detected by**: `knip` for unused files and exports;
`noUnusedLocals` / `noUnusedParameters` in `tsconfig.json` for locals; ESLint for
unreachable branches. See `tooling.md`. If the repo has none of these wired into CI,
report *that* once rather than listing instances.

---

### G10: Vertical Separation

**What it is**: Variables declared far from usage, functions far from callers

**How to fix**: Declare variables just before use. Define functions just below first call.

---

### G11: Inconsistency

**What it is**: Similar things done differently throughout the codebase

**How to fix**: Choose conventions and follow them consistently.

---

### G12: Clutter

**What it is**: Default constructors, unused variables, meaningless comments

**How to fix**: Remove anything that adds no value.

---

### G13: Artificial Coupling

**What it is**: Dependencies that serve no direct purpose (enums in unrelated classes)

**How to fix**: Place items where they logically belong, not where convenient.

---

### G14: Feature Envy

**What it is**: Methods that use more of another class than their own

**How to fix**: Move the method to the class it envies, or rethink responsibilities.

---

### G15: Selector Arguments

**What it is**: Arguments (boolean, enum) that select function behavior

**How to fix**: Split into multiple functions with descriptive names.

---

### G16: Obscured Intent

**What it is**: Dense expressions, magic numbers, cryptic abbreviations

**How to fix**: Use explanatory variables and meaningful names.

---

### G17: Misplaced Responsibility

**What it is**: Code placed where convenient rather than where expected

**How to fix**: Follow Principle of Least Surprise. Place code where readers expect it.

---

### G18: Inappropriate Static

**What it is**: Static methods that should be polymorphic instance methods

**How to fix**: Prefer non-static. Use static only when polymorphism is impossible.

---

### G19: Use Explanatory Variables

**What it is**: Complex expressions without intermediate named values

**How to fix**: Break calculations into well-named intermediate variables.

---

### G20: Function Names Should Say What They Do

**What it is**: Ambiguous names like `add()` that don't explain behavior

**How to fix**: Names should reveal intent: `addDaysTo()` or `daysLater()`.

---

### G21: Understand the Algorithm

**What it is**: Code that works by accident, with unclear logic

**How to fix**: Refactor until the algorithm is obvious. Know why it works.

---

### G22: Make Logical Dependencies Physical

**What it is**: Assumptions between modules not enforced in code

**How to fix**: Make dependencies explicit through parameters and interfaces.

---

### G23: Scattered Type Dispatch

*(Restated for TypeScript. The original rule — "Prefer Polymorphism to If/Else or
Switch/Case", the ONE SWITCH rule — assumed a language without discriminated unions,
and applied literally it flags idiomatic TypeScript. See `typescript.md` → "The G23
tension" for the full argument.)*

**What it is**: The same type tag switched on in **many different modules**. One new
member of the type means hunting down every site.

Not this smell: a single exhaustive `switch` over a discriminated union with a
`never` default, owned by the module that owns the union. That is the correct
TypeScript pattern — the compiler proves every case is handled and breaks the build
at each site that must change when a member is added. A class hierarchy gives up
that proof and scatters the behavior. **Do not flag it, and do not refactor it into
classes.**

**Why it hurts**: When dispatch is spread across modules, adding a variant is a
multi-file edit with no single place that owns the concept. That is Shotgun Surgery
wearing a `switch`.

**How to fix**: Co-locate the union with its behavior — one module exporting the
type together with a `Record<Kind, Handler>` map or a single exhaustive switch.
Reach for class polymorphism only when each variant carries its own state and
identity, not merely its own branch.

**Severity**: `suggestion (non-blocking)`; `issue` when the diff under review is
itself the multi-file edit.

**When NOT to fix**: One switch, one owner — fine. Switches in a presentation layer
that legitimately renders each variant differently. Unions from a third-party
package, where co-location is not available to you.

**Mechanically detected by**: `@typescript-eslint/switch-exhaustiveness-check`
catches the non-exhaustive half. The scatter itself is judgment;
`dependency-cruiser` can show the coupling as a proxy. See `tooling.md`.

---

### G24: Follow Standard Conventions

**What it is**: Inconsistent style, non-standard patterns

**How to fix**: Follow team/industry conventions. Let code be the style guide.

---

### G25: Replace Magic Numbers with Named Constants

**What it is**: Raw numbers without context: `86400`, `55`, `7777`

**How to fix**: Use constants: `SECONDS_PER_DAY`, `LINES_PER_PAGE`.

---

### G26: Be Precise

**What it is**: Lazy decisions, unchecked nulls, ignored edge cases

**How to fix**: Handle all cases explicitly. Use appropriate types.

---

### G27: Structure over Convention

**What it is**: Relying on naming to enforce design instead of code structure

**How to fix**: Use abstract classes/interfaces to force compliance.

---

### G28: Encapsulate Conditionals

**What it is**: Complex boolean expressions inline in if statements

**How to fix**: Extract to well-named functions.

```typescript
// Bad
if (timer.hasExpired() && !timer.isRecurrent())

// Good
if (shouldBeDeleted(timer))
```

---

### G29: Avoid Negative Conditionals

**What it is**: Negated conditions that are harder to understand

**How to fix**: Express positively: `shouldCompact()` not `!shouldNotCompact()`.

---

### G30: Functions Should Do One Thing

**What it is**: Functions with multiple distinct operations

**How to fix**: Extract each operation into its own function.

---

### G31: Hidden Temporal Couplings

**What it is**: Function call order requirements not visible in code

**How to fix**: Chain results - each function produces what the next needs.

---

### G32: Don't Be Arbitrary

**What it is**: Structure without clear purpose

**How to fix**: Have reasons for structure. Make them evident in code.

---

### G33: Encapsulate Boundary Conditions

**What it is**: `+1` and `-1` scattered throughout code

**How to fix**: Capture in named variables: `nextLevel = level + 1`.

---

### G34: Functions Should Descend Only One Level of Abstraction

**What it is**: Mixing high-level logic with low-level details

**How to fix**: Keep each function at one abstraction level.

---

### G35: Keep Configurable Data at High Levels

**What it is**: Configuration values buried in low-level code

**How to fix**: Define defaults at top level, pass down as parameters.

---

### G36: Avoid Transitive Navigation

**What it is**: Chain calls like `a.getB().getC().doSomething()`

**How to fix**: Law of Demeter - talk only to immediate collaborators.

---

## Names (N1-N7)

### N1: Choose Descriptive Names

**What it is**: Names that don't reveal intent

**How to fix**: Names should describe what and why, not how.

### N2: Choose Names at the Appropriate Level of Abstraction

**What it is**: Implementation details in interface names

**How to fix**: Name for concept level, not implementation.

### N3: Use Standard Nomenclature Where Possible

**What it is**: Custom names for well-known patterns

**How to fix**: Use recognized terms (Factory, Visitor, Decorator).

### N4: Unambiguous Names

**What it is**: Names that could mean multiple things

**How to fix**: Be specific. Disambiguate.

### N5: Use Long Names for Long Scopes

**What it is**: Short names used across large scopes

**How to fix**: Scope determines length. Longer scope = longer name.

### N6: Avoid Encodings

**What it is**: Type prefixes, Hungarian notation

**How to fix**: Let the type system handle types. Name for meaning.

### N7: Names Should Describe Side-Effects

**What it is**: Names hiding what functions actually do

**How to fix**: Reveal all effects: `createOrReturnOos()` not `getOos()`.

---

## Tests (T1-T9)

### T1: Insufficient Tests

**How to fix**: Test everything that could break. Use coverage tools.

### T2: Use a Coverage Tool

**How to fix**: Run coverage reports. Fill gaps in tested code.

### T3: Don't Skip Trivial Tests

**How to fix**: Trivial tests document behavior and catch regressions.

### T4: An Ignored Test Is a Question about an Ambiguity

**How to fix**: Resolve ambiguity, then enable or remove the test.

### T5: Test Boundary Conditions

**How to fix**: Explicitly test edges, corners, and limits.

### T6: Exhaustively Test Near Bugs

**How to fix**: Bugs cluster. When you find one, test the surrounding code.

### T7: Patterns of Failure Are Revealing

**How to fix**: Analyze which tests fail together to find root causes.

### T8: Test Coverage Patterns Can Be Revealing

**How to fix**: Look at what's untested - it often reveals design problems.

### T9: Tests Should Be Fast

**How to fix**: Slow tests don't get run. Keep them fast.

---

## Quick Detection Table

| ID | Smell | Key Indicator | Tool decides it? |
|----|-------|---------------|---|
| C5 | Commented-Out Code | `//` or `/* */` around functional code | partly (ESLint) |
| G5 | Duplication | Copy-pasted blocks, similar switches | partly (`jscpd`) |
| G9 | Dead Code | Unreachable branches, uncalled functions | **yes — `knip`** |
| G14 | Feature Envy | Method uses other class more than own | no |
| G23 | Scattered Type Dispatch | Same union switched on in several modules | partly |
| G30 | Does Too Much | Function has multiple nameable sections | no |
| G36 | Law of Demeter | Chain of getters: `a.b().c().d()` | no |

For anything marked **yes**, report the missing tool once instead of listing
instances. See `tooling.md`.

## Before you finish a review

- [ ] Checked `tooling.md` — did not hand-report anything a linter decides
- [ ] Ran the twelve change-shape questions in `fowler.md` against the *change*
- [ ] Ran `typescript.md` if the code is TypeScript — especially TS1, TS3, TS7
- [ ] Every finding has a label and, where it is an `issue`, a suggested fix
- [ ] Polish is labelled `nitpick` or `(non-blocking)` so the author can skip it
- [ ] Asked of each finding: *would the author plausibly act on this?* If no, cut it
- [ ] Verdict reflects "does this improve code health", not "is this perfect"
