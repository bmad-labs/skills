# Editable PPTX export — high-fidelity, measured, verified

The deck has **two** PowerPoint export paths. Pick by audience:

| Path | Script | Editable? | Fidelity | Use when |
|------|--------|-----------|----------|----------|
| **Image** | `export-deck.mjs --format pptx-image` | ❌ no | pixel-perfect | the audience only views / never edits |
| **Editable** | `export-pptx-jsx.mjs` | ✅ native text+shapes | ~98% (verified) | the audience must edit text, recolour, re-use objects |

This page is the **editable** path. It turns each rendered slide into native PowerPoint
objects — real textboxes, rounded-rect cards, lines, (and native charts) — that open
fully editable in PowerPoint / Keynote / Google Slides.

## Why this design (the one rule that makes it work)

pptxgenjs is a **drawing API, not a layout engine** — it has no concept of flexbox,
grid, or text reflow. The naive approach (walk the DOM and *estimate* positions)
breaks on nested flex/grid, %/absolute positioning, and wrapping. The fix the whole
field converged on, and what we use:

> **Render in a real browser → MEASURE the laid-out DOM (`getBoundingClientRect`) →
> emit native OOXML.** You never interpret CSS; you read the final geometry the
> browser already computed.

We get the measurement for free from **`@artifact-kit/pptxgenjs-jsx`**'s measure-contract
(`measureArtifacts` / `readPptBox` / `readFontPt` / `readSlideLayout`), running inside
our existing Playwright pipeline (`scripts/lib/deck-driver.mjs`).

## Pipeline

```
deck (React) ─ Playwright renders the slide at native 1280×720, strips edit-mode/nav
   │  every element already has data-viz-id
   ▼
stamp data-ak-* on the live DOM:  alias data-viz-id → data-ak-measure;
   │  put data-ak-slide / -width / -height / -px-per-in on the VISIBLE slide root
   ▼
inject the pptxgenjs-jsx IIFE → measureArtifacts() → return measurements as JSON
   │  (MEASURE in the page; the in-page renderer drops children — see gotcha #2)
   ▼
BUILD the <Deck><Slide> tree in NODE from the measurements → native Text/RoundRect/…
   │  validateDeck() → write(deck,{outputType:'base64'}) → Node writes deck.pptx
   ▼
(optional) embed Inter  →  VERIFY with LibreOffice (render → pixel-diff)
```

## Run it

```bash
# from inside a copied deck:
node scripts/export-pptx-jsx.mjs                 # → export/deck.pptx (ALL slides, editable)
node scripts/export-pptx-jsx.mjs --slide 1       # just slide 1
node scripts/export-pptx-jsx.mjs --embed-fonts   # portable (see fonts below)
```

## The quality gate — `validate-pptx.mjs` (always run this)

**This is the single command that enforces export quality.** It exports, renders via
LibreOffice, runs EVERY check per slide — nothing skipped, no class falls between tools —
and **passes only when every issue is fixed or explicitly acknowledged.** The checks:
text position/size · **accent-run colour** (an accent word still the accent color?) · **line-count /
wrap** (1-line source didn't become 2) · shape fills · **table header rule/fill** · icons
present · graphics · SSIM · diff-regions.

> **Detection is SOURCE-DRIVEN, not ops-driven.** The colour/wrap checks compare the
> *source render* against the *pptx render* directly — so they catch a feature the export
> *dropped* (a flattened accent, a wrap), not just a feature the export *claims*. A gate
> that only inspects its own output is blind to omissions; that blind spot is exactly what
> let a flattened accent and wrapped bodies slip through before. When you add a new check,
> drive it from the source, not the op.

```bash
node scripts/validate-pptx.mjs            # full run: export → render → all checks → verdict
node scripts/validate-pptx.mjs --no-build # reuse the last export/render
```

Validation does **not** auto-clean — it overwrites the per-slide outputs in place and
keeps the diff/render artifacts so you can inspect them while fixing. **You** clean when
you want a fresh slate (e.g. after deleting a slide), with a separate command:
```bash
node scripts/clean-verify.mjs        # wipe verify-editable-pptx/ (KEEPS acknowledgements)
node scripts/clean-verify.mjs --all  # wipe everything incl. acknowledgements
```

Each issue gets a **stable content-hash ID** (e.g. `E0ILFRWU`). The discipline:

> **Treat EVERY issue as blocking. Review each one. Never dismiss as "minor".**
> Fix it, OR — only after verifying it's a genuine non-defect (e.g. a LibreOffice-vs-
> Chromium text-wrap difference, not a real export error) — acknowledge it BY ID with a
> reason. New or *materially worse* issues get a new ID, so acks never blanket-suppress
> regressions.

