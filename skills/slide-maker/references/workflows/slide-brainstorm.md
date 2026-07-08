# Workflow: Slide brainstorm — idea → slide skeleton

**Goal:** turn a vague ask ("I need a deck for X") into a clear, agreed **slide
skeleton** — the per-slide outline (what each slide says + its one focal point) — before
any HTML is written. Generating slides from an unexamined idea wastes the most work;
ten minutes of structured questions here saves an hour of redesign later.

This is collaborative brainstorming (one question at a time, get buy-in incrementally).
The terminal state is an **approved skeleton** the [slide-generate](slide-generate.md)
workflow consumes.

> **HARD GATE — do not write any slide HTML/JSX, copy the deck-template, or start
> generating until the user has approved the slide skeleton.** This holds even for a
> "simple 3-slide deck": simple decks are exactly where unstated assumptions (audience,
> the ask, the order) cause the most rework. A short skeleton is fine — but present it
> and get a yes.

## Resolve the design system FIRST (before any questions about look)

The layouts are token-driven — color, type, and spacing come from a **theme file**, never
from hardcoded values. Before brainstorming content, resolve which design system supplies
those tokens. Run this flow **in order** and stop at the first branch that applies:

1. **Ask the user if they have their own design system / brand tokens.** If yes → map its
   colors/type/spacing into `design-system/themes/clean-light.css` (or a new theme file the
   entry point imports). Layouts never change; only the theme's token *values* do.
2. **Else, check if `nextlevelbuilder/ui-ux-pro-max-skill` is installed.** If yes → invoke
   it to suggest the best-fit design system for the deck's content/idea, then map that into
   the theme file.
3. **Else, recommend it and guide a permanent install** from
   `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` — **the preferred path.**
4. **Else (user won't install permanently): ASK FIRST, then** shallow-clone it into `/tmp`,
   use it for **THIS TURN ONLY**, and don't persist it. **Never run this network fetch
   without explicit consent.**
5. **Else: use the bundled `clean-light` theme** — the guaranteed floor, so the skill never
   blocks.

The active theme file is the single source of truth for color/type. This is why you don't
brainstorm a "vibe" or palette — the design system is resolved, and you brainstorm content
and structure against it.

## Steps (do these in order — make a task per step)

1. **Understand the context.** What exists already? Check for a brief, prior decks,
   notes, the topic. If the user gave a doc/data, read it. Don't ask what you can find.
2. **Assess scope first.** If the ask is really several decks ("company overview AND a
   product deep-dive AND the pricing pitch"), say so and help split — brainstorm one at
   a time. Don't refine details of a deck that should be decomposed.
3. **Ask clarifying questions — ONE at a time.** Prefer multiple-choice. Cover the
   things that actually shape a deck (see the question bank below). One question per
   message; if a topic is rich, split it. Stop asking once you can state the deck's
   purpose, audience, and spine.
4. **Propose the spine (2–3 narrative arcs).** Before listing slides, offer 2–3 ways to
   *structure the story* (e.g. problem→solution→proof→ask vs. outcomes-first vs.
   chronological journey), with a recommendation and why. Get the user to pick.
5. **Present the slide skeleton** — slide by slide, scaled to the deck's size. For each
   slide give: the **layout**, the **one-line takeaway** (the title states the point), the
   **focal element** (the ONE thing — a KPI, chart, quote, diagram), and the **supporting
   content** (≤5 bullets / a stat / an image note). Ask "does this slide look right?" as you
   go; revise on the spot.
   - **Pick the layout from the catalog, don't invent one.** Match each slide's *intent* to
     one of the **34 premade layouts** in `<skill>/design-system/slides/`. The layout table
     in [house-style.md](../house-style.md) says what each is for. E.g. "a sequence of
     phases" → `12-timeline`; "compare tiers" → `14-comparison-table`; "one stat that
     matters" → `20-single-kpi-hero`.
   - **Confirm the pick by EYE — Read the thumbnail PNG.** Each layout has a rendered
     thumbnail (`design-system/slides/NN-name.png`) beside its HTML. `Read` it to *see* the
     candidate before committing — far faster than rendering, and it catches a mismatch
     (wrong density, wrong weight) the name alone can miss. Shortlist 2–3, Read their
     thumbnails, pick the best fit.
   - If genuinely nothing fits, say so and design a custom layout — but check the catalog
     (and its thumbnails) first. Full layout descriptions are in
     [house-style.md](../house-style.md).
6. **Confirm the whole skeleton**, then **write it to `docs/slide-skeleton-<topic>.md`**
   (so generate can consume it and the user can re-read it).
7. **Ask where the deck should live** (so generate can scaffold there). Propose a default
   and let the user override: **default output dir `./slides/<deck-name>/`** in their
   current project, exports under `./slides/<deck-name>/export/`. The `deck-template/`
   scaffold gets copied *to that location*, never into the skill directory — so the skill
   install stays pristine and multiple decks can coexist. Record the chosen path.
8. **Hand off:** "Skeleton approved and saved to `<path>`; deck will be scaffolded in
   `<output-dir>`. Ready to generate the HTML deck — that's the
   [slide-generate](slide-generate.md) workflow." Don't start generating until the user
   says go.

## The question bank (pick what's unknown — don't ask what you already know)

Ask only what genuinely changes the deck. Lead with the highest-leverage ones:

- **Purpose / desired outcome** — what should the audience *do or believe* after? (the
  single most important question; it sets the whole arc)
- **Audience** — execs / customers / engineers / investors / internal? Their prior
  knowledge sets density and tone.
- **Setting** — presented live (sparse, one idea/slide) vs. read alone (more text)?
- **The takeaway in one sentence** — if they remember one thing, what is it?
- **Length / time** — a 5-slide pitch vs. a 20-slide overview is a different spine.
- **Must-include content** — specific numbers, a customer story, a product shot, a logo wall?
- **Source material** — is there data/copy to pull from, or are we drafting it?
- **Tone** — confident-and-bold vs. measured-and-credible (both on-theme, different emphasis).

## What a good skeleton looks like

Each slide is one line of intent, not prose. Example (a 3-pillar capabilities deck):

```
1. Cover            — "Software that ships and stays shipped" · logo mark, lead line
2. What we do       — 3-column: Build / Integrate / Support — one icon+line each (focal: the 3 cards)
3. Proof / metrics  — hero KPI "70% adopt in week one" + a quarter bar chart (focal: the 70%)
4. How we engage    — 4-row table: plan × duration × outcome × pricing (focal: the table)
5. Close            — "Let's build the next bet" · CTA + contact (focal: the CTA)
```

That's enough for generate to produce real slides. Resist over-specifying copy here —
the point is the *structure and focal points*, agreed before pixels.

## Principles (why these matter)

- **One question per message.** A wall of questions gets skimmed; one gets a real answer.
- **Multiple-choice when you can.** Easier to react to than a blank prompt, and it
  surfaces options the user hadn't considered.
- **One focal point per slide is a brainstorm decision, not a styling one.** Deciding
  "the hero of slide 3 is the 70%" now is what makes the generated slide land — the
  wow-guide can't rescue a slide with no point.
- **YAGNI the deck.** Cut slides that don't serve the outcome. A tight 6-slide deck beats
  a padded 14-slide one. Push back on scope creep.
- **The theme is resolved up front — don't brainstorm a "vibe" or palette.** Once the
  design system is resolved (see the top of this workflow), the look is decided (the active
  accent + neutral scale, the active font, the house style). Brainstorm *content and
  structure*, not look. If the user asks "what colors", point them to the active theme file
  and the house style.
