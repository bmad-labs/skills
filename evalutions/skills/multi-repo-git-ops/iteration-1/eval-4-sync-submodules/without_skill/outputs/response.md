# Fixing Out-of-Sync Submodules After Pulling Parent Repo

## Problem

After pulling latest changes from `main` on the parent repo (`om-blk`), the submodule pointers were updated in the parent but the actual submodule working directories still point to their old commits. This results in "detached HEAD" states and `git status` showing submodules as modified.

## Step-by-Step Reasoning

1. **Diagnose first**: Before running any fix commands, check which submodules are out of sync and what state they are in. This prevents blindly overwriting any local work.

2. **Check for local changes in submodules**: If any submodule has uncommitted or unpushed local work, a blind `submodule update` would discard that work. We need to verify before proceeding.

3. **Sync submodule URLs**: The `.gitmodules` file may have changed (e.g., new URLs or branches). Running `git submodule sync` ensures local `.git/config` matches the current `.gitmodules`.

4. **Update submodules to match parent pointers**: `git submodule update --init --recursive` checks out the exact commit that the parent repo expects for each submodule. This resolves the detached HEAD issue by moving each submodule to the correct commit.

5. **Optionally checkout tracking branches**: After update, submodules will be in "detached HEAD" at the correct commit. If you want them on their named branches (e.g., `develop`, `dev`, `main`), you can use `--remote --merge` or manually checkout. However, detached HEAD at the correct commit is the normal and expected state for submodules.

## Exact Commands (In Order)

### Step 1: Diagnose the current state

```bash
# See which submodules are out of sync or modified
git status

# See detailed submodule status (commit each is at vs what parent expects)
git submodule status
```

**What to look for**: A `+` prefix on a submodule line means the checked-out commit differs from what the parent index expects. A `-` prefix means the submodule is not initialized.

### Step 2: Check for local uncommitted changes in submodules

```bash
# Show a summary of changes within each submodule
git submodule foreach 'git status --short || true'
```

**Safety check**: If any submodule shows uncommitted changes, stash or commit them before proceeding. Example:

```bash
# Only if a specific submodule has local changes you want to keep:
git submodule foreach 'git stash || true'
```

### Step 3: Sync submodule configuration

```bash
# Ensure submodule URLs in .git/config match .gitmodules
git submodule sync --recursive
```

This is important if `.gitmodules` was modified in the pull (e.g., a submodule URL changed).

### Step 4: Update all submodules to the commits the parent expects

```bash
# Initialize any new submodules and checkout the correct commits
git submodule update --init --recursive
```

This is the core fix. It checks out the exact commit that the parent repo's index points to for each submodule. After this command:
- All submodules will be at the correct commit
- They will be in "detached HEAD" state, which is **normal and expected** for submodules

### Step 5: Verify the fix

```bash
# Confirm all submodules are now at the expected commits (no + or - prefixes)
git submodule status

# Confirm parent repo shows clean status for submodules
git status
```

## Safety Checks and Confirmations

1. **Before Step 4**: Review the output of Step 2. If any submodule has local uncommitted work, either commit it, stash it, or confirm it is safe to discard. `git submodule update` will overwrite the working directory of each submodule.

2. **After Step 4**: Verify with `git submodule status` that no submodules still show a `+` prefix. If any do, investigate individually.

3. **Detached HEAD is normal**: After `git submodule update`, all submodules will show "HEAD detached at <commit>". This is the correct and expected state. Submodules are meant to be pinned to specific commits by the parent repo. You only need to checkout a named branch if you intend to make new commits in that submodule.

4. **If you need to work on a specific submodule** (make new commits), then checkout its tracking branch:

   ```bash
   cd services/<service-name>
   git checkout <branch-name>   # e.g., develop, dev, or main per the table in CLAUDE.md
   ```

## Quick One-Liner (If You Are Confident No Local Changes Exist)

```bash
git submodule sync --recursive && git submodule update --init --recursive
```

This combines Steps 3 and 4 into a single command. Only use this if you have confirmed there are no local uncommitted changes in any submodule.
