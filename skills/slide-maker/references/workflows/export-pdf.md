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
- **Page size is 960×540 POINTS = 13.33×7.5in** — the standard 16:9 widescreen slide
  page. pdf-lib measures in points (72pt = 1in), *not* pixels: passing the 1280×720
  pixel count produced 17.78×10in pages, a size no printer or slide tool expects.
- **The screenshot is clipped to `.slide-page`.** A bare `page.screenshot()` captures the
  whole viewport, and present mode letterboxes the slide inside it — that padding got
  baked into every page as a white band, leaving the slide sitting in the top-left corner
  of an oversized page.
- **Edit mode is auto-stripped** before capture — the overlay never appears in the PDF.
- First run needs `npm install` + `npx playwright install chromium`.

## Check before handing over
Open `export/deck.pdf` — one page per slide, each matching its `review/slide-NN.png`,
crisp at print size. If a slide is wrong, fix the **HTML**
([slide-generate](slide-generate.md)) and re-export.

**Assert the page geometry — do not eyeball it.** "Looks fine" passed the corner bug for
a long time, because a slide anchored top-left on an oversized page still *looks* like a
slide:

```bash
node -e '
const {PDFDocument}=require("pdf-lib");const fs=require("fs");
(async()=>{const d=await PDFDocument.load(fs.readFileSync("export/deck.pdf"));
const {width:w,height:h}=d.getPage(0).getSize();
const ok = Math.abs(w-960)<1 && Math.abs(h-540)<1;
console.log(`${w}x${h}pt (${(w/72).toFixed(2)}x${(h/72).toFixed(2)}in) -> ${ok?"OK":"WRONG PAGE SIZE"}`);
})();'
```

For the fill check, export a slide with a **full-bleed background** and confirm all four
page corners carry its colour. White in three corners with content in the top-left is the
signature of the clip/page-size bug — and a white-background slide cannot tell you
anything, since the page is white too.

## Before you hand it over

An export is a re-render of the deck, so it can drift from the HTML in ways that are
invisible one slide at a time. Diff it:

```bash
node scripts/verify-export.mjs        # ranked per-slide diff vs the HTML render
```

Read the ranked table, then the worst slides. Details:
[visual-review.md → Reviewing an EXPORT](../visual-review.md#reviewing-an-export-is-a-different-job--diff-it-dont-browse-it).

## Done when
`export/deck.pdf` opens with all slides as pages. Hand the path to the user. Details:
[deck-template.md](../deck-template.md).
