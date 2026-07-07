# PPTX export — research & recommendation (editable, layout-faithful)

**Question:** what's the best way to export the React/Tailwind deck to PowerPoint with
**complete, editable layout** — real textboxes, tables, shapes, images, bullet lists —
not image-only? **Date:** 2026-06-20. **Method:** wide tech scan → 3 deep-dive
research agents on the top candidates → **4 verification agents that read pptxgenjs
source (`pptxgen.cjs.js` / `pptxgen.es.js`) and generated + unzipped real .pptx XML**.
Everything below marked ✅ is verified against emitted bytes, not docs.

## TL;DR — recommendation

**Fix the current DOM-walk in place, driven by a thin semantic annotation layer.**
Stay on **pptxgenjs**; do NOT adopt a third-party HTML→PPTX library. Every defect you
saw in the exported slides is a **specific, fixable bug** in our own walker — and the
fixes are all confirmed-supported pptxgenjs features. Realistic outcome: **~88–92%
visual fidelity with 100% editability**, no new runtime dependency.

Keep `pptx-image` (full-bleed screenshots) as the pixel-perfect, non-editable option.
The two serve different audiences; ship both.

## Why the exported slides looked broken — root causes

The two screenshots showed four real defects (and one false alarm). All four are bugs
in our bbox-walk in `export-deck.mjs`, not fundamental limits:

| Defect (seen) | Root cause | Fix | Confirmed? |
|---|---|---|---|
| Accent word ("week one" / "delivery team") **overlaps** the wrapped title | the accent `<span>` is emitted as a **separate textbox** at its own bbox | emit the whole heading as **ONE** `addText([run,run,…])` with per-run color | ✅ pptxgenjs `addText(runs)` emits a single `<p:sp>` with multiple `<a:r>` runs — verified in `gen-xml.ts` |
| Icons **blown up huge**, bleeding | SVG rasterized to the **svg intrinsic box**, not the chip | size the image to the **chip container** box; screenshot the chip element | ✅ `addImage` w/h control render size independent of intrinsic SVG dims |
| Card backgrounds **vanish**, text floats | shape added **after** text (or skipped) → wrong z-order | `addShape` (card) **before** `addText`/`addImage` for that region | ✅ `<p:spTree>` paints in insertion order; shape-first = behind |
| Vertical **drift** / loose spacing | `fontSize = px×0.75` with **no line-height** | keep `px×0.75` (it's correct), add `lineSpacingMultiple` = CSS `line-height` | ✅ maps to `<a:lnSpc><a:spcPct>`; px×0.75 is exact at 1280px→13.333in |
| "Comments" box | **NOT us** — that's PowerPoint's own Comments UI | n/a | ✅ verified: zero `Comments`/`em-`/`EditMode` in exported XML |

The `px×0.75` conversion is actually correct: a 1280-px canvas at 96 DPI = 13.333 in,
which is exactly the PPTX 16:9 slide width, so the scale factor cancels to 1.0. The
*only* font bug was the missing line-height.

## The 5 families compared

| Family | Editable | Fidelity ceiling | Tables/Shapes/Lists | Node-only | Effort | Verdict |
|---|---|---|---|---|---|---|
| **Improved DOM-walk + pptxgenjs (+ annotations)** | **Fully** | **~88–92%** | ✅ native (`addTable`/`addShape`/bullets) | ✅ no new dep | Medium | **RECOMMENDED** |
| `dom-to-pptx` (v1.1.10) in Playwright | Fully | ~85–90% | ✅ (via pptxgenjs) | ✅ but awkward | Low–Med | Fallback / cross-check |
| `html2pptx` (abdelkrimkr) | Fully | **~0–30% on Tailwind** | partial | ✅ | Low | **REJECT** |
| Headless LibreOffice | Partial | 40–60% on modern CSS | weak | ❌ needs LibreOffice | Low setup | REJECT (heavy dep, poor) |
| Direct OOXML (raw XML) | Fully | 100% theoretical | ✅ everything | ✅ | **Very high** | Only for the 5% pptxgenjs can't do |

### Why each non-winner lost

- **`dom-to-pptx`** — genuinely good: its `collectTextParts`/`isTextContainer`
  architecture **fixes the accent-span bug** (one textbox, colored runs), sizes SVGs
  by `getBoundingClientRect` (fixes icon bloat), and scales 1280×720 natively. **But**:
  3 months old, 6 npm dependents, single maintainer, no PowerPoint-version test matrix,
  card gradients become non-native SVG image embeds, and returning a `Blob` from
  `page.evaluate()` needs an undocumented Blob→ArrayBuffer bridge. It's an *upgrade we'd
  own anyway* — and we can copy its key insight (`collectTextParts`) into our own walker
  without taking the dependency. **Keep as a fallback / reference implementation.**
- **`html2pptx`** — disqualified. It parses **static CSS rules** with `cheerio`+`css`,
  no browser, so Tailwind utility classes don't resolve (only **24 hardcoded** utilities
  recognized — no width/color/typography). Inline SVG: drops everything except
  `<line>`/`<text>` → **charts and lucide icons become invisible**. No font embedding.
  File-path input only. Multi-column grids collapse. Useless for our deck.
