# bmad-auto Iteration 3 — Quick Flow Benchmark

**Focus:** Verifying optimized skill (knowledge base support, bug fixes, size reduction 787→439 lines) maintains quality

## Summary

| Configuration | Pass Rate | Passed | Total |
|--------------|-----------|--------|-------|
| **with_skill** | **100%** | 20 | 20 |
| without_skill | 20% | 4 | 20 |
| **Delta** | **+80pp** | | |

## Comparison with Iteration 2

| Metric | Iteration 2 | Iteration 3 | Change |
|--------|-------------|-------------|--------|
| with_skill pass rate | 100% | 100% | No change |
| without_skill pass rate | 20% | 20% | No change |
| Delta | +80pp | +80pp | Stable |

**No regressions detected.** The optimized skill maintains identical pass rates.

## Per-Eval Breakdown

| Eval | with_skill | without_skill | Delta |
|------|-----------|---------------|-------|
| 6: spec-path | 5/5 (100%) | 2/5 (40%) | +60pp |
| 7: spec-and-implement | 4/4 (100%) | 0/4 (0%) | +100pp |
| 8: find-existing-spec | 3/3 (100%) | 1/3 (33%) | +67pp |
| 9: inline-spec | 4/4 (100%) | 0/4 (0%) | +100pp |
| 10: scope-escalation | 4/4 (100%) | 1/4 (25%) | +75pp |

## Timing

| Configuration | Mean Tokens | Mean Duration |
|--------------|-------------|---------------|
| with_skill | 20,765 | 89.3s |
| without_skill | 12,001 | 42.9s |

The with_skill runs use ~1.7x more tokens and ~2.1x more time, which is expected — the skill file adds context and the execution plans are more detailed with structured sub-agent orchestration.

## Changes Since Iteration 2

The skill was optimized between iterations 2 and 3:

1. **Size reduction**: 787 → 439 lines (extracted collaborative escalation to reference file, introduced `{AGENT_HEADER}` template)
2. **Bug fixes**: Added timeout handling, retry counting, epic status loop guard, unknown status catch-all, collaboration round definition
3. **Knowledge base support**: Added scanning for `project-context.md` + custom sources (`.knowledge-base/`, `.memory/`, `.knowledge/`, `.standards/`, `.conventions/`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`)
4. **`{CONTEXT_BLOCK}` template**: Sub-agents making implementation decisions now receive `{KNOWLEDGE_PATHS}` for project-specific rules

## Analysis

### Consistent with Iteration 2

All assertion results match iteration 2 exactly — same 4 baseline passes, same 16 skill-only passes. This confirms:
- The size reduction did not lose critical instruction content
- The `{AGENT_HEADER}` abstraction works as intended
- Moving collaborative escalation to a reference file doesn't affect Quick Flow behavior

### Baseline assertions that still pass (4/20)

Same as iteration 2 — these pass because they test general agent behavior:
- `reads_tech_spec` — Any agent reads a file when given a path
- `skips_phase4_startup` — Without sprint-status.yaml, there's nothing to check
- `does_not_create_new_spec` — Common sense: user says spec exists, don't create a new one
- `detects_scope_escalation` — General agents can recognize "this is too big" reports

### Non-discriminating assertions

`detects_scope_escalation` passes in both configurations (eval 10). However, the downstream behavior differs significantly — with_skill offers structured light/heavy options while without_skill prescribes a single path.
