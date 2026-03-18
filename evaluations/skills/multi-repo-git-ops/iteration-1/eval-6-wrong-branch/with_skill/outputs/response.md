# Evaluation 6: Wrong Branch Correction

## Task

User requested: "Create a feature branch `feat/OMPBLINK-50000-fix-search` off `develop` in `om-newblink-bl-service`"

---

## Step-by-Step Reasoning

1. **Identify the service**: `om-newblink-bl-service`, located at `services/om-newblink-bl-service/`.

2. **Look up the correct default branch**: According to both the CLAUDE.md service table and the SKILL.md branch conventions, `om-newblink-bl-service` tracks branch **`dev`**, NOT `develop`. The skill explicitly lists it among the "Some newer services" group that uses `dev`.

3. **Detect the user's mistake**: The user said "off develop", but this service's default branch is `dev`. Branching from `develop` would either fail (branch doesn't exist) or create a feature branch from a stale/wrong base, leading to merge conflicts later.

4. **Correct and proceed**: Surface the correction to the user, then create the branch from the correct base (`dev`).

5. **Follow the Non-BMAD feature branch workflow** from the skill, since this is a ticket-based branch (OMPBLINK-50000), not a BMAD story.

---

## WARNING / Correction to User

> **Branch correction**: You requested branching off `develop`, but `om-newblink-bl-service` uses **`dev`** as its default branch (not `develop`). Branching from `develop` would either fail or create a branch from the wrong base, causing merge conflicts when you open a PR. I will branch from `dev` instead.

To verify this independently, you can run:
```bash
git config -f .gitmodules submodule."services/om-newblink-bl-service".branch
```
This should return `dev`.

---

## Exact Git Commands (In Order)

### Step 1: Verify the default branch from `.gitmodules`

```bash
git config -f .gitmodules submodule."services/om-newblink-bl-service".branch
```

**Purpose**: Confirm the tracked branch is `dev`. This is a safety check before proceeding.

### Step 2: Navigate into the submodule and checkout the correct default branch

```bash
cd services/om-newblink-bl-service
git checkout dev
```

**Purpose**: Ensure we are on the correct base branch.

### Step 3: Pull the latest from the remote

```bash
git pull origin dev
```

**Purpose**: Ensure the base branch is up to date before branching.

### Step 4: Create the feature branch

```bash
git checkout -b feat/OMPBLINK-50000-fix-search
```

**Purpose**: Create the new feature branch from the up-to-date `dev` branch.

### Step 5: Push the branch and set upstream tracking

```bash
git push -u origin feat/OMPBLINK-50000-fix-search
```

**Purpose**: Push the branch to the remote and set up tracking. Note that per CI/CD awareness in the skill, `feat/*` branches only trigger CI (lint, test, build) but do NOT auto-deploy, so this is safe.

### Step 6: Verify the branch was created correctly

```bash
git branch --show-current
```

**Expected output**: `feat/OMPBLINK-50000-fix-search`

---

## Safety Checks Applied

| Check | Status | Detail |
|-------|--------|--------|
| Correct default branch lookup | CORRECTED | User said `develop`, actual default is `dev` |
| Branch naming convention | PASS | Follows `{type}/{TICKET-NUMBER}-{short-description}` format |
| No force-push to shared branch | PASS | Only pushing a new feature branch |
| No deployment trigger | SAFE | `feat/*` branches do not auto-deploy |
| Branch from up-to-date base | PASS | `git pull origin dev` before branching |
