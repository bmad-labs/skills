# Build Systems — Detection and Rebuild Commands

Before executing any test suite (unit, integration, or manual), rebuild the application from source so the tests hit the latest code. Stale images, stale bytecode, and stale binaries are the most common cause of confusing test results: the test hits a version of the code that doesn't match what's in the working tree, and you spend an hour debugging a bug that was already fixed — or conversely, a test passes against old code that no longer reflects reality.

This reference covers the common build systems. Detect which one applies to the project, then run the matching rebuild command **before** starting services or executing tests.

## Table of Contents

- [Detection cheat sheet](#detection-cheat-sheet)
- [Docker Compose](#docker-compose)
- [Plain Docker (no compose)](#plain-docker-no-compose)
- [Node.js (npm / pnpm / yarn / bun)](#nodejs)
- [Python (uv / poetry / pip)](#python)
- [Rust (cargo)](#rust)
- [Go](#go)
- [Java / Kotlin (Maven / Gradle)](#java--kotlin)
- [Elixir (mix)](#elixir)
- [C# / .NET](#c--net)
- [Monorepos (Nx, Turborepo, Bazel)](#monorepos)
- [Multi-repo with submodules](#multi-repo-with-submodules)
- [When rebuild fails or is too slow](#when-rebuild-fails-or-is-too-slow)

## Detection cheat sheet

Inspect the project root for these markers. The first match wins; many projects combine several (e.g., Node.js monorepo packaged as Docker). Work outer-in: Docker wraps the language build, so rebuild the Docker image, and the language build happens inside the Dockerfile.

| Marker present | Build system |
|----------------|--------------|
| `docker-compose.yml` or `compose.yaml` | **Docker Compose** (primary — rebuild images) |
| `Dockerfile` (no compose) | **Plain Docker** |
| `package.json` + `package-lock.json` | npm |
| `package.json` + `pnpm-lock.yaml` | pnpm |
| `package.json` + `yarn.lock` | Yarn |
| `package.json` + `bun.lockb` | Bun |
| `pyproject.toml` + `uv.lock` | **uv** |
| `pyproject.toml` + `poetry.lock` | Poetry |
| `requirements.txt` / `setup.py` only | pip |
| `Cargo.toml` | Cargo (Rust) |
| `go.mod` | Go |
| `pom.xml` | Maven |
| `build.gradle` / `build.gradle.kts` | Gradle |
| `mix.exs` | Mix (Elixir) |
| `*.csproj` / `*.sln` | .NET |
| `nx.json` | Nx monorepo |
| `turbo.json` | Turborepo |
| `WORKSPACE` / `BUILD.bazel` | Bazel |
| `.gitmodules` | **Multi-repo** — rebuild each affected submodule |

If multiple markers apply (e.g., Docker + Node.js), start from the outermost (Docker) — the Dockerfile invokes the inner build.

## Docker Compose

The most common case for integration and manual tests. Rebuild images before bringing the stack up so the running containers reflect the current working tree.

```bash
# Standard: incremental rebuild (fast, uses cache)
docker compose build <service-names>
docker compose up -d --force-recreate <service-names>

# If you suspect cache staleness (after dependency bump, base image change,
# or any "why isn't my code change showing up?" moment):
docker compose build --no-cache <service-names>
docker compose up -d --force-recreate <service-names>

# Verify the right code landed in the image (optional sanity check):
docker compose exec <service-name> <cmd>   # e.g., cat a changed file

# Then wait for healthchecks:
docker compose ps
```

**Rebuild only what changed.** If you only edited server code, rebuild the server service, not the database. List services explicitly to save time.

**When `--force-recreate` matters.** Without it, `docker compose up -d` keeps running containers whose image was just rebuilt underneath them. The stale container continues serving the old code. Always pair rebuild with `--force-recreate` for the services you rebuilt.

**Shared volumes.** If your containers mount named volumes (e.g., for a vault directory), rebuilding images does not wipe the volume. That's usually correct — but if a test expects a clean slate, either add cleanup commands or use `docker compose down -v` at the start of the run.

## Plain Docker (no compose)

```bash
docker build -t <tag> .
docker rm -f <container-name> 2>/dev/null
docker run -d --name <container-name> ... <tag>
```

Prefer compose when a project has multiple services — simpler and less error-prone.

## Node.js

Detect the package manager from the lockfile. Use the matching command — mixing lockfiles between package managers creates subtle dependency drift.

### npm

```bash
npm ci          # clean install from lockfile (preferred for tests)
npm run build   # if the project has a build script
```

`npm ci` is deterministic and ~2x faster than `npm install` for tests. Use `npm install` only when you intentionally want to pick up lockfile updates.

### pnpm

```bash
pnpm install --frozen-lockfile
pnpm run build
```

### Yarn

```bash
yarn install --frozen-lockfile   # Yarn 1
yarn install --immutable         # Yarn 2+
yarn build
```

### Bun

```bash
bun install --frozen-lockfile
bun run build
```

### TypeScript specifics

If the test command transpiles on-the-fly (ts-node, tsx, vitest with esbuild), no separate build step is needed before unit tests. But for compiled artefacts (Next.js, tsc output), run `npm run build` before any integration test that loads the built output.

## Python

### uv (preferred — fast, deterministic)

```bash
uv sync                # installs locked deps into .venv
uv run pytest tests/   # runs in the synced env
```

`uv sync` is the rebuild equivalent — it reconciles `uv.lock` with `.venv`. No separate build step is needed for pure-Python code; test runs execute against the source tree.

### Poetry

```bash
poetry install --sync
poetry run pytest tests/
```

### pip

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"   # or: pip install -r requirements-dev.txt
pytest tests/
```

### When Python packages include C extensions

Rebuild the extension with `pip install -e . --force-reinstall --no-deps` or `uv sync --reinstall-package <name>`. Otherwise `.so` files stay stale on edits to the C source.

## Rust (cargo)

```bash
cargo build --release       # or --all-targets
cargo test
```

Cargo's incremental compilation is reliable; `cargo clean` is rarely needed. Release mode is a real perf difference if the test measures timing.

## Go

```bash
go build ./...              # builds everything — reveals compile errors early
go test ./...
```

Go's build cache is correct by default. No force-rebuild flag is typically needed. If you suspect cache corruption, `go clean -cache` and retry.

## Java / Kotlin

### Maven

```bash
mvn clean verify -DskipTests     # rebuild
mvn test                         # then run tests
# or combined:
mvn clean verify
```

### Gradle

```bash
./gradlew build -x test     # rebuild without running tests
./gradlew test              # then run tests
# or combined:
./gradlew build
```

Gradle incremental builds are reliable; `./gradlew clean build` is the nuclear option if classpath oddities appear.

## Elixir (mix)

```bash
mix deps.get
mix compile --force
mix test
```

`--force` ensures macros and module attributes re-evaluate against the latest source.

## C# / .NET

```bash
dotnet restore
dotnet build --no-restore
dotnet test --no-build
```

The `--no-*` flags chain the steps without redundant work.

## Monorepos

### Nx

```bash
nx reset                                 # clear cache if suspicious
nx run-many -t build -p <affected>       # rebuild only changed packages
nx affected -t test                      # test only affected
```

### Turborepo

```bash
turbo run build --force                  # ignore cache
turbo run test
```

### Bazel

```bash
bazel build //...
bazel test //...
```

Bazel's cache is hermetic — rebuild is only needed if inputs change, which Bazel detects automatically.

## Multi-repo with submodules

When the project uses git submodules (e.g., parent repo holding multiple component repos):

1. Identify which submodule contains the code-under-test.
2. `cd` into that submodule and run its build system (see sections above).
3. If the parent wraps the submodule in Docker, rebuild the parent's image after the submodule builds so the image picks up the new code.

Example (parent has `docker-compose.yml` that builds from a submodule at `components/service-a`):

```bash
cd components/service-a
# … make code changes, run submodule unit tests …

cd ../..
docker compose build service-a
docker compose up -d --force-recreate service-a
```

The submodule pointer in the parent does not need to be updated just to rebuild — Docker reads the working tree.

## When rebuild fails or is too slow

- **Rebuild fails**: stop. Tests against a broken build are noise. Triage the build error first — usually a missing dep, a moved file, or a breaking upstream change.
- **Rebuild is slow** (> a few minutes): before running the full manual test suite, ask whether the user wants incremental rebuild (cached, faster, 99% of the time correct) vs `--no-cache` (slower, definitely correct). Default to incremental; escalate to `--no-cache` only if the behaviour under test involves dependency or base-image changes.
- **User says "skip the rebuild"**: honour it. Note in the run summary that tests executed against whatever was already built, so if a failure looks suspicious you can retry with a fresh build.