```bash
# after verifying an issue is acceptable (NOT a real defect):
node scripts/validate-pptx.mjs --ack <ID> --reason "why this is acceptable — what you checked"
# acknowledge SEVERAL at once (space- or comma-separated); the one reason applies to all:
node scripts/validate-pptx.mjs --ack <ID1> <ID2> <ID3> --reason "shared reason"
node scripts/validate-pptx.mjs --ack <ID1>,<ID2> --reason "…"
node scripts/validate-pptx.mjs --list-acks       # what's been waived + why
node scripts/validate-pptx.mjs --unack <ID> [<ID> …]   # remove waiver(s)
```
Use one `--ack` call per *distinct* reason; batch only IDs that share the same justification.

Acknowledgements live in **`export/verify-editable-pptx/pptx-acknowledgements.json`** — the audit
trail of what was waived and why. The gate fails on any **open** (unacknowledged) issue,
so a clean `✓ PASS` means: every element class verified, every exception justified.

All validation output lands under **`export/verify-editable-pptx/`** (gitignored build output):
```
export/verify-editable-pptx/
├── deck-report.json                  every check result + issue IDs
├── pptx-acknowledgements.json        waived issues + reasons
├── source/slide-NN.png               source render (from the HTML)
├── slides/slide-NN.png               render of the exported pptx (LibreOffice)
└── diff/
    ├── slide-NN.png                  pixel-diff heatmap
    ├── slide-NN_inspect.png          top diff-regions boxed on the render
    └── slide-NN_inspect.json         diff-region data (regions + elements in each)
```

### Lower-level tools (the gate orchestrates these — use directly to debug)
```bash
node scripts/verify-deck.mjs   --ops export/ops.json --ref-dir review --rendered-dir <png-dir>
node scripts/verify-text.mjs   --ref <src.png> --rendered <ren.png> --geometry <geom.json>
node scripts/verify-pptx.mjs   export/deck.pptx --ref review/slide-01.png   # SSIM + heatmap
node scripts/diff-regions.mjs  --ref <src.png> --rendered <ren.png> --geometry <geom.json>
```

`verify-pptx.mjs` reports **two** metrics and writes artifacts to `export/verify-editable-pptx/`:
- **STRUCTURE (SSIM)** — the **gate** (default ≥ 90%, `--ssim-min`). Structural similarity
  is shift/AA-tolerant, so it reflects REAL drift (a dropped chart, a moved block), not
  text-edge noise. This is the number that matters.
- **pixels differ %** — detail only; **inflated by LibreOffice-vs-Chromium font hinting**,
  so a visually-perfect text slide still shows ~2–3%. Never gate on this alone.
- `rendered-1.png`, `diff.png` (heatmap: red = hard diff · yellow = AA), `compare.png`
  (source / rendered / heatmap stacked — Read this).

### Pinpoint a failure — `diff-regions.mjs`

When SSIM is below the gate, don't eyeball the heatmap — **rank the worst areas and name
the elements in them**:

```bash
node scripts/inspect.mjs --slide N --all --mode clean   # → /tmp/slide-maker-inspect/geometry.json
node scripts/diff-regions.mjs --ref review/slide-0N.png --rendered <libreoffice-render>.png \
     --geometry /tmp/slide-maker-inspect/geometry.json --top 5
```

It clusters the **hard** diff pixels into regions, ranks them by share of the total diff,
and lists every `data-viz-id` inside each (with box + overlap). It writes a JSON report
(`export/verify-editable-pptx/regions.json`) and an annotated PNG, and prints a **verdict**:
- **one region ≫ others (≥50% share)** → *structural* — fix that element (e.g. the table's
  cells, a mis-sized icon).
