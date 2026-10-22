# Guide — 04-egress-api

Level: High. Everything the service **calls or produces**: REST, gRPC, Kafka, SQL. Sample: payment gateway, CRM,
notification topic, history database.

## Every call doc

**Rules (must).**
- Header, request with a **"Source in <service>"** column, response fields we **read**, answer handling, example.
- Answer handling covers success, each error class, and timeout. Each row says what we record and what the user sees.
- The idempotency key is named for every call that changes state at the target.
- For an API we do not own, document only what we send and read, and link the owner's reference.
- A method that does not exist yet is marked **PROPOSED**, with a DQ item for its owner.
- Every assumption about the target is `[ASSUMPTION]` + DQ item.

**How to fill.**
1. From the field mapping the user gave (or the requirements), one row per target field with its source and rule.
2. From the target's spec, the answers and error bodies.
3. Decide each answer's handling with the user when the requirements do not say.

**Best practices.**
- Call the API directly from the use case or handler; add a worker, queue, or outbox only when a requirement needs it.
- Record each answer at once, so a retry sends only what failed.
- Keep caching in the service that owns the data, not in the caller.

## rest/<name>.md + rest/openapi.yml — REST call

**Rules (must).** openapi subset: only the paths, fields, and answers we use. Idempotency header or key stated.

**Check.** `npx -y @redocly/cli lint rest/openapi.yml`.

## grpc/<name>.md + grpc/<owner>.proto — gRPC call

**Rules (must).** Proto excerpt names its owner and source path. Proposed methods carry a `PROPOSED` comment.

**Check.** `protoc --proto_path=grpc --descriptor_set_out=/dev/null grpc/<owner>.proto`.

## kafka/<name>.md + .schema.json + .examples.json — Produced message

**Rules (must).** Header names topic, key, consumer, and delivery guarantee (and what happens on loss). Domain
events are not repeated here: link `02-domain-events/`.

**Check.** Examples valid; negative test fails.

## sql/<name>.md — Query on a database we do not own

**Rules (must).** Read-only role. One block per query: SQL, parameters with sources, columns read with use, index
used. Every column checked against the owner's DDL. Scope filter present when data belongs to many owners.

**Check.** Parse each query with `sqlglot` (dialect of the engine); compare columns with the DDL.

## asyncapi.yml — Produced channels

**Rules (must).** One `send` operation per producer; payloads `$ref` the event or payload schemas.

**Check.** `npx -y @asyncapi/cli validate asyncapi.yml`.

## README.md — Egress index

**Rules (must).** One row per target operation with its port and caller. Failure rules per target. Open items for
each target owner.
