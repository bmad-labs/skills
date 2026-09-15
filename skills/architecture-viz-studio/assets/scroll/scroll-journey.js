/* =============================================================================
 * scroll-journey.js — GSAP ScrollTrigger choreography for the 3D journey
 * =============================================================================
 * WHAT THIS IS
 *   The scroll "director": a tall invisible scroll-driver block scrubs a single
 *   progress value `state.p` (0..1) which drives EVERYTHING — a piecewise camera
 *   path, the hero tilt-away, the step-rail activation, a comet/route draw-on,
 *   converging feeder heads, and a reveal-on-scroll batch for the DOM content.
 *
 * DEPENDS ON
 *   - gsap + ScrollTrigger (globals, loaded before this module)
 *   - three
 *   - lenis (smooth-scroll inertia — importmap entry; see SMOOTH SCROLL below)
 *   - scene-setup.js: state, REDUCED, scene, mat, PALETTE
 *   - primitives.js: glow textures etc. (for heads/packets)
 *   - DOM: #journey (scroll driver), #heroTilt, #heroScroll, #rail, .rail-item[data-step]
 *
 * HOW TO WIRE
 *   1. Give #journey a tall height (set below: 760vh) so there's scroll distance.
 *   2. This module exports `updateCamera(p)`, `camParam`, `cometParam`, the
 *      curves, and the route/feeder handles — import them into render-loop.js and
 *      call updateCamera(p) + advance the draw-ranges each frame.
 *
 * THE FOUR HARD-WON PATTERNS (read these)
 *   1. PIECEWISE PROGRESS → CURVE PARAM REMAP (camParam / cometParam)
 *      A CatmullRom camera curve is parameterized 0..1 by control point, but the
 *      scroll STEPS aren't evenly spaced. We map scroll progress `p` through a
 *      piecewise-linear table (CAM_P → CAM_U) so each camera POSE lands exactly
 *      inside its narrative step window. Edit CAM_P (the p breakpoints) to retime
 *      poses without moving the curve. cometParam does the same for the request
 *      head so it reaches each landmark at the right step.
 *
 *   2. getPointAt vs getPoint  (CRITICAL — easy to get subtly wrong)
 *      TubeGeometry samples the curve by ARC LENGTH. To keep a glow head pinned to
 *      the visible TIP of a drawn-on tube you MUST use curve.getPointAt(t) (arc-
 *      length parameterized), NOT getPoint(t) (control-point parameterized).
 *      getPoint drifts ahead/behind on unevenly-spaced control points. The camera
 *      rig uses getPoint (we WANT even-time easing between poses); the route head
 *      uses getPointAt (we want it on the tube tip). Mismatch = head floats off
 *      the line.
 *
 *   3. DRAW-ON via setDrawRange  — a tube "grows" by revealing index count
 *      0..total*progress. total = geometry.index.count. Cheap, no geometry rebuild.
 *
 *   4. CONVERGING FEEDER HEADS — N source curves each draw on with a staggered
 *      local progress, each carrying its own glow head until they reach the merge.
 *
 * SMOOTH SCROLL (Lenis) — wired at the top of this file. A mouse wheel scrubs in
 *   coarse jumps and freezes when it stops; Lenis turns that into continuous
 *   inertial motion on GSAP's single ticker, so the journey eases in AND out.
 *   Tune `duration` there. Off under reduced motion. (See playbook → "Smooth
 *   scroll".)
 *
 * REDUCED MOTION
 *   When prefers-reduced-motion, #journey height collapses to 0, Lenis is not
 *   created (native scroll, no momentum), and step 1 is shown statically — no
 *   scrub, no scene motion driven by scroll.
 * ========================================================================== */

import * as THREE from 'three';
import Lenis from 'lenis';
import { state, REDUCED, scene, mat, PALETTE as C } from '../scene/scene-setup.js';
import { brandGlowTex } from '../scene/primitives.js';

gsap.registerPlugin(ScrollTrigger);

