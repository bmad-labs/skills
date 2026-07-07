/** @type {import('tailwindcss').Config} */
// slide-maker theme — reads design-system tokens (CSS vars), not fixed brand hexes.
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
        // Back-compat aliases — existing components reference these utility
        // names (bg-primary-500, text-text-primary, border-border-subtle, …).
        // They resolve through the same CSS-var contract as accent/ink/surface
        // above, so swapping the active theme re-skins every consumer.
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
        body: ['var(--font-sans)'],
        sans: ['var(--font-sans)'],
      },
      fontWeight: { light: '300', normal: '400', medium: '500', bold: '700', black: '900' },
      fontSize: {
        display: ['var(--fs-display)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        h1: ['var(--fs-h1)', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h2: ['var(--fs-h2)', { lineHeight: '1.25' }],
        h3: ['var(--fs-h3)', { lineHeight: '1.25' }],
        lead: ['var(--fs-lead)', { lineHeight: '1.45' }],
        body: ['var(--fs-body)', { lineHeight: '1.45' }],
        small: ['var(--fs-small)', { lineHeight: '1.45' }],
        eyebrow: ['var(--fs-eyebrow)', { lineHeight: '1.25', letterSpacing: '0.14em' }],
        footnote: ['var(--fs-footnote)', { lineHeight: '1.45' }],
      },
      letterSpacing: { tight: '-0.02em', eyebrow: '0.14em' },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)', pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        accent: 'var(--shadow-accent)',
      },
      spacing: {
        'slide-margin': 'var(--slide-margin)', 'slide-gutter': 'var(--slide-gutter)',
      },
    },
  },
  plugins: [],
}
