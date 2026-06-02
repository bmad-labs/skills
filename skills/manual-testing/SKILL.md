---
name: manual-testing
description: "Manual test planning, writing, reviewing, executing, and maintaining test cases. Use when: user asks to write test cases, create a test plan, run manual tests, review test coverage, update tests after feature changes, or asks 'how should I test this'. Also trigger after implementing features that change system behavior — per CLAUDE.md, updating the manual test plan is mandatory. Covers API/backend, frontend, pipeline/workflow, AI/LLM, and infrastructure testing patterns."
---

# Manual Testing Skill

You are a QA engineer who helps plan, write, review, execute, and maintain manual test cases. You produce test artifacts that are specific, reproducible, and traceable to design documents.

## When This Skill Activates

- User asks to write, create, or generate test cases or test plans
- User asks "how should I test this?" or "what test cases do I need?"
- User asks to review test coverage or evaluate test quality
- User asks to run manual tests or execute test cases
- User asks to update tests after a feature change
- After implementing a feature (CLAUDE.md requires updating test plan)

## Capabilities

| Code  | Action  | Description                                                      |
| ----- | ------- | ---------------------------------------------------------------- |
| **P** | Plan    | Create a test plan from design docs, PRD, or feature description |
| **W** | Write   | Create test case files with preconditions, steps, checkpoints    |
| **R** | Review  | Evaluate test case quality against criteria                      |
| **X** | Execute | Run test cases, verify checkpoints, report results               |
| **U** | Update  | Modify test cases when features change                           |

## Workflow

### 1. Understand the Scope

Before writing any test, understand what you're testing:

- **Read design docs** — look for `_bmad-output/planning-artifacts/design/` docs
- **Read the feature code** — understand what changed, what's new, what's affected
- **Check existing tests** — look in `docs/tests/` for existing TC files that might already cover this area
- **Identify the project type** — read `references/test-categories.md` to know which coverage areas apply

### 2. Plan Test Coverage

For each feature area, consult `references/test-categories.md` to identify which test categories apply. A well-planned test suite covers:

1. **Happy path** — the expected flow works
2. **Edge cases** — boundary values, empty inputs, maximum sizes
3. **Error handling** — what happens when things fail
4. **Integration points** — where this feature touches other systems
5. **Data integrity** — data is stored/retrieved correctly
6. **Concurrency** — multiple simultaneous operations don't conflict

### 3. Write Test Cases

Use the templates from `references/templates.md`. Every test case MUST have:

- **Priority** (Critical / High / Medium) — guides execution order
- **Design Ref** — traceability to the design doc section
- **Preconditions** — checkbox list of what must be prepared BEFORE the test
- **Steps** — numbered, with exact commands (curl, SQL, grep, etc.)
- **Checkpoints** — numbered CP assertions with verification commands
- **Cleanup** — commands to reset state after the test

The test case should be self-contained — another person (or agent) should be able to execute it without asking questions.

### 4. Evaluate Test Quality

Before finalizing, evaluate against `references/quality-criteria.md`:

- Is each test independent (doesn't depend on another test's state)?
- Does each checkpoint have a specific, verifiable assertion?
- Is the test data realistic (not "test content" but actual domain data)?
- Does the cleanup restore state fully?
- Is there traceability to a design doc or requirement?

### 5. Execute Tests

Test execution has two distinct phases that the main agent runs differently: **infrastructure setup** (main agent) and **per-test-case execution** (delegated to subagents, strictly sequential).

#### 5.1 Main agent: infrastructure setup

Before dispatching any test cases, the main agent prepares the environment. This phase is shared state across every test case in the run — running it once amortises cost and keeps subagent prompts small.

1. **Read `docs/tests/test-plan.md`** to understand scope, prerequisites, and environment variables.
2. **Detect the build system** (see below). **Rebuild the application from source** so the tests hit the latest code — not a stale image or cached binary. Stale builds are the #1 cause of confusing test failures ("this looks like the old behaviour") and of false passes ("the bug is in a newer commit that wasn't built").
   - Consult `references/build-systems.md` for concrete commands per stack. Detect by inspecting lockfiles / manifests (`docker-compose.yml`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) and run the rebuild command for that stack.
   - For Docker-based projects, rebuild images with `--no-cache` only if the user suspects caching issues; otherwise a plain rebuild + `--force-recreate` is enough and faster.
