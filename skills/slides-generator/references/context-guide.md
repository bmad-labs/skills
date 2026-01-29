# Context Collection Guide

> Progressive disclosure approach for gathering presentation requirements

## Purpose

Gather requirements efficiently using structured question flow. Apply progressive disclosure: show 3-5 questions at a time, reveal more based on answers.

## Question Flow Framework

### Phase 1: Quick Start (Always Ask)

**Goal**: Get started with minimal friction

```
Q1: "What's the presentation about?"
    [Open text - let user explain in their own words]

Q2: "Brief description or any content to include?"
    [Optional - paste existing content, notes, or outline]
```

### Phase 2: Audience & Purpose (Always Ask)

**Goal**: Understand who and why

```
Q3: "Who will view this?"
    Options:
    - Executives / Decision makers
    - Technical team / Developers
    - General audience / Mixed
    - Customers / External stakeholders

Q4: "What's the goal?"
    Options:
    - Inform - Share knowledge or updates
    - Persuade - Convince or propose
    - Demo - Show product or process
    - Report - Present data or results
```

### Phase 3: Style Discovery (Always Ask)

**Goal**: Calibrate visual direction with user choice

**Step 1 - Get keywords**:
```
Q5: "Describe the vibe in a few words"
    Examples: "tech, modern, dark" or "professional, clean, corporate"
```

**Step 2 - Present 5 best matches from palettes.md**:

Based on user keywords, search palettes.md and present 5 options:

```
"Based on your description '[keywords]', here are 5 style options:

1. **[Palette Name]** ([style: glass/flat])
   [Brief description of visual style]
   Best for: [Recommended scenario]

2. **[Palette Name]** ([style])
   [Description]
   Best for: [Scenario]

3. **[Palette Name]** ([style])
   [Description]
   Best for: [Scenario]

4. **[Palette Name]** ([style])
   [Description]
   Best for: [Scenario]

5. **[Palette Name]** ([style])
   [Description]
   Best for: [Scenario]

Which style would you like? (1-5)"
```

**Matching keywords to palettes**:

| User Keywords | Search in palettes.md Tags |
|---------------|---------------------------|
| tech, modern, dark | dark, tech, professional |
| professional, corporate | professional, business, light |
| creative, bold, vibrant | neon, cyberpunk, colorful |
| natural, organic, calm | nature, green, soft |
| minimal, clean, simple | minimal, black-white, light |
| luxury, premium | gold, metallic, luxury |

**User selects a number (1-5)** → Capture in context.md

### Phase 4: Content Depth (Conditional)

**Trigger**: Based on topic complexity

```
Q6: "What are 3-5 key points to cover?"
    [Helps structure the presentation]

Q7: "Any specific data or statistics to include?"
    - Yes, I have data → [Ask for details]
    - Research needed → [Trigger research workflow]
    - No data needed → [Skip]
```

### Phase 5: Research Checkpoint (Conditional)

**Trigger**: When data/research would improve the presentation

```
"This topic would benefit from research. Would you like me to:

[ ] Research current data/statistics
[ ] Find competitive comparisons
[ ] Gather industry trends
[ ] Skip research - I'll provide the content"
```

See [research-templates.md](research-templates.md) for research patterns.

### Phase 6: Advanced Options (Optional)

**Trigger**: Only if user wants more control

```
Q8: "Any brand guidelines or colors to follow?"
    [Optional - for corporate presentations]

Q9: "Reference presentations you like?"
    [Optional - URLs for style calibration]

Q10: "Special requirements?"
    [Optional - constraints, export format, etc.]
```

## Drill-Down Patterns

When users give abstract terms, ask for concrete details:

| User Says | Follow-Up |
|-----------|-----------|
| "Professional" | "Clean and minimal, or rich and detailed?" |
| "Modern" | "Can you point to an example?" |
| "High quality" | "What specific qualities signal that to you?" |
| "Engaging" | "Animations and interactivity, or compelling content?" |
| "Simple" | "Minimal content per slide, or minimal design elements?" |

## Question Best Practices

### Do
- Ask open-ended questions first, then narrow down
- Show visual examples when asking about style
- Ask about past experiences ("What presentations have you liked?")
- Let users skip optional questions
- Confirm understanding before proceeding

### Don't
- Ask more than 5 questions at once
- Use yes/no questions for discovery
- Ask hypothetical questions ("What might resonate?")
- Assume technical knowledge about design
- Skip the style discovery phase

## Context Document Template

After gathering requirements, create `context.md`:

```markdown
# Presentation Context

## Topic
[Main topic and specific focus area from Q1]

## Purpose
- **Goal**: [inform/persuade/demo/report from Q4]
- **Expected outcome**: [what audience should do/know after]

## Audience
- **Primary**: [from Q3]
- **Expertise level**: [beginner/intermediate/expert]
- **Key interests**: [what they care about]

## Key Points
[From Q6 - 3-5 main points]

### [Point 1]
- Detail
- Detail

### [Point 2]
- Detail
- Detail

## Data & Statistics
[From Q7 or research]
- [Stat]: [Source]

## Style (User Selected)
- **Palette ID**: [palette-id from selection]
- **Palette Name**: [Full name]
- **Mode**: [dark/light]
- **Style**: [glass/flat]
- **User Keywords**: [original keywords user provided]
- **Why Selected**: [brief note on why user chose this option]

## Research
- [ ] Completed - see researches/ folder
- [ ] Not needed

## Sources
[Any references provided or researched]

## Notes
[Additional context from conversation]
```

## Example Interaction

```
Claude: "What's this presentation about?"

User: "AI benchmark comparison between Claude and GPT"

Claude: "Who will view this?"
  - Executives / Decision makers
  - Technical team / Developers  ← [User selects]
  - General audience
  - Customers

Claude: "What's the goal?"
  - Inform ← [User selects]
  - Persuade
  - Demo
  - Report

Claude: "Describe the vibe in a few words (e.g., tech, modern, professional)"

User: "tech, modern, dark"

Claude: "Based on 'tech, modern, dark', here are 5 style options:

1. **Dark Sapphire Blue** (glass)
   Dark tech with blue accents, gradient glows
   Best for: Tech products, developer tools

2. **Electric City Nights** (glass)
   Urban dark with vibrant blue highlights
   Best for: Modern SaaS, tech startups

3. **Purple Dark Black Blue** (glass)
   Deep purple-blue, cyberpunk undertones
   Best for: AI/ML, futuristic topics

4. **Hacker News** (glass)
   Dark with orange accents, geek aesthetic
   Best for: Developer content, technical demos

5. **Space** (glass)
   Deep space theme with gold accents
   Best for: Innovation, visionary topics

Which style? (1-5)"

User: "1"

Claude: "Selected: Dark Sapphire Blue"

Claude: "What are 3-5 key points to cover?"

User: "Coding ability, reasoning, context window, speed"

Claude: "This topic would benefit from current benchmark data.
Would you like me to research:
  [ ] Current benchmark statistics
  [ ] Model comparison data
  [ ] Skip research"

User: "Yes, research current benchmarks"

[Claude conducts research, presents findings, then proceeds]
```

## Integration with Workflow

```
Step 1: Initialize Project
    ↓
Step 2: Question Flow (this guide)
    Phase 1 → Phase 2 → Phase 3 → Phase 4
    ↓
Step 2.5: Research (if triggered)
    ↓
Step 3: Create context.md
    ↓
Step 4: Generate slides.md
    ↓
[Continue workflow...]
```
