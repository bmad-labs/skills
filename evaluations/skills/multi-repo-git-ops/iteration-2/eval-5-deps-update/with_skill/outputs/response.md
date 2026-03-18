# Commit Command for @nestjs/core v10 to v11 Upgrade in om-blk-auth-service

Based on the multi-repo-git-ops skill, this is a dependency update in a submodule repo. The skill specifies using the `deps` commit type for dependency updates (triggers a patch version bump via release-please). The skill also explicitly forbids `Co-Authored-By` trailers for AI agents.

## Commands

First, navigate into the service submodule and stage the specific changed files:

```bash
cd services/om-blk-auth-service
git add package.json package-lock.json
```

Then create the commit using the `deps` type (as shown in the skill's "Dependency update" example):

```bash
git commit -m "deps: upgrade @nestjs/core to v11"
```

## Why This Format

1. **Type is `deps`** -- The skill's commit type table specifies `deps` for "Dependency updates (package.json, lock files)" which triggers a **patch** SemVer bump.
2. **No scope** -- A scope is optional per the skill. Since this is a straightforward dependency upgrade affecting the whole service, omitting the scope keeps it clean (matching the skill's own example: `deps: upgrade @nestjs/core to v11.0.0`).
3. **Description uses imperative, present tense** ("upgrade" not "upgraded"), no capital first letter, no trailing period -- all per the skill's header rules.
4. **No `Co-Authored-By` trailer** -- The skill explicitly prohibits AI co-author trailers in commit messages (Safety Rule #9).
5. **Only specific files are staged** (`package.json` and `package-lock.json`) -- The skill forbids `git add .` or `git add -A` in service repos (Safety Rule #5).
