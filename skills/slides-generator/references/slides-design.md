# Slides Design System Reference

> Comprehensive design patterns for slides.md - integrates with ui-ux-pro-max skill

## Purpose

The `slides.md` file serves as the blueprint before code generation. It must capture:
- Content structure (titles, points, data)
- Design system (theme, colors, typography)
- Visual patterns (layout, animations, effects)
- Slide-specific styles and variations

## slides.md Complete Template

```markdown
# [Presentation Title]

## Design System

### Theme
- **Palette**: [theme-id from palettes.md]
- **Mode**: dark / light
- **Style**: glass / flat

### Colors (from selected palette)
| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | #XXXXXX | Main background |
| primary-500 | #XXXXXX | Primary accent |
| accent-500 | #XXXXXX | Contrast accent |
| text-primary | #XXXXXX | Main text |
| text-secondary | #XXXXXX | Secondary text |

### Typography
- **Display Font**: [Font Name] - headings
- **Body Font**: [Font Name] - content
- **Monospace**: [Font Name] - code (if needed)

### Effects
- **Cards**: [glass/flat] with [shadow/glow/border]
- **Animations**: [subtle/dynamic/minimal]
- **Backgrounds**: [gradient glow/grid pattern/noise texture]

---

## Slide 1: Hero
**Type**: Hero
**Layout**: centered / split / asymmetric
**Title**: [Main Title]
**Subtitle**: [Supporting tagline]
**Background**:
- [ ] Gradient glow (top-left primary, bottom-right accent)
- [ ] Animated particles
- [ ] Grid pattern
**Animation**: fade-in + scale (0.8s)

---

## Slide 2: [Name]
**Type**: Content / Data / Comparison / Timeline / Grid
**Layout**: [specific layout pattern]
**Title**: [Slide Title]
**Content**:
[Detailed content structure]
**Cards**: [number] cards, [glass/flat] style
**Animation**: stagger reveal (0.1s delay)

---
[Continue for all slides...]
```

## Slide Types & Layouts

### Type: Hero
Opening slide with maximum visual impact.

**Layouts:**
| Layout | Description | Best For |
|--------|-------------|----------|
| centered | Title + subtitle centered | General presentations |
| split | Content left, visual right | Product demos |
| asymmetric | Off-center composition | Creative/bold themes |
| full-visual | Text overlay on background | Impactful statements |

**Required Elements:**
- Main title (text-5xl to text-7xl)
- Subtitle (text-xl to text-2xl)
- Optional: CTA button, logo, date

**Background Patterns:**
```
- Gradient glow: radial-gradient from primary-500/20
- Grid: Fine line grid with low opacity
- Particles: Animated floating dots
- Geometric: Abstract shapes with blur
```

---

### Type: Content
Standard information slide with bullet points or paragraphs.

**Layouts:**
| Layout | Description | Cards |
|--------|-------------|-------|
| single-column | Centered content | 0 |
| two-column | Side by side | 2 |
| three-column | Horizontal grid | 3 |
| icon-list | Icons with descriptions | 3-6 |

**Content Patterns:**
```markdown
**Points (bullet style):**
- Point 1
- Point 2
- Point 3

**Points (with icons):**
- [icon: Zap] Point 1
- [icon: Shield] Point 2
- [icon: Rocket] Point 3

**Points (numbered):**
1. Step one
2. Step two
3. Step three
```

---

### Type: Data
Statistics, metrics, and numerical highlights.

**Layouts:**
| Layout | Description | Metrics |
|--------|-------------|---------|
| stat-cards | Large numbers in cards | 2-4 |
| stat-row | Horizontal stat strip | 3-5 |
| chart-focus | Single chart with context | 1 |
| dashboard | Multiple data visualizations | 4-6 |

**Stat Card Pattern:**
```markdown
**Stats:**
| Metric | Value | Trend | Context |
|--------|-------|-------|---------|
| Users | 10K+ | +25% | Monthly active |
| Revenue | $2.5M | +40% | Annual |
| NPS | 72 | +8 | Industry avg: 45 |
```

