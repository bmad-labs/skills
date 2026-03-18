# Commit Commands for Three Service Changes

All three changes use **non-releasable** commit types because none of them introduce new features, fix bugs, or update dependencies. According to the skill's Conventional Commits guidance:

- **Unit tests only** --> `test` (no release triggered)
- **CI/CD workflow changes** --> `ci` (no release triggered)
- **Code restructuring without behavior change** --> `refactor` (no release triggered)

---

## 1. om-blk-scheduler-service -- Added unit tests for cron parser

```bash
cd services/om-blk-scheduler-service
git add src/scheduler/cron-parser.spec.ts
git commit -m "test(scheduler): add unit tests for cron expression parser"
```

**Type rationale**: `test` -- this is a test-only addition with no production code changes. Non-releasable.

---

## 2. om-newblink-github-workflow -- Updated CI workflow

```bash
cd services/om-newblink-github-workflow
git add .github/workflows/ci.yml
git commit -m "ci: update CI workflow configuration"
```

**Type rationale**: `ci` -- this changes CI/CD pipeline configuration only. Non-releasable.

---

## 3. om-newblink-bl-service -- Refactored booking date utility (no behavior change)

```bash
cd services/om-newblink-bl-service
git add src/booking/date.util.ts
git commit -m "refactor(booking): restructure date utility without behavior change"
```

**Type rationale**: `refactor` -- code restructuring with no functional change. Non-releasable.

---

## Key Points Applied from the Skill

1. **Each commit is made inside its respective service directory** -- submodules have independent git histories.
2. **Specific files are added** (`git add <file>`) rather than `git add .` or `git add -A`, per safety rule #5.
3. **Conventional Commits format** is used (`type(scope): description`) for release-please compatibility.
4. **No `Co-Authored-By` trailers** are included, per safety rule #9.
5. **All three types are non-releasable** (`test`, `ci`, `refactor`) -- none of these commits alone will trigger a release-please release PR.
6. **Imperative, present tense** is used in descriptions ("add", "update", "restructure"), first letter lowercase, no trailing period.
7. **Scopes are domain/module names** (`scheduler`, `booking`), not ticket IDs or service names.