- **LibreOffice** — its HTML importer doesn't understand Flexbox/Grid/Tailwind; 40–60%
  on modern markup, and it's a heavy system dependency we don't have installed.
- **Raw OOXML** — perfect control, weeks of work to re-implement what pptxgenjs gives
  us free. Reserve for a narrow gap (e.g. grouped shapes) via targeted XML injection.

## The semantic annotation layer (what makes the fixes robust)

The bbox-walk fails because it infers *intent* from *pixels*. We already annotate every
element with `data-viz-id`; add a tiny **intent** layer so the exporter builds from
meaning, not guesses. Minimal schema (the skill controls its own authoring, so this is
free):

```
data-pptx-role = title | body-text | card | table | list | chart | icon-chip
data-pptx-accent = "true"      // on a <span> inside a title/body → colored run, same textbox
data-pptx-fill   = "#RRGGBB"   // explicit card fill (skip CSS-parse guessing)
data-pptx-cols   = "3"         // table column count
data-pptx-list-type = bullet | number
```

Everything else (position, size, font-size, line-height, color, radius) is still read
from computed styles / bounding boxes — no attribute needed. Roles map 1:1 to emitters:
`title`→`addText(runs)`, `card`→`addShape` then recurse children, `table`→`addTable`,
`list`→`addText([{bullet:true,indentLevel}])`, `icon-chip`→**rasterize chip to PNG** →
`addImage`, `chart`→**rasterize SVG to PNG** → `addImage` (NOT inline-SVG — see below).

## ⚠️ Source-verified gotchas (from reading pptxgen source + emitted XML)

Four agents read pptxgenjs source and generated/unzipped real `.pptx` files. Findings
that directly shape the implementation:

