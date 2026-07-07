---
name: mti-slide-maker
description: Make on-brand MTI Technology presentation slides and decks end-to-end. Use this skill whenever the user wants to brainstorm, build, design, generate, review, or export an MTI slide, deck, presentation, pitch, or company/product/sales deck — even if they don't say "MTI" but the work is for MTI Technology. It runs as job-specific WORKFLOWS: brainstorm a deck's structure, generate the HTML deck with a review loop, and export to editable PPTX, image PPTX, standalone HTML, or PDF. It ships the MTI brand kit (tokens, fonts, logos, 11 premade layouts), a "wow" craft guide, an anti-slop validator, a ready-made React deck template, point-and-comment edit mode, and a validated editable-PPTX pipeline. Also use it to supply just the MTI brand layer to another slide generator so its output uses MTI's real colors, type, and components instead of a generic theme.
---

# MTI Slide Maker

Make MTI Technology slides that look genuinely impressive and stay on-brand — from a
single slide to a full deck, with a review loop and HTML/PDF/PPTX export. The skill
ships everything: the brand kit, a craft guide, a slop validator, a ready-made React
deck, edit-mode collaboration, and the exporters.

**It works as job-specific workflows.** Figure out which job the user is on (below),
then open that workflow file and follow it. The natural order is
brainstorm → generate → export, but the user can jump straight to any step (e.g. "export
this deck to PDF" on a deck that already exists).

## Pick the workflow

| The user wants to… | Workflow |
|---|---|
| figure out what the deck should say / its structure (vague idea, "I need a deck for X") | [slide-brainstorm](references/workflows/slide-brainstorm.md) |
| build the actual slides and iterate on them (generate, review, revise) | [slide-generate](references/workflows/slide-generate.md) |
| get an **editable** PowerPoint (recipient edits text/shapes) | [export-editable-pptx](references/workflows/export-editable-pptx.md) |
| get a **pixel-perfect, view-only** PowerPoint | [export-image-pptx](references/workflows/export-image-pptx.md) |
| get a single self-contained **HTML** file (opens offline) | [export-standalone-html](references/workflows/export-standalone-html.md) |
| get a **PDF** (print/handout) | [export-pdf](references/workflows/export-pdf.md) |

```
brainstorm ──▶ generate ──▶ ┬─▶ editable PPTX
(idea→skeleton) (HTML deck,  ├─▶ image PPTX
                review loop) ├─▶ standalone HTML
                             └─▶ PDF
```
Each workflow ends by pointing to the next. If a request is ambiguous about which job,
ask one quick question rather than guessing — brainstorming a deck and exporting one are
very different work. If the user's idea is still vague and they ask to "make slides,"
start at **brainstorm** (don't generate from an unexamined idea).

## The other use: supply only the brand layer

This skill can also feed just the **MTI brand** to a *different* slide generator (e.g.
`slides-generator`). That generator runs its own workflow but **skips theme/style
selection** (the MTI theme is fixed — don't ask for a vibe or offer palettes) and pulls
tokens, components, and patterns from here:
- **React + Tailwind** → drop the theme block from
  [tailwind-theme.md](references/tailwind-theme.md) into `tailwind.config.js`; import
  Noto Sans JP. Then `bg-primary-500`, `text-text-primary`, `font-display` resolve to MTI.
- **Plain HTML/CSS** → link `<skill>/design-system/styles.css`; style with
  `var(--mti-green)`, `var(--fs-h1)`, `var(--space-8)`, …

## Brand kit (the source of truth — read these, don't guess)

Ships **inside this skill**, so it's standalone:
```
<skill>/design-system/
├── styles.css          ← token entry point (link for HTML slides)
├── tokens/             ← colors, typography, spacing, fonts — THE source of truth
├── slides/*.html       ← 11 premade slide layouts (the catalog)
└── assets/logos/       ← mti-logo-full.svg, mti-mark.svg
```
> If anything disagrees with `<skill>/design-system/tokens/`, **the token files win** —
> open and read them.

## Hard brand rules (apply in every workflow, regardless of who's driving)

- **Palette:** MTI green/yellow/ink only. Green = brand accent. Yellow = the small
  dot-trail motif **only** (never large fills or text). Ink = text + dark surfaces.
- **Font:** Noto Sans JP for everything (display and body).
- **Light, green-forward** by default; the full-bleed green slides (divider, agenda rail,
  closing) and the dark persona rail carry the brand weight — not every slide is green.
- **Never invent a colour or a second font.** Unsure of a value → read
  `<skill>/design-system/tokens/`.
- **Make it wow, not just compliant.** On-brand ≠ impressive. MTI wow = restraint + ONE
  focal point + depth in a LIGHT idiom (never dark-glass / neon-glow). Every slide:
  one hero dominates, eyebrow→title→green-rule→body rhythm, ≥35% whitespace, calm motion.
  The craft guide is the ceiling: [wow-guide.md](references/wow-guide.md). The
  `check-slop.mjs` validator is the floor.
- **A green automated gate is necessary, never sufficient — always LOOK.** Every checker
  here (slop, the PPTX validation gate) is mechanical: it verifies what it was told to
  verify and is blind to the rest. A slide can pass every check and still look wrong — a
  hero gone tiny, a clipped chip, lost rounding, a flattened accent. So both authoring
  workflows end with the agent **eye-checking the rendered slides** (in [slide-generate](references/workflows/slide-generate.md)
  and [export-editable-pptx](references/workflows/export-editable-pptx.md)) and fixing what
  the eye catches. Delegate the looking to **batched subagents** (a few slides each, in
  parallel) so heavy images stay out of the main context. The gate passing is exactly when
  subtle visual drift hides — that's when looking matters most.
- **Looking is necessary, but for POSITION it is also not sufficient — MEASURE.**
  Alignment, overlap, edge-clipping, and "does it fit the frame" are *numeric* facts, and
  a full-slide PNG shown small hides a 10–30px miss completely. If a request says
  **align / same height / equal / overlap / fit / edge / below / above / touching /
  clipped / margin**, it is a geometry-gate task: run `inspect.mjs`, read
  `geometry.json` (true 1280×720 pixels), and **assert the inequality** — content bottom
  `y+h ≤ 648`, alignment `|A.bottom − B.bottom| ≤ 2`. Report the measured number, never a
  vibe. If the numbers and your eyes disagree, the numbers win. Full method + the canonical
  bounds + layout recipes (no magic-pixel heights; `items-stretch` for equal columns;
  footer in flow with `mt-auto`, never `absolute` vs `flex:1`):
  [visual-review.md → The geometry gate](references/visual-review.md#the-geometry-gate-measure-dont-eyeball).
- **"Done" = the user's request restated as a passing test, shown with numbers.** Not "I'm
  fairly sure" / "looks right now." Write the acceptance criterion in the user's words
  before fixing ("align arena with last step" → `arena.bottom == step.bottom ±2px AND
  footer.bottom ≤ 648`), and only claim done when it provably passes. If two requirements
  conflict (align A to B *and* keep the footer in-frame ⇒ content too tall), say so and
  propose the trade — don't ship an overlap and call it done.

## Reference library (workflows link the ones they need)

| File | What it covers |
|------|----------------|
| [house-style.md](references/house-style.md) | The 11 premade layouts, when to use each, brand rules, patterns, logo usage |
| [wow-guide.md](references/wow-guide.md) | Presentation craft: hierarchy, MTI data-viz, depth, motion, density, typography + snippets |
| [tailwind-theme.md](references/tailwind-theme.md) | Drop-in `tailwind.config.js` theme block + the `MTI_SERIES` chart palette |
| [validation.md](references/validation.md) | `check-slop.mjs`: what each check means + the AI-slop tells to self-catch |
| [visual-review.md](references/visual-review.md) | Render slides to PNGs and self-review the pixels (the gate the linter can't be) |
| [deck-template.md](references/deck-template.md) | The ready-made React deck shell: structure, dev, edit mode, HTML/PDF/image export |
| [edit-mode.md](references/edit-mode.md) | The point-and-comment feedback overlay + programmatic inspect API |
| [pptx-editable.md](references/pptx-editable.md) | Editable-PPTX deep dive: measure→OOXML, the validation gate + acknowledgement system, fonts, gotchas |
