# Trade-off Scoring Guide

This guide defines how to evaluate options and assign star ratings in trade-off analysis documents.

## Star Rating Scale

| Rating | Meaning | When to Use |
|--------|---------|------------|
| ★★★★★ | Excellent | The option excels in this dimension with no meaningful caveats. Best-in-class. |
| ★★★★ | Good | Strong performance with minor caveats or workarounds needed. |
| ★★★ | Adequate | Meets requirements but with significant caveats, moderate effort, or partial coverage. |
| ★★ | Weak | Partially works but has notable gaps, reliability issues, or high effort/risk. |
| ★ | Poor | Barely viable; high complexity, high risk, or fundamental limitations. |
| — | Not supported | The option fundamentally cannot address this dimension. Not applicable. |

## Scoring Principles

### 1. Discrimination is the Goal
Every dimension should produce different scores across at least some options. If all options score identically on a dimension, it's not helping the decision — consider removing it or rephrasing it.

### 2. Evidence Over Opinion
Scores must be justifiable by the per-dimension detail table. If you can't explain why Option A gets ★★★★ and Option B gets ★★ in the detail table, the score is wrong. Sources (official docs, test results, benchmarks) make scores defensible.

### 3. Caveats Lower Scores
- "Works but with workaround needed" → ★★★★ (not ★★★★★)
- "Conflicting reports, needs testing" → ★★ or ★★★
- "Works on some platforms, fails on others" → ★★

### 4. Complexity is a Negative
More auth systems, more registrations, more testing surface = lower scores on development dimensions. Simplicity is a feature.

### 5. Risk Adjusts Scores
An option that is theoretically excellent but has a high-probability failure mode should be scored lower than one that reliably delivers a good (not excellent) result.

## Dimension Categories

### Functional Dimensions
Score based on: Does this option deliver the required capability?
- ★★★★★ = Fully delivers with inline feedback, error handling, and stateful behavior
- ★★★★ = Delivers with minor caveats (e.g., needs workaround, partial platform support)
- ★★★ = Partially delivers (e.g., works on some platforms, no feedback mechanism)
- ★★ = Unreliable (e.g., conflicting reports, silent failures on some clients)
- ★ = Barely functional
- — = Does not deliver this capability at all

### Security Dimensions
Score based on: How much risk does this option introduce?
- ★★★★★ = Minimal risk; simple auth; no external dependencies; smallest attack surface
- ★★★★ = Low risk; well-documented auth; one external dependency
- ★★★ = Moderate risk; multiple auth systems but all well-understood
- ★★ = High risk; complex auth (e.g., JWT verification with known pitfalls); vendor dependency
- ★ = Critical risk; 3+ auth systems; security-critical code paths with documented bypass vectors

### Development Dimensions
Score based on: How much effort/complexity does this add?
- ★★★★★ = Minimal effort; zero dependencies; fits existing stack perfectly
- ★★★★ = Low effort; one registration; standard patterns
- ★★★ = Moderate effort; 6-10 weeks; 2 template systems; 1 external registration
- ★★ = High effort; extensive testing matrix; unfamiliar technologies
- ★ = Very high effort; 10+ weeks; 3+ systems; multiple registrations; security-critical code

## Recommendation Logic

The recommendation should NOT always be the highest-scoring option. Consider:

1. **Weighted importance**: Functional dimensions may matter more than development ease
2. **Phased delivery**: A lower-scoring option that enables phased rollout may beat a higher-scoring all-or-nothing option
3. **Risk tolerance**: The user's context determines whether moderate risk is acceptable
4. **Strategic fit**: Long-term direction may justify short-term complexity

When the recommendation differs from the highest total score, explain why explicitly.

## Common Scoring Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| All options get ★★★★★ on a dimension | Non-discriminating; wastes reader's time | Remove dimension or re-scope it |
| Scoring based on marketing claims | Unverified claims aren't evidence | Require source links for factual scores |
| Ignoring conflicting sources | Overly confident score for uncertain data | Score ★★-★★★ and note "conflicting — must test" |
| Scoring security by "feeling safe" | Security needs specific threat analysis | Count auth systems, attack surface, code paths |
| Giving ★★★★★ to complex option on dev effort | Complexity is a cost, not a feature | More systems/registrations = lower score |
