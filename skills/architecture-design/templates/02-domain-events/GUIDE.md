# Guide — 02-domain-events

Level: Medium. Sample: `ORD101 Order Placed`, `ORD103 Payment Failed`, payload `ORD_001`.

## _catalog.json — Event source

**Purpose.** The one source for every event: identity, meaning, producer, consumers, examples, errors.

**Rules (must).**
- One entry per code. Required keys: `code`, `slug`, `name`, `entity`, `schema`, `topic`, `key`, `producer`, `when`,
  `raisedBy`, `consumers`, `requirements`, `examples`.
- `when` is one sentence naming the state after the event.
- `consumers` names who acts and what they do. "Nobody yet" is a valid answer; write it.
- Examples are full envelopes, consistent with the data-model examples (same ids).
- `dataRequired` lists payload fields that are optional in the shared schema but required for this code.
- One producer per code. A status event is a fact the owner publishes after its own transition. Another system's
  decision ("please escalate", "please close") is a request with its own code; the owner answers with the fact.

**How to fill.**
1. One entry per event in the canon catalog. Copy the user's event-sheet codes when they exist.
2. Pick the payload schema: reuse one when two events carry the same shape.
3. Add one example per variant a consumer must handle (success, failed, other producer).

**Best practices.**
- Events are facts in past tense ("Order Placed"). A request to another service is a different code, not a fact.
- Carry what a consumer needs to act without calling back; not the whole entity by default.
- Key by the id whose events must stay in order.

**Check.** `render_events.py` runs; `validate_json.py` passes; a negative test (remove a `dataRequired` field) fails.

## _envelope.schema.json — Envelope

**Purpose.** The common header of every message, written once.

**Rules (must).** Copy the organization's registry envelope exactly when one exists. Top level stays open (no
`additionalProperties: false`) so a consumer can ignore fields another tool adds.

## <SCH_00x>.schema.json — Payload schema

**Purpose.** The `data` shape shared by one or more events.

**Rules (must).** `description` says what it carries and what it leaves out. `additionalProperties: false`.
Relative `$ref` to `../06-data-modeling/_common.schema.json`. A field used by every code is `required`.

**Best practices.** Name payload ids by entity and number (`ORD_001`). A status-change payload carries the id, the
owner, the transition, and only what consumers need.

## <code>-<slug>.md, <CODE>.schema.json, <CODE>.examples.json — Generated

**Purpose.** The readable doc (header, attributes with level columns, key, errors, example) and the machine files.

**Rules (must).** Never edit by hand. Change the catalog or a payload schema, then run the generator.

**Check.** Each md has a header table, attributes, message key, and at least one example.

## README.md — Event index

**Rules (must).** One row per code with producer, consumers, schema id, doc link. State the loop guard when a
consumer also publishes to the same topic. State which files are source and which are generated.
