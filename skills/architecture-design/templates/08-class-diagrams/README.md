# 08 — Class Diagrams

One PlantUML class diagram per module, plus the shared domain. They follow <architecture guide path> and
[`../01-project-structure/modules.md`](../01-project-structure/modules.md). Style and legend: [`_style.iuml`](_style.iuml),
[`_legend.iuml`](_legend.iuml).

| File | Shows |
| --- | --- |
| [`01-<module>`](01-<module>.puml) | <controllers, use cases, commands of the module> |
| [`<0N>-shared-domain-services`](<0N>-shared-domain-services.puml) | Domain services and pure rules |
| [`<0N>-shared-ports-adapters`](<0N>-shared-ports-adapters.puml) | Ports, their implementations, DI modules |
| [`<0N>-shared-domain-model`](<0N>-shared-domain-model.puml) | Entities |

## Guide rules the diagrams apply

| Guide rule | How it shows here |
| --- | --- |
| <layer rule> | <package per layer> |
| <use case called only by controller or handler> | <no use case → use case arrow> |
| <command lives in the handling module> | <command class inside the owner's package; sender draws a dashed CommandBus arrow> |

## Render

```sh
plantuml -tsvg -failfast2 *.puml
```
