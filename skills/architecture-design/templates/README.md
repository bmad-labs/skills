# <System> — Design Package

Detailed design derived from [`<upstream architecture doc>`](<path>). This file is the **naming canon**: every folder
uses the names, codes, topics, and shapes below. When a folder and this file disagree, this file wins; fix the folder.
When this file and the upstream document disagree, the upstream wins; fix this file.

Sources: <intent, PRD, reference ERD, event sheet, API sheet, C4 images — one path each>.

Level: <High | Medium | Low>.

## Folders

| Folder | Holds | Adaptation |
| --- | --- | --- |
| [`00-c4/`](00-c4/) | Context and container views | — |
| [`01-project-structure/`](01-project-structure/) | Source tree, modules, shared domain, error codes, configuration | — |
| [`02-domain-events/`](02-domain-events/) | One file per domain event, envelope, schemas, examples | — |
| [`03-ingress-api/`](03-ingress-api/) | APIs the service serves or consumes, with protocol files | — |
| [`04-egress-api/`](04-egress-api/) | APIs the service calls or produces, with protocol files | — |
| [`05-<vendor>-integration/`](05-vendor-integration/) | Request and answers exchanged with <vendor> | — |
| [`06-data-modeling/`](06-data-modeling/) | ERD, state diagram, per collection: `.jsonc`, `.schema.json`, `.example.json` | — |
| [`07-sequences/`](07-sequences/) | One sequence diagram per workflow. Start here for "what happens when X" | — |
| [`08-class-diagrams/`](08-class-diagrams/) | One class diagram per module, plus the shared domain | — |
| [`09-data-pipeline/`](09-data-pipeline/) | Pipeline of one unit of work | — |
| [`10-<engine>-workflow/`](10-engine-workflow/) | Workflow owned by <team> on <engine> | — |
| [`tools/`](tools/) | Generators and validators | — |

Write one line in "Adaptation" for each folder you added, dropped, merged, or split, and why.

## Identifiers

| Name | Value |
| --- | --- |
| Service (event `source.service`) | `<service>` |
| System (event `source.system`) | `<system>` |
| gRPC package / service | `<package>.v1` / `<Service>Service` |
| Error code range | `<-NNN001>` to `<-NNN999>`, sequential ([`01-project-structure/error-codes.md`](01-project-structure/error-codes.md)) |
| Ids | `<entityId>`: <format> |
| Time | ISO-8601 UTC strings on the wire |

## Topics and endpoints

| Topic or base URL | Direction | Key | Carries |
| --- | --- | --- | --- |
| `<topic>` | produce, consume | `<key field>` | <codes> |

Every message uses the envelope in [`02-domain-events/_envelope.schema.json`](02-domain-events/_envelope.schema.json).
A consumer ignores codes it does not act on and top-level fields it does not know.

## Event and message catalog

| Code | Name | Entity | Producer | Emitted when | Schema id |
| --- | --- | --- | --- | --- | --- |
| `<ABC101>` | <Name> | `<ENTITY>` | `<service>` | <one sentence> | `<SCH_001>` |

## API list

| Group | Methods |
| --- | --- |
| <group> | `<Method>`, `<Method>` |

## Status transitions

| From | To | Trigger | Event |
| --- | --- | --- | --- |
| — | `<status>` | <use case, event, or API> | `<ABC101>` |

Only `<StatusMachine>` changes the status. Diagram: [`06-data-modeling/entity-states.puml`](06-data-modeling/entity-states.puml).

## Decision register

| # | Decision | Decided by | Lives in |
| --- | --- | --- | --- |
| D1 | <decision, one sentence> | <user, date> or agent default | <upstream section> |

## Open items

| # | Question | Owner | Current assumption |
| --- | --- | --- | --- |
| DQ-1 | <question> | <team or person> | `[ASSUMPTION]` <what the design assumes now> |
