# Atlassian REST Skill - Benchmark Results

**Skill:** atlassian-rest
**Date:** 2026-03-18
**Iteration:** 2
**Evals:** 40 | **Runs per configuration:** 1

---

## Summary

| Configuration  | Mean Pass Rate | Min  | Max  | Stddev |
|----------------|---------------|------|------|--------|
| with_skill     | **96.6%**    | 71% | 100% | 0.07   |
| without_skill  | **40.8%**     | 0% | 100% | 0.28   |
| **Delta**      | **+55.9pp**   |      |      |        |

---

## Per-Eval Results

| # | Eval Name        | Expectations | With Skill | Without Skill | Delta   |
|---|------------------|:------------:|:----------:|:-------------:|:-------:|
| 1 | get-issue        | 3           | 100%   | 67%         | +33pp|
| 2 | create-bug       | 8           | 100%   | 38%         | +62pp|
| 3 | meeting-notes    | 7           | 100%   | 29%         | +71pp|
| 4 | messy-notes      | 5           | 100%   | 80%         | +20pp|
| 5 | status-report    | 7           | 100%   | 29%         | +71pp|
| 6 | daily-standup    | 4           | 100%   | 100%        | +0pp|
| 7 | triage-timeout   | 8           | 88%    | 63%         | +25pp|
| 8 | triage-npe       | 5           | 100%   | 80%         | +20pp|
| 9 | search-auth      | 7           | 100%   | 57%         | +43pp|
| 10| search-runbook   | 4           | 100%   | 50%         | +50pp|
| 11| spec-to-backlog  | 7           | 100%   | 29%         | +71pp|
| 12| inline-spec      | 7           | 71%    | 71%         | +0pp|
| 13| transition       | 4           | 100%   | 25%         | +75pp|
| 14| jql-search       | 3           | 100%   | 67%         | +33pp|
| 15| epic-stories     | 6           | 83%    | 33%         | +50pp|
| 16| link-issues      | 4           | 100%   | 50%         | +50pp|
| 17| create-page      | 4           | 100%   | 75%         | +25pp|
| 18| spaces-search    | 4           | 100%   | 50%         | +50pp|
| 19| attach-embed     | 6           | 100%   | 50%         | +50pp|
| 20| refuse-delete-attachment| 4           | 100%   | 25%         | +75pp|
| 21| rich-confluence-doc| 8           | 100%   | 62%         | +38pp|
| 22| status-page-layout| 9           | 100%   | 56%         | +44pp|
| 23| sync-epic-new    | 8           | 100%   | 50%         | +50pp|
| 24| push-linked      | 5           | 100%   | 20%         | +80pp|
| 25| pull-from-jira   | 5           | 100%   | 0%          | +100pp|
| 26| diff-sync        | 5           | 100%   | 0%          | +100pp|
| 27| setup-mapping    | 6           | 100%   | 0%          | +100pp|
| 28| batch-sync       | 7           | 100%   | 0%          | +100pp|
| 29| prd-to-confluence| 6           | 100%   | 33%         | +67pp|
| 30| orphan-detection | 5           | 100%   | 60%         | +40pp|
| 31| conflict-resolution| 6           | 100%   | 33%         | +67pp|
| 32| refuse-delete-epic| 5           | 100%   | 40%         | +60pp|
| 33| rich-markdown-edit| 8           | 100%   | 0%          | +100pp|
| 34| confluence-markdown-page| 8           | 75%    | 62%         | +12pp|
| 35| sync-story-doc   | 7           | 100%   | 14%         | +86pp|
| 36| delete-orphan-subtasks| 8           | 100%   | 0%          | +100pp|
| 37| refuse-delete-story| 6           | 83%    | 67%         | +16pp|
| 38| setup-mapping-instructions| 7           | 86%    | 14%         | +72pp|
| 39| push-with-instructions| 6           | 100%   | 100%        | +0pp|
| 40| markdown-comment | 6           | 100%   | 17%         | +83pp|

---

## Aggregate Expectations

| Configuration  | Passed | Failed | Total | Pass Rate |
|----------------|--------|--------|-------|-----------|
| with_skill     | 230    | 8      | 238   | 96.6%    |
| without_skill  | 97     | 141     | 238   | 40.8%     |

---

## Key Observations

1. **Near-perfect with_skill coverage.** The skill achieved 230/238 expectations (96.6%) across 40 evals. Minor misses in: triage-timeout (7/8), inline-spec (5/7), epic-stories (5/6), confluence-markdown-page (6/8), refuse-delete-story (5/6), setup-mapping-instructions (6/7).

2. **Largest gaps in complex workflows.** The biggest deltas were: pull-from-jira (+100pp), diff-sync (+100pp), setup-mapping (+100pp), batch-sync (+100pp), rich-markdown-edit (+100pp), delete-orphan-subtasks (+100pp).

3. **Without skill falls back to raw APIs.** In the majority of evals, the agent without the skill failed to use jira.mjs/confluence.mjs, instead describing REST API calls or using MCP tools directly -- losing structured workflow guardrails, confirmation steps, and reference documentation.

4. **Ties observed.** eval 6 (daily-standup), eval 12 (inline-spec), eval 39 (push-with-instructions) scored the same in both configurations.

5. **Without skill still understands domain concepts.** Even without the skill, the agent correctly identified issue types, constructed valid JQL, and produced reasonable content -- but lacked the execution framework to act on that understanding.
