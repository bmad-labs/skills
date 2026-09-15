# Test Plan & Test Case Templates

## Test Plan Template

Use this for new test plans. Save to the project's test directory — `tests/uat/test-plan.md` in this repo.

````markdown
# [Project Name] — Manual Test Plan

## 1. Overview

[Brief system description and test objectives]

## 2. Scope

### In-Scope

- [Feature area 1]
- [Feature area 2]

### Out-of-Scope

- [What's excluded and why]

## 3. Design References

| Document   | Path             | Covers           |
| ---------- | ---------------- | ---------------- |
| [Doc name] | `path/to/doc.md` | [What it covers] |

## 4. Test Environment

### Prerequisites

- [Infrastructure requirements]
- [API keys / credentials needed]

### Setup Commands

```bash
# Step-by-step setup
```

### Environment Variables

No test case hardcodes a machine path. Export these before the first scenario; every path in the
suite is written against them.

```bash
export PROJECT_ROOT="$(git rev-parse --show-toplevel)"
export RUN_DIR="$PROJECT_ROOT/tests/uat/run/$(date +%F)-01"   # absolute; pick the next free -NN
mkdir -p "$RUN_DIR/evidence"
```

| Variable       | Purpose                                                        | Example                          |
| -------------- | -------------------------------------------------------------- | -------------------------------- |
| `PROJECT_ROOT` | checkout root; fixtures and inputs are written against it      | `$(git rev-parse --show-toplevel)` |
| `RUN_DIR`      | this run's folder, absolute; all evidence is written against it | `$PROJECT_ROOT/tests/uat/run/2026-09-13-01` |
| `VAR_NAME`     | [description]                                                  | `value`                          |

## 5. Test Case Index

| TC-ID | Name   | Priority | Category   | Design Ref    |
| ----- | ------ | -------- | ---------- | ------------- |
| TC-01 | [Name] | Critical | [Category] | [doc section] |

## 6. Test Data

[Realistic sample data for tests — domain-specific, not "test content"]

## 7. Pass/Fail Criteria

| Category   | Pass Criteria |
| ---------- | ------------- |
| Functional | [criteria]    |
| Quality    | [criteria]    |
| Resilience | [criteria]    |

## 8. Known Limitations

- [LLM non-determinism, timing, external dependencies]
````

## Test Case File Template — Given/When/Then (default for new suites)

One scenario carries its own setup, actions, and assertions, so a reader never maps "step 3" onto "CP5".

**Every `Given` / `When` / `Then` / `And` line MUST end with two spaces.** Without them markdown joins consecutive lines into one paragraph and the scenario renders as an unreadable block. Check with:
`grep -n '^\*\*\(Given\|When\|Then\|And\)\*\*' TC-*.md | grep -v '  $'` — it must print nothing.

````markdown
# TC-XX: [Feature Area Name]

[What this file proves and why it exists]

**Host / environment**: [which host, service, or mode these scenarios run against]

## Preconditions

- [ ] [State shared by EVERY scenario in this file] (verify: `[command]`)
- [ ] `$RUN_DIR/evidence/` exists and is writable (verify: `ls "$RUN_DIR/evidence"`)

---

### TC-XX-01: [One behaviour, stated as an outcome]

**Priority**: Critical | High | Medium
**Design Ref**: [design doc path] Section [N]; `src/module.py:120`

**Given** [starting state] — verify: `[command]`
**And** [more starting state] — verify: `[command]`

**When** [the single action under test]
```bash
curl -s -X POST -d '{"field":"value"}' http://localhost:8000/endpoint
```
**And** [a following action, only if the behaviour needs a sequence]

**Then** [assertion] — verify: `[command producing a checkable result]`
**And** [assertion] — verify: `[command]`

**Cleanup**:
```bash
psql -c "DELETE FROM table WHERE condition;"
```

---

### TC-XX-02: [Next behaviour]
````

**One behaviour per scenario.** Two unrelated `When` actions means two scenarios.

## Test Case File Template — Steps + Checkpoints (legacy)

Use only when the suite already uses this shape; don't mix the two in one suite. Save to the project's test directory.

````markdown
# TC-XX: [Feature Area Name]

[Brief description of what this test case file covers]

## Prerequisites

- [ ] [Global prerequisite 1]
- [ ] [Global prerequisite 2]

---

### TC-XX-01: [Specific Scenario Name]

**Priority**: Critical | High | Medium
**Design Ref**: [design doc path] Section [N]

**Preconditions**:

- [ ] [Specific state that must exist before this test]
- [ ] [Another precondition]

**Steps**:

1. [Exact action — include full curl command, SQL query, or CLI command]
   ```bash
   curl -s -X POST -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"field":"value"}' \
     http://localhost:8000/endpoint
   ```
2. [Next action]
3. [Verification action]

**Checkpoints**:

- [ ] CP1: [Specific assertion] — verify: `[exact verification command]`
- [ ] CP2: [Specific assertion] — verify: `[exact verification command]`
- [ ] CP3: [Specific assertion] — verify: `[exact verification command]`

**Cleanup**:

```bash
# Commands to restore state after test
psql -c "DELETE FROM table WHERE condition;"
rm -f /path/to/temp/file
```

---

### TC-XX-02: [Next Scenario]

...
````

## Suite Layout and Run Folders

A suite that is run repeatedly needs each run's evidence kept separately, or the second run overwrites the first and nobody can tell when something regressed.

```
tests/uat/
  test-plan.md              scope, format contract, gates, env variables
  README.md                 how to execute a run
  coverage-matrix.md        feature/tool → scenario traceability
  testcases/TC-NN-*.md      one file per test case
  run/<YYYY-MM-DD>-<NN>/    one folder per run, never reused or edited later
    report.md               verdict per scenario
    bugs.md                 findings raised by this run
    evidence/               screenshots, logs, exports, json
```

**Never hardcode a machine path into a test case.** A suite with `/home/dev/project/...` or `D:/Work/...` baked in only runs on the machine that wrote it. Define variables once in the test plan and write every path against them:

```bash
export PROJECT_ROOT="$(git rev-parse --show-toplevel)"
export RUN_DIR="$PROJECT_ROOT/tests/uat/run/$(date +%F)-01"   # pick the next free -NN
mkdir -p "$RUN_DIR/evidence"
```

Then a scenario writes `$RUN_DIR/evidence/tc-03-01-after.png`, never an absolute path.

Make `RUN_DIR` **absolute** when any tool under test resolves paths against its own working directory — a relative path silently resolves somewhere else and the call fails for a reason that looks like a product bug.

**Check before handing over** — search for your own checkout root, literally. Blanket "any absolute path" patterns produce false positives: a third-party install directory (`C:\Program Files\...`) and an `$APPDATA/...` path are legitimate literals; your own working copy is not.

```bash
# the checkout root must appear nowhere in the test cases
grep -rn -- "$PROJECT_ROOT" testcases/          # must be empty
# also catch the Windows spelling of the same root
grep -rni -- "$(cygpath -w "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT")" testcases/
```

Review any hit by eye before "fixing" it — see Common traps below.

### Common traps when variabilizing paths

Both of these were introduced by a blind search-and-replace over a real suite and had to be found afterwards:

| Trap | What breaks | Fix |
| --- | --- | --- |
| **Rewriting a deliberately-bad path** | A scenario asserting "a relative path is rejected" had its example rewritten to `$PROJECT_ROOT/...`, which expands to absolute — the assertion then tested the opposite of its claim and would always fail | Negative-path scenarios keep their literal bad input. Check every hit whose assertion expects a rejection. |
| **Double prefix** | `$PROJECT_ROOT/$RUN_DIR/...` — `RUN_DIR` was already absolute, so the composed path pointed nowhere | Decide once whether `RUN_DIR` is absolute or repo-relative, state it in the test plan, and never prefix it. |

After any bulk path edit, re-read the scenarios that assert a *failure*. A substitution that makes bad input valid is invisible to every grep.

## Test Case Naming Convention

```
TC-{category_number}-{sequence}: {descriptive_name}
```

| Category          | Number Range         | Covers                                |
| ----------------- | -------------------- | ------------------------------------- |
| Session/Lifecycle | TC-01-XX             | Startup, shutdown, context, auth      |
| Data Ingestion    | TC-02-XX             | Input processing, validation, storage |
| Core Processing   | TC-03-XX to TC-05-XX | Main business logic, pipelines        |
| Quality/Output    | TC-06-XX to TC-08-XX | Output format, templates, standards   |
| Error Handling    | TC-09-XX             | Failures, resilience, degradation     |
| Concurrency/Scale | TC-10-XX             | Multiple users, parallel processing   |

## Checkpoint Writing Patterns

### Value Assertion

```markdown
- [ ] CP1: Response status is 202 — verify: `echo $HTTP_CODE` equals 202
```

### Content Presence

```markdown
- [ ] CP2: File contains section header — verify: `grep -c "## Sessions" file.md` returns > 0
```

### Content Absence

```markdown
- [ ] CP3: No sensitive data in response — verify: `grep -c "password\|secret" response.json` returns 0
```

### Count Assertion

```markdown
- [ ] CP4: Exactly 3 rows created — verify: `psql -c "SELECT count(*) FROM table WHERE condition;"` returns 3
```

### Pattern Match

```markdown
- [ ] CP5: Dates use ISO format — verify: `grep -c "202[0-9]-[0-9][0-9]-[0-9][0-9]" file.md` returns > 0
```

### Timing Assertion

```markdown
- [ ] CP6: Completed within 60 seconds — verify: `duration_ms < 60000` in dream row
```

### JSON Field

```markdown
- [ ] CP7: Response has transcriptId — verify: `echo $RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['transcriptId'])"`
```

### Database State

```markdown
- [ ] CP8: Dream status is completed — verify: `psql -t -c "SELECT status FROM jarvis.dreams WHERE id=$DREAM_ID;"` returns "completed"
```

## Precondition Patterns

### Infrastructure Ready

```markdown
**Preconditions**:

- [ ] Server running on `localhost:8000` (verify: `curl -s http://localhost:8000/health`)
- [ ] PostgreSQL healthy (verify: `docker compose ps` shows healthy)
- [ ] Redis running (verify: port 6379 accessible)
```

### Clean State

```markdown
**Preconditions**:

- [ ] No existing transcripts for session_id `test-xxx` (verify: `psql -c "SELECT count(*) FROM jarvis.transcripts WHERE session_id='test-xxx';"` returns 0)
```

### Pre-populated State

```markdown
**Preconditions**:

- [ ] Vault has MEMORY.md with at least 5 entries
- [ ] Daily log exists for today with at least 1 session block
- [ ] Pattern file exists with `reinforcement_count >= 3`
```

### LLM Available

```markdown
**Preconditions**:

- [ ] LLM API accessible (verify: server started without LLM connection errors)
- [ ] ARQ worker running (verify: worker log shows "Starting worker for N functions")
```
