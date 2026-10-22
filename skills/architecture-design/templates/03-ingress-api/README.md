# 03 — Ingress API

What <service> serves or consumes. Protocol files: [`grpc/<service>.proto`](grpc/order.proto),
[`rest/openapi.yml`](rest/openapi.yml), [`asyncapi.yml`](asyncapi.yml).

## Identity and response shape

| Item | Rule |
| --- | --- |
| Caller identity | <header, who sets it, how the scope is derived> |
| Scope | <a caller sees and changes only …> |
| Success | `status`, `code` = 1, `message` = `SUCCESS`, `data` |
| Failure | `status`, `code`, `message`; no `data` ([`../01-project-structure/error-codes.md`](../01-project-structure/error-codes.md)) |

## gRPC (`<package>.v1.<Service>Service`)

| Method | Group | Use case | Doc |
| --- | --- | --- | --- |
| `<Method>` | <group> | `<UseCase>` | [<method>](grpc/<method>.md) |

## REST

| Method | Path | Use case | Doc |
| --- | --- | --- | --- |
| `<GET>` | `<path>` | `<UseCase>` | [<name>](rest/<name>.md) |

## Kafka and Pub/Sub (consumed)

| Topic or subscription | Codes | Consumer | Doc |
| --- | --- | --- | --- |
| `<topic>` | `<CODE>` | `<Controller>.<handler>` | [<name>](kafka/<name>.md) |
