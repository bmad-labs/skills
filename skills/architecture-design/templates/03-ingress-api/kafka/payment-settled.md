# Consume — <Message name>

| Item | Value |
| --- | --- |
| Name | <Message name> |
| Description | <what the producer tells us> |
| Topic | `<topic>` |
| Event code | `<CODE>` or "none: plain payload" |
| Key | `<key field>` (see Message Key) |
| Producer | `<service>` |
| Consumer | `<Controller>.<handler>` (<module>), group `<group>` |
| Acts only on | `source.service = <service>`, codes `<CODE>` |
| Schema | [`<name>.schema.json`](<name>.schema.json) |
| Requirements | <FR ids> |

## Attributes

| Parameter | | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `data` | | JSONObject | Yes | |
| | `<field>` | string | Yes | <meaning> |

## Message Key

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `<key field>` | string | Yes | <why this key: which messages must keep their order> |

## Routing

| Condition | Use case | Acts only when |
| --- | --- | --- |
| `<field> = <value>` | `<UseCase>` | <state guard, else log and drop> |

## Errors

| Case | Handling |
| --- | --- |
| Schema fails | Log, ack, count metric `<name>`; no retry |
| Unknown code or source | Ignore, ack |
| Repeated message | Idempotent by `<key>`: no second change |
| Database down | Do not ack; Kafka redelivers; after `<N>` tries, park |

## Example

```json
{ "<envelope or payload>": "<value>" }
```
