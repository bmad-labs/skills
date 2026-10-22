# Guide — 00-c4

Level: High. Templates: [`README.md`](README.md), [`context.puml`](context.puml), [`container.puml`](container.puml).

## context.puml — System context

**Purpose.** Who uses the system and which external systems it talks to. One picture for a non-engineer.

**Rules (must).**
- One system in the middle. People and external systems around it.
- Every box: name, type, one-line responsibility. Every arrow: intent + protocol.
- Request direction only. No return arrows.

**How to fill.**
1. List the users (roles, not people) from the intent document.
2. List every external system from the upstream architecture and the C4 images the user gave.
3. One `Rel` per interaction; the intent is a verb phrase ("Requests payment").

**Best practices.**
- ≤ 9 boxes. Merge minor externals into one box when they share a purpose.
- Use hand SVG when the model is frontier-class and the layout carries meaning (lanes, owners).

**Check.** Renders. Every external system has a row in the README Relations table and a contract in `04-egress-api/`.

## container.puml — Containers

**Purpose.** The deployable units and data stores inside the boundary, and how they connect.

**Rules (must).**
- Only runnable units and data stores are containers. A UI page, a module, or a class is not.
- Every container states its technology. Every arrow states intent + protocol.
- External systems stay outside the `System_Boundary`.

**How to fill.**
1. One container per service, BFF, worker process, database, topic.
2. Draw only the arrows that cross a container border.

**Best practices.**
- Show modules inside a service in `01-project-structure/`, not here.
- Name topics by their role ("Domain events"); the exact topic name is in the canon.

**Check.** Renders. ≤ 9 boxes inside the boundary. Each arrow has a row in the README.

## README.md — C4 index

**Purpose.** List the views and give each relation its contract link.

**Rules (must).** One Relations row per arrow in the diagrams, each with a link to its contract doc.

**Check.** No arrow without a row; no row without a contract link.
