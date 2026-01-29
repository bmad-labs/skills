---
name: slides-generator
description: Generate interactive presentation slides using React + Tailwind, and export to standalone single-file HTML. Triggers on keywords like "slides", "presentation", "PPT", "demo", "benchmark", or when user requests export. Uses agent-browser skill for browser verification before export (install with `npx skills add vercel-labs/agent-browser` if not available).
---

# Slides Generator

Generate professional, interactive presentation slides with React + Tailwind.

## Project Structure

Each slide project is organized in a dedicated folder:

```
<project-folder>/
├── context.md          ← Collected knowledge and context from user
├── researches/         ← Research documents (when topic requires research)
│   └── YYYY-MM-DD-topic.md
├── slides.md           ← Markdown slides for preview/discussion
├── source/             ← React source code (from template)
│   ├── package.json
│   ├── vite.config.js
│   ├── vite.standalone.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       └── slides/
│           ├── 01-hero.jsx
│           ├── 02-content.jsx
│           └── ...
├── verify/             ← Verification screenshots (from browser testing)
└── slide.html          ← Final standalone HTML (auto-generated)
```

## Workflow Overview

```
Step 1: Initialize Project Folder
    ↓
Step 2: Collect Requirements → context.md
    ↓
Step 2.5: Research (if needed) → researches/
    ↓
Step 3: Create Markdown Slides → slides.md
    ↓
Step 4: Confirm with User
    ↓
Step 5: Create Source Code → source/
    ↓
Step 6: Generate Slides (parallel subagents)
    ↓
Step 7: Dev Mode + Browser Verification (REQUIRED)
    ↓
Step 8: Build & Export → slide.html
```

## Step 1: Initialize Project Folder

**Ask user for project folder if not provided:**
```
Where would you like to save this presentation?
Default: ./presentation-name
```

**Create folder structure:**
```bash
mkdir -p <project-folder>/source <project-folder>/researches <project-folder>/verify
```

## Step 2: Collect Requirements

Gather comprehensive context using questions. See [context-guide.md](references/context-guide.md) for detailed guidance.

**Key areas to cover:**
- **Topic & Purpose**: What and why
- **Audience**: Who and their expertise level
- **Content**: Key points, data needs, visual requirements
- **Style**: Theme preference, tone, animations

**Save to `context.md`:**
```markdown
# Presentation Context

## Topic
[Main topic and specific focus area]

## Purpose
[What this presentation aims to achieve]
- Primary goal: [inform/persuade/demo/report]
- Expected action: [what audience should do after]

## Audience
- **Primary**: [main target group]
- **Expertise level**: [beginner/intermediate/expert]
- **Key interests**: [what they care about]

## Key Points

### [Section 1]
- Point 1
- Point 2

### [Section 2]
- Point 1
- Point 2

## Data & Statistics
- [Stat]: [Source]

## Visual Requirements
- [ ] Code examples
- [ ] Diagrams
- [ ] Charts
- [ ] Custom images

## Style
- **Theme**: [theme-id from palettes.md]
- **Style**: [glass/flat]
- **Tone**: [professional/casual/energetic/minimal]

## Sources
- [Source]: [URL/reference]

## Additional Notes
[Any other relevant context]
```

Recommend a theme from [palettes.md](references/palettes.md) based on style keywords.

## Step 2.5: Research (When Needed)

If the topic requires research to gather accurate data, statistics, or technical details:

1. **Identify knowledge gaps** during context collection
2. **Conduct research** using web search or provided materials
3. **Document findings** in `researches/` folder

**Research file naming:**
```
researches/
├── YYYY-MM-DD-main-research.md      # Primary research
├── YYYY-MM-DD-statistics.md         # Data and numbers
└── YYYY-MM-DD-references.md         # Sources and links
```