/* ============================ SMOOTH SCROLL (Lenis) ====================== *
 * WHY THIS EXISTS — without it, a mouse wheel feels broken on a scrubbed scene.
 *   A wheel emits coarse, discrete jumps; native scroll then FREEZES the instant
 *   the wheel stops. ScrollTrigger's `scrub` smooths the catch-up TOWARD a target,
 *   but the target itself still leaps per tick, and when input stops the camera
 *   dies mid-motion instead of easing to rest. The two symptoms users report are
 *   "animation races on a fast flick" and "animation stops the moment I stop
 *   scrolling" — both are the native-scroll discreteness, not your scrub value.
 *
 * THE FIX — Lenis converts wheel/key/touch input into a CONTINUOUS, inertial
 *   scroll position, driven on GSAP's single ticker (no second rAF loop, so your
 *   fps cap and render-pause still hold). `scrub` then rides a smooth value and
 *   the camera eases in AND out. This is the right layer for the job; do not try
 *   to "fix" jerk by cranking scrub alone — past ~1.5 it just feels laggy.
 *
 * Disabled under prefers-reduced-motion (native scroll, zero momentum).
 * Tuning knobs are right here — `duration` is the glide length in seconds. */
export let lenis = null;
if (!REDUCED) {
  lenis = new Lenis({
    duration: 1.1,                              // inertia length (s) — ↑ floatier, ↓ snappier (try 0.8–1.5)
    wheelMultiplier: 0.9,                       // <1 tames aggressive wheel flicks
    easing: (t) => 1 - Math.pow(1 - t, 3),      // easeOutCubic — natural settle
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);     // keep ScrollTrigger in sync with Lenis' position
  gsap.ticker.add((time) => lenis.raf(time * 1000));  // ONE clock for GSAP + Lenis + the render loop
  gsap.ticker.lagSmoothing(0);                  // don't let GSAP "skip" after a stall — keeps scroll honest
}
// MODALS: when a drill/ERD modal opens, call `lenis.stop()` (and `lenis.start()` on
// close) so the page doesn't scroll behind it. That alone is NOT enough — Lenis still
// owns the wheel listener, so the modal's own scrollable panes can't scroll. ALSO put
// `data-lenis-prevent` on the modal panel (see page-shell/index.html) so Lenis ignores
// wheel events inside it. Both together = page locked, modal scrolls natively.

/* ============================ THE ROUTE + FEEDERS ========================= *
 * EXAMPLE geometry — replace control points with your own landmark path. */

// THE main route — one continuous curve the "request" draws to the very end.
export const journeyCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-12, 0.45, 3.7),
  new THREE.Vector3(-2, 0.45, 4),
  new THREE.Vector3(20, 0.45, -2),
  new THREE.Vector3(50, 0.45, -8),
  new THREE.Vector3(70, 0.45, 0),
  new THREE.Vector3(90, 0.45, 8),
  new THREE.Vector3(128, 0.45, 9),
  new THREE.Vector3(152, 0.45, 4),
  new THREE.Vector3(178, 0.45, 2),
  new THREE.Vector3(193, 0.45, 10),
]);
export const routeGeo = new THREE.TubeGeometry(journeyCurve, 360, 0.28, 8, false);
export const routeMesh = new THREE.Mesh(routeGeo, new THREE.MeshStandardMaterial({
  color: C.brand, emissive: C.brand, emissiveIntensity: 0.45, roughness: 0.4,
}));
routeMesh.geometry.setDrawRange(0, 0);   // starts undrawn; the loop grows it
scene.add(routeMesh);
export const routeTotal = routeGeo.index.count;

// The request head — a brand-colour additive glow riding the tube TIP.
export const cometHead = new THREE.Sprite(new THREE.SpriteMaterial({
  map: brandGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
}));
cometHead.scale.set(4.6, 4.6, 1);
scene.add(cometHead);

