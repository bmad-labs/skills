# Branch Setup for Story 2-3-implement-jwt-auth

## Step-by-Step Reasoning

1. **Identify the story key from the task description**: The user references "story 2-3-implement-jwt-auth". Per the skill's BMAD branch naming convention, the story file name (without `.md`) becomes the branch name suffix. This yields branch name: `feat/2-3-implement-jwt-auth`.

2. **Identify affected services**: The user explicitly states two services:
   - `om-blk-auth-service`
   - `om-newblink-blink-bff-service`

3. **Look up default branches for each service**: Per the skill guidance, each service tracks a different default branch. Must verify via `.gitmodules` before branching to avoid branching from the wrong base.
   - `om-blk-auth-service`: `develop` (from CLAUDE.md table; no explicit branch entry in .gitmodules, so it defaults to `develop` per the project convention)
   - `om-newblink-blink-bff-service`: `develop` (explicitly set in .gitmodules)

4. **Apply the skill's "Starting a BMAD Story" workflow**: Create the same feature branch name in both services for traceability. For each service: checkout default branch, pull latest, create feature branch, push with upstream tracking.

5. **Verify setup**: After branch creation, confirm both services are on the correct branch.

6. **Safety considerations**:
   - We are pushing to `feat/*` branches, which only trigger CI (lint, test, build) but NO deployment -- safe to push.
   - We are NOT pushing to `develop`, `dev`, or `main` -- no deployment risk.
   - We should verify no uncommitted changes exist in either service before switching branches.

---

## Safety Checks (Before Execution)

Before running any commands, I would perform these checks:

```bash
# Check for uncommitted changes in both services
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service && git status --porcelain
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-blink-bff-service && git status --porcelain
```

If either service has uncommitted changes, I would STOP and ask the user how to handle them (stash, commit, or discard) before proceeding.

---

## Exact Git Commands (In Order)

### Step 1: Verify default branches from .gitmodules

```bash
git config -f /Users/tannt/Works/GIT/OPUS/Sources/om-blk/.gitmodules submodule."services/om-blk-auth-service".branch
git config -f /Users/tannt/Works/GIT/OPUS/Sources/om-blk/.gitmodules submodule."services/om-newblink-blink-bff-service".branch
```

Expected output:
- `om-blk-auth-service`: `develop` (or empty, meaning `develop` per project convention)
- `om-newblink-blink-bff-service`: `develop`

### Step 2: Set up branch in om-blk-auth-service

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git checkout develop
git pull origin develop
git checkout -b feat/2-3-implement-jwt-auth
git push -u origin feat/2-3-implement-jwt-auth
```

### Step 3: Set up branch in om-newblink-blink-bff-service

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-blink-bff-service
git checkout develop
git pull origin develop
git checkout -b feat/2-3-implement-jwt-auth
git push -u origin feat/2-3-implement-jwt-auth
```

### Step 4: Verify setup across all submodules

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git submodule foreach --quiet 'BRANCH=$(git branch --show-current); echo "$(basename $(pwd)): $BRANCH"'
```

Expected: Both `om-blk-auth-service` and `om-newblink-blink-bff-service` should show `feat/2-3-implement-jwt-auth`. All other services should remain on their default branches.

---

## Summary

| Service | Default Branch | Feature Branch | Action |
|---------|---------------|----------------|--------|
| om-blk-auth-service | develop | feat/2-3-implement-jwt-auth | Create & push |
| om-newblink-blink-bff-service | develop | feat/2-3-implement-jwt-auth | Create & push |

**Total commands**: 10 git commands (2 safety checks + 4 per service + 1 verification)

**Key skill principles applied**:
- Same branch name (`feat/2-3-implement-jwt-auth`) across both services for traceability
- Branch name derived from story key using `feat/{story-key}` convention
- Default branch verified via `.gitmodules` before branching
- Feature branch pushed to `feat/*` (CI only, no auto-deployment)
- Safety check for uncommitted changes before switching branches
