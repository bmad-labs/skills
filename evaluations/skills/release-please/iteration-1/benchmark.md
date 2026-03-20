# release-please Skill — Benchmark (Iteration 1)

## Summary

| Configuration | Pass Rate | Tokens (mean) | Duration (mean) |
|---------------|-----------|---------------|-----------------|
| **with_skill** | **100%** (18/18) | 21,472 | 36.4s |
| without_skill | 85.7% (15/18) | 12,615 | 27.3s |
| **Delta** | **+14.3%** | +70.2% | +33.3% |

## Per-Eval Breakdown

### Eval 1: Node.js Setup

| Assertion | with_skill | without_skill |
|-----------|-----------|--------------|
| correct_release_type | PASS | PASS |
| correct_version (2.1.0) | PASS | PASS |
| has_concurrency | PASS | **FAIL** |
| publish_gated (separate job) | PASS | **FAIL** |
| npm_publish | PASS | PASS |
| has_schema | PASS | PASS |
| bump_minor_pre_major | PASS | **FAIL** |

**Key difference:** Without the skill, the baseline put publish steps inline in the release-please job (per-step `if` guards instead of a separate gated job), omitted the concurrency group entirely, and didn't include `bump-minor-pre-major`. These are all best practices the skill prescribes.

### Eval 2: Commit Message

| Assertion | with_skill | without_skill |
|-----------|-----------|--------------|
| conventional_format | PASS | PASS |
| breaking_indicator | PASS | PASS |
| has_breaking_footer | PASS | PASS |
| imperative_mood | PASS | PASS |
| no_ai_coauthor | PASS | PASS |

**Key difference:** Both produced correct commit messages. The with-skill version included a scope `(api)` and explained version impact. The without-skill version included migration steps in the footer. Both are high quality — commit message guidance is an area where Claude's baseline knowledge is strong.

### Eval 3: Python Monorepo

| Assertion | with_skill | without_skill |
|-----------|-----------|--------------|
| correct_release_type | PASS | PASS |
| two_packages | PASS | PASS |
| has_components | PASS | PASS |
| manifest_matches | PASS | PASS |
| pypi_publish | PASS | PASS |
| per_package_publish | PASS | PASS |

**Key difference:** Both passed all assertions. The with-skill version included concurrency groups (not asserted but a best practice). The without-skill version added extra config like `bootstrap-sha`, `extra-files`, and `changelog-sections` — some of which are unnecessary for this use case.

## Analyst Observations

1. **The skill's primary value is in workflow quality**, not basic correctness. Both versions get the structure right, but the skill ensures best practices (concurrency, publish gating, bump-minor-pre-major) that the baseline misses.

2. **Commit message eval is non-discriminating** — Claude already knows Conventional Commits well. This eval doesn't differentiate skill from baseline. Future iterations could test edge cases (e.g., choosing between `fix` and `refactor`, or multi-scope changes).

3. **Token/time tradeoff is acceptable.** The skill uses ~70% more tokens due to reading the SKILL.md and references, but the duration increase is only ~33% (36s vs 27s). For a setup task done once per project, this overhead is negligible.

4. **Python monorepo eval is also non-discriminating** for assertions tested. Both produced correct output. Additional assertions like `has_concurrency` or `no_unnecessary_config` would better differentiate.
