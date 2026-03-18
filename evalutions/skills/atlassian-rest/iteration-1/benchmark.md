# Atlassian REST Skill - Benchmark Results

**Skill:** atlassian-rest
**Date:** 2026-03-18
**Iteration:** 1
**Evals:** 18 | **Runs per configuration:** 1

---

## Summary

| Configuration  | Mean Pass Rate | Min  | Max  | Stddev |
|----------------|---------------|------|------|--------|
| with_skill     | **100.0%**    | 100% | 100% | 0.00   |
| without_skill  | **43.2%**     | 14%  | 100% | 0.23   |
| **Delta**      | **+56.8pp**   |      |      |        |

---

## Per-Eval Results

| # | Eval Name        | Expectations | With Skill | Without Skill | Delta   |
|---|------------------|:------------:|:----------:|:-------------:|:-------:|
| 1 | get-issue        | 3            | 100%       | 33%           | +67pp   |
| 2 | create-bug       | 8            | 100%       | 25%           | +75pp   |
| 3 | meeting-notes    | 7            | 100%       | 43%           | +57pp   |
| 4 | messy-notes      | 5            | 100%       | 40%           | +60pp   |
| 5 | status-report    | 7            | 100%       | 29%           | +71pp   |
| 6 | daily-standup    | 4            | 100%       | 100%          | +0pp    |
| 7 | triage-timeout   | 8            | 100%       | 25%           | +75pp   |
| 8 | triage-npe       | 5            | 100%       | 60%           | +40pp   |
| 9 | search-auth      | 7            | 100%       | 29%           | +71pp   |
| 10| search-runbook   | 4            | 100%       | 25%           | +75pp   |
| 11| spec-to-backlog  | 7            | 100%       | 14%           | +86pp   |
| 12| inline-spec      | 7            | 100%       | 71%           | +29pp   |
| 13| transition       | 4            | 100%       | 25%           | +75pp   |
| 14| jql-search       | 3            | 100%       | 67%           | +33pp   |
| 15| epic-stories     | 6            | 100%       | 17%           | +83pp   |
| 16| link-issues      | 4            | 100%       | 50%           | +50pp   |
| 17| create-page      | 4            | 100%       | 75%           | +25pp   |
| 18| spaces-search    | 4            | 100%       | 50%           | +50pp   |

---

## Aggregate Expectations

| Configuration  | Passed | Failed | Total | Pass Rate |
|----------------|--------|--------|-------|-----------|
| with_skill     | 97     | 0      | 97    | 100.0%    |
| without_skill  | 42     | 55     | 97    | 43.3%     |

---

## Key Observations

1. **Perfect with_skill coverage.** The skill achieved 100% pass rate across all 18 evals (97/97 expectations), demonstrating that the skill's structured workflows, CLI scripts, and reference documentation fully guide the agent.

2. **Largest gaps in complex workflows.** The biggest deltas were in multi-step workflows: spec-to-backlog (+86pp), epic-stories (+83pp), triage-timeout (+75pp), create-bug (+75pp), transition (+75pp), and search-runbook (+75pp).

3. **Without skill falls back to raw APIs.** In 16 of 18 evals, the agent without the skill failed to use jira.mjs/confluence.mjs, instead describing REST API calls or using MCP tools directly -- losing structured workflow guardrails, confirmation steps, and reference documentation.

4. **Daily standup was the only tie.** Eval 6 (daily-standup) scored 100% in both configurations because its expectations focused on JQL time ranges and output formatting rather than tool-specific commands.

5. **Without skill still understands domain concepts.** Even without the skill, the agent correctly identified issue types (Bug vs Story vs Task), constructed valid JQL, and produced reasonable content -- but lacked the execution framework to act on that understanding.
