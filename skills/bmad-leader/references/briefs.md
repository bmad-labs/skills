# Leader Templates

## Contents

- Status and setup: [Current situation note](#current-situation-note), [Test level confirmation](#test-level-confirmation), [Common rules block](#common-rules-block)
- Briefs: [Subagent brief](#subagent-brief), [Builder brief (Full build)](#builder-brief-full-build), [Builder brief (Phase split)](#builder-brief-phase-split), [Planner brief](#planner-brief), [Verifier brief](#verifier-brief), [UAT Runner brief](#uat-runner-brief), [Reviewer brief](#reviewer-brief), [Research brief](#research-brief), [Retrospective brief](#retrospective-brief), [Correct-course brief](#correct-course-brief)
- Round records: [Defect report](#defect-report), [Triage file](#triage-file), [Deferred work at Story start](#deferred-work-at-story-start)
- Contracts and routing: [Build run contract](#build-run-contract), [Skills to name in a brief](#skills-to-name-in-a-brief), [Report contract](#report-contract)
- Epic records: [Decision log](#decision-log), [Epic close checklist](#epic-close-checklist)

Name the skills; never paste or paraphrase their steps. The subagent loads each skill and follows it. If the brief and the skill disagree, the skill wins.

Every brief carries a context pack. A brief without one is incomplete.

Keep one session per persistent role per Story: builder and verifier, plus the planner on a Phase split harness. Fix rounds continue in those sessions. Reviewers are fresh every round; the UAT Runner is fresh every run.

## Current situation note

Keep one per epic and pass its path in every brief. Update it after each Story.

```markdown
# Epic <n> status

Goal: <one sentence>
Done: <Story id — commit>
In progress: <Story id — what remains>
Remaining: <Story ids in order>
Branch / head: <branch> @ <sha>
Blockers: <none | blocker and owner>
Open decisions: <none | question and who decides>
Open for the user to confirm: <none | detail decisions taken while the user was away>
Agents alive: <session name — id — role — current round>
Next: <what happens after the current Story>
Updated: <date> at <sha>

## Environment
Skill version: <commit or hash of bmad-leader>
Host: <stays awake how; network; user timezone>
Shell and tools: <shell, tool family, commands that differ from the usual form, commands the harness blocks>
Credentials: <how each one loads, per command; never printed>
In use: <ports, devices, fixed paths taken by other programs, and what to use instead>
Missing tools: <tool — workaround>
Shared resources: <resource — owner — when>
```

The Environment block is written once per epic at Activate and corrected when a subagent finds a new fact. Every brief links it.

## Test level confirmation

Show this at Activate and again in each Story plan. Mark every level.

```text
                    /\
                   /  \          UAT          <RUN|BLOCKED|NOT RUN>
                  /    \         real app, VM, human
                 /______\
                /        \       E2E          <RUN|BLOCKED|NOT RUN>
               /          \      CLI, socket, process
              /____________\
             /              \    Integration  <RUN|BLOCKED|NOT RUN>
            /                \   repository, adapter, real DB
           /__________________\
          /                    \ Unit         <RUN|BLOCKED|NOT RUN>
         /                      \ rules, use cases, fixtures
        /________________________\
```

| Level | Covers | Does not cover | Observed by |
| --- | --- | --- | --- |
| Unit | Rules, use cases, edge inputs | Wiring, storage, process behavior | Counts and named failures |
| Integration | Repository, adapter, contract, real storage | User-visible flow | Rows read back from real storage |
| E2E | CLI, socket, process, scratch repo | Real GUI, human judgment | Stdout, exit, response, state file |
| UAT | Acceptance criteria as a user sees them | Internal edge cases already covered below | Screenshot, window state, real interaction |

Every AC names the lowest level that proves it. Each mark carries its exact command, or the missing harness that blocks it.

`RUN` requires the tool, the access and an observation method. For web use `playwright-cli` or a browser MCP; for desktop use `cua-driver` or a computer MCP. Capture a screenshot and inspect it for visual targets.

If the highest applicable level is `NOT RUN`, tell the user to run the `close-loop-dev-setup` skill and name the missing tool.

## Common rules block

Add this block to every brief, for every role. Replace the brackets.

```markdown
Common rules:
- Environment: read <current-situation note>#Environment before you run commands. Use the forms it gives for this shell and these tools.
- Shared resources you may touch: <resource — owner>. Use a private path where the code allows it. Do not touch any other fixed path, port, device or evidence folder.
- Work at commit <sha>. Read files from that commit when another agent may be changing the working tree.
- Edit files with the edit tools, not with shell scripts, so every change is visible. Cut long command output with a tail or write it to a log file.
- Write your full report to <report path>. Reply in chat with at most <n> lines: the path, the counts, and any blocker.
- A permission denial is final. Do not reach the same effect another way; report it.
- Leave nothing running when you report: no process, container, watch loop or temp file of yours. Do not end a report with a menu of options; state what you did and what remains.
- When you get a shutdown request, reply with the structured object
  {"type": "shutdown_response", "request_id": "<id from the request>", "approve": true}
  as the message, not as a text string.
```

## Subagent brief

Give every subagent this brief. Replace the brackets. One Story per brief.

The Skills block is mandatory. Write "none beyond bmad-build" only after checking the table below.

```markdown
You are building Story <id> from <epics.md path>.

Context pack (read these before work):
- Current situation: <epic goal; Stories done, in progress, remaining; branch and commit head; blockers; open decisions; what comes next>
- Epic context: <path>
- Story and acceptance criteria: <epics.md anchor>
- Requirements: <FR-n>, <AD-n>; precedence: <which wins>
- Design: <design folder or files>
- Decisions already made: <decision log path or ids>
- Code to read: <files, modules, entry points>
- Similar pattern: <one existing file to follow>
- Conventions: <AGENTS.md sections, naming, test style>
- Verification: <gate commands>, <test level>
- Boundaries: <worktree>, <files owned by other Stories>, <out of scope>

Deferred work:
- Include <id> — this Story removes its blocker: <blocker>.
- Keep <id> deferred — still blocked by <blocker>.

Skills (load before work):
- bmad-build — the build workflow for this Story.
- <supporting BMAD skill> — <why it applies>.

Goal:
<one paragraph: the user-visible outcome>

Rules:
- Load the listed skills before reading code. Follow them; this brief does not summarize them.
- If this is a fix round, continue this session and close the findings in <path>.
- Read the context, the Story, and the cited references before coding.
- Let `bmad-build` write the Story file. Do not hand-write a spec for a planned Story; use `bmad-spec` only for an unplanned requirement.
- Follow <AGENTS.md> and the design package.
- Work only in <worktree or path>. Do not touch files owned by another Story.
- Do not edit intent, PRD, spine, or designs. If the design is wrong, stop and
  report the mismatch with file:line evidence.
- Commit only on your Story branch or worktree; do not merge or push.
- Fix every finding this Story can prove. Defer only when blocked; name the blocker.
- Tests: <unit / integration / e2e / UAT level>.

Deliver:
- Code and tests for every acceptance criterion.
- A short spec update: tasks done, AC mapping, deviations, open questions.
- Gate output pasted verbatim, with counts.
- Review findings: fixed, deferred, rejected.
- One sentence per open decision, with the options and your recommendation.
```

## Builder brief (Full build)

Claude Code and Copilot (CLI, app, VS Code Copilot harness). One builder runs the whole `bmad-build`.

```markdown
You are the builder for Story <id>. Model <model>, effort <effort>.

Load `bmad-build` and run it end to end for this Story: clarify and route,
plan, implement, review, patch, present. Do not skip or shorten any step.
Load <domain skills, for example `cpp-embedded`> before you write code in that domain.
Follow <CLAUDE.md / AGENTS.md> and <standards path>.

The leader is your user. At every `bmad-build` question or gate — intent gap,
plan approval, reject, defer — message the leader and wait for the answer. (Copilot: end your turn with
the question; the leader answers with write_agent.)
Send the plan for approval before you write code.

Review: spawn the three `bmad-build` lenses as fresh subagents, one lens each,
named review-<lens>-r<n>-s<story>, with these models from `.leader.json`
(name the model and effort in each lens prompt): Blind Hunter <model/effort>,
Edge Cases Hunter <model/effort>, Verification Gap Finder <model/effort>.

On a fix round, continue this session: close the findings at <path> through
`bmad-build`'s patch loop, then run the three lenses again as new subagents.

Commit only on <branch or worktree>. Do not merge and do not push.

Context pack: <paths, per the Context pack table>.

Report when `bmad-build` presents:
- Result and commit SHA on the Story branch.
- Review: the three lens session ids, findings, and what was patched, rejected or deferred.
- Deferred items with blocker and unblock condition.
- Tests you ran, with counts.
```

## Builder brief (Phase split)

OpenCode and VS Code Local. Implement phase only, from the approved plan. On VS Code Local every round is a new subagent: include the previous report.

```markdown
You are the builder for Story <id>. Model <model>, effort <effort>.

Load `bmad-build` and run its Implement phase only, from the approved plan at <path>.
Skip its review phase; the leader dispatches the reviewers.
Load <domain skills> before you write code in that domain. Follow <CLAUDE.md / AGENTS.md>.

Commit only on <branch or worktree>. Do not merge and do not push.

Context pack: <paths>.

On a fix round, continue this session and close the findings at <path> through `bmad-build`'s Patch phase.
(VS Code Local: this is a new subagent. Read the previous report at <path> first; nothing else carries over.)

Report: files changed, commit SHA, tests run with counts, open questions.
```

## Planner brief

At epic start on every harness; per Story on a Phase split harness only.

```markdown
You are planning Story <id>. Do not write product code and do not implement.

Load `bmad-build` for its Plan phase only.
At epic start, load `bmad-create-epics-and-stories` and `bmad-sprint-planning` instead.
Do not rely on a summary of either skill.

Read: <intent>, <PRD>, <spine>, <designs/README.md>, <epic context>.

Deliver:
- Plan: files, tasks, tests, AC-to-test map, open questions.
- Contract check: each task cites its `FR-n`, `AD-n` and design file; no out-of-scope work.
- Test plan: each AC mapped to a pyramid level, with command and any `NOT RUN` harness.
- Proof that each planned break-once run and each planned mutant can fail: a scratch run, or a `file:line` argument. A planned check that cannot go red is not a check.
- Platform differences that change behaviour or tests (operating system, shell, tool versions), with how the plan covers each one.
- Brief check: every claim in this brief, checked against the design documents. Report a mismatch; do not follow the brief over the design.
- Deferred items this Story unlocks, with their ids.
- Risks: intent gaps, irreversible actions, footprint.

Return the plan for approval. Do not implement.
```

## Verifier brief

```markdown
You are the verifier for Story <id>. Do not edit product code.
Load `manual-testing` when the Story has UAT cases.

Context: AC <FR-n/AD-n>, branch <head>, base <sha>, UAT cases <path>.
If this is a re-run after a fix, continue this session. (VS Code Local: this is a new subagent; the previous report is at <path>.)

You own the UAT cases. If a case is wrong, fix the case or harness, then ask a
new UAT Runner to rerun the failed cases. If the product is wrong, do not edit
product code: record the defect below and return it to the leader.

If you can spawn a subagent, spawn the UAT Runner from `## UAT Runner brief`;
otherwise ask the leader to dispatch it.

Run the project gates for this Story:
- Format: <command>
- Lint: <command>
- Tests: <command>
- UAT: <command, or the missing harness>

For each gate, run it once, then break it once and confirm it fails.
Run every mutant in an exported copy or a separate worktree, never in the tree
the builder edits, and never restore with a checkout over that tree. Name the
copy's location in the report. Treat the builder's mutant and coverage claims
as hypotheses; re-run a sample.

Before you hand UAT cases to a runner: check that the commit and evidence folder
in the case file match this round, that every tool the cases need exists, how
each exit code is captured, and that the run has its own evidence folder.
Any case that needs a product edit (a break-once run) is yours, not the runner's.

CI, when asked: watch the run in the background and check its status; never
hold a foreground loop. Stop the watch before you report. A job that runs past
its usual time is NOT RUN, with the elapsed time.

Return:
- Command, full output, counts, and the SHA tested.
- Falsification result: what you broke and which test went red.
- AC map with file:line.
- UAT: PASS / FAIL, then `NOT RUN` with what is missing, or `BLOCKED` with why it does not apply.
- Verdict: PASS or FAIL, with reasons.

An exit code with no counts is not evidence.
```

## UAT Runner brief

```markdown
You are the UAT Runner for Story <id>, run <n>.
Fresh context: you have not run this Story before.
Do not edit product code or test cases.

Run only: <case ids or path>.
Capture observed output to: <evidence dir, unique to this run>.
Write temp files only under <scratch path>. If a case cannot run as written,
mark it and say why; do not change the case or the product.

Return:
- Per case: id, PASS / FAIL / BLOCKED, command, observed output, evidence path.
- For BLOCKED: the missing harness.

On a rerun, run only the failed cases. This is a fresh session; do not assume earlier evidence.
```

## Defect report

The verifier writes this when the product is wrong. The leader routes it to the builder.

```markdown
# Defect: <short title>

- Case: TC-<story>-<nn>
- Story: <id>
- Expected: <what the correct spec says>
- Observed: <what happened, quoted from the runner output>
- Evidence: <screenshot or log path>
- Suspected area: <file:line, or "unknown">
- Severity: <blocker | major | minor>
```

## Reviewer brief

```markdown
You are the <Lens> reviewer for Story <id>, round <n>.
Fresh context: you have not reviewed this Story before.
Load and follow `bmad-code-review` on the Story diff: <base>...<head>.
Review only through your lens:
- Blind Hunter: find any 10 things to fix.
- Edge Cases Hunter: find forgotten corner cases.
- Verification Gap Finder: is this covered by tests?

Context: Story AC, cited design files, decision log <path>.
Do not edit product code.
Do not review unrelated pre-existing code unless the diff touches it.
Read files at <head> (for example `git show <head>:<path>`); the working tree may
hold another agent's change. Run tests only in your own exported copy.
In round 2 or later, review the fix diff <previous head>...<head>; repeat an old
finding only when its fix is wrong or incomplete.

Severity:
- high: breaks an acceptance criterion or the contract.
- medium: a product defect, or a test that gives a false pass of a product check.
- low: everything else (test-helper robustness, wording, ids, plan text).

Return:
- Findings: severity, file:line, quoted line, what is wrong, suggested fix.
- Which findings block the Story and which can be deferred, with a blocker.
- Verdict: PASS or FAIL.
```

## Triage file

The leader writes one per round when it triages findings itself, and sends the builder its path.

```markdown
# Story <id> round <n>: leader triage

Base: <sha>. Reports: <paths>.
Each non-doc fix needs a test that fails first, or a mutant that the new test kills.

| # | Source | Finding | Required fix |
| --- | --- | --- | --- |
| <prefix><n> | <lens and its finding id; lenses that found the same defect> | <defect, file:line> | <the fix; for a behaviour change, the regression risk and the neighbouring test> |

## Not fixed, with the reason
- <id>: <kept, deferred with blocker and unblock condition, or rejected, and why>

## After the fixes
<gates to re-run; whether a new review round follows (see the convergence rule)>
```

Use a new id prefix per round, so a row id names its round.

## Research brief

```markdown
Use bmad-deep-recon to answer: <one decision question>.

Constraints: <stack, versions, scale, constraints>.
Do not receive or return secrets, config files or customer data.

Return:
- Recommendation in one paragraph.
- Evidence with citations.
- Options considered and why rejected.
- What would change the recommendation.
```

## Retrospective brief

```markdown
Run bmad-retrospective for Epic <n> from the evidence: plans, commits, gate
outputs, UAT results, deferred work, and open decisions.

Return:
- What the evidence shows, with sources.
- What went well and what did not.
- Action items, each with an owner and a check.
- Acceptance verdict for the epic.

Do not fix anything. Do not edit planning documents.
```

## Correct-course brief

```markdown
Draft a bmad-correct-course proposal for: <change or finding>.

Read the intent first. The change must not contradict it.
Use the smallest clause that resolves the issue.

Return:
- Evidence: file:line and the observed failure.
- The exact edit proposed, quoted.
- Impact: which Stories, contracts, tests and docs go stale.
- Alternative: keep the current design, and what that costs.

Do not apply the edit. The leader decides; the user approves any
planning-document change.
```

## Deferred work at Story start

Read the deferred-work file before approving any Story plan.

| Item state | Action |
| --- | --- |
| This Story removes the blocker | Add it to the Story scope and the brief. Say which deferred id it closes. |
| Still blocked | Keep it deferred, with the blocker and one line on why. |
| Unrelated | Leave it untouched. |

A Story that unlocks work and ships without it is a missed close, not a small omission. Name the deferred id in the brief, the plan and the completion report.

## Build run contract

`bmad-build` reports three facts about the settled design: intent gaps, irreversible actions, and footprint.

| Design | Path | Leader does |
| --- | --- | --- |
| Clean on all three | Light: minimal plan, implement, review | Approve and let it run |
| Any fact flagged | Full written plan, open questions answered | Approve the plan before code |

Loop-backs:

- `intent_gap` → answer from evidence, research or the user, then replan.
- `bad_plan` → back to plan. Do not patch the diff.
- `patch` → the builder fixes the finding.
- `reject` → void the work and restart.
- `defer` → `deferred_work.md`, with a reason.

One Story per builder. `bmad-build-auto` is one Story per run and never orchestrates the backlog; the leader dispatches it once per Story.

## Skills to name in a brief

`bmad-build` is always required for a Story. Add every supporting skill the Story needs. This is the one work-to-skill table; `SKILL.md` (Skill routing) points here.

| Work | Skill | Produces |
| --- | --- | --- |
| Planned Story from `epics.md` | `bmad-build` | Story file, plan, code, tests, review |
| Requirement not in the plan | `bmad-spec` first, then `bmad-build` | Spec, then the build |
| Epic and Story breakdown, or a re-slice | `bmad-create-epics-and-stories` | Epics and Stories |
| Order and status | `bmad-sprint-planning` | Sprint status |
| UAT cases or a manual test plan | `manual-testing` | Test plan and cases |
| Generated API or e2e tests | `bmad-qa-generate-e2e-tests` | Automated tests |
| Independent review | `bmad-code-review` | Findings |
| External research | `bmad-deep-recon` | Cited findings |
| Epic close | `bmad-retrospective` | Retro and actions |
| Planning-document change | `bmad-correct-course` | Proposal |
| A change to the design package | `architecture-design` | Updated design files |
| Library, CLI, framework or API docs | `context7-mcp` | Usage answers |
| Two failed fixes, cause unknown | `ultrathink-protocol` | Root cause |
| Browser or web UI validation | `playwright-cli` | Driven page and screenshots |
| Desktop validation | `cua-driver` | Driven app and screenshots |
| Missing close-loop harness | `close-loop-dev-setup` | Working validation loop |

## Report contract

A subagent's "done" is a hypothesis until the leader checks it. Require:

```markdown
Story: <id>
Report file: <path>
Commit state: <uncommitted | sha on the Story branch>
Sessions: planner=<id>, builder=<id>, verifier=<id>; reviewers: r1=<ids>, r2=<ids>; uat: r1=<id>, r2=<id>; rounds=<n>
Skills used: <loaded skills, or "none beyond bmad-build">
Gates: <command> -> <N passed>, <command> -> <N passed>
AC mapping: <AC-1 -> test name>, ...
Deviations: <none | exact deviation and reason>
Deferred closed: <ids from deferred_work.md, or none>
Open decisions: <none | question, options, recommendation>
Deferred: <none | item, blocker, unblock condition>
Not verified: <what the harness cannot prove>
```

Reject a report that gives an exit code with no counts, or claims a test ran without pasting the result.

## Decision log

Keep one per epic beside the context document.

```markdown
# Epic <n> decisions

| # | Question | Answer | Source | Date |
| --- | --- | --- | --- | --- |
| 1 | <question> | <decision> | <file:line / research / user> | <date> |
```

Source values, in ladder order:

- `contract:<file>:<line>`
- `research:<subagent report>`
- `user:<quote or summary>`

A decision with no source is a red flag.

## Epic close checklist

- [ ] Every Story has a passing gate run from the verifier subagent.
- [ ] Every AC maps to a test.
- [ ] Every deferred item this epic unlocked is closed or re-homed.
- [ ] UAT cases written; results are `PASS`, `FAIL`, `NOT RUN` with what is missing, or `BLOCKED` with why it does not apply.
- [ ] Deferrals recorded with a blocker and an unblock condition; nothing fixable left behind.
- [ ] Retrospective written from evidence.
- [ ] Accepted improvements applied through `bmad-correct-course`.
- [ ] Sprint status updated.
- [ ] Working tree state and unpushed commits reported.
