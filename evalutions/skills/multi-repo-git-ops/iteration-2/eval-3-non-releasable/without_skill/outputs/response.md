# Commit Commands for Three Separate Service Changes

Since this is a multi-repo project using git submodules, each commit must be executed from within the respective submodule directory. All three changes are non-releasable (tests, CI config, refactor with no behavior change).

---

## 1. om-blk-scheduler-service -- Unit tests for cron parser

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service && \
git add src/scheduler/cron-parser.spec.ts && \
git commit -m "$(cat <<'EOF'
test(scheduler): add unit tests for cron parser

Add unit test coverage for the scheduler cron parser to validate
parsing logic and edge cases.
EOF
)"
```

---

## 2. om-newblink-github-workflow -- Updated CI workflow

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-github-workflow && \
git add .github/workflows/ci.yml && \
git commit -m "$(cat <<'EOF'
ci: update CI workflow configuration

Update the CI workflow to reflect current pipeline requirements.
EOF
)"
```

---

## 3. om-newblink-bl-service -- Refactored booking date utility

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-bl-service && \
git add src/booking/date.util.ts && \
git commit -m "$(cat <<'EOF'
refactor(booking): clean up date utility without behavior change

Refactor the booking date utility for improved readability and
maintainability. No functional changes.
EOF
)"
```

---

## Notes

- Each command uses `cd` into the specific submodule directory so the commit is recorded in that submodule's own git history.
- Files are staged explicitly by path (`git add <file>`) rather than using `git add .` or `git add -A`, to avoid accidentally including unrelated changes.
- Commit messages follow the Conventional Commits format (`type(scope): description`), which is standard practice for microservice repos.
- After committing inside the submodules, the parent repo (`om-blk`) will show the submodule pointers as modified. Those updated submodule references can be committed separately at the parent level if and when desired.
