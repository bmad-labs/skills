# Visual verification — reading and validating the page like a machine

These pages are visual and animation-timed. You cannot confirm them by reading code,
and a single screenshot misses overflow, clipping, contrast, jank, and "did the WebGL
canvas actually render anything". This doc is the **honest** verification playbook: what
to automate, exactly how, and — importantly — what still needs a human eye no matter what.

The bundled scripts implement all of this: `scripts/verify.mjs` (the stack below),
`scripts/slop-lint.mjs` (anti-slop linting), `scripts/gen-viz-manifest.mjs` + the
`window.__viz` API (reading the UI / resolving ids to source).

## The one principle

**Structure-first, stable ids, vision as a checked fallback.** The 2025–26 agent-grounding
consensus is that *grounding* (mapping intent → the exact element/code), not *seeing*, is the
bottleneck. Raw vision-model coordinate-clicking is unreliable (single-digit accuracy on hard
UI benchmarks). So the page should be **legible to a machine through its DOM + stable ids**,
and pixels are only used to verify what structure can't describe (the WebGL canvas, "does it
look right"). This is why the `data-viz-id` / `userData.vizId` convention is load-bearing, not
cosmetic — it is how both edit-mode and any agent read the page deterministically.

## What to AUTOMATE (and exactly how)

Run `node scripts/verify.mjs <url> --out report.json --shots shots/`. It does:

1. **Console** — fail on any error/warning on load. The cheapest, highest-signal check.
2. **Layout probes across 3 viewports (375 / 768 / 1280)** — pure DOM geometry, deterministic,
   no baseline needed:
   - *Horizontal overflow*: any element whose rect exceeds `documentElement.clientWidth` (1px epsilon).
   - *Text clipping*: tagged element with `scrollWidth > clientWidth` / `scrollHeight > clientHeight`
     under `overflow:hidden|clip` (ellipsis / line-clamp got cut).
   - *Overlap*: two tagged components whose rects intersect >35% of the smaller (ignoring
     ancestor/descendant pairs). Catches "these two nodes collide at mobile width".
   - Gotchas baked in: `getBoundingClientRect` is viewport-relative and already transform-aware
     (GSAP translate/scale is in the rect); `scrollWidth`/`clientWidth` are integer-rounded so a
     1px epsilon avoids false positives; this needs a real layout engine (meaningless in jsdom).
3. **Accessibility + contrast via axe-core (WCAG 2.2 AA)** → machine-readable JSON. Contrast
   violations carry `fgColor` / `bgColor` / `contrastRatio` you can act on directly.
   **Honest caveat:** automated a11y covers only ~1/3 of WCAG *criteria* (~57% of issue
   *instances*, weighted by the common ones). A clean axe run is a floor, not proof of
   accessibility — a page can pass axe and still be unusable by keyboard or screen reader.
   axe also can't read text rendered into `<canvas>`/SVG, so ignore contrast hits there.
4. **WebGL canvas actually rendered** — screenshot the canvas region and assert the pixels
   aren't uniform/black (channel spread + non-black fraction). **Do NOT use `gl.readPixels`** to
   prove rendering: three.js sets `preserveDrawingBuffer:false`, so reading after compositing
   returns black even when rendering is fine — the #1 false-negative trap.
5. **Deterministic animation frames** — to screenshot a specific moment of a GSAP timeline,
   **do NOT use `page.clock`**. It pauses virtual time but does not reliably pin a chosen frame
   (and a tracked Playwright bug stops rAF firing after fastForward). Instead expose a hook in a
   debug build and drive it:
   ```js
   window.__tl = myGsapTimeline;                 // your master gsap.timeline()
   // then, in the test:  __tl.pause(); __tl.progress(0.5);  // jump to exactly 50%
   ```
   For raw `requestAnimationFrame`/Three pages with no GSAP, expose
   `window.__renderFrame = () => renderer.render(scene, camera)` and call it before screotting.
   (`gsap.globalTimeline.pause()` is too broad — it freezes delayedCalls too; pin the specific timeline.)
6. **Jank / CPU during a scripted scroll** — `PerformanceObserver` on `longtask` +
   `long-animation-frame`, plus rAF frame-time distribution (p50/p95, % frames >16.7ms).
   **Report jank, not "fps":** headless GPU timing is not representative of real hardware, so an
   fps number is misleading. Gate on long-tasks / janky-frame % / CPU instead.

### Determinism for WebGL across machines
`toHaveScreenshot` on a Three.js canvas is GPU/driver-dependent and flaky unless you pin one
software renderer + one frame and use a generous `maxDiffPixelRatio`. Current Chromium flags
(the old `--use-gl=swiftshader` is dead; auto-fallback was deprecated so the opt-in is now
required or WebGL context creation fails → blank canvas):
```
--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader
```
On dedicated Linux CI, `--use-gl=angle --use-angle=gl` with Mesa llvmpipe is faster and equally
deterministic; SwiftShader-webgl is the portable cross-OS default.

### Anti-slop linting
Run `node scripts/slop-lint.mjs <url> --json slop.json`. It flags the *mechanical* AI-slop tells
that are actually measurable from DOM + computed styles (purple/indigo CTAs in the 250–300° hue
band, gradient-text heroes, neon glow shadows, uniform radius/padding, centered-Inter hero,
palette sprawl, type-scale sprawl, glassmorphism, emoji nav/headers, identical icon-card grids,
dark low-contrast body text, everything-centered). See `styling-and-anti-slop.md` for the why.

