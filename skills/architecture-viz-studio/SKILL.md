---
name: architecture-viz-studio
description: >-
  Build high-quality, animated, professional web pages that VISUALIZE software architecture, system
  design, data models, or a product idea — using Three.js (3D) + GSAP (scroll/animation) + SVG diagrams.
  Produces two things, usually together: (1) a cinematic scroll-story landing page where a 3D low-poly
  world narrates how a system works, and (2) an interactive architecture map with switchable overlay
  "lenses", clickable drill-down component diagrams, and crow's-foot ERDs. Every output ships with a
  built-in EDIT MODE so the human can click components / snip areas / pick 3D objects and batch visual
  feedback straight to you. Use this skill WHENEVER the user wants to visualize, present, "show",
  animate, or build an interactive page for an architecture, system design, technical concept, data
  model, pipeline, or product story — including phrases like "intro page", "architecture visualization",
  "interactive diagram", "scrollytelling", "3D system map", "ERD page", "design walkthrough", "make our
  architecture look impressive", or "present this design to stakeholders". Prefer this skill over hand-
  rolling Three.js/GSAP from scratch — it bundles battle-tested templates, a styling/anti-slop guide, a
  diagram-layout catalog, and an AI-tweakable code convention learned from a long real build.
---

# Architecture Visualization Studio

Build pages that make software architecture and ideas *felt*, not just diagrammed. The goal is output that
makes a viewer think "I've never seen our company's work look like this" — polished, animated, professional,
**not AI-slop**. This skill bundles the hard-won code and taste from a long real build so you assemble from
proven parts instead of rediscovering them.

## The two deliverables (often combined on one page)

1. **Scroll-story** — a fixed 3D low-poly world (Three.js) that the camera flies through as the user scrolls
   (GSAP ScrollTrigger). A request/object travels the world; sections reveal over it. For stakeholders to
   *feel* the product. → templates in `assets/scene/` + `assets/scroll/`.
2. **Architecture map** — a dark "blueprint" SVG system map with switchable **overlay lenses** (one map, N
   aspects: Systems / Data Flow / Ownership / Reliability / …), **clickable nodes** that open drill-down
   component diagrams, and an **ERD** for the data model. For architects to explore. → `assets/diagrams/`.

Both are **design-system aware** (adapt to provided brand colors/fonts/logos; degrade to tasteful neutral
defaults) and ship with **edit mode** (`assets/edit-mode/`).

## Workflow

Treat this as: **brainstorm the narrative → scaffold → assemble from templates → polish → verify → enable edit mode.**

1. **Understand the system and pick the metaphor.** Read whatever design docs/PRD the user has. Decide
   what the scroll-story narrates (the journey of one entity through the system is a strong default) and
   what the architecture map's nodes/lenses are. If the 3D "world" metaphor doesn't fit the domain, say so
   and lean on the 2D diagrams (see `references/diagram-catalog.md` → "3D world metaphor: lands vs gimmicky").

2. **Establish the design system BEFORE building — ask, don't assume.** Consistent visuals come from
   deciding the tokens once, up front. Unless the user already gave you a brand/design system, **ask them
   at the start** (a short, concrete intake — don't make them write a spec):
   - **Brand colors?** Primary/accent hex, or a logo/site to pull from. (If none, you'll propose one
     reserved accent + neutral greys.)
   - **Fonts?** A display + body pairing, or a brand font. (If none, you'll propose a tasteful pairing —
     not Inter-everywhere, which reads as AI slop.)
   - **Logo / wordmark?** To place in the nav.
   - **Aesthetic?** The two looks that read as professional here: the **dark "blueprint"** (architecture
     maps) and the **pale low-poly 3D world** (scroll-stories). Confirm which, or both.
   - **An existing page/screenshot to match?** The fastest path to consistency — extract its palette,
     type scale, spacing, and radius and mirror them.

   If the user has nothing, **don't silently default** — propose a concrete design system (show the
   accent + font pairing) and get a thumbs-up, OR point them at `references/finding-layout-inspiration.md`
   to pick a direction. Then wire the agreed tokens into the `:root` block in
   `assets/page-shell/styles.css` (`--primary-500`, `--neutral-*`, font vars) **before** building any
   component — so every piece is consistent from the first line. **Read `references/styling-and-anti-slop.md`
   now** — it is the difference between professional and slop, and it's cheap to get wrong. Capture the
   decision in a short `DESIGN-SYSTEM.md` next to the page so later edits (and the next session) stay
   consistent — see `references/styling-and-anti-slop.md` → "Design-system intake" for the token checklist.

