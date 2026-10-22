# Guide — 06-data-modeling

Level: High (ERD + shapes). Medium adds `entity-states.puml`. Sample: `orders`.

## <collection>.jsonc — Annotated shape

**Purpose.** The shape a reader understands at a glance: a realistic value and a reason for every field.

**Rules (must).**
- Header comment: one document per what, writers, concurrency rule.
- Every field has a realistic value and a `//` comment: meaning, requirement id, or writer.
- Fields not in the user's reference are marked `NEW`.
- A value that can be derived is not stored. Say where it is derived in a closing comment.
- A value a hot list, count, or filter would need a join to derive is stored as a projection. Name its one writer
  and say that it is written in the same transaction as its source; the source stays the truth.
- Every field has a reader (an API, query, rule, or export). No field "for later".

**How to fill.**
1. Start from the user's reference ERD; keep its names and nesting.
2. Add only what a requirement or an API needs; mark each `NEW`.
3. Group where-it-came-from fields in `metadata`.

**Best practices.**
- Name the one writer of each block. One fact lives in one place; others hold its id.
- Prefer one enum field over several booleans.

**Check.** Parses as JSONC (`validate_json.py`). Every field appears in the schema.

## <collection>.schema.json — JSON Schema

**Purpose.** The machine contract of the document; tools and tests use it.

**Rules (must).**
- Draft 2020-12, `additionalProperties: false` at every object level.
- Shared enums and sub-shapes by relative `$ref` to `_common.schema.json`; never a bare name.
- `required` lists what the producer can always supply; optional fields are absent, not `null`, unless `null` has a
  meaning.
- When the source can omit a field (a customer may not give it), the field is optional here, even when the
  business calls it mandatory. The rule that needs it (a score, a submit check) handles the absence.

**Check (add).** A positive test: a document without each business-mandatory field that the source can omit still
validates.

**How to fill.** Translate the `.jsonc` one field at a time; move any enum used twice into `_common.schema.json`.

**Best practices.** Add `minItems`, `minimum`, `pattern` only where a rule states it.

**Check.** The example validates. One negative test: remove a required field; the validator must fail.

## <collection>.example(s).json — Example

**Purpose.** A valid, realistic document; also the fixture for tests.

**Rules (must).** Plain JSON (no `$oid`/`$date` wrappers). Valid against the schema. Values consistent with the
other folders' examples (same ids, same names).

**Best practices.** Use `.examples.json` (an array) when states differ enough to need one example each.

## _common.schema.json — Shared definitions

**Purpose.** Enums and sub-shapes used by more than one collection, event, or API.

**Rules (must).** One `$defs` entry per enum or shape. Each enum has a description naming its only writer when it is a
state. Wire values equal the code enum values.

## erd.puml — ERD

**Purpose.** Collections and how they relate.

**Rules (must).** Key fields and relation fields only; the full shape stays in the `.jsonc`. Mark `<<PK>>`, `<<FK>>`.
Cardinality on each relation. External data sources shown and marked read-only. No `{}` inside an entity body.

**Check.** Renders.

## entity-states.puml — State design

**Purpose.** Every state of the main entity and every legal transition.

**Rules (must).** `[*]` start and end. Every transition labelled with its trigger and event code. The one source
of the transitions is a single table (canon or architecture spine); this diagram is a picture of it and never adds
or drops an edge. No other file repeats the table; they link to it. One component writes the state.

**Check.** Renders. A script lists the diagram's edges and the table's rows; the diff is empty.

## README.md — Collections index

**Rules (must).** Tables: collections (one per, writer, files), writers per block of a big document, indexes (each
serves a named query), derived values, delta vs reference.

**Check.** Every query in `03-ingress-api/` is served by an index row.
