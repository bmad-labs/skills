# Choosing the wiki structure for a source

The four folders (`sources/`, `concepts/`, `entities/`, `syntheses/`) stay. What changes per source
is what earns a page, what the concept template carries, which syntheses are mandatory, how writers
split, and which gate lenses run. Decide these in step 2, before the schema is written.

## Procedure

1. **Inventory content kinds.** Walk the raw files and count: prose sections, equations, tables and
   their row counts, figures, code blocks, API signatures, normative clauses (shall / should / may),
   defined terms, cited works, named systems or people, dates, and whether there is one source or
   several.
2. **Map each kind to its home** with the table below. A kind with more than about 20 near-identical
   items gets one index table, never one page per item.
3. **Answer the six rulings** in the next section. Write the answers into `AGENTS.md` as numbered
   hard rules. The gap-check agent verifies them against the inventory.
4. **Pick gate lenses** from the last column. Fidelity and outside-knowledge always run.

General rules that hold for every source kind:

- **Page counts follow from the inventory.** One concept page per idea the source explains in more than
  one clause. One-clause ideas are rows in `glossary` or in the owning source page. No target count.
- **A `sources/` page covers at most about 4,000 words of raw text.** Split longer chapters or sections.
- **Every index synthesis is named `<kind>-index`** (`register-index`, `error-code-index`,
  `api-index`, `requirements-index`). An index exists only when the source has that kind. No
  equations, no `equation-index`. No figures, no `figure-index`.
- **Group a large set the way the source groups it** (its chapters, its object types, its table
  sections). Never invent a grouping.
- **Rank leak risk by the gap** between what the writer knows about a topic and how little the source
  says about it. A famous topic with one source clause ranks first.
- **Named things are entities, ideas are concepts.** A hardware revision, a version, a dataset, a site
  is an entity. A design principle, a method, a failure mode is a concept.
- **A folder of many small documents is a corpus.** Ruling 5 applies. Documents under about 200 words
  merge into one `sources/` page per period or per topic; the page keeps one anchor per document.
- **Two use-case rows can apply at once** (meeting notes are also a corpus). Take the union of their
  template changes, syntheses, and lenses.
- **Each source table gets its own index synthesis.** Never merge two source tables into one.
- **Reader-query lens size:** 24 questions and 3 personas from 20 pages up; 8 and 2 below.
- **At most 7 gate lenses.** Beyond that, merge the two closest (attribution into fidelity,
  consistency into style).
- **A reversed decision** is one row in `decision-log` with both states and dates; `contradictions`
  links to that row and does not restate it.

| Content kind | Home | Gate lens |
| --- | --- | --- |
| Prose section | `sources/` chapter page section; ideas to `concepts/` | fidelity, leaks, style |
| Equation | `concepts/` page that owns it, copied byte-exact; `syntheses/equation-index` | fidelity (equation diff) |
| Table under ~20 rows | Reproduced on the owning page | fidelity (cell check) |
| Table over ~20 rows, uniform items | One `syntheses/<name>-index` table, one row per item, each row with its raw anchor. No page per item | fidelity (row count + sampled cells) |
| Figure | Linked from the owning page; `syntheses/figure-index` | schema (asset resolves) |
| Code block, API signature, config macro | Copied byte-exact like an equation; group pages in `entities/`; `syntheses/api-index` | code lens |
| Normative clause | Quoted verbatim in a block quote on the owning page; `syntheses/requirements-index` by force level | normative-force lens |
| Defined term | `concepts/` page, or a row in `syntheses/glossary` when the source gives only one line | leaks |
| Cited work | Row in the source page's citations table; `entities/` only above the threshold | fidelity (bib numbers) |
| Named person, org, system, site | `entities/` "Every mention" page | leaks |
| Numbers with units | `syntheses/key-numbers`, one row each | fidelity (number sweep) |
| Dates and versions | `syntheses/timeline` when more than about 5 | consistency |

## Six rulings the base skill leaves open

Baseline agents asked these six questions and invented answers. Use these instead.

1. **Large uniform set** (60 registers, 140 API functions, 90 error codes, ~200 citations). One index
   table in `syntheses/`, one row per item, each row anchored. An item earns its own page only when
   the source spends more than one clause on it or the annex, an example, or a figure references it.
   Expect 0 to 15 pages from a set of 100.
2. **Source history versus wiki history.** "No history in pages" forbids edit history of the wiki.
   A migration chapter, a version table, a timeline the source itself gives is content. It gets a
   page, usually a synthesis (`v1-to-v2-migration`, `timeline-2018-2024`).
3. **Code is an equation.** Code blocks, signatures, and macros copy byte-exact with the source's
   own identifiers, and the gate runs a code lens with the same checklist shape as the equation diff.