// Converging feeders: N source curves → one merge point, each with its own head.
export const feeders = [];
[[-62, 2], [-56, -12], [-52, 16]].forEach(([fx, fz]) => {   // EXAMPLE source positions
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(fx, 0.4, fz),
    new THREE.Vector3((fx - 30) / 2, 0.4, (fz + 3) / 2),
    new THREE.Vector3(-30, 0.4, 3),
    new THREE.Vector3(-12, 0.4, 3.7),       // shared merge point
  ]);
  const geo = new THREE.TubeGeometry(c, 64, 0.26, 8, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: C.brand, emissive: C.brand, emissiveIntensity: 0.45, roughness: 0.4,
  }));
  mesh.geometry.setDrawRange(0, 0);
  scene.add(mesh);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: brandGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  head.scale.set(3.4, 3.4, 1);
  scene.add(head);
  feeders.push({ mesh, total: geo.index.count, curve: c, head });
});

/* ============================ CAMERA RIG ================================== *
 * Two CatmullRom curves — eye position and look-at target — sampled in lockstep.
 * 'centripetal' parameterization avoids the cusps/overshoot plain Catmull-Rom
 * gets on uneven control points. EXAMPLE poses — one per narrative step. */
export const camPos = new THREE.CatmullRomCurve3([
  new THREE.Vector3(54, 60, 96),     // overview — high diorama
  new THREE.Vector3(-64, 46, 82),    // landmark A
  new THREE.Vector3(26, 38, 68),     // hub
  new THREE.Vector3(100, 50, 64),    // landmark B
  new THREE.Vector3(104, 44, 80),    // gates
  new THREE.Vector3(164, 46, 74),    // landmark C
  new THREE.Vector3(212, 64, 88),    // finale
], false, 'centripetal');
export const camLook = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 2, -8),
  new THREE.Vector3(-48, 0, 0),
  new THREE.Vector3(0, 6, 0),
  new THREE.Vector3(50, 6, -16),
  new THREE.Vector3(108, 2, 8),
  new THREE.Vector3(176, 4, -12),
  new THREE.Vector3(208, 0, 4),
], false, 'centripetal');

const _pos = new THREE.Vector3(), _look = new THREE.Vector3();

/* PIECEWISE PROGRESS → CAMERA PARAM (see header pattern #1).
 * CAM_P = scroll-progress breakpoints; CAM_U = matching curve params (even 0..1).
 * mapLinear remaps p within its segment so each pose lands in its step window. */
const CAM_P = [0, 0.13, 0.24, 0.40, 0.62, 0.82, 1];
const CAM_U = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
export function camParam(p) {
  for (let i = 1; i < CAM_P.length; i++) {
    if (p <= CAM_P[i]) return THREE.MathUtils.mapLinear(p, CAM_P[i - 1], CAM_P[i], CAM_U[i - 1], CAM_U[i]);
  }
  return 1;
}

/* PIECEWISE PROGRESS → COMET PARAM — the request head reaches each landmark at
 * the right step. Independent table from the camera so head + camera can lead/lag. */
const COMET_P = [0.125, 0.24, 0.42, 0.56, 0.72, 0.86, 0.955];
const COMET_U = [0, 0.05, 0.30, 0.505, 0.683, 0.9, 1];
export function cometParam(p) {
  if (p <= COMET_P[0]) return 0;
  for (let i = 1; i < COMET_P.length; i++) {
    if (p <= COMET_P[i]) return THREE.MathUtils.mapLinear(p, COMET_P[i - 1], COMET_P[i], COMET_U[i - 1], COMET_U[i]);
  }
  return 1;
}

/* Move the camera. Uses getPoint (control-point param) on PURPOSE — we want even
 * easing between poses, not arc-length. A tiny breathing wobble at the very start. */
export function updateCamera(p) {
  const eased = camParam(THREE.MathUtils.clamp(p, 0, 1));
  camPos.getPoint(eased, _pos);
  camLook.getPoint(eased, _look);
  if (p < 0.06) {                                  // gentle idle drift on the hero
    _pos.x += Math.sin(state.time * 0.25) * 0.7;
    _pos.y += Math.sin(state.time * 0.18) * 0.4;
  }
  camera_position_apply(_pos, _look);
}
// kept separate so render-loop owns the actual camera object import if preferred
import { camera } from '../scene/scene-setup.js';
function camera_position_apply(pos, look) { camera.position.copy(pos); camera.lookAt(look); }

