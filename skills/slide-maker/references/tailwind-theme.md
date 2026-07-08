# Tailwind theme (token-driven)

Drop-in replacement for the `theme.extend` block of a slide generator's
`tailwind.config.js`. It maps the design-system tokens
(`<skill>/design-system/tokens/`) onto the token names slide JSX already uses —
`primary-*`, `accent-*`, `bg-base/card/elevated`, `text-primary/secondary/muted`,
`border-default/subtle`, `font-display`, `font-body` — so every layout idiom renders
on the active design system with no per-slide color picking.

> **This theme resolves to CSS custom properties, not fixed hex values.** Every
> color/type/spacing utility points at a `var(--*)` token defined by the active
> theme file (`design-system/themes/clean-light.css` by default). Swap the active
> theme — or map a user's brand tokens into it — and every consumer re-skins with no
> JSX change. Never hardcode a hex or a font here; edit the token/theme file instead.

## `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
// Reads design-system tokens (CSS vars), not fixed brand hexes.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: 'var(--color-accent)', soft: 'var(--color-accent-soft)' },
        ink: {
          900: 'var(--ink-900)', 700: 'var(--ink-700)', 600: 'var(--ink-600)',
          500: 'var(--ink-500)', 300: 'var(--ink-300)', 200: 'var(--ink-200)',
          100: 'var(--ink-100)', 50: 'var(--ink-50)',
        },
        surface: {
          page: 'var(--surface-page)', card: 'var(--surface-card)',
          subtle: 'var(--surface-subtle)', muted: 'var(--surface-muted)', ink: 'var(--surface-ink)',
        },
        // Back-compat aliases — components reference these utility names
        // (bg-primary-500, text-text-primary, border-border-subtle, …). They resolve
        // through the same CSS-var contract as accent/ink/surface above, so swapping
        // the active theme re-skins every consumer.
        primary: {
          50: 'var(--color-accent-soft)', 100: 'var(--color-accent-soft)', 200: 'var(--color-accent-soft)',
          300: 'var(--color-accent)', 400: 'var(--color-accent)', 500: 'var(--color-accent)',
          600: 'var(--color-accent-bright)', 700: 'var(--color-accent-bright)', 800: 'var(--color-accent-bright)',
          900: 'var(--color-accent-bright)', 950: 'var(--color-accent-bright)',
        },
        'bg-base': 'var(--surface-page)', 'bg-card': 'var(--surface-card)', 'bg-elevated': 'var(--surface-subtle)',
        'bg-subtle': 'var(--surface-muted)', 'bg-ink': 'var(--surface-ink)', 'bg-accent': 'var(--color-accent)',
        'text-primary': 'var(--text-primary)', 'text-secondary': 'var(--text-secondary)', 'text-muted': 'var(--text-muted)',
        'text-inverse': 'var(--text-inverse)', 'text-on-accent': 'var(--text-on-accent)',
        'border-subtle': 'var(--border-subtle)', 'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)', 'border-accent': 'var(--border-accent)',
        'status-positive': 'var(--status-positive)', 'status-info': 'var(--status-info)',
        'status-warning': 'var(--status-warning)', 'status-danger': 'var(--status-danger)',
      },

      fontFamily: {
        display: ['var(--font-display)'],
        body:    ['var(--font-sans)'],
        sans:    ['var(--font-sans)'],
      },

      fontWeight: {
        light: '300', normal: '400', medium: '500', bold: '700', black: '900',
      },

      // Slide type scale (1280×720 frame). Use text-display, text-h1 … text-footnote.
      fontSize: {
        display:  ['var(--fs-display)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        h1:       ['var(--fs-h1)', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h2:       ['var(--fs-h2)', { lineHeight: '1.25' }],
        h3:       ['var(--fs-h3)', { lineHeight: '1.25' }],
        lead:     ['var(--fs-lead)', { lineHeight: '1.45' }],
        body:     ['var(--fs-body)', { lineHeight: '1.45' }],
        small:    ['var(--fs-small)', { lineHeight: '1.45' }],
        eyebrow:  ['var(--fs-eyebrow)', { lineHeight: '1.25', letterSpacing: '0.14em' }],
        footnote: ['var(--fs-footnote)', { lineHeight: '1.45' }],
      },

      letterSpacing: { tight: '-0.02em', eyebrow: '0.14em' },

      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)', pill: 'var(--radius-pill)',
      },

      boxShadow: {
        sm:     'var(--shadow-sm)',
        md:     'var(--shadow-md)',
        lg:     'var(--shadow-lg)',
        accent: 'var(--shadow-accent)',
      },

      spacing: {
        'slide-margin': 'var(--slide-margin)',   // 72px
        'slide-gutter': 'var(--slide-gutter)',   // 32px
      },
    },
  },
  plugins: [],
};
```

## Fonts

On-screen the deck uses a **system font stack** (`--font-sans` — no network fetch).
Link the design system's stylesheet so the tokens (including `--font-*`) are in scope:

```css
@import url('../design-system/styles.css');   /* pulls tokens + the active theme */
```

If the active design system supplies its own webfont, add its `@import` (or `<link>`)
and point `--font-sans` / `--font-display` at it inside the theme file — never in the
slide JSX. The editable-PPTX exporter embeds **Inter** (SIL OFL) so the output renders
consistently on machines that lack the deck's fonts.

## Quick usage map

| Want | Class |
|------|-------|
| Accent text / fill | `text-primary-500` / `bg-primary-500` |
| Accent section / closing slide | `bg-primary-500 text-text-inverse` |
| Dark (persona) panel | `bg-ink-900 text-text-inverse` |
| Body copy | `text-text-secondary text-body font-light` |
| Slide title | `text-h1 font-bold tracking-tight` |
| Eyebrow kicker | `text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500` |
| Card | `bg-bg-card border border-border-subtle rounded-lg shadow-sm` |
| Small accent dot motif | `bg-accent rounded-pill` (small only) |

## Chart & data palette

Charts have no token "names" — they take raw hex. To keep every chart on-theme, use
**one ordered series array** as the single source of truth. Series 1 is always the
active accent (the "our" / primary series); later series are neutral steps so the data
leads and the accent stays the highlight.

```js
// Data series order — accent is always series 1 ("our"/primary series).
export const SERIES = ['#4F46E5', '#0EA5E9', '#64748B', '#94A3B8', '#334155', '#A5B4FC'];
// = accent (indigo), sky, slate-500, slate-400, slate-700, indigo-300
```

> These hexes mirror the clean-light theme's accent + neutral scale. If the active
> theme changes the accent, regenerate this array from the theme's accent + neutrals.
> `check-slop.mjs` reads this `SERIES = [...]` line as the allowed chart palette.

**Chart chrome** (keep it quiet so the data leads):
- Axes & gridlines: `#E2E8F0` (`border-subtle`), 1px, low weight. No heavy or 3D gridlines.
- Labels / ticks: `text-muted` (`#64748B`) at `text-small`/12px.
- Area fill under an accent line: `#EEF2FF` (accent-soft).
- Highlight-one-bar pattern: the focus bar `#4F46E5`, the rest muted `#E2E8F0`.

`references/wow-guide.md` §2 has the SVG bar/line/KPI snippets that consume this.

## A note on glass

The house look is **light and clean**, not dark-glass. Prefer the card recipe
`bg-bg-card border border-border-subtle shadow-sm` for surfaces. Do **not** use a
generator's dark `glass` class (dark translucent panel — wrong on a light deck).
`glass-light` is acceptable **only** as a caption plate over a photo
(`bg-white/70 backdrop-blur` on an image); everywhere else, use real cards.
