# MTI Tailwind theme

Drop-in replacement for the `theme.extend` block of the slides-generator
template's `source/tailwind.config.js`. It maps the MTI tokens
(`<skill>/design-system/tokens/`) onto the exact token names slides-generator's
slide JSX already uses — `primary-*`, `accent-*`, `bg-base/card/elevated`,
`text-primary/secondary/muted`, `border-default/subtle`, `font-display`,
`font-body` — so every layout idiom it knows renders on-brand with no per-slide
color picking.

> Hex values mirror `tokens/colors.css`. If you edit the tokens, regenerate this.

## `source/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Brand core ----
        'mti-green':        '#00A73B',
        'mti-green-bright': '#00B050',
        'mti-green-deep':   '#007A2B',
        'mti-yellow':       '#FABE00',
        'mti-ink':          '#221815',
        'mti-blue':         '#0070C0',

        // ---- primary-* → MTI green scale (the brand accent) ----
        primary: {
          50:  '#E7F6EC',
          100: '#C2E9CF',
          200: '#8FD8A8',
          300: '#57C57F',
          400: '#21B459',
          500: '#00A73B',
          600: '#009434',
          700: '#007A2B',
          800: '#005E21',
          900: '#005E21',
          950: '#003914',
        },

        // ---- accent-* → MTI yellow (use sparingly: dots, small marks) ----
        accent: {
          50:  '#FFF9E6',
          100: '#FFF3CC',
          300: '#FDD64D',
          500: '#FABE00',
          700: '#C99800',
          900: '#7A5C00',
        },

        // ---- ink / neutral scale ----
        ink: {
          50:  '#F8F7F5',
          100: '#F2F0ED',
          200: '#E6E2DD',
          300: '#CFCAC5',
          400: '#ABA6A1',
          500: '#8C8782',
          600: '#6B6661',
          700: '#46413D',
          800: '#2E2A27',
          900: '#221815',
        },

        // ---- surfaces (light, green-forward house style) ----
        'bg-base':     '#FFFFFF',
        'bg-card':     '#FFFFFF',
        'bg-elevated': '#F8F7F5',
        'bg-subtle':   '#F2F0ED',
        'bg-ink':      '#221815',
        'bg-accent':   '#00A73B',

        // ---- text ----
        'text-primary':    '#221815',
        'text-secondary':  '#6B6661',
        'text-muted':      '#8C8782',
        'text-inverse':    '#FFFFFF',
        'text-on-accent':  '#FFFFFF',

        // ---- borders ----
        'border-subtle':   '#E6E2DD',
        'border-default':  '#CFCAC5',
        'border-strong':   '#221815',
        'border-accent':   '#00A73B',

        // ---- status ----
        'status-positive': '#00A73B',
        'status-info':     '#0070C0',
        'status-warning':  '#FABE00',
        'status-danger':   '#D8362A',
      },

      fontFamily: {
        display: ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
        body:    ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
        sans:    ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
      },

      fontWeight: {
        light: '300', normal: '400', medium: '500', bold: '700', black: '900',
      },

      // Slide type scale (1280×720 frame). Use text-display, text-h1 … text-footnote.
      fontSize: {
        display:  ['64px', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        h1:       ['44px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h2:       ['32px', { lineHeight: '1.25' }],
        h3:       ['24px', { lineHeight: '1.25' }],
        lead:     ['22px', { lineHeight: '1.45' }],
        body:     ['18px', { lineHeight: '1.45' }],
        small:    ['15px', { lineHeight: '1.45' }],
        eyebrow:  ['14px', { lineHeight: '1.25', letterSpacing: '0.14em' }],
        footnote: ['11px', { lineHeight: '1.45' }],
      },

      letterSpacing: {
        tight:   '-0.02em',
        eyebrow: '0.14em',
      },

      borderRadius: {
        sm: '4px', md: '8px', lg: '14px', xl: '20px', pill: '999px',
      },

      boxShadow: {
        sm:     '0 1px 2px rgba(34, 24, 21, 0.06)',
        md:     '0 4px 14px rgba(34, 24, 21, 0.08)',
        lg:     '0 12px 32px rgba(34, 24, 21, 0.12)',
        accent: '0 8px 24px rgba(0, 167, 59, 0.22)',
      },

      spacing: {
        // 4px base scale → matches tokens/spacing.css
        '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '20px',
        '6': '24px', '8': '32px', '10': '40px', '12': '48px', '16': '64px', '20': '80px',
        'slide-margin': '72px',
        'slide-gutter': '32px',
      },
    },
  },
  plugins: [],
};
```

## Fonts

Add the brand font import to the top of `source/src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap');
```

or the `<link>` equivalent in `source/index.html`.

## Quick usage map

| Want | Class |
|------|-------|
| Brand green text / fill | `text-primary-500` / `bg-primary-500` |
| Green section / closing slide | `bg-primary-500 text-text-inverse` |
| Dark (persona) panel | `bg-ink-900 text-text-inverse` |
| Body copy | `text-text-secondary text-body font-light` |
| Slide title | `text-h1 font-bold tracking-tight` |
| Eyebrow kicker | `text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500` |
| Card | `bg-bg-card border border-border-subtle rounded-lg shadow-sm` |
| Yellow dot motif | `bg-mti-yellow rounded-pill` (small only) |

## Chart & data palette

Charts have no token "names" — they take raw hex. To keep every chart on-brand,
use **one ordered series array** as the single source of truth. Series 1 is always
MTI green (the "our" / brand series); yellow only ever appears as the 3rd series or
a single highlight — never the dominant fill.

```js
// MTI data series order — green is always series 1 ("our"/brand series).
export const MTI_SERIES = ['#00A73B', '#0070C0', '#FABE00', '#ABA6A1', '#8FD8A8', '#6B6661'];
// = primary-500, mti-blue, accent-500/yellow, ink-400, primary-200, ink-600
```

**Chart chrome** (keep it quiet so the data leads):
- Axes & gridlines: `#E6E2DD` (`border-subtle`), 1px, low weight. No heavy or 3D gridlines.
- Labels / ticks: `text-muted` (`#8C8782`) at `text-small`/12px.
- Area fill under a green line: `#E7F6EC` (`green-50`).
- Highlight-one-bar pattern: the focus bar `#00A73B`, the rest muted `#E6E2DD`.

`references/wow-guide.md` §2 has the SVG bar/line/KPI snippets that consume this.

## A note on glass

MTI is **light corporate**, not dark-glass. Prefer the card recipe
`bg-bg-card border border-border-subtle shadow-sm` for surfaces. Do **not** use a
generator's dark `glass` class (dark translucent panel — wrong on a light deck).
`glass-light` is acceptable **only** as a caption plate over a photo
(`bg-white/70 backdrop-blur` on an image); everywhere else, use real cards.
