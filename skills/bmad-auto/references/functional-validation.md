# Functional Validation

Build, run, and test the implementation in its real runtime. Catches the class of bugs that unit tests with mocks cannot: misconfigured services, missing Docker images, broken migrations, dependency-version incompatibilities, and integration failures between components.

This document covers:
1. **Light vs. full** — when to run which (epic-aware).
2. **Project type detection** — picking the right playbook.
3. **Tool-availability strategy** — native first, Docker fallback, suggest both.
4. **Infrastructure verification** — non-optional when the story touches infra.
5. **Report format** — PASS / PARTIAL / FAIL with required details.

The per-project-type playbooks themselves live in `references/guides/`. Read this file first to know which guide to read.

---

## 1. Light vs Full validation

The leader chooses light or full per story based on **epic size**, then writes the choice into the tester's Delegation Packet.

| Epic size | Per-story validation | Epic completion |
|---|---|---|
| ≤3 stories | **Full** every story | (already covered story-by-story) |
| >3 stories | **Light** every story | **Full** epic suite once at completion |

### What "light" means

The goal of light validation is to verify the application **actually runs and the main paths work** — not to re-check things code review and unit tests already covered.

- **Build succeeds** (`npm run build`, `cargo build`, `pio run`, etc.).
- **Run the application** — deploy locally if possible, or via Docker if the project has a `docker-compose.yml` / `Dockerfile`. Bring it up to a state where it can serve requests / respond to commands / read inputs.
- **Smoke check the main cases** — exercise the primary happy path of what this story changed. For a new endpoint: hit it with `curl` and check the response. For a new CLI command: run it on a real input and check the output. For a UI change: load the page and verify it renders. For a worker / consumer: send a representative message and verify it processes.
- **Skipped:**
  - **Unit tests** — already verified during code review (the developer ran them; the leader saw the result).
  - Slow E2E suites, exhaustive edge-case runs, full integration matrices.
  - Cross-cutting tests (security / a11y / perf) — those are full-mode only.
  - Heavy infra spin-up if it's not trivially scripted.

Rule of thumb: light validation answers *"does the change actually work when the app is running?"* — which unit tests can't answer because they don't bring up the runtime. It should usually finish in a few minutes. If it's much longer, you're either running full by accident or the project's "main case" smoke is genuinely involved (which is fine, but worth noticing).

### What "full" means

- Everything in light (build + run app + main-case smoke), plus:
- Integration / E2E tests for the project type (see playbooks under `references/guides/`) — exercise edge cases and integration boundaries, not just the happy path.
- Infrastructure verification (Section 4 below) when the story touches infra.
- Cross-cutting checks where applicable (security audit, container scan, accessibility, performance budget).
- Real HTTP / DB / queue calls instead of mocks where feasible — full mode is where you catch the misconfigured-service / wrong-version / broken-migration class of bugs.

### Why epic-aware?

A 1-3 story epic often *is* the work; running the full suite per story is the right granularity. A 5+ story epic accumulates churn — running full for every story is N× the cost and 80% redundant because most stories touch overlapping surfaces. Light per story + full at completion catches the same regressions for a fraction of the cost.

This isn't a license to skip infrastructure verification within a story that touches infra — see Section 4.

---

## 2. Project type detection

Detect once at the start of the epic (in team modes, the tester does this on first spawn and remembers; in main/hybrid, the leader does it). Apply the FIRST matching rule from the table — types are listed in priority order to handle ambiguity.

| Priority | Marker | Type | Guide |
|---|---|---|---|
| 1 | `platformio.ini` (or `Makefile` with MCU targets) | Embedded/Firmware | `guides/embedded-linux-mac.md` or `guides/embedded-windows-wsl.md` (by OS) |
| 2 | `main.tf` / `Pulumi.yaml` / `cdk.json` | Infrastructure as Code | `guides/infrastructure-as-code.md` |
| 3 | `pubspec.yaml` (Flutter), or `package.json` with `react-native` | Mobile | `guides/mobile-application.md` |
| 4 | `docker-compose.yml` + frontend framework in subdir | Full-Stack | `guides/fullstack-application.md` |
| 5 | `package.json` with `react`/`next`/`vue`/`angular`/`svelte` | UI/Frontend | `guides/ui-application.md` |
| 6 | `package.json` with `express`/`fastify`/`nestjs`/`hapi` | Backend/API | `guides/backend-application.md` |
| 7 | `go.mod` or `Cargo.toml` with `actix`/`axum`/`rocket`/`warp` | Backend/API | `guides/backend-application.md` |
| 8 | `Cargo.toml` or `setup.py`/`pyproject.toml` with CLI entry | CLI/Library | `guides/cli-library.md` |
| 9 | `dvc.yaml` or ML imports (`torch`, `tensorflow`, `sklearn`) | Data Pipeline/ML | `guides/data-pipeline-ml.md` |
| 10 | `Makefile` or `CMakeLists.txt` (no `platformio.ini`) | CLI/Library (C/C++) | `guides/cli-library.md` |

### PRD/Architecture override

If `_bmad-output/planning-artifacts/prd.md` or `architecture.md` explicitly states the project type, that beats marker detection.

### OS detection for embedded

```bash
uname -s 2>/dev/null || echo "Windows"
```
Linux/macOS → `embedded-linux-mac.md`. Windows → `embedded-windows-wsl.md`.

