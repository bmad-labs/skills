# Craft guide — make it wow

Companion to [house-style.md](house-style.md) (the layout catalog) and
[tailwind-theme.md](tailwind-theme.md) (the token mapping). House-style stops you
being **off-theme**; this guide stops you being **boring**. Everything here uses
ONLY tokens already mapped in tailwind-theme.md — no invented colors, no new font.

**"Wow" = refinement, not fireworks.** It is premium polish: one decisive focal point, a
dramatic type scale, accent-on-white depth, calm motion, and generous whitespace. It is
**never** the dark-glassmorphism / neon-glow / generic-sans look a generic slide generator
defaults to. Keep `font-display` (the active theme font) and light backgrounds. When a
generic instinct says "add a glow," the answer is "remove something instead."

Run [validation.md](validation.md)'s `check-slop.mjs` on your output before you
ship — this guide is the ceiling, that script is the floor.

---

## 0. The wow mindset

- **One slide = one idea = one focal point.** If you can't name the single thing
  the eye should land on first, the slide isn't done.
- **Whitespace is the luxury signal.** Crowding reads as cheap. Empty space reads
  as confidence.
- **Depth comes from layered accent blobs + soft shadows** — not glass, not glow.
- **Motion is calm and purposeful** (reveal, count, draw). It guides the eye to
  the hero, then stops. Never bouncy, never decorative-for-its-own-sake.

---

## 1. Visual hierarchy — the hero treatment

Every slide needs ONE dominant element: a KPI, a chart, a quote, a single number,
or an accent-word title. Everything else must visibly recede.

- **Dramatic size jump.** Hero at `text-display` (64px) or a custom 84–120px
  number; body at `text-body` (18px). No timid 1.3× steps — the gap should be
  obvious across the room.
- **Color focus.** The hero carries `primary-500` (or one accent word in
  `primary-500`); support text stays `text-text-secondary` / `text-text-muted`.
  Never two competing accents at hero scale.
- **Elevation focus.** If the hero sits in a card, that card gets `shadow-accent`
  — and it is the **only** element on the slide with `shadow-accent`. Support
  cards get `shadow-sm`.
- **Weight.** `font-black` (900) is reserved for hero numbers and section index
  numbers. Titles are `font-bold` (700). Body is `font-light` (300).

→ snippet **5A**.

---

## 2. Data visualization on-theme

### The ordered data palette

Defined once in [tailwind-theme.md](tailwind-theme.md) as `SERIES`:

```
['#4F46E5', '#0EA5E9', '#64748B', '#94A3B8', '#334155', '#A5B4FC']
  accent    sky        slate-500  slate-400  slate-700  indigo-300
```

Use this order. **The accent is always series 1** (the "our" / primary series). Later
series are neutral steps — never a second bright color competing with the accent.

### Which chart (decision rules)

| You have | Use |
|----------|-----|
| 1–3 numbers | **Not a chart** — a KPI treatment (see below). |
| A trend over time | Line or area: single `#4F46E5` line, `#EEF2FF` (accent-soft) area fill. |
| Categories to compare | Vertical bars in `#4F46E5`; highlight the key bar, mute the rest to `#E2E8F0`. |
| Part-to-whole, ≤ 4 parts | Donut using `SERIES` in order. |
| Part-to-whole, > 4 parts | Ranked horizontal bar, **not** a pie. |
| Dense tabular facts | A table with a `primary-500` header rule — not a chart. |

> **Export bonus:** a chart built from real data values (vs. a hand-drawn decorative
> SVG) becomes a *native, editable* PowerPoint chart on export — viewers can "Edit Data
> in Excel". Same for tables. Build data as data. See
> [pptx-editable.md → Author for clean export](pptx-editable.md).

### KPI treatments (beyond a plain big number)

