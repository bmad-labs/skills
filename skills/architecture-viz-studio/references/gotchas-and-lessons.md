# Gotchas & lessons — bugs that bite, and how to not repeat them

Every entry here is a real bug that took a debugging round to find. Read this **before** writing
edit-mode wiring, 3D selection, a render loop, or a verification script — it will save you the same
round-trips. Each lesson: the symptom, the cause, the fix.

## Table of contents
- [Edit-mode / DOM overlay](#edit-mode)
- [3D object selection](#3d-selection)
- [Scene modelling & composition](#modelling)
- [Three.js performance](#perf)
- [Verification scripts (Playwright)](#verify)
- [Tagging conventions](#tagging)

---

<a name="edit-mode"></a>
## Edit-mode / DOM overlay

**SVG elements have no `.hidden` IDL property.** Setting `svgEl.hidden = true` silently sets a
useless expando and does NOT hide the element — so an SVG overlay stays visible. Use
`svgEl.toggleAttribute('hidden', shouldHide)` (the attribute), never the property. (HTML elements
*do* have `.hidden`, so `div.hidden = x` is fine — but see the next lesson.)

**A class that sets `display` overrides the UA `[hidden]{display:none}` rule.** If your panel has
`.em-panel { display: flex }`, the `hidden` *attribute* won't hide it — a class selector beats the
attribute selector in the cascade, so `display:flex` wins and the panel is always shown. Symptom:
"the toolbar/panel always shows, the toggle does nothing." Fix: add an explicit, cascade-winning
reset for every class that sets display:
```css
.em-toolbar[hidden], .em-panel[hidden], .em-overlay[hidden], .em-popup[hidden] { display: none !important; }
```

**`node.contains(x)` throws if `x` isn't a Node.** Global event listeners (`mousemove`/`click` on
`window`) can fire with `e.target === window` or `document`, which aren't Nodes → `root.contains(window)`
throws `TypeError: parameter 1 is not of type 'Node'`. Guard every "is this our own UI?" check:
```js
const inRoot = (n) => !!(root && n && n.nodeType === 1 && root.contains(n));
```

**A full-bleed content layer over the canvas hijacks selection.** Scroll-story pages render DOM
content (hero, sections) *on top of* a `position:fixed` full-viewport 3D canvas. If hover/click
checks `closest('[data-viz-id]')` first and only falls back to 3D when nothing matched, the giant
content section always wins and 3D objects under it become unselectable. Fix: raycast 3D *and* check
DOM together, then prioritise — a concrete 3D hit beats a large background section, but a real **leaf**
(small content like a card/heading) on top still wins:
```js
if (threeId && (!domEl || !isLeafComponent(domEl))) pick3D; else pickDOM;
// isLeafComponent: false if the element covers > ~45% of the viewport (it's a section, not a leaf)
```

**Large container + centered text = highlight far from the cursor.** A full-width `<footer>` (1280px)
with centered text gets a full-width highlight rect and its id badge renders at the rect's top-left
corner — nowhere near where the user is pointing. It looks broken. Fix: wrap the text in its own
tagged inline element (`<span data-viz-id="footer.text">`) so the highlight hugs the text. (This is
the "tag the text, not just the container" rule — see Tagging below.)

**Thin SVG diagram arrows read as "not selectable" — for TWO compounding reasons.** A diagram edge is
a ~2px `<path>`/`<line>` with `fill:none`, and users repeatedly report they can't select arrows.
(a) **Zero-dimension bbox:** a perfectly straight vertical/horizontal edge has `getBoundingClientRect()`
width OR height = 0, so the overlay drew *no* rect for it — no visible highlight, so it looked
unselectable even though the stroke was technically clickable. Fix (already in `collectRects`): don't
drop zero-dimension rects — pad the thin axis to a ~10px minimum (centered on the line) so a highlight
shows. (b) **Hair-thin hit area:** even with a highlight, landing a click on a 2px stroke by hand is
nearly impossible. Fix: give each edge a transparent fat-stroke **hit proxy** and move the
`data-viz-id` onto it — `assets/diagrams/edge-hit-proxies.js` (`tagSvgEdges`) does this generically.
Call it once per SVG (main map + each drill/ERD modal, after render). The proxy is inert until
`body.em-active`, so it never blocks normal clicks/pan-zoom. Both fixes together make arrows feel as
selectable as nodes — and they then participate in multi-select like anything else.

**Selection must be SCOPED to an open modal — and the scope helper must not collide with existing
names.** When a drill/ERD modal is open, the main page sits *behind* an opaque backdrop, so offering
its elements (and the 3D scene) for selection is wrong — the user expects "only what's in the popup,
and the popup itself." Add a scope gate used by **every** selection path (`collectRects`, hover
`onMouseMove`, click `resolveTarget`, snip `componentsInRect`, brush `componentsNearPath`, and the 3D
`addProjected3dInRect`):
```js
const openModal = () => document.querySelector('.drill-modal.open') || null;   // your modal's open class
const inScope  = (n) => { const m = openModal(); return !m || (n && m.contains(n)); };
// in each collector: if (inRoot(n) || !inScope(n)) return;
// suppress 3D entirely while a modal is open: if (... && !openModal()) { each3dViz(...) }
```
⚠️ **Name-collision trap that cost a full debugging round:** edit-mode already has a `function
openPopup(...)` — the inline *comment-entry* popup. Naming the modal-scope helper `openPopup` too is a
**duplicate `const`/`function` declaration → `SyntaxError` → the WHOLE edit-mode.js fails to load**, so
the ✎ FAB never appears and *nothing* is selectable. Symptom: "edit mode does nothing / no toolbar."
Name the modal helper `openModal`, grep the file for the name first, and after any edit confirm it
parses (`node --check` on a `.mjs` copy) — a syntax error in edit-mode.js is silent in the page console
only as "ReferenceError: EditMode is not defined" much later.

**Dynamically-rendered popup content has NO ids unless the BUILDER adds them — and `text-audit.mjs`
can't see it.** The drill/ERD bodies are built by JS (`renderBooking`/`renderEngine`/`buildErd`/
`drawErdLines`) and injected via `innerHTML` *after* load, so: (a) they start completely untagged —
every card, lane, table, field, relationship label, rail desc/hint/heading, pill, tab, zoom button
needs `data-viz-id` added **in the template string**, not retrofitted; (b) `scripts/text-audit.mjs`
loads the static page and never opens the modals, so it reports the popups as clean when they're not.
**Audit popups live**: open each modal, then walk `modal.querySelectorAll('*')` for elements with a
direct text node and no own `data-viz-id`. Tag at the builder. Both rail variants are separate
(`renderBooking`'s overview vs `renderEngine`'s grouped overview) — tagging one does NOT tag the other;
fix both. Leaf `<tspan>`/`<b>`/`<i>` *inside* one already-tagged text block are the sensible stop —
tagging each fragment splits one sentence into overlapping ids for no gain.

**The page caches `main.js`/`styles.css` — verify with a HARD reload.** During a fast edit→check loop,
a plain reload (or chrome-devtools `navigate_page type:url`) serves the *stale* bundle, so your just-
added ids/fixes appear missing and you "fix" them again. Always re-check with `navigate_page type:reload
ignoreCache:true` (or append a cache-buster). A confusing "I tagged it but the audit still flags it"
is almost always this.

---

<a name="3d-selection"></a>
## 3D object selection

**Thin geometry is almost impossible to raycast.** A tube (radius 0.18), line, or slender mesh almost
never gets a pixel-exact ray hit, so it's effectively unselectable. Two fixes, apply both:
1. Widen the raycaster thresholds: `ray.params.Line.threshold = 0.6; ray.params.Points.threshold = 0.6`.
2. **Proximity fallback**: when the direct raycast resolves to no vizId, find the registered object
   whose screen-projected geometry passes closest to the cursor (sample vertices along the object,
   project to screen, pick nearest within ~14px). This makes thin tubes clickable by aiming *near* them.
   Guard it so it doesn't get greedy (a clear hit on a solid object must still win).

**An object with `userData.vizId` but never registered is invisible to edit-mode.** If you set
`obj.userData.vizId = 'x'` but forget to pass it to `registerVizObject`, it won't appear in the expert
overlay, won't be hover/clickable, and won't match snip/brush. This is an easy omission (it happened
with the route tube). Fix: edit-mode should **auto-discover** any object carrying `userData.vizId` by
traversing the scene, not rely solely on the explicit register list:
```js
function each3dViz(fn) {
  const seen = new Set();
  state.vizObjects.forEach((o, id) => { seen.add(id); if (isSelectable(o)) fn(o, id); });
  state.scene.scene.traverse((o) => { const id = o.userData?.vizId;
    if (id && !seen.has(id) && isSelectable(o)) { seen.add(id); fn(o, id); } });
}
```

**Some 3D objects are backdrops and should never be selectable.** A ground plane / sky / fog volume
carries an id for reference but commenting on it is meaningless. Give the convention an opt-out:
`obj.userData.vizSelectable = false`, honoured everywhere selection happens (`isSelectable`). Mark
grounds/backdrops with it.

**A group's projected bounding box is mostly empty.** A `THREE.Group` with a small core mesh plus
spread-out child meshes projects to a large bbox full of empty space, so hovering its "centre" hits
nothing. That's expected raycast behaviour, not a bug — but be aware when *testing* (aim at actual
geometry, not the bbox centre). Don't "fix" it by inflating hitboxes.

**"Over the canvas" must mean VISIBLE canvas, not just the canvas rect — or 3D is selectable through
opaque content.** The 3D stage is `position:fixed; inset:0`, spanning the whole viewport *behind every
scroll section*. A rect-only `isOverCanvas` (`clientX/Y within canvas.getBoundingClientRect()`) is
therefore true even when an **opaque** content section (`background:#fff`, a grey/dark band, a frosted
panel) is painted over the canvas — so hovering that section wrongly picks the 3D object behind it (a
big object like a finale chevron highlights a box over unrelated text). Symptom: "3D still selectable
after I scrolled to another section." Fix: walk the **hit-test stack** and only allow 3D if the canvas
is reached before any opaque layer:
```js
function isOverCanvas(e) {
  const cv = state.scene.renderer.domElement;
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (el === cv) return true;          // canvas is the topmost paint here → scene shows through
    if (inRoot(el)) continue;            // our own edit-mode UI doesn't occlude
    if (isOpaque(el)) return false;      // an opaque section hides the scene at this point
  }
  return false;
}
// isOpaque: backgroundColor alpha > 0.5, OR a backgroundImage, OR a backdrop-filter.
```
This makes 3D selectable exactly where the scene is actually on screen (hero, the scroll-story journey,
a transparent band) and *not* where opaque content covers it — without any per-section config.

**A non-selectable backdrop (ground/water) shadows the real objects under the cursor.** The ground
plane is huge and is the first raycast hit at floor level. If `pick3dId` stops at the first hit that has
*a* vizId regardless of selectability, it resolves to `scene.ground` (opted out) and returns nothing,
so objects behind/around it never win. Fix: when a hit's nearest vizId is **not selectable**, don't
stop — continue to the next hit so a selectable object can win; and widen the proximity fallback
(~28px) so a nearby building is grabbed when the direct ray only found ground. (Pairs with the
`vizSelectable:false` opt-out above.)

---

<a name="modelling"></a>
## Scene modelling & composition (it looked "ugly / generic")

**Don't build objects as a few generic boxes stacked together — model recognizable things.** A "server"
that's three cubes on top of each other reads as ugly/generic; the user notices immediately. Give each
node real, readable detail so it looks like *what it is*: a server **rack** = a cabinet + horizontal
rack-unit slats + a glowing front LED strip; a **datacenter** = a block of those racks on a plinth; an
**edge/CDN node** = a satellite **dish** on a mast + cache cabinets; a **TV** = a bezel + stand + glowing
screen with a play glyph; a **building** = a body with a **window-grid canvas texture** + a rooftop unit.
Compose from rounded boxes (`RoundedBoxGeometry`), cylinders, extrudes, and canvas-texture faces — small
named `part(group, …)` helpers added to a `THREE.Group`. The bundled `assets/scene/primitives.js` and the
`sample/` page show this; copy that level of detail, don't ship raw boxes.

**The backdrop must not block the main subject.** A backdrop that crowds or towers over the focal nodes
buries the story (symptom: "the buildings around are too tall, I can't see the main parts"). Keep the
backdrop **low and set back** from the subject: clear a wide corridor/stage around the focal objects, and
keep backdrop elements lowest nearest the subject, rising only as they recede into fog. The *form* of the
backdrop is per-idea — a low city skyline, a datacenter floor, a landscape, an abstract grid, deep space —
choose what fits the system's metaphor; the **principle** (low, set-back, frames-not-buries) is constant.

**A rich animated backdrop is great — but it makes the scene CONTINUOUS, so gate it hard.** Flowing
particles + a pulsing grid + a detailed city look alive (à la the Vectr/“tech city” hero references) and
are worth it — but they run every frame, so you lose render-on-demand and MUST pause off-screen/tab-hidden
(see perf below) and bound the per-frame work (instance the city → one draw call; throttle a many-tile
grid pulse to ~30Hz and skip tiles outside the camera band; cap particle count). Couple node motion to
scroll `p` where you can so only the ambient layer is continuous.

---

<a name="perf"></a>
## Three.js performance (the recurring complaint)

**The off-screen pause silently fails for a fixed full-screen canvas.** The 3D `#stage` is usually
`position:fixed; inset:0`, so it ALWAYS intersects the viewport — an `IntersectionObserver` on the canvas
never reports "off-screen", and a CONTINUOUS loop keeps rendering even when scrolled away (measured:
15,000+ draw-calls while the city was scrolled past). The fix: **observe the solid content that scrolls
OVER the stage** (e.g. the `.cards`/footer section) and pause when it fills the viewport — not the canvas
itself. This is the same gotcha noted in `render-loop.js`; it bit again with the continuous city scene.


**A naive render loop pegs the GPU even when idle.** `requestAnimationFrame(render)` runs forever at
full rate, re-rendering an unchanged scene 60–120×/sec. Symptom: "the website uses high GPU / fans
spin." The fix is **render-on-demand** — render only when something changed:
- Couple all motion to scroll progress `p` (NOT a free-running clock), so a still scene is static.
- Set `needsRender = true` in the ScrollTrigger `onUpdate` and on `resize`.
- Render only when `needsRender` (and the stage is visible and the tab isn't hidden), then clear it.
- **Measured result: idle draw-calls go from hundreds/sec → 0.**

Plus the always-applicable budget: pause off-screen (IntersectionObserver) and on tab-hide
(`visibilitychange`), `gsap.ticker.fps(60)` on a **single** ticker (no second rAF loop), and
`renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5–1.75))`. **This is mandatory — run the full
"Mandatory performance checklist" in `gsap-threejs-playbook.md` before calling any 3D scene done, and
*measure* idle draw-calls (don't trust "looks smooth").** The bundled `assets/scene/render-loop.js`
implements both render-on-demand and a CONTINUOUS mode.

---

<a name="verify"></a>
## Verification scripts (Playwright)

**`gl.readPixels` / `drawImage(canvas)` false-reports the canvas as BLACK.** three.js sets
`preserveDrawingBuffer: false` for performance, so reading the WebGL buffer after compositing returns
black even when rendering is fine. To verify a canvas actually rendered, **screenshot the canvas
region with Playwright and check pixel spread** (non-uniform, non-black) — don't poke the GL context.

**The overlap probe false-flags z-stacked chrome.** A naive "do any two tagged rects intersect?" check
flags the fixed nav, the fixed 3D stage, and everything stacked over them — because they legitimately
overlap content in z, not in flow. Skip elements (and their descendants) that are `position:fixed`/
`sticky`, and large `absolute` backdrops, before the overlap test. Overlap detection is about *flow*
collisions, not deliberate layering.

**`--use-gl=swiftshader` is dead.** Chromium deprecated the auto-SwiftShader-as-WebGL fallback. For
deterministic software WebGL you now need the explicit opt-in or context creation fails → blank canvas:
```
--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader
```
On dedicated Linux CI, `--use-gl=angle --use-angle=gl` with Mesa llvmpipe is faster and equally
deterministic.

**ESM scripts resolve `node_modules` from the SCRIPT's location, not the CWD,** and `NODE_PATH` does
not apply to ESM. So `node /path/to/skill/scripts/verify.mjs` fails to find `@playwright/test` even if
it's installed in the project you're running from. Copy the scripts into the project (alongside its
`node_modules`) and run them there — that's the intended usage. Import from `@playwright/test` (what
`npx playwright install` provides), not the bare `playwright` package.

**axe flags `aria-required-children` on `role="tablist"` / `role="toolbar"` without proper children.**
A segmented control isn't a tablist. Use `role="group"` (no required children) with `aria-pressed` on
the toggle buttons. Run axe on your own injected UI too, not just the page content.

**Headless FPS is not representative of real hardware.** Gate CI on jank / long-tasks / CPU, not on an
fps number (software rendering makes WebGL CPU-bound and the fps figure misleading). Report it that way.

---

<a name="tagging"></a>
## Tagging conventions (so feedback resolves in one hop)

**Tag EVERY meaningful text element, not just containers.** Edit-mode can only select a node that has
its own `data-viz-id`. An untagged heading/paragraph isn't pointable — hovering it just grabs the
nearest tagged ancestor (the whole card/section). Tag headings, paragraphs, nav links, eyebrows,
captions, badges/numbers, **header and footer text** — each with a dotted id under its container
(`card.audit.title`, `card.audit.body`, `footer.text`). The container keeps its own id too, so you can
still grab the whole card by its edge. Verify with a "text-bearing leaf without its own id" audit
(see the demo's `text-audit.mjs`).

**Generate the viz-manifest whenever there's a 3D scene.** 3D objects have no DOM node to grep, so the
build-time `vizId → {file,line,builderFn}` manifest (`scripts/gen-viz-manifest.mjs`) is the *only*
bridge from a 3D click to its code. Point the generator at the **page source dir only** — if it scans
the edit-mode tooling, its doc-comment examples pollute the DOM-id source locations.

**Floating tool panels should be draggable.** Any always-on overlay UI (toolbar, comment list) will
eventually cover the content the user wants to comment on. Make it draggable by a header/handle, switch
to absolute `left/top` on first drag, clamp to the viewport, and don't start a drag when the mousedown
lands on a button/input.
