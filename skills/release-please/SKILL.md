---
name: release-please
description: >
  Set up and configure Google's release-please for automated versioning, changelog generation,
  and publishing via GitHub Actions. Covers pipeline creation, Conventional Commits formatting,
  pre-release workflows, monorepo configuration, and troubleshooting release pipelines.
  Use this skill whenever the user wants to automate releases, set up CI/CD for publishing,
  configure version bumping, write release-please-compatible commit messages, tag versions
  automatically, publish to npm/PyPI/crates.io/Maven/Docker, or troubleshoot why a release PR
  wasn't created. Activate even if the user doesn't mention "release-please" by name — phrases
  like "automate my npm releases", "set up GitHub Actions for publishing", "how do I tag versions
  automatically", "changelog generation", "semver automation", or "pre-release workflow" all
  indicate this skill. For commit message guidance specifically, this skill focuses on
  release-please-compatible conventions; for broader multi-repo git operations with submodules,
  defer to multi-repo-git-ops instead.
---

# release-please

## Overview

[release-please](https://github.com/googleapis/release-please) automates versioning and releases by analyzing Conventional Commit messages:

1. **Push** conventional commits to your default branch
2. **release-please creates/updates a Release PR** with version bump and changelog
3. **Merge** the Release PR to trigger a GitHub Release
4. **Publish** step runs when a release is created (npm, PyPI, crates.io, etc.)

release-please handles version determination, changelog generation, and git tagging. You write good commit messages; it does the rest.

## Commit Message Assistance

When a user asks for help writing a commit message (not setting up a pipeline):

1. **Ask what changed** — "What did you change and why?" (skip if already described)
2. **Suggest the type** — Pick from the type table below, explain why that type fits
3. **Draft the message** — Write the full commit message (header + body if needed + footers)
4. **Confirm** — Present it for the user to approve or adjust

If the change is breaking, always include a `BREAKING CHANGE:` footer explaining migration impact.

## Pipeline Setup Flow

When a user wants to set up release-please, follow this interactive protocol.

If `.github/workflows/release.yml` (or similar) already exists, read it first, compare against the templates in `references/workflow-templates.md`, and suggest specific improvements rather than replacing it wholesale. Common improvement opportunities: missing concurrency groups, publish not gated on `release_created`, missing idempotent publish check, overly broad permissions.

### Step 1: Detect Project Type

Scan the repository for package manifests:

| File | Release Type |
|------|-------------|
| `package.json` | `node` |
| `pyproject.toml` / `setup.py` | `python` |
| `pom.xml` | `java` |
| `go.mod` | `go` |
| `Cargo.toml` | `rust` |
| `*.gemspec` | `ruby` |
| `composer.json` | `php` |
| `pubspec.yaml` | `dart` |
| `mix.exs` | `elixir` |
| `Chart.yaml` | `helm` |

If multiple manifests exist at the root, ask which is primary. If none found, use `simple`.

### Step 2: Ask Configuration Questions

Ask these questions (skip any already answered or obvious from context):

1. **Is this a monorepo?** (multiple packages in subdirectories)
2. **What is the default branch?** (default: `main`)
3. **Do you need pre-release support?** (manual alpha/beta/rc releases)
4. **Where do you publish?** (npm, GitHub Packages, PyPI, Maven Central, crates.io, Docker, none)
5. **What is the current version?** (check package manifest, default: `0.0.0`)

### Step 3: Generate Files

Create three files based on the answers:

#### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": false,
      "draft": false,
      "prerelease": false,
      "versioning": "default",
      "extra-files": []
    }
  }
}
```

Adjust `release-type` based on detected project type. For monorepos, add multiple entries under `packages` with `component` names.

#### .release-please-manifest.json

```json
{
  ".": "1.0.0"
}
```

Set to the current released version. Use `"0.0.0"` for new projects.

#### .github/workflows/release.yml

For **Node.js → npm public registry** (most common), use this base template:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

For **other ecosystems**, see `references/workflow-templates.md` for complete templates including:
- Node.js → GitHub Packages (with idempotent publish check)
- Python → PyPI (trusted publishers)
- Java → Maven Central
- Go (tags only, optional GoReleaser)
- Rust → crates.io
- Docker (build + push with semver tags)
- Monorepo (per-package publish jobs)
- Pre-release pattern (workflow_dispatch with version resolution)

**Always customize:**
- Replace `main` with the actual default branch if different
- Adjust Node version, Python version, Java version, etc.
- Add registry-specific secrets configuration
- If pre-release support is needed, use the pre-release template from `references/workflow-templates.md`

## Configuration Quick Reference

| Option | Default | Purpose |
|--------|---------|---------|
| `release-type` | — | Package ecosystem (required) |
| `bump-minor-pre-major` | `false` | Treat `feat` as patch when < 1.0.0 |
| `changelog-path` | `CHANGELOG.md` | Where to write the changelog |
| `include-v-in-tag` | `true` | Tag as `v1.2.3` vs `1.2.3` |
| `separate-pull-requests` | `false` | One PR per package (monorepo) |
| `draft` | `false` | Create release PRs as drafts |
| `extra-files` | `[]` | Additional files with version strings to update |
| `changelog-sections` | (defaults) | Customize which types appear in changelog |

### Monorepo Quick Setup

```json
// release-please-config.json
{
  "packages": {
    "packages/core": { "release-type": "node", "component": "core" },
    "packages/cli": { "release-type": "node", "component": "cli" }
  }
}
```

```json
// .release-please-manifest.json
{ "packages/core": "0.0.0", "packages/cli": "0.0.0" }
```

Use component names as commit scopes: `feat(core): add streaming support`

For full configuration options, see `references/config-options.md`.

## Commit Message Guide

release-please reads commit messages to determine version bumps and generate changelogs. Every commit to the default branch must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- Use imperative present tense: "add" not "added"
- Do not capitalize the first letter of the description
- Do not end with a period

### Type → Version Bump

| Type | Bump | Triggers Release? |
|------|------|-------------------|
| `feat` | Minor | Yes |
| `fix` | Patch | Yes |
| `deps` | Patch | Yes |
| `refactor` | — | No |
| `perf` | — | No |
| `test` | — | No |
| `docs` | — | No |
| `style` | — | No |
| `chore` | — | No |
| `build` | — | No |
| `ci` | — | No |

**Breaking changes** (any type with `!` or `BREAKING CHANGE:` footer) → **Major** bump.

### Breaking Change Examples

```
feat(api)!: redesign authentication flow

