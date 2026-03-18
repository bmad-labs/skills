# Multi-Repo Status Check - Without Skill

## Step-by-Step Reasoning

1. **Goal**: Get a quick overview of all 29 service submodules -- their current branches and whether they have uncommitted changes.

2. **Approach**: Git provides `git submodule foreach` which iterates over all initialized submodules and runs a command in each. This is the most efficient way to check status across all services without manually `cd`-ing into each one.

3. **Key information needed per service**:
   - Current branch name
   - Whether there are uncommitted changes (staged or unstaged)
   - Whether there are untracked files

4. **Strategy**: Run two commands -- one for a compact branch + dirty status overview, and optionally a second for more detail on services that have changes.

## Exact Git Commands (In Order)

### Command 1: Get branch and high-level dirty status for every submodule

```bash
git submodule foreach --quiet '
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "DETACHED")
  dirty=""
  if ! git diff --quiet 2>/dev/null; then dirty=" [unstaged changes]"; fi
  if ! git diff --cached --quiet 2>/dev/null; then dirty="$dirty [staged changes]"; fi
  untracked=$(git ls-files --others --exclude-standard | head -1)
  if [ -n "$untracked" ]; then dirty="$dirty [untracked files]"; fi
  if [ -z "$dirty" ]; then status="clean"; else status="$dirty"; fi
  echo "$name | branch: $branch |$status"
'
```

This single command iterates all 29 submodules and for each one prints:
- The submodule name
- The current branch (or "DETACHED" if in detached HEAD state)
- Whether it has unstaged changes, staged changes, or untracked files (or "clean")

### Command 2 (Optional follow-up): Get detailed diff stats for dirty submodules only

```bash
git submodule foreach --quiet '
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "=== $name ==="
    git diff --stat
    git diff --cached --stat
    echo ""
  fi
'
```

This shows file-level change summaries only for submodules that have modifications.

### Command 3 (Optional): Check if parent repo itself has changes

```bash
git status --short
```

This checks the parent `om-blk` repo for any changes (e.g., submodule pointer updates, changes to planning artifacts).

## How I Would Present the Results

I would organize the output into a summary table, grouping services by status:

---

**Example presentation:**

Here is the status across all 29 services:

### Services with Changes

| Service | Branch | Status |
|---------|--------|--------|
| om-blk-auth-service | `feature/story-4.2` | unstaged changes, untracked files |
| om-newblink-bl-service | `dev` | staged changes |
| om-newblink-frontend | `feature/ui-update` | unstaged changes |

**om-blk-auth-service** -- 3 files modified:
- `src/auth/auth.service.ts` (+25, -10)
- `src/auth/auth.controller.ts` (+5, -2)
- `test/auth.spec.ts` (+40, -0)

**om-newblink-bl-service** -- 1 file staged:
- `src/bl/bl.usecase.ts` (+12, -4)

*(and so on for each dirty service)*

### Clean Services (on expected branch)

| Service | Branch |
|---------|--------|
| ne-blk-api-service | `develop` |
| om-blink-frontend | `develop` |
| *(remaining clean services)* | |

### Services on Unexpected Branch

| Service | Current Branch | Expected Branch |
|---------|---------------|-----------------|
| om-blk-scheduler-service | `feature/hotfix` | `develop` |

### Parent Repo (om-blk)

- Branch: `master`
- Status: clean / has changes

---

**Key aspects of the presentation**:

1. **Dirty services first** -- These are what the user cares about most since they asked "which ones have changes."
2. **Branch comparison** -- I would cross-reference actual branches against the expected branches from `CLAUDE.md` and flag any that are on unexpected branches (likely feature branches from story work).
3. **Clean services collapsed** -- Listed briefly so the user knows they were checked but doesn't have to wade through noise.
4. **Actionable detail** -- For dirty services, show which files changed so the user can remember what they were working on.
