# 10 — <Engine> Workflow

The <engine> side of <process>, **built and run by <team>** on <infrastructure>. The service ships no engine code:
the engine and the service talk only through domain events on `<topic>`. Formats follow the <engine> docs (<task
types used>; checked <date>).

This file is the single source for the exchange: which event starts, completes, or closes which workflow and task.

| File | Holds |
| --- | --- |
| [`event-handlers.json`](event-handlers.json) | <n> event handlers that start the workflows |
| [`order_review.workflow.json`](order_review.workflow.json) | <what one run does> |
| [`workflow.puml`](workflow.puml) ([`svg`](workflow.svg)) | Activity diagram |

## Events in and out

| Event (from `<service>`) | Handler | Engine does |
| --- | --- | --- |
| `<CODE>` <Name> | `<handler>` | <starts / completes / closes what> |

| Event (from `<engine>`) | Built by | Service does |
| --- | --- | --- |
| `<CODE>` <Request> | `<task>` | <transition, then publishes the fact `<CODE>`; drops it when the state moved on> |

## Rules

| Rule | How |
| --- | --- |
| Loop guard | Engine acts only on `source.service == '<service>'`; the service acts only on the engine's request codes |
| Facts and requests | The engine asks; the service answers with the fact after its own transition |
| One run per <entity> | `correlationId` = `<entityId>`; a new run closes older runs |
| Duplicate events | `idempotencyKey` = event `id` |
| Human task | <outcomes, SLA, what it shows, how it ends> |

## Configuration <team> provides

| Item | Value in these files | Status |
| --- | --- | --- |
| <integration name, secrets, groups, forms> | `<value>` | `[ASSUMPTION]` |
