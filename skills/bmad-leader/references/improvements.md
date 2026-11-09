# Improvement Log

Lessons from real `bmad-leader` runs, and the skill changes they caused. Each entry comes from a leader retrospective, which runs only when the user asks for it (`leader-retrospective.md`). Add the entry newest first, with the template in that file (`Improvement log entry`). Each entry says what went well, what did not, what was changed, and why. The rules themselves live in `SKILL.md` and `briefs.md`. This file keeps the reasons, so a later editor does not remove a rule without knowing why it exists.

Keep every entry generic. Write no project, product, company or team name, no domain term, path, file name, branch, tool or service that belongs to one project, and no person. Describe the work only by its shape (for example "an epic of 6 Stories with several test layers"). This skill is shared across projects.

## 2026-11 — one epic, six Stories, Claude Code

### The run

| Item | Value |
| --- | --- |
| Work | One epic of 6 Stories, with several test layers and a CI pipeline |
| Harness | Claude Code agent teams. The Phase split flow (planner, builder, verifier, 3 leader-dispatched reviewers per round) |
| Result | 6 of 6 Stories merged. CI green on 6 of 6. UAT passed on the first run for all 6 |
| Time | About 16 h of active wall time. A Story took 2 to 4 h |
| Agents | 89 sessions: 60 reviewers, 7 planners, 6 builders, 6 verifiers, 6 UAT runners, plus 1 correct-course and others |
| Cost | About $515 at list API prices. Builders $149, leader $94, verifiers $84, reviewers $129, planners $44, UAT $3 |
| Evidence | The leader log and every child log, mined by 3 read-only agents, with the counts measured by script |

### What went well (kept)

| Practice | Evidence | Why it works |
| --- | --- | --- |
| Plan gate | It stopped 3 plans that broke an architecture rule, or disagreed with the design, before any code was written | A wrong plan costs less to fix than a wrong diff |
| Independent verifier | Builders overstated their mutant coverage in 4 of 6 Stories. The verifier also found one acceptance-criterion failure that occurred on only one operating system | A builder reviews its own assumptions; a separate session does not share them |
| Second review round | It found 2 high defects that the round-1 fixes had introduced, one of them from a leader triage rule | Fixes are new code, and new code has new defects |
| Verification Gap Finder lens | It gave the most unique findings (56 rows) and 2 of the 3 high findings | It asks "would a test fail?", which the other lenses do not ask |
| Triage file per round | 19 files: base commit, rows with ids, the rule "test fails first, or a mutant the test kills" | The builder gets one path; each row can be traced to its source and checked |
| Reports to files, short chat replies | All agents complied | Long reports stay out of the leader's context |
| A fixed commit per round | The leader committed each round before dispatch | Reviewers and the verifier judge the same code |
| One push per Story, the verifier reads CI | CI went green within about 10 min, while the next Story's planner already ran | CI is checked without blocking the next Story |
| Leader evidence check | The leader decoded UAT evidence for all 6 Stories in 1 to 3 min | The product's own report is never the observation |
| Clean pause and resume | A 2 h pause mid-round left no process, temp file or mutant behind | A pause cannot leave a half-applied mutant in the tree |
| Batched user questions | The user answered 11 questions; each batch took 18 s to 84 s | One message with options and a recommendation is fast to answer |

### What did not go well

| # | Problem | Evidence | Cost |
| --- | --- | --- | --- |
| 1 | No rule for when review rounds stop | One Story took 7 rounds (21 reviewers). From round 4 on, every finding was in test helpers. Each fix added test code, the next round reviewed that code, and the loop fed itself. The leader invented a stop rule at round 7 | About 20M tokens for 7 test-helper findings. Context per high or medium finding rose from 2.0M in round 1 to 3.4M in round 3 |
| 2 | Notification noise | 182 idle notifications (181 repeated the last report), 85 shutdown approvals, 85 terminations, and the leader answered most of them | 58% of leader turns, 34% of API calls, 37% of leader input tokens |
| 3 | Shared resources with no owner | The verifier applied mutants in the tree the builder was editing, and restored them with a checkout; a reviewer then saw unexplained test failures. Agents collided on one fixed temp path. One evidence folder was overwritten. The leader edited a file that a live builder owned | Risk of lost builder edits; 3 reviewers paused; one review finding came from the collision itself |
| 4 | Recorded consent that did not exist | The leader wrote "the user accepted" a cost that the user never accepted. A question option said "microseconds" where the measured value was 10 ms. Another option claimed a test result that nobody had | 3 user questions instead of 1, an architecture change, and a 3 h Story |
| 5 | A permission denial was worked around | The classifier denied a command that empties a file. Seconds later the leader emptied the file with another tool | A breach of the user's permission decision |
| 6 | Host not checked at Activate | The host slept and lost the network for 51 min. A needed port was busy, and a builder found this, not the brief. A tool was missing. Agents hit shell and tool-family differences again and again, and the harness blocked long sleep commands | About 2.5 h lost on one Story, plus the same discovery in many agents |
| 7 | Leader context | The leader context reached about 950k tokens. The user compacted it by hand. Then the leader read its own transcript 5 times to rebuild its state | The user had to act; rebuilding state was costly |
| 8 | Builder context in fix rounds | Builder context reached 806k to 834k tokens, above the 70% rule, and no handoff happened. Fix rounds used 58% to 84% of builder tokens. One builder made 230 edits through shell scripts and 1 with the edit tool | About 330M builder tokens spent on fix rounds |
| 9 | Shutdown format | Smaller-model agents sent the shutdown reply as a text string instead of a structured object, 57 times | 57 error turns |
| 10 | Weak checks in plans and UAT | Planned breaks and mutants that could not fail. A UAT case that needed a product edit, which the runner brief forbids. A case file that named the wrong commit and folder | Rework and unobserved UAT rows |
| 11 | Late second question batch | The planner's questions came 11 min after the first batch. One question was a detail that the leader could decide. While the user was away, one answer took 30 min and every agent waited | 30 min with all agents idle |
| 12 | CI watch | The verifier held a foreground watch loop and ended its report with a menu of options | The user had to interrupt it twice |

