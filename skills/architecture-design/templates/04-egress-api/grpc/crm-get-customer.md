# Call — <Service>.<Method>

| Item | Value |
| --- | --- |
| Name | <Method> |
| Status | Existing, or **PROPOSED** (DQ-<n>, owner <team>) |
| Description | <what we read or ask> |
| Package / Service | `<package>.v1` / `<Service>` |
| Proto | [`<file>.proto`](<file>.proto) (excerpt; owner's source: <path>) |
| Endpoint | `<VENDOR>_GRPC_URL`, deadline `<VENDOR>_TIMEOUT_MS` |
| Called by | `<Port>.<method>` in `<UseCase>` |
| Cache | <none, or who owns caching and for how long> |
| Requirements | <FR ids> |

## Request

| Parameter | Type | Required | Source in <service> |
| --- | --- | --- | --- |
| `<field>` | string | Yes | <caller header, entity field> |

## Response (fields we read)

| Parameter | | Type | Used for |
| --- | --- | --- | --- |
| `data` | | `<Message>` | |
| | `<field>` | string | <rule or screen that needs it> |

## Answer handling

| Answer | We do |
| --- | --- |
| Success | <use the data> |
| Not found | <refuse with `<ERROR_CODE>`> |
| Unavailable, deadline | <refuse with `<ERROR_CODE>`, or use the last value for <n> s> |

## Example

```json
{ "<field>": "<value>" }
```
