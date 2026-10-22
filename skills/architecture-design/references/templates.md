# Templates — index

Every document of the package has its own template file under [`../templates/`](../templates/), in the same folder
layout as the package. Every folder has a `GUIDE.md` with one section per document: **Purpose, Rules (must), How to
fill, Best practices, Check**. Read the folder's `GUIDE.md` before you fill a template in it.

- **Markdown templates** use `<placeholder>` slots. Replace each one; delete rows you do not need.
- **Machine files** (JSON Schema, examples, proto, OpenAPI, AsyncAPI, PlantUML, workflow JSON) are filled with one small
  sample system, `order-service`, so every validator runs on them. Copy the file, then replace the sample names.
- REQUIRED parts are listed under "Rules (must)" in each guide. The rest is the adaptable 30% (SKILL.md).

## Package layout

```
designs/
├── README.md                 # canon — REQUIRED at every level
├── 00-c4/                    # High: context + container views
├── 01-project-structure/     # Medium: tree, modules, shared domain, error codes, configuration
├── 02-domain-events/         # Medium: one file per event + catalog + schemas
├── 03-ingress-api/           # High: what the system serves or consumes (+ protocol files)
├── 04-egress-api/            # High: what the system calls or produces (+ protocol files)
├── 05-<vendor>-integration/  # High: one folder per two-way vendor exchange (request + answers)
├── 06-data-modeling/         # High: ERD + state diagram + per collection/table shape, schema, example
├── 07-sequences/             # Low: one sequence per workflow (Medium: the overview only)
├── 08-class-diagrams/        # Low: one per module + shared domain
├── 09-data-pipeline/         # Medium: one hand SVG of the unit of work
├── 10-<engine>-workflow/     # when an external workflow engine takes part
└── tools/                    # generators and validators for this package
```

## Files

| Folder | Template files | Guide |
| --- | --- | --- |
| root | `README.md` (canon) | [`GUIDE.md`](../templates/GUIDE.md) |
| `00-c4/` | `README.md`, `context.puml`, `container.puml` | [`GUIDE.md`](../templates/00-c4/GUIDE.md) |
| `01-project-structure/` | `README.md`, `modules.md`, `shared-domain.md`, `error-codes.md`, `configuration.md` | [`GUIDE.md`](../templates/01-project-structure/GUIDE.md) |
| `02-domain-events/` | `README.md`, `_catalog.json`, `_envelope.schema.json`, `ORD_001.schema.json`; generated: `ORD1xx.schema.json`, `ORD1xx.examples.json`, `ord1xx-<slug>.md` | [`GUIDE.md`](../templates/02-domain-events/GUIDE.md) |
| `03-ingress-api/` | `README.md`, `asyncapi.yml`, `grpc/order.proto`, `grpc/place-order.md`, `rest/openapi.yml`, `rest/get-order.md`, `kafka/payment-settled.{md,schema.json,examples.json}`, `pubsub/subscription.md` | [`GUIDE.md`](../templates/03-ingress-api/GUIDE.md) |
| `04-egress-api/` | `README.md`, `asyncapi.yml`, `rest/openapi.yml`, `rest/charge-payment.md`, `grpc/crm-customer.proto`, `grpc/crm-get-customer.md`, `kafka/order-notification-requested.{md,schema.json,examples.json}`, `sql/order-history-lookup.md` | [`GUIDE.md`](../templates/04-egress-api/GUIDE.md) |
| `05-vendor-integration/` | `README.md`, `_catalog.json`, `FRD_001.schema.json`, `FRD_002.schema.json`, `asyncapi.yml`; generated: `ORD111.*`, `FRD00x.*`, `*.md` | [`GUIDE.md`](../templates/05-vendor-integration/GUIDE.md) |
| `06-data-modeling/` | `README.md`, `_common.schema.json`, `orders.jsonc`, `orders.schema.json`, `orders.example.json`, `erd.puml`, `entity-states.puml` | [`GUIDE.md`](../templates/06-data-modeling/GUIDE.md) |
| `07-sequences/` | `README.md`, `_style.iuml`, `00-overview.puml`, `01-place-order.puml` | [`GUIDE.md`](../templates/07-sequences/GUIDE.md) |
| `08-class-diagrams/` | `README.md`, `_style.iuml`, `_legend.iuml`, `01-order-intake.puml` | [`GUIDE.md`](../templates/08-class-diagrams/GUIDE.md) |
| `09-data-pipeline/` | `README.md`; generated: `pipeline.svg` | [`GUIDE.md`](../templates/09-data-pipeline/GUIDE.md) |
| `10-engine-workflow/` | `README.md`, `event-handlers.json`, `order_review.workflow.json`, `workflow.puml` | [`GUIDE.md`](../templates/10-engine-workflow/GUIDE.md) |
| `tools/` | `README.md`, `render_events.py`, `render_pipeline.py` | [`GUIDE.md`](../templates/tools/GUIDE.md) |

`.svg` files next to the `.puml` templates are rendered samples, so you can see the result.

## Start a package from the templates

```sh
cp -R <skill>/templates <target>/designs
cd <target>/designs
# delete the folders the chosen level does not need; rename 05-vendor-integration and 10-engine-workflow
# delete every GUIDE.md from the copy after the package is done (they belong to the skill, not the design)
```
