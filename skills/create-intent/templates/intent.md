# <Product / Feature> — Business Intent

Source: <N> <sources> (<epic / folder link>). Decisions: [memlog.md](memlog.md) C1–C<n>.

Scope: business need, features, requirements, acceptance criteria (AC). Technical design, technical solution, subtasks, and checklists are out of scope.

Detail:
- [fr.md](fr.md) — functional requirements and AC, per feature, with **Decision**, **Gap**, and **Technical** lines.
- [nfr.md](nfr.md) — non-functional requirements.
- [memlog.md](memlog.md) — reading log, questions, answers, clarifications.
- [confirm-po.md](confirm-po.md) — business items for the PO. <!-- add when phase 7 runs -->
- [confirm-tech.md](confirm-tech.md) — technical items for the tech lead. <!-- add when phase 7 runs -->

## Goal

<One sentence: what business wants.>

- <Who sends / uses what.>
- <What the system does.>
- <Boundary: what this system does NOT do, and who does it.>

## Users

| User | Needs |
| --- | --- |
| <role> | <needs, short> |

## Flow

```
<source> → <step> → <step>
  → <branch> → <result>
  → <failure> → <visible result>
```

## Features

| # | Feature | Sources |
| --- | --- | --- |
| F1 | <name — one line> | <KEY-1>, <KEY-2> |

Not built: <keys and reason, or "none">.

## Status values

| Field | Values | Source |
| --- | --- | --- |
| <field> | `<value>`, `<value>` | <KEY / Q#> |

## Key decisions

| Topic | Decision | Q |
| --- | --- | --- |
| <topic> | <decision> | <Q# / C#> |

## Biggest gaps

Business items: [confirm-po.md](confirm-po.md). Technical items: [confirm-tech.md](confirm-tech.md). Top items:

1. <gap> (<Q# / G#>).
