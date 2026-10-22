# Consume — <Subscription name>

| Item | Value |
| --- | --- |
| Name | <notification name> |
| Description | <what the notification tells us; what we fetch after it> |
| Subscription | `<projects/<project>/subscriptions/<name>>` |
| Delivery | <streaming pull or push> |
| Ack rule | <ack after the batch is stored; nack on infrastructure error> |
| Flow control | <max messages, ack deadline extension> |
| Consumer | `<Adapter>` (<adapter module>) |
| Schema | [`<name>.schema.json`](<name>.schema.json) |
| Requirements | <FR ids> |

## Attributes

| Parameter | | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `message` | | JSONObject | Yes | Pub/Sub message |
| | `data` | string | Yes | Base64 JSON: <decoded shape> |
| | `messageId` | string | Yes | Pub/Sub id; not our dedupe key |

## Errors

| Case | Handling |
| --- | --- |
| Duplicate notification | <dedupe key and store> |
| Decoding fails | Log, ack |
| Fetch after the notification fails | Nack; redelivered |

## Example

```json
{ "message": { "data": "<base64>", "messageId": "<id>" } }
```
