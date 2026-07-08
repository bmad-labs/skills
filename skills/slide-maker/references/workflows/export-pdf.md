# Workflow: Export PDF

**Goal:** a **PDF**, one page per slide, for printing, attaching, or sharing where a
fixed-layout document is wanted. Each slide is rendered at high resolution and merged
into a single PDF.

**Use when** the user wants a printable / emailable handout, a leave-behind, or an
archival copy. (PDF is flat — not editable; for an editable deliverable use
[export-editable-pptx](export-editable-pptx.md).)

**Input:** an approved HTML deck (from [slide-generate](slide-generate.md)).

## Steps (from inside the copied deck)

```bash
node scripts/export-deck.mjs --format pdf       # → export/deck.pdf
```
- Each slide is screenshotted via Playwright Chromium at high resolution (1920×1080) and
  merged with `pdf-lib`, one page per slide.
- **Edit mode is auto-stripped** before capture — the overlay never appears in the PDF.
- First run needs `npm install` + `npx playwright install chromium`.

## Check before handing over
Open `export/deck.pdf` — one page per slide, each matching its `review/slide-NN.png`,
crisp at print size, nothing clipped at the page edge. If a slide is wrong, fix the
**HTML** ([slide-generate](slide-generate.md)) and re-export.

## Done when
`export/deck.pdf` opens with all slides as pages. Hand the path to the user. Details:
[deck-template.md](../deck-template.md).
