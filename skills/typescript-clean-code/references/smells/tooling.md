# Mechanical Detection — Stop Reasoning, Run the Tool

A large part of the catalog in `rules.md` is deterministically detectable. Agent
reasoning spent re-deriving `no-explicit-any` is wasted, and worse, it is
*inconsistent* where a linter is exact. This file says which smells belong to tools
and which belong to judgment.

## The rule

**If a tool decides it, do not report it as a review finding.** Report instead that
the tool is missing or not wired into CI — that finding is actionable once and
fixes the whole class, where a per-instance finding fixes one line.

The only exception: if the repository has no such tool configured, checking a small
number of instances by hand is reasonable — but say so, and recommend the tool.

## Do NOT reason about these

### Unused code and exports → `knip`

`knip` detects unused files, exports, dependencies, and unresolved dependencies.
`knip --exports` additionally reports unused enum and namespace members. Zero-config
by default.

**`ts-prune` is archived.** Its own project status recommends knip as successor;
tRPC and mongosh both migrated off it. Any guidance naming `ts-prune` is stale.
ts-prune's scope was unused *exports* only — it could not find unused dependencies
or mutually recursive dead code, and did not distinguish live from dead test code.

Covers catalog entries: **F4** (Dead Function), **G9** (Dead Code), Fowler **Dead
Code**.

Not covered by knip: unused *local* variables and unreachable branches — those are
`noUnusedLocals` / `noUnusedParameters` in `tsconfig.json` plus ESLint.

### The unsafe-`any` family → `typescript-eslint`, type-checked tier

These rules **require type information**. They live in the type-checked config
tier, not in base `recommended`. If the project lints without a `project` /
`projectService` setting, none of them run.

| Rule | Catches |
|---|---|
| `@typescript-eslint/no-unsafe-assignment` | assigning `any` to a variable; `any[]` in array destructuring |
| `@typescript-eslint/no-unsafe-argument` | calling a function with `any` args, including spread `any` tuples |
| `@typescript-eslint/no-unsafe-return` | returning `any` / `any[]`, or `Promise<any>` from async |
| `@typescript-eslint/no-unsafe-call` | calling an `any`-typed value |
| `@typescript-eslint/no-unsafe-member-access` | member access on an `any` |
| `@typescript-eslint/no-unsafe-type-assertion` | assertions used to narrow |

**The trap — the single most important correction in this file.**
`@typescript-eslint/no-unsafe-type-assertion` is enabled in **no shipped preset**,
not even `strict-type-checked`. It is opt-in. A review that says "the project is on
strict, so unsafe assertions are covered" is **wrong**. If unsafe `as` narrowing
matters to the project, the rule must be turned on explicitly:

```js
// eslint.config.js
rules: {
  '@typescript-eslint/no-unsafe-type-assertion': 'error',
}
```

typescript-eslint also ships `*-type-checked-only` shared configs, for enabling only
the type-aware rules on top of an existing setup.

Covers: the `any`-leakage entries in `typescript.md`.

### Duplicate blocks → `jscpd`

Token-based clone detection. Finds literal and near-literal copies.

Covers **G5** (Duplication) and Fowler **Duplicated Code** — *only the mechanical
half*. jscpd cannot see the same rule expressed in two different shapes, and it
cannot tell deliberate duplication from accidental. Spend review reasoning there,
not on finding clones.

### Module coupling and cycles → `dependency-cruiser`

Validates and visualizes JS/TS dependencies against user-defined rules. Detects
circular dependencies, dependencies missing from `package.json`, orphan modules, and
production code depending on `devDependencies` / `optionalDependencies`.

Covers **G13** (Artificial Coupling) partially, and is the closest available proxy
for the change-shape smells — module coupling stands in for Shotgun Surgery and
Divergent Change, **imperfectly**. It sees import graphs, not change history.

### `any` creep over time → `type-coverage`

Reports the percentage of expressions with a type that is not `any`. Useful as a
ratchet in CI (fail if coverage drops) rather than as a review finding.

### Size and complexity → core ESLint

`complexity`, `max-lines-per-function`, `max-params`, `max-depth`, `max-lines`.

Covers **F1** (Too Many Arguments) and the mechanical part of Long Function.
Note the ordering in this skill's guidance: a line count is a *trigger to look*, not
a finding. See `fowler.md` → Long Function and `references/functions/rules.md` →
Rule 1 for why the number is contested.

---

## Still needs judgment — no tool decides these

These are where review effort belongs, because nothing mechanical adjudicates them:

- **Naming** (N1-N7) — a linter enforces casing, not intent.
- **Abstraction level** (G6, G34) — requires knowing the domain.
- **Wrong abstraction / coincidental duplication** — the most expensive mistake in
  this whole file, and jscpd will happily point you *toward* making it.
- **Change shape** (Shotgun Surgery, Divergent Change) — visible in version history,
  not in a diff, and not confirmed detectable by any tool in this list.
- **Speculative Generality** — "who is the second caller" is a product question.
- **Comment accuracy** (C2) — no tool knows whether a comment is still true.
- **Test meaningfulness** (T1-T9) — coverage tools measure execution, not assertion
  quality.
- **Primitive Obsession** — the compiler cannot know that `string` was meant to be a
  `UserId`.

---

## Reporting a missing tool

When a class of smell is mechanically detectable and the repository has no tool for
it, report it once, at the level of the gap:

```
suggestion (non-blocking): dead-code detection is not wired into CI
Unused exports here would be caught mechanically by `knip`. Adding it to CI
removes this whole class of finding from review rather than one instance.
```

That is a single actionable item. Twelve individual "this export is unused"
comments are the same information with twelve times the reader cost, and by the
false-positive definition in `rules.md` they are worse — unactioned findings are
false positives regardless of correctness.

---

## Version caution

No version number is asserted anywhere in this file, deliberately. The research
behind it could not reach the npm registry, and tool versions go stale faster than
the guidance does. Check the current version and configuration syntax before
writing a tool invocation into a project — particularly for typescript-eslint, whose
flat-config migration changed how rules are enabled.

## Provenance

Tool behavior claims here are sourced: knip / ts-prune archival status from
knip.dev's comparison page plus independent migration PRs in tRPC and mongosh;
the `no-unsafe-*` family and the `no-unsafe-type-assertion` preset trap from
typescript-eslint's own rule documentation; dependency-cruiser's detection list from
its npm page. The "report the gap, not the instance" recommendation follows from
the false-positive definition cited in `rules.md`.