BREAKING CHANGE: /auth/login now requires OAuth2 tokens instead of API keys.
```

```
refactor(database): migrate from MongoDB to PostgreSQL

BREAKING CHANGE: all database connection strings must be updated.
```

### Special Footers

| Footer | Purpose |
|--------|---------|
| `BREAKING CHANGE: <desc>` | Triggers major version bump |
| `Release-As: x.x.x` | Force a specific version number |

### Quick Examples

```
feat(booking): add search by date range endpoint
fix(auth): resolve token refresh race condition
deps: upgrade @nestjs/core to v11.0.0
test(scheduler): add unit tests for cron parser
chore: update .gitignore
```

### No AI Co-Author Trailers

**NEVER add `Co-Authored-By` trailers for AI agents** in commit messages. These pollute changelogs and git history.

For the complete commit conventions reference with 15+ examples, scopes guide, and anti-patterns, see `references/commit-conventions.md`.

## Best Practices

### Squash Merges

Configure your repository to use **squash merges** for feature branches. This ensures each PR produces a single conventional commit, keeping the changelog clean. Set the squash commit message to use the PR title (which should be a conventional commit message).

### Permissions

The GitHub Action needs `contents: write` and `pull-requests: write` at minimum. Add `packages: write` or `id-token: write` for publish steps as needed. Use the principle of least privilege — grant permissions per-job, not at workflow level.

### Concurrency

Always set `cancel-in-progress: false` for release workflows. Canceling a release mid-way can leave partial state (tags without releases, PRs in inconsistent state).

### Publish Gating

Never publish in the release-please job itself. Use a separate `publish` job gated on `release_created == 'true'`. This separates concerns and makes retries easier.

### Idempotent Publish

Check if the version already exists in the registry before publishing. This prevents failures on workflow re-runs:

```yaml
- name: Check if version exists
  id: check
  run: |
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    VERSION=$(node -p "require('./package.json').version")
    if npm view "${PACKAGE_NAME}@${VERSION}" version 2>/dev/null; then
      echo "exists=true" >> "$GITHUB_OUTPUT"
    else
      echo "exists=false" >> "$GITHUB_OUTPUT"
    fi
- if: steps.check.outputs.exists == 'false'
  run: npm publish
```

### Bootstrapping Existing Projects

When adding release-please to a project with existing releases:

1. Set `.release-please-manifest.json` to your current version
2. Merge the setup PR with a `chore:` commit
3. release-please will create the next release PR based on subsequent commits
4. Alternatively, use `Release-As: x.x.x` footer to force a starting version

## Troubleshooting

### No Release PR Created

- Ensure commits since the last release include at least one releasable type (`feat`, `fix`, `deps`)
- Check that commits are on the correct branch (must match workflow trigger)
- Verify `release-please-config.json` and manifest exist and are valid JSON
- Check Actions logs for permission errors

### Wrong Version Bump

- Review commit messages — `chore:` won't trigger a release, `feat:` triggers minor
- Check for `BREAKING CHANGE:` footers that may trigger an unexpected major bump
- Use `Release-As: x.x.x` footer to override if needed

### Pre-Release Flow

- Pre-releases use `workflow_dispatch`, not automatic push triggers
- The pre-release identifier is appended to the current version: `1.2.3-alpha.1`
- Use the `next` npm tag (or equivalent) for pre-releases, `latest` for stable
- See the pre-release template in `references/workflow-templates.md`

### Token / Permission Issues

- Default `GITHUB_TOKEN` works for release-please PRs and releases
- Publishing to external registries requires dedicated secrets (`NPM_TOKEN`, etc.)
- GitHub Packages publishing uses `GITHUB_TOKEN` with `packages: write` permission
- For PyPI, use [trusted publishers](https://docs.pypi.org/trusted-publishers/) instead of API tokens

## References

| Reference | Description |
|-----------|-------------|
| `references/commit-conventions.md` | Full Conventional Commits specification with examples and anti-patterns |
| `references/workflow-templates.md` | Complete workflow templates for 9 ecosystems |
| `references/config-options.md` | All configuration options, release types, and Action inputs/outputs |
| [release-please GitHub](https://github.com/googleapis/release-please) | Official documentation |
| [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | Specification |