- **Number + accent top-rule** — the layout-04 idiom (`border-t-[3px] border-primary-500`).
- **Number + sparkline** — a small `primary-500` path beside the value.
- **Number + delta chip** — `status-positive` (#16A34A) up / `status-danger`
  (#DC2626) down.
- **Number + radial ring** — `primary-500` stroke on an `#E2E8F0` track.

All on `bg-bg-card shadow-sm`; the single headline KPI gets `shadow-accent`.

### Chart chrome

Axes & gridlines `#E2E8F0` at 1px; labels `text-text-muted` at `text-small`. No
3D, no heavy gridlines, no drop shadows on bars. Let the data lead.

→ snippets **5B**.

---

## 3. Depth & atmosphere — in the LIGHT idiom

### The blob system

One or two off-canvas circles, low opacity, in the slide's background layer
(`absolute inset-0 pointer-events-none overflow-hidden` — the same structure
`slide-page` already uses for its bg layer).

- On white slides: `bg-primary-50` blobs (optionally a fainter `bg-primary-100/40`).
- On accent/ink slides: `bg-white/[0.07]`.
- Always bleed a blob off an edge; **never** center one behind text.

### Gradient washes (subtle only)

An `accent-soft → white` vertical wash behind content, or on a dark/accent slide an
`ink-900 → ink-800` gradient for richness. Never a rainbow, never neon.

### Shadow elevation ladder — when to use which

| Token | Use for |
|-------|---------|
| `shadow-sm` | Default resting cards, table containers. |
| `shadow-md` | A hovered card, or one you want slightly forward. |
| `shadow-lg` | A single floating panel (image inset, modal-like callout). |
| `shadow-accent` | **The hero element only — one per slide.** |

### Whitespace as atmosphere

Keep the `slide-margin` (72px) insets sacred. Aim for **≥ 40% empty area** on hero
slides. Crowding kills wow faster than any color mistake.

→ snippet **5D**.

---

## 4. Motion — restrained

The deck ships **two** animation libraries; pick by the job, keep the calm idiom
either way (short durations, `power2.out` / `easeOut`, **no bounce**).

### framer-motion — simple declarative bits

Use for the common cases via the `SlideTransition.jsx` helpers:

- **Stagger reveal** — container `staggerChildren: 0.08–0.1`; items fade + rise
  (`opacity 0→1`, `y 12→0`), `duration 0.5`, `ease: 'easeOut'`. For bullet lists,
  KPI rows, card grids. (`<StaggerContainer>` / `<StaggerItem>`.)
- **Count-up KPIs** — `<CountUp>` (`useSpring`, `bounce: 0`, ~0.8s). Pairs with §1.
- **Accent-rule / line draw-in** — `<AccentRule>` (`scaleX 0→1`) or `pathLength 0→1`,
  `duration 0.6`. For the accent rule under titles and for chart lines / sparklines.
- **Subtle hover** — `whileHover={{ scale: 1.02 }}` on cards.

### GSAP — timeline / sequenced choreography

Reach for GSAP when you need **ordered, chained, or coordinated** motion that
framer's per-element declarations make awkward: a build-on sequence (title → rule →
cards → KPI, each keyed off the last), a draw-on SVG path, or multi-element
timelines. Use the `useSlideGsap` hook — it scopes the timeline to the slide and
**auto-cleans up on slide exit** (slides mount/unmount via AnimatePresence, so
manual GSAP tweens would otherwise leak / replay wrong on revisit):

```jsx
import { useSlideGsap } from '@/components/SlideTransition';

function Slide() {
  const ref = useSlideGsap((tl) => {           // tl: calm defaults (power2.out, 0.5s)
    tl.from('[data-viz-id="s2.title"]', { y: 16, opacity: 0 })
      .from('[data-viz-id="s2.rule"]',  { scaleX: 0, transformOrigin: 'left' }, '-=0.2')
      .from('.card', { y: 12, opacity: 0, stagger: 0.08 }, '-=0.1');
  });
  return <div ref={ref} className="slide-page" data-viz-id="s2"> … </div>;
}
```

Selectors inside the build fn are scoped to the slide ref. `gsap` and `useGSAP` are
re-exported from `SlideTransition.jsx` for advanced needs.

**Don't mix the two on the same element** (both fighting one transform = jank) —
animate a given element with one library, not both.

### Avoid (both libraries)

- No bouncy spring on text, no overshoot / wobble, no rotate-in, no flip.
- No neon pulse or glow loops.
- No animating `width` / `height` / `blur` (janky + off-brand).
- Don't animate everything. Motion guides the eye to the hero, then stops.

→ snippet **5C**.

---

## 5. Density & composition (word budgets)

- **Title ≤ 8 words** — and it states the *takeaway*, not the topic.
- **Lead / subtitle ≤ ~25 words.**
- **Bullets:** max 5 per slide, each ≤ ~12 words, one idea each.
- **KPI row:** max 3. **Card grid:** max 4 (2×2) before you split.
- **Line length:** body / lead `max-width` ~640–720px (≈ 60–70 characters). Never
  run text the full 1280px width.
- **Whitespace ratio:** ≥ 35–40% empty on content slides; more on hero/cover.
- **When to split:** if it needs > 5 bullets, > 4 cards, or carries two ideas —
  make two slides.

---

## 6. Imagery

- **Full-bleed vs inset.** Full-bleed (the layout-06 right column, or a cover
  band) for atmosphere; an inset card (`rounded-lg shadow-lg`) when the image is a
  discrete artifact like a screenshot.
- **Accent-overlay duotone** keeps any stock photo on-theme: desaturate, then lay a
  `primary-500` tint at `mix-blend-multiply`. See snippet **5E**.
- **Seam treatment.** Where a half-bleed image meets content, an inner shadow on
  the seam (the layout-06 idiom) makes the split read as intentional.
- **Cropping.** Put the subject off-center toward the *outer* edge; leave breathing
  room on the side that faces the text.

→ snippet **5E**.

---

## 7. Typography craft

### The vertical rhythm

Always in this order, with ~`space-3` to `space-5` between steps:

```
eyebrow    →  text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500
title      →  text-h1 (or text-display) font-bold tracking-tight
accent rule →  h-1 w-14 rounded-pill bg-primary-500
body       →  text-body (or text-lead) font-light text-text-secondary
```

### Display 64 vs h1 44

`text-display` (64px) only for cover / section hero and single-idea focal slides.
`text-h1` (44px) for normal content-slide titles. Never two `text-display`
elements on one slide.

### Accent-word-in-title

Wrap exactly ONE meaningful word in `<span className="text-primary-500">` (the
cover idiom). One accent word per title, maximum.

### Weight discipline

Body stays `font-light` (300) — never bold or black body copy. Black (900) is for
hero numbers and section index numbers only.

### Measure

Enforce `max-w-*` on every text block (see §5). Unmeasured text is the single most
common "looks like a document, not a slide" tell.

---

## 8. The anti-boring checklist + good-vs-bad copy

Before a slide is done:

- [ ] ONE hero element dominates; I can name what the eye lands on first.
- [ ] Hero→body size jump is dramatic; body is `font-light`, `text-secondary`.
- [ ] eyebrow → title → accent rule → body rhythm is present (where there's a title).
- [ ] Title ≤ 8 words and states the takeaway; ≤ 5 bullets.
- [ ] ≥ ~35% of the slide is whitespace; text blocks are measured (`max-w`).
- [ ] Depth via an accent-soft blob/wash + the shadow ladder; `shadow-accent` on the hero ONLY.
- [ ] 1–3 numbers → KPI, not a chart. Charts use `SERIES` (accent = series 1).
- [ ] Motion is calm (stagger / count-up / draw-in). No bounce, no glow.
- [ ] Active theme font + light background kept. No dark `glass`, no generic Tailwind colors.
- [ ] The accent appears sparingly, never as a large fill across a content slide.

### Good-vs-bad titles

| Boring (topic) | Wow (takeaway) |
|----------------|----------------|
| "Our Value Proposition" | "Offshore cost, onshore quality" |
| "Key Metrics" | "70% adopt it in week one" |
| "Introduction" | a one-line statement of the point |
| "Q4 Results" | "Revenue up 40%, churn halved" |

### Good-vs-bad slide

- **Boring:** 6 bullets of 20 words each, every line the same size, logo + title +
  wall of text, no focal point. Technically on-brand, completely flat.
- **Wow:** one 96px `primary-500` KPI as the hero, three muted supporting stats
  that stagger in and count up, an accent-soft blob bleeding off the corner, the accent
  rule drawing in under an 8-word takeaway title, 40% whitespace.

---

## Snippets

All use real mapped names from [tailwind-theme.md](tailwind-theme.md). The
`text-text-*`, `bg-bg-*`, `border-border-*` forms are correct (the color *keys*
are `text-primary`, `bg-card`, `border-subtle`, so the *utilities* double the
prefix).

### 5A — Hero KPI moment

```jsx
<div className="slide-content relative z-10 flex flex-col justify-center">
  <span className="text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500">
    Adoption
  </span>
  <div className="mt-3 flex items-end gap-6">
    <span className="font-display font-black tracking-tight leading-none text-primary-500"
          style={{ fontSize: '120px' }}>
      70<span className="text-text-primary">%</span>
    </span>
    <div className="mb-4 max-w-[360px]">
      <p className="text-h3 font-bold text-text-primary">Weekly active use</p>
      <p className="mt-2 text-body font-light text-text-secondary">
        Target adoption across the audience within the first quarter.
      </p>
    </div>
  </div>
  <div className="mt-6 h-1 w-14 rounded-pill bg-primary-500" />
</div>
```

This single 120px number IS the slide. If it sits inside a card, that card — and
nothing else — gets `shadow-accent`.

### 5B — On-theme SVG charts (no chart library)

Bar chart, highlight one bar, mute the rest:

```jsx
const bars = [{ label: 'Q1', v: 42 }, { label: 'Q2', v: 55 },
              { label: 'Q3', v: 61 }, { label: 'Q4', v: 78 }];
const max = 80, H = 220, W = 480, bw = 64, gap = 40;

<svg viewBox={`0 0 ${W} ${H + 32}`} className="w-full">
  <line x1="0" y1={H} x2={W} y2={H} stroke="#E2E8F0" strokeWidth="1" />
  {bars.map((b, i) => {
    const h = (b.v / max) * H, x = i * (bw + gap) + 20;
    const fill = i === bars.length - 1 ? '#4F46E5' : '#E2E8F0';  // highlight last
    return (
      <g key={b.label}>
        <rect x={x} y={H - h} width={bw} height={h} rx="4" fill={fill} />
        <text x={x + bw / 2} y={H + 20} textAnchor="middle"
              className="fill-text-muted" style={{ fontSize: '12px' }}>{b.label}</text>
      </g>
    );
  })}
</svg>
```

Line chart with accent-soft area and draw-in:

```jsx
const pts = [12, 28, 24, 40, 52, 68];               // y-values, 0..72
const W = 480, H = 200, step = W / (pts.length - 1);
const d = pts.map((v, i) => `${i ? 'L' : 'M'}${i * step},${H - (v / 72) * H}`).join(' ');
const area = `${d} L${W},${H} L0,${H} Z`;

<svg viewBox={`0 0 ${W} ${H}`} className="w-full">
  <path d={area} fill="#EEF2FF" />                  {/* accent-soft wash */}
  <motion.path d={d} fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round"
    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
    transition={{ duration: 0.8, ease: 'easeOut' }} />
</svg>
```

A second series uses `#0EA5E9` (sky), a third `#64748B` (slate) — straight from
`SERIES`.

### 5C — Stagger + count-up metrics

```jsx
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

function CountUp({ to, suffix = '' }) {
  const s = useSpring(0, { duration: 800, bounce: 0 });   // bounce:0 = calm
  const shown = useTransform(s, v => Math.round(v));
  useEffect(() => { s.set(to); }, [to]);
  return (
    <span className="font-display font-black tracking-tight text-text-primary">
      <motion.span>{shown}</motion.span>{suffix}
    </span>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 12 },
               show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };

<motion.div variants={container} initial="hidden" animate="show"
  className="grid grid-cols-3 gap-8">
  {kpis.map(k => (
    <motion.div key={k.label} variants={item}
      className="bg-bg-card rounded-lg shadow-sm pt-6 border-t-[3px] border-primary-500">
      <div className="text-[56px] leading-none"><CountUp to={k.value} suffix={k.suffix} /></div>
      <p className="mt-4 text-body font-medium text-text-primary">{k.label}</p>
      <p className="mt-1 text-small font-light text-text-secondary">{k.desc}</p>
    </motion.div>
  ))}
</motion.div>
```

### 5D — Accent-blob atmospheric background layer

```jsx
{/* absolute bg layer — matches slide-page structure; sits behind z-10 content */}
<div className="absolute inset-0 pointer-events-none overflow-hidden">
  <div className="absolute rounded-full bg-primary-50"
       style={{ width: 560, height: 560, right: -120, bottom: -140 }} />
  <div className="absolute rounded-full bg-primary-100/40"
       style={{ width: 320, height: 320, left: -100, top: -120 }} />
  {/* small accent dot motif (a single small mark only) */}
  <div className="absolute" style={{ left: 72, bottom: 72 }}>
    <div className="h-3 w-3 rounded-pill bg-accent
                    shadow-[22px_0_0_rgba(255,255,255,0.55),44px_0_0_rgba(255,255,255,0.3)]" />
  </div>
</div>
```

On an accent slide, swap the blobs for white at low opacity:
`bg-white/[0.07]`.

### 5E — Duotone / accent-overlay image

```jsx
<div className="relative h-full overflow-hidden rounded-lg shadow-lg">
  <img src="/images/team.jpg" alt="" className="h-full w-full object-cover grayscale" />
  {/* accent tint via multiply → on-theme duotone */}
  <div className="absolute inset-0 bg-primary-500 mix-blend-multiply opacity-45" />
  {/* seam shadow toward the content side */}
  <div className="absolute inset-0"
       style={{ boxShadow: 'inset 14px 0 28px -18px rgba(15,23,42,0.4)' }} />
</div>
```
