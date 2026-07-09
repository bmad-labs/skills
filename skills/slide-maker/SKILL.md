---
name: slide-maker
description: >-
  Make impressive, on-brand presentation slides and decks end-to-end, for ANY design system. Use
  this skill whenever the user wants to brainstorm, build, design, generate, review, or export a
  slide, deck, presentation, pitch, or company/product/sales deck. It runs as job-specific
  WORKFLOWS: brainstorm a deck's structure, generate the HTML deck with a review loop, and export
  to editable PPTX, image PPTX, standalone HTML, or PDF. It is design-system-agnostic — it uses
  the user's own design system if they have one, a `nextlevelbuilder/ui-ux-pro-max-skill`
  suggestion if that's installed, or a bundled neutral default theme — and drives everything from
  design tokens (never hardcoded colors or fonts). It ships a token-driven brand kit (tokens,
  fonts, logos, 34 premade layouts), a "wow" craft guide, an anti-slop validator, a ready-made
  React deck template, point-and-comment edit mode, and a validated editable-PPTX pipeline. It can
  also supply just the design layer (tokens, components, patterns) to another slide generator so
  its output uses a real design system instead of a generic theme.
---

# Slide Maker

Make presentation slides that look genuinely impressive and stay on-brand — from a
single slide to a full deck, with a review loop and HTML/PDF/PPTX export. The skill
ships everything: a token-driven design kit, a craft guide, a slop validator, a
ready-made React deck, edit-mode collaboration, and the exporters. It works with
**whatever design system the deck needs** — yours, a suggested one, or a neutral default.

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

## Resolve the design system (run at the START of brainstorm/generate)

The layouts are token-driven: color, type, and spacing come from a **theme file**, never
from hardcoded values in the slides. Before you build anything, resolve which design
system supplies those tokens. Run this flow **in order** and stop at the first branch
that applies:

1. **Ask the user if they have their own design system / brand tokens.** If yes → map its
   colors/type/spacing into the token contract by writing them into
   `design-system/themes/clean-light.css` (or a new theme file that the entry point
   imports). Layouts never change; only the theme file's token *values* do.
2. **Else, check if `nextlevelbuilder/ui-ux-pro-max-skill` is installed.** If yes → invoke
   it to suggest the best-fit design system for the deck's content/idea, then map that
   suggestion into the theme file.
3. **Else, recommend it and guide a permanent install** from
   `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` — **this is the preferred
   path.**
4. **Else (user won't install permanently): ASK FIRST, then** do a shallow
   `git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` into `/tmp`, use it
   for **THIS TURN ONLY**, and do **not** persist it into the skill or the user's project.
   **Never run this network fetch without explicit consent** — always ask before cloning.
5. **Else (user declines the fetch too): use the bundled `clean-light` theme.**

`clean-light` is the **guaranteed floor** — the flow always ends in a working theme, so
the skill never blocks. Whatever the outcome, the active theme file is the single source
of truth for color/type: read it, and write token values into it rather than hardcoding
into layouts.

## Choose where to write the deck (start of generate)

Before scaffolding, **ask the user where the deck should live**. Propose a default and
let them override:

- **Default output dir:** `./slides/<deck-name>/` in the user's current project.
- **Exports:** `./slides/<deck-name>/export/`.
- **Copy the `deck-template/` scaffold to that location — NOT into the skill directory.**
  This keeps the skill install clean and lets multiple decks coexist side by side. The
  skill's own `deck-template/` is a pristine template; the working copy lives in the
  user's project.

## The other use: supply only the design layer

This skill can also feed just the **design layer** (tokens, components, patterns) to a
*different* slide generator (e.g. `slides-generator`). That generator runs its own
workflow but pulls its theme from here instead of picking a generic vibe:
- **React + Tailwind** → drop the theme block from
  [tailwind-theme.md](references/tailwind-theme.md) into `tailwind.config.js` and import
  the active font. Then the Tailwind utilities resolve to the active design system's tokens.
- **Plain HTML/CSS** → link `<skill>/design-system/styles.css`; style with the CSS custom
  properties it exposes (e.g. `var(--fs-h1)`, `var(--space-8)`, the theme's color tokens),
  never with literal hex values.

## Design kit (the source of truth — read these, don't guess)

Ships **inside this skill**, so it's standalone:
```
<skill>/design-system/
├── styles.css                ← token entry point (imports tokens + the active theme; link for HTML slides)
├── tokens/                   ← colors, typography, spacing, fonts — THE source of truth
├── themes/clean-light.css    ← the active theme (bundled neutral default; the guaranteed floor)
├── slides/*.html             ← 34 premade slide layouts (the catalog)
└── assets/logos/             ← mark.svg, logo-full.svg (neutral placeholders; swap for the deck's real logos)
```
> The **active theme file wins** for color/type. If a layout appears to disagree with the
> tokens, the tokens/theme win — open and read them. Never hardcode a hex or a font into a
> layout; change the theme file instead.

## Craft rules (apply in every workflow, regardless of who's driving)

- **The active design system is the source of truth for color and type.** Layouts are
  **token-driven — never hardcode a hex or a font.** Change the theme file's token values,
  not the layouts. If unsure of a value, read `<skill>/design-system/tokens/` and the
  active theme.
- **Default font is a system stack.** The PPTX exporter embeds **Inter** (SIL OFL) so the
  editable output renders consistently on machines that lack the deck's fonts.
- **One focal point, real whitespace.** Every slide: one hero dominates, a clear
  eyebrow→title→rule→body rhythm, ≥35% whitespace, calm motion. Depth and restraint over
  decoration. Not every slide needs a heavy full-bleed treatment — reserve those for
  dividers, section rails, and the close, so they carry weight by contrast.
- **Make it wow, not just compliant.** On-brand ≠ impressive. Wow = restraint + ONE focal
  point + depth. The craft guide is the ceiling: [wow-guide.md](references/wow-guide.md).
  The `check-slop.mjs` validator is the floor.
- **An automated gate is necessary, never sufficient — always LOOK.** Every checker here
  (slop, the PPTX validation gate) is mechanical: it verifies what it was told to verify
  and is blind to the rest. A slide can pass every check and still look wrong — a hero gone
  tiny, a clipped chip, lost rounding, a flattened accent. So both authoring workflows end
  with the agent **eye-checking the rendered slides** (in [slide-generate](references/workflows/slide-generate.md)
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
| [house-style.md](references/house-style.md) | The 34 premade layouts, when to use each, token-driven styling, patterns, logo usage |
| [wow-guide.md](references/wow-guide.md) | Presentation craft: hierarchy, data-viz, depth, motion, density, typography + snippets |
| [tailwind-theme.md](references/tailwind-theme.md) | Drop-in `tailwind.config.js` theme block + the chart-series palette |
| [validation.md](references/validation.md) | `check-slop.mjs`: what each check means + the AI-slop tells to self-catch |
| [visual-review.md](references/visual-review.md) | Render slides to PNGs and self-review the pixels (the gate the linter can't be) |
| [deck-template.md](references/deck-template.md) | The ready-made React deck shell: structure, dev, edit mode, HTML/PDF/image export |
| [edit-mode.md](references/edit-mode.md) | The point-and-comment feedback overlay + programmatic inspect API |
| [pptx-editable.md](references/pptx-editable.md) | Editable-PPTX deep dive: measure→OOXML, the validation gate + acknowledgement system, fonts, gotchas |

> To render the 34 layout previews for review, use `deck-template/scripts/shoot-layouts.mjs`.
