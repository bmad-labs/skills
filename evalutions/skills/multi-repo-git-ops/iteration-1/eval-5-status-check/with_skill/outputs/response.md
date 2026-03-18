# Status Check Response

## Step-by-Step Reasoning

1. **Goal**: The user wants a quick overview of all 29 services -- which ones have uncommitted changes and which branches they're on. They've lost track after working across multiple stories.

2. **Skill guidance**: The SKILL.md file provides an exact command for this under "Check Status Across All Repos". It uses `git submodule foreach` with a filter that only shows services that have changes OR are on a non-default branch. This is precisely what the user needs -- a filtered view that hides clean/default-branch services to reduce noise.

3. **Approach**: I would run two commands:
   - First, the filtered status command from the skill (shows only "interesting" services)
   - Second, a full branch listing across all services for completeness

4. **Why this order**: The filtered command answers the immediate question ("what's going on?"). The full listing provides context if the user wants to see everything.

## Exact Git Commands (In Order)

### Command 1: Filtered status -- only services with changes or non-default branches

```bash
git submodule foreach --quiet \
  'STATUS=$(git status --porcelain); BRANCH=$(git branch --show-current); DEFAULT=$(git config -f $toplevel/.gitmodules submodule.$name.branch); if [ -n "$STATUS" ] || [ "$BRANCH" != "$DEFAULT" ]; then echo "$(basename $(pwd)) [$BRANCH]: $([ -n "$STATUS" ] && echo "has changes" || echo "clean, non-default branch")"; fi'
```

This is taken directly from the skill's "Check Status Across All Repos" section. It iterates all 29 submodules but only prints services that meet one of two conditions:
- They have uncommitted changes (staged or unstaged, tracked or untracked)
- They are on a branch other than their configured default branch (e.g., on a feature branch instead of `develop`)

### Command 2 (optional follow-up): Full branch listing across all services

```bash
git submodule foreach --quiet 'BRANCH=$(git branch --show-current); echo "$(basename $(pwd)): $BRANCH"'
```

This shows every service and its current branch, for a complete picture.

### Command 3 (optional follow-up): Parent repo status

```bash
git status --porcelain
```

Check if the parent repo itself has changes (e.g., updated submodule pointers that haven't been committed).

## How I Would Present the Results

I would present the output in a structured summary like this:

---

Here's a summary of what's happening across your services:

**Services with activity** (changes or non-default branches):

| Service | Branch | Status |
|---------|--------|--------|
| om-blk-auth-service | `feat/1-2-user-authentication` | has changes |
| om-newblink-bl-service | `feat/3-1-bl-export` | clean, non-default branch |
| om-newblink-blink-bff-service | `feat/1-2-user-authentication` | has changes |

*(example output -- actual table would be populated from command output)*

**Everything else**: The remaining N services are clean and on their default branches.

**Parent repo (`om-blk`)**: *(clean / has uncommitted submodule pointer updates / etc.)*

---

If services had uncommitted changes, I would additionally offer:
- "Want me to show you the specific changes in any of these services?" (would run `git diff` inside the relevant service directory)
- "Want me to commit these changes?" (following the skill's commit conventions with story keys and conventional commit format)

If services were on feature branches, I would note which story/ticket the branch name corresponds to, based on the branch naming convention (`feat/{story-key}` or `feat/{TICKET}-{description}`).
