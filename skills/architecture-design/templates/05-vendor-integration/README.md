# 05 — <Vendor> Integration

<Service> asks <vendor> to <task>. <Vendor> answers on a second topic. Both directions use the envelope and the
key `<key field>`. Protocol file: [`asyncapi.yml`](asyncapi.yml).

| Code | Message | Direction | Topic | Doc |
| --- | --- | --- | --- | --- |
| `<ABC111>` | <Requested> | <service> → <vendor> | `<command topic>` | [<abc111>](<abc111-slug>.md) |
| `<VND001>` | <Completed> | <vendor> → <service> | `<results topic>` | [<vnd001>](<vnd001-slug>.md) |
| `<VND002>` | <Failed> | <vendor> → <service> | same | [<vnd002>](<vnd002-slug>.md) |

> **Note for this phase:** <vendor> must support only <codes>. <Reserved codes> are for a later phase.

## Flow

```
<UseCase> ──<ABC111>──► <vendor>          (attempt opened, timeout timer registered, <n> min)
<vendor> ──<VND001>──► <UseCase>          check → record → next step
<vendor> ──<VND002>──► <UseCase>          failed → human task
timer fires, attempt still open ──► <UseCase> → failed (timeout)
```

## Rules

| Rule | Detail | Requirements |
| --- | --- | --- |
| Ordering | <one request per <entity> at a time, or parallel> | <FR> |
| First answer wins | Accept an answer only when its attempt id is open; drop any other | <FR> |
| Schema check | <what we check: shape, types; not values> | <FR> |
| Timeout | `<VAR>` = <n> min | <FR> |
| What the vendor reads | <order fields inline in the payload; the vendor never calls back into our API> | <FR> |
| Outage | <topic retention; answers after recovery follow "first answer wins"> | <NFR> |

## Adding later (<reserved code>)

1. <Vendor> may start to send it at any time; <service> drops codes it does not act on.
2. <service> adds a handler that <does what>, without changing the state or the attempt.

## Files and how to change them

| File | Role |
| --- | --- |
| `_catalog.json`, `<SCH_00x>.schema.json` | **Source** |
| `<CODE>.*`, `<code>-<slug>.md` | **Generated**: `python3 tools/render_events.py 05-<vendor>-integration` |
| `asyncapi.yml` | Protocol file; payloads point to the generated schemas |