**Research document template:**
```markdown
# Research: [Topic]

## Date: YYYY-MM-DD

## Research Questions
- Question 1?
- Question 2?

## Findings

### [Finding 1]
[Details with source citations]

### [Finding 2]
[Details with source citations]

## Key Statistics
| Metric | Value | Source |
|--------|-------|--------|
| [Metric] | [Value] | [Source] |

## Sources
1. [Title](URL) - [Brief description]
2. [Title](URL) - [Brief description]

## Notes for Slides
- Use [finding] for slide X
- Cite [statistic] in data slide
```

**After research, update context.md** with verified data and sources.

## Step 3: Create Markdown Slides

Create `slides.md` with complete design system and content structure. See [slides-design.md](references/slides-design.md) for detailed patterns.

### 3.1 Generate Design System (Optional but Recommended)

Use **ui-ux-pro-max** skill to get comprehensive design recommendations:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<topic> <style keywords>" --design-system -p "<Presentation Name>"
```

**Example:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "tech benchmark modern dark glass" --design-system -p "Claude Benchmark"
```

### 3.2 slides.md Template

```markdown
# [Presentation Title]

## Design System

### Theme
- **Palette**: [theme-id from palettes.md]
- **Mode**: dark / light
- **Style**: glass / flat

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | #0f1c2e | Main background |
| primary-500 | #4d648d | Primary accent |
| accent-500 | #3d5a80 | Contrast accent |
| text-primary | #ffffff | Main text |
| text-secondary | #cee8ff | Secondary text |

### Typography
- **Display**: Sora (headings)
- **Body**: Source Sans 3 (content)

### Effects
- **Cards**: glass with border-white/20
- **Animations**: stagger reveal (0.1s delay)
- **Background**: gradient glow + grid pattern

---

## Slide 1: Hero
**Type**: Hero
**Layout**: centered
**Title**: Main Title Here
**Subtitle**: Supporting tagline
**Background**: gradient glow (primary top-left, accent bottom-right)
**Animation**: fade-in + scale (0.6s)

---

## Slide 2: Overview
**Type**: Content
**Layout**: three-column
**Title**: What We'll Cover
**Cards**: 3 cards, glass style
**Points**:
- [icon: Zap] First key point
- [icon: Shield] Second key point
- [icon: Rocket] Third key point
**Animation**: stagger reveal (0.1s)

---

## Slide 3: Details
**Type**: Data
**Layout**: stat-cards
**Title**: Key Metrics
**Stats**:
| Metric | Value | Trend | Context |
|--------|-------|-------|---------|
| Users | 10K+ | +25% | Monthly active |
| Growth | 40% | +15% | Year over year |
| NPS | 72 | +8 | Industry avg: 45 |
**Animation**: count-up numbers

---

## Slide 4: Comparison
**Type**: Comparison
**Layout**: versus
**Title**: Head to Head
**Comparison**:
| Feature | Option A | Option B |
|---------|----------|----------|
| Speed | ✓ Fast | ○ Medium |
| Cost | $99/mo | $149/mo |
| Support | 24/7 | Business |
**Highlight**: Option A for performance

---

## Slide 5: Summary
**Type**: Summary
**Layout**: takeaways
**Title**: Key Takeaways
**Takeaways**:
1. First key insight
2. Second key insight
3. Third key insight
**CTA**: "Get Started" → [link]
**Animation**: fade-in sequential
```

### 3.3 Slide Types Reference

| Type | Use For | Layouts |
|------|---------|---------|
| Hero | Opening slide | centered, split, asymmetric |
| Content | Information, bullets | single-column, two-column, icon-list |
| Data | Statistics, metrics | stat-cards, chart-focus, dashboard |
| Comparison | Side-by-side analysis | versus, feature-matrix, ranking |
| Timeline | Process, roadmap | horizontal, vertical, milestone |
| Grid | Multiple cards | 2x2, 2x3, bento |
| Quote | Testimonials | centered, with-avatar |
| Summary | Closing, CTA | takeaways, cta-focused |

### 3.4 Design Patterns by Scenario

