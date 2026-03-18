# Branch Setup Plan for Story 2-3-implement-jwt-auth

## Step-by-Step Reasoning

1. **Identify affected services and their base branches**: Per CLAUDE.md, both `om-blk-auth-service` and `om-newblink-blink-bff-service` use `develop` as their main branch. Feature branches should be created from `develop` in each.

2. **Branch naming convention**: Use the story identifier as the feature branch name: `feature/story-2-3-implement-jwt-auth`. This keeps branches traceable to the story.

3. **For each submodule**: Navigate into the submodule, fetch latest from remote, ensure we are on the latest `develop`, then create and checkout the feature branch.

4. **Parent repo**: No code changes happen in the parent repo, but the submodule pointers will change once commits are made. No branch is strictly needed in the parent repo for this, but it could be useful for tracking which submodule commits go together.

## Safety Checks and Confirmations

- **Before branching**: Confirm each submodule has no uncommitted changes (`git status`).
- **Before branching**: Confirm `develop` is up to date with the remote (`git fetch` then compare).
- **After branching**: Verify the feature branch was created and is checked out (`git branch --show-current`).
- **Story file**: No story file matching `2-3` or `jwt` was found in `_bmad-output/implementation-artifacts/`. The user should confirm the story file exists or provide it before implementation begins.

## Exact Git Commands (In Order)

### 1. Check for uncommitted changes in both submodules

```bash
git -C services/om-blk-auth-service status
git -C services/om-newblink-blink-bff-service status
```

If either shows uncommitted changes, stop and confirm with the user before proceeding.

### 2. Fetch latest from remote in both submodules

```bash
git -C services/om-blk-auth-service fetch origin
git -C services/om-newblink-blink-bff-service fetch origin
```

### 3. Checkout and update the develop branch in each submodule

```bash
git -C services/om-blk-auth-service checkout develop
git -C services/om-blk-auth-service pull origin develop

git -C services/om-newblink-blink-bff-service checkout develop
git -C services/om-newblink-blink-bff-service pull origin develop
```

### 4. Create and checkout the feature branch in each submodule

```bash
git -C services/om-blk-auth-service checkout -b feature/story-2-3-implement-jwt-auth
git -C services/om-newblink-blink-bff-service checkout -b feature/story-2-3-implement-jwt-auth
```

### 5. Verify the branches were created correctly

```bash
git -C services/om-blk-auth-service branch --show-current
git -C services/om-newblink-blink-bff-service branch --show-current
```

Both should output: `feature/story-2-3-implement-jwt-auth`

## Summary

| Service | Base Branch | Feature Branch |
|---------|-------------|----------------|
| om-blk-auth-service | develop | feature/story-2-3-implement-jwt-auth |
| om-newblink-blink-bff-service | develop | feature/story-2-3-implement-jwt-auth |

Total commands: 9 git commands across 2 submodules (plus 2 verification commands).
