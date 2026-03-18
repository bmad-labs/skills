# Updating Parent Repo Submodule Pointers After Story 1-2-user-authentication PR Merges

After the PRs for story 1-2-user-authentication have been merged into `om-blk-auth-service` (branch: `develop`) and `om-newblink-blink-bff-service` (branch: `develop`), run the following commands from the parent repo root (`/Users/tannt/Works/GIT/OPUS/Sources/om-blk`):

## Step 1: Fetch and update each submodule to its latest remote commit

```bash
# Update om-blk-auth-service to the latest commit on its tracked branch (develop)
cd services/om-blk-auth-service
git fetch origin
git checkout develop
git pull origin develop
cd ../..

# Update om-newblink-blink-bff-service to the latest commit on its tracked branch (develop)
cd services/om-newblink-blink-bff-service
git fetch origin
git checkout develop
git pull origin develop
cd ../..
```

Alternatively, you can do both in one shot using `git submodule update --remote` for just these two submodules:

```bash
git submodule update --remote services/om-blk-auth-service
git submodule update --remote services/om-newblink-blink-bff-service
```

> **Note:** `--remote` tells git to fetch the latest commit from each submodule's tracked remote branch (as configured in `.gitmodules`) rather than the commit currently recorded in the parent repo.

## Step 2: Verify the submodules now point to the expected commits

```bash
git submodule status services/om-blk-auth-service services/om-newblink-blink-bff-service
```

You should see the new commit hashes (without a `+` prefix, which would indicate a mismatch with the recorded pointer). If you see a `+` prefix, that means the submodule is at a different commit than what the parent repo has recorded -- which is expected before you stage the changes.

## Step 3: Stage the updated submodule pointers in the parent repo

```bash
git add services/om-blk-auth-service services/om-newblink-blink-bff-service
```

## Step 4: Verify what will be committed

```bash
git diff --cached
```

You should see output similar to:

```
diff --git a/services/om-blk-auth-service b/services/om-blk-auth-service
index f81d67b..xxxxxxx 160000
--- a/services/om-blk-auth-service
+++ b/services/om-blk-auth-service
@@ -1 +1 @@
-Subproject commit f81d67b715ce1974867adf8476758c3ed43dcb64
+Subproject commit <new-commit-hash>

diff --git a/services/om-newblink-blink-bff-service b/services/om-newblink-blink-bff-service
index ae271e2..xxxxxxx 160000
--- a/services/om-newblink-blink-bff-service
+++ b/services/om-newblink-blink-bff-service
@@ -1 +1 @@
-Subproject commit ae271e2d0e2219d1e4e04a96eec6f7281c063c31
+Subproject commit <new-commit-hash>
```

## Step 5: Commit the submodule pointer update

```bash
git commit -m "chore: update submodule pointers for story 1-2-user-authentication

Update om-blk-auth-service and om-newblink-blink-bff-service to latest
develop after merging user authentication PRs."
```

## Step 6: Push the parent repo

```bash
git push origin master
```

## Summary of All Commands (Copy-Paste Ready)

```bash
# From /Users/tannt/Works/GIT/OPUS/Sources/om-blk

# 1. Pull latest merged changes into each submodule
git submodule update --remote services/om-blk-auth-service
git submodule update --remote services/om-newblink-blink-bff-service

# 2. Verify
git submodule status services/om-blk-auth-service services/om-newblink-blink-bff-service

# 3. Stage the pointer changes in the parent repo
git add services/om-blk-auth-service services/om-newblink-blink-bff-service

# 4. Review
git diff --cached

# 5. Commit
git commit -m "chore: update submodule pointers for story 1-2-user-authentication

Update om-blk-auth-service and om-newblink-blink-bff-service to latest
develop after merging user authentication PRs."

# 6. Push
git push origin master
```
