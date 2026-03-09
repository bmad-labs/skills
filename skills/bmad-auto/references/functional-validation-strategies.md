# Functional Validation Strategies

Reference document for Step 4.5 of the BMAD Auto-Implementation Orchestrator.
Defines project type detection and links to per-type validation guides.

## Tool Selection Principle

For project types that require platform-specific toolchains (embedded, mobile, IaC, ML, etc.),
follow this decision process:

1. **Check if native tools are already installed.** If the required build tools and runtime
   are available locally, use them directly — native tools are faster and provide the most
   accurate validation.
2. **If native tools are missing, prefer Docker containers** over asking the user to install
   platform-specific toolchains. Docker provides reproducible environments and avoids complex
   local setup.
3. **If neither native tools nor Docker are available,** suggest both options to the user and
   let them choose: install Docker (simpler, works for most cases) or install the native
   toolchain (better long-term if they'll work with this stack regularly).

**Decision flow:**
```
Native tools installed? → YES → Use native tools
                        → NO  → Docker available? → YES → Use Docker container
                                                   → NO  → Suggest: Docker (quick) or native install (long-term)
```

## Project Type Detection

### Detection Algorithm

Check file markers in the repository root (and subdirectories if needed). Apply the FIRST
matching rule — project types are listed in priority order to handle ambiguous cases
(e.g., a repo with both `platformio.ini` and `package.json` is Embedded, not Frontend).

| Priority | File Marker(s) | Project Type | Guide File |
|----------|---------------|--------------|------------|
| 1 | `platformio.ini` or `Makefile` with MCU targets | Embedded/Firmware | `embedded-linux-mac.md` or `embedded-windows-wsl.md` (based on OS) |
| 2 | `main.tf` or `Pulumi.yaml` or `cdk.json` | Infrastructure as Code | `infrastructure-as-code.md` |
| 3 | `pubspec.yaml` (Flutter) or `package.json` with `react-native` | Mobile | `mobile-application.md` |
| 4 | `docker-compose.yml` + frontend framework in subdir | Full-Stack | `fullstack-application.md` |
| 5 | `package.json` with `react`/`next`/`vue`/`angular`/`svelte` | UI/Frontend | `ui-application.md` |
| 6 | `package.json` with `express`/`fastify`/`nestjs`/`hapi` | Backend/API | `backend-application.md` |
| 7 | `go.mod` or `Cargo.toml` with `actix`/`axum`/`rocket`/`warp` | Backend/API | `backend-application.md` |
| 8 | `Cargo.toml` or `setup.py`/`pyproject.toml` with CLI entry | CLI/Library | `cli-library.md` |
| 9 | `dvc.yaml` or ML framework imports (`torch`, `tensorflow`, `sklearn`) | Data Pipeline/ML | `data-pipeline-ml.md` |
| 10 | `Makefile` or `CMakeLists.txt` (no platformio.ini) | CLI/Library (C/C++) | `cli-library.md` |

### PRD/Architecture Override

If the PRD or architecture document explicitly states the project type, use that over file
marker detection. Read:
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`

### OS Detection for Embedded Projects

For embedded projects, select the appropriate guide based on the operating system:
- **Linux/macOS**: Use `embedded-linux-mac.md`
- **Windows**: Use `embedded-windows-wsl.md`

Detect with:
```bash
uname -s 2>/dev/null || echo "Windows"
```

## Cross-Cutting Guides

After running the primary validation for the detected project type, also consider these
cross-cutting guides if applicable:

| Guide | When to Apply |
|-------|--------------|
| `security-testing.md` | All projects — run dependency audit and secret scanning |
| `container-testing.md` | Projects with `Dockerfile` or `docker-compose.yml` |
| `accessibility-testing.md` | UI/Frontend or Full-Stack projects |
| `performance-testing.md` | All projects — at minimum check build/binary size |

Cross-cutting tests are **optional enhancements**. They warn but never block a commit.

## Tool Availability Check

Before running any validation, check tool availability. Check native tools first — if they
are installed, use them directly. Only check Docker as a fallback for missing native tools.

```bash
# Build tools (check native first)
command -v pio && echo "PlatformIO: available"
command -v npm && echo "npm: available"
command -v yarn && echo "yarn: available"
command -v pnpm && echo "pnpm: available"
command -v bun && echo "bun: available"
command -v cargo && echo "cargo: available"
command -v go && echo "go: available"
command -v make && echo "make: available"
command -v gradle && echo "gradle: available"
command -v mvn && echo "mvn: available"
command -v flutter && echo "flutter: available"
command -v terraform && echo "terraform: available"
command -v pulumi && echo "pulumi: available"
command -v cdk && echo "cdk: available"

# Testing/automation tools
command -v curl && echo "curl: available"
command -v pytest && echo "pytest: available"
npx playwright --version 2>/dev/null && echo "playwright: available"
npx cypress --version 2>/dev/null && echo "cypress: available"

# Simulation tools (embedded)
command -v qemu-system-arm && echo "QEMU: available"
command -v renode && echo "Renode: available"
```

## Graceful Degradation

The validation sub-agent should always attempt the maximum level of validation possible:

1. **Always build** — even if runtime testing is impossible, build verification catches
   compilation errors, missing dependencies, and configuration problems.
2. **Use native tools when available** — they are faster and more accurate than Docker-based
   alternatives. Only consider Docker when native tools are missing.
3. **Docker as fallback** — when native tools are not installed, Docker containers avoid
   complex local setup and provide reproducible environments.
4. **Suggest both options** — if neither is available, suggest Docker (simpler) and native
   install (better long-term), letting the user choose.
5. **Never block on optional tests** — cross-cutting tests (security, accessibility,
   performance) warn but do not block commits.

## Report Format

The validation sub-agent must report one of these outcomes:

### PASS
Build succeeded and runtime tests passed (or runtime not applicable).
```
VALIDATION: PASS
- Build: OK (pio run -e mks_tinybee, 0 errors)
- Simulation: OK (simulator build successful)
- Tests: N/A (no automated tests)
```

### PARTIAL
Build succeeded but runtime validation could not be performed.
```
VALIDATION: PARTIAL
- Build: OK (npm run build, 0 errors)
- Runtime: SKIPPED (no Playwright or browser MCP available)
- Missing tools: Install Playwright with `npm init playwright@latest`
```

### FAIL
Build failed or runtime tests failed.
```
VALIDATION: FAIL
- Build: FAILED
- Error: src/main.cpp:42: undefined reference to `setupDelta()`
- Suggested fix: Missing #include "delta.h" in main.cpp
```
