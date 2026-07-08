# Workflow: Slide generate — skeleton → reviewed HTML deck

**Goal:** turn an approved slide skeleton into a real, on-brand **HTML/React deck** the
user can see and react to, then iterate with their feedback until they approve it. The
output of this workflow is a deck the user is happy with — the input to any export
workflow.

**Input:** an approved skeleton (from [slide-brainstorm](slide-brainstorm.md)) — or, if
the user skipped brainstorming, a clear-enough ask. If the ask is still vague, **stop and
run brainstorm first** — generating from a fuzzy idea produces slides nobody asked for.

## Steps

### 1. Set up the deck (once)

**First, resolve the design system** (if brainstorm didn't already). Run this flow **in
order**, stop at the first branch that applies:
1. **User's own design system / brand tokens** → map colors/type/spacing into
   `design-system/themes/clean-light.css` (or a new theme the entry point imports). Layouts
   never change; only the theme's token *values* do.
2. **Else, `nextlevelbuilder/ui-ux-pro-max-skill` installed** → invoke it to suggest a
   best-fit design system, then map that into the theme file.
3. **Else, recommend + guide a permanent install** from
   `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` (preferred path).
4. **Else, ASK FIRST, then** shallow-clone it into `/tmp` for **THIS TURN ONLY**, don't
   persist it. **Never fetch without explicit consent.**
5. **Else, use the bundled `clean-light` theme** — the guaranteed floor.

The active theme file is the single source of truth for color/type — read it, write token
values into it, never hardcode a hex/font into a layout.

**Then, confirm where the deck should live.** Default output dir `./slides/<deck-name>/`
in the user's project, exports under `.../export/`. **Copy the `deck-template/` scaffold to
that location — NOT into the skill directory** (the skill's `deck-template/` is a pristine
template; the working copy lives in the user's project, so decks coexist and the install
stays clean). The scripts travel inside the copy; you never hand-build the harness.

```bash
cp -r <skill>/deck-template ./slides/<deck-name> && cd ./slides/<deck-name> && npm install
npx playwright install chromium      # once, for review + export
```
Full template tour: [deck-template.md](../deck-template.md).

### 2. Author each slide (from the skeleton)

**First, pick a layout from the catalog — this is mandatory, not optional.** Before writing
any JSX for a slide, match the slide's situation (content shape + intent) to one of the
**34 premade layouts** in `<skill>/design-system/slides/`. The layout table in
[house-style.md](../house-style.md) says what each layout is for. Do **not** guess a layout
from memory — match the slide's actual situation to the catalog.

```bash
# (Re)render the 34 layout previews if you want a fresh contact sheet to eyeball:
node scripts/shoot-layouts.mjs      # → thumbnails beside each design-system/slides/NN.html
```

Then **review the top candidates' thumbnails** — Read
`design-system/slides/<NN-name>.png` for the 2–4 best matches — and decide:
- **Use one directly** when a catalog layout fits the slide's content shape, or
- **Use them as reference** — combine/adapt the closest layouts into a custom layout for
  the slide's specific situation (e.g. a slide that has *both* a step sequence and a KPI
  row borrows the process-flow lane and the kpi-row treatment).

