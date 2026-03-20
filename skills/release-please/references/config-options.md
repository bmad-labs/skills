# release-please Configuration Reference

## release-please-config.json

The config file lives at the repository root and controls how release-please behaves.

### Full Schema

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      // All options below go here for single-package repos
    }
  }
}
```

### All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `release-type` | string | — | **Required.** Package ecosystem (see release types below) |
| `changelog-path` | string | `"CHANGELOG.md"` | Path to changelog file relative to package |
| `bump-minor-pre-major` | boolean | `false` | Treat `feat` as patch when version < 1.0.0 |
| `bump-patch-for-minor-pre-major` | boolean | `false` | Treat `feat` as patch when version < 1.0.0 (finer control) |
| `draft` | boolean | `false` | Create release PRs as draft |
| `prerelease` | boolean | `false` | Create pre-release GitHub releases |
| `versioning` | string | `"default"` | Versioning strategy (`"default"` or `"always-bump-patch"`) |
| `extra-files` | array | `[]` | Additional files to update version strings in |
| `include-component-in-tag` | boolean | `true` (monorepo) | Prefix tag with component name |
| `include-v-in-tag` | boolean | `true` | Prefix tag with `v` (e.g., `v1.2.3`) |
| `tag-separator` | string | `"-"` | Separator between component and version in tag |
| `changelog-type` | string | `"default"` | Changelog format (`"default"` or `"github"`) |
| `changelog-sections` | array | (see below) | Customize changelog section headers |
| `pull-request-title-pattern` | string | `"chore${scope}: release${component} ${version}"` | PR title template |
| `pull-request-header` | string | `":robot: I have created a release..."` | PR body header |
| `separate-pull-requests` | boolean | `false` | One PR per package (monorepo) |
| `skip-github-release` | boolean | `false` | Skip creating GitHub releases |
| `draft-pull-request` | boolean | `false` | Create release PRs as drafts |
| `component` | string | package name | Component name for tags/changelogs |
| `release-as` | string | — | Force next release to this version |
| `snapshot-labels` | array | `[]` | Labels for snapshot releases |
| `exclude-paths` | array | `[]` | Glob patterns to exclude from change detection |
| `initial-version` | string | — | Version to use for first release |

### Changelog Sections Customization

```json
{
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "deps", "section": "Dependencies" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "refactor", "section": "Code Refactoring", "hidden": true },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "chore", "section": "Miscellaneous Chores", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "Continuous Integration", "hidden": true }
  ]
}
```

Set `"hidden": true` to exclude a commit type from the changelog entirely.

### Release Types

| Type | Ecosystem | Version File(s) |
|------|-----------|-----------------|
| `node` | Node.js | `package.json` |
| `python` | Python | `setup.py`, `setup.cfg`, `pyproject.toml` |
| `java` | Java (Maven) | `pom.xml` |
| `maven` | Java (Maven) | `pom.xml` (alias) |
| `go` | Go | Tags only (no version file) |
| `rust` | Rust | `Cargo.toml` |
| `ruby` | Ruby | `*.gemspec`, `lib/**/version.rb` |
| `php` | PHP | `composer.json` |
| `dart` | Dart/Flutter | `pubspec.yaml` |
| `elixir` | Elixir | `mix.exs` |
| `helm` | Helm charts | `Chart.yaml` |
| `terraform-module` | Terraform | Tags only |
| `ocaml` | OCaml | `dune-project`, `*.opam` |
| `krm-blueprint` | KRM | `*.yaml` |
| `simple` | Generic | Version file only (no ecosystem logic) |
| `github-pages` | GitHub Pages | Tags only |
| `expo` | Expo (React Native) | `app.json` |
| `salesforce` | Salesforce | `sfdx-project.json` |

---

## .release-please-manifest.json

The manifest tracks the current version of each package. It must exist at the repository root.

### Single Package

```json
{
  ".": "1.0.0"
}
```

### Monorepo

```json
{
  "packages/core": "2.1.0",
  "packages/cli": "1.3.2",
  "packages/utils": "0.5.1"
}
```

**Important:** The keys must match the keys in `release-please-config.json`'s `packages` object. The version should reflect the current released version (release-please will bump from here).

### Bootstrapping

When adding release-please to an existing project:

1. Set the manifest version to your **current released version**
2. release-please will create a PR bumping FROM this version based on new commits
3. If you have no prior releases, use `"0.0.0"` and release-please will create `0.1.0` or `1.0.0` based on commits

Alternatively, use the `Release-As: x.x.x` footer in a commit to force a specific first version.

---

## GitHub Action: googleapis/release-please-action@v4

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `config-file` | string | `"release-please-config.json"` | Path to config file |
| `manifest-file` | string | `".release-please-manifest.json"` | Path to manifest file |
| `token` | string | `${{ secrets.GITHUB_TOKEN }}` | GitHub token for API access |
| `target-branch` | string | default branch | Branch to target for release PRs |
| `skip-github-release` | boolean | `false` | Skip creating GitHub releases |
| `skip-github-pull-request` | boolean | `false` | Skip creating release PRs |
| `fork` | boolean | `false` | Create PR from a fork |

### Outputs

| Output | Description |
|--------|-------------|
| `release_created` | `true` if a release was created |
| `releases_created` | `true` if any releases were created (monorepo) |
| `tag_name` | Git tag for the release (e.g., `v1.2.3`) |
| `version` | Semver version string (e.g., `1.2.3`) |
| `major` | Major version number |
| `minor` | Minor version number |
| `patch` | Patch version number |
| `sha` | Release commit SHA |
| `upload_url` | URL for uploading release assets |
| `html_url` | URL of the GitHub release page |
| `pr` | Release PR number |
| `prs_created` | `true` if release PRs were created |
| `paths_released` | JSON array of released package paths (monorepo) |

#### Monorepo Output Access

For monorepo packages, outputs are namespaced by path with `/` replaced by `--`:

```yaml
# For package at "packages/core":
steps.release.outputs['packages/core--release_created']
steps.release.outputs['packages/core--tag_name']
steps.release.outputs['packages/core--version']
```

---

## Monorepo Configuration Example

**release-please-config.json:**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "separate-pull-requests": false,
  "packages": {
    "packages/core": {
      "release-type": "node",
      "component": "core"
    },
    "packages/cli": {
      "release-type": "node",
      "component": "cli"
    },
    "packages/utils": {
      "release-type": "node",
      "component": "utils"
    }
  }
}
```

**.release-please-manifest.json:**

```json
{
  "packages/core": "2.1.0",
  "packages/cli": "1.3.2",
  "packages/utils": "0.5.1"
}
```

With `separate-pull-requests: false` (default), all package releases are grouped into a single PR. Set to `true` for independent release PRs per package.

### Monorepo Commit Scopes

Use the component name as the commit scope so release-please routes the change correctly:

```
feat(core): add streaming support
fix(cli): resolve argument parsing for --verbose flag
```
