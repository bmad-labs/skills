# Source Hierarchy & Verification Rules

Software facts go stale fast (versions, deprecations, benchmarks) and
blogs/Stack Overflow are often outdated. Cite the highest tier available, and
verify every claim against its primary source.

**Why official-first.** Primary sources (docs, specs, changelogs, security DBs)
are versioned, normative, and maintained by the people responsible for the thing
itself — they say what *is* true for a stated version. Blog posts, Q&A answers,
and model memory paraphrase that truth at some past date and drift silently: the
version moves, the answer doesn't. Treat the primary as the fact and everything
else as a pointer to it.

## Tiers (Tier 1 = most authoritative)

**Tier 1 — Primary / normative (the thing itself).** Cite over any commentary.
- Official versioned docs (e.g. nodejs.org/docs, docs.python.org/3, react.dev).
- Specs: IETF RFCs (rfc-editor.org, datatracker.ietf.org), W3C TR (w3.org/TR),
  WHATWG Living Standards (spec.whatwg.org).
- Proposal pipelines (future truth + maturity): TC39 proposals
  (github.com/tc39/proposals), rust-lang/rfcs.
- Maintainer release notes / CHANGELOG.md / GitHub Releases — where a claim's
  version validity lives.

**Tier 2 — Authoritative aggregators & security DBs (curated, machine-readable).**
- Vulnerabilities: OSV.dev (aggregates GHSA, RustSec, PyPA), GitHub Advisory DB
  (github.com/advisories), NVD (nvd.nist.gov), Snyk (security.snyk.io).
  OSV/GHSA are usually more timely and more precise on affected version ranges
  than NVD alone.
- Project posture: OpenSSF Scorecard (scorecard.dev) — 18 automated checks
  (Maintained, Code-Review, Signed-Releases, Vulnerabilities, …).
- Version/dependency graph: deps.dev (Google Open Source Insights).
- Lifecycle / EOL: endoflife.date.

**Tier 3 — Ecosystem registries (ground truth for "what's current").**
- Canonical latest-version + deprecation flags: npm, PyPI, crates.io,
  Maven Central, libraries.io.

**Tier 4 — Reputable independent benchmarks (scrutinize methodology).**
- TechEmpower Framework Benchmarks (open, reproducible test code on GitHub) —
  pin to a specific Round + hardware. Treat any *vendor* benchmark as marketing
  until methodology/hardware/versions/config are disclosed and reproducible.

**Tier 5 — Developer-sentiment surveys (popularity ≠ correctness).**
- Stack Overflow Developer Survey, State of JS/CSS, GitHub Octoverse. Trend
  signal only — never a technical fact.

**Tier 6 — Secondary commentary (navigational only, never proof).**
- Blogs, Stack Overflow answers, Medium, DEV, tutorials, LLM memory. These are
  *signposts*: use them to find the primary source, then cite the primary. Citing
  a Tier 5–6 source *as evidence for a fact* is a verification failure — the claim
  is unverified until it resolves to a primary.

## Verification Rules (apply to every claim)

1. **Version-bind every claim.** "X does Y" is valid only as "…in version N".
   No version → unverified.
2. **Check current-version validity.** Scan the changelog between the claimed
   version and `latest`; check the registry's deprecation flag.
3. **Climb to the primary source.** When a blog/SO answer asserts a fact, find
   and cite the Tier 1 source behind it. No primary backing → "reported, unverified".
4. **Date-stamp volatile facts.** Versions, benchmarks, deprecations, security
   status go stale fast — record each source's publish date; reject undated
   sources for time-sensitive claims.
5. **Security claims: cross-reference + resolve version ranges.** Verify in
   OSV/GHSA (not NVD alone); confirm the specific version is in the affected
   range and whether a patched release exists.
6. **Benchmarks require reproducible methodology.** Accept performance claims
   only with disclosed hardware/versions/workload/config and a re-runnable test;
   discount vendor self-benchmarks unless independently reproduced.
7. **Load-bearing claims must resolve to Tier 1–3.** Any claim the recommendation
   rests on has to trace to a primary/normative source (Tier 1), an authoritative
   security/aggregator DB (Tier 2), or a registry (Tier 3). A load-bearing claim
   whose only support is Tier 5–6 (a survey, blog, SO answer, Medium post, or model
   memory) is `UNVERIFIED` by definition — climb to a primary, or demote it to the
   contested sidebar / cut it. Never present a Tier 5–6-only claim as fact.

Verification banner format: `N claims checked · X corrected · Y demoted · Z version-stale`.
