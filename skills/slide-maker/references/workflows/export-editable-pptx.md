# Workflow: Export editable PPTX

**Goal:** turn the approved deck into a **native, editable PowerPoint** — real
textboxes, shapes, cards, charts, tables that open editable in PowerPoint / Keynote /
Google Slides — and **prove** it's faithful before handing it over.

**Input:** an approved HTML deck (from [slide-generate](slide-generate.md)). Use this
path when the audience must *edit* the file. If they only view it, the image path
([export-image-pptx](export-image-pptx.md)) is pixel-perfect and simpler.

**How it works (one rule):** pptxgenjs is a drawing API, not a layout engine. So the
exporter renders the slide in a real browser, **measures** each element's laid-out
geometry, auto-classifies it (text / card / icon / table / chart / rule), and emits
native OOXML — never guessing CSS. Deep dive + authoring conventions + gotchas:
[pptx-editable.md](../pptx-editable.md).

## Steps (run from inside the copied deck)

### 0. Pre-flight — clear STALE verify artifacts (judgment call)
Validation overwrites per-slide outputs in place, so a normal re-run is self-correcting.
But artifacts **left over from an unrelated/older run** can mislead you — e.g. a
`slides/slide-06.png` or a `diff/` heatmap from a deck that had more slides, or renders
from a different version you'll mistake for the current one. Before a fresh export,
glance at `export/verify-editable-pptx/` and clean if it's stale:
```bash
ls -la export/verify-editable-pptx/slides export/verify-editable-pptx/diff 2>/dev/null
node scripts/clean-verify.mjs        # wipe it (KEEPS pptx-acknowledgements.json) — see step 5
```
Clean when the leftovers are clearly from a **previous/different run** (slide count
changed, files are old, you're not mid-fix-loop on them). **Don't** clean if you're
actively iterating on the current run's diffs — you'd throw away the evidence you're
fixing against. When unsure on a first export of a session, a clean start is safe.

### 1. Export
```bash
node scripts/export-pptx-jsx.mjs                 # all slides → export/deck.pptx (editable)
node scripts/export-pptx-jsx.mjs --slide 1       # one slide
node scripts/export-pptx-jsx.mjs --embed-fonts   # portable copy (verify in PowerPoint, not LibreOffice)
```

> ### Whichever exporter you used, diff the result
> **`node scripts/verify-export.mjs`** — one command, works on any `export/deck.pptx`:
> renders the HTML deck and the PPTX at the same size, diffs every slide, ranks them, and
> runs `diff-regions` on the worst. Run it after every export. If you only do one thing
> from this file, do this.
>
> `validate-pptx.mjs` below is the fuller gate (per-issue IDs, acknowledgements) and is
> still the standard for a deliverable — but read the box beneath first, because it
> rebuilds the deck with a specific exporter.

> ### Which exporter are you validating?
> Two scripts write `export/deck.pptx` and share no code. **`validate-pptx.mjs` runs
> `export-pptx-jsx.mjs`** — so if the deck was produced by
> `export-deck.mjs --format pptx-editable` (the `--format` path), the gate rebuilds with
> the *other* pipeline and **overwrites your file**. Check which one produced the deck
> before running the gate.
>
> | Built with | Check with |
> |---|---|
> | `export-pptx-jsx.mjs` | **`validate-pptx.mjs`** (the full gate), then `verify-export.mjs` |
> | `export-deck.mjs --format pptx-editable` | **`verify-export.mjs`** — the gate would rebuild with the *other* exporter and report its defects as yours |
>
> The gate saves a `.before-validate` copy first and prints a notice — restore from that
> if you see the notice after the fact. Do not skip verification just because the gate
> does not fit: for an `export-deck.mjs` deck, `verify-export.mjs` is the check.

### 2. Validate — THE quality gate (always run this)
`validate-pptx.mjs` exports, renders the pptx back via LibreOffice, and runs **every**
check — text position/size, shape fills, icons present, tables, SSIM, diff-regions —
nothing skipped. **It passes only when every issue is fixed or explicitly acknowledged.**
```bash
node scripts/validate-pptx.mjs            # full: export → render → all checks → verdict
node scripts/validate-pptx.mjs --no-build # reuse the last export/render
```

### 3. Resolve EVERY issue — examine the evidence, THEN judge
Each issue gets a stable ID (e.g. `E0ILFRWU`). **Treat every issue as blocking — review
each, never dismiss as "minor".**

**For EVERY open issue you MUST examine all five evidence files for its slide BEFORE you
fix or acknowledge it.** The judgement has to be grounded in what the artifacts actually
show — never a guess, never a rubber-stamp. The validator prints the exact paths per
failing slide; for slide `NN` they live under `export/verify-editable-pptx/`:

| File | What it tells you |
|------|-------------------|
| `source/slide-NN.png` | the **HTML design** — the target the export must match |
| `slides/slide-NN.png` | the **exported pptx** rendered (LibreOffice) — what actually came out |
| `diff/slide-NN.png` | the **heatmap** — red = hard pixel diff, yellow = font antialiasing noise |
| `diff/slide-NN_inspect.png` | the top diff regions **boxed on the render** — where the drift is |
| `diff/slide-NN_inspect.json` | those regions + **the `data-viz-id`s in each** + a `verdict` (structural vs spread/font-noise) |

**`Read` the four images** (source, rendered, heatmap, inspect.png — you see images
natively) **and read the inspect.json.** Cross-read them: compare source ↔ rendered to
see *what* differs; use the heatmap + inspect.png to see *where*; use inspect.json for
*which element* and its `verdict`. Only with that picture do you decide:

- **Fix it** (in the slide source or the exporter) when the evidence shows a real export
  defect — a dropped/flattened element, wrong colour, mis-placed or wrapped block, etc.
- **Acknowledge it** only when the evidence shows a genuine non-defect (e.g. a
  LibreOffice-vs-Chromium glyph-AA difference, or a one-word wrap the renderers disagree
  on; inspect verdict reads "spread/font-noise" and the text/colour/position are otherwise
  correct). **The `--reason` must cite what the evidence showed** — so a later reviewer can
  check your judgement:
```bash
node scripts/validate-pptx.mjs --ack <ID> --reason "evidence: <what source/rendered/heatmap/inspect showed> — why acceptable"
node scripts/validate-pptx.mjs --ack <ID1> <ID2> --reason "shared reason"   # batch same-reason
node scripts/validate-pptx.mjs --list-acks      # what's waived + why
node scripts/validate-pptx.mjs --unack <ID>     # remove a waiver
```
New or *materially worse* issues get a new ID, so acks never blanket-suppress
regressions. A clean **`✓ PASS`** means: every element class verified, every exception
justified **by evidence**.

Lower-level tools (`verify-deck`, `verify-text`, `verify-pptx`, `diff-regions`) for
deeper digging are documented in [pptx-editable.md](../pptx-editable.md).

### 4. Eye-check every slide — source vs rendered, side by side (MANDATORY after `✓ PASS`)
A green gate is necessary, not sufficient. The checks are mechanical (ink bounds, colour
coverage, line counts) — they can pass while a slide still **looks** wrong to a person: a
hero number that came out a touch small, a card that lost its rounding, an icon nudged
off-centre, spacing that drifted, a colour that's subtly off. So once the gate is clean,
**you** become the final reviewer.

For **every** slide, `Read` all THREE images and **compare them directly** — never judge
the rendered one alone; the source is the ground truth you're matching, and the diff
heatmap tells you *where* to look:
```
export/verify-editable-pptx/source/slide-NN.png    ← the HTML design (target)
export/verify-editable-pptx/slides/slide-NN.png    ← the exported pptx (what shipped)
export/verify-editable-pptx/diff/slide-NN.png      ← heatmap: red = hard diff · yellow = font AA noise
```
Read the **diff heatmap first as a hint** — its red areas point straight to where the
render departs from the source, so you focus your source↔rendered comparison there instead
of scanning blind. (Evenly-spread yellow over text is just glyph antialiasing — ignore it;
a concentrated red blob over one element is a real difference worth checking.) Then look at
source vs rendered for what a diff metric misses: relative sizes and hierarchy, alignment
and spacing, whether the ONE hero still dominates, rounding/shadows/fills, icon placement,
colour fidelity, anything clipped or reflowed. Critique against
[visual-review.md](../visual-review.md).

**Delegate the looking to subagents, in BATCHES — it's a standalone, image-heavy task.**
Each slide loads 3 PNGs; a single subagent reviewing the whole deck would blow its own
context just like the main agent would. So **split the slides into small batches (≈2–3
slides each) and dispatch one subagent per batch, in parallel**. Give each subagent: the
three file paths per slide in its batch (source / rendered / diff), the rubric above +
[visual-review.md](../visual-review.md), and ask for a **structured result per slide** —
`match` / `defect`, and for each defect the `data-viz-id` (or region), what's wrong, and
the likely cause. The main agent collects the batch verdicts (just the lists, not the
images) and acts on them. Scale the batch count to deck size — a 5-slide deck → 2 batches
(e.g. slides 1–3 and 4–5); a 20-slide deck → ~7 batches.

If the subagent reports anything off, the main agent **fixes the cause** (slide source or
exporter) → re-export → re-validate → re-run the eye-check subagent on the touched
slide(s). Only stop when **every slide visually matches its source** — not just the gate.
(This is a real defect-finder, not a formality — the gate passing is exactly when subtle
visual drift hides. The "+12 pts" chip clipping that passed the mechanical gate but a
glance caught is the canonical example.)

### 5. Clean up — agent-controlled (the why)
**Cleanup is yours to call, never automatic** — validation keeps the diff/render
artifacts on purpose so the issue-resolution loop (step 3) has evidence to work against. So:
- **Before a fresh export** → clean if the folder is *stale* from a previous/different
  run (step 0).
- **During the fix loop** → DON'T clean; you're reading those diffs.
- **After deleting a slide / changing slide count** → clean, so an orphaned
  `slides/slide-NN.png` from the removed slide doesn't linger.
```bash
node scripts/clean-verify.mjs        # wipe verify-editable-pptx/ (KEEPS acknowledgements)
node scripts/clean-verify.mjs --all  # wipe everything incl. acknowledgements (rarely)
```
Acknowledgements survive a normal clean — they're decisions, not build output. Use
`--all` only when you truly want to re-review every previously-waived issue from scratch.

## Done when
**Both** gates are green: (1) `validate-pptx.mjs` prints **`✓ PASS`** (every element class
verified, every exception justified by evidence), AND (2) you've **eye-checked every slide
source-vs-rendered** (step 4) and each visually matches. Only then is the deliverable
`export/deck.pptx` ready — open it in PowerPoint/Keynote and the text, cards, charts, and
tables are all editable. Hand the path to the user.

## Key facts to remember (the rest is in pptx-editable.md)
- **Edit mode is stripped from every export** — it's an authoring tool, not a publish artifact.
- **Fix design in the HTML deck, not here.** The exporter faithfully renders an approved
  deck; if a slide looks wrong, go back to [slide-generate](slide-generate.md).
- **Author export-clean** (one tagged box per thing, body = one `<p>`, colour on the
  tagged element) — done during generate, it makes this export pass first try.
