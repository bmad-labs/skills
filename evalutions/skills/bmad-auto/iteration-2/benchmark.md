# bmad-auto Iteration 2 — Quick Flow Benchmark

**Focus:** Evaluating the new Quick Flow support added to bmad-auto skill

## Summary

| Configuration | Pass Rate | Passed | Total |
|--------------|-----------|--------|-------|
| **with_skill** | **100%** | 20 | 20 |
| without_skill | 20% | 4 | 20 |
| **Delta** | **+80pp** | | |

## Per-Eval Breakdown

| Eval | with_skill | without_skill | Delta |
|------|-----------|---------------|-------|
| 6: spec-path | 5/5 (100%) | 2/5 (40%) | +60pp |
| 7: spec-and-implement | 4/4 (100%) | 0/4 (0%) | +100pp |
| 8: find-existing-spec | 3/3 (100%) | 1/3 (33%) | +67pp |
| 9: inline-spec | 4/4 (100%) | 0/4 (0%) | +100pp |
| 10: scope-escalation | 4/4 (100%) | 1/4 (25%) | +75pp |

## Analysis

### What the skill adds (vs baseline)

1. **Flow Detection** — The skill correctly routes to Quick Flow in all 5 scenarios. Without the skill, the agent has no concept of "Quick Flow" vs "Phase 4" and processes requests generically.

2. **Structured Orchestration** — The skill enforces a 5-step pipeline (spec → implement → review → validate → commit) with team-based sub-agents. Without the skill, the agent jumps straight to implementation with no review gates.

3. **Canonical Paths** — The skill knows to search `_bmad-output/implementation-artifacts/tech-spec-*.md` for existing specs. Without the skill, the agent does broad file searches with no guaranteed location.

4. **Scope Escalation** — The skill provides a formal escalation path with light/heavy options and work preservation guarantees. Without the skill, the agent's response to scope creep is ad-hoc.

5. **Inline Spec Handling** — The skill saves inline specs to a canonical location before proceeding. Without the skill, the agent implements directly from the prompt with no persistent spec artifact.

### Baseline assertions that still pass (4/20)

These pass because they test general agent behavior that doesn't require skill guidance:
- `reads_tech_spec` — Any agent would read a file when given a path
- `skips_phase4_startup` — Without sprint-status.yaml, there's nothing to check
- `does_not_create_new_spec` — Common sense: user says spec exists, don't create a new one
- `waits_for_user_decision` — General agent pattern: report issues, wait for input

### Non-discriminating assertions

None — all assertions show meaningful discrimination between with/without skill.
