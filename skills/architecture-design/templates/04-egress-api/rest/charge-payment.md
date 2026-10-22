# Call — <Vendor> <operation>

| Item | Value |
| --- | --- |
| Name | <operationId> |
| Description | <what we ask the vendor to do> |
| Method | `<POST>` |
| Url | `<base>/<path>` (`<VENDOR>_BASE_URL`) |
| Host | dev `<host>` · test `<host>` · prod `<host>` |
| Auth | <API key, OAuth client, mTLS> (`<VENDOR>_API_KEY`) |
| Timeout | `<VENDOR>_TIMEOUT_MS` = <n> ms |
| Idempotency key | `<field + field>`: a retry never creates a duplicate |
| Called by | `<Port>.<method>` in `<UseCase or Handler>` |
| Protocol file | [`openapi.yml`](openapi.yml) `#/paths/<path>` |
| Vendor reference | <link or path to the vendor spec> |
| Requirements | <FR ids> |

## Request Body

| Parameter | | Type | Required | Source in <service> | Rule |
| --- | --- | --- | --- | --- | --- |
| `<vendorField>` | | string | Yes | `<collection>.<field>` | <format, default, `[ASSUMPTION]`> |
| `<vendorObject>` | | JSONObject | Yes | | |
| | `<vendorField>` | number | Yes | sum of `<collection>.<list>[].<field>` | <rounding> |

## Response Body (success)

| Parameter | Type | Read | Stored as |
| --- | --- | --- | --- |
| `<vendorField>` | string | Yes | `<collection>.<field>` |

## Answer handling

| Answer | Meaning | We do |
| --- | --- | --- |
| 201 | Accepted | Record `accepted`; publish `<CODE>` |
| 400 | Rejected (validation) | Record `failed` with the vendor error; user fixes and retries |
| 409 | Repeated key | Treat as accepted when an earlier try with the same key exists `[ASSUMPTION]` DQ-<n> |
| 5xx, timeout | Unknown | Record `failed` (`timeout`); retry is safe by the idempotency key |

## Example

**REQUEST**

```json
{ "<vendorField>": "<value>" }
```

**SUCCESS RESPONSE** (201)

```json
{ "<vendorField>": "<value>" }
```

**FAILED RESPONSE** (400)

```json
{ "<errorCode>": "<value>", "<errorMessage>": "<value>" }
```
