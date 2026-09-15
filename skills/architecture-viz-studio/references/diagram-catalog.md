# Diagram Catalog

A catalog of diagram types with the best layout pattern for each situation: when to use, layout strategy, gotchas. Plus universal arrow/edge routing rules and the overlay-lens model.

## Table of contents
- [Universal arrow / edge routing rules](#routing-rules)
- [The overlay-lens model (one map, N lenses)](#overlay-lens)
- [System / architecture map](#system-map)
- [Process pipeline / sequence](#pipeline-sequence)
- [ERD / data model](#erd)
- [Component / class diagram](#component-class)
- [Deployment / topology](#deployment)
- [State machine](#state-machine)
- [The 3D "world" metaphor — when it lands vs gimmicky](#world-metaphor)

---

## Routing rules

These apply to every node-and-edge diagram. Getting them right is most of what separates a clean diagram from spaghetti.

- **Distribute anchors evenly per side.** When N edges leave the same side of a box, space them along that side: **1 edge = center; 2 = ⅓ & ⅔; 3 = ¼, ½, ¾**. Never stack two edges on one point.
- **Route through lane gaps, not over boxes.** Lay out so edges travel in the empty channels between rows/columns. If an edge must cross the diagram, route it in a gutter lane.
- **Never cross a table/box** with an unrelated edge. Re-route around it or move the box. A line passing *through* an unrelated node reads as a false connection.
- **Connect lines to the glyph base, not the box edge.** Terminate the line at the foot of the crow's-foot / center of the cardinality bar (the glyph's base point), so there's no gap or overshoot where line meets notation.
- **Spread exit points along an edge** when one node fans to many (a hub). Sort the children by target center-position and spread the exit Y's along the hub's edge so feet don't pile on one point.
- **Label follows arrow direction.** Place the edge label at the curve's midpoint, rotated to the local tangent (analytic bezier tangent, clamped ±90° so text stays upright). Reading order matches flow direction.
- **Cardinality at endpoints, not in labels.** Put `1`/`N`/crow's-foot *at the line ends near each table*, not baked into a verb label in the middle. The middle is for the relationship verb ("places", "owns").
- **Left-to-right or top-to-bottom, pick one primary axis** per diagram and keep flow consistent; don't make the eye reverse direction.

---

## Overlay-lens

**The most effective interaction pattern in the skill.** Instead of N separate diagrams (or one diagram crammed with every concern), draw **one** static system map and let the user read it through switchable **lenses** (overlays). This was inspired by Oxygen Not Included's overlay system (oxygen/power/plumbing views over one base) — see finding-layout-inspiration.md.

How it works (the dimming convention):
- The section carries `data-ov="<activeLensId>"`. JS only ever flips this one attribute.
- Every SVG node/edge tags the lenses it belongs to with `on-XX` classes; a node can belong to several: `class="node on-df on-ow"`.
- CSS does all the visual work declaratively: dim everything to ~18% by default, light up `.on-XX` for the active lens, color active strokes with `--ov-accent`.

```css
.arch:not([data-ov="sy"]) .node { opacity:.18; }     /* dim by default        */
.arch[data-ov="df"] .node.on-df { opacity:1; }        /* light the active lens  */
```

Lens data shape: `{ id, key, name, accent, desc, bullets[] }` (`id` matches the `on-XX` suffix; `key` = 1..N keyboard shortcut; `accent` colors the active button + highlighted strokes). Provide a button picker, keyboard 1–N, a side panel (name/desc/bullets), and a gentle **one-time** auto-tour.

Good lens sets for architecture: **Systems** (everything at rest), **Data Flow**, **Event Sourcing / async**, **Ownership** (team/boundary), **Reliability** (retries/idempotency), **Access** (authz/visibility). Each lens answers one question without a separate diagram. Why it works: one mental map the user learns once, then re-reads — far less cognitive load than flipping between unrelated diagrams.

---

## System map

**When:** showing how services/modules/teams fit and how requests flow across the whole system. The default "architecture diagram."

**Layout:** **Region lanes** (horizontal bands) for tiers/zones — e.g. Edge / Services / Data, or Client / Gateway / Domain / Infra — with **left-to-right flow** through them. Nest teams/modules as labeled sub-boxes inside their lane. Put shared/source-of-truth stores in a lane below. Use the **overlay-lens** model on top so one map serves many concerns.

**Gotchas:** keep the flow axis consistent (don't make requests zigzag back left). Group by ownership *or* by tier, not both at once (use a lens for the other). Don't draw every call — draw the representative paths; details live in drill-down (a node click opens a component-detail modal). Cap visible nodes (~12–18); beyond that, collapse into sub-systems with drill-down.

---

## Pipeline / sequence

**When:** a request/event travels through ordered stages (ingest → validate → transform → persist → emit), or an actor-to-actor sequence over time.

**Layout:** a **horizontal band** of stages left-to-right (the happy path), with **annotation callouts dropping below** each stage (what it does, failure mode, latency). Put the **actor/trigger on top**, the **source-of-truth store on a lane below** the band so writes/reads drop down to it visibly. Time/order = left-to-right. For a true sequence diagram, actors across the top, lifelines down, messages as horizontal arrows in time order.

**Gotchas:** keep stages on one row; callouts go *below* so the pipeline line stays clean and scannable. Don't let return arrows clutter — show them dashed and sparingly. Mark the async/queue hops distinctly (dashed + a queue glyph) from sync calls. Number the steps so copy can reference "step 3."

---

## ERD

**When:** a data model / schema — entities, fields, relationships, cardinality. This is the most line-crossing-prone diagram, so layout matters most here.

**Layout: hub-and-spoke to avoid crossings.** Put the **hub entity alone in the center column**; fan children out to the sides (left and right columns), roughly sorted by relationship. This beats a grid, which forces crossings. Use **crow's-foot notation**; **cardinality at the endpoints** (crow's-foot/bar near each table), **relationship verb at the midpoint**. Tables are stacks: name + tag header, then fields with PK/FK/UQ/embedded markers and types.

**Critical edge details (these make it look hand-drafted):**
- **Connect the line to the glyph base** (`lineEnd` = the foot of the crow's-foot / center of the bar), not the table edge — no gap, no overshoot.
- Build the crow's-foot/bar from the **edge point + a unit direction into the line + its perpendicular** `(-dy, dx)`.
- **Spread exit points** when the hub fans to many children: compute each relation's exit Y along the hub edge, sorted by target center-Y, so feet don't stack.
- **Bezier-tangent verb labels:** label at the cubic's `t=0.5`, rotated to the analytic tangent, clamped ±90° (see gsap-threejs-playbook.md → bezier tangent).

**Gotchas:** never route a relation *through* another table. Keep ≤7±2 entities per view; split large schemas by bounded context. Distinguish source-of-truth tables (e.g. append-only event store) from derived/materialized state and embedded types visually (a `kind` tag). Pan/zoom for big models (the viewport rig) rather than shrinking text.

---

## Component / class

**When:** the internals of one service/module — classes, interfaces, ports/adapters, their dependencies.

**Layout:** dependencies point **downward or rightward** consistently (callers above/left, dependencies below/right). Group by layer (API → domain → infra) in bands. Show interfaces/ports as distinct glyphs from concrete classes; draw realization (dashed, hollow arrow) vs dependency (solid). For ports-and-adapters, put the domain core center, adapters around the rim.

**Gotchas:** don't render every method — show the load-bearing ones; full signatures go in a drill-down detail panel. Keep inheritance arrows pointing one direction (toward the base). Distinguish `uses` from `implements` from `extends` by arrowhead, not color.

---

## Deployment / topology

**When:** where things *run* — nodes, containers, regions, networks, managed services.

**Layout:** nested boundary boxes for the runtime hierarchy: **Region › VPC/Cluster › Node/Pod › Process**. Place the network edge (LB/gateway) at the top boundary; data stores at the bottom. Replicas as stacked/instanced glyphs. Annotate edges with protocol + port. Keep environments (prod/stage) as separate framed columns if shown together.

**Gotchas:** don't conflate logical architecture with physical deployment — this diagram is about *runtime placement*, not call flow (use the system map for that). Show trust/network boundaries explicitly (a dashed frame). Managed services (RDS, S3, queues) get a distinct "cloud" glyph so it's clear they're not self-run.

---

## State machine

**When:** an entity's lifecycle — order, subscription, job, connection — through discrete states.

**Layout:** states as rounded nodes, transitions as labeled directed edges (event/guard → action). One clear **initial** state (solid dot) and **terminal** state(s) (ringed dot). Lay out roughly **left-to-right along the dominant lifecycle**, with error/retry transitions looping back below. Keep the happy path a straight spine; exceptions branch off it.

**Gotchas:** label every transition with its trigger — an unlabeled state arrow is meaningless. Avoid a fully-connected mesh; if every state reaches every other, you probably have hidden sub-states. Self-loops (retry) drawn as small arcs on top. Distinguish event-driven from automatic/timeout transitions.

---

## World metaphor

**When the 3D city/landscape metaphor lands:** when the system has a **natural spatial or flow narrative** that maps cleanly — a request *traveling* (a route through a city), ingest→process→store→emit as a physical journey, scale/volume as crowds or crate fields, distinct subsystems as distinct districts/buildings. It lands when the metaphor is **consistent and information-bearing**: the camera flythrough *is* the request's path; the big tower *is* the core service; the crate field *is* the queue depth. The audience remembers the system because they "walked" it.

**When it's gimmicky:** when the mapping is arbitrary or decorative — a generic city that doesn't correspond to anything, objects chosen for looks not meaning, a flythrough that doesn't trace a real path. If you can't answer "what does this building/road/crowd *mean* in the architecture?" for every prominent object, it's a gimmick. Also gimmicky for dense reference diagrams (ERDs, detailed component maps) — those want the flat blueprint, not a 3D scene.

**Rule of thumb:** use the 3D world for the **hero narrative** (the story of how the system works, one request's journey) and the flat blueprint + overlay-lens for the **reference views** (the precise maps people return to). The polished session did exactly this: a cinematic 3D journey up top, a dark interactive blueprint with lenses + drill-down modals below. Map every prominent 3D object to a real component via `userData.vizId` (see ai-collaboration-protocol.md) so the metaphor stays honest and tweakable.
