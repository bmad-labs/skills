# ORD111 — Fraud Check Requested

| Item | Value |
| --- | --- |
| Event code | `ORD111` |
| Entity | `FRAUD_CHECK` |
| Topic | `fraud.{env}.check-requests` |
| Key | `data.orderId` |
| Producer (`source.service`) | `order-service` |
| Schema | [`FRD_001`](FRD_001.schema.json); event schema [`ORD111.schema.json`](ORD111.schema.json) |
| Emitted when | An order is placed and needs a score before payment. |
| Raised by | `RequestFraudCheckUseCase`; opens an attempt and registers a timeout timer |
| Consumers | Fraud vendor scores the order and answers with FRD001 or FRD002. |
| Requirements | FR-11 |

## Attributes

| Parameter | | Type | Required | Description |
| --- | --- | --- | --- | --- |
| **Common** |  |  |  | [`_envelope.schema.json`](../02-domain-events/_envelope.schema.json) |
| `id` |  | string | Yes | Event id (UUID v4). Consumers drop a repeated id |
| `code` |  | string | Yes | Event code |
| `source` |  | JSONObject | Yes | Producer of the event |
|  | `system` | string | Yes | Source system |
|  | `service` | string | Yes | Source service. Loop guard: a consumer acts only on the services it trusts |
| `entity` |  | string | Yes | Entity of the event. Values: `ORDER`, `PAYMENT`, `FRAUD_CHECK` |
| `timestamp` |  | string | Yes | Time the event was emitted (ISO-8601 UTC) |
| `actor` |  | actor \| null | Yes | Who made the action; null for a system action |
| `data` |  | JSONObject | Yes | What the vendor needs to score one order. Nothing else |
|  | `checkId` | objectId | Yes | Attempt id; the vendor copies it into the answer |
|  | `orderId` | objectId | Yes | Message key |
|  | `total` | money | Yes |  |
|  | `customerId` | string | Yes |  |

## Message Key

`data.orderId`. Messages with the same key keep their order.

## Example

### Sample

Key: `66f100000000000000000001`

```json
{
  "id": "9b1c2a5e-7b8d-4c1e-9a2b-000000000111",
  "code": "ORD111",
  "source": {
    "system": "shop",
    "service": "order-service"
  },
  "entity": "FRAUD_CHECK",
  "timestamp": "2026-09-22T08:30:01.000Z",
  "actor": null,
  "data": {
    "checkId": "66f100000000000000000a01",
    "orderId": "66f100000000000000000001",
    "total": {
      "amount": 25,
      "currency": "EUR"
    },
    "customerId": "C-10023"
  }
}
```