- **diff spread evenly across text regions** → *font-render noise*, not a layout defect →
  the fix is making LibreOffice use the real Inter, not changing the export.

So the loop is: **SSIM fails → `diff-regions` names the elements → fix by cause → re-verify
the one slide → confirm SSIM rose.**

## Author for clean export — the highest-leverage half

The exporter is **generic**: it walks the slide DOM and **auto-classifies** every node
from its tag + computed style — no per-slide code, no hardcoded ids. A `<table>` → a
native PowerPoint Table; an element with a background/border + children → a card
`RoundRect` (then it recurses into the children); a leaf text node → a `Text`; an
element holding an `<svg>` → an icon (vector `CustomGeometry`); a thin coloured strip →
a rule. So **any** slide — lists, tables, complex multi-region dashboards — converts
with no extra work, as long as it's authored as clean nested boxes. (Verified at
~96–98% fidelity on a cover slide, a 6-item list, a 4-column table, and a mixed
KPI+list+callout dashboard.) `data-viz-id` is still used as a stable label, but
classification no longer depends on specific ids. Build slides export-aware and the
editable PPTX comes out right the first time — these rules cost nothing for the live
deck, they're just good structure.

### The element-box rule (most important)

PowerPoint has no flexbox/grid — every object is an absolutely-placed box. So **make
every thing you want in the PPTX its own clean, tagged box**, and let the browser do the
layout:

- **One tag per mappable thing.** Put `data-viz-id` on each text block, card, chip,
  rule, icon, and chart — the level you'd want to click-and-edit in PowerPoint. The
  exporter emits exactly one native object per tagged element.
- **Containers wrap their content.** A card's tagged `<div>` should bound everything
  inside it; its box becomes the `RoundRect`. Don't tag overlapping absolutely-positioned
  siblings with no shared container — their measured boxes won't relate.
- **A paragraph is one `<p>`/`<div>`, not many `<span>`s.** Tag the whole text block;
  it becomes one wrapping textbox. Only split into runs when you genuinely need
  word-level formatting (e.g. a coloured accent word — see below).
- **Put style on the element you tag.** The exporter reads the *computed* colour /
  font-size / line-height of the tagged node. If the colour lives only on an ancestor or
  a child `<span>`, the tagged node may read the wrong value. Style the tagged element.

### Element → pptxgenjs-jsx component (exact recipes)

