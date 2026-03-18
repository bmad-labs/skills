# Eval 7: Push changes on develop in om-blk-alert-service to origin

## Step-by-Step Reasoning

1. **Identify the service and branch**: The user wants to push `om-blk-alert-service` on the `develop` branch. According to `.gitmodules`, this service's default branch is `develop`, so this is the default/mainline branch.

2. **Recognize deployment risk**: Per the skill's CI/CD Awareness table, pushing to `develop` **auto-deploys to the dev environment**. This is a deployment-triggering branch. The skill's Safety Rule #3 explicitly states: "Confirm with user before pushing to deployment-triggering branches (`develop`, `dev`)."

3. **Verify current state before pushing**: Before pushing, I need to confirm the branch, check for uncommitted changes, and review what commits will be pushed. This ensures nothing unexpected goes to origin.

4. **Push the service branch**: Once confirmed, push to origin from inside the submodule directory.

5. **No parent repo update needed**: The user is only pushing existing commits on the service's default branch. There is no feature branch merge or submodule pointer change involved, so no parent repo commit is needed.

---

## Exact Git Commands (In Order)

### Step 1: Verify current branch and status

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service
git branch --show-current
```

Expected output: `develop`. If not on `develop`, STOP and inform the user.

### Step 2: Check for uncommitted changes

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service
git status --porcelain
```

If there are uncommitted changes, STOP and warn the user that there are unstaged/uncommitted changes that will NOT be included in the push. Ask if they want to commit first.

### Step 3: Review what will be pushed

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service
git log origin/develop..develop --oneline
```

This shows exactly which commits will be pushed. Present these to the user for confirmation.

### Step 4: Push (only after user confirmation)

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service
git push origin develop
```

---

## Safety Checks, Warnings, and Confirmations BEFORE Pushing

### WARNING: Deployment-Triggering Branch

> **Pushing to `develop` on `om-blk-alert-service` will auto-deploy to the dev environment.**
>
> Per CI/CD configuration, pushes to `develop` trigger automatic deployment. This means your hotfix will go live in the dev environment immediately after push.

### Confirmations Required from User

1. **"These are the commits that will be pushed to origin/develop: [list from Step 3]. Do you confirm?"** -- Show the user the exact commits via `git log origin/develop..develop --oneline` so they can verify the right changes are being pushed.

2. **"Pushing to develop will auto-deploy to the dev environment. Are you sure you want to proceed?"** -- This is mandatory per Safety Rule #3 in the skill. The user must explicitly acknowledge the deployment impact.

### Additional Checks

- **No force-push**: Safety Rule #2 prohibits force-pushing to `develop`. Only a normal `git push` is used.
- **No uncommitted work left behind**: Step 2 verifies there are no lingering changes that the user might have intended to include.
- **Correct remote target**: The push goes to `origin develop`, not any other remote or branch.