3. **Scaffold from the page shell — and study the sample first.** `sample/` is a small but **complete,
   fully-debugged** scroll-story page that applies every convention correctly (render-on-demand 3D scene,
   every text element tagged, `vizSelectable:false` on the backdrop, edit-mode + manifest wired, anti-slop
   styling). Read it before building — it's the fastest way to see how the pieces fit, and it already
   avoids the bugs in `references/gotchas-and-lessons.md`. Then copy `assets/page-shell/index.html` +
   `styles.css` as your skeleton (section structure, importmap, modal scaffolds, token block) and pull in
   only the modules you need:
   - 3D world → `assets/scene/scene-setup.js`, `primitives.js`, `render-loop.js`. **These ship studio-grade
     by default** — `scene-setup.js` already wires the Biggest-5 lighting foundation (sRGB+ACES, PMREM/
     `RoomEnvironment` IBL, a three-point rig **with a rim light**, FogExp2, a `glowMat()` for accents and a
     deep moody default palette). Don't strip it back to a single sun + ambient — that flat rig is the #1
     amateur tell. Tune the numbers (frustum to your world size, palette to your brand); keep the structure.
   - ⭐ post-processing (Biggest-5 #3) → `assets/scene/post-processing.js` — OPTIONAL selective bloom +
     grain + vignette + SMAA. Wire it with `setComposer()` (the page-shell import graph shows the 3 lines).
     It needs the `postprocessing` importmap entry (already in `page-shell/index.html`; **must** be the raw
     `build/index.js`, not `/+esm`, or you get two three instances and bloom breaks). This is the last 20%
     of "wow" — add it for hero scenes, skip it for lightweight pages.
   - scroll choreography → `assets/scroll/scroll-journey.js` — ships a **Lenis smooth-scroll layer by
     default** (the `lenis` importmap entry is already in `page-shell/index.html`). This is what makes
     mouse-wheel scrolling glide instead of jerk/freeze — `scrub` alone does NOT fix that. Tune `duration`
     for feel; it's off under reduced motion. See the playbook → "Smooth scroll" for the why.
   - architecture map lenses → `assets/diagrams/overlay-lens-system.js` (`initOverlays` → the `drill` flag)
   - drill-down component diagram → `assets/diagrams/component-detail-modal.js` (`initDrill` — `data-drill` nodes)
   - ERD → `assets/diagrams/erd-diagram.js` (`initErd` — `data-erd` nodes; bundles the whole open/close/
     draw-on-double-rAF/pause lifecycle, so you don't re-derive it; pass `intro`/`columns` to fit your schema)
   - pan/zoom on any diagram → `assets/diagrams/pan-zoom-viewport.js`
   - selectable arrows → `assets/diagrams/edge-hit-proxies.js` (`tagSvgEdges`) — gives every thin SVG
     edge a wide transparent hit area so it's clickable in edit mode (otherwise a 2px arrow is nearly
     impossible to select). Call it once per SVG (main map + each drill/ERD modal, after render).
   These are wired with one line each — see the import graph in `assets/page-shell/index.html`, and `sample/`
   for a complete, genericized instance (a neutral CDN domain — copy the wiring, swap the copy/data).

4. **Build with the AI-tweakable convention from the start.** This is not optional polish — it's what makes
   the page revisable. **Every DOM component gets `data-viz-id="dotted.name"`; every 3D object gets
   `registerVizObject(obj, 'scene.name')`.** And tag **every text element**, not just containers —
   headings, paragraphs, nav links, the footer/header text, badges/numbers each get their own dotted id
   (`card.audit.title`, `footer.copyright`). Edit-mode can only select a node that carries its own id, so
   untagged text isn't pointable — hovering it just grabs the whole card. Use small named builder functions
   (one per object), grouped layout constants at the top, config objects over deep nesting. Read
   `references/ai-collaboration-protocol.md`. The reason: when the user gives feedback later, the edit-mode
   tool hands you exact ids, and you map each id straight to its builder — no guessing which "box" they meant.

5. **Choose layouts deliberately.** Don't default to generic arrangements. For each diagram consult
   `references/diagram-catalog.md` — it has the right layout per situation (e.g. ERD → hub-and-spoke so lines
   never cross; pipeline → horizontal band with annotations dropping below; system map → region lanes +
   overlay lenses). Edge routing rules (even anchor distribution, crow's-foot at the "many" end, cardinality
   at endpoints, labels following the arrow) are in that doc too — they were earned through many revisions.

6. **Verify in a real browser — and run the checks.** This is mandatory; these pages are visual and
   animation-timed, so you cannot confirm them by reading code. Serve locally (`python3 -m http.server`)
   and drive it with the chrome-devtools tools: screenshot each scroll state and each overlay/modal,
   check the console is clean. Then run the bundled checks for the objective layer a screenshot misses:
   - `node scripts/verify.mjs <url> --out report.json --shots shots/` — console, layout probes across
     3 viewports (overflow / overlap / text-clipping), axe-core a11y+contrast JSON, a real check that the
     WebGL canvas actually rendered, and scroll **jank/CPU** (not fps — headless fps is not representative).
   - `node scripts/slop-lint.mjs <url> --json slop.json` — the mechanical AI-slop tells (see anti-slop bar).
   - `node scripts/text-audit.mjs <url>` — fails if any text element lacks its own `data-viz-id` (so the
     user can point at every heading/paragraph/footer line, not just containers). ⚠️ It only sees the
     **static** page — it never opens the drill/ERD modals, so it reports their JS-rendered bodies as
     clean when they're untagged. **Audit popups LIVE too** (open each modal, walk it for text nodes
     without their own id; different drill tabs can have SEPARATE rail builders) — see visual-verification.
   - **For a 3D geometry bug** (head off the tip, a gap, a cap not covering, an object mis-placed),
     don't eyeball screenshots — **reach into the live scene and MEASURE** (capture the page's
     `{THREE,scene,camera,renderer}` ctx, compare world/screen positions; freeze the render loop before
     posing a custom camera). The technique is in `references/visual-verification.md` → "Reaching INTO
     the live scene"; it's what ends the guess-and-check loop.
   - **Re-check with a HARD reload** (cache-bypass) — the page caches `main.js`/`styles.css`, so a plain
     reload serves the stale bundle and your just-applied fix looks like it did nothing.
   A clean run is a **floor** ("nothing mechanically broken, no slop markers"), not a ceiling. The taste
   calls — does the metaphor land, does it feel premium, is the motion tasteful — still need your eyes and
   the user's. Read `references/visual-verification.md` for the exact stack and the honest human boundary.
   (Scripts need Playwright: `npm i -D @playwright/test axe-core && npx playwright install chromium`.)

   **If the page has a Three.js scene, TWO checklists are MANDATORY before you call it done:**

   ⭐ **(a) The WOW quality gate** (`references/wow-quality-bar.md` → "The Biggest-5"). "No bugs / clean
   verify" is the FLOOR, not the bar — the user expects something a professional 3D designer would ship, that
   makes people *wow*. A correct-but-flat scene (ambient-only light, raw `MeshStandardMaterial`, default
   linear render, no post, linear camera) reads as a student exercise and is a FAIL. Apply at least the
   Biggest-5: (1) tone mapping + sRGB + DPR≤2; (2) HDRI/`RoomEnvironment` IBL via PMREM; (3)
   `pmndrs/postprocessing` — selective bloom + depth-of-field; (4) three-point lighting with a **rim light**
   + soft contact shadows; (5) eased, **staged** GSAP reveal + `FogExp2`. Then look at it: does it actually
   say "wow"? If it looks normal, it isn't done — that's a taste judgment you (and the user) must make.

   ⚡ **(b) The performance checklist** (`references/gsap-threejs-playbook.md` → "Mandatory performance
   checklist"). The wow can't tank perf or it isn't wow. Render-on-demand so **idle GPU ≈ 0** (or, for a
   continuous animated scene, pause when the stage is off-screen / tab-hidden / a modal is open — observe the
   content that scrolls OVER the fixed canvas, not the canvas itself), fps capped at 60 on GSAP's single
   ticker, DPR ≤2, repeated meshes instanced, post chain merged into one `EffectPass`, shadow map ≤2048,
   bake what's static, no per-frame allocation. **Measure it** (`verify.mjs` reports jank) — never trust
   "looks smooth". A scene that's beautiful but janky fails (b); a scene that's smooth but flat fails (a).

