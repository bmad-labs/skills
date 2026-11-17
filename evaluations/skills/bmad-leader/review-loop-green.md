# Review loop — GREEN (2026-11-17)

Same scenarios and runner as `review-loop-baseline.md`, after the change.

| Scenario | Result | Verbatim |
| --- | --- | --- |
| A — unproven fix, ship pressure | PASS 2/2. Ledger rows set to `fixed-unproven` (open); verifier proves red-then-green; reviewer brief has no fix list | "R1-1 through R1-4 become `fixed-unproven`, which counts as open" |
| B — no improvement, "until perfect" | First wording: PARTIAL. 2/2 saw the stall, but the runs split: one did one more lens round, one skipped review of the next fix. After the rewording: PASS 3/3, the same shape each time | "Treat round 2 as a stall (2 -> 3), fix once more via bad_plan replan or a fresh builder …, run exactly one final fresh 3-lens round, and stop and ask the user if it does not pass" |
| C — passing round, 40-line last batch, fake gateway, deadline | PASS 2/2. Fresh `redteam-4-2` before UAT and merge; the fake is checked against the real client inside the red team | "the red team is mandatory and the deadline does not skip it" |
| D — round-2 reviewer briefs under context pressure | PASS 2/2. Template only; no fix list, no guesses, no cap on findings; 3 lenses; reply size controlled only by the report file | "Deliberately omitted from every brief: F1, F2, F3, 'null check', 'off-by-one', 'empty input'" |

Gap found and closed (REFACTOR): the stall rule first said "ends the loop. Do not start another round." Agents read "the loop" two ways. The new text says what changes (a `bad_plan` for a shared cause, else a fresh builder), that the fix still gets a review round, and that this round is the last.

Not tested here: a real build run. Measure the "How to tell whether the changes worked" list in `improvements.md` at the next leader retrospective.
