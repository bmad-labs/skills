# Gate: one reviewer per dimension

Run after your own review pass and after lint. Every reviewer is read-only, runs on `opus`, gets
the checklist below for its dimension, and all are dispatched in one message. Whoever wrote a page
cannot review it. You wrote or approved every page, so you review none.

## Report shape (demand it verbatim)

```
CHECK n — PASS|FAIL (x issues)
path:line | "offending or quoted text" | why | fix
...
TOTALS: items checked, defects, rate
```

A prose verdict is not a report. If the reply ends mid-check, message the reviewer: "Resend ONLY
checks k..n, under N lines." Never infer the tail.

## Dimension 1 — Fidelity vs raw

1. Equations: extract every `\tag{}` block from the wiki, diff against raw after whitespace strip.
   Report every mismatch and any wrong tag number.
2. Numbers: every row of `syntheses/key-numbers.md` confirmed in the raw section it links. Then 40
   numeric claims sampled across the other folders, each traced to its linked anchor.
3. Quotes: every quoted string over 6 words appears verbatim in raw. No paraphrase inside quotes.
4. Attribution: sample 30 sentences ending in a raw link; the linked section must state that claim.
5. Every copy of each source table cell-identical.
6. Bibliography links: 30 sampled `[[n]](...#n)`; raw cites the same number for that claim.

## Dimension 2 — Outside-knowledge leaks and unsupported inference

Reviewer must know the domain well; the job is to catch its own knowledge in the pages.

1. Factual leaks: any statement about a method, tool, standard, person, or system the source does
   not state. Sentence-by-sentence on the risk pages named by the gap-check; skim the rest.
2. Inference stated as fact: "so", "therefore", "this is why", "never", "every" beyond the source.
   Severity HIGH if it changes meaning, LOW if a harmless connective.
3. `## Not covered by the source` sections name absences only. No fact about the absent topic.
4. Transcriber commentary (reference cards, converter notes) never presented as source text.
5. Terminology drift: wiki term the source never uses for a source concept.
6. Name conflation the source itself has (two names, one citation) is reported, never resolved.

## Dimension 3 — Schema and structure

1. Frontmatter on every page: `title`, `type` matching folder, `sources` paths that exist, dates.
2. Template headings per type present, in order. Distinguish missing from renamed-but-equivalent.
3. Links: every relative target exists; every raw anchor matches a heading slug or `<a id>`; at
   least 3 outgoing wiki links per page; relative Markdown only; every asset link resolves.
4. Claim anchoring: sample 15 pages; count fact sentences without a raw link in the same sentence
   or bullet.
5. `index.md`: exactly one line per page, format exact, alphabetical, title equals frontmatter.
   `log.md` entries match the schema format.
6. Inbound link counts: pages with 0 or 1 inbound; the 5 most linked.
7. Filenames kebab-case and on the frozen slug list.
8. Every embedded figure uses the raw asset path and has a caption line with a raw link.

## Dimension 4 — Reader queries

Three personas who have not read the source (engineer reusing the method, manager planning a
deployment, student building a literature table). 24 questions, 8 each. Start at `index.md`,
follow links, stop when answered or after 3 hops. Record per query: hops, pages, found
(full / partial / none), raw link present, friction. Then open raw for 8 answers and confirm
correctness and caveats. Return a ranked list of at most 10 concrete improvements with paths.

## Dimension 5 — Prose style and cross-page consistency

Style contract is the project's document style. If it has none, use a controlled-language
standard such as ASD-STE100 Simplified Technical English.

1. Ambiguity from dropped articles or conjunctions. Highest priority.
2. Wiki-prose sentences over 30 words (not quotes, captions, table cells, equations).
3. Passive voice in wiki prose; report the worst 15.
4. Idiom, metaphor, figurative language not inside a quote.
5. Hedges and filler: actually, in fact, essentially, it is worth noting.
6. Editorializing about the source: clever, classic, on purpose, unfortunately.
7. Arrows or invented abbreviations in prose.
8. Same number, same value and format everywhere; list every variant.
9. Same term, same spelling everywhere.
10. Contradictions between pages, including figure-owner disagreement between an index page and a
    source page.
11. Duplication over ~5 sentences between two pages; name pairs.
12. Dates and provenance fields consistent with `log.md`.

## Dispatch template

```
Read-only audit. Do NOT edit any file. Repo: <path>. Wiki: docs/wiki/ (<N> pages). Raw: <path>.
Rule the wiki must obey (from docs/wiki/AGENTS.md): <one line>.

Dimension: <NAME>. <one line on the reviewer's stance>.

Read <which raw files> in full first. Then <which wiki pages>.

Checklist; report PASS or FAIL per item with path:line and the text:
<numbered items for this dimension>

Output: compact report, max ~<N> lines. Per check: `CHECK n — PASS|FAIL (x issues)`. Per issue:
`path:line | "text" | why | fix`. End with counts.
```

## After the gate: editors

Two `opus` editors on disjoint folders (`sources/ + syntheses/ + index.md`, and
`concepts/ + entities/`). Give each the full finding list for its folders plus these hard rules:

- Never change a fact, number, unit, symbol, equation, link target, anchor, heading, table
  structure, or frontmatter.
- Never edit quoted source text: inside double quotes, block quotes, equations, figure captions,
  entity "Every mention" bullets, table cells that reproduce source wording.
- Rewording only. No outside knowledge.
- Keep every raw link attached to the clause it supports; repeat it on both parts of a split.
- `perl -CSD -Mutf8` or the Edit tool. Afterwards `grep -rn 'Â\|Ï' <folders>` must be empty.
- Report: files touched, counts per fix type, verification results, items left because quoted.

Then re-run lint yourself. Editors' self-reports are not verification.
