---
name: 'step-07-validation'
description: 'Run the quality checklist against the generated document and fix issues'
nextStepFile: './step-08-complete.md'
outputFile: '{{output_file}}'
---

# Step 7: Validation

**Progress: Step 7 of 8** - Next: Complete

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
- Update frontmatter adding `step-07-validation` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: the complete generated trade-off document from Step 6
- You have: validation-checklist.csv with all quality checks and severities
- You have: the output document at {{output_file}}
- This step READS and FIXES the document — it does not generate new analysis

## YOUR TASK:
Run every quality check from the validation checklist against the generated document, report results, fix critical and high-severity failures, and achieve a passing grade.

## EXECUTION SEQUENCE:

### 1. Load Validation Resources

- Read `validation-checklist.csv` from the skill's data directory completely
- Read the generated output document at `{{output_file}}` completely
- If a `quality-checklist.md` exists in the skill's `references/` directory, read it as well

### 2. Run All Checks

For EVERY check in the validation checklist, evaluate the document. Organize results by severity:

**Check evaluation process:**
For each check_id (C01 through C28):
1. Read the check description
2. Examine the relevant section(s) of the generated document
3. Determine: PASS or FAIL
4. If FAIL: note what is wrong and where

### 3. Present Validation Report

Present results in a structured format:

> **Validation Report**
>
> **CRITICAL checks ([pass_count]/[total_critical]):**
> | Check | Description | Result | Issue |
> |-------|------------|--------|-------|
> | C01 | Document has metadata header | :white_check_mark: PASS | — |
> | C02 | TOC matches actual sections | :x: FAIL | Section 5.3 missing from TOC |
> | ... | ... | ... | ... |
>
> **HIGH checks ([pass_count]/[total_high]):**
> | Check | Description | Result | Issue |
> |-------|------------|--------|-------|
> | C07 | Risk Assessment with Risk Matrix table | :white_check_mark: PASS | — |
> | ... | ... | ... | ... |
>
> **WARNING checks ([pass_count]/[total_warning]):**
> | Check | Description | Result | Issue |
> |-------|------------|--------|-------|
> | C15 | No dimension scored identically across all options | :x: FAIL | "Cost" dimension: all ★★★☆☆ |
> | ... | ... | ... | ... |
>
> **Overall: [total_pass]/[total_checks] checks passed**

### 4. Fix CRITICAL Failures

For each CRITICAL check that failed:
- Identify exactly what needs to change in the document
- Make the fix directly in the output file
- Log the fix:

> **Fixing CRITICAL issues:**
> - C02: Added missing Section 5.3 to Table of Contents
> - C12: Filled blank cell for Option C on "Security Posture" dimension — scored ★★★☆☆ based on [research finding]
> - ...

### 5. Fix HIGH Failures

For each HIGH check that failed:
- Identify the fix needed
- Make the fix directly in the output file
- Log the fix:

> **Fixing HIGH issues:**
> - C10: Added 3 missing source hyperlinks to References section
> - C17: Added "key risk" field to Option D which was missing it
> - ...

### 6. Handle WARNING Failures

For WARNING-level failures, present them to the user for a decision:

> **WARNING issues found (optional fixes):**
>
> - **C15**: Dimension "Cost" scored identically (★★★☆☆) for all options — this dimension does not differentiate. **Remove it or adjust scores?**
> - **C25**: Some content in the matrix repeats in the detail tables. **Reduce overlap?**
>
> Which warnings should I fix? Or say "skip" to leave them as-is.

Apply user-requested fixes.

### 7. Re-Run Validation

After all fixes are applied, re-run the FULL checklist:
- All CRITICAL checks MUST pass
- All HIGH checks MUST pass
- WARNING checks: report status but do not block

If any CRITICAL or HIGH check still fails after fixes, repeat the fix cycle (max 2 iterations).

Present the final validation result:

> **Re-Validation Results:**
> - CRITICAL: [count]/[total] passed :white_check_mark:
> - HIGH: [count]/[total] passed :white_check_mark:
> - WARNING: [count]/[total] passed (non-blocking)
>
> **Validation status: [PASSED / FAILED]**

### 8. Update Frontmatter

```yaml
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
  - step-03-light-research
  - step-04-deep-research
  - step-05-dimensions
  - step-06-generation
  - step-07-validation
validationResult:
  status: 'passed'
  criticalPassed: [count]/[total]
  highPassed: [count]/[total]
  warningPassed: [count]/[total]
  fixesApplied: [count]
  validatedAt: '[timestamp]'
```

### 9. Present MENU OPTIONS

> **Validation complete.** The document has passed all critical and high-severity quality checks.
>
> - **Fixes applied**: [count] issues fixed automatically
> - **Final score**: [pass_count]/[total_checks] checks passed
>
> **[C] Complete (Step 8 of 8)**

## SUCCESS METRICS:
- :white_check_mark: Every check in validation-checklist.csv evaluated (none skipped)
- :white_check_mark: All CRITICAL checks pass (mandatory)
- :white_check_mark: All HIGH checks pass (mandatory)
- :white_check_mark: WARNING failures presented to user for decision
- :white_check_mark: Fixes are evidence-based (not just patching to pass the check)
- :white_check_mark: Re-validation confirms all fixes are effective
- :white_check_mark: Validation results recorded in frontmatter

## FAILURE MODES:
- :x: Skipping checks or evaluating only a subset
- :x: Marking a check as PASS when the document clearly fails it
- :x: Fixing a score without research justification (just changing numbers to pass)
- :x: Not re-running validation after making fixes
- :x: Proceeding with CRITICAL or HIGH failures unresolved
- :x: Skipping to the next step before user selects [C]
