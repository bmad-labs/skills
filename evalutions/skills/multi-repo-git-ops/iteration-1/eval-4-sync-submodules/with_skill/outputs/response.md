# Fixing Out-of-Sync Submodules After Pulling Parent Repo

## Situation

You pulled the latest from `main` on the parent repo (`om-blk`). The parent now records updated submodule commit pointers, but your local submodule checkouts still point to old commits. Git shows them as "detached HEAD" because the submodule directories are checked out at specific commits that no longer match what the parent expects.

## Step-by-Step Reasoning

1. **Diagnose first**: Before changing anything, understand which submodules are out of sync and what state they are in. Check for any uncommitted local work in submodules that could be lost.

2. **Update submodule pointers**: The core fix is `git submodule update --recursive`, which checks out the exact commits the parent repo now points to. This resolves the "detached HEAD" state by moving each submodule to the correct commit.

3. **Optionally re-attach to tracking branches**: After syncing pointers, submodules will still be in detached HEAD state (pointing at specific commits). If you want to work on a service, you need to check out its tracked branch. The skill file provides a command to pull latest from each submodule's configured branch.

4. **Verify**: Confirm all submodules are in a clean, expected state.

## Safety Checks Before Running Commands

- **Check for uncommitted work in submodules first.** If any submodule has local changes, `git submodule update` will fail or those changes could be lost. Stash or commit them before proceeding.

## Exact Commands (In Order)

### Step 1: Check for uncommitted work across all submodules

```bash
git submodule foreach --quiet \
  'STATUS=$(git status --porcelain); if [ -n "$STATUS" ]; then echo "WARNING: $(basename $(pwd)) has uncommitted changes:"; git status --short; fi'
```

**Safety check**: If any submodule reports uncommitted changes, STOP. Go into that service directory and either commit or stash those changes before proceeding.

### Step 2: Check current state (which submodules are detached or on wrong branch)

```bash
git submodule foreach --quiet \
  'BRANCH=$(git branch --show-current); DEFAULT=$(git config -f $toplevel/.gitmodules submodule.$name.branch); if [ -z "$BRANCH" ]; then echo "$(basename $(pwd)): DETACHED HEAD"; elif [ "$BRANCH" != "$DEFAULT" ]; then echo "$(basename $(pwd)) [$BRANCH]: non-default branch (expected $DEFAULT)"; fi'
```

This shows exactly which submodules are detached or on unexpected branches.

### Step 3: Sync submodule URLs (in case .gitmodules changed)

```bash
git submodule sync --recursive
```

This ensures the submodule remote URLs match what `.gitmodules` defines. Necessary if a teammate changed any submodule URLs.

### Step 4: Update all submodules to the commits the parent repo now points to

```bash
git submodule update --recursive
```

This is the core fix. It checks out the exact commit that the parent repo's updated pointers reference for each submodule. After this, submodules will be in detached HEAD state at the **correct** commits.

### Step 5 (Optional): Re-attach submodules to their tracked branches

If you want to actively work in the submodules (not just have them at the right commit), check out each submodule's tracked branch and pull latest:

```bash
git submodule foreach 'git pull origin $(git config -f $toplevel/.gitmodules submodule.$name.branch)'
```

**Note**: This pulls the latest from each submodule's remote tracking branch. The resulting commits may be *ahead* of what the parent repo points to, which is fine for active development but means the parent's pointers will be "behind." Only do this if you plan to work in the submodules.

### Step 6: Verify final state

```bash
git submodule foreach --quiet \
  'BRANCH=$(git branch --show-current); STATUS=$(git status --porcelain); echo "$(basename $(pwd)) [${BRANCH:-DETACHED}]: $([ -n "$STATUS" ] && echo "has changes" || echo "clean")"'
```

## Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `git submodule foreach ... status --porcelain` | Safety: check for uncommitted local work |
| 2 | `git submodule foreach ... branch --show-current` | Diagnose: see which submodules are detached |
| 3 | `git submodule sync --recursive` | Sync submodule URLs from `.gitmodules` |
| 4 | `git submodule update --recursive` | **Core fix**: checkout correct commits |
| 5 | `git submodule foreach 'git pull origin ...'` | Optional: re-attach to tracking branches |
| 6 | `git submodule foreach ... status` | Verify: confirm clean state |

## When to Use Step 5 vs. Not

- **Skip Step 5** if you just need submodules at the right commit (e.g., running the system locally, reviewing code). Detached HEAD is fine for read-only use.
- **Do Step 5** if you plan to make changes in any service. You need to be on a branch to commit.