## What STILL needs a human (no tool fixes this — by design)

Automated aesthetic models explain only ~50–72% of human aesthetic ratings, and humans
themselves only agree at ~κ0.73 on "is this appealing" (and 34–48% on "what's wrong with it").
So treat these as **human-only**:

- **Does the metaphor land?** Is the 3D world meaningful or a gimmick for this domain?
- **Does it feel premium / on-brand?** "Looks like something we'd be proud to ship."
- **Is the motion tasteful?** Restrained and meaningful vs. busy and generic.
- **Does the narrative read?** Do the scroll beats tell the story a stakeholder will follow?

A clean `verify` + clean `slop-lint` means **"nothing mechanically broken and no obvious slop
markers"** — it is necessary, not sufficient. State results that honestly: report what you
verified, and hand the taste call to the human (that's what edit-mode is for).

## Reading the UI to act on feedback (the round-trip)

When the user sends edit-mode feedback, each item names a stable id. Resolve it in one hop:

1. If a `viz-manifest.json` was generated (`scripts/gen-viz-manifest.mjs`) and loaded as
   `window.__VIZ_MANIFEST`, edit-mode already attaches `source: {file, line, builderFn, cssRule}`
   to each comment — jump straight there.
2. Otherwise grep the id: `data-viz-id="<id>"` for DOM/SVG, `userData.vizId === '<id>'` /
   `registerVizObject(obj, '<id>')` for 3D. One id maps to exactly one builder.
3. `window.__viz.find(id)` returns the id's kind, on-screen rect, and source at runtime;
   `window.__viz.list()` enumerates every id; `window.__viz.pickAt(ndcX, ndcY)` raycasts the 3D
   scene. Use these to confirm you're editing the thing the user pointed at.

See `ai-collaboration-protocol.md` for the full id convention and edit-feedback JSON contract.

## Reaching INTO the live scene to *measure* a 3D bug (don't eyeball, don't guess)

`window.__viz` answers "what id is here" but not "where exactly is the tube tip vs the head, in world
and screen space." For 3D geometry bugs (head off the tip, a gap, a cap not covering), **measure the
running scene** instead of iterating on screenshots — it's what ends the guess-and-check loop.

**Get a handle to the live scene.** A devtools `import('three')` returns a SEPARATE module instance
(its `WebGLRenderer.prototype` patch never fires) — useless. Instead capture the page's own ctx by
intercepting `__viz.attachScene` *before the page calls it*, via the browser tool's per-navigation init
script:
```js
// navigate_page initScript (runs before the page's modules):
Object.defineProperty(window, '__viz', { configurable: true,
  set(v){ this._v=v; const o=v.attachScene; v.attachScene=function(c){ window.__sceneCtx=c; return o.call(this,c); }; },
  get(){ return this._v; } });
// now window.__sceneCtx = { THREE, renderer, camera, scene } — the page's real objects.
```
Then measure with the page's THREE (`window.__sceneCtx.THREE`), e.g. drawn tube tip vs head:
```js
const {THREE,scene,camera,renderer}=window.__sceneCtx; let route,head;
scene.traverse(o=>{ if(o.userData?.vizId==='scene.route')route=o; if(o.userData?.vizId==='scene.route-head')head=o; });
const g=route.geometry, n=g.drawRange.count;
const tip=new THREE.Vector3().fromBufferAttribute(g.attributes.position, g.index.array[n-1]); route.localToWorld(tip);
// compare tip vs head in world units AND projected screen px; and check which param matches:
const u=n/g.index.count, path=g.parameters.path;        // TubeGeometry stores its curve as .parameters.path
// dist(path.getPointAt(u), tip) should be ~0; dist(path.getPoint(u), tip) will be large → proves arc-length.
```
This is how the `getPointAt`-vs-`getPoint` and cap-radius bugs were *settled* (a 0.004-unit centerline
match ruled out a positional gap and pointed straight at the hollow open tube mouth) instead of being
"fixed" twice in the wrong direction.

**Freeze the loop before posing a custom camera.** Render-on-demand re-renders only on scroll, so a
manual `camera.position.set(...); renderer.render(...)` you do from devtools is **overwritten by the
next ticker frame** before your screenshot. Pause the loop first (the page exposes
`window.__setModalRenderPause(true)` for exactly this), pose, render, screenshot, then unpause. Without
this you'll screenshot the scroll pose and conclude "my change did nothing."

## Auditing the popups (text-audit can't reach them)

`scripts/text-audit.mjs` loads the static page; it never opens the drill/ERD modals, so it reports
their JS-rendered bodies as clean when they're untagged. After tagging a popup, **audit it live**: open
the modal in the browser, then flag any element with a direct text child and no own `data-viz-id`:
```js
[...modal.querySelectorAll('*')].filter(n => [...n.childNodes].some(c=>c.nodeType===3 && c.textContent.trim()) && !n.hasAttribute('data-viz-id'))
```
Do this for EACH drill-down view (note: different drill tabs often have separate rail builders!) AND
the ERD — each is built by a different function, so tagging one does not tag the others. A clean
main-page `text-audit` + a live audit of every popup = real coverage.
