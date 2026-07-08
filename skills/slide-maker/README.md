# Slide Maker

Make genuinely impressive, on-brand presentation slides — from a single slide to a full
deck — and export them to editable PowerPoint, image PowerPoint, standalone HTML, or PDF.
The skill ships the whole kit: a token-driven design system, a "wow" craft guide, an
anti-slop validator, a ready-made React deck, point-and-comment edit mode, and a
*validated* editable-PPTX pipeline.

It is **design-system-agnostic**: it drives every slide from design tokens (never
hardcoded colors or fonts), so it can use your own design system, a suggested one, or a
bundled neutral default — and re-skin every layout by swapping one theme file.

This is a **Claude skill** — you don't run it by hand. Ask Claude for a deck and it loads
this skill and drives the work. This README is the quick orientation; [`SKILL.md`](SKILL.md)
is what the agent follows.

---

## TL;DR — get a deck in 4 steps

Just tell Claude what you want. It picks the matching workflow and runs it.

```
1. "Help me build a deck to pitch our SaaS product to investors"   → brainstorm + generate
2. (answer its questions, review the slides it shows you)          → iterate
3. "Looks good — give me an editable PowerPoint"                   → export
4. open export/deck.pptx                                           → done
```

You can also jump straight in: *"export the deck in ./slides to PDF"*, or
*"I already have the outline, just build the slides."*

---

## The workflows (one per job)

Claude routes your request to one of these. The natural order is **brainstorm → generate →
export**, but you can start at any step.

| You want to… | Workflow |
|---|---|
| Figure out what the deck should say / its structure | **slide-brainstorm** — guided Q&A → an agreed slide skeleton |
| Build the actual slides and iterate on them | **slide-generate** — HTML deck + review loop until you approve |
| Get an **editable** PowerPoint (recipient edits text/shapes) | **export-editable-pptx** — measured, native objects, *validated* |
| Get a **pixel-perfect, view-only** PowerPoint | **export-image-pptx** |
| Get a single self-contained **HTML** file (opens offline) | **export-standalone-html** |
| Get a **PDF** (print / handout) | **export-pdf** |

```
brainstorm ──▶ generate ──▶ ┬─▶ editable PPTX
(idea→skeleton) (HTML deck,  ├─▶ image PPTX
                review loop) ├─▶ standalone HTML
                             └─▶ PDF
```

Full step-by-step for each is in [`references/workflows/`](references/workflows/).

---

## Which design system does it use?

At the start of brainstorm/generate, Claude resolves the design system in order and stops
at the first that applies:

1. **Your own design system / brand tokens**, mapped into the theme file.
2. Else, a **`nextlevelbuilder/ui-ux-pro-max-skill`** suggestion if that skill is installed.
3. Else, it **recommends installing** that skill (the preferred path).
4. Else, with your explicit consent, a **one-turn-only** clone of it.
5. Else, the bundled **`clean-light`** theme — the guaranteed floor, so the skill never blocks.

Whatever the outcome, the active theme file is the single source of truth for color and
type; layouts never change, only the theme's token values do.

---

## How you collaborate — edit mode

When Claude shows you a deck, it runs a dev server with a **point-and-comment overlay**:

1. Open the deck (Claude gives you the URL, usually `http://localhost:5173/`).
2. Press **`e`** for edit mode → **click** an element, **⌘-click** several, or **drag a box**
   to snip an area; type a comment; hit **"Copy for AI"**.
3. Tell Claude **"read the feedback"** — it reads exactly which elements you meant (and your
   snip image) and edits straight to them.

Far more precise than describing changes in words. (Edit mode is a dev tool — it's
automatically stripped from every export.)

---

## What "done" means — two gates, both green

Quality is enforced, not assumed. Before Claude hands you a deck it passes:

1. **Mechanical gate** — `check-slop` (source) + the PPTX **validation gate**
   (`validate-pptx.mjs`): text position/size, colours, fills, icons, tables, wrapping,
   structure. It only passes when every issue is fixed or explicitly acknowledged with a
   reason.
2. **Eye-check** — Claude (via subagents) *looks at* the rendered slides and fixes anything
   that looks wrong even if the gate passed (a clipped chip, a tiny hero, a flattened
   accent). A green checker is necessary, never sufficient.

So a finished deck is verified both by machine and by eye.

---

## What's in the box

```
slide-maker/
├── SKILL.md                  ← what the agent follows (workflow router + craft rules)
├── README.md                 ← you are here
├── design-system/            ← the token-driven design kit (standalone source of truth)
│   ├── tokens/               ← colours, type, spacing, fonts — THE source of truth
│   ├── themes/clean-light.css ← the active theme (bundled neutral default; the floor)
│   ├── slides/*.html         ← 34 premade slide layouts (the catalog)
│   ├── styles.css            ← token entry point (for plain-HTML slides)
│   └── assets/logos/         ← mark.svg, logo-full.svg (neutral placeholders)
├── deck-template/            ← a complete React+Tailwind deck you copy & fill
│   └── scripts/              ← all the tooling, travels with each deck:
│                               check-slop · shoot-slides · shoot-layouts · serve ·
│                               inspect · export-deck · export-pptx-jsx · validate-pptx ·
│                               verify-* · diff-regions · clean-verify · …
└── references/               ← the docs the workflows pull in as needed
    ├── workflows/            ← the 6 job workflows (step-by-step)
    ├── house-style.md  wow-guide.md  tailwind-theme.md
    ├── validation.md  visual-review.md  edit-mode.md
    ├── deck-template.md  pptx-editable.md
    └── …
```

The design kit ships **inside** the skill, so it's self-contained. If anything ever
disagrees with `design-system/tokens/` (or the active theme), the token/theme files win.

---

## The look, in one breath

Light, clean slides driven by tokens; a single restrained **accent** hue (indigo in the
default `clean-light` theme) used sparingly, a neutral ink scale for text and dark
surfaces. One hero per slide, generous whitespace, calm motion. Never a second font or a
hardcoded colour — change the theme file instead. The full rules live in
[`references/house-style.md`](references/house-style.md) and the craft ceiling in
[`references/wow-guide.md`](references/wow-guide.md).

---

## Two ways to use it

- **Drive the whole deck here** (the usual path) — copy the deck template, write slides, edit,
  export. Everything above.
- **Supply only the design layer** to another slide generator — that tool runs its own
  workflow but skips theme selection and pulls the active tokens/components/patterns from
  here, so its output uses a real design system. See
  [`references/tailwind-theme.md`](references/tailwind-theme.md).

---

## First-time setup (for the export/review tooling)

The deck tooling runs on Node + Playwright; the editable-PPTX **verify** render needs
LibreOffice. From inside a copied deck:

```bash
npm install
npx playwright install chromium      # once — for rendering & export
# LibreOffice (soffice) on PATH — for the editable-PPTX validation render
```

Claude handles these as part of the workflows; this is just what's under the hood.
