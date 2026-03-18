# Parent Repo Update After PRs Merged for Story 3-2-add-kafka-events

## Context

PRs for story `3-2-add-kafka-events` have been merged into the default branches of:
- `om-blk-scheduler-service` (default branch: `develop`)
- `om-newblink-pushevent-service` (default branch: `develop`)

The parent repo needs its submodule pointers updated to reflect the newly merged code.

## Step-by-Step Reasoning

1. **Identify default branches**: Both services track `develop` as their default branch (per `.gitmodules`). The merged PRs targeted these branches, so I need to pull the latest `develop` in each service.

2. **Update each submodule to the latest merged commit**: For each affected service, switch to its default branch and pull the latest from origin. This advances the local checkout to the post-merge commit.

3. **Stage the updated submodule pointers in the parent repo**: After both services are at their latest commits, stage the submodule pointer changes in the parent repo.

4. **Commit in the parent repo**: Create a commit that records the new submodule pointers, referencing the story for traceability.

5. **Safety considerations**:
   - Do NOT push the parent repo unless explicitly asked (per CLAUDE.md: "Never automatic do git commit" and skill safety rule: "Always push service repos before parent").
   - Verify the submodule status before and after to confirm correctness.

## Safety Checks

Before running any commands:
- Confirm the parent repo working tree is clean (no uncommitted changes that could be accidentally staged).
- Verify the correct default branches for each service.
- After pulling, confirm we are on the expected branch and the pull succeeded.

## Exact Git Commands (In Order)

### Step 1: Verify parent repo is clean

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git status
```

**Check**: Confirm no unexpected staged/unstaged changes. If there are unrelated changes, address them first or stash.

### Step 2: Look up default branches for the affected services

```bash
git config -f .gitmodules submodule."services/om-blk-scheduler-service".branch
git config -f .gitmodules submodule."services/om-newblink-pushevent-service".branch
```

**Expected output**: `develop` for both. This confirms the target branches.

### Step 3: Update om-blk-scheduler-service to latest merged code

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-scheduler-service
git checkout develop
git pull origin develop
```

### Step 4: Update om-newblink-pushevent-service to latest merged code

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-pushevent-service
git checkout develop
git pull origin develop
```

### Step 5: Return to parent repo and verify submodule pointer changes

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk
git status
```

**Check**: Should show `services/om-blk-scheduler-service` and `services/om-newblink-pushevent-service` as modified (new commits). No other unexpected changes.

```bash
git diff services/om-blk-scheduler-service services/om-newblink-pushevent-service
```

**Check**: Confirm the diff shows submodule pointer advancing to newer commits (the output will show `Subproject commit <old-hash>...<new-hash>`).

### Step 6: Stage the updated submodule pointers

```bash
git add services/om-blk-scheduler-service services/om-newblink-pushevent-service
```

### Step 7: Commit the parent repo (only if user confirms)

```bash
git commit -m "Update submodule pointers after story 3-2-add-kafka-events

Services updated:
- om-blk-scheduler-service
- om-newblink-pushevent-service"
```

**Note**: Per project instructions ("Never automatic do git commit"), I would present this commit command to the user and wait for confirmation before executing it.

### Step 8: Final verification

```bash
git status
git log --oneline -1
```

**Check**: Working tree should be clean. The latest commit should be the submodule pointer update.

## Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `git status` (parent) | Verify clean working tree |
| 2 | `git config -f .gitmodules ...` (x2) | Confirm default branches |
| 3 | `git checkout develop && git pull` (scheduler) | Get latest merged code |
| 4 | `git checkout develop && git pull` (pushevent) | Get latest merged code |
| 5 | `git status && git diff` (parent) | Verify pointer changes |
| 6 | `git add services/...` (x2) | Stage pointer updates |
| 7 | `git commit` (parent) | Record new pointers -- **requires user confirmation** |
| 8 | `git status && git log` | Final verification |

## What I Would NOT Do

- **Would NOT push** the parent repo unless the user explicitly asks.
- **Would NOT use `git add .`** -- only staging the two specific submodule paths.
- **Would NOT force-push** anything.
- **Would NOT update sprint-status.yaml** automatically (the story status should move to `done` but that is a separate action to confirm with the user).