| Scenario | Theme | Style | Typography |
|----------|-------|-------|------------|
| Tech/Product | dark-sapphire-blue | glass | Sora + Source Sans 3 |
| Professional | banking-website | flat | DM Sans + Work Sans |
| Creative | cyberpunk or neon | glass | Outfit + Nunito Sans |
| Nature | summer-meadow | flat | Manrope + Source Sans 3 |
| Minimal | black-and-white | flat | DM Sans + Work Sans |

## Step 4: Confirm with User

Present the outline for confirmation:

```markdown
## Presentation Outline

**Title**: [Title]
**Theme**: [theme-id] ([glass/flat] style)
**Folder**: [project-folder]

**Slides**:
1. Hero - Title and overview
2. Content - Key points
3. Data - Metrics/charts
4. Summary - Conclusions

**Files to create:**
- context.md ✓
- slides.md ✓
- source/ (React project)
- slide.html (final output)

**Confirm to generate?**
```

## Step 5: Create Source Code

Copy template and configure:

```bash
# 1. Copy template
cp -r <skill-path>/assets/template/* <project-folder>/source/

# 2. Update tailwind.config.js with theme colors
# 3. Update index.html title
# 4. Update App.jsx with presentation name
```

## Step 6: Generate Slides

Generate each slide JSX file based on `slides.md` content.

**Before generating, read:**
- [aesthetics.md](references/aesthetics.md) - Design philosophy
- [principles.md](references/principles.md) - Technical principles

**Use vercel-react-best-practices skill** for React code generation to ensure:
- Proper component composition and patterns
- Performance-optimized rendering
- Clean, maintainable code structure

**Technical Requirements:**
- Framework: React function component
- Styling: Tailwind CSS
- Icons: lucide-react
- Animations: framer-motion
- Export: default function component

**Theme Colors (use variables, not hardcoded):**
- primary-50 to primary-950
- accent-50 to accent-950
- bg-base, bg-card, bg-elevated
- text-primary, text-secondary, text-muted
- border-default, border-subtle

**Style Options:**
- Glass: `glass` class or `bg-white/10 backdrop-blur-md border-white/20`
- Flat: `bg-bg-card shadow-sm border-border-default`

**Layout Rules (CRITICAL):**

⛔ FORBIDDEN:
- `h-screen`, `min-h-screen` - breaks layout
- `h-full` on content wrappers
- Extra padding on `slide-page`

✅ REQUIRED Structure:
```jsx
<div className="slide-page">
  {/* Background - absolute positioning */}
  <div className="absolute inset-0 pointer-events-none">...</div>

  {/* Header */}
  <header className="relative z-10 mb-6 shrink-0">
    <h1>Title</h1>
  </header>

  {/* Content - auto-fills remaining space */}
  <div className="slide-content relative z-10">
    {/* Grid/cards here */}
  </div>
</div>
```

**Grid Layouts:**
- 2 cards: `grid-auto-fit grid-cols-2`
- 3 cards: `grid-auto-fit grid-1x3`
- 4 cards (2x2): `grid-auto-fit grid-2x2`
- 6 cards (2x3): `grid-auto-fit grid-2x3`

**Animation Patterns:**
```jsx
import { motion } from 'framer-motion';

// Stagger container
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

// Child item
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Hover effect
<motion.div whileHover={{ scale: 1.02 }}>...</motion.div>
```

**File naming:** `01-hero.jsx`, `02-overview.jsx`, etc.

**Update App.jsx after all slides generated:**

```jsx
// Add imports at top
import Slide01 from './slides/01-hero';
import Slide02 from './slides/02-content';
// ...

// Update SLIDES array
const SLIDES = [Slide01, Slide02, ...];

// Update NAV_ITEMS array (used for navigation labels)
const NAV_ITEMS = [
  { slideIndex: 0, label: 'Hero' },
  { slideIndex: 1, label: 'Content' },
  // ...
];

// Update PRESENTATION_NAME
const PRESENTATION_NAME = 'Your Presentation Title';
```

**Navigation Features:**

The template includes quick-jump navigation:

