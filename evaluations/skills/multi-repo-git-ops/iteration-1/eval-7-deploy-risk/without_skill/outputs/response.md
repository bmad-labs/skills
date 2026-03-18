# Push Changes on develop in om-blk-alert-service to Origin

## Step-by-Step Reasoning

1. **Navigate to the submodule**: The service lives at `services/om-blk-alert-service/`. All git commands need to run inside that directory since each submodule has its own git history.

2. **Verify the current branch**: Before pushing, confirm we are actually on the `develop` branch and not in a detached HEAD state. Submodules frequently end up in detached HEAD after a `git submodule update`, which would make a push dangerous or fail.

3. **Check working tree status**: Ensure there are no uncommitted changes. If there are unstaged or staged-but-uncommitted changes, pushing would not include them, which could be confusing.

4. **Review what will be pushed**: Before pushing, inspect the commits that exist locally but not on origin/develop. This lets the user confirm the correct changes are being sent.

5. **Push to origin**: Execute the push to `origin develop`.

6. **Update the submodule pointer in the parent repo**: After pushing the submodule, the parent repo (`om-blk`) will show the submodule as having a new commit. The user should be aware that the parent repo reference needs updating separately.

---

## Exact Git Commands (In Order)

### Command 1: Verify branch and HEAD state
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service/ status
```

### Command 2: Confirm we are on the develop branch (not detached HEAD)
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service/ branch --show-current
```

### Command 3: Review commits that will be pushed (local vs remote)
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service/ log origin/develop..develop --oneline
```

### Command 4: Push to origin
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-alert-service/ push origin develop
```

---

## Safety Checks, Warnings, and Confirmations BEFORE Pushing

### 1. Detached HEAD Warning
Submodules are often in a **detached HEAD** state. If Command 2 returns empty (no branch name), the push would fail or behave unexpectedly. In that case, the user would need to:
```bash
git -C .../om-blk-alert-service/ checkout develop
git -C .../om-blk-alert-service/ merge <detached-commit-hash>
```
before pushing.

### 2. Uncommitted Changes Warning
If Command 1 shows uncommitted changes, the user should be warned: "You have uncommitted changes that will NOT be included in this push. Did you forget to commit?"

### 3. Confirm the Diff Before Push
Command 3 shows exactly which commits will be pushed. The user should review this list and confirm it matches their hotfix. If there are unexpected commits (e.g., merge commits or changes from others), the user should investigate before pushing.

### 4. Direct Push to develop -- No PR
This is a direct push to the `develop` branch, bypassing any pull request or code review process. For a hotfix this may be acceptable, but the user should confirm:
- Is direct push to `develop` allowed by the team's branch protection rules?
- Has the hotfix been reviewed or tested?
- Are there CI checks that run on push that could reject it?

### 5. Parent Repo Submodule Pointer
After pushing, the parent repo (`om-blk`) will show `om-blk-alert-service` as modified (new commit reference). The user should be aware that they may need to update and commit the submodule pointer in the parent repo if they want the parent to track this new commit:
```bash
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/ add services/om-blk-alert-service
git -C /Users/tannt/Works/GIT/OPUS/Sources/om-blk/ commit -m "Update om-blk-alert-service submodule pointer to latest develop"
```

### 6. Force Push Not Used
The commands above use a regular `push`, not `--force`. This is intentional and safe. If the push is rejected due to remote changes, the user should pull/rebase first rather than force-pushing.
