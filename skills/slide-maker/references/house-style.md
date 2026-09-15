# House style & layout catalog

The layout rules and the 34 reference layouts. The HTML sources live in
`<skill>/design-system/slides/` — open them to see exact structure, then reproduce the
layout in JSX with the Tailwind tokens ([tailwind-theme.md](tailwind-theme.md)). For
*craft* (making a layout impressive, not just consistent) see [wow-guide.md](wow-guide.md).

Everything here is **token-driven**: color, type, and spacing come from the active theme
file (`design-system/themes/clean-light.css` by default), never from hardcoded values in
the layouts. Swap or remap the theme and the whole catalog re-skins.

## The layout catalog (34 layouts)

> **Picking a layout is a REQUIRED step — every time.** Each of the 34 layouts is a
> standalone `1280×720` HTML file in `design-system/slides/` with a rendered `.png`
> thumbnail beside it. For each slide you author or redesign you MUST:
> 1. **Match the slide's situation** (content shape + intent) to a layout in the table
>    below. Don't pick from memory.
> 2. **Confirm by EYE** — `Read design-system/slides/<NN-name>.png` for the 2–4 best
>    candidates before committing; the thumbnail catches a mismatch (wrong density,
>    wrong weight) the name alone misses.
> 3. **Decide: use directly, or adapt as reference.** If a layout fits, use it. If the
>    slide is a blend (e.g. sequence + KPIs), take the closest layouts as *reference* and
>    compose a custom layout from their parts.
> 4. **State the chosen/adapted layout id(s) and why** before writing JSX.

| # | File | Layout | Use it for |
|---|------|--------|-----------|
| 01 | `01-cover.html` | Cover | Opening / title slide. Logo top-left, doc-kind top-right, big title with one accent word, lead line, footer meta. |
| 02 | `02-section-divider.html` | Section divider | Full-bleed accent break between sections. Giant faded index number, white title. |
| 03 | `03-three-column.html` | Three columns | Three peer ideas / pillars / services. Numbered chips, cards. |
| 04 | `04-metrics.html` | Metrics / KPI | 3 big-number KPIs with label + one-line context. Accent top-rule on each. |
| 05 | `05-agenda.html` | Agenda | Contents / roadmap. Accent left rail (logo + title), numbered list on the right. |
| 06 | `06-content-image.html` | Content + image | Bullets left, full-bleed image right. Narrative points paired with a photo. |
| 07 | `07-comparison.html` | Comparison | Two columns: neutral "today / option A" vs accent "proposed / option B". |
| 08 | `08-persona.html` | Persona | Dark (`ink-900`) left rail with headshot + attributes; goals/pains/motivations grid. |
| 09 | `09-quote.html` | Big quote | Full-bleed pull quote with an accent emphasis word + attribution. |
| 10 | `10-closing.html` | Closing | Full-bleed accent sign-off. "Thank you" eyebrow, big title, contact row. |
| 11 | `11-hero-metrics.html` | Hero metrics (showcase) | **Worked "wow" exemplar.** One hero KPI + a highlight-one-bar chart, accent rule, one `shadow-accent` chip. Read it end-to-end to see [wow-guide.md](wow-guide.md) techniques combined. |
| 12 | `12-timeline.html` | Timeline / roadmap | A sequence of phases over time — milestones on a horizontal track, past filled, future muted. |
| 13 | `13-process-flow.html` | Process flow | How something works as ordered steps — numbered cards joined by chevrons. |
| 14 | `14-comparison-table.html` | Comparison table | Options compared across attributes — N×M table with an accent header rule, bold first column, zebra rows. (Native-editable-table on export.) |
| 15 | `15-statement.html` | Big statement | One bold claim at `text-display` scale with a single accent phrase + a short sub. No data. |
| 16 | `16-problem-solution.html` | Problem → solution | The narrative turn — a dark "problem" panel gives way to a light "approach" panel. |
| 17 | `17-feature-list.html` | Feature list | A capabilities / what's-included list — left intro column, right rows of icon-chip + headline + one line. |
| 18 | `18-agenda-rail.html` | Agenda rail | Agenda variant — full-height accent rail carrying the section title beside a numbered contents list. |
| 19 | `19-four-column.html` | Four columns | Four peer items when three won't fit the story (four pillars, four steps as cards). |
| 20 | `20-single-kpi-hero.html` | Single KPI hero | One dominant number as the whole slide — the "one stat that matters" moment. |
| 21 | `21-kpi-row.html` | KPI row | A row of 3–4 supporting KPIs with labels; each with an accent top-rule. |
| 22 | `22-two-panel-compare.html` | Two-panel compare | Side-by-side panels for us-vs-them / option A-vs-B without a full table. |
| 23 | `23-before-after.html` | Before / after | The change made concrete — a muted "before" state next to an accent "after" state. |
| 24 | `24-pull-quote.html` | Pull quote | A shorter testimonial / emphasis quote inline with content (lighter than the full-bleed 09). |
| 25 | `25-icon-grid.html` | Icon grid | A grid of icon + label tiles — a capability wall, an integrations grid, feature at-a-glance. |
| 26 | `26-checklist.html` | Checklist | A list of items with accent check markers — what's included, what's done, requirements met. |
| 27 | `27-pillars.html` | Pillars | Named strategic pillars, each a titled column with a short supporting line. |
| 28 | `28-numbered-list.html` | Numbered list | An ordered list where sequence matters — steps, ranked priorities, a top-5. |
| 29 | `29-roadmap-phases.html` | Roadmap phases | Phased plan — named phases (Now / Next / Later) each with their workstreams. |
| 30 | `30-bar-chart.html` | Bar chart | Categories compared — vertical bars, one highlighted in the accent, the rest muted. |
| 31 | `31-line-chart.html` | Line chart | A trend over time — a single accent line with a soft area fill. |
| 32 | `32-donut-chart.html` | Donut chart | Part-to-whole with ≤4 parts — a donut using the `SERIES` palette in order. |
| 33 | `33-stat-callout.html` | Stat callout | A single statistic framed as an editorial callout with supporting context. |
| 34 | `34-matrix-2x2.html` | 2×2 matrix | A trade-off / positioning grid — two axes, four quadrants, items placed by quadrant. |