7. **Generate the viz-manifest (optional but recommended).** Run
   `node scripts/gen-viz-manifest.mjs <pageDir> --as-js` to emit a `viz-manifest.json` (+ `.js`) mapping
   every `data-viz-id` / `userData.vizId` to its `{file, line, builderFn, cssRule}`. Load it before
   edit-mode. This is the one-hop bridge from "what the user pointed at" to "the code that makes it" — and
   it is the ONLY bridge for Three.js objects (they have no DOM node to grep). Edit-mode then stamps each
   comment with its `source`, and `window.__viz` (`assets/edit-mode/viz.js`) lets you query ids at runtime.

8. **Enable edit mode and hand off.** Wire `assets/edit-mode/edit-mode.js` + `.css` (see its header for the
   3-step wiring); optionally also include `assets/edit-mode/viz.js`. Tell the user: toggle with the ✎
   button or `e`; the toolbar has **Normal/Expert views** (Normal reveals a component's rect + id on hover;
   Expert shows all ids at once — both for DOM and 3D objects) and four tools — **Pointer** (interact with
   the page normally — no highlights, clicks pass through; for when the user wants to drive the page while
   the toolbar stays up), **Select** (click an element to add it as a comment; **ctrl/⌘+click builds a
   multi-select** — keep ctrl/⌘+clicking to add more, ctrl/⌘+click again to remove, then Enter/plain-click
   to turn the whole set into ONE comment with many targets), **Snip** (drag a rectangle), and **Brush**
   (paint a freehand region). Comments collect in a (draggable) side panel.
   **Getting feedback back to you — "Copy for AI" is the one button, made smarter by the bridge:**
   - **Serve with `scripts/serve.sh` (recommended):** `./scripts/serve.sh <pageDir>` starts BOTH the page
     server (8800) and the feedback-bridge (8910) together, so the bridge is always up whenever the page
     is — no separate process to forget. Init edit-mode with `{ bridge: 'http://localhost:8910' }`. Now
     **"Copy for AI"** both copies the markdown AND POSTs the batch + snip PNGs to the bridge, which writes
     them to `/tmp/viz-edit/`. The user just says "read the feedback" — you read `edit-feedback.json` (each
     comment carries an absolute `imagePath`) and the PNGs directly. If the bridge ever isn't running,
     "Copy for AI" silently falls back to a normal clipboard copy. (Bare alternative: run
     `node scripts/feedback-bridge.mjs` and `python3 -m http.server` yourself.)
   - **Without the bridge:** "Copy for AI" copies the markdown to paste into chat — fine for id/text
     comments, but snip images aren't included. Or use **Download** (`edit-feedback.json` + `snip-N.png`)
     then `node scripts/receive-feedback.mjs` to land them in `/tmp/viz-edit/` at the paths the JSON names.
   You consume the batch by resolving each id to its builder (the `source` field or grep the id), reading
   any `imagePath` for visual context, and using `sceneContext` to reproduce the exact 3D moment.

