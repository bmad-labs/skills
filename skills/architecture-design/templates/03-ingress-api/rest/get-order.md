# <METHOD> <path>

| Item | Value |
| --- | --- |
| Name | <operationId> |
| Description | <what it does> |
| Method | `<GET>` |
| Url | `<path with {params}>` |
| Host | dev `<host>` · test `<host>` · prod `<host>` |
| Auth | <scheme, who issues the token, scope rule> |
| Caller | <client> |
| Handled by | `<module>` controller → `<UseCase>` |
| Protocol file | [`openapi.yml`](openapi.yml) `#/paths/<path>` |
| Requirements | <FR ids> |

## Request Headers

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <token>` |

## Path and Query Parameters

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `<param>` | path | string | Yes | <meaning> |

## Response Body

| Parameter | | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `status` | | int32 | Yes | HTTP status |
| `code` | | int32 | Yes | 1 on success; error code on failure |
| `message` | | string | Yes | `SUCCESS`, or the error message |
| `data` | | JSONObject | No | Success only |
| | `<field>` | string | Yes | <meaning> |

## Error Codes

| Status | Code | Name | Message |
| --- | --- | --- | --- |
| 404 | <-NNN001> | `<ENTITY>_NOT_FOUND` | <Entity> not found |

## Example

**REQUEST**

```http
GET <path> HTTP/1.1
Authorization: Bearer <token>
```

**SUCCESS RESPONSE** (200)

```json
{ "status": 200, "code": 1, "message": "SUCCESS", "data": {} }
```

**FAILED RESPONSE** (404)

```json
{ "status": 404, "code": <-NNN001>, "message": "<Entity> not found" }
```