These are what the **generic mapper emits for you** — you don't write them per slide;
they're the reference for how each authored element becomes a native object (and what
you'd extend if you add a new element class to `export-pptx-jsx.mjs`). Each is emitted
in Node as `h(Component, props)` (see gotcha #1 — build in Node, not the page); geometry
comes from the DOM walk, never hardcode coordinates. The constants:

```js
const PX_PER_IN = 96;            // 1280/13.333 → standard widescreen layout
const inch  = (px) => px / 96;   // CSS px → PPT inches  (positions/sizes)
const pt    = (px) => px * 72/96;// CSS px → PPT points  (line/letter spacing from computed px)
const box   = (id) => readPptBox(id);   // measure-contract: {x,y,w,h} inches for a data-viz-id
const fpt   = (id) => readFontPt(id);   // measure-contract: that element's font size in points
```

**Text block** (eyebrow / title / card title / body / footer / KPI number):

```js
h(Text, {
  ...box(id),                    // x,y,w,h in inches, measured
  fontSize: Math.max(6, fpt(id)),// floored; readFontPt already does px*72/96
  fontFace: 'Inter',
  color: '0F172A',               // hex, NO '#'. Neutral ink. accent=4F46E5, muted=64748B
  bold: true,                    // ONLY 400/700 exist — font-light/black collapse to these
  align: 'left', valign: 'top', margin: 0,   // margin:0 kills PPT's default text inset
  wrap: false,                   // single-line label → false (keeps exact metrics)
  fit: 'none',                   // never 'shrink' (LibreOffice mis-renders it)
  lineSpacing: pt(cssLineHeightPx),  // EXACT points from computed line-height
  charSpacing: pt(cssLetterSpacingPx), // points; OMIT if 0 (negative not allowed)
  text: el.textContent.trim(),
});
```
For a **multi-line body**, set `wrap: true` and add a +10% height buffer for CJK
(`h: box(id).h * 1.10`). Everything else identical.

**Card / panel** (`rounded-lg bg-bg-card border`):

```js
h(RoundRect, { ...box(id),
  rectRadius: 0.06,              // FRACTION of the shorter side, not px (Tailwind rounded-lg ≈ 0.06)
  fill: { color: 'FFFFFF' }, line: { color: 'E7E4E1', width: 0.75 } });
```

**Chip / pill** (`rounded-full`): same but `rectRadius: 0.5`, `line: { type: 'none' }`.

**Thin rule / divider** — a **filled RoundRect**, NOT a Line (gotcha #3: a `cy=0`
connector makes LibreOffice export fail):

```js
const r = box('s1.rule'); const hh = Math.max(r.h, 0.03);
h(RoundRect, { x: r.x, y: r.y + (r.h-hh)/2, w: Math.max(r.w, 0.6), h: hh,
  rectRadius: 0.5, fill: { color: '4F46E5' }, line: { type: 'none' } });
```

**Bar chart of real data** → native `BarChart` (editable, "Edit Data in Excel"):

```js
h(BarChart, { ...box('s0.chart'),
  data: [{ name: 'Adoption', labels: ['Q1','Q2','Q3','Q4'], values: [12,18,24,30] }],
  barDir: 'col', chartColors: ['4F46E5'],
  catAxisLabelFontFace: 'Inter', catAxisLabelFontSize: 8,
  valAxisHidden: true, showValue: true, dataLabelFontSize: 9 });
```
Single-series gotcha: never pass one data object full of `undefined` values — PowerPoint
shows a repair dialog. Use `0`, or ensure ≥1 real series.

**`<table>`** → native, editable PowerPoint **Table** (`Table`/`TableRow`/`TableCell`).
Author a real `<table>` with `<thead>/<tbody>/<th>/<td>`; the mapper reads each cell's
text + computed `fontWeight`/`color`/`backgroundColor`/`textAlign` and builds the table
at the table's measured box, columns split evenly. `<th>` → bold header cells.

```js
h(Table, { x, y, w, h, colW: [w/4,w/4,w/4,w/4], rowH: h/nRows, fontFace: 'Inter' },
  h(TableRow, null, ...cells.map((c) => h(TableCell, { text: c.text, options: {
    fontFace: 'Inter', fontSize: c.fontPt, bold: c.bold, color: c.color,
    fill: c.fill ? { color: c.fill } : undefined, align: c.align, valign: 'middle',
    margin: [3,6,3,6] } }))));
```
Limit: cell-level zebra `fill` / tinted-column `color` may not fully survive LibreOffice
rendering (they're emitted; PowerPoint honours them better). Merged cells (colspan/rowspan)
are not yet read.

**Diagonal line / arrow** → `LineBetween` (NOT `Line` — it computes flipH/flipV so the
arrow points the right way): `h(LineBetween, { x1, y1, x2, y2, line: { color:'0F172A', width:1, endArrowType:'triangle' } })`.

**Simple SVG path** → `CustomGeometry` with a `points` array (M→`{moveTo:true}`,
L→point, C→`{curve:{type:'cubic',x1,y1,x2,y2}}`, Q→`{curve:{type:'quadratic',x1,y1}}`,
Z→`{close:true}`); coordinates are local inches `= (svgCoord - viewBoxMin)/viewBoxDim * boxInches`.

**Icons (lucide / Material / Font Awesome)** → handled automatically. Any tagged element
containing an inline `<svg>` is converted to native, **recolorable** `CustomGeometry`
shapes by `scripts/lib/svg-to-custgeom.mjs` — **set-agnostic**: it reads each child's
*computed* fill/stroke (not the library name), so a FILLED path (Material/FA) →
`fill:{color}` and a STROKE path (lucide) → `fill:{type:'none'} + line:{color,width}`.
`svgpath` normalises arcs/smooth-curves to cubics (no pptx `arcTo`); `<circle>/<line>/
<polyline>/<rect>` are normalised to a `d` and run through the same pipeline. Stroke
width → points `= strokeUnits * (iconIn/max(vbW,vbH)) * 72` (NOT box-scaled). **Fallback:**
SVGs with gradients/masks/`<defs>`/`<use>`/embedded images can't vectorise → the exporter
rasterises the host element to a PNG (`html-to-image`, `pixelRatio:3`) and emits an
`<Image>`, so export never breaks. *Caveat:* lucide round linecaps/joins render flat in
PowerPoint (a `line` limitation) — recognisable, recolorable, but not pixel-perfect;
filled sets (Material/FA) convert cleaner. **Author rule:** use an SVG icon set, never
Unicode emoji (slop — see [validation.md](validation.md)).

### Accent-word colour → two `TextRun`s in one `Text`

`<h1>Three practices, one <span data-viz-id="s1.title.accent" class="text-primary-500">delivery team</span></h1>`:
tag the accent span, then emit ONE Text with two runs so the split stays editable:

```js
h(Text, { ...box('s1.title'), fontSize: fpt('s1.title'), fontFace:'Inter', bold:true, margin:0 },
  h(TextRun, { text: 'Three practices, one ', options: { color: '0F172A' } }),
  h(TextRun, { text: 'delivery team',         options: { color: '4F46E5' } }));
```
(Default is a single run coloured by the title's dominant colour; do this only when the
two-colour split matters.)

### DON'T (these don't map to native objects)

- Per-corner border-radius, gradients, `box-shadow`, `filter:`, `clip-path`,
  `backdrop-filter` — no native equivalent. Either accept a flat approximation or let
  that element rasterise. Keep them off anything you need editable.
- Negative `letter-spacing` (pptxgenjs `charSpacing` min is 0).
- A zero-height / zero-width shape (LibreOffice rejects `cy=0` connectors — gotcha #3).
- Hiding the active slide with `display:none` while exporting (its boxes can't be
  measured — the exporter already picks the visible root; just don't fight it).
- A **conditional Tailwind colour built inside a `.map()`/ternary** for a colour that
  must survive export (e.g. `c === 3 ? 'text-primary-500' : 'text-text-secondary'` per
  table column). It can render correctly in `npm run dev` yet flatten to the wrong colour
  in the standalone/export build (purge + CSS source-order — gotcha #13). For an
  export-critical colour, use an inline `style={{ color: '#4F46E5' }}` (the exact token
  value) instead.

### Fonts in authored slides

Stick to the active theme's font (**Inter** is what the exporter embeds). Contrast comes
from weight, not a second family — and only Regular(400)/Bold(700) embed cleanly, so avoid
depending on `font-light`/`font-black` rendering precisely in the PPTX.

### Quick self-check before export

- Every editable thing has a `data-viz-id`? 
- Each card/panel wraps its own content in one tagged box?
- Bodies are single `<p>`/`<div>`s (not span-soup)?
- Colour/size live on the tagged element, not just an ancestor?
- No reliance on gradients/shadows/filters for anything that must stay editable?
- Charts are real data (→ native chart) rather than decorative SVG where possible?

If yes, `export-pptx-jsx.mjs` will reconstruct the slide faithfully — then prove it with
`verify-pptx.mjs` and read the heatmap.

## Fonts (Inter)

- The deck text is Latin; if **Inter is installed** on the opener's machine it renders
  perfectly. The vendored OTF (SIL OFL) live in `assets/fonts/`.
- **Embedding is OPT-IN (`--embed-fonts`)** via `pptx-embed-fonts`. It makes the file
  portable to machines without the font — but the embedded `.fntdata` parts make
  **LibreOffice mis-render** (garbled text), so the default-off file is what you
  verify, and an embedded file should be checked in **PowerPoint**, not LibreOffice.
- For the LibreOffice **verify** render to match, install the font on the host
  (`assets/fonts/*.otf` → `~/Library/Fonts` on macOS, or copy into `~/.fonts` + `fc-cache`
  on Linux). The family name is exactly `Inter`.

## Gotchas learned (each one cost a real debugging round — don't rediscover them)

1. **Build the tree in Node, not the page.** The IIFE's in-page renderer silently
   drops `Slide` children → an empty `<p:spTree>`. So: *measure* in the browser
   (return plain JSON), *build + render* in Node (proven correct).
2. **`write(deck,{outputType:'base64'})`** is the data-returning call — `renderPptx`
   returns a Promise<string> (the written filename), not a writable instance.
3. **The accent rule must be a filled `RoundRect`, not a `Line` with `h:0`.** A
   zero-height connector (`<a:ext cy="0"/>`) makes LibreOffice's PDF/PNG export fail
   with `Io … Write Code:16`.
4. **Guard the layout size.** `readSlideLayout()` returns `{name,width,height}` — read
   `width`/`height` (NOT `.w`/`.h`). A wrong key → `<p:sldSz cx="NaN"/>` → the whole
   file is rejected by LibreOffice *and* PowerPoint. `validateDeck()` does NOT catch this.
5. **Pick the VISIBLE slide root.** The deck keeps several `.slide-page` nodes mounted;
   measure only the on-screen one and alias `data-viz-id`→`data-ak-measure` *within it*,
   or `readPptBox` throws on hidden elements ("missing numeric x").
6. **Font embedding breaks the LibreOffice verify render** (see Fonts). Keep it opt-in.
7. **macOS LibreOffice can't write into the project tree** (`Code:16`); `verify-pptx.mjs`
   converts inside a `/tmp` workdir with its own `-env:UserInstallation` profile.
8. **`--slide N` is 1-based by deck order.** `SLIDES=[Cover, HeroMetrics]` → slide
   1 is Cover (`s1.*`), slide 2 is HeroMetrics (`s0.*`).
9. **Inline-coloured words flatten to one colour unless you split runs.** A title like
   `Compare the <span class="text-primary-500">options</span>` exports all-black unless the
   exporter walks the leaf's child nodes and emits one `TextRun` per coloured run inside a
   single `Text` (each run's `options.color` from its node's computed colour). The exporter
   does this now; the lesson: a text op carries `runs[]`, not just one `color`.
10. **A text leaf with its OWN background is a pill/chip — centre it + inset by padding.**
    The accent "+12 pts" chip exported `align:left valign:bottom` at the full pill width, so
    the text jammed against the rounded left edge and sat low. Pills read **centred both
    ways**, inset by the element's `px-*` padding. (The big-number `valign:bottom` baseline
    logic must NOT fire on a small padded chip — gate it on `hasOwnBg`.)
11. **LibreOffice wraps a hair wider than Chromium — a 1-line source can become 2 lines.**
    Narrow bodies (e.g. "across the last four quarters" in a ~2in box) wrap one word sooner
    in the pptx. Fix at export: when the **measured box height** says the source is one line
    (ground truth — NOT the char-count heuristic, which over-predicts wrapping), give the
    box a small width buffer (~+12%) and force `wrap:false`. The box is invisible; only the
    flow changes.
12. **A thin header rule (`border-b-2`) doesn't survive as a native table cell border.**
    Capture the header's bottom border separately (`headerRule {box,color,width}`) and draw
    it as a thin filled `RoundRect` on the header's bottom edge — same trick as the rounded
    header bar (gotcha #3: cell borders / `cy=0` lines don't export).
13. **Standalone build ≠ dev for Tailwind classes built inside `.map()` ternaries.** A
    conditional `text-primary-500` emitted in a loop showed the accent in `npm run dev` but
    rendered grey in the standalone/export build (purge + CSS source-order let
    `text-text-secondary` win). For a colour that MUST survive export, use an inline
    `style={{ color: '#4F46E5' }}` (the exact token value) — it can't be purged or
    out-ordered. Sample the rendered PNG to confirm, don't trust the dev server.
14. **Capture EVERYTHING in presentation mode — never the normal-mode editor page.**
    The deck has two modes; the rail/topbar/grid + a grey stage margin belong to NORMAL
    mode. All pixel captures (the editable + image PPTX, the PDF, and the review
    shooter's *clean* render) must drive `__DECK.setPresent(true)` first (shared
    `enterPresentMode()` in `deck-driver.mjs`) so they measure the full-bleed 1280×720
    slide ONLY. The standalone-HTML export is the one exception — it ships both modes.
    Symptoms when this is wrong: source render has a grey margin while the export is
    full-bleed → the diff never aligns and SSIM tanks for reasons unrelated to fidelity.
15. **`__DECK.goTo(i)` is ABSOLUTE (0-based index), not "advance one".** Navigating per
    slide with a relative-step loop (`for(...) goTo(1)`) parks EVERY slide on index 1 —
    so all content slides export as slide-2's DOM (same root id, identical object
    count). Jump straight: `gotoSlide(page, idx-1)`. Tell: the export log prints the same
    `active slide root: s2` for every slide. (Was wrong in export-pptx-jsx + inspect.)
16. **The LibreOffice verify workdir (`/tmp/slide-maker-validate`) MUST be wiped each run.**
    `pdftoppm` emits both `p-1.png` (single-digit) and a later run's `p-01.png` (padded);
    the copy loop's `/^p-\d+\.png$/` matches BOTH, so a leftover `p-1.png` from an OLD
    export (even a different deck) silently overwrites the fresh `slide-01.png` — you
    then validate the WRONG slide. Tell: some slides score 89–94% (fresh) while others
    show stale/foreign content at 40–60%. `validate-pptx.mjs` now clears `p-*.png` +
    `deck.pdf` before each render.
17. **An `<img>` (and image+overlay COMPOSITE) must be rasterised, or it vanishes.** The
    DOM walk had no IMG case, so cover/closing photos dropped entirely. Three rules now
    catch them: (a) a bare `<img>` → rasterise to `<Image>`; (b) a text-free element that
    DIRECTLY contains an `<img>` (img + duotone/multiply/gradient overlay siblings) →
    rasterise the WHOLE layer so the blend composites (a half-bleed hero, a faint-photo
    band); (c) a near-full-bleed text-free container of pure decoration (atmospheric
    blobs, gradient washes) → rasterise as a background `<Image>`. **Scope tightly**: gate
    on *direct* img child + no text, else the rule swallows a content column and the
    slide collapses to one image (text lost). The general principle: anything with no
    native vector/text equivalent (photos, blends, blobs) → one rasterised `<Image>`.
18. **A thin accent bar is a rule in EITHER orientation — and the builder must know which.**
    A vertical left-edge accent (`w-1` ≈ 4px wide, tall) failed the rule classifier
    (which required a wide+short box) and dropped. Two halves: the DOM walk now detects a
    thin bar by `w≤thin && h≥long` too (vertical), AND `buildRule` is orientation-aware —
    for a vertical bar it floors the WIDTH (not height) and never inflates to the
    horizontal min-width, or a 4px accent renders as a fat rounded blob over the card
    text. (`rectRadius` is a FRACTION of the shorter side; 0.5 = a clean capsule.)
19. **A hero number rendered by animated `CountUp` can export tiny/misplaced.** The
    measure-contract reads the inline `<motion.span>` wrapper, not the styled outer box →
    the number shrinks and dislocates. For a HERO number that must survive the editable
    PPTX, render STATIC styled text (`<p className="text-[112px] …">67</p>`), not CountUp.
    (CountUp is fine for HTML/PDF/image exports and secondary counters.)

## Files

- `scripts/export-pptx-jsx.mjs` — the editable exporter (measure → build → render → embed).
- `scripts/verify-pptx.mjs` — LibreOffice render + **SSIM gate** + pixel-diff heatmap + side-by-side.
- `scripts/diff-regions.mjs` — rank the worst diff regions + list the `data-viz-id`s in each (JSON + annotated PNG); the failure-pinpoint tool.
- `scripts/lib/svg-to-custgeom.mjs` — SVG icon → recolorable vector `CustomGeometry`.
- `assets/fonts/Inter-{Regular,Bold}.otf` — vendored (SIL OFL) for embedding + LibreOffice.
- Deps (devDeps): `@artifact-kit/pptxgenjs-jsx`, `pptx-embed-fonts`, `pixelmatch`, `pngjs`, `ssim.js`, `svgpath`.

Grounding research: [pptx-export-research.md](pptx-export-research.md).