**Picking layouts for a deck:** match each slide's intent to the table above. A typical
flow: `01 cover → 05 agenda → 15 statement (thesis) → [02 divider → content] → 16
problem-solution → 13 process-flow / 12 timeline (how) → 14 comparison-table → 04/20/21
metrics → 09 quote → 10 closing`. Content slides pick from
03/06/07/16/17/19/22/25/26/27/28 by whether the point is parallel ideas (03/19/27), a
capability wall (25), a checklist (26), a comparison (07/14/22), a problem→solution turn
(16), or a feature list (17). Data slides pick from 04/20/21/30/31/32/33/34 by the data
shape (single number, KPI row, trend, categories, part-to-whole, trade-off matrix).

## Style rules (non-negotiable)

- **Palette:** the active design system's accent (a single restrained hue — indigo in
  `clean-light`) used **sparingly**, plus a neutral ink scale for text and dark surfaces.
  Accent = the highlight, never a wash across the whole slide.
- **Font:** the active theme's font. The bundled default is a **system font stack**
  on-screen; the editable-PPTX exporter embeds **Inter** (SIL OFL) for consistent
  rendering. One family per deck; contrast comes from weight (light 300 for lead/body,
  bold 700 for titles, black 900 for hero/index numbers), never a second typeface.
- **Icons:** a real SVG icon set — `lucide-react` (default), or Material Symbols /
  Font Awesome as inline `<svg>`. One set per deck, one stroke style, tinted
  `text-primary-500` or ink. **Never Unicode emoji** (🚀📊 = AI slop). Icons export as
  native recolorable PowerPoint shapes (see [pptx-editable.md](pptx-editable.md)).
- **Diagrams** are a different thing from icons and charts — a concept, architecture or
  workflow picture is usually hand-written SVG. See [diagrams.md](diagrams.md) for when
  to hand-draw vs. generate, and the conventions that make one readable.
- **Slides are light by default.** The full-bleed accent slides (02, 05/18 rail, 10) and
  the dark persona rail (08) carry the visual weight — don't make every slide accent.
- **Eyebrow kickers:** uppercase, accent, `text-eyebrow tracking-eyebrow font-bold`,
  sitting above the title.
- **Accent rule:** a short (~56px) accent bar under section titles — the `.accent-rule`
  class (`width:56px; height:var(--rule-accent-w); background:var(--color-accent)`).
- **Decorative motif:** faint accent blobs in slide corners and, at most, a single small
  accent dot. Subtle, low opacity. Never large accent fills used as decoration.

## Logo usage

- Asset: `<skill>/design-system/assets/logos/logo-full.svg` (wordmark) and `mark.svg`
  (square mark). Neutral placeholders — swap for the deck's real logos. Copy into
  `source/public/`.
- On **light** backgrounds: use as-is (~20–26px tall in headers/footers).
- On **accent or ink** backgrounds: render white with `filter: brightness(0) invert(1)`.

## Voice

Plain, confident, concise. Short clauses. One idea per bullet. The title states the
takeaway, not the topic ("Ships in half the time" — not "Our value proposition").

## Don't

- ❌ Introduce off-theme colors or a second font.
- ❌ Use the accent as a large fill or background across a content slide.
- ❌ Make body copy bold/black — keep it light (300).
- ❌ Crowd a slide; respect the `slide-margin` (72px) insets and whitespace.
- ❌ Stretch the logo or place the full-color logo on a dark background.
