# 02 — Domain Events

Every event is published to `<topic>` with key `<key field>` and the envelope
[`_envelope.schema.json`](_envelope.schema.json). Consumers ignore codes and top-level fields they do not know.

| Code | Name | Producer | Consumers | Schema id | Doc |
| --- | --- | --- | --- | --- | --- |
| `<ABC101>` | <Name> | `<service>` | <who acts> | `<SCH_001>` | [<abc101>](<abc101-slug>.md) |

## Payload schemas

| Schema id | Shape | Used by |
| --- | --- | --- |
| `<SCH_001>` | <what it carries, what it leaves out> | `<ABC101>`, `<ABC103>` |

## Loop guard

<Which `source.service` values each consumer acts on, when a consumer also publishes to the same topic.>

## Files and how to change them

| File | Role |
| --- | --- |
| `_catalog.json` | **Source**: codes, names, when, consumers, examples, errors |
| `_envelope.schema.json`, `<SCH_00x>.schema.json` | **Source**: envelope and payload schemas |
| `<CODE>.schema.json`, `<CODE>.examples.json`, `<code>-<slug>.md` | **Generated**: `python3 tools/render_events.py 02-domain-events` |
