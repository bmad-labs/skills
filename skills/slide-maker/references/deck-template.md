# Deck template — a ready-made deck you just fill with slides

`deck-template/` is a complete React + Tailwind slide deck with the token-driven theme,
two modes (**Normal/editing** and **Presentation**), keyboard control, responsive
fit-scaling + zoom/pan, calm transitions (framer-motion + GSAP), present tools (laser
/ pen / highlighter), **edit mode**, an in-app **Export** menu, and **exporters** all
pre-wired. You don't build the harness — you copy it and write `slides/*.jsx`.

## Two modes (Google-Slides-style)

The deck opens in **Normal mode** and you press **Present** (or `F5`) to present.

- **Normal mode** — the editing/authoring view. A left **slide rail** shows a live
  mini-render of every slide (click to jump); a **top bar** has the deck name, a
  **grid/overview** toggle, a **speaker-notes** toggle, **zoom** controls, an
  **Export** dropdown, and the **Present** button. Toggle **edit mode** (the rail's
  ✎ Edit button or `e`) to select elements and leave comments for the agent (see
  [edit-mode.md](edit-mode.md)). **Zoom/pan:** the toolbar `−`/`+`/Fit, **Ctrl/⌘ +
  wheel** or **trackpad pinch** (zoom-to-cursor), and — when zoomed in — **drag** or
  two-finger scroll to **pan**. "Fit" is the default zoom; switching slides is
  **instant** (no transition) so authoring feels snappy.
- **Presentation mode** — requests real OS **fullscreen** (falls back to filling the
  browser tab if blocked). Chrome hides; a **bottom-LEFT bar** that reveals when the
  cursor enters that corner carries the present tools — **L** laser, **P** pen,
  **H** highlighter, **C** clear (all ephemeral, like Google Slides) — plus nav and
  Exit. Laser hides the OS cursor and uses the red dot as the pointer. Slide changes
  use the **deck-wide transition** picked in the top bar (default **Fade**; also
  Slide / Push up / Slide+fade / Zoom / Zoom out / Reveal / None) — all overlap so
  there's no dark gap. `Esc` (or `F5`) leaves.

Both modes show the same fixed **1280×720** slide canvas, **centered and scaled to
fit** any window — the canvas is centred via its own `translate(-50%,-50%)` transform
(not flex), so it stays fully visible with even margins even when the viewport is
narrower than 1280px.

It matches the `slides-generator` stack (same vite configs, `slide-page` /
`slide-content` idiom), themed with the tokens from
[tailwind-theme.md](tailwind-theme.md). Slides render at a fixed **1280×720** canvas
(matches the static templates and keeps export geometry exact), scaled to fit.

## File map

```
deck-template/
  package.json  vite.config.js  vite.standalone.config.js  postcss.config.js
  tailwind.config.js              ← the token-driven theme (maps CSS vars: accent, ink, surface, …)
  index.html                      ← uses the system font stack (edit-mode is loaded by App.jsx, dev-only)
  public/edit-mode/                ← the feedback overlay (dev only): edit-mode.js,
                                     edit-mode.css, html-to-image.js (vendored, for snips)
  assets/fonts/                    ← Inter (Regular/Bold) — for PPTX font embed + LibreOffice verify
  scripts/                         ← check-slop, shoot-slides, export-deck, serve,
                                     inspect (agent element inspection),
                                     export-pptx-jsx (editable PPTX — a slim orchestrator;
                                       browser-side DOM measurement lives in lib/dom-walk.browser.js,
                                       node-side op→node builders in lib/pptx-builders.mjs),
                                     validate-pptx (THE quality gate: all checks + ack system),
                                     verify-export (ranked HTML-vs-export diff — run after ANY export),
                                     verify-deck (unified per-class gate), verify-text (text pos/size),
                                     verify-pptx (LibreOffice SSIM), diff-regions (rank diff areas),
                                     lib/ (deck-driver; svg-to-custgeom — SVG icon→vector;
                                       dom-walk.browser.js — injected slide measurer → typed ops;
                                       pptx-builders.mjs — ops → pptxgenjs nodes) (travel with the deck)
  export/verify-editable-pptx/                  ← all validation output (gitignored): deck-report.json,
                                     pptx-acknowledgements.json (waived issues+reasons),
                                     source/<slide>.png (from HTML), slides/<slide>.png (from pptx),
                                     diff/<slide>.png (heatmap) + diff/<slide>_inspect.{png,json}
  src/
    main.jsx
    App.jsx                       ← SLIDES + NAV_ITEMS + PRESENTATION_NAME; mode state, edit loader
    index.css                     ← light token-driven base, slide-page/slide-content/grid + mode classes
    components/
      TopBar.jsx                  ← Normal-mode top bar: grid/notes toggles, zoom, Export, Present
      SlideRail.jsx               ← Normal-mode left rail of live thumbnails + Edit toggle
      SlideThumb.jsx              ← one live mini-rendered slide (used by rail + grid)
      GridView.jsx                ← Normal-mode "all slides" overview grid
      NotesPanel.jsx              ← Normal-mode speaker-notes panel (reads NAV_ITEMS[i].notes)
      ExportMenu.jsx              ← Export dropdown — copies a per-format export prompt for the AI
      TransitionMenu.jsx          ← deck-wide present-mode transition picker
      transitions.js              ← transition catalog (mirrors design-system/transitions.csv)
      Toast.jsx                   ← transient confirmation banner (used by Export)
      PresentBar.jsx              ← Presentation-mode bar (bottom-left, reveals on corner hover)
      PresentMode.jsx             ← laser / pen / highlighter overlay (ephemeral, like Google Slides)
      useFullscreen.js            ← OS fullscreen w/ in-browser fallback (Present)
      Background.jsx              ← accent-blob atmosphere (wow-guide §3)
      SlideTransition.jsx         ← framer helpers (StaggerContainer/Item, CountUp,
                                     AccentRule) + GSAP (useSlideGsap, gsap, useGSAP)
      Diagram.jsx                 ← a diagram + click-to-zoom lightbox (see diagrams.md)
                                     (all chrome above carries data-navigation → hidden on export)
    slides/
      00-EXAMPLE-hero-metrics.jsx ← worked exemplar — copy its shape, fully annotated
```

