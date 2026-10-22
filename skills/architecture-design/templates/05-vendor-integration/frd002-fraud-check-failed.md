# FRD002 — Fraud Check Failed

| Item | Value |
| --- | --- |
| Event code | `FRD002` |
| Entity | `FRAUD_CHECK` |
| Topic | `fraud.{env}.check-results` |
| Key | `data.orderId` |
| Producer (`source.service`) | `fraud-vendor` |
| Schema | [`FRD_002`](FRD_002.schema.json); event schema [`FRD002.schema.json`](FRD002.schema.json) |
| Emitted when | The vendor could not score the order. |
| Raised by | Fraud vendor |
| Consumers | `RecordFraudFailureUseCase`: order goes to manual review. |
| Requirements | FR-13 |

## Attributes

| Parameter | | | Type | Required | Description |
| --- | --- | --- | --- | --- | --- |
| **Common** |  |  |  |  | [`_envelope.schema.json`](../02-domain-events/_envelope.schema.json) |
| `id` |  |  | string | Yes | Event id (UUID v4). Consumers drop a repeated id |
| `code` |  |  | string | Yes | Event code |
| `source` |  |  | JSONObject | Yes | Producer of the event |
|  | `system` |  | string | Yes | Source system |
|  | `service` |  | string | Yes | Source service. Loop guard: a consumer acts only on the services it trusts |
| `entity` |  |  | string | Yes | Entity of the event. Values: `ORDER`, `PAYMENT`, `FRAUD_CHECK` |
| `timestamp` |  |  | string | Yes | Time the event was emitted (ISO-8601 UTC) |
| `actor` |  |  | actor \| null | Yes | Who made the action; null for a system action |
| `data` |  |  | JSONObject | Yes | Result of one check. score on completed, error on failed |
|  | `checkId` |  | objectId | Yes | Copied from the request |
|  | `orderId` |  | objectId | Yes | Copied from the request; message key |
|  | `score` |  | integer | No | Risk score; higher is riskier |
|  | `error` |  | JSONObject | Yes |  |
|  |  | `errorType` | string | Yes | Values: `invalid_request`, `internal` |
|  |  | `message` | string | No |  |

## Message Key

`data.orderId`. Messages with the same key keep their order.

## Example

### Sample

Key: `66f100000000000000000001`

```json
{
  "id": "9b1c2a5e-7b8d-4c1e-9a2b-000000000202",
  "code": "FRD002",
  "source": {
    "system": "fraud",
    "service": "fraud-vendor"
  },
  "entity": "FRAUD_CHECK",
  "timestamp": "2026-09-22T08:30:03.000Z",
  "actor": null,
  "data": {
    "checkId": "66f100000000000000000a01",
    "orderId": "66f100000000000000000001",
    "error": {
      "errorType": "internal",
      "message": "Model unavailable"
    }
  }
}
```
