# Research Templates

> Structured templates for different research types

## When to Research

**Offer research when**:
- Topic involves comparisons (A vs B)
- User mentions data/statistics/benchmarks
- Topic is current events or recent technology
- User explicitly asks about facts they don't have

**Skip research when**:
- User provides their own data
- Topic is personal/internal (team retrospective)
- User explicitly says "no research needed"

## Research Workflow

```
1. Identify Knowledge Gaps
   ↓
2. Ask User Permission
   "Would you like me to research [specific topic]?"
   ↓
3. Conduct Targeted Research
   - Use web search for current data
   - Cross-reference multiple sources
   ↓
4. Document Findings
   - Save to researches/ folder
   - Include all sources
   ↓
5. Present Summary to User
   "I found the following. Does this look accurate?"
   ↓
6. Update context.md
   - Add verified data with citations
```

## Template A: Statistics & Data

Use when: Presentation needs specific numbers, metrics, or benchmarks

```markdown
# Research: Statistics for [Topic]

## Date: YYYY-MM-DD

## Research Questions
- What are current metrics for [X]?
- What are industry benchmarks?
- How has [metric] changed over time?

## Data Collection

| Metric | Value | Source | Date | Confidence |
|--------|-------|--------|------|------------|
| [Metric 1] | [Value] | [Source URL] | [Date] | High/Medium/Low |
| [Metric 2] | [Value] | [Source URL] | [Date] | High/Medium/Low |

## Verification Checklist
- [ ] Data is recent (within 6 months)
- [ ] Source is authoritative (official docs, reputable publication)
- [ ] Cross-referenced with at least one other source
- [ ] No obvious bias in source

## Key Findings
[2-3 sentence summary of most important data]

## Sources
1. [Title](URL) - [Brief description of source authority]
2. [Title](URL) - [Brief description]

## Notes for Slides
- Use [specific stat] for the metrics slide
- Highlight [trend] in the growth section
- Compare [A] vs [B] using these numbers
```

## Template B: Competitive Analysis

Use when: Comparing products, technologies, or approaches

```markdown
# Research: Comparison - [A] vs [B]

## Date: YYYY-MM-DD

## Research Questions
- What are the key differences between [A] and [B]?
- What are each's strengths and weaknesses?
- Which is better for [specific use case]?

## Comparison Matrix

| Feature | [A] | [B] | Notes |
|---------|-----|-----|-------|
| [Feature 1] | [Value/Rating] | [Value/Rating] | [Context] |
| [Feature 2] | [Value/Rating] | [Value/Rating] | [Context] |
| [Feature 3] | [Value/Rating] | [Value/Rating] | [Context] |
| Price | [Price] | [Price] | |
| Best For | [Use case] | [Use case] | |

## [A] Analysis
**Strengths**:
- [Strength 1]
- [Strength 2]

**Weaknesses**:
- [Weakness 1]
- [Weakness 2]

**Source**: [URL]

## [B] Analysis
**Strengths**:
- [Strength 1]
- [Strength 2]

**Weaknesses**:
- [Weakness 1]
- [Weakness 2]

**Source**: [URL]

## Key Findings
[Summary: When to choose A vs B]

## Sources
1. [Title](URL)
2. [Title](URL)

## Notes for Slides
- Lead with [most differentiating feature]
- Use comparison table on slide [X]
- Highlight [winner] for [specific criteria]
```

## Template C: Trends & Forecasts

Use when: Presenting industry trends, market outlook, or predictions

```markdown
# Research: Trends in [Topic]

## Date: YYYY-MM-DD

## Research Questions
- What's the current state of [topic]?
- What are emerging patterns?
- What do experts predict for the next [timeframe]?

## Current State
[2-3 paragraphs summarizing where things stand today]

**Key Statistics**:
- [Stat 1] - Source: [URL]
- [Stat 2] - Source: [URL]

## Emerging Trends

### Trend 1: [Name]
[Description of the trend]
- Evidence: [Data point or example]
- Source: [URL]

### Trend 2: [Name]
[Description]
- Evidence: [Data point]
- Source: [URL]

### Trend 3: [Name]
[Description]
- Evidence: [Data point]
- Source: [URL]

## Expert Predictions

> "[Quote about future direction]"
> — [Expert Name], [Title/Organization]

> "[Another perspective]"
> — [Expert Name], [Title/Organization]

## Timeline (if applicable)

| Timeframe | Expected Development |
|-----------|---------------------|
| Now | [Current state] |
| 6 months | [Near-term prediction] |
| 1 year | [Medium-term prediction] |
| 2+ years | [Long-term prediction] |

## Key Findings
[Summary of most important trends and predictions]

## Sources
1. [Title](URL)
2. [Title](URL)

## Notes for Slides
- Open with [current state stat]
- Feature [Trend 1] as the main narrative
- Close with [key prediction]
```

## Template D: Quick Facts

Use when: Need simple facts without deep analysis

```markdown
# Research: Quick Facts - [Topic]

## Date: YYYY-MM-DD

## Facts Needed
- [ ] [Fact question 1]
- [ ] [Fact question 2]
- [ ] [Fact question 3]

## Findings

| Question | Answer | Source |
|----------|--------|--------|
| [Question 1] | [Answer] | [URL] |
| [Question 2] | [Answer] | [URL] |
| [Question 3] | [Answer] | [URL] |

## Notes for Slides
[How to use these facts in the presentation]
```

## File Naming Convention

```
researches/
├── YYYY-MM-DD-main-topic.md         # Primary research
├── YYYY-MM-DD-statistics.md         # Data/numbers focused
├── YYYY-MM-DD-comparison.md         # A vs B analysis
├── YYYY-MM-DD-trends.md             # Industry trends
└── YYYY-MM-DD-quick-facts.md        # Simple fact lookup
```

## Quality Checklist

Before using researched data in slides:

**Source Quality**:
- [ ] Official documentation or reputable publication
- [ ] Author/organization is authoritative
- [ ] No obvious marketing bias

**Data Freshness**:
- [ ] Published within last 6 months (for fast-moving fields)
- [ ] Published within last 12 months (for stable fields)
- [ ] Date is clearly stated

**Verification**:
- [ ] Cross-referenced with at least one other source
- [ ] Numbers are plausible and consistent
- [ ] Context is understood (not taken out of context)

**Red Flags** (avoid these sources):
- Blog posts without citations
- Marketing materials as data sources
- Single-source claims for important stats
- Undated content
- Anonymous or unverifiable authors

## Presenting Research to User

After completing research, summarize findings:

```
I researched [topic] and found:

**Key Data**:
- [Most important stat 1]
- [Most important stat 2]
- [Most important stat 3]

**Sources**: [List main sources]

Does this look accurate? Should I incorporate this data?
```

Wait for user confirmation before proceeding.
