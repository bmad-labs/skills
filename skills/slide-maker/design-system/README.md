# MTI Technology — Slide Design System

The MTI brand kit for **1280×720 presentation slides**: design tokens, brand logos,
and a **catalog of 446 premade slide layouts** indexed for fast lookup. This kit ships
inside the `mti-slide-maker` skill
(`.agents/skills/mti-slide-maker/design-system/`) so the skill is standalone — load it
alongside the deck generator to build on-brand MTI decks.

Brand source of truth: claude.ai/design project `a07c608f-9a42-4485-9763-08f546088b93`
(see `SOURCE.json`). Tokens + logos were pulled from there; the layout catalog was built
on top of them.

---

## What's here

```
design-system/
├── styles.css              ← the ONE stylesheet entry point — link this
├── tokens/
│   ├── fonts.css           Noto Sans JP (Google Fonts @import)
│   ├── colors.css          brand + green/yellow/ink scales + semantic aliases
│   ├── typography.css      families, weights, slide type scale, line heights
│   └── spacing.css         spacing scale, slide frame, radius, shadows
├── layouts.csv             ← THE INDEX — one row per layout (the lookup table)
├── transitions.csv         ← the present-mode transition catalog (mirrors deck-template/src/components/transitions.js)
├── slides/                 446 layout templates, each an .html + a .png thumbnail
│   ├── 01-cover.html  +  01-cover.png
│   ├── 02-section-divider.html  +  .png
│   └── … (NNN-<structure>-<style>.html / .png, 3-digit ids)
├── assets/
│   ├── logos/              mti-logo-full.svg, mti-mark.svg
│   └── deck-media/         photo placeholders (see that folder's README)
├── _matrix.mjs             generic-catalog enumerator (ids 018–250)
├── _matrix-tech.mjs        technical-catalog enumerator (ids 251–389, 470–487)
├── _matrix-extra.mjs       storytelling + tech-sharing enumerator (ids 390–469)
└── wave-log.md             the build ledger (how the catalog was generated, resumable)
```

---

## The layout catalog (446 layouts)

Every premade layout is a **standalone 1280×720 HTML file** in `slides/`, with a
**rendered PNG thumbnail beside it** (`NN-name.png`). The whole set is indexed by
**[`layouts.csv`](./layouts.csv)** — the single lookup table you grep to find a layout.

### Structure × Style

The catalog is a **STRUCTURE × STYLE matrix**: ~75 layout *structures* (cover, three-column,
KPI hero, bar chart, timeline, comparison table, system-context diagram, code snippet,
robot state machine, trade-off matrix, …) each rendered in the sensible subset of **6
visual styles**:

| Style | What it does |
| --- | --- |
| `minimal` | max white, hairlines, no shadow, one green rule as the only accent |
| `bold-green` | a hero/panel in full `--mti-green`, white text-on-accent, type up a step |
| `dark-rail` | one panel in `--ink-900` carries the weight (problem panel, code editor, "under the hood") |
| `editorial` | asymmetric magazine grid — oversized faded element, off-axis title, never centered |
| `data-dense` | tighter rhythm, more facts, quiet table chrome |
| `card-elevated` | `--surface-card` cards with `--shadow-md` (one hero gets `--shadow-accent`) |

### Families (14)

