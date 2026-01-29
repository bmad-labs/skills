# Context Collection Guide

> Reference for gathering comprehensive presentation requirements into `context.md`

## Purpose

The `context.md` file captures all knowledge, requirements, and expectations before generating slides. This ensures:
- Consistent output quality
- Clear design direction
- Proper content structure
- User expectations alignment

## Context Collection Workflow

```
Step 1: Identify Topic & Purpose
    ↓
Step 2: Understand Audience
    ↓
Step 3: Gather Content Points
    ↓
Step 4: Research (if needed)
    ↓
Step 5: Define Style & Theme
    ↓
Step 6: Document Sources
    ↓
Step 7: Create context.md
```

## Questions to Ask

### 1. Topic & Purpose

| Question | Why It Matters |
|----------|----------------|
| What is the main topic? | Defines scope and focus |
| What is the purpose? (inform, persuade, demo, report) | Affects tone and structure |
| What action should the audience take after? | Shapes call-to-action |
| Is this a standalone presentation or part of a series? | Affects intro/outro design |

### 2. Audience Analysis

| Question | Why It Matters |
|----------|----------------|
| Who is the primary audience? | Determines complexity level |
| What is their expertise level? (beginner, intermediate, expert) | Affects terminology and depth |
| What do they already know about the topic? | Avoids redundancy |
| What are their pain points or interests? | Makes content relevant |

### 3. Content Depth

| Question | Why It Matters |
|----------|----------------|
| How many slides are appropriate? | Scopes the presentation |
| What are the 3-5 key takeaways? | Focuses content creation |
| Are there specific data points or statistics needed? | Identifies research needs |
| Should it include code examples, diagrams, or charts? | Determines visual assets |

### 4. Style Preferences

| Question | Why It Matters |
|----------|----------------|
| What tone? (professional, casual, energetic, minimal) | Guides design choices |
| Dark or light theme preference? | Affects palette selection |
| Any brand colors or guidelines to follow? | Ensures brand consistency |
| Reference presentations they like? | Clarifies visual expectations |

## context.md Template

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
- **Secondary**: [other potential viewers]
- **Expertise level**: [beginner/intermediate/expert]
- **Key interests**: [what they care about]

## Key Points

### [Section 1 Name]
- Point 1
- Point 2
- Point 3

### [Section 2 Name]
- Point 1
- Point 2

### [Section 3 Name]
- Point 1
- Point 2

## Data & Statistics
- [Stat 1]: [Source]
- [Stat 2]: [Source]
- [Stat 3]: [Source]

## Visual Requirements
- [ ] Code examples
- [ ] Diagrams/flowcharts
- [ ] Charts/graphs
- [ ] Screenshots
- [ ] Custom illustrations

## Style
- **Theme**: [theme-id from palettes.md]
- **Style**: [glass/flat]
- **Tone**: [professional/casual/energetic/minimal]
- **Special effects**: [animations, transitions]

## Constraints
- Time limit: [if presenting live]
- Technical: [screen resolution, offline viewing]
- Branding: [any brand guidelines]

## Sources
- [Source 1]: [URL or reference]
- [Source 2]: [URL or reference]
- [Source 3]: [URL or reference]

## Additional Notes
[Any other relevant context, special requests, or considerations]
```

## Research Integration

When topics require research:

1. **Identify knowledge gaps** during context collection
2. **Document research questions** in context.md under "Research Needed"
3. **Save research findings** to `researches/` folder with timestamps
4. **Update context.md** with validated data and sources

### Research File Naming

```
researches/
├── YYYY-MM-DD-topic-keyword.md    # Main research document
├── YYYY-MM-DD-statistics.md       # Data and statistics
└── YYYY-MM-DD-references.md       # Links and citations
```

## Quality Checklist

Before finalizing context.md:

- [ ] Topic is clearly defined with specific focus
- [ ] Audience is identified with expertise level
- [ ] Key points are limited to 3-5 main themes
- [ ] Data has verified sources
- [ ] Style theme is selected from palettes.md
- [ ] Any research has been documented
- [ ] User has confirmed the context
