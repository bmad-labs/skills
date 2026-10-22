# Guide — 03-ingress-api

Level: High. Everything the service **serves or consumes**: gRPC, REST, Kafka, Pub/Sub. Sample: `order.v1`.

## Every API doc (gRPC method, REST endpoint, consumed topic, subscription)

**Rules (must).**
- Four parts in order: header table, attributes, errors, example. Copy the user's API sheet columns when one exists.
- Nested fields: one column per nesting level. Never `└`.
- Failed response: `status`, `code`, `message` only. Success: the same + `data`.
- Every error code exists in `01-project-structure/error-codes.md`.
- The md and the protocol file agree field for field.
- Header names the handler: controller → use case.

**How to fill.**
1. One doc per method, endpoint, or consumed message in the canon.
2. Request fields from the screen or caller needs; response fields from what the caller shows.
3. Errors: every refusal of the use case, in the order it checks them.
4. Examples with the same ids as the data-model examples.

**Best practices.**
- One mutation per user action. Take the version the user read (`<entity>Version`) for optimistic concurrency.
- Name methods verb + noun (`PlaceOrder`). Group them in the README.
- Put the scope rule once, in the README "Identity and response shape".

## grpc/<service>.proto — gRPC protocol file

**Rules (must).** Package `<name>.v1`. One comment per rpc with its requirement ids. Response wrapper with
`status`, `code`, `message`, `optional data`. Field names `snake_case`; JSON on the wire becomes camelCase.

**Best practices.** Past ~5 methods, keep a `_api.yml` source and generate the proto, the method docs, and a
messages schema with a script. Change the source, not the outputs.

**Check.** `protoc --proto_path=grpc --descriptor_set_out=/dev/null grpc/<service>.proto`.

## rest/openapi.yml — REST protocol file

**Rules (must).** OpenAPI 3.1. `operationId` per operation. One example per response. `license` and `security` set.
Quote any string value that holds a comma inside a flow value.

**Check.** `npx -y @redocly/cli lint rest/openapi.yml`.

## kafka/<name>.md + .schema.json + .examples.json — Consumed message

**Rules (must).** Header states topic, code, key, producer, consumer group, and "acts only on" (loop guard). Routing
table: condition → use case → state guard. Errors table covers schema fail, unknown code, repeat, infrastructure down.

**Best practices.** Make every handler idempotent by a named key. A message for a state that has moved on is logged and
dropped, not an error.

**Check.** Examples valid; a negative test (wrong `source.service`) fails.

## pubsub/<name>.md — Pub/Sub subscription

**Rules (must).** State delivery mode, ack rule, flow control, dedupe key. A notification that only says "something
changed" names the fetch that follows it.

## asyncapi.yml — Consumed channels

**Rules (must).** AsyncAPI 3.x. One channel per topic, one `receive` operation per handler, payloads `$ref` the JSON
Schemas. Message key as a Kafka binding trait.

**Check.** `npx -y @asyncapi/cli validate asyncapi.yml`.

## README.md — Ingress index

**Rules (must).** Identity and response shape once. One row per method, endpoint, and consumed topic, with use case
and doc link.
