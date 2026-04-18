# Test Plan & Test Case Templates

## Test Plan Template

Use this for new test plans. Save to `docs/tests/test-plan.md` or the project's test directory.

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

| Document | Path | Covers |
|----------|------|--------|
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
| Variable | Purpose | Example |
|----------|---------|---------|
| `VAR_NAME` | [description] | `value` |

## 5. Test Case Index

| TC-ID | Name | Priority | Category | Design Ref |
|-------|------|----------|----------|------------|
| TC-01 | [Name] | Critical | [Category] | [doc section] |

## 6. Test Data
[Realistic sample data for tests — domain-specific, not "test content"]

## 7. Pass/Fail Criteria

| Category | Pass Criteria |
|----------|---------------|
| Functional | [criteria] |
| Quality | [criteria] |
| Resilience | [criteria] |

## 8. Known Limitations
- [LLM non-determinism, timing, external dependencies]
````

## Test Case File Template

Use this for individual test case files. Save to `docs/tests/TC-XX-feature-name.md`.

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

## Test Case Naming Convention

```
TC-{category_number}-{sequence}: {descriptive_name}
```

| Category | Number Range | Covers |
|----------|-------------|--------|
| Session/Lifecycle | TC-01-XX | Startup, shutdown, context, auth |
| Data Ingestion | TC-02-XX | Input processing, validation, storage |
| Core Processing | TC-03-XX to TC-05-XX | Main business logic, pipelines |
| Quality/Output | TC-06-XX to TC-08-XX | Output format, templates, standards |
| Error Handling | TC-09-XX | Failures, resilience, degradation |
| Concurrency/Scale | TC-10-XX | Multiple users, parallel processing |

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