| Family | ~count | What it covers |
| --- | --- | --- |
| `metrics-data` | 46 | KPI rows/heroes, bar/line/donut charts, stat callouts, trend heroes |
| `narrative` | 45 | problem→solution, before/after, two-panel, pull-quote, manifesto, arc |
| `storytelling` | 44 | hooks, anecdotes, tension→turn, journey maps, three-act, vision |
| `multi-item` | 43 | columns, feature lists, icon grids, checklists, pillars |
| `tech-architecture` | 39 | architecture diagrams, tech-stack layers, system-context (C4), data flow, sequence diagrams |
| `tech-sharing` | 36 | tech-talk titles, lessons learned, deep-dives, gotchas, tips, Q&A, demo recaps, takeaways |
| `process-structure` | 34 | timelines, process flows, roadmaps, org charts, 2×2 matrices, pyramids, cycles |
| `title-section` | 33 | covers, section dividers, agendas, statements |
| `tech-robotics` | 33 | robot state machines, sensor suites, control loops, hardware specs, ROS node graphs, robot anatomy, autonomy stacks |
| `tech-data` | 31 | dashboards, comparison matrices, gauge clusters, log timelines, trade-off matrices |
| `showcase-demo` | 28 | product screenshots, UI mockups, demo flows, feature spotlights, before/after, live metrics |
| `comparison-table` | 6 | comparison tables, pricing tiers |
| `people-closing` | 2 | persona / closing |

Plus a **trade-off analysis** set (tradeoff-matrix, pros/cons, quadrant, spectrum,
decision-rationale) for engineering-decision slides.

### How to pick a layout (the lookup flow)

`layouts.csv` columns: `id, file, preview, name, style, family, intent, use_when,
content_shape, focal_element, density, brand_weight, tags`.

1. **Match by intent.** Grep `intent` / `use_when` / `tags` for the situation — e.g.
   "a sequence of phases" → `tell-a-sequence` → `12-timeline`; "compare tiers" →
   `14-comparison-table`; "show the system's neighbours" → `system-context`.
2. **Narrow by `style`** to fit the deck's tone (minimal / bold-green / dark-rail /
   editorial / data-dense / card-elevated).
3. **Confirm by EYE — `Read` the `preview` PNG.** The `preview` column points at the
   layout's thumbnail (`slides/NN.png`); reading it *sees* the candidate without
   rendering, and catches a mismatch the tags alone miss. Shortlist 2–3, look, pick.

> Regenerate or extend the catalog with the `_matrix*.mjs` enumerators + the wave
> pipeline in [`wave-log.md`](./wave-log.md). Each enumerator prints its manifest with
> `node _matrix.mjs --csv`.

---

## ⚠ The catalog is a REFERENCE, reproduced in JSX — not a drop-in

The catalog files are **standalone HTML styled with `var(--*)` tokens**. A *generated
deck* is built from the **`deck-template`**, where each slide is a **React/JSX component
styled with the MTI Tailwind tokens** and tagged with `data-viz-id` (which powers edit
mode + editable export). So the two formats differ on purpose:

| | Catalog layout (`slides/NN.html`) | Deck slide (`deck-template/src/slides/NN.jsx`) |
| --- | --- | --- |
| Format | standalone HTML | React/JSX component |
| Styling | `var(--*)` tokens, inline `<style>` | MTI **Tailwind** classes (`text-primary-500`, `text-h1`, `bg-bg-card`) |
| Root | `<div class="slide">` | `<div className="slide-page" data-viz-id="sN">` |
| Tags | none | **`data-viz-id` on every meaningful node** |
| Registered | no | yes, in `src/App.jsx` |

**Today's flow** (per `references/house-style.md` and `slide-generate.md`): open the
chosen layout's HTML to study its exact structure, look at its PNG, then **reproduce it
in JSX** with the Tailwind tokens — adding `data-viz-id` to every node. The HTML is the
*spec*; the JSX is the *deliverable*. The catalog is optimised for fast eyeballing
(thumbnail) and structural reference (HTML), not copy-paste.

> **Planned:** convert the catalog into deck-ready JSX (Tailwind tokens + `data-viz-id`
> + `slide-page` root) so layouts drop into a deck with minimal conversion. Until that
> lands, reproduce-in-JSX is the path. **The full conversion handoff — mappings,
> conventions, pilot plan, gates, open decisions — is in
> [`CONVERT-TO-JSX.md`](./CONVERT-TO-JSX.md).**

---

## How to consume the tokens

