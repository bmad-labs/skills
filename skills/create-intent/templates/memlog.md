# <Product / Feature> — Reading Log

Log of sources read for [intent.md](intent.md). Each file read in full. This is the only file that keeps history.

## Sources read

| # | Source | Summary | Feature | Notes |
| --- | --- | --- | --- | --- |
| 1 | <KEY> | <title> | F<n> / Not built | <status, sprint, AC range, traps found, comments read yes/no, sections ignored> |

## Clarifications from the user

| # | Clarification | Date | Docs changed |
| --- | --- | --- | --- |
| C1 | <fact the user gave, or file the user added> | <YYYY-MM-DD> | <files> |

## Open questions

Items with status `Open` or `Confirm with PO` are in [confirm-po.md](confirm-po.md). Items with status `Confirm with tech lead` are in [confirm-tech.md](confirm-tech.md).

The user may answer inline: a line `=> <answer>` under a question row. Move each answer into the Answer column, then delete the `=>` line.

| # | Question | Source | Answer | Status |
| --- | --- | --- | --- | --- |
| Q1 | <problem, both sides quoted>. <What to decide?> Proposal: <default>. Audience: PO. | <KEY (ACn)> | — | Open |

Before phase 7, technical items stay here in a separate table (same columns, IDs T#, "Audience: tech lead"). Phase 7 moves them to `confirm-tech.md`.

Status values: `Open`, `Answered`, `Partly answered`, `Confirm with PO`, `Confirm with tech lead`, `Story ignored`.