State which layout id(s) you chose or adapted, and why, before authoring. (Matching by
intent against the catalog is how you avoid the "I grabbed a layout that doesn't match the
content" miss — the table encodes each layout's purpose; filenames don't.)

For every slide in the skeleton, write `src/slides/NN-name.jsx`:
- Copy the shape of `00-EXAMPLE-hero-metrics.jsx`.
- Root `<div className="slide-page" data-viz-id="sN">`; content in `slide-content`.
- **Theme tokens only** (`text-primary-500`, `text-h1`, `bg-bg-card`, …) — never raw hex
  or generic Tailwind colours. The skeleton already named the layout + focal point;
  realize them with the house patterns ([house-style.md](../house-style.md)).
- Make it **wow**, not just on-theme: one hero, eyebrow→title→accent-rule→body rhythm,
  calm motion, ≥35% whitespace. Full craft guide: [wow-guide.md](../wow-guide.md).
- **Annotate every meaningful element with `data-viz-id`** — this one tag powers edit
  mode, visual review, AND every editable export. Tag titles, cards, chips, rules,
  bodies, charts. (See [edit-mode.md](../edit-mode.md).)
- **Author export-clean from the start** (one tagged box per thing; a body is one `<p>`;
  colour on the tagged element) so the deck converts faithfully later — the checklist in
  [pptx-editable.md](../pptx-editable.md) ("Author for clean export") costs nothing now
  and saves a fix loop at export.
- **Use the 3-layer skeleton for any slide with a footer / dense content** — `shrink-0`
  header, `flex-1 min-h-0` content band, `shrink-0` footer inside the `slide-page` flex
  column. It makes footer-overlap and "column too tall" structurally impossible, so you
  never enter the magic-pixel-height fix loop. Tag sizing/positioning to layout
  (`items-stretch`, `min-h-0`, `preserveAspectRatio`), never a fixed `height:Npx`. Full
  skeleton + recipes: [visual-review.md → The 3-layer slide skeleton](../visual-review.md#the-3-layer-slide-skeleton--the-default-and-the-cure-for-footer-overlap).
- Register each slide in `src/App.jsx` (`SLIDES`, `NAV_ITEMS`, `PRESENTATION_NAME`).

### 3. Self-check before showing the user (two gates — both required)
The user's time is precious; never show a deck you haven't checked.
```bash
node scripts/check-slop.mjs src/slides/*.jsx     # SOURCE gate: 0 errors before continuing
node scripts/shoot-slides.mjs --mode both        # render → review/slide-NN.png
```
- **Source gate** ([validation.md](../validation.md)) — fix every ERROR (raw hex,
  off-brand font, generic colour, dark glass, layout-breakers). Warnings are judgment.
- **Visual gate — eye-check EVERY rendered slide, one by one.** `check-slop` reads
  source and is blind to how a slide *renders*; a slide can pass it 0/0 yet have a hero
  number that came out tiny, a lopsided layout, clipped text, a chart whose highlight bar
  is wrong, or cards that don't share a baseline. So **look at every `review/slide-NN.png`**
  and critique it against the wow-guide rubric in [visual-review.md](../visual-review.md):
  does ONE hero dominate? eyebrow→title→rule→body rhythm? alignment/spacing clean? ≥35%
  whitespace? nothing clipped or mis-sized? Unlike the export check there's no source to
  diff against — the rendered PNG *is* the design, so you're judging craft, not fidelity.

  **Delegate the looking to subagents, in BATCHES** — each slide PNG is heavy on context
  and the review needs no other state, so split the slides into small batches (≈2–3 each)
  and dispatch one subagent per batch in parallel. Give each: the `review/slide-NN.png`
  paths for its batch, the rubric ([visual-review.md](../visual-review.md) + the wow
  checklist), and ask for a **structured verdict per slide** — `good` / `issue`, and for
  each issue the `data-viz-id` (or area), what looks wrong, and the likely fix. The main
  agent keeps just the verdicts; the PNGs never enter its context. (5 slides → 2 batches;
  scale up for bigger decks.)

- **Inspect to localise an issue — programmatic `inspect`.** When a subagent flags
  something but the cause is unclear (exact positions, spacing/alignment between elements,
  which element is which), drive edit mode headlessly. It captures the slide with an
  orange id-box overlay AND clean, plus exact `{id,x,y,w,h}` geometry, for **all** elements
  or just **some**:
  ```bash
  node scripts/inspect.mjs --slide N --all              # box + label EVERY element (the id map)
  node scripts/inspect.mjs --slide N --ids s1.title,s1.card.1   # box only suspect elements
  node scripts/inspect.mjs --slide N --ids s1.kpi --mode clean  # the clean visual, no overlay
  ```
  Writes `geometry.json` + a highlight PNG + a clean PNG — **Read them** to judge spacing,
  alignment, and overlap precisely (e.g. "is the KPI baseline-aligned with its label?",
  "do the 3 cards share a baseline?"). Use `--all` first to learn the slide's id map, then
  `--ids` to drill into what looks off. Full guide: [edit-mode.md](../edit-mode.md).

**Fix loop:** for every issue a subagent reports, fix the cause in the slide JSX →
re-run `check-slop` + re-shoot that slide → re-check it. Only when **every slide passes
both gates** (source clean AND visually good to your eye) do you show the user.

### 4. Show the user + iterate (the review loop)
Serve the deck so the user can both *see* it and *point at* exact elements:
```bash
node scripts/serve.mjs --dev        # deck dev server + the edit-mode feedback bridge
```
Tell them: open http://localhost:5173, arrow/number keys to navigate; press **`e`** for
edit mode to click an element / drag a box / brush an area, attach comments, hit **"Copy
for AI"**, then say "read the feedback." You read
`/tmp/slide-maker-edit/edit-feedback.json` — each comment names its `data-viz-id`, so you
grep straight to the JSX. Full mechanics: [edit-mode.md](../edit-mode.md).

Then **loop**: apply the feedback → re-run the two self-check gates on the touched
slides → show again. Keep going until the user says the deck looks good. Don't
short-circuit the gates between rounds — a fix can reintroduce slop.

### 5. Hand off
Once the user approves the HTML deck:
> "Deck approved. To produce a deliverable, pick an export:
> editable PPTX ([export-editable-pptx](export-editable-pptx.md)) · image PPTX
> ([export-image-pptx](export-image-pptx.md)) · standalone HTML
> ([export-standalone-html](export-standalone-html.md)) · PDF ([export-pdf](export-pdf.md))."

## Principles

- **Show, don't describe.** The user reacts to a rendered slide far better than to a
  description of one — get a checked deck in front of them fast, then iterate.
- **The two self-check gates are non-negotiable before every show.** Source slop and
  rendered craft are different failure modes; check both. You looking at the pixels is
  the gate the linter can't be.
- **Edit mode > paraphrased feedback.** "Make the title on slide 3 bigger and move the
  chart left" loses precision; a clicked element + comment is exact. Steer the user to it.
- **Iterate on the HTML, not the export.** Get the deck *right* here; exports are
  faithful renderers of an approved deck, not a place to fix design.
