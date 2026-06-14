/* =============================================================================
 * post-processing.js — OPTIONAL pmndrs/postprocessing composer (Biggest-5 #3)
 * =============================================================================
 * WHAT THIS IS
 *   The single biggest "wow" lever after lighting: a fullscreen post stack —
 *   SELECTIVE bloom (only the emissive accents glow, not the whole bright scene)
 *   + a film-grain whisper + a vignette + SMAA anti-aliasing, all merged into ONE
 *   EffectPass. Returns a `composer` you render INSTEAD of renderer.render(), and a
 *   `resizeComposer(w,h)` to call on resize.
 *
 *   This is OPT-IN. A scene with the scene-setup.js lighting foundation already
 *   looks good; this is what takes it from "good" to "studio-grade". Wire it only
 *   when you want that last 20% — it costs one extra fullscreen pass.
 *
 * CRITICAL — THE THREE-INSTANCE TRAP (read this or the effects silently break)
 *   `postprocessing` MUST resolve to the SAME `three` instance as your scene. Map
 *   it in your importmap to the RAW BUILD, which bare-imports `three`:
 *       "postprocessing": "https://cdn.jsdelivr.net/npm/postprocessing@6.36.4/build/index.js"
 *   Do NOT use the `/+esm` jsDelivr bundle — it inlines a SECOND copy of three, you
 *   get "Multiple instances of Three.js being imported" in the console, and bloom /
 *   selection silently do nothing. (page-shell/index.html already has the right map.)
 *
 * HOW TO WIRE (in main.js, AFTER the whole world is built)
 *   import { makeComposer } from './scene/post-processing.js';
 *   import { scene, camera, renderer } from './scene/scene-setup.js';
 *   const { composer, resizeComposer } = makeComposer({ scene, camera, renderer });
 *   // tell the render loop to draw through it:
 *   import { setComposer } from './scene/render-loop.js';
 *   setComposer(composer, resizeComposer);
 *
 * WHY NO DEPTH-OF-FIELD BY DEFAULT
 *   DepthOfFieldEffect is the most expensive post pass, and FogExp2 (set in
 *   scene-setup) already gives the "blurred far backdrop" depth cue cheaply. Add
 *   DOF only on a page that targets high-end GPUs — see the commented block below.
 * ========================================================================== */

import {
  EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect,
  NoiseEffect, VignetteEffect, SMAAEffect, BlendFunction,
  // DepthOfFieldEffect,   // uncomment for the optional DOF block below
} from 'postprocessing';

/* Build the composer. Pass your scene/camera/renderer. Options let you re-tune
 * without editing the file. The bloom SELECTION is auto-discovered: any mesh whose
 * material has emissiveIntensity above `glowThreshold` glows. That's why scene-setup's
 * glowMat() reserves emissive for the few accents that should bloom. */
export function makeComposer({ scene, camera, renderer, opts = {} }) {
  const {
    bloomThreshold = 0.55,   // luminance above which a selected object blooms
    bloomIntensity = 2.0,
    bloomRadius = 0.72,
    grainOpacity = 0.05,     // a whisper — film grain hides banding, adds texture
    vignetteDarkness = 0.55,
    glowThreshold = 0.25,    // emissiveIntensity cutoff for auto-selecting bloom targets
    extraGlow = [],          // additional objects to bloom regardless of material (e.g. Points)
  } = opts;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // SELECTIVE bloom — the key choice. A plain (non-selective) bloom blooms the
  // whole bright image and turns the scene to milk. Selective bloom glows ONLY the
  // chosen emissive accents, so they read as light sources against a calm scene.
  const bloom = new SelectiveBloomEffect(scene, camera, {
    blendFunction: BlendFunction.ADD,
    luminanceThreshold: bloomThreshold, luminanceSmoothing: 0.3,
    intensity: bloomIntensity, radius: bloomRadius, mipmapBlur: true,
  });
  bloom.inverted = false;
  bloom.selection.set([]);
  scene.traverse((o) => {
    const m = o.material;
    if (m && m.emissive && m.emissiveIntensity > glowThreshold) bloom.selection.add(o);
  });
  extraGlow.forEach((o) => o && bloom.selection.add(o));

  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY });
  grain.blendMode.opacity.value = grainOpacity;
  const vignette = new VignetteEffect({ darkness: vignetteDarkness, offset: 0.42 });

  // ONE merged EffectPass: bloom + vignette + grain + SMAA collapse into a single
  // fullscreen pass (cheaper than chaining separate passes).
  composer.addPass(new EffectPass(camera, bloom, vignette, grain, new SMAAEffect()));

  /* --- OPTIONAL depth-of-field (high-end GPUs only) ---------------------------
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 0.02, focalLength: 0.04, bokehScale: 3.0 });
  composer.addPass(new EffectPass(camera, dof));
  --------------------------------------------------------------------------- */

  const resizeComposer = (w, h) => composer.setSize(w, h);
  return { composer, resizeComposer, bloom };
}
