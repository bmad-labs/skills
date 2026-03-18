# Grading Results — Iteration 2: Release-Please Commit Messages

## Eval 1: Feature Commit Format

| Assertion | With Skill | Without Skill |
|-----------|:----------:|:-------------:|
| Uses `feat:` or `feat(booking):` type | PASS | PASS |
| Description imperative mood, lowercase | PASS | PASS |
| Description no trailing period | PASS | PASS |
| Includes `Story: 2-4-booking-search` | PASS | PARTIAL (`Ref: BMAD story 2-4-booking-search` — different format) |
| No `Co-Authored-By` | PASS | PASS |
| Adds specific files, not `git add .` | PASS | PASS |

**With Skill: 6/6 | Without Skill: 5/6**

---

## Eval 2: Breaking Change Commit

| Assertion | With Skill | Without Skill |
|-----------|:----------:|:-------------:|
| Contains `!` or `BREAKING CHANGE` footer | PASS (both `!` and footer) | PASS (both `!` and footer) |
| Includes `BREAKING CHANGE:` with migration details | PASS (detailed migration) | PASS (brief but present) |
| Uses `feat` or `refactor` type | PASS (`feat`) | PASS (`feat`) |
| No `Co-Authored-By` | PASS | PASS |
| References story `3-1-auth-migration` | PASS | PASS |

**With Skill: 5/5 | Without Skill: 5/5**

---

## Eval 3: Non-Releasable Commit Types

| Assertion | With Skill | Without Skill |
|-----------|:----------:|:-------------:|
| Uses `test:` for test commit | PASS | PASS |
| Uses `ci:` for CI commit | PASS | PASS |
| Uses `refactor:` for refactor commit | PASS | PASS |
| Does NOT use `feat:` or `fix:` | PASS | PASS |
| No `Co-Authored-By` in any commit | PASS | PASS |
| Each commit in correct service dir | PASS | PASS |

**With Skill: 6/6 | Without Skill: 6/6**

---

## Eval 4: Parent Submodule Pointer Update

| Assertion | With Skill | Without Skill |
|-----------|:----------:|:-------------:|
| Uses `chore:` type for parent commit | PASS | PASS |
| Lists both services in commit body | PASS | PASS |
| No `Co-Authored-By` | PASS | PASS |
| Checks out default branch and pulls | PASS | PASS |
| Uses specific `git add` paths | PASS | PASS |

**With Skill: 5/5 | Without Skill: 5/5**

---

## Eval 5: Dependency Update Commit (**KEY DIFFERENTIATOR**)

| Assertion | With Skill | Without Skill |
|-----------|:----------:|:-------------:|
| Uses `deps:` type | PASS | **FAIL** (used `chore(deps):`) |
| Does NOT use `chore:` or `build:` | PASS | **FAIL** (used `chore`) |
| No `Co-Authored-By` | PASS | **FAIL** (includes `Co-Authored-By: Claude Opus 4.6`) |
| Mentions specific package and version | PASS | PASS |

**With Skill: 4/4 | Without Skill: 1/4**

---

## Summary

| Eval | With Skill | Without Skill | Delta |
|------|:----------:|:-------------:|:-----:|
| 1. Feature commit | 6/6 (100%) | 5/6 (83%) | +17% |
| 2. Breaking change | 5/5 (100%) | 5/5 (100%) | 0% |
| 3. Non-releasable types | 6/6 (100%) | 6/6 (100%) | 0% |
| 4. Parent pointer update | 5/5 (100%) | 5/5 (100%) | 0% |
| 5. Dependency update | 4/4 (100%) | 1/4 (25%) | **+75%** |
| **TOTAL** | **26/26 (100%)** | **22/26 (85%)** | **+15%** |

## Key Findings

### Where the skill made the biggest difference:

1. **Eval 5 (deps update)** — The without-skill agent used `chore(deps):` instead of `deps:`, which is a critical error for release-please. `chore` is non-releasable, so this dependency update would NOT trigger a patch release. The with-skill agent correctly used `deps:` which triggers a patch bump. **This is the most impactful difference — a missed release.**

2. **Eval 5 (Co-Authored-By)** — The without-skill agent added `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` to the commit. This is exactly the pollution the user wanted to prevent. The with-skill agent explicitly omitted it, citing Safety Rule #9.

3. **Eval 1 (story reference format)** — Minor difference: the without-skill agent used `Ref: BMAD story 2-4-booking-search` instead of the standardized `Story: 2-4-booking-search` format.

### Where both performed equally well:

- Breaking change format (Eval 2) — both correctly used `!` and `BREAKING CHANGE:` footer
- Non-releasable types (Eval 3) — both correctly chose `test`, `ci`, `refactor`
- Parent pointer commits (Eval 4) — both used `chore:` with proper structure

### Conclusion

The skill's primary value is in **edge cases that matter most for release-please**: the `deps:` type (which baseline gets wrong) and the `Co-Authored-By` prohibition (which baseline violates). These are exactly the scenarios where incorrect behavior has real consequences — missed releases and polluted changelogs.