4. **Modal verbs are load-bearing.** In a standard or spec, every requirement clause appears as a
   verbatim block quote with its clause number. Never paraphrase shall, should, may, or must. Add a
   hard rule to `AGENTS.md` and a normative-force lens to the gate.
5. **Several sources.** One `sources/` page per source plus one corpus overview. Every claim sentence
   names its source and carries that source's raw anchor. Concept pages get a mandatory
   `## Where sources disagree` section; `## Not covered by the source` becomes "by any source in
   this corpus". Mandatory syntheses: `contradictions`, `agreed-findings`, `method-comparison`,
   `benchmark-results` when a shared dataset exists. The wiki never decides which source is right.
   Writers split by source. `log.md` gets one `ingest` entry per source.
6. **Lens sizing.** Fidelity and outside-knowledge never shrink. Style shrinks to a light pass on a
   table-heavy wiki. Equation lens drops when the source has no equations. Reader-query lens shrinks
   to 8 questions and 2 personas under 20 pages. Never drop a lens because time is short; hand over
   with "gate dispatched, results pending" instead.

## Use-case table

| Use case | `sources/` shape | Earns an entity page | Mandatory syntheses | Concept template change | Highest leak risk | Writer split | Extra gate lens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Single thesis or paper | 1 document page + 1 per chapter; split a chapter over ~4,000 words | People on the title page, the team's own prior systems, baselines the source tests, cited works the source describes in more than one clause, deployments | `equation-index`, `figure-index`, `key-numbers`, `contributions-map`, `open-problems`, one comparison | none | Background theory pages, baseline system entities, tool entities | By chapter | none |
| Survey or review paper | 1 document page + 1 per section | Author group, benchmark, works the review compares in a table | `taxonomy` (the review's own categories), `method-comparison`, the review's tables as index tables, `key-numbers` | Add `## Where the review places it` (taxonomy position) | Method pages: the review gives one clause, the writer knows the paper | By section | none |
| Datasheet or hardware manual | 1 document page + 1 per section (pinout, electrical, registers, timing, examples) | Peripheral blocks, package variants, example circuits. Never a register or a pin | `register-index`, `pin-function-index`, `electrical-limits-index` (absolute maximum, recommended, typical), `timing-index` (one row per diagram), `figure-index` | Replace `## Why it matters in <domain>` with `## Where it is used on this part` | Peripheral concepts (clock tree, interrupts, power modes): the writer knows other parts | By section | numbers-and-units sweep; style light |
| SDK or API guide | 1 document page + 1 per chapter | API groups, the config macro set, the runtime or scheduler object model. A single function only when prose explains it in several clauses | `api-index` (every signature), `config-macro-index`, `code-sample-index`, `migration` when the source has one, `key-numbers` | Add `## Signatures` with byte-exact code | Textbook concepts (mutex, scheduler): the writer knows the general theory | By chapter | code lens |
| Standard or specification | 1 document page + 1 per clause group + 1 per annex | The standard itself, issuing body, normatively referenced standards | `requirements-index` (every shall/should/may with clause number), `error-code-index` for the enumerations, `conformance-test-index`, `glossary` | Every clause quoted verbatim; add `## Force` (shall / should / may) | All concept pages: the writer knows sibling standards | By clause group | normative-force lens; two leak reviewers |
| Corpus of several papers | 1 per source + `corpus-overview` | Each group, shared datasets, each method a paper runs | `contradictions`, `agreed-findings`, `method-comparison`, `benchmark-results`, `timeline`, `equation-index`, `key-numbers` | Add `## Where sources disagree`; claims name their source | `contradictions`, `method-comparison`: judging who is right | By source | attribution lens (every claim names a source) |
| Project notes, decisions, field reports | 1 per document or meeting | People, teams, systems, sites, decisions | `decision-log`, `timeline`, `open-actions`, `lessons` | Add `## Status at last source` | Status pages: the writer knows what happened later | By time period | consistency (same fact across dates) |

## Anti-patterns

| Mistake | Why it fails | Instead |
| --- | --- | --- |
| Thesis template forced on a datasheet | "Why it matters in <thesis domain>" and equation index on a part with no equations | Change the concept template per the table; drop empty syntheses |
| One page per register, API, code, or citation | Hundreds of stubs no reader opens; the index becomes noise | One index table, rows anchored; pages only above the threshold |
| Migration chapter dropped as "history" | Source content lost | Ruling 2 |
| Paraphrased requirement clause | "should" becomes "shall" and the wiki now states a different standard | Ruling 4 |
| Corpus wiki that picks a winner | Outside judgment presented as fact | Ruling 5; the `contradictions` page states each side with anchors |
| Style lens run as a correctness gate on tables | Wasted reviewer; fidelity lens starved | Ruling 6 |
| Lens dropped for time | Handover claims a coverage it does not have | Hand over with the pending lens named |