| Feature | How to Use |
|---------|------------|
| Slide dots | Click dots at bottom center (≤12 slides) |
| Number keys | Press 1-9 to jump to slides 1-9 |
| Quick nav | Press G or click progress bar to open grid picker |
| Menu | Click hamburger for full slide list with labels |
| Arrows | ← → keys or click chevron buttons |

## Step 7: Dev Mode + Browser Verification (REQUIRED)

**IMPORTANT**: Always verify slides in dev mode BEFORE building the standalone export. This catches UI, animation, and interaction issues early.

See [browser-verification.md](references/browser-verification.md) for detailed verification procedures.

### 7.1 Start Dev Server

```bash
cd <project-folder>/source
npm install
npm run dev
# Server runs at http://localhost:5173
```

### 7.2 Browser Verification with agent-browser

**Check if agent-browser is available:**
```bash
# Try to run agent-browser
agent-browser --version
```

**If not installed, prompt user:**
```
Browser verification requires agent-browser skill.

Install with:
npx skills add vercel-labs/agent-browser

Then restart Claude Code and retry.
```

### 7.3 Verification Workflow

```bash
# Open presentation in browser
agent-browser open http://localhost:5173
agent-browser set viewport 1920 1080

# Create verify folder
mkdir -p <project-folder>/verify

# Capture first slide
agent-browser wait 2000
agent-browser screenshot <project-folder>/verify/slide-01.png

# Navigate and capture each slide
agent-browser press ArrowRight
agent-browser wait 1000
agent-browser screenshot <project-folder>/verify/slide-02.png
# ... repeat for all slides
```

### 7.4 Verification Checklist

| Check | How | Pass Criteria |
|-------|-----|---------------|
| Layout | Screenshot each slide | No content overflow, proper spacing |
| Navigation | Press ArrowRight/Left | Slides transition smoothly |
| Quick jump | Press 1-5 or G key | Jumps to correct slide |
| Slide dots | Click dots at bottom | Navigates correctly (≤12 slides) |
| Animations | Watch transitions | No jank, elements animate in |
| Interactive | Hover elements | Visual feedback works |
| Responsive | Change viewport | Layout adapts correctly |

### 7.5 Common Issues to Check

**Layout Problems:**
- Content extending beyond viewport
- Navigation bar hidden or overlapped
- Cards cramped or overflowing

**Animation Problems:**
- Stuttering transitions
- Elements not animating
- Flash of unstyled content

**Interaction Problems:**
- Keyboard navigation not working
- Click areas not responsive
- Hover states missing

### 7.6 Fix and Re-verify

If issues found:
1. Fix the problematic slide JSX
2. Browser auto-reloads (hot reload)
3. Re-verify the specific slide
4. Take new screenshot to confirm fix

## Step 8: Build & Export

**Only after verification passes**, build the standalone HTML:

```bash
cd <project-folder>/source

# Build standalone HTML
npm run build:standalone

# Copy to project root
cp dist-standalone/index.html ../slide.html
```

### 8.1 Final Verification

Verify the standalone file works correctly:

```bash
# Test standalone file
agent-browser open file://<absolute-path>/slide.html
agent-browser set viewport 1920 1080
agent-browser screenshot <project-folder>/verify/final-standalone.png

# Quick navigation test
agent-browser press ArrowRight
agent-browser wait 500
agent-browser press ArrowLeft
```

**Final output**: `<project-folder>/slide.html`

