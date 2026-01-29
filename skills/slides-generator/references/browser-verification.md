# Browser Verification Guide

> Use agent-browser skill to validate slides before export

## Purpose

Run slides in dev mode and use agent-browser to:
- Navigate through all slides
- Capture screenshots for validation
- Detect UI, animation, and interaction issues
- Propose fixes before final export

## Prerequisites

**Required skill**: agent-browser
```bash
# Check if installed
claude skill list | grep -q "agent-browser"

# Install if needed
npx skills add vercel-labs/agent-browser
```

## Verification Workflow

```
Step 1: Start Dev Server
    ↓
Step 2: Open in Browser
    ↓
Step 3: Validate Each Slide
    ↓
Step 4: Document Issues
    ↓
Step 5: Fix & Re-verify
    ↓
Step 6: Export Standalone
```

## Commands Reference

### 1. Start Dev Server

```bash
cd <project-folder>/source
npm install
npm run dev
# Server runs at http://localhost:5173
```

### 2. Open in Browser

```bash
agent-browser open http://localhost:5173
agent-browser set viewport 1920 1080  # Presentation resolution
```

### 3. Initial Page Analysis

```bash
# Get interactive elements
agent-browser snapshot -i

# Take initial screenshot
agent-browser screenshot ./verify/01-hero.png
```

### 4. Navigate Through Slides

```bash
# Navigate to next slide
agent-browser press ArrowRight
agent-browser wait 1000  # Wait for animation

# Take screenshot
agent-browser screenshot ./verify/02-slide-name.png
```

### 5. Full Verification Script

```bash
# Example: Verify 8-slide presentation
agent-browser open http://localhost:5173
agent-browser set viewport 1920 1080

# Slide 1
agent-browser wait 2000
agent-browser screenshot ./verify/slide-01.png

# Slides 2-8
for i in {2..8}; do
  agent-browser press ArrowRight
  agent-browser wait 1000
  agent-browser screenshot ./verify/slide-0$i.png
done

# Return to start
agent-browser press Home
```

## Verification Checklist

### Layout Issues

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Content visible | `screenshot` | No clipping at edges |
| Navigation visible | `snapshot -i` | Nav buttons accessible |
| Cards not overlapping | `screenshot` | Clear spacing between elements |
| Text readable | `screenshot` | No truncation unless intended |

### Animation Issues

| Check | How to Verify | Pass Criteria |
|-------|---------------|---------------|
| Entry animations | Navigate to slide, wait 2s | Elements animate in smoothly |
| Hover states | `agent-browser hover @element` | Visual feedback on hover |
| Transitions | Press ArrowRight, wait | Smooth slide transition |

### Interaction Issues

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Keyboard nav | `press ArrowRight/ArrowLeft` | Slides change correctly |
| Click navigation | `click @nav-element` | Responds to click |
| Export button | `snapshot -i`, find export | Modal opens |

### Responsive Issues

Test at multiple viewports:

```bash
# Desktop 1080p
agent-browser set viewport 1920 1080
agent-browser screenshot ./verify/desktop-1080p.png

# Desktop 2K
agent-browser set viewport 2560 1440
agent-browser screenshot ./verify/desktop-2k.png

# Desktop 4K
agent-browser set viewport 3840 2160
agent-browser screenshot ./verify/desktop-4k.png
```

## Common Issues & Fixes

### Issue: Content Overflows

**Symptoms**: Cards extend beyond viewport, text clipped

**Check**:
```bash
agent-browser screenshot --full ./verify/full-page.png
```

**Common Causes**:
- Using `h-screen` or `min-h-screen` on slide content
- Missing `shrink-0` on header
- Not using `slide-content` class

**Fix Pattern**:
```jsx
// Bad
<div className="slide-page h-screen">

// Good
<div className="slide-page">
  <header className="shrink-0">...</header>
  <div className="slide-content">...</div>
</div>
```

### Issue: Navigation Hidden

**Symptoms**: Cannot see or click navigation buttons

**Check**:
```bash
agent-browser snapshot -i  # Look for nav elements
```

**Common Causes**:
- Z-index conflicts
- Content overlapping navigation area
- Missing `relative z-10` on content

**Fix**: Ensure navigation has `z-50` and content has `z-10`

### Issue: Animations Janky

**Symptoms**: Stuttering, flickering during transitions

**Check**:
```bash
# Record video to capture animation issues
agent-browser record start ./verify/animation-test.webm
agent-browser press ArrowRight
agent-browser wait 1000
agent-browser press ArrowRight
agent-browser wait 1000
agent-browser record stop
```

**Common Causes**:
- Using `filter: blur()` in transitions
- Animating layout properties (width/height)
- Too many simultaneous animations

**Fix Pattern**:
```jsx
// Bad - causes repaint
const variants = {
  enter: { filter: 'blur(10px)', x: 100 },
  center: { filter: 'blur(0px)', x: 0 }
};

// Good - GPU accelerated
const variants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 }
};
```

### Issue: Text Truncation

**Symptoms**: Important text cut off unexpectedly

**Check**:
```bash
agent-browser get text @element-ref
```

**Common Causes**:
- Overly aggressive `line-clamp`
- Fixed height containers
- Missing `overflow-auto`

**Fix**: Use appropriate `line-clamp-N` or remove height constraints

## Verification Report Template

After verification, document findings:

```markdown
# Verification Report

## Date: YYYY-MM-DD
## Presentation: [Name]
## Slides Verified: [N]

## Issues Found

### Critical (Must Fix)
1. [ ] Slide X: [Description] - [Screenshot]

### Minor (Should Fix)
1. [ ] Slide Y: [Description]

### Observations
- [Any notes about animations, timing, etc.]

## Screenshots
- ./verify/slide-01.png
- ./verify/slide-02.png
- ...

## Recommendation
[ ] Ready for export
[ ] Needs fixes - see issues above
```

## Post-Fix Re-verification

After applying fixes:

1. Refresh browser: `agent-browser reload`
2. Re-run verification steps
3. Compare new screenshots with originals
4. Update verification report

## Export After Verification

Once all checks pass:

```bash
cd <project-folder>/source
npm run build:standalone
cp dist-standalone/index.html ../slide.html
```

Final check of standalone file:
```bash
agent-browser open file://<project-folder>/slide.html
agent-browser set viewport 1920 1080
agent-browser screenshot ./verify/final-standalone.png
```
