/* =============================================================================
 * render-loop.js — the frame() loop + the RENDER-PAUSE performance system
 * =============================================================================
 * WHAT THIS IS
 *   Two things:
 *   1. A `frame(time, dtMs)` loop that ticks every per-frame animation (turbine
 *      rotors, idle bobs, flowing packets, the route/comet draw-on, halo grid,
 *      pulse rings, event arcs, milestone beacons, label fades) and renders.
 *   2. The RENDER-PAUSE system — the single most important perf win in this page.
 *      The 3D canvas is position:fixed so it "covers" the viewport forever; once
 *      the reader scrolls into the opaque content/diagram sections it is fully
 *      hidden, yet a naive loop keeps rendering it at full cost. We GATE the loop:
 *      stop it when the stage is off-screen, when a modal is open, or when the tab
 *      is hidden. Combined with an fps cap this roughly HALVED GPU/CPU use.
 *
 *   PICK YOUR RENDER MODE (this is the biggest GPU lever):
 *   - RENDER-ON-DEMAND (default, lowest GPU): only render when something actually
 *     changed — scroll moved, resize, a modal animated. When the user stops
 *     scrolling, the scene is STATIC and we render NOTHING → idle GPU ≈ 0. Use
 *     this when motion is driven by scroll progress `p` (the common case). Drive
 *     scroll-coupled animations (ring rotation, comet position) off `p` inside
 *     renderOnce, set `needsRender = true` in the ScrollTrigger onUpdate/resize.
 *   - ALWAYS-ON (only if you have CONTINUOUS ambient motion that must run with no
 *     input — free-spinning turbines, flowing packets): render every visible
 *     frame. Still gated by visibility/modal/tab + fps cap. Prefer coupling such
 *     motion to `p` or a slow gsap tween so you can stay render-on-demand.
 *
 * OPTIONAL POST-PROCESSING (Biggest-5 #3)
 *   If you built a composer with scene/post-processing.js, hand it here:
 *       import { setComposer } from './scene/render-loop.js';
 *       setComposer(composer, resizeComposer);
 *   The loop then draws through the composer (bloom/vignette/grain) instead of the
 *   bare renderer, and forwards resize. No composer → plain renderer.render(). The
 *   render-pause + on-demand logic is identical either way.
 *
 * DEPENDS ON
 *   - gsap (global, with gsap.ticker) loaded before this module
 *   - three
 *   - scene-setup.js: scene, camera, renderer, state, mat (and PALETTE)
 *   - primitives.js: rotors, labels, windowFade (+ whatever you animate)
 *   - scroll-journey.js: must update `state.p` (scroll progress 0..1) and expose
 *     the camera/route/curve rig. (Wire your own animated objects in below.)
 *
 * HOW TO WIRE
 *   import './scroll-journey.js';   // sets up ScrollTrigger → state.p
 *   import { startRender } from './render-loop.js';
 *   startRender();
 *   // Modals call window.__setModalRenderPause(true/false) to pause while open.
 *
 * NON-OBVIOUS GOTCHA — WHY THIS MATTERS
 *   A fixed full-screen WebGL canvas does NOT stop costing you when content
 *   scrolls over it: the GPU still composites every frame. IntersectionObserver
 *   on the canvas itself is unreliable here (it's always "intersecting" the
 *   viewport). Instead we watch the scroll-driver block's bottom edge: once the
 *   journey block has scrolled fully past the top, the opaque content covers the
 *   stage → pause. This is the robust signal. Re-evaluate on scroll, on modal
 *   open/close, and on visibilitychange.
 * ========================================================================== */

import * as THREE from 'three';
import { scene, camera, renderer, state } from './scene-setup.js';
import { rotors, labels, windowFade } from './primitives.js';

/* The journey/scroll rig must populate `state.p` and provide an updateCamera(p)
 * plus whatever animated handles you want to drive. Import them from your
 * scroll-journey module. Below, replace the destructured imports with the actual
 * objects your scene built (route mesh, comet head, packets, etc.). */
// import { updateCamera, /* route, comet, packets, ... */ } from '../scroll/scroll-journey.js';

const _pos = new THREE.Vector3();

/* RENDER-ON-DEMAND flag. Set `needsRender = true` whenever state changes (scroll
 * onUpdate, resize, modal animation, a one-off interaction). The loop renders only
 * when it's set, then clears it — so an idle scene costs ZERO GPU. If your scene
 * has genuinely continuous ambient motion, set CONTINUOUS = true below instead. */
export let needsRender = true;            // force the first paint
export const requestRender = () => { needsRender = true; };
const CONTINUOUS = false;                 // flip to true ONLY for free-running ambient motion

