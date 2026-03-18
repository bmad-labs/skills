# Response: Update Parent Repo After PR Merges for Story 3-2-add-kafka-events

## Step-by-Step Reasoning

1. **Understand the goal**: PRs for story 3-2-add-kafka-events have been merged into the remote branches of two submodules: `om-blk-scheduler-service` and `om-newblink-pushevent-service`. The parent repo's submodule pointers are now stale and need to be updated to reference the latest commits on those remote branches.

2. **Identify tracked branches from `.gitmodules`**:
   - `om-blk-scheduler-service`: No `branch` specified in `.gitmodules`, so it defaults to `master` (or whatever the remote default is). This is notable -- the CLAUDE.md table says it tracks `develop`, but `.gitmodules` has no branch entry. This needs a safety check.
   - `om-newblink-pushevent-service`: Tracks `develop` branch.

3. **Plan**: For each affected submodule, enter the submodule directory, fetch from remote, and checkout the latest commit on the tracked branch. Then return to the parent repo, stage the updated submodule pointers, and verify with `git diff --cached` before asking the user about committing.

4. **Safety considerations**:
   - Verify the parent repo working tree is clean before starting (no uncommitted changes to submodule pointers).
   - After updating each submodule, use `git diff --submodule` to confirm the pointer moved forward (not backward or to an unrelated branch).
   - Do NOT auto-commit per CLAUDE.md instructions ("Never automatic do git commit").
   - Confirm `om-blk-scheduler-service` branch situation before pulling.

## Exact Git Commands (in order)

### Step 1: Safety check -- verify parent repo state
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk status
```

### Step 2: Check current submodule pointer status before making changes
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk submodule status services/om-blk-scheduler-service services/om-newblink-pushevent-service
```

### Step 3: Update om-blk-scheduler-service submodule

Since `.gitmodules` does not specify a branch for `om-blk-scheduler-service`, I would first verify which branch is tracked:

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service remote show origin
```

Then fetch and update to the latest on the tracked branch (assuming `develop` per the project docs):

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service fetch origin
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service checkout develop
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service pull origin develop
```

### Step 4: Update om-newblink-pushevent-service submodule

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-pushevent-service fetch origin
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-pushevent-service checkout develop
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-pushevent-service pull origin develop
```

### Step 5: Verify the submodule pointer changes in the parent repo

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk diff --submodule services/om-blk-scheduler-service services/om-newblink-pushevent-service
```

### Step 6: Stage the updated submodule pointers

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk add services/om-blk-scheduler-service services/om-newblink-pushevent-service
```

### Step 7: Verify staged changes before commit

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk diff --cached --submodule
```

### Step 8: Ask the user for confirmation before committing

I would NOT commit automatically. I would present the diff to the user and ask if they want to proceed. If confirmed, the commit command would be:

```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk commit -m "Update submodule pointers for story 3-2-add-kafka-events

Update om-blk-scheduler-service and om-newblink-pushevent-service
to latest develop after merging Kafka events PRs."
```

## Safety Checks and Confirmations

1. **Pre-flight**: Check `git status` to ensure no unexpected uncommitted changes exist in the parent repo that could be accidentally staged.
2. **Branch verification for om-blk-scheduler-service**: The `.gitmodules` file does not specify a `branch` for this submodule (lines 1-3), unlike most other submodules. I would run `git remote show origin` inside that submodule to confirm the correct branch before pulling. The CLAUDE.md table says `develop` but `.gitmodules` is the source of truth for git operations.
3. **Diff review after update**: Use `git diff --submodule` to confirm both submodule pointers moved forward to newer commits (not backward or sideways to a different branch).
4. **Staged diff review**: Use `git diff --cached --submodule` to verify exactly what will be committed -- only the two expected submodule pointer changes and nothing else.
5. **No auto-commit**: Per project rules, I would present the changes to the user and wait for explicit confirmation before committing.
