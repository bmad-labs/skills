/*
  EXAMPLE / showcase slide — copy this shape for real slides.

  Demonstrates the wow-guide techniques: eyebrow → title → accent rule rhythm, ONE
  hero KPI (count-up), a highlight-one-bar chart in the deck's data palette, the
  accent chip (the one shadow-accent element).

  EVERY element carries a dotted data-viz-id (s0.title, s0.kpi.value, …) so edit
  mode can select it. When you add a slide, annotate ALL its meaningful nodes the
  same way — an untagged node can't be selected on its own.

  STRUCTURE: this short hero slide flows fine as-is. But for any slide WITH A FOOTER
  or dense content, build it as the 3-LAYER SKELETON so content can never overflow
  into the footer (the #1 layout bug):
    <div className="slide-page flex flex-col">
      <header className="shrink-0"> eyebrow + title + rule </header>
      <div className="flex-1 min-h-0 …"> content band (columns: items-stretch) </div>
      <footer className="shrink-0 mt-4 …"> brand · page </footer>
    </div>
  Size by layout (items-stretch / min-h-0 / preserveAspectRatio) — NEVER a fixed
  height:Npx. Full skeleton + recipes: references/visual-review.md → "The 3-layer
  slide skeleton".
*/
import { StaggerContainer, StaggerItem, CountUp, AccentRule } from '@/components/SlideTransition';

// Deck data palette — the accent color is always series 1 (see references/tailwind-theme.md).
const BARS = [
  { label: 'Q1', v: 42, hi: false },
  { label: 'Q2', v: 55, hi: false },
  { label: 'Q3', v: 61, hi: false },
  { label: 'Q4', v: 78, hi: true },
];

export default function HeroMetrics() {
  const max = 80, H = 220, W = 480, bw = 64, gap = 40;
  return (
    <div className="slide-page" data-viz-id="s0">
      {/* rhythm: eyebrow → title → rule */}
      <span data-viz-id="s0.eyebrow"
        className="text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500">
        Adoption
      </span>
      <h1 data-viz-id="s0.title"
        className="mt-3 text-h1 font-bold tracking-tight text-text-primary max-w-[760px]">
        Seventy percent adopt it in <span data-viz-id="s0.title.accent" className="text-primary-500">week one</span>
      </h1>
      <AccentRule className="mt-5" data-viz-id="s0.rule" />

      <div className="slide-content mt-10 grid grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        {/* hero KPI */}
        <div data-viz-id="s0.hero" className="flex items-end gap-6">
          <CountUp to={70} suffix="%" className="text-[120px] font-display font-black tracking-tight leading-none text-primary-500"
            data-viz-id="s0.kpi.value" />
          <div className="mb-3 max-w-[320px]" data-viz-id="s0.kpi.caption">
            <p data-viz-id="s0.kpi.label" className="text-h3 font-bold text-text-primary">Weekly active use</p>
            <p data-viz-id="s0.kpi.desc" className="mt-2 text-body font-light text-text-secondary">
              Target adoption across the audience inside the first quarter.
            </p>
          </div>
        </div>

        {/* supporting chart — highlight-one-bar, quiet chrome */}
        <div data-viz-id="s0.chart"
          className="bg-bg-card border border-border-subtle rounded-lg shadow-sm p-6">
          <div data-viz-id="s0.chart.label"
            className="text-eyebrow tracking-eyebrow uppercase font-bold text-text-muted mb-4">
            Adoption by quarter
          </div>
          <svg viewBox={`0 0 ${W} ${H + 32}`} className="w-full" role="img" aria-label="Adoption rising to 78% in Q4">
            <line x1="0" y1={H} x2={W} y2={H} stroke="var(--ink-200)" strokeWidth="1" />
            {BARS.map((b, i) => {
              const h = (b.v / max) * H, x = i * (bw + gap) + 20;
              return (
                <g key={b.label}>
                  <rect x={x} y={H - h} width={bw} height={h} rx="4" fill={b.hi ? 'var(--color-accent)' : 'var(--ink-200)'} />
                  <text x={x + bw / 2} y={H + 20} textAnchor="middle" fill="var(--ink-500)" style={{ fontSize: '12px' }}>{b.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* footer: logo placeholder + the one shadow-accent chip */}
      <StaggerContainer className="flex items-center justify-between mt-auto">
        <StaggerItem data-viz-id="s0.footer.brand"
          className="text-small font-bold tracking-eyebrow uppercase text-text-muted">
          Your Company
        </StaggerItem>
        <StaggerItem data-viz-id="s0.footer.chip"
          className="bg-primary-500 text-text-on-accent text-small font-bold rounded-pill px-5 py-2 shadow-accent">
          +12 pts vs last year
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
