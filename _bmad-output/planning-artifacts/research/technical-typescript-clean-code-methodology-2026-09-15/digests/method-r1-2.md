# Digest — review conventions, round 1 cont., inline (lead)

## Findings

### Conventional Comments label set (primary, complete)

1. The convention defines these labels with these exact names: `praise`,
   `nitpick`, `suggestion`, `issue`, `todo`, `question`, `thought`, `chore`,
   `note`. Optional expressive labels: `typo`, `polish`, `quibble`.
   `source: Conventional Comments — conventionalcomments.org — pub: unknown — accessed: 2026-09-15 — https://conventionalcomments.org/ — confidence: high — class: practice`

2. Semantics as published: `nitpick` = trivial preference-based, non-blocking;
   `issue` = a specific problem, requiring a paired suggestion; `todo` = small
   necessary change; `chore` = simple required task before acceptance; `thought`
   = non-blocking idea; `note` = informational, always non-blocking.
   `source: as above — confidence: high — class: practice`

3. Decorations are `(non-blocking)`, `(blocking)`, and `(if-minor)` — the last
   meaning resolve only if the change is trivial.
   `source: as above — confidence: high — class: practice`
   Directly usable as a severity axis orthogonal to smell identity.

4. Stated rationale: labeling "encourages collaboration and saves hours of
   undercommunication and misunderstandings"; with prefixes "the intention is
   clear and the tone dramatically changes", prompting "more actionable comments."
   `source: as above — confidence: high — class: practice`

### Google engineering practices — the review standard

5. The core standard, verbatim: "In general, reviewers should favor approving a CL
   once it is in a state where it definitely improves the overall code health of
   the system being worked on, even if the CL isn't perfect."
   `source: The Standard of Code Review — Google Engineering Practices — pub: unknown — accessed: 2026-09-15 — https://google.github.io/eng-practices/review/reviewer/standard.html — confidence: high — class: practice`
   LOAD-BEARING. This is the opposite posture to a 60-entry catalog applied
   exhaustively. It is the governing principle a smell catalog must sit inside.

6. "There is no such thing as 'perfect' code—there is only better code."
   `source: as above — confidence: high — class: practice`

7. The Nit convention, verbatim: reviewers should "prefix it with something like
   'Nit: ' to let the author know that it's just a point of polish that they could
   choose to ignore."
   `source: as above — confidence: high — class: practice`
   Independently corroborates the Conventional Comments `nitpick` label — two
   separate publishers converge on marking polish as ignorable.

8. On preference vs. principle: "Aspects of software design are almost never a
   pure style issue or just a personal preference" and design decisions must be
   "weighed on those principles, not simply by personal opinion." Where the author
   demonstrates multiple valid approaches via data or engineering principles,
   "the reviewer should accept the preference of the author."
   `source: as above — confidence: high — class: practice`
   LOAD-BEARING for the contested-thesis problem: this gives the rule for how a
   catalog should treat disputed prescriptions (e.g. function length) — as
   principles to weigh and argue, not as thresholds to enforce.

## Contradictions

None between sources. Findings 5-8 are in tension with the *skill under review*,
not with each other — but the skill is project context and inadmissible as
evidence, so that tension is reported in the synthesis, not here.

## Leads

- Google eng-practices has further pages (what to look for in a code review,
  speed of reviews, handling pushback) not retrieved.
- SonarQube severity/type taxonomy never retrieved.
- Empirical work on smells vs defect density never retrieved.

## Looked for, could not find

- npm registry pages return HTTP 403 to WebFetch, so no authoritative current
  version or last-publish date for type-coverage, jscpd, dependency-cruiser,
  knip, or typescript-eslint was obtained. All version claims in this run remain
  below the two-source bar and are reported as such.
- No evidence retrieved on tooling that detects change-coupling from git history
  (CodeScene's change coupling, code-maat). Question left open.
- typescript-eslint current major version and flat-config requirement: not
  retrieved.