9. **Export a standalone HTML for sharing.** Always offer a single-file export the user can send or open
   without a server: `node scripts/bundle-standalone.mjs index.html` inlines all local CSS/JS into one
   `.html`. **Edit-mode is stripped by default** (an export is a publish artifact). Add `--vendor` to also
   inline the CDN libs (three/gsap) for a fully offline file; `--keep-edit` to retain the authoring tool.

## Operating knowledge (read on demand)

- **`references/gotchas-and-lessons.md`** — ⚠️ **READ THIS FIRST.** A catalog of real bugs that each cost a
  debugging round in a prior build: the SVG `.hidden` no-op, `[hidden]` losing to a `display` class,
  `contains(window)` throwing, DOM-over-3D hover hijacking, un-raycastable thin tubes, unregistered
  vizId objects, idle-GPU render loops, the `readPixels`-reports-black trap, the dead swiftshader flag,
  ESM module resolution, and the tag-every-text rule. Skim it before writing edit-mode wiring, 3D
  selection, a render loop, or a verification script — it is the cheapest rework you can avoid.
- **`references/gsap-threejs-playbook.md`** — GSAP + Three.js technique and gotchas: ScrollTrigger scrub,
  the piecewise camera-param remap, `getPointAt` (arc-length) vs `getPoint` and when each is right,
  draw-on tubes, InstancedMesh, canvas-texture labels, bezier-tangent label rotation, and the
  **PERFORMANCE / render-pause pattern** (pause the loop when the 3D stage is off-screen or a modal is open —
  the single biggest CPU/GPU win). Read before writing any scene or scroll logic.
