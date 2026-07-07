# MTI house style & layout catalog

Brand rules and the reference layouts. The HTML sources live in
`<skill>/design-system/slides/` — open them to see exact structure, then
reproduce the layout in JSX with the MTI Tailwind tokens
([tailwind-theme.md](tailwind-theme.md)). For *craft* (making a layout impressive,
not just on-brand) see [wow-guide.md](wow-guide.md).

## The layout catalog

> **Picking a layout is a REQUIRED step that starts at the machine index — every time.**
> [`design-system/layouts.csv`](../design-system/layouts.csv) — 446 rows, one per layout
> × style, with `intent`, `use_when`, `content_shape`, `focal_element`, `density`,
> `brand_weight`, `tags`. For each slide you author or redesign you MUST:
> 1. **Query `layouts.csv`** — match the slide's situation (content shape + intent)
>    against `use_when`/`tags`/`intent`. Don't pick from memory or from PNG filenames;
>    the index is the source of truth for what each layout is *for*. (The query snippet
>    is in [workflows/slide-generate.md](workflows/slide-generate.md) step 2.)
> 2. **Review the top candidates** — Read `design-system/slides/<preview>.png` for the
>    2–4 best matches.
> 3. **Decide: use directly, or adapt as reference.** If a row fits, use it. If the
>    slide's situation is a blend (e.g. sequence + KPIs), take the closest rows as
>    *reference* and compose a custom layout from their parts.
> 4. **State the chosen/adapted catalog id(s) and why** before writing JSX.
>
> The table below is the human-readable description of each base family — it's a
> companion to the CSV, not a substitute for querying it.

| # | File | Layout | Use it for |
|---|------|--------|-----------|
| 01 | `01-cover.html` | Cover | Opening / title slide. Logo top-left, doc-kind top-right, big title with one green accent word, lead line, footer meta + green capsule. White with faint green corner blob. |
| 02 | `02-section-divider.html` | Section divider | Full-bleed **green** break between sections. Giant faded index number, yellow dot-trail, white title. |
| 03 | `03-three-column.html` | Three columns | Three peer ideas / pillars / services. Numbered green chips, white cards. |
| 04 | `04-metrics.html` | Metrics / KPI | 3 big-number KPIs with label + one-line context. Green top-rule on each. |
| 05 | `05-agenda.html` | Agenda | Contents / roadmap. Green left rail (logo + title), numbered list on white right. |
| 06 | `06-content-image.html` | Content + image | Bullets left, full-bleed image right. Use for narrative points paired with a photo. |
| 07 | `07-comparison.html` | Comparison | Two columns: neutral "today/option A" vs green "proposed/option B". Before/after, us vs them. |
| 08 | `08-persona.html` | Persona | Dark (`ink-900`) left rail with headshot + attributes; goals/pains/motivations grid on white. |
| 09 | `09-quote.html` | Big quote | Full-bleed pull quote with green emphasis word + attribution. Testimonials, vision statements. |
| 10 | `10-closing.html` | Closing | Full-bleed green sign-off. "Thank you" eyebrow, big title, contact row, yellow dot-trail. |
| 11 | `11-hero-metrics.html` | Hero metrics (showcase) | **Worked "wow" exemplar.** One hero KPI + a highlight-one-bar chart, green-blob depth, accent rule, one `shadow-accent` chip. Read it end-to-end to see [wow-guide.md](wow-guide.md) techniques combined; use it for a single-headline-metric slide. |
| 12 | `12-timeline.html` | Timeline / roadmap | A sequence of phases over time — 4 milestones on a horizontal green track, the past filled green, the future muted. Roadmaps, journeys, "when". |
| 13 | `13-process-flow.html` | Process flow | How something works as ordered steps — 4 numbered white cards joined by green chevrons. Method, stages, pipeline. |
| 14 | `14-comparison-table.html` | Comparison table | Options compared across the same attributes — N×M table with a green header rule, bold first column, green pricing column, zebra rows. Tiers, plans, engagements. (Native-editable-table on export.) |
| 15 | `15-statement.html` | Big statement | One bold claim at `text-display` scale with a single green accent phrase + a short sub. Thesis, manifesto, vision. No data. |
| 16 | `16-problem-solution.html` | Problem → solution | The narrative turn — a dark ink "problem" panel (dash markers) gives way to a light "approach" panel (green checks). Challenge→fix, before→after. |
| 17 | `17-feature-list.html` | Feature list | A capabilities / what's-included list — left intro column, right rows of green icon-chip + headline + one line. Offerings, benefits. |

**Picking layouts for a deck:** match each slide's intent in
[`layouts.csv`](../design-system/layouts.csv) (above). A typical flow:
`01 cover → 05 agenda → 15 statement (thesis) → [02 divider → content] → 16
problem-solution → 13 process-flow / 12 timeline (how) → 14 comparison-table →
04/11 metrics → 09 quote → 10 closing`. Content slides pick from
03/06/07/08/12/13/14/16/17 by whether the point is parallel ideas (03), a sequence
(12), a process (13), a structured comparison (14 table / 07 two-panel), a
problem→solution turn (16), or a feature list (17).

## Brand rules (non-negotiable)

- **Palette:** MTI green/yellow/ink only. Green = brand accent. Yellow = the
  small dot-trail motif **only** (never large fills or text). Ink = text and
  dark surfaces.
- **Font:** Noto Sans JP, everything. Weights: light 300 for lead/body,
  bold 700 for titles, black 900 for hero/index numbers.
- **Icons:** a real SVG icon set — `lucide-react` (default), or Material Symbols /
  Font Awesome as inline `<svg>`. One set per deck, one stroke style, tinted
  `text-primary-500` or ink. **Never Unicode emoji** (🚀📊 = AI slop). Icons export as
  native recolorable PowerPoint shapes (see [pptx-editable.md](pptx-editable.md)).
- **Slides are light and green-forward** by default. The three full-bleed green
  slides (02, 05 rail, 10) and the dark persona rail (08) carry the brand
  weight — don't make every slide green.
- **Eyebrow kickers:** uppercase, green, `text-eyebrow tracking-eyebrow
  font-bold`, sitting above the title.
- **Accent rule:** a short (~56px) green bar under section titles
  (`bg-primary-500 h-1 rounded-pill`).
- **Decorative motif:** the yellow dot-trail (a yellow dot + two faded white
  dots via `box-shadow`) and faint circular blobs in slide corners. Subtle, low
  opacity. Echoes the logo's wave-dots.

## Logo usage

- Asset: `<skill>/design-system/assets/logos/mti-logo-full.svg` (wordmark) and
  `mti-mark.svg` (square mark). Copy into `source/public/`.
- On **white**: use as-is (~20–26px tall in headers/footers).
- On **green or ink** backgrounds: render white with
  `filter: brightness(0) invert(1)`.

## Voice

Plain, confident, concise. Short clauses. One idea per bullet. Title says the
takeaway, not the topic ("Offshore cost, onshore quality" — not "Our value
proposition").

## Don't

- ❌ Introduce non-MTI colors or a second font.
- ❌ Use yellow for text, large fills, or backgrounds.
- ❌ Make body copy bold/black — keep it light (300).
- ❌ Crowd a slide; respect `slide-margin` (72px) insets and whitespace.
- ❌ Stretch the logo or place the full-color logo on a dark background.
