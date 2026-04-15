# Trade-off Analysis Quality Checklist

Run this checklist after the trade-off document is generated. Load `./data/validation-checklist.csv` for the full check list with severities.

## Quick Validation (Must Pass)

### Structure Checks
- [ ] Document has metadata header (System, Date, Author)
- [ ] Table of Contents matches actual section numbers
- [ ] Executive Summary has: Key Finding + Bottom Line + Summary Table
- [ ] All options defined in Section 3 before they appear in scoring
- [ ] Master Comparison Matrix present with complete star ratings
- [ ] Per-Dimension Detail Tables exist for every scored dimension
- [ ] Risk Assessment has Risk Matrix table
- [ ] Recommendation section with numbered rationale
- [ ] References section with hyperlinks

### Scoring Checks
- [ ] Star ratings use consistent scale (— through ★★★★★)
- [ ] No gaps in the matrix — every option scored on every dimension
- [ ] Each score is justified by its per-dimension detail table
- [ ] Recommendation Summary ranks options
- [ ] No dimension has identical scores across all options (non-discriminating)

### Content Checks
- [ ] Option labels consistent across ALL sections (A, B, C... same everywhere)
- [ ] Each option described with: summary, architecture/approach, key advantage, key risk
- [ ] Per-dimension tables have a Pattern/Assessment paragraph explaining the insight
- [ ] Risk Matrix has: Risk, Likelihood, Impact, Options Affected, Mitigation
- [ ] Factual claims cite sources with hyperlinks
- [ ] Conflicting sources noted explicitly (both cited, conflict explained)

### Quality Checks
- [ ] Executive Summary readable standalone (reader gets the answer from section 1)
- [ ] Document flows top-down: helicopter view first, details later
- [ ] No duplicate content between Matrix and Detail Tables
- [ ] Recommendation aligns with scoring (or deviation explicitly justified)
- [ ] Phased delivery described if applicable
- [ ] Related documents cross-referenced

## Fix Process

For each failed check:
1. Identify the specific location in the document
2. Fix the issue
3. Re-verify the fix doesn't break adjacent content
4. Re-run the checklist until all checks pass
