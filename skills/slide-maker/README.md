# MTI Slide Maker

Make genuinely impressive, on-brand **MTI Technology** presentation slides — from a single
slide to a full deck — and export them to editable PowerPoint, image PowerPoint, standalone
HTML, or PDF. The skill ships the whole kit: the MTI brand system, a "wow" craft guide, an
anti-slop validator, a ready-made React deck, point-and-comment edit mode, and a *validated*
editable-PPTX pipeline.

This is a **Claude skill** — you don't run it by hand. Ask Claude (in this repo) for an MTI
deck and it loads this skill and drives the work. This README is the quick orientation;
[`SKILL.md`](SKILL.md) is what the agent follows.

---

## TL;DR — get a deck in 4 steps

Just tell Claude what you want. It picks the matching workflow and runs it.

```
1. "Help me build an MTI deck to pitch our managed-services offering"   → brainstorm + generate
2. (answer its questions, review the slides it shows you)               → iterate
3. "Looks good — give me an editable PowerPoint"                        → export
4. open export/deck.pptx                                                → done
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
mti-slide-maker/
├── SKILL.md                  ← what the agent follows (workflow router + brand rules)
├── README.md                 ← you are here
├── design-system/            ← the MTI brand kit (standalone source of truth)
│   ├── tokens/               ← colours, type, spacing, fonts — THE source of truth
│   ├── slides/*.html         ← 11 premade slide layouts (the catalog)
│   ├── styles.css            ← token entry point (for plain-HTML slides)
│   └── assets/logos/         ← mti-logo-full.svg, mti-mark.svg
├── deck-template/            ← a complete React+Tailwind deck you copy & fill
│   └── scripts/              ← all the tooling, travels with each deck:
│                               check-slop · shoot-slides · serve · inspect ·
│                               export-deck · export-pptx-jsx · validate-pptx ·
│                               verify-* · diff-regions · clean-verify · …
└── references/               ← the docs the workflows pull in as needed
    ├── workflows/            ← the 6 job workflows (step-by-step)
    ├── house-style.md  wow-guide.md  tailwind-theme.md
    ├── validation.md  visual-review.md  edit-mode.md
    ├── deck-template.md  pptx-editable.md
    └── …
```

The brand kit ships **inside** the skill, so it's self-contained. If anything ever disagrees
with `design-system/tokens/`, the token files win.

---

## The brand, in one breath

Green-forward **light** slides; **Noto Sans JP** for everything; green is the accent (not big
fills), yellow is only the small dot-trail motif, ink is text + dark surfaces. One hero per
slide, generous whitespace, calm motion. Never a second font or an invented colour. The full
rules live in [`references/house-style.md`](references/house-style.md) and the craft ceiling
in [`references/wow-guide.md`](references/wow-guide.md).

---

## Two ways to use it

- **Drive the whole deck here** (the usual path) — copy the deck template, write slides, edit,
  export. Everything above.
- **Supply only the brand layer** to another slide generator — that tool runs its own
  workflow but skips theme selection and pulls MTI tokens/components/patterns from here, so
  its output is on-brand. See [`references/tailwind-theme.md`](references/tailwind-theme.md).

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
