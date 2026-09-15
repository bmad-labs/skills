# Digest — checklist methodology + remaining tooling, round 1, inline (lead)

## Findings

### False positives and reviewer trust (the load-bearing result)

1. Tricorder — Google's static analysis platform — requires that an analyzer
   "Produce less than 10% effective false positives" to be surfaced in production.
   `source: Software Engineering at Google, Ch. 20 "Static Analysis" (Sadowski et al.) — abseil.io / O'Reilly — pub: 2020 — accessed: 2026-09-15 — https://abseil.io/resources/swe-book/html/ch20.html — confidence: high — class: practice`

2. Tricorder's overall achieved rate: "The overall effective false-positive rate
   is just below 5%."
   `source: as above — confidence: high — class: practice`

3. The definition of the metric is behavioural, not correctness-based: "An issue
   is an 'effective false positive' if developers did not take some positive
   action after seeing the issue."
   `source: as above — confidence: high — class: practice`
   LOAD-BEARING. This is the single most useful finding for the skill. A finding
   that is technically correct but that no one acts on counts as a false
   positive. A catalog that emits correct-but-unactionable smells is therefore
   generating false positives by Google's own operational definition. This is the
   direct justification for severity tiers and a "when not to fix" field.

4. "User trust is extremely important for the success of static analysis tools."
   and "low false-positive rates are often critical for developers to actually
   want to use a tool" — with the rhetorical framing "who wants to wade through
   hundreds of false reports in search of a few true ones?"
   `source: as above — confidence: high — class: practice`

5. Feedback mechanism: "we display the option to click a 'Not useful' button on
   an analysis result; this click provides the option to file a bug directly
   against the analyzer writer."
   `source: as above — confidence: high — class: practice`

6. On message quality: "Improving the message produced by an analysis provides an
   explanation of what is wrong, why, and how to fix it exactly at the point
   where that is most relevant."
   `source: as above — confidence: high — class: practice`
   Supports a catalog entry shape of what / why / how-to-fix rather than
   what / how-to-fix alone.

7. The same material is published in a peer-reviewed venue: "Lessons from
   Building Static Analysis Tools at Google", Communications of the ACM.
   `source: CACM listing — cacm.acm.org — pub: unknown — accessed: 2026-09-15 — https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/ — confidence: medium — class: practice`
   NOTE: direct fetch returned HTTP 403. Existence and title evidenced from
   search listing only; the quoted figures above come from the abseil.io chapter,
   which was fetched successfully. The underlying Tricorder paper (Sadowski et
   al., ICSE 2015) was also seen in listings but not fetched.
   TWO-SOURCE STATUS for the <10% threshold: satisfied on the number appearing in
   both the abseil chapter (fetched, primary) and the search synthesis of the CACM
   paper (not fetched). Strong enough to state; the CACM text itself is unread.

### Remaining tooling

8. dependency-cruiser validates and visualizes dependencies for JS/TS with
   user-defined rules, and detects circular dependencies, dependencies missing
   from package.json, orphan modules, and production code depending on
   devDependencies or optionalDependencies.
   `source: dependency-cruiser — npm / GitHub sverweij/dependency-cruiser — pub: unknown — accessed: 2026-09-15 — https://www.npmjs.com/package/dependency-cruiser — confidence: high — class: pattern`
   Maps to: architectural coupling smells, cycles. Relevant to Divergent Change /
   Shotgun Surgery only insofar as module coupling proxies for them.

9. jscpd and type-coverage are both actively released: a dependabot PR shows
   jscpd bumped 5.0.11 -> 5.1.2 and type-coverage bumped 2.29.7 -> 2.30.1.
   `source: dependabot PR, amitray007/junction#156 — GitHub — pub: unknown — accessed: 2026-09-15 — https://github.com/amitray007/junction/pull/156 — confidence: low — class: version`
   WEAK EVIDENCE. A dependabot bump in a third-party repo proves these versions
   exist but is not the npm registry page and carries no publish date. Version
   numbers are a two-source class and this is one weak source. Do NOT state these
   as current versions in the report without fetching the npm pages.

## Contradictions

None between sources this round.

## Leads

- Fetch npm pages for jscpd and type-coverage for actual versions + last publish
  dates. Currently unmet two-source bar.
- Conventional Comments label set — not yet retrieved.
- Google eng-practices review standard and the "Nit:" convention — not yet
  retrieved.
- Tricorder ICSE 2015 paper for the original threshold derivation.

## Looked for, could not find

- CACM article full text: HTTP 403 Forbidden. Figures sourced from the abseil.io
  book chapter instead, which is Google's own publication of the same work.
- No publish dates retrieved for any of dependency-cruiser, jscpd, type-coverage.
- Nothing retrieved this round on whether any tool detects change-coupling
  (Shotgun Surgery / Divergent Change) from git history. Still open.
