# Slide Aesthetics Guide

> This is the primary design reference for subagents when generating slide pages. For technical specifications, refer to principles.md.

## Design Philosophy

Before writing code, understand the context and determine a **bold aesthetic direction**:

- **Purpose**: What problem does this slide solve? Who is viewing it?
- **Tone**: Choose a clear style direction:
  - Minimal restraint / Maximal opulence
  - Retro-futurism / Organic natural
  - Luxurious refined / Playful whimsical
  - Magazine editorial / Brutalism
  - Art deco / Soft pastel
  - Industrial utilitarian / Cyberpunk tech
- **Differentiation**: What makes the audience remember this presentation? What is a memorable visual anchor?

**Key Principle**: Choose a clear conceptual direction and execute precisely. Both bold maximalism and refined minimalism work—the key is intentional clarity, not intensity level.

---

## Typography

### Recommended Font Pairings

Optimized for presentation scenarios—balancing readability and personality:

**Display fonts for headings (choose one):**
- Sora — Geometric feel, modern tech
- DM Sans — Friendly, professional balance
- Outfit — Rounded, strong approachability
- Manrope — Clear, slight personality
- Poppins — Geometric rounded, trendy feel

**Body fonts for content (choose one):**
- Source Sans 3 — High readability, professional
- Nunito Sans — Soft, friendly
- Work Sans — Neutral, highly adaptable

### Typography Usage Principles

- Use Display font for headings, Body font for content
- Avoid using more than 2 fonts in one presentation
- Font weight contrast: headings `font-bold` (700), body `font-normal` (400)

### Prohibited Fonts

- ❌ Arial, Helvetica — Too generic
- ❌ Inter, Roboto — Typical AI-generated signature
- ❌ Times New Roman — Not suitable for screen presentations
- ❌ Comic Sans — Unless intentional

---

## Motion & Micro-interactions

### Entry Animations

Use staggered reveals to create rhythm:

```jsx
// Using framer-motion
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div variants={container} initial="hidden" animate="show">
  <motion.div variants={item}>Item 1</motion.div>
  <motion.div variants={item}>Item 2</motion.div>
</motion.div>
```

### Recommended Animation Patterns

| Scenario | Animation | Parameters |
|----------|-----------|------------|
| Card entry | fade + slide up | `opacity: 0→1, y: 20→0` |
| Title entry | fade + scale | `opacity: 0→1, scale: 0.95→1` |
| List items | stagger reveal | `staggerChildren: 0.1` |
| Number changes | count up | Use `framer-motion`'s `useSpring` |
| Charts | draw path | `pathLength: 0→1` |

### Hover States

```jsx
// Card hover effect
<motion.div
  whileHover={{
    scale: 1.02,
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
  }}
  transition={{ type: "spring", stiffness: 300 }}
>
```

### Transition Timing

- `duration: 0.3` — Quick response (hover, click)
- `duration: 0.5` — Standard transition (page switch)
- `duration: 0.8` — Dramatic entry (hero animations)

---

## Color & Theme

### Principles

- **Dominant color + sharp accent** is better than timid even distribution
- Use CSS variables to maintain consistency (see principles.md)
- Dark themes: background should be dark enough, text contrast should be strong
- Light themes: avoid pure white, use subtle warm/cool grays

### Prohibited Color Schemes

- ❌ Purple gradient + white background (typical AI-generated signature)
- ❌ Rainbow gradients (unless Pride theme)
- ❌ Over-saturated neon colors for large areas

---

## Spatial Composition

### Break Conventions

- **Asymmetric layouts** — Don't always center-align
- **Overlapping elements** — Cards, images can partially overlap
- **Diagonal flow** — Guide the eye from top-left to bottom-right
- **Break the grid** — Occasionally let elements break boundaries
- **Bold whitespace** or **controlled density** — Both work, but be intentional

### Layout Example

```
Traditional (avoid):       Bold (recommended):
┌─────────────┐           ┌─────────────┐
│   Title     │           │ Title       │
├─────────────┤           │     ┌───────┤
│ Card  Card  │           │ Card│ Card  │
│ Card  Card  │           └─────┴───────┘
└─────────────┘                  ↑ overlap
```

---

## Backgrounds & Visual Details

### Creating Atmosphere

Don't default to solid color backgrounds. Add depth and atmosphere:

**Gradient glows:**
```css
.glow {
  background: radial-gradient(
    ellipse at 30% 20%,
    theme('colors.primary.500/20') 0%,
    transparent 50%
  );
}
```

**Noise texture:**
```css
.noise {
  background-image: url("data:image/svg+xml,..."); /* noise SVG */
  opacity: 0.03;
}
```

**Geometric patterns:**
- Dot grid
- Fine line grid
- Radial lines

### Decorative Elements

- Blurred light spots (`blur-3xl` + low opacity)
- Gradient borders (`border-transparent` + gradient background)
- Subtle shadow layers

---

## Anti-AI-Slop Checklist

### Check Every Slide

- [ ] Not using Inter/Roboto/Arial fonts
- [ ] No purple gradient + white background combination
- [ ] Color scheme has a clear dominant color, not evenly distributed
- [ ] Layout has variation, not cookie-cutter card grids
- [ ] Has at least one visual memory anchor
- [ ] Background has atmosphere, not solid color

### Remember

Claude has the capability to create extraordinary creative work. Don't be conservative—fully demonstrate the ability to think outside the box and commit fully to a unique visual vision.

Every design should be different. Vary between light/dark themes, different fonts, different aesthetics. **Never** converge to the same choices across multiple generations.
