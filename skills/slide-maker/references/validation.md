# Validate before you ship — catching AI slop

[wow-guide.md](wow-guide.md) is the ceiling (how to be impressive).
`scripts/check-slop.mjs` is the **floor** — a mechanical check that fails loud when
a generated slide drifts off-brand or into slop. Run it on every slide you produce,
**before** the visual / browser review.

## Run it

```bash
# from inside a copied deck:
node scripts/check-slop.mjs src/slides/*.jsx [--format html|jsx|auto] [--json]
# or from the skill, against slides elsewhere:
node <skill>/deck-template/scripts/check-slop.mjs <file...>
```

- Point it at the slide HTML (plain-HTML decks) or the slide JSX. Format
  auto-detects by extension.
- **Exit code is non-zero if any ERROR fired** — wire it into your build/verify
  step so slop can't slip through. WARN lines report but don't fail.
- Allowlists load from the design source of truth at runtime: the skill's
  `design-system/tokens/colors.css` (+ `references/tailwind-theme.md` for the
  `SERIES` chart palette) when present; in a standalone deck clone (no
  `design-system/`), it falls back to the deck's `tailwind.config.js` — either way
  the checker tracks the active theme's palette.

Example (inside a deck):
```bash
node scripts/check-slop.mjs src/slides/*.jsx
```

## What it checks

### ERRORs (hard slop — fix these, the build fails)

| Check | Why it's slop | Fix |
|-------|---------------|-----|
| Raw hex (`#ff0000`, …) not in the token set | style via tokens, never literal hex | use a `var(--*)` token (HTML) / mapped class (JSX) |
| Off-theme font (`Inter`, `Sora`, `Roboto`, …) | on-screen the deck uses the active theme font (system stack) only; Inter is embedded only in the PPTX export | `font-display` / `--font-sans` |
| Generic Tailwind color (`text-blue-500`, `bg-gray-100`, …) | bypasses the theme | `primary-*` / `ink-*` / `text-text-*` / `bg-bg-*` |
| Dark `glass` class | dark-glassmorphism is off-theme on a light deck | `bg-bg-card border border-border-subtle shadow-sm` |
| `min-h-screen` / `h-screen`, stray `h-full` | breaks the slide frame | remove; `slide-page` sizes the slide |
| Off-palette color inside a chart | charts must use the theme series | a color from `SERIES` + `#E2E8F0`/`#EEF2FF` chrome |

### WARNs (craft — report, your judgement)

| Check | Signal |
|-------|--------|
| > 110 / > 150 words on a slide | wall of text — split it |
| > 6 bullets in one list | cut or split |
| No element at hero scale (≥56px / `text-display` / `font-black`) | flat hierarchy, no focal point |
| Title without eyebrow or accent rule | broken eyebrow→title→rule→body rhythm |
| Accent used as a large fill or wash | the accent is a highlight, not a background |
| > 3 images on a slide | composition overload |

The checker is deliberately conservative — every ERROR is real. The premade
templates (`design-system/slides/*.html`) all pass with zero findings; they are the
regression baseline. If the checker ever flags a template, the checker is wrong.

## The AI-slop tells — self-catch before you even run it

The script catches mechanical drift; YOU catch these. If a slide has any of them,
it reads as generic AI output:

- **Generic gradients** — purple/blue glows, rainbow fills. Depth = accent-soft
  blobs + soft shadows (wow-guide §3), nothing neon.
- **Everything centered** — centered title, centered body, centered everything.
  Use the asymmetric rhythm: left-aligned eyebrow→title→rule.
- **Even visual weight** — no focal point; every element the same size. Pick ONE
  hero (wow-guide §1).
- **Walls of text** — paragraphs where bullets belong, bullets where one line
  belongs. Cut to the takeaway (wow-guide §5).
- **Font soup** — a second typeface "for contrast." One family only; contrast
  via weight, not family.
- **Decorative-but-meaningless motion** — spin, bounce, glow loops. Motion is
  reveal / count / draw, then still (wow-guide §4).
- **Emoji as icons** — 🚀📊✅ in a slide reads as instant AI slop. **Never use Unicode
  emoji as icons.** Use a real SVG icon set: `lucide-react` (the default), or Material
  Symbols / Font Awesome (inline `<svg>`). They tint to brand and export as native,
  recolorable PowerPoint shapes (see [pptx-editable.md](pptx-editable.md) — *icons →
  CustomGeometry*); emoji do neither.
- **Clip-art / mismatched icons** — keep ONE icon set and one stroke style, tint them
  `text-primary-500` or ink. Don't mix lucide + Material + FA on one deck.
- **Stock-photo dump** — raw color photos clashing with the theme.
  Duotone them (wow-guide §6, snippet 5E).

Floor (this script) + ceiling (wow-guide) + a human "does it make me go *wow*?" =
slides people remember.
