# Slide Design Principles

> This is a design principles reference for subagents when generating slide pages

## Tech Stack

- **Framework**: React (functional components)
- **Styling**: Tailwind CSS
- **Icons**: lucide-react

## Theme Color Variables

All colors must use Tailwind theme variables, do not hardcode color values:

```
Primary Colors:
- primary-50 ~ primary-950 (primary color gradient)
- accent-50 ~ accent-950 (accent color gradient)

Background Colors:
- bg-base      dark background main color
- bg-card      card background
- bg-elevated  elevated layer background

Text Colors:
- text-primary    primary text
- text-secondary  secondary text
- text-muted      muted text

Border Colors:
- border-default  default border
- border-subtle   subtle border
```

## Layout Principles

### ⛔ Absolutely Prohibited Patterns

These patterns **will break the layout**, causing content overflow or being obscured by navigation:

```jsx
// ❌ Forbidden h-screen - ignores parent container constraints
<div className="slide-page h-screen">

// ❌ Forbidden adding extra padding to slide-page
<div className="slide-page p-12 pb-24">

// ❌ Forbidden inner h-full wrapper - will consume padding
<div className="slide-page">
  <div className="h-full flex flex-col justify-center">  {/* Wrong! */}

// ❌ Forbidden min-h-screen or any viewport units
<div className="slide-page min-h-screen">
```

### ✅ Correct Page Structure

The `slide-page` class has all necessary padding built-in (2.5rem on all sides, 6.5rem at bottom):

```jsx
<div className="slide-page">
  {/* Background decoration - use absolute positioning, takes no layout space */}
  <div className="absolute inset-0 pointer-events-none">
    {/* Gradients, grids and other decorations */}
  </div>

  {/* Header area - fixed height, shrink-0 prevents compression */}
  <header className="relative z-10 mb-6 shrink-0">
    <h1>Title</h1>
  </header>

  {/* Content area - slide-content auto-fills remaining space */}
  <div className="slide-content relative z-10">
    {/* Card grid - do not add h-full */}
  </div>
</div>
```

### How slide-page Works

- `padding: 2.5rem` (all sides)
- `padding-bottom: ~6.5rem` (reserved for navigation bar)
- `display: flex; flex-direction: column`
- Child elements auto-layout within padding area

### Responsive Breakpoints

| Screen | Width | padding | gap | Recommended cards/row |
|--------|-------|---------|-----|----------------------|
| 1080p | ≤1920px | 2rem | 1rem | 2 |
| 2K | ≤2560px | 2.5rem | 1.5rem | 2-3 |
| 4K | >2560px | 3rem | 2rem | 3-4 |

### Content Density Limits (Prevent Overflow)

| Screen | Max cards | Max items per card |
|--------|-----------|-------------------|
| 1080p | 4 | 3 |
| 2K | 4-6 | 4 |
| 4K | 6-8 | 5 |

### Multi-card Grid Layouts

```jsx
// 2 cards - horizontal arrangement
<div className="grid-auto-fit grid-cols-2">

// 4 cards - 2x2 grid
<div className="grid-auto-fit grid-2x2">

// 3 cards - horizontal arrangement
<div className="grid-auto-fit grid-1x3">

// 6 cards - 2x3 grid
<div className="grid-auto-fit grid-2x3">
```

### Card Adaptive Height

```jsx
// Card uses card-fit to ensure content doesn't overflow
<div className="card-fit rounded-xl bg-bg-card">
  <header className="p-4 border-b">Title</header>
  <div className="card-body p-4">
    {/* Content area auto-shrinks */}
  </div>
</div>
```

### Text Truncation

```jsx
// Limit text lines to prevent overflow
<p className="line-clamp-2">Long text...</p>
<h3 className="truncate">Title might be very long...</h3>
```

## Style Specifications

### Border Radius
- Large cards: `rounded-xl` or `rounded-2xl`
- Small elements: `rounded-lg`
- Buttons/Tags: `rounded-full` or `rounded-lg`

### Shadows and Hierarchy
- Glass style: `bg-white/10 backdrop-blur-md border border-white/20`
- Flat style: `bg-bg-card shadow-sm border border-border-default`

### Font Sizes
- Main title: `text-4xl` or `text-5xl font-bold`
- Subtitle: `text-xl` or `text-2xl font-medium`
- Body text: `text-base` or `text-lg`
- Auxiliary: `text-sm text-text-secondary`

## Component Structure

Every Slide file must follow this template:

```jsx
import { IconName } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SlideXX() {
  return (
    // ⚠️ Only use slide-page, do not add any other size/padding classes
    <div className="slide-page">
      {/* Background decoration - absolute positioning */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Gradient glows, grids, etc. */}
      </div>

      {/* Header area - shrink-0 prevents compression */}
      <header className="relative z-10 mb-6 shrink-0">
        <h1 className="text-4xl font-bold">Title</h1>
      </header>

      {/* Content area - use slide-content to auto-fill */}
      <div className="slide-content relative z-10">
        {/* Card grid */}
      </div>
    </div>
  );
}
```

### ⚠️ Common Mistakes

```jsx
// ❌ Wrong: Nesting h-full container inside slide-page
<div className="slide-page">
  <div className="h-full flex items-center justify-center">
    {/* This will consume all padding! */}
  </div>
</div>

// ✅ Correct: Layout directly inside slide-page
<div className="slide-page">
  <header>...</header>
  <div className="slide-content flex items-center justify-center">
    {/* slide-content will correctly fill remaining space */}
  </div>
</div>
```

### Multi-card Example

```jsx
export default function SlideContenders() {
  return (
    <div className="slide-page">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      </div>

      {/* Title - shrink-0 */}
      <header className="relative z-10 text-center mb-6 shrink-0">
        <h1 className="text-4xl font-bold">The Contenders</h1>
        <p className="text-text-secondary">Top 4 Candidates</p>
      </header>

      {/* Content - slide-content + grid */}
      <div className="slide-content relative z-10 grid-auto-fit grid-2x2">
        {models.map(model => (
          <div key={model.id} className="card-fit glass rounded-xl p-4">
            <header className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary-500/20" />
              <h3 className="font-semibold">{model.name}</h3>
            </header>
            <div className="card-body space-y-2">
              <div>Speed: {model.speed}</div>
              <div>Context: {model.context}</div>
              <div>Strength: {model.strength}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Style Keyword Reference

| Keyword | Visual Expression |
|---------|-------------------|
| Tech feel | Glass style, gradient borders, neon accents |
| Professional | Flat, clear hierarchy, moderate whitespace |
| Energetic | Bright colors, large titles, dynamic layouts |
| Minimal | Large whitespace, thin lines, monochrome |

## Animation Guide

Recommended to use `framer-motion` for entry animations and micro-interactions:

- ✅ Entry animations: fade, slide, scale
- ✅ Staggered reveals
- ✅ Hover state changes
- ✅ Number/progress animations

For detailed animation patterns, refer to [aesthetics.md](aesthetics.md).

## Prohibited Items

1. ❌ Do not hardcode color values (e.g., `#3b82f6`)
2. ❌ Do not use external CSS files
3. ❌ Do not use class components
4. ❌ Do not use Inter/Roboto/Arial and other generic fonts
5. ❌ Only lucide-react and framer-motion are allowed as additional dependencies
