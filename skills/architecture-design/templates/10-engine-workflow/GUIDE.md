# Guide — 10-<engine>-workflow

Use when an external workflow engine (Orkes, Temporal, Camunda) takes part and another team owns it.

## README.md — Exchange contract

**Purpose.** The single source for which event starts, completes, or closes which workflow and task.

**Rules (must).**
- Check the engine's current docs (skill `context7-mcp`) before writing any definition. Write the check date.
- Two tables: events the engine consumes, and requests the engine publishes, each with what the other side does.
- Loop guard stated both ways. Facts and requests have different codes.
- Correlation and idempotency keys named.
- Every value the owning team must provide is `[ASSUMPTION]` until they confirm it.

**Best practices.**
- The service stores no workflow id when the engine can find runs by correlation id.
- A human task opens on the service's fact, not on the engine's own request, so a dropped request opens no task.

## <workflow>.workflow.json, event-handlers.json — Definitions

**Rules (must).** In the engine's own format, valid JSON. Task reference names match the README. No business rule
that the service also applies; the engine routes, the service decides.

**Check.** Parses as JSON; each task type exists in the engine docs; every event code is in the canon.

## workflow.puml — Activity diagram

**Rules (must).** One activity per task, `if` for each switch, title names the trigger and the correlation id.

**Check.** Renders.
