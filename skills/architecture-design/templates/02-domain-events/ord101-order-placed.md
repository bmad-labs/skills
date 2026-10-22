# ORD101 — Order Placed

| Item | Value |
| --- | --- |
| Event code | `ORD101` |
| Entity | `ORDER` |
| Topic | `shop.{env}.order-events` |
| Key | `data.orderId` |
| Producer (`source.service`) | `order-service` |
| Schema | [`ORD_001`](ORD_001.schema.json); event schema [`ORD101.schema.json`](ORD101.schema.json) |
| Emitted when | A valid order is stored (status `placed`). |
| Raised by | `PlaceOrderUseCase` (order-intake), after its transaction commits |
| Consumers | payment-service starts the charge. Reporting counts it. |
| Requirements | FR-1, FR-3 |

## Attributes

| Parameter | | | Type | Required | Description |
| --- | --- | --- | --- | --- | --- |
| **Common** |  |  |  |  | [`_envelope.schema.json`](_envelope.schema.json) |
| `id` |  |  | string | Yes | Event id (UUID v4). Consumers drop a repeated id |
| `code` |  |  | string | Yes | Event code |
| `source` |  |  | JSONObject | Yes | Producer of the event |
|  | `system` |  | string | Yes | Source system |
|  | `service` |  | string | Yes | Source service. Loop guard: a consumer acts only on the services it trusts |
| `entity` |  |  | string | Yes | Entity of the event. Values: `ORDER`, `PAYMENT`, `FRAUD_CHECK` |
| `timestamp` |  |  | string | Yes | Time the event was emitted (ISO-8601 UTC) |
| `actor` |  |  | actor \| null | Yes | Who made the action; null for a system action |
| `data` |  |  | JSONObject | Yes | Order id, owning channel, the transition, and what a consumer needs to act. No other order field |
|  | `orderId` |  | objectId | Yes | orders._id; also the message key |
|  | `channelCode` |  | string | Yes | Owning channel; consumers route by it |
|  | `transition` |  | JSONObject | Yes | The status change |
|  |  | `from` | string \| null | Yes | Values: `placed`, `paid`, `payment_failed`, `cancelled` |
|  |  | `to` | string | Yes | Values: `placed`, `paid`, `payment_failed`, `cancelled` |
|  |  | `at` | date | Yes |  |
|  | `total` |  | money | Yes | Order total at the transition |
|  | `error` |  | JSONObject | No | Present on a failed transition |
|  |  | `reason` | string | Yes | Values: `declined`, `timeout` |
|  |  | `message` | string | No |  |

## Message Key

`data.orderId`. Messages with the same key keep their order.

## Errors

| Case | Handling | Error code |
| --- | --- | --- |
| Consumer gets an unknown `code` | Ignore | — |
| Consumer gets a repeated `id` | Drop | — |

## Example

### Sample

Key: `66f100000000000000000001`

```json
{
  "id": "3f1c2a5e-7b8d-4c1e-9a2b-000000000101",
  "code": "ORD101",
  "source": {
    "system": "shop",
    "service": "order-service"
  },
  "entity": "ORDER",
  "timestamp": "2026-09-22T08:30:00.120Z",
  "actor": {
    "email": "jane@example.com",
    "role": "USER"
  },
  "data": {
    "orderId": "66f100000000000000000001",
    "channelCode": "WEB",
    "transition": {
      "from": null,
      "to": "placed",
      "at": "2026-09-22T08:30:00Z"
    },
    "total": {
      "amount": 25,
      "currency": "EUR"
    }
  }
}
```
