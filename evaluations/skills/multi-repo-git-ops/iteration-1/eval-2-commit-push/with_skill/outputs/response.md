# Commit and Push Plan for Story 1-1-user-registration

## Context

- Story key: `1-1-user-registration` (derived from story file name)
- Feature branch name: `feat/1-1-user-registration`
- Affected services:
  - **om-blk-auth-service** (default branch: `develop`) -- new files: `src/auth/registration.service.ts`, `src/auth/registration.controller.ts`
  - **om-newblink-iam-service** (default branch: `dev`) -- modified: `src/iam/user.repository.ts`

---

## Step-by-Step Reasoning

1. **Safety check first**: Before committing, verify the current state of each service -- confirm we are on the correct feature branch and review what will be committed. Never use `git add .` or `git add -A`; always add specific files.

2. **Run quality checks in each service**: Per the skill and CLAUDE.md, run lint, format, typecheck, and tests before committing.

3. **Commit in each service repo individually**: Each service is its own git repo. Commits happen inside the service directory, using conventional commit format with the story key for traceability.

4. **Push service repos first, then parent**: The skill's Safety Rule #1 states "Always push service repos before parent." Pushing the parent first would create broken submodule pointers.

5. **Confirm before pushing to deployment-triggering branches**: The feature branches (`feat/*`) only trigger CI (lint, test, build) but no deployment, so no extra confirmation is needed for the push itself. However, I would still confirm with the user before proceeding.

6. **Update parent repo submodule pointers**: After pushing both services, update the parent's submodule references so the parent tracks the latest commits in each service.

7. **Update sprint-status.yaml**: The skill notes that git operations that change story state should be reflected in sprint status.

---

## Safety Checks and Confirmations

Before executing any commands, I would:

1. **Confirm the user is ready to push** -- since pushing is a remote operation.
2. **Verify both services are on `feat/1-1-user-registration`** branch (not accidentally on develop/dev).
3. **Review `git status` and `git diff`** in each service to ensure no unintended files (secrets, `.env`, `node_modules`, build artifacts) are staged.
4. **Confirm quality checks pass** (lint, format, typecheck, tests) before committing.
5. **Note**: Pushing to `feat/*` branches does NOT trigger deployment (only CI), so no deployment risk.

---

## Exact Git Commands (in order)

### Phase 1: Verify State in Each Service

```bash
# 1a. Check om-blk-auth-service status and branch
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git branch --show-current
git status
git diff
git diff --cached
```

```bash
# 1b. Check om-newblink-iam-service status and branch (can run in parallel with 1a)
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
git branch --show-current
git status
git diff
git diff --cached
```

### Phase 2: Run Quality Checks in Each Service

```bash
# 2a. Quality checks in om-blk-auth-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
npm run lint
npm run format
npm run typecheck
npm test
```

```bash
# 2b. Quality checks in om-newblink-iam-service (can run in parallel with 2a)
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
npm run lint
npm run format
npm run typecheck
npm test
```

### Phase 3: Stage and Commit in Each Service (sequentially)

```bash
# 3a. Commit in om-blk-auth-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git add src/auth/registration.service.ts src/auth/registration.controller.ts
git commit -m "$(cat <<'EOF'
feat(auth): add user registration service and controller

Story: 1-1-user-registration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

```bash
# 3b. Commit in om-newblink-iam-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
git add src/iam/user.repository.ts
git commit -m "$(cat <<'EOF'
feat(iam): update user repository to support registration

Story: 1-1-user-registration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 4: Push Service Repos (services BEFORE parent -- Safety Rule #1)

```bash
# 4a. Push om-blk-auth-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git push origin feat/1-1-user-registration
```

```bash
# 4b. Push om-newblink-iam-service (can run in parallel with 4a)
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
git push origin feat/1-1-user-registration
```

### Phase 5: Update Parent Repo Submodule Pointers

```bash
# 5. Update parent repo to track new commits in both services
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git add services/om-blk-auth-service services/om-newblink-iam-service
git commit -m "$(cat <<'EOF'
Update submodule pointers for story 1-1-user-registration

Services updated:
- om-blk-auth-service
- om-newblink-iam-service

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

```bash
# 6. Push parent repo (after services are already pushed)
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git push origin master
```

### Phase 6: Verify Final State

```bash
# 7. Verify everything is clean across all affected repos
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git submodule foreach --quiet \
  'STATUS=$(git status --porcelain); BRANCH=$(git branch --show-current); DEFAULT=$(git config -f $toplevel/.gitmodules submodule.$name.branch); if [ -n "$STATUS" ] || [ "$BRANCH" != "$DEFAULT" ]; then echo "$(basename $(pwd)) [$BRANCH]: $([ -n "$STATUS" ] && echo "has changes" || echo "clean, non-default branch")"; fi'
```

---

## Summary of Key Decisions from the Skill

| Decision | Rationale |
|---|---|
| Add specific files only (never `git add .`) | Safety Rule #5 -- avoid committing secrets or artifacts |
| Commit in each service separately | Each submodule is an independent repo with its own history |
| Use `feat/1-1-user-registration` branch name | BMAD convention: `feat/{story-key}` from story file name |
| Include `Story: 1-1-user-registration` in commit messages | Traceability convention from the skill |
| Push services before parent | Safety Rule #1 -- prevents broken submodule pointers |
| Run quality checks before committing | Required by CLAUDE.md Section 5 and the skill's "Completing a Story" section |
| No deployment concern for `feat/*` branches | CI/CD Awareness table: feat/* only triggers CI, no auto-deploy |