/* ----- Per-frame draw-on helpers (call these from render-loop's frame) ----- */

const _head = new THREE.Vector3();

/* Grow the feeder tubes during the step-01 ramp; three glow heads converge.
 * (getPointAt — heads must sit on the drawn tube tip.) */
export function tickFeeders(p, dt) {
  const fp = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(p, 0.06, 0.125, 0, 1), 0, 1);
  feeders.forEach((f, i) => {
    const local = THREE.MathUtils.clamp(fp * 1.2 - i * 0.08, 0, 1);   // staggered start per feeder
    f.mesh.geometry.setDrawRange(0, Math.floor(f.total * local));
    const alive = local > 0.015 && local < 0.995 && p < 0.13;
    f.curve.getPointAt(local, _pos);
    f.head.position.copy(_pos).setY(1.0);
    f.head.material.opacity += ((alive ? 0.85 : 0) - f.head.material.opacity) * Math.min(dt * 10, 1);
  });
}

/* Grow THE route to the request's reach and pin the head to the tube tip.
 * Returns the head world position so callers can drive a halo grid / beacons. */
export function tickRoute(p) {
  const ct = cometParam(p);
  routeMesh.geometry.setDrawRange(0, Math.floor(routeTotal * ct));
  const visible = p > 0.118 && p < 1.0;
  // getPointAt (arc-length) — TubeGeometry samples by arc length, so the head stays on the tip.
  journeyCurve.getPointAt(ct, _head);
  cometHead.position.copy(_head).setY(1.1);
  cometHead.material.opacity = visible ? 0.9 : 0;
  return _head;
}

/* ============================ SCROLL WIRING ============================== */
const journeyEl = document.getElementById('journey');
journeyEl.style.height = REDUCED ? '0px' : '760vh';   // scroll distance for the whole journey

const heroTilt = document.getElementById('heroTilt');
const heroScroll = document.getElementById('heroScroll');
const rail = document.getElementById('rail');
const railItems = [...document.querySelectorAll('.rail-item')];

// Step windows in progress space — drive which rail item is active.
const STEPS = [
  { from: 0.08, to: 0.30 },
  { from: 0.30, to: 0.52 },
  { from: 0.52, to: 0.74 },
  { from: 0.74, to: 1.01 },
];
function setStep(p) {
  let active = -1;
  STEPS.forEach((s, i) => { if (p >= s.from && p < s.to) active = i; });
  railItems.forEach((el, i) => el.classList.toggle('active', i === active));
  rail.style.opacity = p > 0.07 ? 1 : 0;
}

if (!REDUCED) {
  ScrollTrigger.create({
    trigger: journeyEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,                       // smooths progress so motion isn't jittery on fast scroll
    onUpdate(self) {
      state.p = self.progress;        // THE single value everything reads
      // hero tilt-away: rotateX past the top in the first ~8.5% of scroll
      const ht = THREE.MathUtils.clamp(state.p / 0.085, 0, 1);
      heroTilt.style.transform = `rotateX(${ht * 58}deg) translateY(${-ht * 16}vh)`;
      heroTilt.style.opacity = String(1 - ht);
      heroScroll.style.opacity = String(1 - THREE.MathUtils.clamp(state.p / 0.04, 0, 1));
      setStep(state.p);
    },
  });

  // reveal-on-scroll: tag content, batch-fade it in once as it enters the viewport.
  document.querySelectorAll('.band-title, .band-sub, .card, .flow-node, .flow-arrow, .stat')
    .forEach((el) => el.classList.add('reveal'));
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }),
    once: true,
  });
} else {
  state.p = 0;
  rail.style.opacity = 1;
  railItems[0]?.classList.add('active');
}