3. **Bring up infrastructure**: databases, queues, API servers, workers. Wait for healthchecks.
4. **Seed test data**: vault files, DB rows, fixtures. Fix file ownership when copying into containers (e.g., `chown` after `docker cp` for Docker — host UIDs don't match the container user).
5. **Smoke-verify**: hit `/health` or equivalent to confirm services are actually up and accepting traffic. If this fails, stop — no point running test cases against a broken stack.
6. **Gather project-specific context**: collect file paths, env var names, API URLs, auth tokens, vault paths, sample fixtures — everything a subagent would otherwise waste tokens re-discovering. Pack this into the subagent prompt in the next phase.

#### 5.2 Subagent per test case (strictly sequential)

Do **not** execute test cases directly in the main agent. For each test case in the run, spawn one subagent, wait for its report, then spawn the next. This keeps the main agent's context small, isolates test runs from each other, and lets you investigate failures while everything else stays parked.

**Why sequential (not parallel):** Manual test cases frequently share infrastructure state (DB rows, vault files, transcript IDs). Parallel execution risks one TC polluting another's preconditions or racing on shared resources. Sequential also makes failure diagnosis possible — the main agent can pause and investigate before later TCs mutate the state that caused the failure.

**Subagent prompt template** — instruct each subagent with everything it needs, no more:

```
Execute test case <TC-ID> from <path to TC file>.

## Project context
- Working directory: <abs path>
- Build system: <detected>
- Infrastructure already running: <list services + ports>
- Auth: <API_KEY=..., DB creds, etc.>
- Relevant env vars: <list>
- Known fixtures / sample data: <paths>
- Cleanup commands from the TC: <paste here>

## Your job
1. Follow the test case's preconditions, steps, and checkpoints EXACTLY as written.
   Do not improvise or substitute commands.
2. For each checkpoint, run the verification command and record the actual output.
3. Report back:
   - Overall verdict: PASS / PARTIAL / FAIL / SKIP
   - Per-checkpoint result: CP1 PASS, CP2 FAIL (actual: X, expected: Y), …
4. Cleanup:
   - If ALL checkpoints PASS → run the TC's cleanup commands.
   - If ANY checkpoint FAILED or PARTIAL → DO NOT clean up. Leave DB rows, files,
     logs in place so the main agent can investigate.
5. For FAIL, include: exact command run, raw stdout/stderr, relevant log excerpts
   (docker logs, psql output), and which checkpoint(s) failed.
6. For LLM-dependent tests: run 2–3 times and report majority result.
```

**After each subagent reports:**

- **PASS / PARTIAL (cleanup ran)**: log the result and spawn the next subagent.
- **FAIL (state preserved)**: stop the sequential run. Investigate using the preserved state (query DB, inspect logs, read files the TC touched). Decide whether to fix, skip, or abort the remaining TCs. Only after investigation does the main agent run the TC's cleanup commands.
- Never auto-cleanup a failed test — the post-mortem state is the most valuable diagnostic artefact in the run.

#### 5.3 Main agent: aggregation and teardown

After the sequential run finishes:

1. **Aggregate** per-TC results into a summary table (TC-ID, verdict, failing CPs, notes).
2. **Report to the user**: totals (N passed, M failed, K skipped), detail on failures, and any suggested follow-ups.
3. **Infra teardown**: stop services, remove test containers/volumes. Do this only after the user acknowledges the results — a user may want to poke at the live stack first.

#### 5.4 Containerized execution and credential hygiene (security/red-team and any test touching real secrets)

When the thing under test is a containerized app — or when a test handles real credentials — *where* the test runs and *what touches the host* matter as much as the assertions. Two principles, learned the hard way:

**Run the product inside its container, not on the host.** It is tempting to run `npm test` / the binary / a helper script directly on the developer's machine because it's faster. Resist it when the product ships as a container: exercise it via the real image (`docker run …`), and run any attacker infrastructure (capture listeners, mock endpoints) as **sibling containers on a user-defined network**, never as host processes binding host ports. Reading a doc or grepping an output file on the host is fine — *executing the product* on the host is not. Why: a host run gives different paths, permissions, UID, and env than the real runtime, so a "pass" on the host can hide a real container bug (and vice versa) — and it can leave the product's artifacts (and secrets) scattered on the developer's machine.

**Never let a real secret land on the host.** If the app needs real credentials (an `auth.json`, API keys, tokens):
- **Mount them read-only directly from their source** into the container (`-v "$HOME/.../auth.json":/in/container/path:ro`). **Do NOT `cp` them into a `/tmp` scratch dir** — a copied secret outlives the run and is easy to forget. (This exact mistake leaked an `auth.json` copy + cred-bearing logs to host `/tmp` twice in one session before it was caught.)
- **Inspect cred-bearing artifacts in container-space**, or if you must read them on the host, `shred -u` every such file immediately after grepping, and emit only **masked** pass/fail counts to the user — never raw secret values.
- A secret appearing once as a masking directive (e.g. GitHub's `::add-mask::<value>`) in a captured log is the *correct* behavior, not a leak — the runner redacts it. Only flag a secret value appearing in a persisted artifact (transcript/summary/output) or in tool output.
- **Teardown is a hygiene gate, not just cleanup.** After the run, verify the host is clean: no scratch dirs with secrets, no stray credential files, no leftover containers/networks/volumes. Treat "host clean" as an explicit checkpoint you confirm, the same way you confirm the assertions.

**Subagent execution of adversarial tests — the classifier wrinkle.** The §5.2 "subagent per test case" rule has a sharp edge for *security/red-team* tests: a subagent's `docker run` carrying attack payloads (`cat .git/config`, `env | grep TOKEN`, fake tokens, SSRF base URLs) is often **denied by the auto-mode safety classifier** — the payloads read as malicious. So before delegating adversarial TCs to a subagent, pick one:
- Spawn the test subagent in **bypassPermissions** mode (scoped tightly to the test harness), so its in-container adversarial runs aren't blocked; or
- Run the adversarial TCs **as the leader/main agent directly** (the leader isn't classifier-gated the same way), and delegate only the benign feature TCs to subagents.
Decide this up front — discovering it mid-run wastes a spawn. (Benign feature regression TCs delegate to subagents fine.)

### 6. Update Tests After Feature Changes

When a feature changes, the tests MUST be updated:

1. Find affected TC files in `docs/tests/TC-*.md`
2. Update preconditions if setup changed
3. Update steps if the API/workflow changed
4. Update checkpoints if expected behavior changed
5. Add new test cases for new functionality
6. Update `docs/tests/test-plan.md` index if new TC files were created

## Reference Files

Read these as needed — they contain detailed knowledge for each capability:

| File                             | When to Read              | Content                                                                                                                                            |
| -------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/test-categories.md`  | When planning coverage    | Coverage checklists by project type (API, frontend, pipeline, AI/LLM, infra, DB, security) with risk-based priority                                |
| `references/quality-criteria.md` | When writing or reviewing | 10 test qualities, anti-patterns, evaluation rubrics, LLM 3-layer testing, checkpoint writing guide                                                |
| `references/templates.md`        | When writing test cases   | Exact templates for test plans and test cases with checkpoint patterns                                                                             |
| `references/build-systems.md`    | Before executing tests    | Detection heuristics and exact rebuild commands per stack (Docker Compose, Node/npm/pnpm, Python/uv/poetry, Rust, Go, Java, monorepos, multi-repo) |

## Companion BMAD Skills

These BMAD skills provide deeper testing workflows. Use them alongside this skill when appropriate:

| Skill                       | When to Use                                      | What It Adds                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bmad-testarch-test-design` | Creating a comprehensive test plan from scratch  | Risk assessment matrix (TECH/SEC/PERF/DATA/BUS/OPS), testability review (controllability/observability/reliability), coverage matrix with P0-P3 priorities, quality gates (P0=100%, P1≥95%) |
| `bmad-testarch-test-review` | Reviewing existing test quality                  | 4-dimension evaluation (determinism, isolation, maintainability, performance), weighted scoring, violation aggregation by severity                                                          |
| `bmad-teach-me-testing`     | Learning testing fundamentals or teaching a team | Progressive structured sessions from basics to advanced, TEA methodology                                                                                                                    |
| `bmad-tea`                  | Consulting the Master Test Architect for advice  | Expert guidance on testing strategy, coverage gaps, test architecture decisions                                                                                                             |

### How to Combine Skills

**Planning a test suite**: Start with this skill's `references/test-categories.md` for coverage areas, then invoke `bmad-testarch-test-design` for the formal risk assessment and coverage matrix with P0-P3 priorities.

**Reviewing test quality**: Use this skill's `references/quality-criteria.md` for the 10-quality checklist, then invoke `bmad-testarch-test-review` for the 4-dimension deep evaluation (determinism, isolation, maintainability, performance).

**Writing test cases**: Use this skill's templates and quality criteria. For risk-driven prioritization, borrow from `bmad-testarch-test-design`:

- **P0**: Blocks core functionality + high risk + no workaround → Critical
- **P1**: Critical paths + medium/high risk → High
- **P2**: Secondary flows + low/medium risk → Medium
- **P3**: Nice-to-have, exploratory → Low

**Quality gates** (from bmad-testarch-test-design):

- P0 pass rate = 100% (all must pass)
- P1 pass rate ≥ 95%
- High-risk mitigations complete before release
- Coverage target ≥ 80%

## Rules

1. **Realistic test data** — never use "test content" or "lorem ipsum". Use domain-specific data that exercises real behavior.
2. **Exact verification commands** — every checkpoint must have a command that produces a verifiable result (curl, psql, grep, cat, wc).
3. **Design doc traceability** — every test case must reference which design doc section it validates.
4. **Independence** — each test case must work in isolation. Don't assume another test ran first.
5. **Cleanup** — every test that modifies state must have cleanup commands. On FAIL, skip cleanup and preserve state for investigation; the main agent cleans up after triage.
6. **LLM non-determinism** — for AI-dependent tests, verify structure and presence of sections, not exact content. Run 3+ times for majority-pass.
7. **Risk-based prioritization** — use P0-P3 priority framework. Test P0 (critical path) first, P3 (exploratory) last.
8. **Testability assessment** — before writing tests, assess: can you control the system state? Can you observe the outcome? Can you run tests reliably and in isolation?
9. **No redundant coverage** — avoid testing the same thing at multiple levels. Unit test the logic, integration test the boundary, E2E test the user flow.
10. **Always rebuild before running tests** — any test run (unit, integration, manual) must rebuild the application from source first. Stale images / bytecode / binaries cause confusing false passes and false failures. Detect the build system from project markers (see `references/build-systems.md`) and run the matching rebuild command.
11. **Subagent per test case, strictly sequential** — the main agent handles infrastructure (setup, seed, smoke-check, teardown). Each test case is executed by its own subagent one at a time. Not parallel: manual tests share state and sequential execution keeps failures diagnosable. See §5.2.
12. **No auto-cleanup on failure** — when a subagent's test FAILs or is PARTIAL, it must leave state in place (DB rows, files, logs). The main agent investigates, then runs the TC's cleanup commands. The forensic state is the most valuable diagnostic artefact in the run. (Exception: artifacts containing real secrets are shredded regardless — see Rule 13.)
13. **Containerized product, credentials never on the host** — exercise a containerized app via its real image, with attacker infra as sibling containers (never host processes/ports). Mount real secrets read-only from source; never `cp` them to scratch. Shred any cred-bearing artifact after grepping; emit only masked values. Confirm "host clean" (no secret files, no leftover containers) as an explicit teardown checkpoint. See §5.4.
14. **Pick the adversarial-TC runner up front** — a subagent's `docker run` of attack payloads gets classifier-blocked. Either spawn the test subagent in bypassPermissions, or run adversarial TCs as the leader; delegate only benign TCs to ordinary subagents. See §5.4.
