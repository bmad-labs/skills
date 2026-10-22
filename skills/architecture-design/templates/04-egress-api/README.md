# 04 — Egress API

What <service> calls or produces. Protocol files: [`rest/openapi.yml`](rest/openapi.yml),
[`grpc/<owner>.proto`](grpc/crm-customer.proto) (excerpt), [`asyncapi.yml`](asyncapi.yml).

| Target | Kind | Operation | Port | Called by | Doc |
| --- | --- | --- | --- | --- | --- |
| <Vendor> | REST | `<POST path>` | `<Port>.<method>` | `<UseCase>` | [<name>](rest/<name>.md) |
| <Service> | gRPC | `<Service>.<Method>` | `<Port>.<method>` | `<UseCase>` | [<name>](grpc/<name>.md) |
| <Consumer> | Kafka | `<topic>` | `<Port>.<method>` | `<UseCase>` | [<name>](kafka/<name>.md) |
| <DB> | SQL | Q1–Q<n> | `<Port>.<method>` | `<UseCase>` | [<name>](sql/<name>.md) |

## Failure rules

| Target | Timeout | Retry | When it is down |
| --- | --- | --- | --- |
| <Vendor> | `<VAR>` | <safe by idempotency key / none> | <recorded as failed; user retries / flow waits> |

## Open items

| # | Question | Owner |
| --- | --- | --- |
| DQ-<n> | <question to the target's owner> | <team> |