- **Rich-text runs are real** ✅ — `addText([{text,options},…])` emits ONE `<p:sp>` /
  ONE `<a:p>` / multiple `<a:r>` runs. **But:** keep runs on one line by NOT setting
  `breakLine:true` on them; set `align` on the **container** opts, not per-run (per-run
  `align` *changes* force a new `<a:p>` → issue #751). This is the accent-span fix.
- **`px×0.75` is exact** ✅ — `fontSize` is emitted verbatim as centipoints (`sz=px×0.75×100`);
  1280px@96dpi = 13.333in cancels the canvas scale to 1.0. Divide out any
  devicePixelRatio / CSS transform on the slide container first.
- **Line-height** ✅ — unitless CSS `line-height:X` → `lineSpacingMultiple:X`
  (`<a:spcPct val=X×100000>`); px line-height → `lineSpacing: px×0.75` (`<a:spcPts>`).
  Set only one — `lineSpacing` wins if both. Order in `<a:pPr>` is lnSpc→paraSpc→bullet
  (pptxgenjs handles it; matters only if hand-building XML).
- **`addTable` is native + editable** ✅ — emits real `<a:tbl>` (graphicFrame), with
  `colspan`→`gridSpan`/`hMerge` and `rowspan`→`rowSpan`/`vMerge`. Cells take
  `{text, options:{fill,border,align,bold,…}}`.
- **z-order = call order** ✅ — no z-index API; `<p:spTree>` paints in insertion order.
  `addShape` (card) **before** `addText` puts text on top. Use plain `rect` (not
  roundRect) for accent bars so corners don't mask layers beneath.
- **SVG is BROKEN in Node** ⚠️ (verified empirically) — `addImage` with an SVG data URI
  embeds a vector blip + a PNG fallback, but the PNG fallback is rendered via a browser
  `<canvas>` that **doesn't exist in Node**, so pptxgenjs substitutes its `IMG_BROKEN`
  placeholder. Modern PowerPoint shows the vector; old PPT / LibreOffice / Google Slides
  / thumbnails show a broken-image icon. **So: pre-rasterize every SVG (charts + icons)
  to PNG ourselves** — we already inject `html-to-image` in the export path; capture the
  element to PNG at ≥2× and `addImage` that. Never pass inline SVG in the Node pipeline.

## Canonical prior art — Anthropic's own `pptx` skill

The mature pattern is exactly ours: **author intent-shaped HTML → render → read geometry
→ emit native pptxgenjs objects** (never screenshots-as-slides). Anthropic's official
`pptx` document skill (`document-skills/pptx`, `html2pptx`) is the reference impl. Its
hard rules to adopt:
- **Backgrounds/borders/shadows only work on `<div>`** — a "card" is a `<div>` wrapper;
  text lives inside it. (Matches `data-pptx-role="card"` on a div.)
- Use `<p>/<h1-6>/<ul>/<ol>` for all text; **rasterize gradients + icons to PNG**.
- Bullets: set `bullet:true` and don't put `•`/`-` in the text (auto-added).
- **Mandatory thumbnail-grid QA** — geometry alone never guarantees correctness, so the
  visual-review gate (`shoot-slides.mjs` + Read the PNGs) applies to exports too.
- pptxgenjs footgun: **never reuse an options object across `add*` calls** — it mutates
  them in place (EMU conversion corruption). Build a fresh object each call.

There is **no published `data-pptx-*` vocabulary** in the ecosystem — ours is novel but
sound; the principle everyone converges on is *annotate containers, stop descending at an
annotated node, and switch to a type-specific emitter* (which is what dodges the
inline-span-as-textbox trap). Geometry for **placement**, DOM/semantics for **content**.

## Phased implementation plan

**Phase 1 — cheap bug-fixes (immediate win, no authoring changes).** In
`scripts/export-deck.mjs` `exportPptxEditable`:
1. Build each heading as a single `addText(runs[])` — walk child text + accent spans
   into one run array (kills the overlap). No `breakLine` on runs; `align` on container.
   Don't emit a separate textbox per tagged inline child.
2. Add `lineSpacingMultiple` = computed `line-height / font-size` (kills drift).
3. Z-order: emit card/bg `addShape` **before** the text/images inside it; plain rect.
4. Icon/SVG: **pre-rasterize to PNG** (html-to-image `toPng` at ≥2×) sized to the
   **element's bbox** — fixes both the bloat (right box) and the Node `IMG_BROKEN` issue.
   For icon chips, capture the chip element so `currentColor` resolves.
5. Don't reuse option objects across `add*` calls.
This alone should take the visible output from "broken" to "good."

**Phase 2 — semantic roles (true fidelity).** Add the `data-pptx-*` attributes to the
deck-template slide components + example slide; rewrite the walker as a **role
dispatcher**. Adds real `addTable` and bullet `addText`, and removes the last guessing.

**Phase 3 — polish.** Noto Sans JP: reference by name (viewers with the font render
correctly); optionally offer a font-embedded variant. Consider raw-XML injection only
if grouped shapes are needed.

**Files that change:** `scripts/export-deck.mjs` (the walker — Phase 1 & 2),
`deck-template/src/slides/*.jsx` + components (Phase 2 annotations),
`references/deck-template.md` (fidelity table), this doc.

## Fidelity ceiling — what still won't transfer perfectly

- **Animations** (framer-motion / GSAP) — captured at settled state, static in PPTX.
- **Gradients / glass / backdrop-blur / box-shadow on shapes** — flatten to solid or
  2-stop linear; no PPTX equivalent for blur.
- **Lucide icons + SVG charts** — both go in as **raster PNG** (rasterized ≥2× because
  inline SVG embeds an `IMG_BROKEN` PNG fallback in the Node pipeline). Crisp on screen;
  may pixelate if printed >2×. True vector would require running pptx-gen in a browser
  context (not worth it) or a server-side SVG rasterizer (sharp/resvg) for higher DPI.
- **CJK font embedding** — name-referenced by default; full embed is heavy (~30 MB/weight).

For a perfect *look* with no editing, `pptx-image` remains the answer. For editable
handoff, the annotated DOM-walk is the right trade: 100% editable, ~90% faithful.
