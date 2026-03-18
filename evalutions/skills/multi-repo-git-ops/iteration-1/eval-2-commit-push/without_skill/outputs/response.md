# Commit & Push Plan for Story 1-1-user-registration

## Step-by-Step Reasoning

1. **This is a multi-repo project with git submodules.** Each service under `services/` is an independent git repository. Changes must be committed inside each submodule first, then the parent repo must be updated to record the new submodule commit references.

2. **Two services are affected:**
   - `services/om-blk-auth-service/` (branch: `develop`) -- new files: `src/auth/registration.service.ts`, `src/auth/registration.controller.ts`
   - `services/om-newblink-iam-service/` (branch: `dev`) -- modified file: `src/iam/user.repository.ts`

3. **Order of operations:**
   - First, inspect changes in each submodule (safety check).
   - Commit and push each submodule independently.
   - Then update the parent repo to point to the new submodule commits.
   - Commit and push the parent repo.

4. **Safety considerations:**
   - Review `git status` and `git diff` before committing to ensure no unintended files are staged.
   - Confirm each submodule is on the correct branch before committing.
   - Never force-push or amend without explicit instruction.
   - Check for sensitive files (.env, credentials) before staging.

---

## Exact Git Commands (In Order)

### Phase 1: Inspect Changes (Safety Checks)

```bash
# 1. Check status in om-blk-auth-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git status
git branch

# 2. Check status in om-newblink-iam-service
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
git status
git branch

# 3. Review diffs for both services
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service
git diff

cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service
git diff
```

**Safety check:** At this point, I would review the output to confirm:
- `om-blk-auth-service` is on branch `develop`
- `om-newblink-iam-service` is on branch `dev`
- No unexpected files or sensitive data are present
- The diffs look correct

---

### Phase 2: Commit & Push om-blk-auth-service

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service

# Stage the new files
git add src/auth/registration.service.ts src/auth/registration.controller.ts

# Commit
git commit -m "$(cat <<'EOF'
feat: add user registration service and controller

Implement registration endpoint for story 1-1-user-registration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# Push to remote (develop branch)
git push origin develop
```

---

### Phase 3: Commit & Push om-newblink-iam-service

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service

# Stage the modified file
git add src/iam/user.repository.ts

# Commit
git commit -m "$(cat <<'EOF'
feat: update user repository for registration support

Modify user repository to support story 1-1-user-registration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# Push to remote (dev branch)
git push origin dev
```

---

### Phase 4: Update Parent Repo (om-blk)

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk

# Check parent repo status -- should show submodule pointer changes
git status

# Stage the updated submodule references
git add services/om-blk-auth-service services/om-newblink-iam-service

# Commit the submodule pointer updates
git commit -m "$(cat <<'EOF'
feat: update submodule refs for story 1-1-user-registration

Update om-blk-auth-service and om-newblink-iam-service submodule
pointers to include user registration implementation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# Push the parent repo
git push origin master
```

---

### Phase 5: Verify

```bash
# Verify all repos are clean
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service && git status
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-iam-service && git status
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk && git status
```

---

## Safety Checks & Confirmations

1. **Branch verification:** Confirm each submodule is on its expected branch (`develop` for auth-service, `dev` for iam-service) before committing.
2. **Diff review:** Review `git diff` output in each submodule to ensure only intended changes are present.
3. **No sensitive files:** Verify no `.env`, credentials, or secret files are being staged.
4. **Submodule-first ordering:** Always commit submodules before the parent repo, so the parent points to valid, pushed commits.
5. **No force push:** All pushes use standard `git push` without `--force`.
6. **No amend:** All commits are new commits, not amendments to existing ones.
7. **Specific file staging:** Files are staged by name (not `git add .` or `git add -A`) to avoid accidentally including unwanted files.
