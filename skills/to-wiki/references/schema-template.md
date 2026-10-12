# Schema template (`AGENTS.md` for a wiki root)

Copy to `docs/wiki/AGENTS.md`, replace every `<placeholder>`, keep every rule. Generalized from a shipped wiki over a 17,500-word thesis; the section names below are the ones its 71 pages follow.

---

# Wiki schema

This folder is an LLM-maintained wiki (Karpathy "LLM wiki" pattern). Raw sources live in
`docs/references/` and are never edited. The wiki holds hand-written Markdown pages that
summarize, cross-link, and synthesize those sources. Read `index.md` first. Append to `log.md`
after every ingest, durable query, or lint.

## Layout

```
docs/wiki/
  AGENTS.md        this file. Rules, templates, workflows
  index.md         catalog. One line per page, grouped by type
  log.md           append-only. Dated entries: ingest | query | lint
  sources/         one page per raw document or chapter
  concepts/        one idea per page
  entities/        people, organizations, hardware, software, papers, deployments, programs
  syntheses/       cross-page comparisons, indexes, consolidated lessons
```

Raw sources ingested so far:

| Source | Raw path | Ingested |
| --- | --- | --- |
| <Source short name> | `docs/references/<source-folder>/` | <YYYY-MM-DD> |

## Hard rules

1. **Raw is immutable.** Never edit anything under `docs/references/`.
2. **Every claim links to its raw section.** A sentence that states a fact carries an inline
   relative link to the raw file and heading anchor it came from. A claim with no link is a bug.
3. **Only what the source states.** No outside knowledge. If the source gives only a citation
   number and a clause, the wiki gets only that clause. Where the source is silent, write
   "the source does not say".
4. **Numbers exact, with units.** Equations copy the source LaTeX and keep the source number.
5. **Cross-link on first mention** of any page that exists. Every page has at least 3 outgoing
   wiki links. Use relative Markdown links, never `[[wikilinks]]`.
6. **Figures link into raw assets.** Do not copy images. Example:
   `![Figure N.M](../../references/<source-folder>/assets/figure-n-m.png)`
7. **Prose style:** <project style guide, for example ASD-STE100>. Short sentences.
   Active voice. One idea per sentence. Headings, tables, lists, links, code, and equations keep
   normal form. Never drop a word if that makes a sentence ambiguous. Clarity beats brevity.
8. **No history in pages.** Pages hold latest state. History goes to `log.md` and git.

## Link paths

From any page in `sources/`, `concepts/`, `entities/`, or `syntheses/`:

- Raw source section: `../../references/<source-folder>/<file>.md#<anchor>`
- Raw asset: `../../references/<source-folder>/assets/<name>.png`
- Bibliography entry: `../../references/<source-folder>/bibliography.md#<n>`
- Sibling wiki page: `../<type>/<slug>.md`
- Root files: `../index.md`, `../log.md`

Anchors are the GitHub-style slugs of the raw headings. The raw `index.md` Contents section lists
every anchor. Examples: `#11-introduction`, `#23-<heading-slug>`,
`#412-<heading-slug>`.

## Frontmatter

Every page starts with:

```yaml
---
title: <Page Title>
type: concept            # source | concept | entity | synthesis
sources:
  - ../../references/<source-folder>/<file>.md#<heading-anchor>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

`sources` lists every raw section the page draws on. Bump `updated` on every edit.

## Templates

### Source page (`sources/`)

A chapter page follows the template below. A whole-document page (one per raw source, for example `<source>-<year>`) instead carries: what the document is (metadata table), committee or authors, funding, abstract restated short, chapter map to the chapter pages, pointers to raw inventories, provenance notes, and a bibliography role table.

```
# <Title>
Source: <relative link to raw file> (PDF pages X–Y, printed N–M)

## What this chapter argues
## Section-by-section
### N.1 <heading>            (one per raw section, heading links to raw anchor)
## Equations introduced      (table: number | what it defines | raw link | owning wiki page)
## Figures and tables        (table: number | caption gist | asset link | owning wiki page)
## Numbers stated here       (table: value | what it measures | raw link)
## Sources cited here        (bibliography numbers → entity pages where they exist)
## Concepts this chapter defines   (links to concepts/)
```

### Concept page (`concepts/`)

```
# <Concept>
One-sentence definition, in the source's own terms, with raw link.

## Where the source defines it
## How it works               (prose + equations, each with its source number)
## Why it matters in <domain>
## Parameters and values stated   (omit if none)
## Related
## Not covered by the source  (mandatory. List what a reader may expect but the source omits)
```

### Entity page (`entities/`)

```
# <Name>
Type: person | organization | hardware | software | paper | deployment | program

## What it is, per the source
## Role in this work
## Every mention              (bullets: raw section link → what is said there)
## Numbers attached to it     (omit if none)
## Related
```

Entity pages are indexes into the source, not encyclopedia articles.

### Synthesis page (`syntheses/`)

```
# <Question this page answers>
Scope: which chapters or sections this draws on.

## The short answer
## Evidence                   (table or list, every row cites raw file#section)
## Where the source qualifies its claims
## Tensions or gaps left open
## Related
```

## index.md format

Grouped under `## Sources`, `## Concepts`, `## Entities`, `## Syntheses`. Alphabetical by title
inside each group. One line per page:

```
- [Title](type/slug.md) — one sentence, ends with period.
```

## log.md format

Append only. Newest entry at the bottom.

```
## <YYYY-MM-DD> · ingest · <Source short name> (docs/references/<source-folder>)
- Pages created: N sources, N concepts, N entities, N syntheses
- Notes: ...
```

Entry kinds: `ingest` (new or updated raw source processed), `query` (question answered and
filed as a synthesis page), `lint` (health check run, findings, fixes).

## Workflows

### Ingest

1. Read the raw source in full.
2. Write or update a source page.
3. Write or update concept and entity pages the source touches. Prefer updating an existing
   page over creating a near-duplicate. Check `index.md` first.
4. Add cross-links in both directions.
5. Add one index line per new page. Keep alphabetical order.
6. Append a `log.md` entry.

### Query

1. Read `index.md`. Open the pages that match.
2. Answer from wiki pages. Follow raw links when a detail is missing.
3. If the answer is durable and cross-cutting, file it as a synthesis page and index it.
4. Append a `log.md` entry.

### Lint

Run these checks by hand with `grep` and `find`. No generator scripts.

- Broken links: every relative link target exists.
- Orphans: every page appears exactly once in `index.md`.
- Thin links: every page has at least 3 outgoing wiki links.
- Missing anchor: a claim sentence with no raw link.
- Missing section: a concept page without `## Not covered by the source`.
- Outside knowledge: a fact with no raw section that states it.
- Contradiction: two pages that state different values for the same quantity.

Fix every finding. Record the run in `log.md`.

## Frozen slug list (<source> ingest)

Cross-link against these exact slugs.

sources: `<source>-<year>`, `ch1-<slug>`, ...

concepts: `<one idea per slug>`, ...

entities: `<person>`, `<org>`, `<hardware>`, `<paper-year-topic>`, `<deployment>`, ...

syntheses: `equation-index`, `figure-index`, `key-numbers`, `<comparison>`, `<lessons>`, `open-problems`, `contributions-map`
