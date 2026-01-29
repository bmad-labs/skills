---
name: slides-generator
description: Generate interactive presentation slides using React + Tailwind, and export to standalone single-file HTML. Triggers on keywords like "slides", "presentation", "PPT", "demo", "benchmark", or when user requests export. Uses agent-browser skill for browser verification (install with `npx skills add vercel-labs/agent-browser` if not available).
---

# Slides Generator

Generate professional, interactive presentation slides with React + Tailwind.

## Project Structure

Each slide project is organized in a dedicated folder:

```
<project-folder>/
├── context.md          ← Collected knowledge and context from user
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
└── slide.html          ← Final standalone HTML (auto-generated)
```

## Workflow Overview

```
Step 1: Initialize Project Folder
    ↓
Step 2: Collect Requirements → context.md
    ↓
Step 3: Create Markdown Slides → slides.md
    ↓
Step 4: Confirm with User
    ↓
Step 5: Create Source Code → source/
    ↓
Step 6: Generate Slides (parallel subagents)
    ↓
Step 7: Build & Export → slide.html
    ↓
Step 8: Browser Verification (optional)
```

## Step 1: Initialize Project Folder

**Ask user for project folder if not provided:**
```
Where would you like to save this presentation?
Default: ./presentation-name
```

**Create folder structure:**
```bash
mkdir -p <project-folder>/source
```

## Step 2: Collect Requirements

Ask questions to understand:
- **Scenario type**: Benchmark / Product Demo / Report / General
- **Content**: Title, number of slides, key points per slide
- **Style preference**: Tech / Professional / Vibrant / Minimal

**Save to `context.md`:**
```markdown
# Presentation Context

## Topic
[Main topic and purpose]

## Audience
[Target audience]

## Key Points
- Point 1
- Point 2
- ...

## Style
- Theme: [theme-id]
- Style: glass / flat

## Additional Notes
[Any other relevant context]
```

Recommend a theme from [palettes.md](references/palettes.md) based on style keywords.

## Step 3: Create Markdown Slides

Create `slides.md` for user preview before generating code:

```markdown
# Presentation Title

## Slide 1: Hero
**Type**: Hero
**Title**: Main Title Here
**Subtitle**: Supporting tagline

---

## Slide 2: Overview
**Type**: Content
**Title**: What We'll Cover
**Points**:
- First key point
- Second key point
- Third key point

---

## Slide 3: Details
**Type**: Data
**Title**: Key Metrics
**Content**:
| Metric | Value |
|--------|-------|
| Users  | 10K   |
| Growth | 25%   |

---

## Slide 4: Summary
**Type**: Summary
**Title**: Key Takeaways
**Points**:
- Conclusion 1
- Conclusion 2
- Call to action
```

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

// Update NAV_ITEMS array
const NAV_ITEMS = [
  { slideIndex: 0, label: 'Hero' },
  { slideIndex: 1, label: 'Content' },
  // ...
];

// Update PRESENTATION_NAME
const PRESENTATION_NAME = 'Your Presentation Title';
```

## Step 7: Build & Export (Automatic)

After slides are generated, automatically build the standalone HTML:

```bash
cd <project-folder>/source

# Install dependencies
npm install

# Build standalone HTML
npm run build:standalone

# Copy to project root
cp dist-standalone/index.html ../slide.html
```

**Final output**: `<project-folder>/slide.html`

This single HTML file:
- Contains all JS, CSS, and fonts embedded
- Works offline (no server needed)
- Opens directly in any browser (file://)
- Full React interactivity and animations

## Step 8: Browser Verification (Optional)

Use the **agent-browser** skill for browser automation and verification.

**Check if agent-browser is installed:**
```bash
claude skill list | grep -q "agent-browser"
```

**If not installed, prompt user:**
```
The agent-browser skill is required for browser verification.

Install it with:
npx skills add vercel-labs/agent-browser

Then restart Claude Code and retry.
```

**Once installed, use agent-browser to:**
1. Open `<project-folder>/slide.html` in browser
2. Take screenshots of each slide
3. Verify navigation works (arrow keys, click)
4. Check responsive behavior
5. Fix any layout or styling issues found

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
3. Style preference? (Tech/Professional/Vibrant)"

User: "3 tasks, coding ability, tech style"

Claude: [Creates ./claude-benchmark/context.md]
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
Claude: [Runs npm install && npm run build:standalone]
Claude: [Copies to slide.html]
Claude: "Presentation complete!

Files created:
- ./claude-benchmark/context.md
- ./claude-benchmark/slides.md
- ./claude-benchmark/source/ (React project)
- ./claude-benchmark/slide.html ← Open this in browser

Open slide.html to view your presentation."
```