### Cross-cutting guides (apply on top of the primary type, only in **full** mode)

| Guide | When to apply |
|---|---|
| `guides/security-testing.md` | All projects — dep audit + secret scan |
| `guides/container-testing.md` | Projects with `Dockerfile` or `docker-compose.yml` |
| `guides/accessibility-testing.md` | UI/Frontend or Full-Stack |
| `guides/performance-testing.md` | All projects — at minimum check build/binary size |

Cross-cutting tests **warn but never block a commit** in full mode. They are not run in light mode.

---

## 3. Tool-availability strategy

For project types with platform-specific toolchains:

```
Native tools installed?
  YES → use native (faster + most accurate)
  NO  → Docker available?
          YES → use Docker container (reproducible, no local install)
          NO  → suggest both: Docker (quick) or native install (long-term)
```

### Quick availability check

```bash
# Build tools
command -v pio && echo "PlatformIO: yes"
command -v npm && echo "npm: yes"
command -v yarn && echo "yarn: yes"
command -v pnpm && echo "pnpm: yes"
command -v bun && echo "bun: yes"
command -v cargo && echo "cargo: yes"
command -v go && echo "go: yes"
command -v make && echo "make: yes"
command -v gradle && echo "gradle: yes"
command -v mvn && echo "mvn: yes"
command -v flutter && echo "flutter: yes"
command -v terraform && echo "terraform: yes"
command -v pulumi && echo "pulumi: yes"
command -v cdk && echo "cdk: yes"

# Testing & automation
command -v curl && echo "curl: yes"
command -v pytest && echo "pytest: yes"
npx playwright --version 2>/dev/null && echo "playwright: yes"
npx cypress --version 2>/dev/null && echo "cypress: yes"

# Embedded simulation
command -v qemu-system-arm && echo "QEMU: yes"
command -v renode && echo "Renode: yes"
```

---

## 4. Infrastructure verification (non-optional)

When a story introduces or depends on infrastructure, full validation must attempt to verify the infrastructure actually works — not just that unit tests pass with mocks. Examples:

- **Docker Compose service** added → `docker compose up -d` and check health endpoints / `docker compose ps`.
- **DB migration** added → run it against a real (local or Docker) database. Don't just check the migration file exists.
- **External Docker image** referenced → `docker pull <image>` to verify it's accessible.
- **API endpoint** added → start the server and hit it with `curl` or HTTPie if startup is feasible.
- **Message queue / worker** added (Redis, RabbitMQ, ARQ) → verify the queue starts and the worker connects.

If infrastructure can't be verified (no Docker, no DB, no network), **report PARTIAL with the specific gap named** — never silently skip it. The gap must be visible so it can be tracked.

In light mode: bringing the app up (locally or via Docker) is the whole point — that includes whatever services the story touches if they're easy to start. If a story adds a Redis dependency and `docker compose up redis` is one command away, do it. The line for light mode is *"would running this take more than a few minutes?"* — if yes, defer the heavy parts (full migration replays, multi-service E2E spin-ups) to the epic-end full pass; if no, do them now.

---

## 5. Report format

The validator (sub-agent or leader-direct) reports one of:

### PASS — light

```
VALIDATION: PASS
- Mode: light
- Build: OK (npm run build, 0 errors)
- Runtime: OK (docker compose up -d → all 3 services healthy)
- Main-case smoke: OK
  - POST /api/orders with sample payload → 201 + expected body shape
  - Worker consumed test event from Redis and wrote to DB
- Note: unit tests skipped in light mode (verified during code review)
```

### PASS — full

```
VALIDATION: PASS
- Mode: full
- Build: OK
- Runtime: OK (docker compose up -d, all services healthy)
- Main-case smoke: OK
- Integration / E2E: OK (12 scenarios passing — playwright, 3m41s)
- Infrastructure: OK (migration replay against fresh DB, redis ping, kafka topic created)
- Cross-cutting: 1 warning — bundle size +14kb (non-blocking; flagged for follow-up)
```

### PARTIAL

```
VALIDATION: PARTIAL
- Mode: light
- Build: OK
- Runtime: SKIPPED — Docker not available locally; cannot bring up the new redis service
- Main-case smoke: SKIPPED (no runtime to hit)
- Suggested action: install Docker (or run on a host with Docker), then re-run validation
```

### FAIL

```
VALIDATION: FAIL
- Mode: light
- Build: FAILED
- Error: src/main.cpp:42 — undefined reference to setupDelta()
- Suspected fix: missing #include "delta.h" in main.cpp
- Other context: <anything that helps the developer>
```

The leader uses these reports to decide:
- PASS → proceed to commit.
- PARTIAL → log the gap in the commit message, proceed.
- FAIL → fix-request Delegation Packet to the developer with the FAIL report as *Prior findings verbatim*.

---

## When to read which guide

- **Detection step:** read this file (you're already here).
- **Running validation:** read `guides/<detected-type>.md` for the project's primary type.
- **Full mode only:** also read the cross-cutting guides (`guides/security-testing.md`, etc.) that apply.
- **Light mode:** skip the per-type guide's deep playbooks; build, bring the runtime up, smoke-check the main cases. Unit tests already covered in code review — don't repeat them.

The guides are not loaded into context automatically. Read them on demand when you reach the step.