### What was changed, and why

| # | Change | Where | Why |
| --- | --- | --- | --- |
| 1 | Severity rubric for all lenses. A round passes with no high finding and no medium finding in product code. After a passing round, the last batch gets the verifier and a leader diff read, with no new reviewers. A new round starts only for a high, a product medium, or a product change over about 60 lines. Fewer lenses for a test-only or docs-only fix diff. A hard stop after 3 rounds | `SKILL.md` Verify and close step 5–6; `briefs.md` Reviewer brief | "Repeat until pass" has no end when every fix adds review surface. The rubric keeps test-helper robustness out of the medium level |
| 2 | Do not answer idle, shutdown or terminated notifications; ignore the repeated report; tell the user only at Story events | `harnesses.md` Claude Code | Most leader turns carried no new information |
| 3 | One owner per shared resource. Mutants only in an exported copy or a separate worktree. The leader does not edit files that a live builder owns. Briefs name resources and owners | `SKILL.md` Roles, Context pack; `briefs.md` Common rules, Verifier brief | "One writer per tree" did not cover paths, ports, devices, evidence folders, or a verifier restoring files over a builder |
| 4 | "The user accepted" only with a cited answer; other decisions are marked `leader`. A limit that breaks an AC is always a user question. Every number in a question option cites a measurement or `file:line` | `SKILL.md` Decision ladder | False consent spreads into canon documents. A wrong premise forces a second question |
| 5 | A permission denial is final: never reach the same effect another way | `SKILL.md` Non-negotiables; `briefs.md` Common rules | The denial is the user's decision, not an obstacle |
| 6 | Host readiness and skill version in the Activate scan; an Environment block in the current-situation note that every brief links | `SKILL.md` Activate; `briefs.md` Current situation note | Each agent rediscovered the same host facts, and sleep cost almost an hour |
| 7 | One leader spot check per Story; a handoff note and a compaction request at about 60% of the leader window; never read your own transcript | `SKILL.md` Context budget | The core principle had no number and no recovery path |
| 8 | A fresh builder after 2 fix rounds, with a handoff. Edits with the edit tools, and capped command output | `SKILL.md` Session continuity; `briefs.md` Common rules | Each fix turn re-reads the whole build context; the 70% rule was never applied |
| 9 | The exact structured shutdown reply in every brief; reports to a named file; nothing left running; no menu at the end of a report | `briefs.md` Common rules; `harnesses.md` Claude Code | Smaller models do not infer the format from a general instruction |
| 10 | The planner proves that each planned break or mutant can fail, names platform differences, and checks the brief against the design. The verifier checks UAT cases before dispatch and owns break-once runs. Triage rows that change behaviour name the regression risk | `briefs.md` Planner, Verifier, Triage file; `SKILL.md` Build checkpoints, Verify and close step 7 | Plans promised checks that could not go red, and leader rules caused regressions |
| 11 | Run the epic planner before the first question and batch its questions; while the user is away, decide details and mark them "open for you to confirm" | `SKILL.md` Activate, Bias to decide | One batch, and no idle agents waiting on a detail |
| 12 | A CI step: a background watch, a stop before the report, overtime is `NOT RUN`, and planning of the next Story while CI runs. A squash merge keeps the user's own commits separate | `SKILL.md` Verify and close steps 8–9 | It writes down a practice that worked and removes the foreground loop |
| 13 | Triage file template; a pause and resume protocol | `briefs.md` Triage file; `SKILL.md` Pause and resume | Both were invented during the run and worked; now they are written down |

### How to tell whether the changes worked

Measure these in the next run's retrospective:

- Review rounds per Story: at most 3, and no round started by low or test-only findings.
- Share of leader turns that answer notifications: well below 58%.
- Collisions on shared resources, and mutants found in a builder's tree: zero.
- User questions caused by a leader error or a wrong premise: zero.
- Leader compactions started by the user: zero; handoffs started by the leader at about 60%.
- Builder tokens spent in fix rounds, as a share of builder tokens: below 58%.
- Shutdown format errors: zero.

### Outside the skill

These came up in the run, but the skill cannot fix them:

- Output-style hooks and plugins of the user's session also reach every teammate, and they clash with "reply in a few lines". Turn them off for teammates in the project settings, or name the report style in the brief.
- A project rule "never commit without approval" conflicts with the Full build rule "the builder commits on its Story branch". Put an exception in the project instructions.
- Idle notifications repeat the last report. This is harness behaviour. Report it as harness feedback.