## Build a deck (the loop)

1. **Copy** `deck-template/` to your working folder. `npm install`.
2. **Write slides** in `src/slides/`. Copy the example's shape. Rules:
   - Root is `<div className="slide-page" data-viz-id="sN">`; content in `slide-content`.
   - Style with the Tailwind tokens only (`text-primary-500`, `text-h1`, `bg-bg-card`,
     `shadow-accent`, …) — never raw hex or generic Tailwind colors.
   - Follow [wow-guide.md](wow-guide.md): one hero, eyebrow→title→rule→body rhythm,
     calm motion — framer helpers (`CountUp`, `AccentRule`, `StaggerContainer`) for
     simple reveals, or **GSAP** (`useSlideGsap`) for timeline/sequenced animation
     (see wow-guide §4). Both are available; don't animate one element with both.
   - **Annotate every element** with `data-viz-id` (see [edit-mode.md](edit-mode.md)).
     This same tag drives the editable-PPTX export — so put one on every text block,
     card, chip, rule, and chart you want to survive as a native PowerPoint object.
   - **Author export-clean** so the editable PPTX converts faithfully: build each
     mappable thing as its own tagged box (a card wraps its content; a body is one
     `<p>`), put colour on the element you tag (not only an ancestor), and prefer the
     primitives that have native PowerPoint equivalents. Full checklist:
     [pptx-editable.md → Author for clean export](pptx-editable.md).
3. **Register** each slide in `src/App.jsx`: import it, add to `SLIDES`, add a
   `NAV_ITEMS` entry, set `PRESENTATION_NAME`. Each `NAV_ITEMS` entry is
   `{ slideIndex, label, notes }` — `label` shows in the rail/grid, and the optional
   **`notes`** string is the speaker note shown in Normal mode's notes panel (a
   presenter aid; it lives here, not inside the slide, so it never renders or exports).
4. **Run** `npm run dev` → http://localhost:5173. Opens in **Normal mode**.
   Shortcuts: arrows/number keys navigate; **E** edit, **G** grid overview, **F5**
   present. In **Presentation mode**: **L** laser, **P** pen, **H** highlighter, **C** clear, **Esc** exit.
5. **Validate (source)**: `node scripts/check-slop.mjs src/slides/*.jsx` → fix any ERROR.
6. **Review visually**: `node scripts/shoot-slides.mjs --mode both`
   → Read the PNGs, critique against [visual-review.md](visual-review.md), fix what
   looks wrong (use the labeled overlay to localize). The two gates are
   complementary — source slop AND rendered craft.
7. **Iterate with the human via edit mode** (below).
8. **Export** when done (below).

## Edit mode (collaborate)

