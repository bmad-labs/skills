# AI-Collaboration Protocol

The conventions that make generated code AI-tweakable from human feedback. The #1 pain in these builds is that the user struggles to say *what* to change and it takes many round-trips per point. This protocol fixes that: every UI element and 3D object self-identifies with a stable, human-readable id, the code reads like natural language, and the edit-mode overlay emits feedback Claude can resolve mechanically.

## Table of contents
- [Why this exists](#why)
- [Rule 1 — everything self-identifies with a stable id](#rule-1-ids)
- [Rule 2 — flat, named, reads-like-language code](#rule-2-structure)
- [Naming conventions](#naming)
- [The edit-mode overlay contract (the feedback format)](#edit-mode-contract)
- [How feedback maps to code](#feedback-to-code)
- [Guidance for Claude receiving feedback](#guidance)

---

## Why

Without this, feedback is "make the tower thing on the left a bit smaller and the box under it less bright" → Claude guesses which object, edits, the user re-describes, repeat for 30 rounds. With this, the user clicks the object in edit mode, the overlay emits `{ targetIds: ["scene.service-core"], comment: "smaller" }`, Claude resolves the id to the exact builder function and edits once. **The id is the shared vocabulary between human, overlay, and code.** Every element must carry one.

---

## Rule 1 — IDs

**Every UI component and every 3D object self-identifies with a stable, human-readable id.**

**This includes every text element.** Edit-mode only makes a node selectable if it carries
its own `data-viz-id` — so an untagged heading or paragraph can't be pointed at; hovering it
just selects the nearest tagged ancestor (the whole card/section). The rule is therefore:
**tag every meaningful text-bearing element** — headings, paragraphs, labels, list items, nav
links, eyebrows, captions, the footer line, header text, badges/numbers — not just the
containers. A container keeps its own id too, so you can still grab the whole card by its edge.
Give the text a dotted id under its container (`beat.postgres.title`, `beat.postgres.body`,
`card.audit.title`, `footer.copyright`, `nav.link.how`).

DOM elements — `data-viz-id`:
```html
<header data-viz-id="nav">
  <span data-viz-id="nav.brand">◆ Acme</span>
  <a data-viz-id="nav.link.how">How it works</a>     <!-- nav text tagged -->
</header>
<article class="card" data-viz-id="card.audit">       <!-- container tagged -->
  <h3 data-viz-id="card.audit.title">Free audit trail</h3>   <!-- AND its text -->
  <p  data-viz-id="card.audit.body">Every change is an event…</p>
</article>
<footer data-viz-id="footer.copyright">© Acme 2026</footer>   <!-- footer text tagged -->
```
A quick way to verify nothing was missed: scan for text-bearing leaves lacking an id (a
`document.querySelectorAll('body *')` pass over elements that have direct text but no own
`data-viz-id`) — see the demo's `text-audit.mjs` for the exact check.

3D objects — `userData.vizId`:
```js
const tower = P.tower(0, 0, 6, 14, 6);
tower.userData.vizId = 'scene.service-core';

const field = P.crateField(-38, 12, 4, 3, 2);
field.userData.vizId = 'scene.queue-depth';
```

Requirements for ids:
- **Stable** — don't renumber or rename on edits; the id outlives layout changes. If you must rename, rename everywhere at once.
- **Human-readable & meaningful** — `scene.service-core`, not `mesh_7`. Name by *what it represents in the system*, honoring the world metaphor (the tower *is* the core service).
- **Namespaced, dot-separated** — `section.element[.subelement]`. Top-level namespaces: `hero`, `scene` (3D world), `architecture`/`map`, `overlay`, `erd`, `pipeline`, `nav`, `modal`.
- **Unique** across the page. Instanced repeats use an index suffix only if individually addressable (`scene.crate.12`); otherwise the group carries one id (`scene.crate-field`).
- **Set at creation**, in the builder function, right where the object is made — never bolted on later.

A central **registry** maps id → object for fast lookup and for the edit-mode overlay to enumerate:
```js
export const vizRegistry = new Map();   // id -> { node?, object3D?, builder, file }
export function register(id, ref) { vizRegistry.set(id, ref); return ref.node ?? ref.object3D; }
```

---

## Rule 2 — structure

**Flat, named, reads-like-natural-language code.** When the user says "the crate field," there should be a function literally named for it.

- **Small named builder functions, one per object.** `buildServiceCore()`, `buildCrateField()`, `buildRequestRoute()`. The function name *is* the id in code form. No anonymous 200-line setup blobs.
- **A central registry / scene-assembly function** that calls the builders in order — a readable table of contents of the scene:
  ```js
  function assembleScene() {
    buildGround();
    buildServiceCore();      // scene.service-core
    buildCrateField();      // scene.queue-depth
    buildRequestRoute();   // scene.request-route
  }
  ```
- **Config objects over deep nesting.** Tunable values live in flat named config, not buried in call sites:
  ```js
  const TOWER = { x: 0, z: 0, w: 6, h: 14, d: 6, color: PALETTE.brand };
  function buildServiceCore() { const m = P.tower(TOWER.x, TOWER.z, TOWER.w, TOWER.h, TOWER.d); m.userData.vizId = 'scene.service-core'; return register('scene.service-core', { object3D: m, builder: 'buildServiceCore', file: 'scene/world.js' }); }
  ```
- **Layout constants named and grouped at the top** of each file — camera beats (`CAM_P`/`CAM_U`), positions, sizes, the scroll distance, palette overrides. The user's tweaks ("hold longer on the database," "move the crate field left") become one-line edits to a named constant, not surgery.
- **One concern per file** matching the assets layout (`scene/`, `scroll/`, `diagrams/`). An id's namespace points at its file.

The test: read the code aloud. If "build service core with config TOWER, register as scene.service-core" reads like a sentence, it's right.

---

## Naming

- ids: `lowercase.dot.separated`, kebab within a segment (`scene.queue-depth`).
- builders: `build<PascalThing>()` matching the id's last segment.
- configs: `UPPER_SNAKE` const named for the thing (`CRATE_FIELD`, `CAM_P`).
- registry keys === the id string, verbatim.
- Keep the *same* human word across id, builder, config, and any copy — if the UI calls it "Data Flow," the lens id is `df`/`overlay.picker.dataflow`, the config is `DATA_FLOW`, the on-class is `on-df`. One name, everywhere.

---

## Edit-mode contract

The **edit-mode overlay** (lives in `assets/edit-mode/`) is the tool the user runs in-browser to point at things and comment, instead of describing them in prose. It reads `data-viz-id` / `userData.vizId` off the page, lets the user click/marquee elements and type a note, and **emits a JSON batch** that Claude consumes. Claude's job is to (a) know this format and (b) resolve ids → file/function and apply the edits.

The user picks with one of three **tools** (Select / Snip / Brush) in either of two **views**
(Normal reveals ids on hover; Expert shows them all) — and this works for DOM, SVG, *and* 3D
objects alike. Each pick becomes a comment; the batch is exported as markdown ("Copy for AI") or
JSON ("Download"). The JSON schema (`architecture-viz/edit-feedback@2`):
```jsonc
{
  "schema": "architecture-viz/edit-feedback@2",
  "page": "/index.html",
  "capturedAt": "2026-06-13T…",
  "comments": [
    {
      "kind": "component",                         // component | object | area | brush
      "targetIds": ["scene.service-core"],           // for component/object: what was clicked
      "relatedIds": [],                            // for area/brush: the ids inside the region
      "rect": null,                                // for area/brush: the snipped/painted region
      "comment": "make this smaller and less saturated",
      "hasScreenshot": false,                      // a snip-N.png is attached if true
      "source": {                                  // present iff a viz-manifest was loaded
        "scene.service-core": { "file": "scene/world.js", "line": 74, "builderFn": "buildServiceCore" }
      },
      "sceneContext": {                            // the scene moment the comment was made at
        "scrollY": 1800, "scrollProgress": 0.50,   // where on the page the user was
        "timelineProgress": 0.497,                 // GSAP master timeline progress (window.__tl)
        "timelineTime": 1.49,
        "camera": { "position": [2, 13.8, 35.7], "rotation": [-0.3, 0.43, 0.13] }
      }
    },
    {
      "kind": "area",
      "targetIds": [],
      "relatedIds": ["arch.node.ledger", "arch.node.fraud"],
      "rect": { "left": 440, "top": 150, "width": 320, "height": 90 },
      "comment": "these two are too close, add breathing room",
      "hasScreenshot": true
    }
  ]
}
```

Field contract:
- **`kind`** — how it was picked: `component` (clicked a `data-viz-id`), `object` (clicked a 3D
  object → its `userData.vizId`), `area` (snipped a rectangle), `brush` (painted a freehand region).
- **`targetIds[]`** — for component/object, the id(s) clicked. For area/brush this is empty and the
  ids live in `relatedIds`.
- **`relatedIds[]`** — for area/brush, the tagged components (DOM, SVG, and projected 3D objects)
  that fall inside the region. Auto-detected via rect overlap / point-in-path.
- **`rect`** — for area/brush, the region in viewport coords (for reproducing the view).
- **`comment`** — the user's free-text instruction.
- **`hasScreenshot`** — true if a `snip-N.png` crop is attached (download mode).
- **`source`** — present only when a `viz-manifest.json` was generated and loaded as
  `window.__VIZ_MANIFEST`; maps each id to `{file, line, builderFn?, cssRule?}` so you jump
  straight to code. The markdown export inlines the same hint as `_id → file:line (builderFn)_`.
- **`sceneContext`** — the scene moment the comment was captured at, so you can **reproduce exactly
  what the user saw** before fixing. Especially load-bearing for `object` (3D) comments: `scrollY` /
  `scrollProgress` (where on the page), `timelineProgress` (the GSAP master timeline's progress 0..1,
  present if the page exposed it as `window.__tl` — this is the precise "scene position in the
  timeline" / camera beat), `timelineTime`, and the serialized `camera` pose. To debug a 3D comment:
  scroll to `scrollY` or set `__tl.progress(timelineProgress)`, and you're looking at the same frame
  the user commented on. The markdown export inlines this as `_scene moment: scroll … · timeline … ·
  camera […]_`. **For this to populate, expose your master GSAP timeline as `window.__tl`** (you
  already do this for verify.mjs's frame-pinning — same hook).

The overlay harvests ids from the live DOM/scene, so they're always valid — never guess *which*
element, only *how* to change it.

---

## Feedback to code

Given a batch item, Claude resolves each of its ids (`targetIds` for component/object,
`relatedIds` for area/brush) deterministically:

1. **id → source.** If the item carries a `source` map (a `viz-manifest.json` was loaded), read it
   directly: `{file, line, builderFn, cssRule}`. Otherwise generate it once with
   `node scripts/gen-viz-manifest.mjs <pageDir>`, or query the live page with
   `window.__viz.find("scene.service-core")` (returns kind, on-screen rect, and source). As a last
   resort grep the id string: `data-viz-id="…"` / `userData.vizId === '…'` / `registerVizObject(…, '…')`.
2. **builder → config** → the named const it reads (`TOWER`/`CRATE_FIELD`). Most tweaks are one-line config edits.
3. **Apply.** "smaller" → reduce `TOWER.h`/`.w`. "less saturated" → shift `TOWER.color` toward neutral. "default lens" → set initial `data-ov`. "hold longer on the database" → widen that interval in `CAM_P`. For an **area/brush** item, the work is usually *between* the `relatedIds` ("these two are too close" → space `arch.node.ledger` and `arch.node.fraud`).

Because the id is in the markup *and* the `userData` *and* the manifest *and* the builder name, every path from feedback to source is one hop. For **3D objects the manifest is the only bridge** — they have no DOM node to grep — so generate it whenever the page has a Three.js scene.

---

## Guidance

When Claude receives an edit-mode batch:

- **Trust `targetIds`.** They're harvested from the live page — don't second-guess which element; resolve and edit it.
- **Process the batch as discrete edits**, one item at a time; group edits to the same file. Report back per `targetId` so the user can confirm each.
- **Prefer config-const edits over rewriting builders.** A named-constant tweak is the smallest, safest change and keeps the code tweakable next round.
- **Use `relatedIds` + `areaScreenshot`** only to disambiguate relative instructions ("above", "match", "overlaps"); the target is still `targetIds`.
- **Honor restraint** (styling-and-anti-slop.md) even when a comment pushes toward decoration — if "make it pop" would add a third color, fix hierarchy/spacing instead and say so.
- **Keep ids stable** through the edit. If a change genuinely renames a thing, update id + builder + config + copy together and note the rename so future feedback still resolves.
- **When generating new elements**, assign a `vizId`/`data-viz-id`, register it, and add a named builder + config immediately — so the *next* round of feedback is already addressable. The protocol only works if every new thing is born self-identifying.
