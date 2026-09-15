# Digest — tooling, round 1, inline (lead)

Gathered by the lead inline after the subagent fan-out returned no content.
Same source-quality card and freshness bars as the briefs.

## Findings

### Dead code / unused export detection

1. ts-prune is archived and its own project status recommends Knip.
   `source: Comparison & Migration — Knip (knip.dev) — pub: unknown — accessed: 2026-09-15 — https://knip.dev/explanations/comparison-and-migration — confidence: high — class: ecosystem`
   Note: this is knip's own documentation describing a competitor, so it is an
   interested party. The archival claim is corroborated below.

2. ts-prune is described as archived/unmaintained with its README pointing at knip
   for new projects; multiple projects (tRPC, mongosh) migrated away from it.
   `source: search result set incl. github.com/trpc/trpc/pull/7305 and github.com/mongodb-js/mongosh/pull/2613 — pub: unknown — accessed: 2026-09-15 — confidence: medium — class: ecosystem`
   TWO-SOURCE STATUS: satisfied for "archived" (knip docs + migration PRs in
   real repos). NOT independently verified from the ts-prune repository itself —
   the repo README was not fetched directly. Flagged for round 2.

3. ts-prune's scope was unused exports only; it could not detect unused
   dependencies, mutually recursive dead code, and made no attempt to
   distinguish live from dead test code.
   `source: Dead Code Detection in TypeScript Projects: Why We Chose Knip Over ts-prune — Level Up Coding (Rufat Khaslarov) — pub: unknown — accessed: 2026-09-15 — confidence: medium — class: pattern`
   Secondary source, single publisher. Treat as indicative not settled.

4. Knip is zero-config by default and checks unused files, exports, dependencies,
   and unresolved dependencies; `knip --exports` additionally includes enum and
   namespace members.
   `source: Comparison & Migration — Knip (knip.dev) — pub: unknown — accessed: 2026-09-15 — https://knip.dev/explanations/comparison-and-migration — confidence: high — class: pattern`

5. Dan Vanderkam (Effective TypeScript) published a recommendation update
   switching to knip for dead code and type detection.
   `source: Recommendation Update: Use knip to detect dead code and types — effectivetypescript.com — pub: 2023-07 — accessed: 2026-09-15 — https://effectivetypescript.com/2023/07/29/knip/ — confidence: high — class: practice`
   Independent of knip's own marketing; Vanderkam is a credible TS primary voice.
   Date is 2023 — older than the 6-month ecosystem bar, so it evidences that the
   shift began, not that it is current. Current status rests on findings 1-2.

### typescript-eslint unsafe-any family

6. The `no-unsafe-*` rules require type information and live in the
   type-checked config tier, not in base `recommended`.
   `source: Typed Linting — typescript-eslint — pub: unknown — accessed: 2026-09-15 — https://typescript-eslint.io/troubleshooting/typed-linting/ — confidence: high — class: version`

7. The family comprises these exact rule names:
   `@typescript-eslint/no-unsafe-assignment` (disallows assigning `any` to a
   variable and `any[]` in array destructuring),
   `@typescript-eslint/no-unsafe-argument` (calling a function with `any` args,
   incl. spreading `any`-typed tuples),
   `@typescript-eslint/no-unsafe-return` (returning `any`/`any[]`, or
   `Promise<any>` from async),
   `@typescript-eslint/no-unsafe-call` (calling an `any`-typed value),
   `@typescript-eslint/no-unsafe-member-access` (member access on `any`),
   `@typescript-eslint/no-unsafe-type-assertion` (assertions that narrow).
   `source: individual rule pages — typescript-eslint — pub: unknown — accessed: 2026-09-15 — https://typescript-eslint.io/rules/ — confidence: high — class: version`

8. `@typescript-eslint/no-unsafe-type-assertion` is enabled in NO shipped preset
   config — it is opt-in even under `strict-type-checked`. It requires type
   information.
   `source: no-unsafe-type-assertion — typescript-eslint — pub: unknown — accessed: 2026-09-15 — https://typescript-eslint.io/rules/no-unsafe-type-assertion/ — confidence: high — class: version`
   LOAD-BEARING: a catalog that says "strict mode catches unsafe assertions" is
   wrong. This must be added explicitly.

9. typescript-eslint publishes explicit "When Not To Use It" guidance per rule.
   For `no-unsafe-type-assertion`, verbatim: "If your codebase has many unsafe
   type assertions, then it may be difficult to enable this rule. It may be
   easier to skip the `no-unsafe-*` rules pending increasing type safety in
   unsafe areas of your project." And: "If your project frequently stubs objects
   in test files, the rule may trigger a lot of reports. Consider disabling the
   rule for such files to reduce frequent warnings."
   `source: no-unsafe-type-assertion — typescript-eslint — pub: unknown — accessed: 2026-09-15 — https://typescript-eslint.io/rules/no-unsafe-type-assertion/ — confidence: high — class: practice`
   LOAD-BEARING for D5: this is a maintained catalog that ships a per-entry
   "when not to fix" field, which is exactly the schema gap in the skill.

10. `*-type-checked-only` shared configs exist, enabling only the type-checked
    rules.
    `source: Typed Linting / FAQ — typescript-eslint — pub: unknown — accessed: 2026-09-15 — https://typescript-eslint.io/troubleshooting/typed-linting/ — confidence: high — class: version`

## Contradictions

None yet between sources. Noted tension: knip.dev is the authority most readily
available for ts-prune's status while also being its replacement. Corroborated
via third-party migration PRs rather than accepted on knip's word alone.

## Leads

- Fetch the ts-prune GitHub repo directly to close the two-source gap on
  "archived" from the primary artifact.
- Confirm current typescript-eslint major version and whether flat config is now
  required — not yet retrieved.
- Which preset each `no-unsafe-*` rule sits in individually (recommended-type-checked
  vs strict-type-checked) — only the family tier is established so far.
- Core ESLint size/complexity rules (`complexity`, `max-lines-per-function`,
  `max-params`, `max-depth`) — not yet searched.
- jscpd, dependency-cruiser, type-coverage — not yet searched.

## Looked for, could not find

- No version number or release date for ts-prune or knip retrieved yet; the knip
  comparison page states no versions/dates.
- Introduction version for `no-unsafe-type-assertion` is not stated in its docs.
