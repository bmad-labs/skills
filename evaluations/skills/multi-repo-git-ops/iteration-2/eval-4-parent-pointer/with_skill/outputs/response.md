# Update Parent Repo Submodule Pointers After Story 1-2-user-authentication

After PRs have been merged in `om-blk-auth-service` and `om-newblink-blink-bff-service`, you need to update the parent repo's submodule pointers to reference the latest commits on each service's default branch.

## Exact Commands

Run these from the parent repo root (`om-blk/`):

### Step 1: Switch each service to its default branch and pull the merged changes

```bash
# om-blk-auth-service (default branch: develop)
cd services/om-blk-auth-service
git checkout develop
git pull origin develop
cd ../..

# om-newblink-blink-bff-service (default branch: develop)
cd services/om-newblink-blink-bff-service
git checkout develop
git pull origin develop
cd ../..
```

### Step 2: Stage the updated submodule pointers in the parent repo

```bash
git add services/om-blk-auth-service services/om-newblink-blink-bff-service
```

### Step 3: Commit in the parent repo using conventional commit format

```bash
git commit -m "chore: update submodule pointers after story 1-2-user-authentication

Services updated:
- om-blk-auth-service
- om-newblink-blink-bff-service"
```

## Notes

- Both services track the `develop` branch as their default (per `.gitmodules`).
- The commit type is `chore:` because updating submodule pointers is a maintenance operation in the parent repo, not a feature change. This is a non-releasable commit type.
- No `Co-Authored-By` trailers are included per project rules.
- Do **not** push the parent repo until you have confirmed the submodule pointer commit looks correct (`git log -1` and `git diff --cached` or `git show`).