/* OPTIONAL post-processing composer. Null → render with the bare renderer. Call
 * setComposer(composer, resizeFn) from main.js to draw through bloom/vignette/grain
 * (see scene/post-processing.js). resizeFn(w,h) is forwarded on window resize. */
let composer = null, resizeComposer = null;
export function setComposer(c, resizeFn) {
  composer = c; resizeComposer = resizeFn || null;
  requestRender();   // first paint through the new composer
}
const draw = () => { (composer ? composer.render() : renderer.render(scene, camera)); };

// Keep the composer's internal buffers in sync with the canvas. scene-setup.js owns
// the renderer/camera resize; we only need to forward size to the composer here.
window.addEventListener('resize', () => {
  if (resizeComposer) resizeComposer(window.innerWidth, window.innerHeight);
  requestRender();
});

/* ----------------------------------------------------------------- frame() */
/* dtMs is supplied by gsap.ticker; clamp dt so a stutter/tab-restore can't make
 * everything jump. state.time accumulates real seconds for cyclic animations. */
export function frame(_time, dtMs) {
  // render-on-demand gate: nothing changed and not in continuous mode → skip entirely
  if (!CONTINUOUS && !needsRender) return;
  needsRender = false;

  const dt = Math.min(dtMs ? dtMs / 1000 : 0.016, 0.05);
  state.time += dt;
  const p = state.p;

  // --- ambient motion ---
  // In CONTINUOUS mode this free-spins; in on-demand mode, couple it to `p` so it
  // only moves while scrolling (e.g. r.rotation.z = p * SPEED) and idle stays static.
  if (CONTINUOUS) rotors.forEach((r, i) => { r.rotation.z += dt * (1.1 + (i % 3) * 0.25); });
  else rotors.forEach((r, i) => { r.rotation.z = p * (6 + (i % 3)); });

  // --- label visibility windows (fade each chip over its [from,to]) ---
  labels.forEach((l) => { l.sp.material.opacity = windowFade(p, l.from, l.to); });

  /* ------------------------------------------------------------------------
   * WIRE YOUR SCENE'S PER-FRAME ANIMATION HERE.
   * The source page also drove, each frame:
   *   - an idle spin+bob on a hero "core" cube
   *   - event-bus packets riding QuadraticBezier curves (always flowing)
   *   - feeder tubes drawing-on via setDrawRange during a scroll ramp
   *   - THE route tube drawing to the comet tip (see scroll-journey for the
   *     getPointAt vs getPoint distinction), plus a halo dot grid + pulse rings
   *   - a steady event-stream arc during a mid-scroll step
   *   - milestone beacons lighting as the comet passes them
   *   - a finale label easing in past p>0.94
   * Each is a small block reading `p` and `state.time`. Keep them here so the
   * single render() call below stays the only draw per frame.
   * --------------------------------------------------------------------- */

  // updateCamera(p);          // from scroll-journey.js — moves camera along the rig
  draw();                       // composer.render() if one was set, else renderer.render()
}

/* ============================ RENDER-PAUSE SYSTEM ========================== *
 * Render only while the 3D stage is actually visible — a large CPU/GPU saving. */

gsap.ticker.fps(60);   // cap the loop at 60fps. It ran uncapped (~120) → half the GPU work.

let renderRunning = false;
export function startRender() {
  if (!renderRunning && !document.hidden) { renderRunning = true; gsap.ticker.add(frame); }
}
export function stopRender() {
  if (renderRunning) { renderRunning = false; gsap.ticker.remove(frame); }
}

const stageEl = document.querySelector('.stage');
let stageVisible = true, modalOpenForRender = false;
function evalRender() { (stageVisible && !modalOpenForRender) ? startRender() : stopRender(); }

if (stageEl) {
  // Track scroll past the scroll-driver block. The fixed canvas is visually
  // covered once we've scrolled past the journey block's bottom edge. This is
  // more robust than observing the canvas (which always intersects the viewport).
  const journeyEl = document.getElementById('journey');
  const onScrollRender = () => {
    const jb = journeyEl ? journeyEl.getBoundingClientRect().bottom : 0;
    stageVisible = jb > 0;     // journey bottom still below the top edge ⇒ canvas shows
    evalRender();
  };
  window.addEventListener('scroll', onScrollRender, { passive: true });
  onScrollRender();
}

startRender();

// Pause when the tab is hidden; re-evaluate (not blindly resume) when shown.
document.addEventListener('visibilitychange', () => { if (document.hidden) stopRender(); else evalRender(); });

// Hook so drill/ERD modals can pause rendering while open (they call this true/false).
window.__setModalRenderPause = (on) => { modalOpenForRender = on; evalRender(); };
