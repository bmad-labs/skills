# Visual self-review — look at the rendered slides, not just the source

`check-slop.mjs` reads slide **source** — it catches off-brand colors, fonts, raw
hex, walls of text. It is **blind to how a slide renders**: a slide can pass
check-slop 0/0 yet have a hero number that came out tiny, a lopsided layout, or text
clipped at the edge. The only way to catch those is to **look at the pixels** — and
the agent (you) reads PNGs natively. This is the second gate: render → look →
critique → fix → re-render.

There are **three** complementary gates, all required before a slide is done:
- **`check-slop.mjs`** = source compliance (colors/fonts/density in the JSX).
- **visual review** = rendered craft (does it actually look right — composition, hierarchy, balance).
- **geometry gate** = positional facts (alignment, overlap, fits-the-frame) — **measured, not eyeballed**. See [The geometry gate](#the-geometry-gate-measure-dont-eyeball) below.

> **The #1 way this skill fails: declaring "done" from a full-slide PNG.** A 1280×720
> slide shown small makes a 30px overshoot, a 12px footer overlap, or an off-by-10
> misalignment **invisible**. The full-slide render judges *composition*; it CANNOT
> answer "is X aligned with Y" or "does the footer clear the margin" — those are
> numbers, and you must read them from geometry. If a user's request contains the words
> **align, same height, equal, overlap, fit, edge, below, above, touching, clipped, or
> margin**, it is a geometry-gate task: you are forbidden from calling it done on a
> visual glance — assert the actual pixel inequality first (next section).

## Workflow

1. **Render** the slides to PNGs:
   ```bash
   node scripts/shoot-slides.mjs --mode both
   ```
   Writes `deck-template/review/slide-NN.png` (clean) and `slide-NN-labeled.png`
   (every element boxed + named) and prints the paths.
2. **Read every `review/slide-NN.png`** (the clean ones) with the Read tool.
3. **Critique** each against the rubric below. For every issue, note the slide and —
   when you can — the offending element's `data-viz-id`.
4. **Localize hard-to-place defects** with the labeled render: Read
   `review/slide-NN-labeled.png` (or shoot `--inspect <ids>` for a focused box). The
   orange box + id label tells you the exact `data-viz-id`; **grep that id** in
   `deck-template/src/slides/*.jsx` to jump to the JSX.
5. **Fix** the JSX, then re-render just that slide and Read it again:
   ```bash
   node scripts/shoot-slides.mjs --mode normal --slide N
   ```
   Confirm the defect is gone.
6. **Re-run `check-slop.mjs`** after fixes (the source gate) — a visual fix must not
   reintroduce source slop.

## The geometry gate — measure, don't eyeball

Alignment, overlap, edge-clipping, and "does it fit" are **numeric facts**, not
impressions. You will get them wrong from a full-slide PNG every time. Read the
geometry instead and assert the inequality.

### The canonical frame (memorize these numbers)

The slide canvas is **1280 × 720**, always. `inspect.mjs` measures at exactly that size
(`width:1280, height:720, scale:1`), so its coordinates are **true slide-canvas
pixels** — no scaling, no guessing.

With the house **72px `slide-margin`** insets, every element must satisfy:

| Bound | Rule |
|-------|------|
| Top   | `y ≥ 72` |
| Bottom| `y + h ≤ 648`  ← the number agents miss most. Content past 648 is in the margin / clipping. |
| Left  | `x ≥ 72` |
| Right | `x + w ≤ 1208` |

Full-bleed slides (cover/divider/closing with `!p-0`) are the only exception.

### Coordinate-source gotcha — two different rects exist, only one is canonical

- **`inspect.mjs` → `geometry.json`** = `[{id,x,y,w,h}]` measured at **1280×720**. ✅
  **This is the only set you reason about.** Bottom = `y + h`. Compare against 648.
- **Edit-mode feedback** (`/tmp/slide-maker-edit/edit-feedback.json`, the `rect` field) =
  measured in the **user's browser viewport** (whatever size their window is). ❌ Do
  NOT do pixel math against these — they're for locating *which* element the user meant,
  not for measuring. Mixing the two scales is how agents "confirm" an alignment that is
  actually off by 30px.

### Assert it — don't describe it

For any align/overlap/fit request, run `inspect.mjs` on the elements and **compute the
delta**. Report the number, not a vibe ("Δ = 31px → FAIL", never "looks aligned").

```bash
node scripts/inspect.mjs --slide N --ids a.id,b.id,c.footer
node -e '
  const g = require("./review/geometry.json"); // or /tmp/slide-maker-inspect/geometry.json
  const b = id => { const e = g.find(x => x.id === id); return e ? e.y + e.h : null; };
  const bottom = b("s6.arena"), step = b("s6.step.3"), foot = b("s6.footer");
  const aligned = Math.abs(bottom - step) <= 2;          // "same height" = within 2px
  const fits    = foot !== null && foot <= 648;          // footer inside the margin
  console.log(`arena.bottom=${bottom} step.bottom=${step} Δ=${Math.abs(bottom-step)} → ${aligned?"ALIGNED":"FAIL"}`);
  console.log(`footer.bottom=${foot} (≤648?) → ${fits?"FITS":"OVERFLOW"}`);
'
```

Only when the asserts print PASS *and* the PNG looks right do you say done. If the
numbers and your eyes disagree, **the numbers win** — re-read the PNG, you misjudged the
scale.

### Define "done" as the user's words, restated as a test

Before fixing, write the acceptance test in the user's terms and keep it visible:
> "align arena with last step" → `s6.arena.bottom == s6.step.3.bottom (±2px)` AND
> `s6.footer.bottom ≤ 648`.

"Done" means *that test passes*, shown to the user with the measured numbers — never
"I'm fairly sure" or "it looks right now." If you cannot satisfy both halves at once,
that is a real layout conflict (the content is too tall): **say so explicitly** and
propose the trade (shrink a column, drop a row) rather than shipping an overlap and
calling it done.

### The 3-layer slide skeleton — the DEFAULT, and the cure for footer overlap

**Any content slide that has a footer (or risks overflow) MUST be built as three fixed
layers inside the `slide-page` flex column: a `shrink-0` header, a `flex-1 min-h-0`
content band, and a `shrink-0` footer.** This is a *structural guarantee*: each layer
owns its vertical space, so content **physically cannot** grow into the footer or off
the bottom edge — no matter how tall the content is. It ends the entire class of
"footer overlaps the content" / "this column is too tall" bugs at the source.

> This was learned the hard way: ~5 failed attempts to fix one footer overlap by tuning
> a magic height, then a margin, then `items-stretch`, then `absolute bottom`, each of
> which controlled *one* dimension while the others fought back and content won. The
> 3-layer split fixed it in one shot because it removes the fight entirely. **Reach for
> this skeleton first; don't rediscover it by tuning numbers.**

```jsx
<div className="slide-page flex flex-col" data-viz-id="sN">
  {/* HEADER — fixed at top */}
  <header className="shrink-0" data-viz-id="sN.header">
    <span className="text-eyebrow …">EYEBROW</span>
    <h1 className="mt-3 text-h1 …">Title</h1>
    <AccentRule className="mt-5" />
  </header>

  {/* CONTENT — fills the band between header and footer; can shrink, never overflows */}
  <div className="flex-1 min-h-0 mt-6 …" data-viz-id="sN.content">
    {/* columns: items-stretch makes them equal height; min-h-0 lets them shrink */}
    {/* tall artwork: <Svg className="h-full w-full" preserveAspectRatio="xMidYMid meet"/> */}
  </div>

  {/* FOOTER — fixed at bottom */}
  <footer className="shrink-0 mt-4 flex items-center justify-between" data-viz-id="sN.footer">
    <span className="text-footnote …">Acme Inc · … · Confidential v1.0</span>
    <span className="text-footnote …">N / total</span>
  </footer>
</div>
```

The `slide-page` already supplies `display:flex; flex-direction:column; padding:72px`,
so the header pins to the top inset, the footer to the bottom inset, and the content
takes the rest. Tall content (a portrait SVG, a long card list) **scales/shrinks within
the band** instead of pushing the footer.

### Supporting recipes — never reach for magic-pixel heights

Fixed `style={{height: 332}}` / `max-h-[360px]` **break the instant any sibling's height
changes** (a title wraps, a row is added) — they caused the repeated overlap regressions
above. Derive height from layout:

- **Two columns, equal height** → wrap in a `grid`/`flex` with **`items-stretch`**; the
  shorter grows to the taller. Never hard-code a height to "match" the other.
- **Footer that must never overlap content** → use the 3-layer skeleton (footer is a
  `shrink-0` sibling *after* the `flex-1` content). NEVER `absolute bottom-X` while the
  content is `flex:1` — they fight and content wins, overrunning the footer. (`mt-auto`
  on an in-flow footer also works, but the explicit 3-layer split is clearer and is the
  default.)
- **A flex child that must shrink to fit** (an SVG that should scale down) → give it
  **`min-h-0`**; without it, flex children refuse to shrink below content size and overflow.
- **Tall portrait artwork in a bounded card** → card sizes from `items-stretch`; the SVG
  gets `h-full w-full` + `preserveAspectRatio="xMidYMid meet"` to scale into it. No pixel height.
- **Distribute rows to fill a column's height** → `flex-1 min-h-0 flex flex-col justify-between`
  on the list spreads the rows so the last one aligns to the band bottom (e.g. arena
  bottom == last-step bottom — a real request from this build).

When two requirements collide (align A to B *and* keep the footer inside 648 ⇒ content
too tall), the fix is **reducing content** (tighter cards, smaller hero), not another
magic number. Say so to the user and propose the trade.

### Modes (shoot-slides.mjs)

| Flag | Output | Use |
|------|--------|-----|
| `--mode normal` (default) | `slide-NN.png` (clean) | the audience view — the primary review |
| `--mode labeled` | `slide-NN-labeled.png` (all elements boxed+named) | get the id map for the whole slide |
| `--mode both` | both | first review pass |
| `--inspect id1,id2` | `slide-NN-inspect.png` (only those boxed) | deep-dive one or two suspect elements |
| `--slide N` | just slide N | fast re-review after a fix |
| `--scale 2` | 2× pixels | crisp detail for small-text checks |

The labeled/inspect renders also write a `.json` with each box's `{id,x,y,w,h}`
geometry, if you want coordinates.

## The visual rubric

These are things you can **only verify by looking** — don't just re-check what
check-slop already does in source. For each, give a PASS or FIX with a one-line
reason. Your output is a short per-slide critique + the fixes you'll make — not a
score.

- **Focal point really dominates.** Squint: what does the eye hit first? Is the hero
  (KPI / number / title) visibly the biggest thing, or did a font-size class fail to
  apply so it rendered small? (This is the exact bug visual review was built to
  catch — a `70%` that came out 18px instead of 120px.)
- **Balance & whitespace.** Is content lopsided or clumped to one side? Are there
  dead gaps that read as "unfinished" rather than intentional breathing room? Aim
  ~35–40% empty, distributed — not a blank half + a crowded half.
- **Rhythm renders.** Is the eyebrow → title → accent rule → body sequence actually
  visible and evenly spaced, or collapsed / doubled / missing a step?
- **Hierarchy reads in actual sizes.** Title > subhead > body in *rendered* size;
  body isn't competing with the hero; the eyebrow is small and quiet.
- **Nothing clipped or overflowing.** No text cut off at the 1280×720 edge, no
  elements overlapping, cards aligned to the same baseline/grid. **This is a
  geometry-gate item, not an eyeball one** — if anything looks close to an edge, two
  things look like they might touch, or two elements should line up, STOP and measure
  (`y+h ≤ 648`, overlap, alignment delta) per [The geometry gate](#the-geometry-gate-measure-dont-eyeball).
  A full-slide PNG hides exactly these defects.
- **Color on-theme in the pixels.** The accent appears sparingly as the highlight
  (never a big fill or wash across the slide); backgrounds are light; no surprise
  dark panel or off-palette block that the source happened to allow.
- **Chart legible.** Bars and labels readable; the highlight bar is the accent one;
  axis/gridlines are quiet (light grey), not loud; no overlap with the title.
- **The slop "tells", seen not inferred** (cross-check
  [validation.md](validation.md)): everything centered, a wall of text, a second
  typeface sneaking in, decoration that means nothing, a raw clashing photo. If you
  can see one, fix it.

## When to use the labeled / inspect overlay

Reach for it whenever a defect is hard to pin to a specific element OR whenever the
question is positional (geometry gate):

- "Something in the middle is the wrong size" → labeled render names every block;
  find the one whose box is wrong.
- "These two things overlap" → inspect both ids, compare `y+h` of one to `y` of the
  other. **Measure — don't infer from the box drawing.**
- "Align A with B" / "same height" → inspect both, assert `|A.bottom − B.bottom| ≤ 2`.
- "Does it fit / clip / touch the edge" → inspect it, assert `y+h ≤ 648` (and `x+w ≤ 1208`).
- Confirming a fix touched the right element → `--inspect <id>` boxes just it.

It mirrors exactly what a human sees when they select an element in edit mode (same
orange box + id label) — it's the human's "point at it" turned into something you can
do yourself, headlessly, and read back as an addressable id.

## Notes

- Rendering is Playwright Chromium (`scripts/lib/deck-driver.mjs`) — pixel-identical
  to what a viewer sees. First run needs `npm install` + `npx playwright install
  chromium` in the deck dir.
- The clean (`normal`) render strips edit-mode and nav, exactly like exports — so
  what you review is what ships. The labeled render re-injects edit-mode only to draw
  the boxes; it never affects the deck or the exports.
