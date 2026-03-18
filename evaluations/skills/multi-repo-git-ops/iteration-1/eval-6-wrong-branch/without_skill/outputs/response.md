# Response: Create feature branch in om-newblink-bl-service

## Step-by-Step Reasoning

1. The user requested branching off `develop`, but according to CLAUDE.md, **om-newblink-bl-service uses `dev` as its main branch, NOT `develop`**. This is a critical discrepancy that must be surfaced before proceeding.

2. Assuming the user confirms they want to branch off `dev` (the correct base branch), the workflow is:
   - Navigate into the submodule directory
   - Fetch the latest remote refs
   - Checkout and update the base branch
   - Create the new feature branch from it

## Exact Git Commands (in order)

```bash
# Step 1: Navigate into the submodule
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-bl-service/

# Step 2: Fetch latest from remote
git fetch origin

# Step 3: Checkout the base branch (dev, NOT develop)
git checkout dev

# Step 4: Pull latest changes to ensure we're up to date
git pull origin dev

# Step 5: Create and switch to the new feature branch
git checkout -b feat/OMPBLINK-50000-fix-search
```

## Safety Checks, Warnings, and Corrections

### WARNING: Wrong base branch specified

The user requested branching off `develop`, but **om-newblink-bl-service's main branch is `dev`**, not `develop` (per the project's CLAUDE.md submodule table). Branching off `develop` would either:

- **Fail** if the `develop` branch does not exist in this repo, or
- **Create the feature branch from a stale or incorrect base** if `develop` exists but is not the active branch

**Recommendation:** Branch off `dev` instead. The commands above reflect this correction.

### Additional safety checks

- **Check for uncommitted changes** before switching branches: Run `git status` inside the submodule first. If there are uncommitted changes, either stash them (`git stash`) or commit them before switching branches.
- **Verify the submodule is initialized**: If the submodule directory is empty, run `git submodule update --init services/om-newblink-bl-service` from the parent repo first.
- **Confirm remote tracking**: After creating the branch, the user will need to push with `git push -u origin feat/OMPBLINK-50000-fix-search` to set up remote tracking when ready.