`node scripts/serve.mjs --dev` runs the deck dev server **and** the
feedback bridge together. In **Normal mode**, the user turns on edit mode (the
rail's **✎ Edit** button or **`e`**), selects/snips elements, clicks **"Copy
for AI"**, and says "read the feedback" — you read
`/tmp/slide-maker-edit/edit-feedback.json`. Edit mode is Normal-mode only; entering
Presentation mode hides it. Full guide: [edit-mode.md](edit-mode.md).

## Export — HTML, PDF, PPTX (edit mode auto-stripped)

The deck has an **Export dropdown** in the Normal-mode top bar. Because exporting
runs a Node script (the browser can't write the file itself), picking a format
**copies a ready-to-paste prompt to the clipboard** and toasts the user to paste it
into Claude — Claude then runs the matching script below. (The four menu items map
1:1 to the commands in the table.) The user can also just run the command directly:

```bash
node scripts/export-deck.mjs --format <fmt>
```

| Command | Output | Editable? | Notes |
|---------|--------|-----------|-------|
| `export-deck.mjs --format html` | `export/deck.html` | n/a | One self-contained file (fonts/CSS/JS inlined). Opens offline; nav works. |
| `export-deck.mjs --format pdf` | `export/deck.pdf` | no | One page per slide, 1280×720. |
| `export-deck.mjs --format pptx-image` | `export/deck.pptx` | **no** | Each slide a full-bleed screenshot. **Pixel-perfect.** |
| **`export-pptx-jsx.mjs`** | `export/deck.pptx` | **yes** | **Measured** → native PowerPoint textboxes + shapes (+ native charts). **~98% verified.** |

Needs the deck's devDeps (`npm install` first): playwright, pdf-lib, pptxgenjs,
`@artifact-kit/pptxgenjs-jsx`, pixelmatch, pngjs — then `npx playwright install
chromium` once. Rendering is Playwright Chromium (shared via `scripts/lib/deck-driver.mjs`).

### Editable PPTX — the high-fidelity path

The editable export is **measured, not estimated**: it renders the slide, reads each
element's laid-out geometry via the `@artifact-kit/pptxgenjs-jsx` measure-contract, and
emits native OOXML — so nested flex/grid, %/absolute positioning and text wrapping come
through correctly. Verify any export by rendering it back through **LibreOffice** and
reading the **pixel-diff heatmap** (`verify-pptx.mjs`). **Full guide, authoring
conventions, fonts, and the hard-won gotchas: [pptx-editable.md](pptx-editable.md).**

Still lost / approximated: animations (captured at settled state), gradients/shadows
(flattened), per-corner radius. If you need a perfect-looking PowerPoint and don't need
to edit it, use `pptx-image`. Pick per audience.

## Edit mode is stripped on every export — by design

An export is a **publish artifact**; the authoring overlay never ships in it. Two
guarantees:

1. **Build-time:** the standalone build runs with `VITE_EDIT=off`, so the edit-mode
   init in `App.jsx` is dead-code-eliminated; a vite plugin also removes the
   edit-mode `<link>` and deletes `public/edit-mode/` from the output.
2. **Capture-time:** before any screenshot/DOM-walk, `export-deck.mjs` removes every
   `.em-*` node and the nav — so even a stray dev build can't leak the tool into a
   PDF/PPTX.

Verify on `export/deck.html`: `grep -c EditMode export/deck.html` → 0.

## Tailwind Preflight clamps every image

Preflight (Tailwind's reset) applies `img { max-width: 100%; height: auto }` to **every**
image on the page. Any component that sets an intrinsic pixel size on an `<img>` must
override both caps or the browser silently ignores the size you set:

```js
width: nat.w, height: nat.h,
maxWidth: 'none', maxHeight: 'none',   // ← without these, Preflight wins
```

The failure is easy to misread. An image wider than the viewport is clamped to the
viewport width **while keeping its full height**, so it renders squashed, and it happens
*before* any CSS transform — which makes it look like a zoom bug rather than a sizing
bug. `Diagram.jsx` carries the override with a comment; keep it there.

To check it, compare the layout box against the intrinsic size — not
`getBoundingClientRect()`, which measures after the transform and reports a healthy
number for a clamped image:

```js
im.offsetWidth === im.naturalWidth && im.offsetHeight === im.naturalHeight
```

## Slash-opacity silently drops token colors

Every theme color in `tailwind.config.js` maps to a bare `var(--*)`. Tailwind's
slash-opacity modifier (`bg-ink-900/85`) has to rewrite a color into
`rgb(<channels> / <alpha>)`, and it **cannot parse channels out of a `var()`** — so the
class matches nothing and **no CSS rule is emitted at all**. The element renders with
no background. Measured in a build:

```
bg-ink-900/85   ->  NO RULE EMITTED          ← token color: silently dropped
bg-ink-900      ->  background-color:var(--ink-900)
bg-white/20     ->  background-color:#fff3   ← literal color: works
```

This shipped as a real bug: the present-mode toolbar used `bg-ink-900/85`, rendered
fully transparent, and showed as white icons on a white slide.

It is easy to miss because **nothing fails** — no build error, no lint warning,
`check-slop` is clean. The class just evaporates.

**The rule:** slash-opacity works on Tailwind's own literal palette (`white`, `black`,
`slate-500`) and never on this deck's theme tokens. For a translucent token color, use
`color-mix` in an inline style:

```jsx
style={{ background: 'color-mix(in srgb, var(--ink-900) 88%, transparent)' }}
```

To audit a deck:

```bash
grep -rnoE "\b(bg|text|border)-(ink|primary|surface|accent)-[a-z0-9]+/[0-9]+" src/
```

Every hit is a dropped rule — except one inside a comment. `PresentBar.jsx` names the
bad class in the comment explaining why it is gone, so it matches; check the line
before treating a hit as a bug.

## Relationship to slides-generator

This deck is **self-contained** — use it directly. It mirrors the slides-generator
template's conventions, so if you prefer that skill's full requirements/research
workflow, you can author slides there using this skill's theme
([tailwind-theme.md](tailwind-theme.md)) and component idioms instead. Either way,
the design tokens, wow-guide, and `check-slop.mjs` apply.
