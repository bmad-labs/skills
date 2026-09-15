---
title: TypeScript Clean Code — Methodology, Best Practices, and Smell Checklist
type: technical
shape: explore
decision: What to add to skills/typescript-clean-code so its smell and review guidance matches current TypeScript practice rather than Java-shaped 2008 Clean Code
date: 2026-09-15
preset: standard (degraded to inline, targeted)
validation: normal
status: complete-partial
---

# TypeScript Clean Code — Methodology, Best Practices, and Smell Checklist

## Read this first — what is and is not evidenced

This run did not go as planned, and the report's reliability is uneven by design.
Treat the two tiers differently.

**Tier 1 — evidenced this run (10 sources, cited inline).** Detection tooling and
review methodology: sections 1 and 2. Every claim carries a source. Act on these.

**Tier 2 — written from model knowledge, NOT evidenced this run.** Fowler's
catalog, TypeScript-native smells, and the contested-Martin-theses material:
sections 3, 4, 5. These are marked `[unevidenced]` at section level. They are
included because the user explicitly scoped the run this way after the parallel
fan-out failed, on the reasoning that this material is stable canon the model
knows precisely while tooling facts are where memory goes stale. That reasoning is
sound but it is not evidence. **Do not cite section 3-5 content as researched.**
Anything load-bearing there should be verified against the primary text before it
becomes a rule in a skill.

**What failed.** Five researcher subagents were spawned per the approved plan.
All five emitted idle notifications; none delivered a digest, including in reply
to a direct request and to a tool-free diagnostic question. Eight notifications,
zero bytes of message content. The cause was never established — it could be a
spawn/mailbox wiring mismatch, a delivery failure, or malformed briefs. The lead
then ran a bounded inline pass covering the two highest-staleness-risk dimensions.
Three dimensions went unresearched.

---

## 1. Detection tooling — what the catalog should stop reasoning about

The governing insight: a large share of the existing 60-plus entry catalog is
mechanically detectable. Agent reasoning spent re-deriving `no-explicit-any` is
wasted, and worse, it is inconsistent where a linter is deterministic.

### 1.1 Dead code and unused exports

`ts-prune` is archived; its own project status recommends Knip as successor [1].
Third-party corroboration: tRPC and mongosh both migrated off it [2]. Dan
Vanderkam published a recommendation update to knip in July 2023 [5] — old
relative to the 6-month ecosystem bar, so it evidences when the shift began, not
that it holds today; currency rests on [1] and [2].

**Any guidance naming `ts-prune` is stale.** The skill's catalog entries F4 (Dead
Function) and G9 (Dead Code) should name `knip`.

Knip is zero-config and covers unused files, exports, dependencies, and
unresolved dependencies; `knip --exports` additionally reports enum and namespace
members [1]. ts-prune's scope was unused exports only — it could not find unused
dependencies or mutually recursive dead code, and made no attempt to distinguish
live from dead test code [3] (single secondary source; indicative).

Caveat on [1]: knip.dev is knip's own documentation describing a competitor. The
archival claim is accepted because [2] corroborates independently.

### 1.2 The unsafe-`any` family — and the trap in it

These rules require type information and live in the type-checked config tier,
not base `recommended` [6]. Exact names [7]:

| Rule | Catches |
|---|---|
| `@typescript-eslint/no-unsafe-assignment` | assigning `any` to a variable; `any[]` in array destructuring |
| `@typescript-eslint/no-unsafe-argument` | calling a function with `any` args, incl. spread `any` tuples |
| `@typescript-eslint/no-unsafe-return` | returning `any`/`any[]`, or `Promise<any>` from async |
| `@typescript-eslint/no-unsafe-call` | calling an `any`-typed value |
| `@typescript-eslint/no-unsafe-member-access` | member access on `any` |
| `@typescript-eslint/no-unsafe-type-assertion` | assertions used to narrow |

**The trap:** `no-unsafe-type-assertion` is enabled in **no** shipped preset —
not even `strict-type-checked`. It is opt-in and requires type information [8].
A skill that tells users "enable strict and unsafe assertions are covered" is
wrong. This is the most actionable single correction from the run.

`*-type-checked-only` configs exist for enabling only the type-aware rules [10].

### 1.3 Architecture and duplication

`dependency-cruiser` validates and visualizes JS/TS dependencies against
user-defined rules, detecting circular dependencies, dependencies missing from
`package.json`, orphan modules, and production code depending on
`devDependencies`/`optionalDependencies` [9]. This is the closest available proxy
for Fowler's change-shape smells — module coupling stands in for Shotgun Surgery
and Divergent Change, imperfectly.

