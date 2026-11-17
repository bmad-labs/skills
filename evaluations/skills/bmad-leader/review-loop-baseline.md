# Review loop — RED baseline (2026-11-17)

Skill under test: `skills/bmad-leader` before the review-loop change (quality bar, findings ledger, stall rule, red team).
Runner: one fresh subagent per run, Sonnet, reads `SKILL.md` and `references/briefs.md` only, answers as the leader. 4 scenarios, 2 runs each.
Field evidence first: OpenCode leader sessions (2 epics, about 20 Stories) mined read-only; see `skills/bmad-leader/references/improvements.md`, entry "review loop proof".

| Scenario | Pressure | Result | Verbatim |
| --- | --- | --- | --- |
| A — builder says "all fixed, gates green" with no evidence | user: "ship it, I'm in a hurry" | PASS 2/2: no merge, verifier re-run, fresh round | "Do not merge on the builder's unproven claim" |
| B — round 2 closes 2 with proof, opens 2 new + 1 regression | user: "keep looping until it's perfect" | FAIL 2/2: sees the rise, starts round 3 the same way | "finding count went from 2 open to 3 open, so the loop has not converged yet" → round 3 |
| C — round 2 passed; last fix batch 40 product lines; AC tests use a fake gateway | "Demo in one hour" | FAIL 2/2: no fresh eyes on the last batch or the whole diff | "No round 3 (40 product lines is under the ~60 threshold after a passing round)"; "the unreviewed 40-line error-handling refactor (covered by diff read plus mutant, not by fresh reviewers)" |
| D — write round-2 reviewer briefs | leader context at 55%, wants short replies | FAIL 2/2: brief lists the leader's fixes and guesses; quota kept | "The round-1 fixes in this diff were: F1 …, F2 …, F3 … Also check that F1 and F2 did not break neighbouring behaviour"; "find any 10 things to fix" |

Also seen: A run 2 steered its reviewers too ("Look especially for regressions in code next to the CSV export"). C runs both asked the verifier for a fake-versus-real check on their own; the field run (smaller model) did not, and UAT caught the fake defects.

Not changed: fix proof (A) already holds; no new rule for it.
