# Leader Retrospective

Load this file only when the user asks for a retrospective of a leader run. It is not part of a normal build.

This workflow reviews how the leader process ran, not the product. It finds what went well, what did not, and what to change in this skill. It is separate from the epic retrospective (`bmad-retrospective`, in `Epic rhythm`).

**Run it only when the user asks for it**, for example "retro the leader run" or "retrospective of the bmad-leader jobs". Never start it yourself. Do not start it at epic close, after a failure, or as a suggestion. It reads many logs and costs real tokens.

1. **Scope.** Agree which run to review: the sessions, dates and Stories. Find the skill version that run used (the Activate scan records it). If the skill changed during the run, judge each rule against the version that was in force.
2. **Collect the logs.** Find the leader session log and every child session log. On Claude Code they are the JSONL files in the project's folder under `~/.claude/projects/`; the `agentName` field names each agent. A child that ran from another working folder logs under that folder's project. Also collect the run's artifacts: triage files, review, verify and UAT reports, the git log, and the CI results.
3. **Measure by script.** Do not estimate. Count for each role and each Story: duration, tokens, tool errors, real permission denials (apart from format errors), notifications and the leader turns spent on them, review rounds, findings by severity and lens, overlap between lenses, and user questions with their answers. Compute the cost from the tokens. Look up the current per-token prices; never take them from memory.
4. **Mine in parallel.** Dispatch up to 3 read-only research subagents from `## Miner brief` below. Give each one area: the leader log; the persistent roles (planner, builder, verifier); the reviewers and UAT runners. They return evidence (timestamp and a short quote), never secrets, and a short list of improvement ideas, each mapped to a skill section.
5. **Synthesize.** The leader writes: the results in numbers, what went well (with evidence), what did not (with evidence and cost), and a ranked proposal. Each proposal item names the target section and gives the exact new rule text. Check 3 claims against the logs yourself before you present them.
6. **Present and ask.** Show the proposal and ask the user where it goes: a proposal file only; edits to the local copy of this skill; or a change for the skill's upstream source. A local copy that is installed from an upstream source is overwritten by the next update.
7. **Apply only what the user approved.** Write the rules and the improvement log entry in generic terms: no project, product, company or team name, no domain term, path, tool or number that holds for only one project, and no person. Search the changed text for the project's own terms. Add an entry to `improvements.md` with `## Improvement log entry` below. Store your personal lessons in the harness memory, if it has one.
8. **Do not commit or push** unless the user says so.

## Miner brief

Only for a leader retrospective that the user asked for. One brief per area: the leader log; the persistent roles; the reviewers and UAT runners.

```markdown
Read-only research for a retrospective of a bmad-leader run. Do not edit any file.
Never print a secret or token that a log holds; write <redacted>.

Read first: <path to the bmad-leader SKILL.md, at the version the run used>.
Your area: <leader log | planner, builder, verifier logs | reviewer and UAT logs>.
Logs: <paths or how to find them; which field names the agent>.
Artifacts: <triage, review, verify, UAT report paths; git range>.
Measured so far: <counts the leader already has; do not measure them again>.

Read the logs with short scripts; never print a whole log. Measure; do not guess.

Find, each with a timestamp or file:line and a quote of 20 words or fewer:
- What went well, and the rule or practice that made it work.
- What did not go well: the problem, the evidence, and its cost in time or tokens.
- Rules in the skill that were missing, unclear, ignored, or harmful.
- Practices the agents invented that worked and are not in the skill.

Return at most <n> lines. End with "Top improvement ideas", each naming the
skill section it would change. Use generic wording; this project is one example.
```

## Improvement log entry

The leader adds one entry to `references/improvements.md`, newest first, after a leader retrospective. Keep it generic: no project, product, company or team name, no domain term, path, file, branch, tool or service of one project, and no person. Describe the work only by its shape. Before saving, search the entry for the project's own terms.

```markdown
## <yyyy-mm> — <scope in a few words>, <harness>

### The run
| Item | Value |
| --- | --- |
| Work | <kind of work, number of Stories> |
| Harness | <harness and flow> |
| Result | <Stories merged, CI, UAT> |
| Time | <active wall time> |
| Agents | <sessions by role> |
| Cost | <total and by role, at list prices> |
| Evidence | <which logs, how they were measured> |

### What went well (kept)
| Practice | Evidence | Why it works |

### What did not go well
| # | Problem | Evidence | Cost |

### What was changed, and why
| # | Change | Where | Why |

### How to tell whether the changes worked
- <metric and target for the next retrospective>

### Outside the skill
- <problem the skill cannot fix, and who owns it>
```
