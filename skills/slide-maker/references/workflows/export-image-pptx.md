# Workflow: Export image PPTX (pixel-perfect, not editable)

**Goal:** a PowerPoint where each slide is a **full-bleed, pixel-perfect screenshot** of
the rendered HTML slide. It looks exactly like the deck — but the text/shapes are a flat
image, so it can't be edited in PowerPoint.

**Use when** the audience only **views/presents** the deck and you want guaranteed exact
fidelity (no rendering-engine differences). If they must edit, use
[export-editable-pptx](export-editable-pptx.md) instead.

**Input:** an approved HTML deck (from [slide-generate](slide-generate.md)).

## Steps (from inside the copied deck)

```bash
node scripts/export-deck.mjs --format pptx-image     # → export/deck-image.pptx
```
- Each slide is screenshotted via Playwright Chromium at 16:9 and placed full-bleed.
- **Edit mode is auto-stripped** (the standalone build runs with edit-mode off, and the
  exporter removes any `.em-*`/nav nodes before capture) — the overlay never ships.
- First run needs `npm install` + `npx playwright install chromium`.

## Check before handing over
Open `export/deck-image.pptx` — every slide should match its `review/slide-NN.png`
exactly (it's the same screenshot). If a slide looks wrong, the **HTML** is wrong → fix
in [slide-generate](slide-generate.md) and re-export; nothing to tune here (it's a
faithful screenshot, not a reconstruction).

## Before you hand it over

Even a screenshot export can drift — a clipped capture or a page-size mismatch shows up
as a uniform diff across every slide. One command:

```bash
node scripts/verify-export.mjs --pptx export/deck-image.pptx --top 2
```

Details: [visual-review.md → Reviewing an EXPORT](../visual-review.md#reviewing-an-export-is-a-different-job--diff-it-dont-browse-it).

## Done when
`export/deck-image.pptx` opens and matches the deck. Hand the path to the user, noting
it's **view-only** (not editable). Details: [deck-template.md](../deck-template.md).
