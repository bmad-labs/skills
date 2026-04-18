# Test Quality Criteria

## Good Test Case Characteristics

A good test case is one that another person (or agent) can execute without asking questions and get a definitive pass/fail result.

### The 10 Qualities of Excellent Test Cases

| # | Quality | Description | Red Flag if Missing |
|---|---------|-------------|---------------------|
| 1 | **Specific** | Tests one thing with a clear expected outcome | "Test the API" — what specifically? |
| 2 | **Reproducible** | Same steps produce same result every time | Steps depend on uncontrolled external state |
| 3 | **Independent** | Doesn't depend on another test's state | "After TC-01 runs..." |
| 4 | **Verifiable** | Each checkpoint has a command that proves pass/fail | "It should work" — no verification command |
| 5 | **Traceable** | Links to a design doc, requirement, or story | No design reference — why does this test exist? |
| 6 | **Realistic** | Uses domain-appropriate data, not "test content" | `{"name": "test"}` instead of real data |
| 7 | **Cleanable** | Restores state after execution | No cleanup — pollutes next test run |
| 8 | **Prioritized** | Has Critical/High/Medium rating based on risk | All tests are "Critical" — no triage possible |
| 9 | **Minimal** | Tests exactly what's needed, nothing extra | 20 checkpoints per test — hard to diagnose failures |
| 10 | **Documented** | Preconditions, steps, and expected results are explicit | Assumes knowledge the reader doesn't have |

### Good Test Case Example

```markdown
### TC-02-03: Resumed Session After 60s — is_continuation=true
**Priority**: Critical
**Design Ref**: data-flow.md Section 6, Conversation Chains

**Preconditions**:
- [ ] Server running on localhost:8000
- [ ] No existing transcripts for session_id `tc02-chain`

**Steps**:
1. Submit first transcript
2. Wait 65 seconds: `sleep 65`
3. Submit second transcript with same session_id

**Checkpoints**:
- [ ] CP1: Second response has `duplicate: false`
- [ ] CP2: Second row has `is_continuation = true` — verify: `psql -c "..."`
- [ ] CP3: Two rows total — verify: count = 2

**Cleanup**: `psql -c "DELETE FROM jarvis.transcripts WHERE session_id='tc02-chain';"`
```

## Bad Test Case Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| **Vague steps** ("test the endpoint") | Can't be executed without interpretation | Write exact curl commands with expected responses |
| **No verification** ("it should work") | No way to determine pass/fail | Add checkpoint with grep/psql/curl command |
| **Dependent on prior test** ("after TC-01 runs...") | Fails if run in isolation | Add preconditions that set up required state |
| **Generic test data** ("content: test") | Doesn't exercise real behavior | Use domain-specific data from test-plan.md |
| **No cleanup** | Leaves state that affects next test | Add DELETE/rm commands for all created state |
| **Tests implementation, not behavior** | Breaks when code refactors | Test observable outcomes (API responses, file content) |
| **Too many assertions per test** (20+ CPs) | Hard to diagnose which failed | Split into focused test cases with 3-8 CPs each |
| **No priority** | Can't triage when time is limited | Assign Critical/High/Medium based on risk |
| **Hardcoded timestamps** | Fails tomorrow | Use relative dates or `$(date +%Y-%m-%d)` |
| **Ignoring error messages** | Hides root cause on failure | Capture and report actual error vs expected |
| **Testing only happy path** | Misses real-world failures | Add error path, edge case, and boundary tests |
| **Flaky assertions** | Pass sometimes, fail sometimes | Use deterministic checks or run 3x with majority pass |

## Test Plan Evaluation Rubric

### Coverage Assessment

| Score | Coverage | Description |
|-------|----------|-------------|
| **Excellent** | All categories from test-categories.md covered, edge cases + error paths + security | 90%+ of risk areas covered |
| **Good** | All critical paths + most error paths covered | 70-90% coverage, missing some edge cases |
| **Adequate** | Critical paths covered | 50-70% coverage, basic error handling |
| **Poor** | Gaps in critical paths | < 50% coverage, missing entire feature areas |

