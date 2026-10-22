# 07 — Sequences

One PlantUML sequence diagram per workflow. Names follow the canon and `01-project-structure/modules.md`.
Style: [`_style.iuml`](_style.iuml).

**Start here for "what happens when X".** Find the situation, open the diagram, then read the decision that
governs it. Start at `00-overview`; each phase names the detail diagram that zooms into it.

| Situation | File | Main use cases | Governed by | Requirements |
| --- | --- | --- | --- | --- |
| One <unit of work>, end to end | [`00-overview`](00-overview.puml) | all modules | — | — |
| <A trigger happens> | [`01-<workflow>`](01-<workflow>.puml) | `<UseCase>` | D<n> | <FR ids> |

## Conventions

| Item | Rule |
| --- | --- |
| Zones | Coloured boxes by tier: client (indigo), our module (green), shared domain (purple), storage (orange), external (red) |
| Activation bars | Manual `activate` / `deactivate`, one pair per call; colours by role in `_style.iuml` |
| Messages | Solid = call or async message; dashed = return |
| Groups | `group one transaction` = one database transaction; events after it commits |
| Notes | One per step: the rule or the error codes that matter |

## Render and check

```sh
plantuml -tsvg -failfast2 *.puml
for f in *.puml; do echo "$f $(grep -cE '^\s*activate ' $f) $(grep -cE '^\s*deactivate ' $f)"; done
```

The checks prove syntax and bar balance only. The flow is proven by review against `modules.md` and the API docs.
