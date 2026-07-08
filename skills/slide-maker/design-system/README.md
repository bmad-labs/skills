# Slide Design System

A token-driven, design-system-agnostic kit for **1280×720 presentation slides**: design
tokens, placeholder logos, and a **catalog of 34 premade slide layouts**. It ships inside
the `slide-maker` skill (`design-system/`) so the skill is standalone — load it alongside
the deck generator to build on-theme decks.

**Nothing here is hardcoded to a brand.** Every color/type/spacing value is a CSS custom
property. The bundled `clean-light` theme is a neutral default; swap the theme file (or
map a design system's tokens into it) and every layout re-skins with no layout change.

---

## What's here

```
design-system/
├── styles.css              ← the ONE stylesheet entry point — link this
├── tokens/
│   ├── fonts.css           system font stack by default (no network fetch)
│   ├── colors.css          accent + neutral ink scale + semantic aliases (the contract)
│   ├── typography.css      families, weights, slide type scale, line heights
│   └── spacing.css         spacing scale, slide frame, radius, shadows
├── themes/
│   └── clean-light.css     ← the active theme (bundled neutral default; the guaranteed floor)
├── transitions.csv         ← the present-mode transition catalog (mirrors deck-template/src/components/transitions.js)
├── slides/                 34 layout templates, each an .html + a .png thumbnail
│   ├── 01-cover.html  +  01-cover.png
│   ├── 02-section-divider.html  +  .png
│   └── … (NN-<structure>.html / .png, 34 in total)
└── assets/
    ├── logos/              mark.svg, logo-full.svg (neutral placeholders — swap for real logos)
    └── deck-media/         photo placeholders (see that folder's README)
```

---

## The layout catalog (34 layouts)

Every premade layout is a **standalone 1280×720 HTML file** in `slides/`, with a
**rendered PNG thumbnail beside it** (`NN-name.png`). The full list, with what each is for,
is in [`../references/house-style.md`](../references/house-style.md).

The 34 cover the common slide jobs:

- **Title / section:** cover, section-divider, agenda, agenda-rail, statement.
- **Multi-item:** three-column, four-column, feature-list, icon-grid, checklist, pillars,
  numbered-list.
- **Metrics / data:** metrics, hero-metrics, single-kpi-hero, kpi-row, stat-callout,
  bar-chart, line-chart, donut-chart.
- **Comparison:** comparison, comparison-table, two-panel-compare, problem-solution,
  before-after, matrix-2x2.
- **Narrative:** quote, pull-quote, content-image.
- **Process / time:** timeline, process-flow, roadmap-phases.
- **People / closing:** persona, closing.

### How to pick a layout (the lookup flow)

1. **Match by intent.** Read the layout table in
   [`house-style.md`](../references/house-style.md) and match the slide's situation
   (content shape + intent) — e.g. "a sequence of phases" → `12-timeline`; "compare tiers"
   → `14-comparison-table`; "one stat that matters" → `20-single-kpi-hero`.
2. **Confirm by EYE — `Read` the thumbnail.** Open `slides/NN-name.png` for the 2–3 best
   candidates; the thumbnail *shows* the candidate without rendering, and catches a
   mismatch (wrong density, wrong weight) the name alone misses. Shortlist, look, pick.
3. **Use directly or adapt.** If a layout fits, reproduce it. If the slide is a blend, take
   the closest layouts as *reference* and compose a custom layout from their parts.

---

## ⚠ The catalog is a REFERENCE, reproduced in JSX — not a drop-in

The catalog files are **standalone HTML styled with `var(--*)` tokens**. A *generated
deck* is built from the **`deck-template`**, where each slide is a **React/JSX component
styled with the Tailwind tokens** and tagged with `data-viz-id` (which powers edit mode +
editable export). So the two formats differ on purpose:

| | Catalog layout (`slides/NN.html`) | Deck slide (`deck-template/src/slides/NN.jsx`) |
| --- | --- | --- |
| Format | standalone HTML | React/JSX component |
| Styling | `var(--*)` tokens, inline `<style>` | **Tailwind** token classes (`text-primary-500`, `text-h1`, `bg-bg-card`) |
| Root | `<div class="slide">` | `<div className="slide-page" data-viz-id="sN">` |
| Tags | none | **`data-viz-id` on every meaningful node** |
| Registered | no | yes, in `src/App.jsx` |

**The flow** (per [`house-style.md`](../references/house-style.md) and
`workflows/slide-generate.md`): open the chosen layout's HTML to study its exact structure,
look at its PNG, then **reproduce it in JSX** with the Tailwind tokens — adding
`data-viz-id` to every node. The HTML is the *spec*; the JSX is the *deliverable*. The
catalog is optimised for fast eyeballing (thumbnail) and structural reference (HTML), not
copy-paste.

> To render the 34 layout previews for review, use
> `deck-template/scripts/shoot-layouts.mjs`.

---

## How to consume the tokens

**Link `styles.css` only** — it `@import`s the token files then the active theme in the
right order (fonts → colors → typography → spacing → theme). Everything is a CSS custom
property; **style with `var(--*)`, never hardcoded hex / px.** (In a Tailwind deck, the
same values are exposed as token classes — see
[`../references/tailwind-theme.md`](../references/tailwind-theme.md).)

```html
<link rel="stylesheet" href="path/to/design-system/styles.css">
```

Token families (real names — use these):

| Family | Examples | Use for |
| --- | --- | --- |
| Accent | `--accent-500` `#4F46E5` (indigo), `--accent-600`, `--accent-050` | the single restrained accent hue |
| Semantic color | `--text-primary`, `--text-secondary`, `--surface-page`, `--surface-card`, `--surface-ink`, `--border-subtle` | prefer these over raw scales |
| Ink scale | `--ink-50..900` (slate) | text, dark surfaces, muted chrome |
| Status | `--status-positive`, `--status-info`, `--status-warning`, `--status-danger` | data / state (sparingly) |
| Type | `--font-sans`, `--fw-light..black`, `--fs-display..footnote`, `--lh-tight..relaxed`, `--ls-eyebrow` | all text |
| Spacing | `--space-1..20` (4px base), `--slide-margin` (72px), `--slide-gutter` (32px) | layout |
| Frame | `--slide-w` 1280px, `--slide-h` 720px | slide canvas |
| Radius/shadow | `--radius-sm..pill`, `--shadow-sm/md/lg/accent`, `--rule-accent-w` (accent title rule) | surfaces |

The default face is a **system font stack** (served with no network fetch via
`tokens/fonts.css`). A design system can override `--font-*` in its own theme file; the
editable-PPTX exporter embeds **Inter** (SIL OFL) for consistent rendering.

## House style (non-negotiable)

- Light slides, a single **accent** hue used sparingly; the accent/dark slides (dividers,
  rails, persona) carry the visual weight.
- Rhythm: uppercase **eyebrow** (accent) → **title** → a short **accent rule**
  (the `.accent-rule` class, `--rule-accent-w`) → body. One hero per slide, with a dramatic
  size jump.
- Accents are the highlight, never a wash — no large accent fills across a content slide.
  On accent/dark panels use **WHITE** for accents.
- Logo: `logo-full.svg`, ~20px in the footer; on accent/ink backgrounds add
  `filter: brightness(0) invert(1)` to render it white.
- Charts: bar = one accent highlight bar + muted rest; line = accent line + a soft area
  fill; donut = the `SERIES` palette in order (accent → sky → slate). No rainbow, no
  red/amber for ordinary data.
- Code: a dark editor panel, monospace code, **theme-palette syntax** (accent keywords,
  muted comments, ink panel) — not a rainbow editor theme.

Full craft references live one level up in `references/`:
[`wow-guide.md`](../references/wow-guide.md) (hero/size-jump/chart rules),
[`visual-review.md`](../references/visual-review.md) (the review rubric),
[`tailwind-theme.md`](../references/tailwind-theme.md) (the Tailwind token map + chart palette).

---

## Quality gate

`<skill>/deck-template/scripts/check-slop.mjs` is the **source gate** — run it on any
layout/slide before trusting it. It flags raw hex (outside `<svg>`), off-theme fonts,
generic Tailwind colours, dark glassmorphism, and layout-breakers. The 34 catalog layouts
pass it with **0 errors**; reproduce that bar on anything new.

---

## Notes

- `assets/deck-media/` stock photos are **not** vendored (deck content, not design kit).
  See `assets/deck-media/README.md`. Catalog layouts that show a photo use a styled
  placeholder (a soft accent block + a line-SVG glyph + an "Image" caption).
- The `deck-template` provides the local runtime for generated decks (keyboard nav,
  auto-scaling, HTML/PDF/PPTX export). Consuming the design kit itself needs only
  `styles.css` + the tokens.