**Link `styles.css` only** — it `@import`s the four token files in the right order
(fonts → colors → typography → spacing). Everything is a CSS custom property; **style
with `var(--*)`, never hardcoded hex / px.** (In a Tailwind deck, the same values are
exposed as token classes — see `references/tailwind-theme.md`.)

```html
<link rel="stylesheet" href="path/to/design-system/styles.css">
```

Token families (real names — use these):

| Family | Examples | Use for |
| --- | --- | --- |
| Brand | `--mti-green` `#00A73B`, `--mti-yellow` `#FABE00`, `--ink-900` `#221815` | primary brand color, accents |
| Semantic color | `--text-primary`, `--text-secondary`, `--surface-page`, `--surface-card`, `--surface-ink`, `--border-subtle` | prefer these over raw scales |
| Scales | `--green-50..800`, `--yellow-100..700`, `--ink-50..900` | tints / shades when a semantic alias isn't enough |
| Status | `--status-positive`, `--status-info`, `--status-warning`, `--status-danger` | data / state (sparingly) |
| Type | `--font-sans`, `--fw-light..black`, `--fs-display..footnote`, `--lh-tight..relaxed`, `--ls-eyebrow` | all text |
| Spacing | `--space-1..20` (4px base), `--slide-margin` (72px), `--slide-gutter` (32px) | layout |
| Frame | `--slide-w` 1280px, `--slide-h` 720px | slide canvas |
| Radius/shadow | `--radius-sm..pill`, `--shadow-sm/md/lg/accent`, `--rule-accent-w` (4px green title rule) | surfaces |

The brand face is **Noto Sans JP** (served from Google Fonts via `tokens/fonts.css`).

---

## House style (non-negotiable)

- White slides, **green-forward** accents; the green/dark slides (dividers, bold-green,
  dark-rail) carry the brand weight.
- Rhythm: uppercase **eyebrow** (green) → **title** → a short **green accent rule**
  (`--rule-accent-w`) → body. One hero per slide, with a dramatic size jump.
- **Yellow = a SINGLE small isolated dot only** — never a rule/bar/fill/panel, never
  trailing eyebrow text, never a dot at bottom-left over the footer logo (place it
  top-right). On green/dark panels use **WHITE** for accents.
- Logo: `mti-logo-full.svg`, ~20px in the footer; on green/ink add
  `filter: brightness(0) invert(1)` to render it white.
- Charts: bar = one green highlight bar + grey-muted rest; line = green + a `green-50`
  area fill; donut = MTI_SERIES (green → blue → yellow-minor → grey); gauges/coverage =
  green arc over a grey track. No rainbow, no red/yellow for ordinary data.
- Code: a dark editor panel, monospace code, **brand-palette syntax** (green keywords,
  grey comments, ink panel, green key-line border) — not a rainbow editor theme.

Full craft references live one level up in `references/`:
[`wow-guide.md`](../references/wow-guide.md) (hero/size-jump/chart rules),
[`visual-review.md`](../references/visual-review.md) (the review rubric),
[`tailwind-theme.md`](../references/tailwind-theme.md) (the Tailwind token map + chart palette).

---

## Quality gate

`<skill>/deck-template/scripts/check-slop.mjs` is the **source gate** — run it on any
layout/slide before trusting it. It flags raw hex (outside `<svg>`), off-brand fonts,
generic Tailwind colours, dark glassmorphism, and layout-breakers. The catalog passes it
with **0 errors** across all 446 files; reproduce that bar on anything new.

---

## Notes

- `assets/deck-media/` stock photos are **not** vendored (deck content, not brand kit).
  See `assets/deck-media/README.md`. Catalog layouts that show a photo use a styled
  placeholder (a `green-50` block + a line-SVG glyph + an "Image" caption).
- The upstream design project also ships an interactive deck-stage runtime (keyboard
  nav, auto-scaling, PPTX export). That's the claude.ai/design **authoring runtime** —
  not needed to consume the brand kit, so it's left out. The `deck-template` provides
  the local equivalent for generated decks.