**Chart Types:**
- Bar: Comparisons between categories
- Line: Trends over time
- Pie/Donut: Part-to-whole relationships
- Radar: Multi-dimensional comparison

---

### Type: Comparison
Side-by-side analysis of options, products, or features.

**Layouts:**
| Layout | Description | Items |
|--------|-------------|-------|
| versus | Two items side by side | 2 |
| feature-matrix | Grid with checkmarks | 2-4 |
| before-after | Transformation view | 2 |
| ranking | Ordered list with scores | 3-5 |

**Comparison Pattern:**
```markdown
**Comparison: [Item A] vs [Item B]**

| Feature | Item A | Item B |
|---------|--------|--------|
| Speed | ✓ Fast | ○ Medium |
| Cost | $99/mo | $149/mo |
| Support | 24/7 | Business hours |

**Winner highlight**: [Item A] for [reason]
```

---

### Type: Timeline
Sequential events, roadmap, or process flow.

**Layouts:**
| Layout | Description | Steps |
|--------|-------------|-------|
| horizontal | Left to right flow | 3-5 |
| vertical | Top to bottom | 4-8 |
| milestone | Key events with dates | 3-6 |
| process | Numbered steps with arrows | 4-6 |

**Timeline Pattern:**
```markdown
**Timeline:**
1. **Q1 2024**: [Event/Milestone]
   - Detail 1
   - Detail 2
2. **Q2 2024**: [Event/Milestone]
   - Detail 1
3. **Q3 2024**: [Event/Milestone]
```

---

### Type: Grid
Multiple cards in organized layout.

**Layouts:**
| Layout | Class | Cards |
|--------|-------|-------|
| 2-column | grid-cols-2 | 2, 4, 6 |
| 3-column | grid-1x3 | 3, 6 |
| 2x2 grid | grid-2x2 | 4 |
| 2x3 grid | grid-2x3 | 6 |
| bento | custom asymmetric | 4-6 |

**Card Content Pattern:**
```markdown
**Cards:**
1. **[Card Title]** [icon: IconName]
   - Subtitle or description
   - Key point

2. **[Card Title]** [icon: IconName]
   - Subtitle or description
   - Key point
```

---

### Type: Quote
Testimonial, citation, or impactful statement.

**Layouts:**
| Layout | Description |
|--------|-------------|
| centered | Large quote, centered |
| with-avatar | Quote + person photo |
| multi-quote | 2-3 testimonials |
| highlight | Quote with emphasis styling |

**Quote Pattern:**
```markdown
**Quote:**
> "[The quote text here]"

**Attribution:**
- Name: [Person Name]
- Title: [Job Title]
- Company: [Company Name]
- Avatar: [image path or placeholder]
```

---

### Type: Summary
Closing slide with key takeaways and CTA.

**Layouts:**
| Layout | Description |
|--------|-------------|
| takeaways | Numbered key points |
| cta-focused | Single call to action |
| contact | Contact info + social |
| thank-you | Simple closing message |

**Summary Pattern:**
```markdown
**Key Takeaways:**
1. [First takeaway]
2. [Second takeaway]
3. [Third takeaway]

**Call to Action:**
- Text: [CTA text]
- Link: [URL or action]

**Contact:**
- Email: [email]
- Website: [url]
```

---

## Design Patterns by Scenario

### Tech/Product Demo
```yaml
Theme: dark-sapphire-blue or cyberpunk
Style: glass
Typography: Sora + Source Sans 3
Effects:
  - Gradient glows (primary + accent)
  - Grid pattern background
  - Subtle particle animation
Cards: Glass with border-white/20
Animations: Smooth fade + slide
```

### Professional/Business
```yaml
Theme: banking-website or minimal-modern-light
Style: flat
Typography: DM Sans + Work Sans
Effects:
  - Clean solid backgrounds
  - Subtle shadows
  - No heavy effects
Cards: Flat with shadow-sm
Animations: Minimal, fast transitions
```