### Priority Balance

A well-balanced test plan has:
- **25-30% Critical** — must-pass for the system to function
- **40-45% High** — important for reliability, security, and data integrity
- **25-30% Medium** — edge cases, performance, nice-to-have

Red flags:
- > 50% "Medium" → probably missing important failure cases
- > 60% "Critical" → everything can't be critical, reassess
- 0% security tests → check test-categories.md Security section

### Realism Assessment

| Aspect | Good | Bad |
|--------|------|-----|
| **Test data** | Real project conversation with library names, code refs | "test input", "lorem ipsum", "hello world" |
| **Preconditions** | Specific state requirements with setup commands | "the system is running" |
| **Expected output** | Exact values, patterns, or structural requirements | "it works", "correct response" |
| **Timing** | Realistic wait times for async, polling intervals | Immediate verification of async operations |
| **Error scenarios** | Simulate real failures (network down, invalid key, full disk) | Only test happy path |

## LLM / AI Agent Test Evaluation

### Three-Layer Testing Strategy

AI agents should be tested at three layers with different approaches:

**Layer 1: Deterministic Logic (traditional tests)**
- Tool call routing and argument parsing
- Response formatting and schema validation
- State machine transitions
- Token counting and budget enforcement

**Layer 2: Output Quality (structural evaluation)**
- Required sections are present (not exact content)
- Format compliance (backticks, headers, bullet structure)
- Constraint adherence (max length, required fields)
- Tool usage patterns (correct tools called in logical order)

**Layer 3: Semantic Quality (LLM-as-judge or human review)**
- Faithfulness — is the response grounded in provided context?
- Relevance — does it answer what was asked?
- Reasoning — are explanations logical and specific?
- Hallucination — does it fabricate information not in the source?

### What to Verify (Structural — Deterministic)
- Required sections are present (Context, Key Exchanges, Decisions, Lessons, Memory, Action Items)
- Code references use backticks
- Decisions include reasoning ("because", "over", "instead of")
- Lessons include impact ("Why this matters", "Watch for")
- Memory items have category prefix `[pattern]`, `[fact]`, etc.
- Output model validates (Pydantic schema passes)

### What NOT to Verify (Content — Non-Deterministic)
- Exact wording of extracted insights (LLM generates different text each run)
- Exact number of memories extracted (varies by run)
- Specific ordering of sections within a category
- Exact token counts or durations

### Non-Determinism Handling

| Strategy | When to Use | Example |
|----------|------------|---------|
| **Multiple runs** | LLM-dependent output | Run 3 times, pass if 2/3 produce correct structure |
| **Score averaging** | Quality evaluation | Average quality scores across 3+ runs |
| **Structural checks** | Format compliance | Check section headers, not content |
| **Threshold pass** | Quantitative metrics | "At least 3 memories extracted" not "exactly 5" |
| **Human review** | Subjective quality | Present output to reviewer for qualitative assessment |

### LLM Test Case Quality Rubric

| Score | Quality | Description |
|-------|---------|-------------|
| **5** | Excellent | Tests specific structural compliance, has deterministic verification, handles non-determinism with multiple runs |
| **4** | Good | Tests structure and format, has verification commands, some content checks |
| **3** | Adequate | Tests presence of sections, basic format, but vague expected outcomes |
| **2** | Poor | Tests only happy path, no structural verification, single run |
| **1** | Bad | "Check if it works" — no specific assertions |

## Checkpoint Writing Guide

### Good Checkpoint Patterns

