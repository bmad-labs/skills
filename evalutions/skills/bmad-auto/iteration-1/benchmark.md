# Skill Benchmark: bmad-auto

**Date**: 2026-03-09
**Evals**: 5 scenarios, 1 run each per configuration (with_skill vs without_skill)

## Summary

| Metric              | with_skill | without_skill | Delta    |
|---------------------|------------|---------------|----------|
| Assertion Pass Rate | 100% (16/16) | 56.25% (9/16) | +43.75%  |
| Eval Pass Rate      | 100% (5/5)   | 20% (1/5)     | +80%     |

## Per-Eval Results

| Eval                    | with_skill         | without_skill      | Discriminating? |
|-------------------------|--------------------|--------------------|-----------------|
| resume-in-progress      | 5/5 (100%) PASS    | 3/5 (60%) FAIL     | Yes             |
| missing-sprint-status   | 3/3 (100%) PASS    | 1/3 (33%) FAIL     | Yes (strong)    |
| status-query            | 3/3 (100%) PASS    | 3/3 (100%) PASS    | No (tie)        |
| all-done                | 3/3 (100%) PASS    | 2/3 (67%) FAIL     | Yes             |
| manual-task             | 2/2 (100%) PASS    | 0/2 (0%) FAIL      | Yes (strongest) |

## Key Findings

### Strongest Discriminators
1. **manual-task** (100% vs 0%): Without the skill, the agent immediately halts and asks the user instead of investigating automation options. The skill enforces "automate before asking" (Critical Rule 14) with a two-layer investigation (sub-agent then orchestrator).
2. **missing-sprint-status** (100% vs 33%): Without the skill, the agent creates sprint-status.yaml from scratch and begins implementation. The skill treats the missing file as a hard gate and falls back to bmad-help.

### Skill-Unique Behaviors Not Replicated Without Skill
- **TeamCreate / team_name agent architecture**: Without the skill, agents have no knowledge of the team-based sub-agent pattern.
- **bmad-help fallback**: Three evals test this; without_skill never invokes bmad-help.
- **Automation-first manual task handling**: Without the skill, "manual" labels are accepted at face value.
- **sprint-status.yaml as a hard gate**: Without the skill, the absence is treated as something to fix rather than a stop condition.

### Non-Discriminating Eval
- **status-query**: Both configurations pass all 3 assertions. The without_skill run passes the "no sub-agents" assertion trivially since it has no orchestration architecture. Consider adding assertions for skill-specific behaviors (exact path knowledge, bmad-help fallback, structured status vocabulary).

## Comparison Summary
The blinded A/B comparison confirmed with_skill won all 5 evals. The skill provides substantial value for orchestration scenarios (resume, missing preconditions, manual tasks) and moderate value for completion scenarios (all-done). For simple read-and-report scenarios (status-query), the skill provides guard rails but no measurably different outcome.