### Creative/Bold
```yaml
Theme: neon or cyberpunk
Style: glass
Typography: Outfit + Nunito Sans
Effects:
  - Neon glow borders
  - Gradient text
  - Bold color blocks
Cards: Glass with neon borders
Animations: Dynamic, staggered reveals
```

### Nature/Organic
```yaml
Theme: summer-meadow or deep-green
Style: flat
Typography: Manrope + Source Sans 3
Effects:
  - Soft gradients
  - Organic shapes
  - Earth tones
Cards: Soft shadows, rounded corners
Animations: Gentle, flowing
```

---

## Integration with ui-ux-pro-max

When designing slides, use ui-ux-pro-max for additional design intelligence:

### Generate Design System
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<presentation topic> <style keywords>" --design-system
```

**Example:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "tech benchmark modern dark glass" --design-system -p "Claude Benchmark"
```

### Get Typography Options
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<style>" --domain typography
```

### Get Color Palettes
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<industry/mood>" --domain color
```

### Get UX Guidelines
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
```

---

## Animation Specifications

### Entry Animations
| Animation | Code | Duration | Use For |
|-----------|------|----------|---------|
| Fade in | `opacity: 0 → 1` | 0.5s | All elements |
| Slide up | `y: 20 → 0` | 0.4s | Cards, lists |
| Scale in | `scale: 0.95 → 1` | 0.3s | Titles, hero |
| Blur reveal | `filter: blur(10px) → 0` | 0.6s | Dramatic (use sparingly) |

### Stagger Patterns
| Pattern | Delay | Use For |
|---------|-------|---------|
| Fast | 0.05s | Icon lists |
| Normal | 0.1s | Card grids |
| Slow | 0.15s | Timeline items |
| Dramatic | 0.2s | Key reveals |

### Hover Effects
| Effect | Code | Use For |
|--------|------|---------|
| Lift | `scale: 1.02, shadow: lg` | Cards |
| Glow | `shadow: primary-500/50` | CTAs |
| Color shift | `bg-opacity change` | Links |

---

## Color Application Rules

### Dark Themes
```
Background: bg-base (darkest)
Cards: bg-white/10 (glass) or bg-bg-card (flat)
Primary text: text-primary (#FFFFFF or near-white)
Secondary text: text-secondary (60-70% white)
Muted text: text-muted (40-50% white)
Accents: primary-500, accent-500
```

### Light Themes
```
Background: bg-base (white or off-white)
Cards: bg-white with shadow (flat)
Primary text: text-primary (#0F172A or near-black)
Secondary text: text-secondary (#475569)
Muted text: text-muted (#94A3B8)
Accents: primary-600, accent-600
```

### Contrast Requirements
- Primary text on background: minimum 7:1
- Secondary text on background: minimum 4.5:1
- UI elements on background: minimum 3:1

---

## Anti-Patterns to Avoid

### Layout
- ❌ Using `h-screen` or `min-h-screen` on slide content
- ❌ Overflowing content beyond viewport
- ❌ Inconsistent spacing between slides

### Typography
- ❌ Using Inter, Roboto, Arial (AI-generated signature)
- ❌ More than 2 fonts per presentation
- ❌ Text smaller than 16px for body content

### Colors
- ❌ Purple gradient + white background (AI cliché)
- ❌ Rainbow gradients (unless intentional)
- ❌ Low contrast text
- ❌ Hardcoded color values instead of theme tokens

### Animation
- ❌ Animating width/height (causes repaint)
- ❌ Using blur in transitions (performance hit)
- ❌ Animations longer than 0.8s
- ❌ Too many simultaneous animations

### Visual
- ❌ Using emojis as icons
- ❌ Inconsistent icon sets
- ❌ Missing hover states on interactive elements
- ❌ No visual hierarchy (everything same size)
