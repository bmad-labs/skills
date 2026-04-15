---
name: 'step-06-generation'
description: 'Generate the complete trade-off document content including executive summary, matrix, detail tables, risk, and recommendation'
nextStepFile: './step-07-validation.md'
outputFile: '{{output_file}}'
---

# Step 6: Scoring & Generation

**Progress: Step 6 of 8** - Next: Validation

## MANDATORY EXECUTION RULES (READ FIRST):

- :stop_sign: NEVER generate content without user input/confirmation
- :rotating_light: CRITICAL: ALWAYS read the complete step file before taking any action
- :rotating_light: CRITICAL: When loading next step with 'C', ensure entire file is read
- :brain: YOU ARE A FACILITATOR, not a content generator
- :speech_balloon: YOU MUST ALWAYS SPEAK OUTPUT in your communication style

## EXECUTION PROTOCOLS:
- Show analysis before taking action
- Present [C] continue after content is ready
- ONLY proceed when user selects C
- Update frontmatter adding `step-06-generation` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: ALL context from Steps 1-5 (topic, options, dimensions, research, expectations)
- You have: ALL research documents loaded in context
- You have: validation-checklist.csv (know what the final doc must look like)
- You MUST read scoring-guide.md (if it exists in references/) BEFORE generating scores
- This is the ONLY step that generates the actual document content

## YOUR TASK:
Generate the complete trade-off analysis document, section by section, following the standard structure and ensuring all scores are evidence-based.

## EXECUTION SEQUENCE:

### 1. Prepare for Generation

Before writing anything:
- Confirm all research documents are loaded in context
- Check if a `scoring-guide.md` exists in the skill's `references/` directory — if yes, read it completely
- Review the validation-checklist.csv to understand what the document must contain
- Announce to the user:

> I am now generating the trade-off analysis document. This will include:
> 1. Executive Summary
> 2. Context & Problem Statement
> 3. Technology Options
> 4. Master Comparison Matrix
> 5. Per-Dimension Detail Tables
> 6. Risk Assessment
> 7. Implementation Complexity
> 8. Recommendation
> 9. References
> 10. Appendix: Technical & Business Context (makes the document self-contained)
>
> I will write each section to the document. This may take a moment.

### 2. Generate Section 1: Executive Summary

Write to the output document after the frontmatter:

```markdown
# Trade-Off Analysis: [Topic]

**System:** [System/Project Name]
**Date:** [Current Date]
**Author:** [Author]

## Table of Contents
[Generate TOC with numbered anchors matching actual sections]

## 1. Executive Summary

### Key Finding
[One paragraph: what was evaluated, what was found, what is recommended]

### Bottom Line
[One bold sentence: the recommendation and primary reason]

### Summary Table
| Rank | Option | Overall Assessment | Best For |
|------|--------|--------------------|----------|
| 1 | [Name] | [Star rating] | [One-line use case] |
| 2 | [Name] | [Star rating] | [One-line use case] |
| ... | ... | ... | ... |
```

### 3. Generate Section 2: Context & Problem Statement

```markdown
## 2. Context & Problem Statement

### Decision Context
[Why this analysis exists — from discovery and expectations]

### Requirements
[Key requirements derived from decision criteria and constraints]

### Scope
[What is in scope, what is not]
```

### 4. Generate Section 3: Technology Options

For each option, write:

```markdown
## 3. Technology Options

### Option A: [Name]
- **Description**: [What it is, 2-3 sentences]
- **Approach**: [How it solves the problem]
- **Key Advantage**: [Primary strength]
- **Key Risk**: [Primary concern]
```

**CRITICAL**: Use IDENTICAL labels (A, B, C...) as established in Step 3 and maintained through all subsequent steps.

### 5. Generate Section 4: Master Comparison Matrix

Generate the star-rated comparison grid:

```markdown
## 4. Master Comparison Matrix

| Dimension | [Option A] | [Option B] | [Option C] | ... |
|-----------|-----------|-----------|-----------|-----|
| [Dim 1] | ★★★★☆ | ★★★☆☆ | ★★★★★ | ... |
| [Dim 2] | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ... |
| ... | ... | ... | ... | ... |
```

**SCORING RULES:**
- Use a consistent 5-star scale: — (not applicable), ★☆☆☆☆ (poor), ★★☆☆☆ (below average), ★★★☆☆ (average), ★★★★☆ (good), ★★★★★ (excellent)
- Every dimension MUST be scored for every option — NO blank cells
- Scores MUST be justified by research evidence, not assumptions
- At least one dimension should differentiate between options (not all same score)
- If two options score identically on everything, question whether they are truly different