This single HTML file:
- Contains all JS, CSS, and fonts embedded
- Works offline (no server needed)
- Opens directly in any browser (file://)
- Full React interactivity and animations

### 8.2 Close Browser

```bash
agent-browser close
```

## Step 5.5: Generate Images (When Required)

When slides require custom images, diagrams, or illustrations, use the **ai-multimodal** skill.

**When to use:**
- Hero slides needing background illustrations
- Diagrams (architecture, flowcharts, processes)
- Product mockups or screenshots
- Custom icons or illustrations

**Workflow:**
1. Identify slides needing images during Step 3
2. After generating slide JSX, invoke ai-multimodal
3. Save images to `source/public/images/`
4. Reference in slides: `<img src="/images/generated-image.png" />`

## Theme System

Themes are defined in [palettes.md](references/palettes.md).

**Quick recommendations:**

| User says | Recommend |
|-----------|-----------|
| "Tech", "Modern" | dark-sapphire-blue (glass) |
| "Professional", "Business" | banking-website (flat) |
| "Cyberpunk", "Neon" | cyberpunk (glass) |
| "Natural", "Organic" | summer-meadow (flat) |
| "Minimal", "Clean" | black-and-white (flat) |

## Design Principles

See [principles.md](references/principles.md) for:
- Color variable usage
- Typography scale
- Spacing conventions
- Component structure

## Example Interaction

```
User: "Create a benchmark presentation for Claude vs GPT"

Claude: "I'll help create benchmark slides.

Where would you like to save this presentation?
Default: ./claude-benchmark"

User: "OK"

Claude: "A few questions:
1. How many evaluation tasks? (e.g., 3-5)
2. What capabilities? (coding / reasoning / agent)
3. Style preference? (Tech/Professional/Vibrant)
4. Do you have specific benchmark data, or should I research current benchmarks?"

User: "3 tasks, coding ability, tech style, research current data"

Claude: [Creates ./claude-benchmark/ folder structure]
Claude: [Researches current benchmark data]
Claude: [Creates ./claude-benchmark/researches/2026-01-29-benchmark-data.md]
Claude: [Creates ./claude-benchmark/context.md with researched data]
Claude: [Creates ./claude-benchmark/slides.md]
Claude: "Here's the outline:

## Presentation Outline

**Title**: Claude vs GPT Coding Benchmark
**Theme**: dark-sapphire-blue (glass)

**Slides**:
1. Hero - Title and model overview
2. Framework - Evaluation methodology
3. Task 1 - API development
4. Task 2 - React components
5. Task 3 - CLI tools
6. Summary - Results and recommendations

Confirm to generate?"

User: "OK"

Claude: [Creates source/ from template]
Claude: [Generates 6 slide JSX files]
Claude: [Updates App.jsx with imports]
Claude: [Starts dev server: npm run dev]
Claude: [Opens browser: agent-browser open http://localhost:5173]
Claude: [Verifies each slide, takes screenshots]
Claude: "Verification complete. All slides look good:
- Layout: ✓ No overflow issues
- Navigation: ✓ Arrow keys work
- Animations: ✓ Smooth transitions

Building standalone export..."

Claude: [Runs npm run build:standalone]
Claude: [Copies to slide.html]
Claude: [Final verification of slide.html]
Claude: [Closes browser]
Claude: "Presentation complete!

Files created:
- ./claude-benchmark/context.md
- ./claude-benchmark/researches/2026-01-29-benchmark-data.md
- ./claude-benchmark/slides.md
- ./claude-benchmark/source/ (React project)
- ./claude-benchmark/verify/ (verification screenshots)
- ./claude-benchmark/slide.html ← Open this in browser

Open slide.html to view your presentation."
```

## Reference Documentation

| Reference | Description |
|-----------|-------------|
| [context-guide.md](references/context-guide.md) | Comprehensive guide for gathering requirements |
| [slides-design.md](references/slides-design.md) | Design system patterns, slide types, layouts, animations |
| [browser-verification.md](references/browser-verification.md) | Browser testing with agent-browser |
| [aesthetics.md](references/aesthetics.md) | Design philosophy and visual guidelines |
| [principles.md](references/principles.md) | Technical layout and component rules |
| [palettes.md](references/palettes.md) | 76 color themes with usage guide |

## External Skill Integration

| Skill | Use For |
|-------|---------|
| **vercel-react-best-practices** | React code generation best practices (REQUIRED for slide JSX) |
| **ui-ux-pro-max** | Design system generation, typography, color palettes |
| **agent-browser** | Browser verification before export |
| **ai-multimodal** | Custom image/diagram generation |
