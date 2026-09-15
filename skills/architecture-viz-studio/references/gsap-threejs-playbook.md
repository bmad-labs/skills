# GSAP + Three.js Playbook

Operating knowledge and gotchas for building cinematic scroll-story + interactive 3D architecture pages with GSAP/ScrollTrigger and Three.js. Read the rule you need; don't read top-to-bottom.

## Table of contents
- [ScrollTrigger: scrub vs toggle, pinning](#scrolltrigger-scrub-vs-toggle-pinning)
- [Smooth scroll: the mouse-wheel jerk fix (Lenis)](#smooth-scroll)
- [The piecewise progress→param remap (camera poses land in scroll windows)](#piecewise-remap)
- [Camera paths with CatmullRomCurve3](#camera-paths-with-catmullromcurve3)
- [getPointAt (arc-length) vs getPoint (raw param) — the critical distinction](#getpointat-vs-getpoint)
- [Draw-on tubes with TubeGeometry + setDrawRange](#draw-on-tubes)
- [InstancedMesh for repeated objects](#instancedmesh)
- [Canvas-texture trick for labels / logos / corrugation](#canvas-texture)
- [Sprite glows with AdditiveBlending](#sprite-glows)
- [RoundedBoxGeometry, shadows, the soft low-poly look](#roundedbox-shadows)
- [Analytic cubic-bezier tangent for labels along a curve](#bezier-tangent)
- [PERFORMANCE — the render-pause pattern and the rest](#performance)
- [Common bugs we hit and their fixes](#common-bugs)

---

## ScrollTrigger: scrub vs toggle, pinning

**`scrub`** ties animation progress directly to scroll position — the timeline plays forward when scrolling down, reverses when scrolling up. Use it for the *journey* (camera flythrough, route draw-on, anything that should feel "scrubbed" frame-by-frame). Use a **numeric** scrub (`scrub: 0.8`) not `scrub: true` — the number is a catch-up lag in seconds that smooths jitter on fast scroll/trackpad flings. `true` snaps 1:1 and looks twitchy.

```js
ScrollTrigger.create({
  trigger: '#journey',
  start: 'top top', end: 'bottom bottom',
  scrub: 0.8,                 // smoothing, not 1:1
  onUpdate: (self) => { state.p = self.progress; },  // 0..1 → your render loop reads it
});
```

**Toggle actions** (`toggleActions: 'play none none reverse'`) fire a discrete animation at a boundary — use for reveal-on-enter content (`.reveal` elements), nav state flips, not for scrubbed motion.

**Pinning**: to hold the 3D stage fixed while content scrolls "through" it, prefer a **fixed-position canvas** (`.stage { position: fixed; inset:0; z-index:0 }`) plus a tall invisible **scroll-driver** element (`#journey { height: 760vh }`) whose progress you read in `onUpdate`. This is more robust than ScrollTrigger `pin: true`, which clones/wraps DOM and fights other layout. Reserve real `pin` for a single short pinned rail (e.g. a step list beside the scene). Never nest two pins on the same scroll axis.

The scroll distance (`760vh` in the shell) *is* the pacing knob — more vh = slower, more cinematic; fewer = snappier. Set it to `0` under reduced motion (see below).

**`scrub` is not the whole answer for mouse wheels.** A numeric scrub smooths the *catch-up* toward a target, but the target is still native scroll position — which a wheel moves in coarse, discrete jumps, and which stops dead the instant the wheel stops. So on a wheel you still get "races on a fast flick, freezes when I stop." The cure is a smooth-scroll inertia layer, not a bigger scrub number — see the next section.

---

<a id="smooth-scroll"></a>
## Smooth scroll: the mouse-wheel jerk fix (Lenis)

**Symptom (reported by basically every first scroll-story user):** with a trackpad it feels fine, but with a **mouse wheel** the animation "runs too fast on a quick flick" and "stops the moment I stop scrolling." Both are the same root cause — **native scroll is discrete**. A wheel notch is an instantaneous jump of N pixels; between notches there is no scroll event at all. `scrub: 0.8` eases the timeline *toward* `self.progress`, but `self.progress` itself leaps per notch and goes silent the moment input stops, so the camera lurches and then halts mid-move.

**Do not "fix" this by raising scrub.** Past ~1.5 the page just feels laggy and disconnected — the motion floats behind your intent. The right fix is to make the *scroll position itself* continuous and inertial, then let your normal `scrub` ride on top of it.

**Use [Lenis](https://github.com/darkroomengineering/lenis)** (free, MIT, the de-facto choice — `ScrollSmoother` is GSAP-Club-only, don't assume the user has it). Lenis intercepts wheel/key/touch and emits a smoothed, momentum-carrying scroll position. Drive it on **GSAP's single ticker** so you don't spin up a second `requestAnimationFrame` loop — that keeps your fps cap and render-pause logic intact.

```js
import Lenis from 'lenis';   // importmap: "lenis": ".../lenis@1.1.18/dist/lenis.mjs"

let lenis = null;
if (!REDUCED) {                                  // native scroll under reduced-motion — no momentum
  lenis = new Lenis({
    duration: 1.1,                               // glide length in seconds — the main feel knob
    wheelMultiplier: 0.9,                         // <1 tames aggressive wheel flicks
    easing: (t) => 1 - Math.pow(1 - t, 3),       // easeOutCubic — natural settle
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);      // keep ScrollTrigger synced to Lenis' position
  gsap.ticker.add((time) => lenis.raf(time * 1000));  // ONE clock — no 2nd rAF, fps cap still applies
  gsap.ticker.lagSmoothing(0);                   // don't let GSAP skip-ahead after a stall
}
```

That's the whole change — your existing `scrub`, fps cap, and render-pause are untouched and now ride a continuous value, so the camera eases in *and* eases out to rest. The bundled `assets/scroll/scroll-journey.js` ships this wired by default; the `lenis` importmap entry is already in `assets/page-shell/index.html`.

**Feel tuning (one knob, mostly):**
- `duration` — the glide length. `0.8` ≈ crisp/responsive, `1.1` ≈ default, `1.5` ≈ floaty/cinematic. This is the dial the user actually means when they say "more/less smooth."
- `wheelMultiplier` — lower it (`0.7–0.9`) if fast flicks overshoot; raise toward `1` if scrolling feels heavy.
- Pair with `scrub` deliberately: Lenis smooths the *input*, scrub smooths the *timeline*. Keep scrub modest (`0.6–1.0`) once Lenis is in — they compound, and too much of both feels mushy.

**Gotchas:**
- Lenis must be on the **same ticker** as your render loop. A separate `lenis.raf` rAF loop double-schedules against `gsap.ticker` and reintroduces jitter — add it via `gsap.ticker.add` as above.
- The ESM build is `dist/lenis.mjs` (default export). The `/+esm` jsDelivr variant works too, but pin a version so a CDN bump can't silently change the feel.
- If you anchor-scroll or jump programmatically, call `lenis.scrollTo(target)` — a raw `window.scrollTo` bypasses the smoothing and snaps.
- Turn it **off** under `prefers-reduced-motion` (as above) — momentum scrolling is exactly what that setting asks you not to do.

---

## Piecewise remap

A CatmullRom curve is parameterized 0..1, but you rarely want camera param == scroll progress. You want **named poses to land in specific scroll windows** (pose 3 dwells from 24%→40% of the scroll, etc.). Solve with a piecewise linear remap: a table of scroll-progress breakpoints `CAM_P` and matching curve params `CAM_U`, then `mapLinear` within the active segment.

```js
const CAM_P = [0, 0.13, 0.24, 0.40, 0.62, 0.82, 1];   // scroll-progress breakpoints
const CAM_U = [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1];        // even curve params (one per control pt)
export function camParam(p) {
  for (let i = 1; i < CAM_P.length; i++)
    if (p <= CAM_P[i]) return THREE.MathUtils.mapLinear(p, CAM_P[i-1], CAM_P[i], CAM_U[i-1], CAM_U[i]);
  return 1;
}
```

Keep **independent tables** for things that should lead or lag each other (camera vs the "comet"/request head). Stretching a `CAM_P` interval = the camera lingers there; compressing it = a fast push-in. This table is the single place a human says "hold longer on the database" — easy to tweak. Pair each window with copy/reveal triggers at the same breakpoints so text and camera stay in sync.

---

## Camera paths with CatmullRomCurve3

Drive the camera with **two** curves sampled in lockstep — an **eye-position** curve and a **look-at-target** curve — so the camera can dolly and pan independently:

```js
export const camPos  = new THREE.CatmullRomCurve3([...], false, 'centripetal');
export const camLook = new THREE.CatmullRomCurve3([...], false, 'centripetal');
const _pos = new THREE.Vector3(), _look = new THREE.Vector3();
function updateCamera(p) {
  const u = camParam(p);
  camPos.getPoint(u, _pos);    // see getPoint vs getPointAt below
  camLook.getPoint(u, _look);
  camera.position.copy(_pos); camera.lookAt(_look);
}
```

Use **`'centripetal'`** CatmullRom (the third arg) — it prevents the cusps/overshoot loops that the default `'catmullrom'` parameterization produces when control points are unevenly spaced. Reuse module-scoped `_pos`/`_look` vectors; never allocate `new Vector3()` inside the frame loop.

A subtle idle drift (`_pos.x += Math.sin(time*0.25)*0.7`) on the very first frames (e.g. `p < 0.06`) makes the static hero feel alive without scroll.

---

## getPointAt vs getPoint

**This is the single easiest thing to get subtly wrong.** A curve has two parameterizations:

- **`getPoint(t)`** — `t` indexes *control points* (raw spline param). Spacing is uneven if your control points are unevenly spaced; the point drifts ahead/behind in world space. **Use this for the camera rig** — you *want* even-time easing between named poses, not constant world speed.
- **`getPointAt(t)`** — `t` is **arc length** (constant world-space speed along the curve). **Use this for anything pinned to the visible tip of a drawn-on tube**, because `TubeGeometry` samples the curve *by arc length*. A glow "head" must sit on the tube tip → `getPointAt`.

```js
// CAMERA — even easing between poses → getPoint
camPos.getPoint(camParam(p), _pos);

// ROUTE HEAD — must sit on the TubeGeometry tip → getPointAt (arc length)
journeyCurve.getPointAt(cometParam(p), _head);
cometHead.position.copy(_head).setY(1.1);
```

Mismatch symptom: the glow head **floats off the tube** (leads or trails the drawn tip), worse on curves with bunched control points. If you see that, you used `getPoint` where you needed `getPointAt`. (`getTangentAt` vs `getTangent` follows the same rule.)

---

## Draw-on tubes

Animate a path "drawing itself" by building the full `TubeGeometry` once and revealing it with `setDrawRange` — far cheaper than rebuilding geometry per frame.

```js
const routeGeo  = new THREE.TubeGeometry(curve, 360, 0.28, 8, false);  // 360 tubular segments
const routeMesh = new THREE.Mesh(routeGeo, mat);
const routeTotal = routeGeo.index.count;                    // total indices to reveal
function tickRoute(p) {
  const t = cometParam(p);
  routeMesh.geometry.setDrawRange(0, Math.floor(routeTotal * t));   // reveal up to fraction t
  curve.getPointAt(t, _head);                                       // head on the tip
}
```

Gotchas: `setDrawRange` operates on the **index** count for indexed geometry (use `geo.index.count`), not vertex count. Higher tubular-segment count = smoother reveal but more geometry; 64 is plenty for short feeders, ~360 for the hero route. Stagger multiple feeder tubes by offsetting each one's local progress (`fp*1.2 - i*0.08`) so they don't all start at once.

**The drawn tip is revealed by ARC LENGTH → the head MUST use `getPointAt`, never `getPoint`.**
`setDrawRange(0, floor(total*t))` exposes the tube up to arc-length fraction `t` (TubeGeometry's rings
follow the curve by arc length). So a glow/sphere "head" pinned to the tip uses `curve.getPointAt(t)`.
Using `getPoint(t)` (raw spline param) puts the head **wildly off the drawn tip** on any unevenly-spaced
curve — measured ~7–8 world units / ~85px adrift mid-journey, leaving the tube's bare cut end poking
out in open space. This is *the* tube-head bug and it's seductive to "fix" it the wrong way twice;
**trust `getPointAt` and verify by measuring the live gap** (see visual-verification → "reach into the
running scene"): the drawn-tip vertex and `getPointAt(t)` should coincide within ~1px on screen.

**`TubeGeometry` is single-sided and OPEN-ended — the revealed tip is a hollow flat ring.** Looking
into the mouth shows the inner back wall (a lighter ring / "broken pipe / forked" look), and a soft glow
sprite alone doesn't reliably mask it. Cap it with a small sphere riding the tip — but the cap radius
**must be LARGER than the tube radius**, not equal: a same-radius sphere only touches the rim and the
hollow interior still shows around it (the user reports "a gap between the tube and the sphere").
~1.2× the tube radius plugs the mouth from every angle:
```js
const cap = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius * 1.2, 16, 12), tubeMat); // NOT == tubeRadius
function tickRoute(p) { const t = cometParam(p);
  routeMesh.geometry.setDrawRange(0, Math.floor(routeTotal * t));
  curve.getPointAt(t, _head); cap.position.copy(_head); head.position.copy(_head); // cap, glow, line all meet here
}
```
Do **not** instead pull the draw range *back* a few segments to "tuck" the cut under the glow — that
just opens a visible gap between the tube body and the head. Draw to the full `t`; cap the tip.

---

## InstancedMesh

For many identical objects (crates, crowds of people, trees, cars) use one `InstancedMesh` instead of N meshes — one draw call, a huge win. Each instance gets a matrix (and optionally per-instance color).

```js
const mesh = new THREE.InstancedMesh(geo, material, count);
const m = new THREE.Matrix4();
for (let i = 0; i < count; i++) {
  m.compose(positions[i], quats[i], scale);   // or makeTranslation etc.
  mesh.setMatrixAt(i, m);
  mesh.setColorAt(i, colorFor(i));            // optional; needs instanceColor
}
mesh.instanceMatrix.needsUpdate = true;
if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
mesh.castShadow = mesh.receiveShadow = true;
```

Split into ≤2 instanced meshes if you need two material variants (e.g. branded vs neutral containers) rather than per-instance materials (instances can't have different materials, only different colors). For static instances, set `mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)`. Always `needsUpdate = true` after writing matrices/colors or nothing renders.

---

## Canvas-texture

Put text, logos, wordmarks, signage, or corrugation onto a face **without loading image files** by drawing to a 2D `<canvas>` and wrapping it in `CanvasTexture`:

```js
function makeCanvasTexture(draw, w = 512, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;                 // match renderer output
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();  // crisp at grazing angles
  return tex;
}
```

Always set `colorSpace = SRGBColorSpace` (or colors wash out) and bump `anisotropy` (or text gets blurry at angles). For corrugation, draw vertical light/dark stripes; for labels, draw text centered. This is the right tool for any in-world signage and the building-side branding chips.

**Face order matters**: a `BoxGeometry` material array is `[+x, -x, +y, -y, +z, -z]`. If your corrugated sides land on the wrong faces or the "doored end" of a container is on top, you have the face order wrong — reorder the 6-material array, don't rotate the box.

---

## Sprite glows

Soft glows/halos/beacons are radial-gradient sprite textures with `AdditiveBlending` so they brighten whatever's behind them:

```js
function glowTexture(color) {
  return makeCanvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}
const m = new THREE.SpriteMaterial({ map: glowTexture('#85d3d1'),
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const glow = new THREE.Sprite(m);  // always faces camera
```

`depthWrite: false` stops the sprite from punching a hole in the depth buffer (other glows behind it would vanish). `AdditiveBlending` means **black is transparent** — use a transparent-edged gradient and never a solid background. Animate `material.opacity` toward a target with a dt-lerp for soft fade-in/out (see render loop).

---

## RoundedBox + shadows

The soft low-poly look = **`RoundedBoxGeometry`** (from `three/addons/geometries/RoundedBoxGeometry.js`) for every box-shaped object — buildings, plinths, containers. The 1–2px-equivalent rounded edge catches light and reads as "designed" rather than "default cube."

```js
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const geo = new RoundedBoxGeometry(w, h, d, 4, Math.min(w,h,d) * 0.06);  // segments, radius
```

Keep the radius a small fraction of the smallest dimension (~6%) so it stays crisp, not a pillow.

**Shadow setup** (in scene bootstrap):
```js
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // soft edges
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);                 // 2048 only if you see aliasing
// Tighten the ortho frustum to JUST cover the world — sharper shadows per texel:
const s = sun.shadow.camera; s.left=-160; s.right=200; s.top=120; s.bottom=-120; s.near=1; s.far=400;
s.updateProjectionMatrix();
```

A long horizontal world wants an **asymmetric** shadow frustum (wide L/R, narrow T/B). A frustum bigger than the scene wastes shadow texels → soft mush. Every shadow-casting object needs `castShadow=true`; the ground needs `receiveShadow=true`.

---

## Bezier tangent

To rotate a label so it **reads along a curved relation edge** (ERD verb labels, flow annotations), place it at the cubic bezier's `t=0.5` point and rotate it to the **analytic tangent** there. The cubic-bezier derivative:

```
dP/dt = 3(1−t)²(P1−P0) + 6(1−t)t(P2−P1) + 3t²(P3−P2)
```

```js
function bezierTangent(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return {
    x: 3*u*u*(p1.x-p0.x) + 6*u*t*(p2.x-p1.x) + 3*t*t*(p3.x-p2.x),
    y: 3*u*u*(p1.y-p0.y) + 6*u*t*(p2.y-p1.y) + 3*t*t*(p3.y-p2.y),
  };
}
const tan = bezierTangent(0.5, p0, p1, p2, p3);
let angle = Math.atan2(tan.y, tan.x);
angle = Math.max(-Math.PI/2, Math.min(Math.PI/2, angle));  // clamp ±90° so text stays upright
```

Use the **analytic** derivative, not a finite-difference of two sampled points — it's exact and jitter-free. Clamp to ±90° or labels flip upside-down on leftward edges. (For 3D SVG-on-curve labels the same math applies in 2D screen space after projection.)

---

## Performance

### The render-pause pattern (the big one)
The single largest CPU/GPU win: **pause the render ticker whenever the 3D stage is off-screen or a modal is open.** A `requestAnimationFrame`/ticker loop runs forever by default, burning GPU on a scene nobody can see. Gate it.

```js
let renderRunning = false;
function start() { if (!renderRunning && !document.hidden) { renderRunning = true; gsap.ticker.add(frame); } }
function stop()  { if (renderRunning) { renderRunning = false; gsap.ticker.remove(frame); } }

// Pause when the stage scrolls away:
ScrollTrigger.create({ trigger: '#journey', start: 'top bottom', end: 'bottom top',
  onToggle: (self) => self.isActive ? start() : stop() });
// Pause when a drill-down modal is open, resume on close:
function openModal() { stop(); /* ... */ }
function closeModal() { start(); /* ... */ }
// Pause on tab hide:
document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
```

Combined with the fps cap this roughly **halved** GPU/CPU use in our session. It also stops fans spinning while the user reads text.

### Render-on-demand (the bigger win — make this the default)
Pausing when off-screen helps, but a scene that's *on*-screen and idle still renders 60fps for no reason. The larger lever: **render only when something actually changed.** Couple all motion to scroll progress `p` (not a free-running clock), set a `needsRender` flag on scroll/resize, and render only when it's set. When the user stops scrolling, the scene is static and you render **nothing → idle GPU ≈ 0** (measured: hundreds of draw-calls/sec → 0).

```js
let needsRender = true;                                   // first paint
ScrollTrigger.create({ trigger: document.body, start:'top top', end:'bottom bottom', scrub: .6,
  onUpdate: (self) => { state.p = self.progress; needsRender = true; } });
addEventListener('resize', () => { /* resize renderer */ needsRender = true; });

function renderOnce() {
  // drive animation off p, NOT off a free clock → idle = static:
  ring.rotation.z = state.p * Math.PI * 4;
  camera.position.set(/* …f(p)… */); camera.lookAt(/* … */);
  renderer.render(scene, camera);
}
gsap.ticker.add(() => { if (needsRender && stageVisible && !document.hidden) { renderOnce(); needsRender = false; } });
```
Only fall back to always-render-when-visible if you have **genuinely continuous ambient motion** that must run with zero input (free-spinning turbines, perpetually flowing packets) — and even then, prefer coupling it to `p` or a slow gsap tween so you can stay on-demand. The bundled `assets/scene/render-loop.js` implements both modes (a `needsRender` flag + a `CONTINUOUS` switch).

### Mandatory performance checklist — run this EVERY time you finish a 3D scene
A 3D page that melts the GPU has failed, no matter how good it looks. Before you call a scene done, verify every line:

- [ ] **Idle GPU is ~0.** Stop scrolling for 2s and confirm the scene renders **no frames** (render-on-demand). If it can't be on-demand (continuous motion), confirm it at least pauses off-screen.
- [ ] **Off-screen pause.** Scroll the 3D stage out of view → rendering stops (IntersectionObserver / scroll-edge gate).
- [ ] **Tab-hidden pause.** Switch tabs → loop stops (`visibilitychange`). Modal open → `__setModalRenderPause(true)`.
- [ ] **fps capped** at 60 (`gsap.ticker.fps(60)`), and GSAP's ticker is the **single** clock — no second `requestAnimationFrame` loop double-scheduling.
- [ ] **DPR capped** — `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5–1.75))`. Never uncapped on retina/mobile.
- [ ] **Repeated meshes are instanced** (`InstancedMesh`) — containers, windows, dots, people. Draw calls in the low dozens, not hundreds.
- [ ] **Shadow map ≤ 1024** with a tight light frustum unless you *see* aliasing. Disable shadows on objects that don't need them.
- [ ] **No per-frame allocation** — reuse module-scoped `Vector3`/`Matrix4`/`Color`; clamp `dt` (`Math.min(dt, 0.05)`).
- [ ] **Geometry/material reuse** — share materials across identical meshes; don't build a new geometry per object in a loop.
- [ ] **Dispose on teardown** — if the scene is ever rebuilt/removed, `geometry.dispose()` / `material.dispose()` / `texture.dispose()` and `renderer.dispose()` to avoid GPU memory leaks.
- [ ] **Measure it.** Run `scripts/verify.mjs` (reports scroll jank/long-tasks) and spot-check draw calls: wrap `gl.drawElements`/`gl.drawArrays` and count over 2s idle (expect 0) and while scrolling. Don't trust "looks smooth" — measure.

### The rest of the budget
- **`gsap.ticker.fps(60)`** — cap the loop. It ran uncapped (~120fps on a ProMotion display) = double the GPU work for no perceptible gain. Use `gsap.ticker` as the single clock for both GSAP and the render frame so they never double-schedule.
- **DPR cap** — `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))`. On a 3× phone, uncapped quadruples fragment work for ~zero visible gain on a soft pastel scene. 1.75 keeps edges crisp. Measured win — don't raise casually.
- **Shadow map size** — 1024 is usually enough with a tight frustum; go 2048 only if you *see* shadow aliasing. 4096 is almost never worth it.
- **Instancing** — see above; the difference between 200 draw calls and 2.
- **Clamp dt** — `gsap.ticker` gives you `dtMs`; clamp it (`Math.min(dt, 0.05)`) so a tab-restore or stutter can't make one giant jump that flings the camera.
- **Don't allocate in the frame** — reuse module-scoped `Vector3`/`Matrix4`/`Color` scratch objects.

---

## Common bugs

| Symptom | Cause | Fix |
|---|---|---|
| Glow head floats off the tube tip | used `getPoint` (raw param) where arc-length needed | use `getPointAt` for anything on a `TubeGeometry` tip |
| Gap / hollow "forked" ring between tube body and head | open single-sided tube mouth; cap radius == tube radius (only touches rim) | cap the tip with a sphere ~1.2× the tube radius at `getPointAt(t)`; don't tuck the draw range back |
| Wheel scroll inside a drill/ERD modal moves the page behind it | Lenis owns the wheel globally; `lenis.stop()` doesn't release it | `data-lenis-prevent` on the modal panel (+ `overscroll-behavior:contain` on scroll panes) |
| 3D object still selectable after scrolling to another section | `isOverCanvas` tested the canvas rect, not visible exposure | walk `elementsFromPoint`; allow 3D only if the canvas is reached before any opaque layer |
| "I tagged/fixed it but it still shows missing" | browser served stale cached `main.js`/`styles.css` | hard reload (`navigate_page type:reload ignoreCache:true`) |
| Camera speeds up/slows weirdly between poses | `getPointAt` (constant speed) where you wanted even easing | use `getPoint` for the camera rig + the piecewise remap |
| Draw-on tube never appears / appears fully instantly | passed vertex count to `setDrawRange` on indexed geo, or forgot `Math.floor` | use `geo.index.count`, floor the product |
| Container sides corrugated on wrong faces / door on top | wrong material array order | order is `[+x,-x,+y,-y,+z,-z]` |
| In-world text/logo washed out or blurry at angles | missing `colorSpace=SRGB` and/or low `anisotropy` | set both on the `CanvasTexture` |
| Glow sprite hides glows behind it / shows a black square | `depthWrite:true` and/or non-additive blending with solid bg | `AdditiveBlending`, `depthWrite:false`, transparent-edged gradient |
| Camera lurches after switching tabs/scrolling fast | unclamped `dt` jump | clamp dt to ~0.05s |
| Instances invisible after moving them | forgot `needsUpdate` | `instanceMatrix.needsUpdate = true` (and `instanceColor` if used) |
| Spline cusps/loops on the camera path | default catmullrom param on uneven points | pass `'centripetal'` |
| Soft "mushy" shadows | shadow frustum far larger than the world | tighten ortho frustum to just cover the scene |
| Page pins fight / jumpy layout | nested ScrollTrigger pins or pinning the fixed canvas | fixed canvas + tall scroll-driver, pin at most one rail |
| Mouse-wheel animation races on a flick / freezes when you stop | native scroll is discrete; `scrub` alone can't fix it | add a Lenis smooth-scroll layer on GSAP's ticker (see "Smooth scroll") — don't just raise scrub |
| Fans/GPU keep running while reading text or in a modal | ticker never paused | apply the render-pause pattern |
| ERD verb label upside-down on a leftward edge | tangent angle not clamped | clamp rotation to ±90° |
