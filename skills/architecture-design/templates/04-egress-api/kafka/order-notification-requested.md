# Produce — <Message name>

| Item | Value |
| --- | --- |
| Name | <Message name> |
| Description | <what we ask or tell, and when> |
| Topic | `<topic>` |
| Event code | `<CODE>` or "none: plain payload" |
| Key | `<key field>` (see Message Key) |
| Producer | `<Port>.<method>` in `<UseCase>`, after the transaction commits |
| Consumer | `<service>` (<what it does>) |
| Delivery | <at most once after commit / outbox>; <what happens when it is lost> |
| Schema | [`<name>.schema.json`](<name>.schema.json) |
| Requirements | <FR ids> |

## Attributes

| Parameter | | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `<field>` | | string | Yes | <meaning> |

## Message Key

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `<key field>` | string | Yes | <which messages must stay in order> |

## Example

```json
{ "<field>": "<value>" }
```
