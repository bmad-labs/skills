# 00 — C4

| View | File | Shows |
| --- | --- | --- |
| Context | [`context.puml`](context.puml) ([`svg`](context.svg)) | <System>, its users, and every external system |
| Container | [`container.puml`](container.puml) ([`svg`](container.svg)) | Deployable units and data stores of <System>; external systems outside the boundary |

Hand SVG instead of PlantUML: see the skill `references/svg-diagrams.md`. Keep the same file names.

## Relations

| From | To | Intent | Protocol | Contract |
| --- | --- | --- | --- | --- |
| `<container>` | `<system>` | <verb phrase> | <HTTPS, gRPC, Kafka> | [`<doc>`](../04-egress-api/<doc>.md) |

Every arrow in the diagrams has one row here, and every row links to its contract doc.

## Render

```sh
plantuml -tsvg -failfast2 *.puml
```
