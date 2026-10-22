# Guide — 01-project-structure

Level: Medium. Follow the target stack's architecture guide (for example your team's Clean Architecture guide) before this.

## README.md — Source tree and module map

**Purpose.** Show where every kind of code lives, and which modules exist.

**Rules (must).**
- Tree to folder level only. One comment per folder. No file bodies.
- State the dependency direction in one line.
- Each module is `business` or `adapter`. An adapter (vendor SDK, Pub/Sub, mail provider) is its own module, never in `shared/`.

**How to fill.** Start from the architecture guide's tree; add one folder per module from the upstream design.

**Best practices.** Name modules after the pipeline step they own (`order-intake`), not the technology.

**Check.** Every module in the tree has a row in the module map and a section in `modules.md`.

## modules.md — One section per module

**Purpose.** What each module owns: entries, use cases, commands, events, writes.

**Rules (must).**
- A command is owned by the module that **handles** it. The sender only imports it.
- A use case is called only by a controller or a command handler; never by another use case.
- A shared step with side effects is a command; a pure check is a rule.
- Every collection part has exactly one writing module.
- Every "After commit" step in a "Does" cell ends with "If lost:" and the thing that re-runs it when the process
  dies first (Kafka redelivery with the offset committed last, a re-drive timer, an idempotent re-check).
- Every use case that frees a shared slot or lock sends the next step itself, after its commit. The freeing call
  returns what to send.

**How to fill.**
1. One section per module from the README map.
2. Use cases from the requirements, one per user or system action.
3. Commands: for each cross-module call, add a row under the owner and under the sender.

**Best practices.** One sentence per "Does". Return types are named models, never entities.

**Check.** Every command appears once under "owned" and at least once under "sent". No use case calls a use case.

## shared-domain.md — Entities, ports, services, rules, events, enums

**Purpose.** The framework-free core every module shares.

**Rules (must).**
- No framework, ORM, or SDK import in this layer.
- Ports list signatures only. Domain services never load or save.
- Each state-holding field names its only writer.

**How to fill.** Entities from `06-data-modeling/`; ports from every external call in `04-egress-api/`; rules from
requirements that are pure decisions; events from `02-domain-events/`.

**Best practices.** State the call order when several services run in one transaction.

**Check.** Every port has an implementation row. Every event class maps to a code in the canon.

## error-codes.md — Error codes

**Purpose.** Every error the service returns, with its status and message.

**Rules (must).**
- Codes sequential in the agreed range, no gaps, never reused.
- Messages are user-readable sentences. Names are `UPPER_SNAKE`.
- Failed response: `status`, `code`, `message`. No `data`.

**How to fill.** Collect the refusals from every use case and API doc; one row each; list every raiser.

**Best practices.** One code per distinct user action to take ("reload", "go to the latest"), not per internal cause.

**Check.** Every code used in an API doc exists here; every code here is used somewhere.

## configuration.md — Configuration

**Purpose.** Every environment variable and config file, with its default and its reason.

**Rules (must).**
- Secrets typed `secret`, with no default.
- A tuned number states the mechanism and the measurement behind its value.
- Feature flags name the phase or requirement that switches them on.

**How to fill.** Walk every folder: each timeout, limit, topic, URL, flag, and file becomes a row.

**Best practices.** Group by concern. Build topic names from `{env}` defaults instead of one variable per env.

**Check.** Every variable named in another folder exists here.