- **`references/wow-quality-bar.md`** — ⭐ **the studio-grade gate. "No bugs" is not the bar; "wow" is.**
  What separates a professional 3D hero from a student exercise: the tone-mapping/sRGB pipeline, HDRI/PMREM
  environment lighting, `pmndrs/postprocessing` (selective bloom + DOF + grade), three-point + rim lighting +
  soft contact shadows, eased/staged GSAP camera & reveal choreography, atmosphere (fog/particles/god-rays),
  and the **Biggest-5** ordered list. A hero scene is NOT done until it clears the Biggest-5. Read before and
  after building any 3D scene.
- **`references/styling-and-anti-slop.md`** — taste and restraint; the anti-slop checklist; how to adopt a
  design system. Read before styling.
- **`references/diagram-catalog.md`** — per-diagram layout patterns + universal edge-routing rules + the
  overlay-lens model. Read before laying out any diagram.
- **`references/finding-3d-models.md`** — **MODEL objects with real detail, don't stack generic boxes**
  (a server = rack + slats + LED, not three cubes); procedural-first decision tree; a vetted catalog of
  free model sources (Kenney/Quaternius/KayKit CC0, Poly Pizza, Sketchfab, Poly Haven HDRIs, the
  three.js-examples-are-NOT-MIT caveat) with per-license shipping rules; AI generators (tier-dependent
  licenses); the GLTFLoader → recolor → glTF-Transform optimize pipeline. Read when building/​importing
  any 3D object, and to find a model online.
- **`references/finding-layout-inspiration.md`** — where to find scroll-story and diagram inspiration online
  (Awwwards, the vectrfl/Stripe/Linear scrollytelling genre, C4, the Oxygen-Not-Included overlay metaphor)
  and how to steal structure, not skin.
- **`references/ai-collaboration-protocol.md`** — the `data-viz-id` / `userData.vizId` convention, the
  reads-like-language code structure, and the exact JSON/markdown contract the edit-mode tool emits so you
  know how to consume feedback. Read before writing components and when receiving edit-mode feedback.
- **`references/visual-verification.md`** — how to read and validate the page like a machine: the
  `scripts/verify.mjs` stack (layout probes, axe contrast, canvas-rendered check, GSAP `.progress()` frame
  pinning, jank/CPU), the `scripts/slop-lint.mjs` ruleset, the viz-manifest round-trip, and the honest list
  of what STILL needs a human. Read before verifying and when wiring the manifest / `window.__viz`.

## Bundled template library (copy, don't rewrite)

Everything in `assets/` is extracted from a polished, ~30-round real build and syntax-checked. Each file
has a header comment explaining what it is, its dependencies, and how to wire it. Genericized content is
marked `EXAMPLE` / `PLACEHOLDER`. **Read the file header before copying.** Faithfully reuse the math —
especially the ERD glyph geometry, the pan/zoom cursor-anchored zoom, the camera remap, and the
render-pause loop; these are easy to get subtly wrong from scratch.

