# 06 — Data Modeling

<Database> (<topology; transactions yes/no>). Base shapes: <reference ERD paths>. Diagrams: [`erd.puml`](erd.puml)
([`erd.svg`](erd.svg)), [`entity-states.puml`](entity-states.puml) ([`entity-states.svg`](entity-states.svg)).

Each collection has three files: `<name>.jsonc` (annotated shape), `<name>.schema.json` (JSON Schema 2020-12),
`<name>.example(s).json` (valid example). Shared enums and sub-shapes: [`_common.schema.json`](_common.schema.json).

## Collections

| Collection | One document per | Writer | Files |
| --- | --- | --- | --- |
| `<collection>` | <thing> | `<module or service>` | [jsonc](<collection>.jsonc) · [schema](<collection>.schema.json) · [example](<collection>.example.json) |

## Writers of `<big collection>`

| Part | Writer |
| --- | --- |
| `<field or block>` | `<module or domain service>` |

## Indexes

| Collection | Fields | Kind | Serves |
| --- | --- | --- | --- |
| `<collection>` | `<field>`, `<field>` desc | unique, compound, text, TTL | <API or query that needs it> |

## Derived values (not stored)

| Value | Computed from | Where |
| --- | --- | --- |
| <display status> | `<status>` + `<block>` | <presenter, export> |

## Delta vs reference

| Change | Why |
| --- | --- |
| Added `<field>` | <requirement id> |
| Removed `<field>` | <derived from X / no reader> |

## Render and check

```sh
plantuml -tsvg -failfast2 *.puml
python3 <skill>/scripts/validate_json.py . ..
```