`jscpd` (token-based clone detection) and `type-coverage` are actively released;
versions `5.1.2` and `2.30.1` respectively appear in a third-party dependabot PR
[11]. **This is weak evidence** — a dependabot bump proves the version exists but
is not the registry and carries no publish date. npm package pages returned HTTP
403 to the fetch tool, so no version claim in this report meets the two-source
bar. Verify before publishing any version number.

### 1.4 Not established

No evidence was retrieved on tooling that detects change-coupling from git
history (CodeScene's change-coupling concept, code-maat). Whether Shotgun Surgery
is mechanically detectable at all remains open — the honest position is that it
is visible in version history, not in a single diff, and this run did not confirm
a tool that does it.

Also not retrieved: typescript-eslint's current major version and whether flat
config is now mandatory; SonarQube's severity taxonomy; core ESLint size rules
(`complexity`, `max-lines-per-function`, `max-params`, `max-depth`) were never
searched.

---

## 2. Checklist methodology — the strongest result in this run

This section changes how the catalog should be *structured*, independent of its
content. It is fully evidenced.

### 2.1 The false-positive economics

Google's Tricorder platform requires an analyzer "Produce less than 10% effective
false positives" to be surfaced in production, and the platform's overall
achieved rate is "just below 5%" [12].

The definition is what matters most:

> "An issue is an 'effective false positive' if developers did not take some
> positive action after seeing the issue." [12]

**A technically correct finding that nobody acts on is a false positive.** By that
operational definition, a catalog that emits 60 correct-but-unactionable smells is
a false-positive generator. Supporting statements: "User trust is extremely
important for the success of static analysis tools", "low false-positive rates are
often critical for developers to actually want to use a tool", and the framing
"who wants to wade through hundreds of false reports in search of a few true
ones?" [12]

Tricorder measures this with a "Not useful" button that also files a bug against
the analyzer's author [12].

Two-source status: the <10% figure appears in the fetched abseil.io chapter
(Google's own publication, primary) and in search synthesis of the CACM paper
"Lessons from Building Static Analysis Tools at Google" [13], whose full text
returned HTTP 403 and is therefore unread. The number is stated with confidence;
the CACM text itself is unverified.

### 2.2 The review posture the catalog must sit inside

Google's published review standard, verbatim:

> "In general, reviewers should favor approving a CL once it is in a state where
> it definitely improves the overall code health of the system being worked on,
> even if the CL isn't perfect." [14]

> "There is no such thing as 'perfect' code—there is only better code." [14]

Non-critical feedback gets marked as ignorable: prefix it "with something like
'Nit: ' to let the author know that it's just a point of polish that they could
choose to ignore" [14].

On disputed design questions — directly relevant to section 5 — "Aspects of
software design are almost never a pure style issue or just a personal
preference"; decisions must be "weighed on those principles, not simply by
personal opinion"; and where the author demonstrates multiple valid approaches
via data or engineering principles, "the reviewer should accept the preference of
the author" [14].

That last clause is the rule for handling contested prescriptions: weigh and
argue, do not enforce a threshold.

### 2.3 A severity vocabulary that already exists

Conventional Comments defines a complete label set [15]: `praise`, `nitpick`,
`suggestion`, `issue`, `todo`, `question`, `thought`, `chore`, `note`, plus
optional `typo`, `polish`, `quibble`. Published semantics: `nitpick` = trivial
preference, non-blocking; `issue` = specific problem requiring a paired
suggestion; `note` = always non-blocking [15].

Decorations form an orthogonal severity axis: `(non-blocking)`, `(blocking)`,
`(if-minor)` — the last meaning resolve only if trivial [15].

Stated rationale: labeling "saves hours of undercommunication", and with prefixes
"the intention is clear and the tone dramatically changes", prompting "more
actionable comments" [15].

Two independent publishers — Conventional Comments and Google eng-practices —
converge on explicitly marking polish as ignorable [14][15].

### 2.4 Proposed catalog entry schema

Justified by the evidence above, not invented:

| Field | Justified by |
|---|---|
| id, name | existing convention |
| what it is | existing |
| **why it hurts** | [12] — messages should explain what is wrong *and why* |
| how to fix | existing |
| **severity / blocking** | [14][15] — blocking vs nit is the load-bearing axis |
| **when NOT to fix** | [12] definition — unactionable findings are false positives; typescript-eslint ships this field per rule [16] |
| **mechanically detected by** | §1 — do not spend reasoning where a linter is deterministic |

typescript-eslint is the working model for the "when not to fix" field. Verbatim
from `no-unsafe-type-assertion` [16]: "If your codebase has many unsafe type
assertions, then it may be difficult to enable this rule. It may be easier to skip
the `no-unsafe-*` rules pending increasing type safety in unsafe areas of your
project." And: "If your project frequently stubs objects in test files, the rule
may trigger a lot of reports. Consider disabling the rule for such files."

---

## 3. Fowler's smell catalog `[unevidenced]`

**Not researched this run.** Model knowledge only. Verify against *Refactoring*
2nd ed. (2018) and refactoring.com before turning any of this into a rule.

The structural argument for adding these is sound and independent of the naming
details: Martin's catalog is organized per-function and per-line; Fowler's is
organized by **change shape** — what hurts when you modify the code. A diff can
satisfy every Martin rule and still exhibit Shotgun Surgery. Different detection
surface, not a duplicate.

The twelve the user named, with the pairing I believe holds — **each needs
checking**:

| Smell | Paired refactoring (2nd-ed naming, unverified) |
|---|---|
| Divergent Change | Split Phase, Extract Class |
| Shotgun Surgery | Move Function, Move Field, Combine Functions into Class |
| Long Function | Extract Function, Replace Temp with Query |
| Large Class | Extract Class, Extract Superclass |
| Long Parameter List | Introduce Parameter Object, Preserve Whole Object |
| Data Clumps | Extract Class, Introduce Parameter Object |
| Primitive Obsession | Replace Primitive with Object, Replace Type Code with Subclasses |
| Feature Envy | Move Function, Extract Function |
| Duplicated Code | Extract Function, Pull Up Method |
| Message Chains | Hide Delegate, Extract Function |
| Speculative Generality | Collapse Hierarchy, Inline Function, Remove Dead Code |
| Dead Code | Remove Dead Code |

Specific items I flag as needing verification because renames happened between
editions: "Long Method" became "Long Function"; "Extract Method" became "Extract
Function"; "Large Class" and "Comments" may have changed; several class-only
smells (Refused Bequest, Parallel Inheritance Hierarchies, Inappropriate
Intimacy, Middle Man) may have been dropped or restated when the examples moved
to JavaScript. **I did not verify any of this.** The direction of the 2nd edition
being JavaScript-based is the reason this matters for a TypeScript skill.

Also unverified: how the class-shaped smells restate for modules, closures, and
standalone functions. This is the most useful unanswered question in the report.

---

## 4. TypeScript-native smells `[unevidenced]`

**Not researched this run.** Model knowledge only.

The gap is real and visible in the existing catalog: it is Java-shaped with TS
syntax substituted. Candidates a TS-native catalog needs, none verified here:

- `any` leakage and its containment; `unknown` as the correct boundary type
- type assertions (`as`) and non-null assertion (`!`) as lying to the compiler —
  note §1.2: the lint rule for this is opt-in, so it needs a catalog entry
- Primitive Obsession's TS remedy: branded/nominal types, schema-validated types,
  `satisfies` — rather than Fowler's Replace Primitive with Object, which assumes
  classes
- discriminated unions with `never` exhaustiveness checking as the idiomatic
  answer to type-switching — which puts it in direct tension with Martin's G23
  ("Prefer Polymorphism to If/Else or Switch/Case", ONE SWITCH rule). A `switch`
  over a discriminated union is arguably good TS design, and the existing catalog
  would flag it. **This tension is the single most important thing to verify.**
- strict-family flags that are NOT in `strict`: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` — I believe both are outside `strict`, unverified
- `enum` vs union types; `interface` vs `type`; `readonly`/immutability;
  index signatures; `Function`/`Object` as types

---

## 5. Contested Martin theses `[unevidenced]`

**Not researched this run.** Model knowledge only. I deliberately name no
attributed quotations here, because attribution is exactly where memory
confabulates and the brief for this dimension forbade unretrieved attribution.

The exposure in the skill is concrete: `SKILL.md` states "Small Units →
`references/functions/rules.md` (Rule 1: 2-5 lines ideal)". An agent following
that literally will over-extract, scattering logic across many tiny functions.
There is a substantial published counter-argument in this area — John Ousterhout's
*A Philosophy of Software Design* argues for deeper modules and against excessive
decomposition, and a written Ousterhout/Martin debate exists. I did not retrieve
either, so I state only that they exist and that the primary texts should be read
before the skill annotates the thesis.

Likewise the comments thesis: Martin treats most comments as failure; the
counter-position holds that "self-documenting code" is insufficient and that
rationale, invariants, and non-obvious *why* belong in comments. Unretrieved.

Empirical grounding for whether any of these prescriptions improve outcomes:
not researched. My expectation is the base is thin and mixed, which would itself
be a finding — but that expectation is not evidence.

What §2.2 lets us say without further research: per Google's standard [14],
disputed design matters are weighed on principle and the author's demonstrated
reasoning wins where multiple valid approaches exist. **So the fix is structural
rather than doctrinal** — the skill should mark contested theses as positions with
their counter-arguments, not restate them as numeric law. That recommendation
stands on section 2's evidence regardless of what section 5's unread sources say.

---

## Recommendations, ranked by confidence

**Act now (evidenced):**

1. Replace `ts-prune` with `knip` wherever dead-code tooling is named [1][2].
2. Add an explicit entry: `no-unsafe-type-assertion` is opt-in, in no preset [8].
3. Add `severity/blocking`, `when NOT to fix`, and `mechanically detected by`
   fields to every catalog entry [12][14][15][16].
4. Adopt the Conventional Comments label set and blocking decorations rather than
   inventing a severity scheme [15].
5. State the review posture up front: approve when the change improves code
   health; mark polish as ignorable [14].
6. Add a "this is a lint rule, do not reason about it" list, pointing at the exact
   rule names in §1.2.

**Verify before acting (unevidenced):**

7. The Fowler catalog addition — check 2nd-edition names and pairings, then add
   as a change-shape layer distinct from Martin's per-line catalog.
8. The discriminated-union vs G23 tension — resolve this before the catalog tells
   an agent to refactor idiomatic TypeScript into class polymorphism.
9. Annotate the 2-5 line rule and the comments thesis as contested positions,
   after reading the primary counter-texts.

**Do not touch:** naming, duplication, dead code, boundary-condition testing. No
evidence surfaced against the stable core, and none was sought.

---

## Open questions

1. Is Shotgun Surgery / Divergent Change mechanically detectable, or only visible
   in version history? Unresolved.
2. Current typescript-eslint major version; is flat config mandatory?
3. Authoritative versions and publish dates for knip, jscpd, type-coverage,
   dependency-cruiser — npm blocked by 403, needs another route.
4. Which preset holds each individual `no-unsafe-*` rule (recommended-type-checked
   vs strict-type-checked)? Only the family tier was established.
5. Everything in sections 3, 4, 5.

Route for these: a Deepen pass on this run folder, or a drafted prompt for an
external deep-research tool — the fan-out route is not working in this session.

---

## Sources

| # | Source | Publisher | Accessed | Confidence |
|---|---|---|---|---|
| 1 | [Comparison & Migration](https://knip.dev/explanations/comparison-and-migration) | Knip | 2026-09-15 | high (interested party) |
| 2 | [trpc#7305](https://github.com/trpc/trpc/pull/7305), [mongosh#2613](https://github.com/mongodb-js/mongosh/pull/2613) | GitHub | 2026-09-15 | medium |
| 3 | [Why We Chose Knip Over ts-prune](https://levelup.gitconnected.com/dead-code-detection-in-typescript-projects-why-we-chose-knip-over-ts-prune-8feea827da35) | Level Up Coding | 2026-09-15 | medium |
| 5 | [Recommendation Update: knip](https://effectivetypescript.com/2023/07/29/knip/) | Effective TypeScript | 2026-09-15 | high (2023) |
| 6, 10 | [Typed Linting](https://typescript-eslint.io/troubleshooting/typed-linting/) | typescript-eslint | 2026-09-15 | high |
| 7 | [Rules index](https://typescript-eslint.io/rules/) | typescript-eslint | 2026-09-15 | high |
| 8, 16 | [no-unsafe-type-assertion](https://typescript-eslint.io/rules/no-unsafe-type-assertion/) | typescript-eslint | 2026-09-15 | high |
| 9 | [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | npm | 2026-09-15 | high |
| 11 | [junction#156](https://github.com/amitray007/junction/pull/156) | GitHub | 2026-09-15 | low |
| 12 | [SWE at Google ch.20 Static Analysis](https://abseil.io/resources/swe-book/html/ch20.html) | abseil.io / O'Reilly, 2020 | 2026-09-15 | high |
| 13 | [Lessons from Building Static Analysis Tools at Google](https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/) | CACM | 2026-09-15 | medium (403, unread) |
| 14 | [The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html) | Google Engineering Practices | 2026-09-15 | high |
| 15 | [Conventional Comments](https://conventionalcomments.org/) | conventionalcomments.org | 2026-09-15 | high |

Digests: `digests/tooling-r1-1.md`, `digests/method-r1-1.md`, `digests/method-r1-2.md`
Ledger: `.memlog.md` (12 entries)