### 6. Generate Section 5: Per-Dimension Detail Tables

For EACH dimension in the matrix, generate a detail subsection:

```markdown
## 5. Detailed Dimension Analysis

### 5.1 [Dimension Name]

| Aspect | [Option A] | [Option B] | [Option C] | Verdict |
|--------|-----------|-----------|-----------|---------|
| [Aspect 1] | [Detail] | [Detail] | [Detail] | [Which wins] |
| [Aspect 2] | [Detail] | [Detail] | [Detail] | [Which wins] |
| [Aspect 3] | [Detail] | [Detail] | [Detail] | [Which wins] |

**Pattern:** [One paragraph explaining the overall pattern — why scores differ, what the trade-off actually is, what matters most in this dimension]
```

### 7. Generate Section 6: Risk Assessment

```markdown
## 6. Risk Assessment

### Risk Matrix

| Risk | Likelihood | Impact | Options Affected | Mitigation |
|------|-----------|--------|-----------------|------------|
| [Risk 1] | High/Medium/Low | High/Medium/Low | A, B | [How to mitigate] |
| [Risk 2] | ... | ... | ... | ... |
```

Include topic-specific risks (e.g., vendor lock-in for build_vs_buy, data loss for migration_strategy).

### 8. Generate Section 7: Implementation Complexity

```markdown
## 7. Implementation Complexity

| Factor | [Option A] | [Option B] | [Option C] |
|--------|-----------|-----------|-----------|
| Estimated Effort | [T-shirt size + detail] | ... | ... |
| Skills Required | [What the team needs] | ... | ... |
| Skills Gap | [What is missing] | ... | ... |
| Timeline Estimate | [Rough estimate] | ... | ... |
| Migration Path | [How to get there from current state] | ... | ... |
```

### 9. Generate Section 8: Recommendation

```markdown
## 8. Recommendation

### Primary Recommendation: [Option X] — [Name]

**Rationale:**
1. [Reason 1 — tied to highest-priority decision criterion]
2. [Reason 2 — evidence from research]
3. [Reason 3 — risk/practical consideration]

### Alternative: [Option Y] — [Name]
[When this option would be better — specific conditions]

### Phased Delivery (if applicable)
| Phase | Action | Timeline | Risk |
|-------|--------|----------|------|
| 1 | [Start with...] | [When] | [Risk level] |
| 2 | [Then...] | [When] | [Risk level] |
```

**CRITICAL**: The recommendation MUST align with the scoring. If the recommended option is NOT the highest-scored option, explicitly explain why (e.g., weighting, a critical dimension overrides).

### 10. Generate Section 9: References

```markdown
## 9. References

### Sources
- [Source 1 title](URL) — [what it was used for]
- [Source 2 title](URL) — [what it was used for]

### Related Documents
- [Link to research documents created in Step 4]
- [Link to any discovered documents from Step 1]
```

### 11. Generate Section 10: Appendix — Technical & Business Context

The Appendix makes the document **self-contained**. When someone receives this trade-off analysis without the supporting research files, they should still understand the technical and business context behind each option and score.

```markdown
## 10. Appendix: Technical & Business Context

This appendix provides the technical and business background necessary to understand the options and scores in this analysis. It consolidates key findings from the research phase so this document is self-contained.
```

Generate the following subsections based on what the research uncovered. Include ONLY subsections that are relevant — skip any that don't apply.

#### A. Technology Deep Dives (if options involve unfamiliar technologies)

For each option that uses a technology the reader may not know, write a subsection explaining:
- What the technology is and how it works (2-3 paragraphs)
- Key technical constraints or limitations the reader needs to understand
- Code examples or configuration samples if they clarify the approach
- Official documentation links

```markdown
### A.1 [Technology Name] — How It Works

[Explanation at developer level — enough for someone unfamiliar to understand the scoring]

**Key constraints:**
- [Constraint 1]
- [Constraint 2]

**Example:**
[Code block or configuration if helpful]

**Official docs:** [hyperlink]
```

#### B. Compatibility / Support Matrix (if options have platform-dependent behavior)

If the analysis involves technology that behaves differently across platforms, clients, or environments (like email clients, browsers, database engines, cloud providers), include a verified compatibility matrix:

```markdown
### B. [Platform/Client] Compatibility Matrix

| Platform | Option A | Option B | Option C | Source |
|----------|---------|---------|---------|--------|
| [Platform 1] | [behavior] | [behavior] | [behavior] | [hyperlink] |
| [Platform 2] | [behavior] | [behavior] | [behavior] | [hyperlink] |

**Sources conflict on:** [list any conflicts between sources, both cited]
```

#### C. Security & Authentication Details (if security is a differentiating dimension)

```markdown
### C. Security Architecture Details

[Explain the auth mechanisms, token flows, CORS requirements, or encryption approaches that differ between options. Include enough detail that a security reviewer can assess the scoring without reading the research docs.]
```

#### D. Cost Breakdown (if cost is a differentiating dimension)

```markdown
### D. Detailed Cost Analysis

| Cost Component | Option A | Option B | Option C |
|---------------|---------|---------|---------|
| [License/subscription] | [amount] | [amount] | [amount] |
| [Infrastructure] | [amount] | [amount] | [amount] |
| [Development labor] | [amount] | [amount] | [amount] |
| **Annual Total** | **[amount]** | **[amount]** | **[amount]** |
```

#### E. Glossary (if domain-specific terminology is used)

```markdown
### E. Glossary

| Term | Definition |
|------|-----------|
| [Term 1] | [Brief definition relevant to this analysis] |
| [Term 2] | [Brief definition] |
```

#### F. Verified Source Summary (always include)

```markdown
### F. Verified Source Summary

All factual claims in this document are sourced from the following. Where sources conflict, both are cited and the conflict is noted.

#### Primary Sources (Official Documentation)

| Source | URL | What it covers | Last verified |
|--------|-----|---------------|--------------|
| [Name] | [URL] | [Brief description] | [Date] |

#### Community / Third-Party Sources

| Source | URL | What it covers | Caveat |
|--------|-----|---------------|--------|
| [Name] | [URL] | [Brief description] | [Any reliability concern] |

#### Key Conflicts Between Sources

| Claim | Source A says | Source B says | Resolution |
|-------|-------------|-------------|-----------|
| [Claim] | [Position] | [Position] | [How we resolved it / "Must verify"] |
```

**CRITICAL PRINCIPLE:** The Appendix exists so the document can travel alone. A reader who receives ONLY this trade-off analysis (without research files, without context from the person who created it) should be able to:
1. Understand what each option actually is (Technology Deep Dives)
2. Verify that the compatibility claims are sourced (Compatibility Matrix)
3. Assess the security implications (Security Details)
4. Understand the cost basis (Cost Breakdown)
5. Look up unfamiliar terms (Glossary)
6. Trace every factual claim to its source (Verified Source Summary)

### 12. Update Frontmatter

Update stepsCompleted and add generation metadata:

```yaml
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
  - step-03-light-research
  - step-04-deep-research
  - step-05-dimensions
  - step-06-generation
generatedAt: '[timestamp]'
recommendation: '[Option X - Name]'
```

### 12. Present MENU OPTIONS

> **Document generated.** The complete trade-off analysis has been written to `{{output_file}}`.
>
> **Summary:**
> - [count] options compared across [count] dimensions
> - Recommendation: **[Option X — Name]**
> - [count] risks identified with mitigations
>
> Next, I will run the quality validation checklist to ensure the document meets all standards.
>
> **[C] Continue to Validation (Step 7 of 8)**

## SUCCESS METRICS:
- :white_check_mark: All 10 sections generated with complete content (including Appendix)
- :white_check_mark: Star ratings consistent throughout (5-star scale, no gaps)
- :white_check_mark: Every dimension scored for every option in the matrix
- :white_check_mark: Per-dimension detail tables present for EVERY scored dimension
- :white_check_mark: Recommendation aligns with scoring or deviation is explained
- :white_check_mark: Option labels consistent across ALL sections (A, B, C...)
- :white_check_mark: Sources cited with hyperlinks
- :white_check_mark: Executive Summary is standalone-readable

## FAILURE MODES:
- :x: Generating scores not backed by research evidence
- :x: Missing per-dimension detail tables for scored dimensions
- :x: Recommendation contradicts scoring without explanation
- :x: Inconsistent option labels across sections
- :x: Blank cells in the comparison matrix
- :x: Executive Summary that requires reading later sections to understand
- :x: Skipping to the next step before user selects [C]