```
sample/            ← a COMPLETE working reference page (read this first — all conventions applied correctly)
                     includes a filled-in DESIGN-SYSTEM.md worked example
assets/
├── page-shell/    index.html · styles.css · DESIGN-SYSTEM.md   ← start here: skeleton + token block + intake template
├── scene/         scene-setup · primitives · render-loop · post-processing   ← the Three.js world (studio-grade defaults)
├── scroll/        scroll-journey                  ← GSAP ScrollTrigger choreography
├── diagrams/      overlay-lens-system · component-detail-modal · erd-diagram · pan-zoom-viewport · edge-hit-proxies
└── edit-mode/     edit-mode.js · edit-mode.css · viz.js   ← visual-feedback tool (Pointer/Select+multi-select/Snip/Brush) + window.__viz query API
scripts/           ← run these to verify and to wire the id→source round-trip (need Node; verify/lint/audit need Playwright)
├── verify.mjs           console · layout probes · axe a11y/contrast · canvas-rendered · jank/CPU
├── slop-lint.mjs        the mechanical AI-slop tells (DOM + computed styles)
├── text-audit.mjs       flags any text element missing its own data-viz-id (the tag-every-text rule)
├── gen-viz-manifest.mjs build-time vizId → {file,line,builderFn,cssRule} map (the one-hop bridge)
├── bundle-standalone.mjs  inline the page into ONE shareable .html (edit-mode STRIPPED by default)
├── feedback-bridge.mjs    makes "Copy for AI" also write comments+snips to /tmp/viz-edit (read by absolute path)
├── receive-feedback.mjs   offline fallback: move downloaded edit-feedback.json + snips into /tmp/viz-edit
└── serve.sh               start the page server + the feedback-bridge together (so the bridge is always up)
```
NOTE on running the Playwright scripts: ESM resolves `node_modules` from the SCRIPT's location (and
NODE_PATH doesn't apply), so copy `scripts/` into the project you're testing and run them there, next to
its `node_modules`. Install once: `npm i -D @playwright/test axe-core pngjs && npx playwright install chromium`.

## When receiving edit-mode feedback (the revision loop)

The user pastes a batch like:
```
## 1. component: hero.title
   make this 20% smaller and tighten the line height
## 2. area snip — components inside: arch.node.api, arch.edge.cdc
   (screenshot snip-2.png attached)
   these two are too close, add breathing room
## 3. object: scene.service-core
   make it taller and more imposing
```
For each item: resolve the id → its builder function/CSS rule (a stable id maps to exactly one place), make
the change, then **re-verify that specific spot in the browser**. Apply the whole batch, then screenshot the
affected areas. This is the fast path the convention exists to enable — one hop from "what they pointed at"
to "the code that makes it".

## The bar (the whole point) — two halves: anti-slop AND wow

**Half 1 — don't be slop (2D/page).** If the result looks like a generic AI-generated page — centered
everything, purple gradients, emoji headers, glassmorphism, default spacing, rainbow node colors — it has
failed. Hold the bar: **one reserved accent color, neutral greys elsewhere, a real type scale, generous
whitespace, flat chrome, restrained motion, consistent radius/shadow.** Details in
`references/styling-and-anti-slop.md`.

**Half 2 — be WOW (3D/the hero).** Avoiding slop is the floor; the ceiling is output a **professional 3D
designer would be proud of — something that makes people wow.** A 3D scene that's merely correct (flat
ambient light, raw materials, default linear render, no post-processing, a linear camera) reads as a
*student* exercise even with zero bugs — and that's a fail. The gate is `references/wow-quality-bar.md`
(the **Biggest-5**: tone-mapping/sRGB pipeline, HDRI/PMREM environment lighting, post-processing with
selective bloom + depth-of-field, three-point + rim lighting with soft contact shadows, and eased/staged
GSAP motion). The wow comes from **light, depth, atmosphere, and a graded final image** — not the geometry.
Hold this bar as hard as the anti-slop one.

Either way, the two professional looks here are the dark "blueprint" architecture aesthetic and the pale
low-poly 3D world — done to the wow bar. Honoring all of this is what makes someone say "I didn't know we
could make something this good."

To catch the *mechanical* slop tells before a human has to, run `node scripts/slop-lint.mjs <url>` — it
flags indigo/violet CTAs in the 250–300° hue band, gradient-text heroes, neon-glow shadows, uniform
radius/padding, centered-Inter heroes, palette/type-scale sprawl, glassmorphism, emoji nav/headers,
identical icon-card grids, and dark low-contrast body text. A clean lint is necessary, not sufficient:
it means "no obvious slop markers", not "good design" — taste still needs your eyes and the user's.
