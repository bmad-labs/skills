/** @type {import('tailwindcss').Config} */
// MTI theme — mirrors references/tailwind-theme.md. primary = MTI green scale,
// accent = MTI yellow, ink neutrals, light surfaces. Do not swap in generic colors.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'mti-green': '#00A73B', 'mti-green-bright': '#00B050', 'mti-green-deep': '#007A2B',
        'mti-yellow': '#FABE00', 'mti-ink': '#221815', 'mti-blue': '#0070C0',
        primary: {
          50: '#E7F6EC', 100: '#C2E9CF', 200: '#8FD8A8', 300: '#57C57F', 400: '#21B459',
          500: '#00A73B', 600: '#009434', 700: '#007A2B', 800: '#005E21', 900: '#005E21', 950: '#003914',
        },
        accent: { 50: '#FFF9E6', 100: '#FFF3CC', 300: '#FDD64D', 500: '#FABE00', 700: '#C99800', 900: '#7A5C00' },
        ink: {
          50: '#F8F7F5', 100: '#F2F0ED', 200: '#E6E2DD', 300: '#CFCAC5', 400: '#ABA6A1',
          500: '#8C8782', 600: '#6B6661', 700: '#46413D', 800: '#2E2A27', 900: '#221815',
        },
        'bg-base': '#FFFFFF', 'bg-card': '#FFFFFF', 'bg-elevated': '#F8F7F5',
        'bg-subtle': '#F2F0ED', 'bg-ink': '#221815', 'bg-accent': '#00A73B',
        'text-primary': '#221815', 'text-secondary': '#6B6661', 'text-muted': '#8C8782',
        'text-inverse': '#FFFFFF', 'text-on-accent': '#FFFFFF',
        'border-subtle': '#E6E2DD', 'border-default': '#CFCAC5', 'border-strong': '#221815', 'border-accent': '#00A73B',
        'status-positive': '#00A73B', 'status-info': '#0070C0', 'status-warning': '#FABE00', 'status-danger': '#D8362A',
      },
      fontFamily: {
        display: ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
        body: ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
        sans: ['"Noto Sans JP"', '"Meiryo"', '"Hiragino Kaku Gothic ProN"', 'Arial', 'system-ui', 'sans-serif'],
      },
      fontWeight: { light: '300', normal: '400', medium: '500', bold: '700', black: '900' },
      fontSize: {
        display: ['64px', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        h1: ['44px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h2: ['32px', { lineHeight: '1.25' }],
        h3: ['24px', { lineHeight: '1.25' }],
        lead: ['22px', { lineHeight: '1.45' }],
        body: ['18px', { lineHeight: '1.45' }],
        small: ['15px', { lineHeight: '1.45' }],
        eyebrow: ['14px', { lineHeight: '1.25', letterSpacing: '0.14em' }],
        footnote: ['11px', { lineHeight: '1.45' }],
      },
      letterSpacing: { tight: '-0.02em', eyebrow: '0.14em' },
      borderRadius: { sm: '4px', md: '8px', lg: '14px', xl: '20px', pill: '999px' },
      boxShadow: {
        sm: '0 1px 2px rgba(34, 24, 21, 0.06)',
        md: '0 4px 14px rgba(34, 24, 21, 0.08)',
        lg: '0 12px 32px rgba(34, 24, 21, 0.12)',
        accent: '0 8px 24px rgba(0, 167, 59, 0.22)',
      },
      spacing: {
        'slide-margin': '72px', 'slide-gutter': '32px',
      },
    },
  },
  plugins: [],
}