```markdown
# Exact value check
- [ ] CP1: Response status is 202 — verify: HTTP response code

# Content presence check  
- [ ] CP2: Daily log contains session_id comment — verify: `grep -c "session_id:" dailys/*.md` > 0

# Count check
- [ ] CP3: Exactly 2 transcript rows — verify: `psql -c "SELECT count(*) ..."` returns 2

# Absence check
- [ ] CP4: No memu_add tool calls — verify: conversation_history does not contain "memu_add"

# Pattern check (regex)
- [ ] CP5: Decisions include reasoning — verify: `grep -ci "because\|revisit\|over" dailys/*.md` > 0

# Timing check
- [ ] CP6: Dream completed within 60s — verify: `duration_ms < 60000`

# JSON field check
- [ ] CP7: Response has transcriptId — verify: `echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['transcriptId'])"`

# Database state check
- [ ] CP8: Dream status = completed — verify: `psql -t -c "SELECT status FROM jarvis.dreams WHERE id=$ID;"`

# File structure check
- [ ] CP9: Frontmatter starts with --- — verify: `head -1 decisions/*.md`

# Negation check
- [ ] CP10: No stack traces in response — verify: `echo $RESP | grep -c "Traceback\|at .*\.py"` returns 0
```

### Bad Checkpoint Patterns

```markdown
# Too vague
- [ ] CP1: It works  ← no verification command

# Tests implementation detail
- [ ] CP2: Function returns True  ← test the observable behavior, not the code

# No expected value
- [ ] CP3: Check the database  ← what should be there?

# Multiple assertions in one
- [ ] CP4: Response has correct status, body, and headers  ← split into 3 CPs

# Depends on timing
- [ ] CP5: Response arrives in under 100ms  ← network jitter makes this flaky

# Checks exact wording from LLM
- [ ] CP6: Extract says "Use Supabase Auth because..."  ← LLM won't produce exact same text
```

## Test Data Quality

### Characteristics of Good Test Data

| Aspect | Good | Bad |
|--------|------|-----|
| **Domain relevance** | Technical conversation about Next.js/Supabase with code refs | "Hello" / "What is testing?" |
| **Complexity** | 5+ user messages, decisions made, gotchas discovered | 2 messages, trivial Q&A |
| **Edge cases included** | Empty fields, unicode, very long content, special characters | Only perfect inputs |
| **Reproducible** | Hardcoded in test plan or generated with seed | Random data that changes each run |
| **Covers all store tools** | Content that triggers store_decision, store_lesson, store_concept, etc. | Content that only triggers one tool |

### Test Data Anti-Patterns

- **"test"** as content — doesn't exercise real parsing
- **Timestamps in the future** — may break date validation
- **Session IDs that exist** — conflicts with prior test runs
- **Missing required fields** in happy-path tests — tests validation instead of the feature
- **Shared test data between tests** — creates ordering dependencies

## Exploratory Testing

When formal test cases don't cover enough, use exploratory testing:

1. **Time-boxed sessions** — 30 minutes per feature area
2. **Charter** — "Explore [feature] to discover [risk type]"
3. **Document as you go** — capture bugs, surprises, and questions
4. **Convert findings to formal test cases** — if a bug is found, write a regression test
5. **Focus on boundaries** — where components meet, where data transforms, where users can go wrong

Exploratory testing is especially valuable for:
- New features with no existing tests
- UI/UX flows that are hard to script
- Complex multi-step workflows
- Areas recently changed with no regression tests

## Deep Quality Review — 4 Dimensions (from BMAD TEA)

For thorough test quality review, evaluate across 4 dimensions from the `bmad-testarch-test-review` skill. Each dimension is scored 0-100.

### Dimension 1: Determinism
Does the test produce the same result every time?

| Score | Criteria |
|-------|----------|
| 90-100 | All assertions are deterministic, no timing dependencies, no external state dependency |
| 70-89 | Mostly deterministic, 1-2 assertions depend on timing but have reasonable tolerance |
| 50-69 | Some flaky assertions, depends on external state that may change |
| 0-49 | Frequently fails without code changes, race conditions, timing issues |

### Dimension 2: Isolation
Does the test run independently without side effects?

| Score | Criteria |
|-------|----------|
| 90-100 | Fully isolated: own state setup, own cleanup, no shared mutable state |
| 70-89 | Mostly isolated: shared fixtures but no cross-test contamination |
| 50-69 | Some dependencies between tests, ordering matters |
| 0-49 | Tests fail when run in different order, shared global state |

### Dimension 3: Maintainability
How easy is it to update tests when code changes?

| Score | Criteria |
|-------|----------|
| 90-100 | Tests are behavior-focused, DRY fixtures, descriptive names, clear assertions |
| 70-89 | Minor duplication, some implementation-coupled assertions |
| 50-69 | Significant duplication, brittle selectors, magic numbers |
| 0-49 | Copy-paste tests, hardcoded values everywhere, no helper abstractions |

### Dimension 4: Performance
Are tests fast enough for the feedback loop they serve?

| Score | Criteria |
|-------|----------|
| 90-100 | All tests within target time (unit < 100ms, integration < 5s, E2E < 30s) |
| 70-89 | Mostly within target, 1-2 slow tests |
| 50-69 | Several slow tests, total suite > 5 minutes |
| 0-49 | Tests take > 10 minutes, blocking development feedback |

### Weighted Overall Score

```
Overall = (Determinism × 0.30) + (Isolation × 0.25) + (Maintainability × 0.25) + (Performance × 0.20)
```

**Quality Grades:**
- **A (90-100)**: Production-ready test suite
- **B (75-89)**: Good quality, minor improvements needed
- **C (60-74)**: Acceptable, significant improvements recommended
- **D (40-59)**: Below standard, major revision needed
- **F (0-39)**: Failing — tests are unreliable and should be rewritten

## Testability Assessment (from BMAD Test Design)

Before writing tests, assess the system's testability across 3 axes (from `bmad-testarch-test-design`):

### Controllability
Can you set up the exact state needed for each test?

- Can you seed the database with specific data?
- Can you mock external services?
- Can you inject faults (network errors, timeouts)?
- Can you control time (freeze timestamps)?

### Observability
Can you verify what happened?

- Are there structured logs you can parse?
- Can you query database state directly?
- Are there metrics endpoints?
- Can you make deterministic assertions on output?

### Reliability
Can tests run consistently?

- Can tests run in parallel safely?
- Are resources cleaned up between tests?
- Is the test environment reproducible?
- Are there flaky external dependencies?

**Testability concerns should be raised before writing tests.** If controllability is low (can't seed state), write stories to add test infrastructure before writing the tests themselves.

## Risk Assessment Matrix (from BMAD Test Design)

When prioritizing test cases, classify risks:

| Category | Code | Examples |
|----------|------|---------|
| Technical | TECH | Performance bottlenecks, scaling limits, tech debt |
| Security | SEC | Auth bypass, injection, data exposure |
| Performance | PERF | Response time, throughput, resource usage |
| Data | DATA | Data loss, corruption, migration failures |
| Business | BUS | Revenue impact, user churn, compliance violation |
| Operations | OPS | Deployment failures, monitoring gaps, incident response |

**Risk Score = Probability (1-3) × Impact (1-3)**

| Score | Action |
|-------|--------|
| 7-9 | Must have test coverage before release |
| 4-6 | Should have test coverage, prioritize in next sprint |
| 1-3 | Nice to have, address when time permits |

Sources:
- [Manual Testing Checklist for QA Teams 2026](https://www.testmuai.com/blog/manual-testing-checklist-qa/)
- [Software Testing Best Practices 2026](https://bugbug.io/blog/test-automation/software-testing-best-practices/)
- [50 Critical QA Test Cases | BotGauge](https://www.botgauge.com/blog/50-critical-qa-test-cases-a-comprehensive-checklist-for-quality-assurance)
- [Testing AI Agents: Non-Deterministic Evaluation](https://www.sitepoint.com/testing-ai-agents-deterministic-evaluation-in-a-non-deterministic-world/)
- [Demystifying Evals for AI Agents | Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [LLM Agent Evaluation Complete Guide | Confident AI](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)
- [AI Agent Evaluation Production Guide 2026](https://thinking.inc/en/blue-ocean/agentic/ai-agent-evaluation-production/)
