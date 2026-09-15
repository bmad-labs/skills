/* =============================================================================
 * scene-setup.js — Three.js world bootstrap (renderer, scene, camera, lights, ground)
 * =============================================================================
 * WHAT THIS IS
 *   The one-time setup of a low-poly isometric "diorama" world: a tuned WebGL
 *   renderer, a fogged scene, a perspective camera, and a soft two-light sun rig.
 *   Everything else (primitives, the scroll rig, the render loop) builds on the
 *   `scene`, `camera`, `renderer`, `mat()` and the `PALETTE` exported here.
 *
 * DEPENDS ON
 *   - three  (ESM, via importmap — see page-shell/index.html)
 *   - A <canvas id="world"> in the DOM.
 *
 * HOW TO WIRE
 *   import { scene, camera, renderer, mat, PALETTE, REDUCED } from './scene-setup.js';
 *   ...build your world with primitives.js...
 *   ...then start the loop from render-loop.js (it imports scene/camera/renderer).
 *
 * THE "WOW" FOUNDATION (Biggest-5 — see references/wow-quality-bar.md)
 *   This file already bakes in the lighting/colour foundation that separates a
 *   "studio-grade" render from a flat "student" one. Four of the Biggest-5 live
 *   here; #3 (post-processing) is a SEPARATE optional composer wired in render-loop.
 *     #1  sRGB output + ACES tone mapping + DPR cap   (the colour pipeline)
 *     #2  PMREM + RoomEnvironment → scene.environment (image-based lighting / IBL)
 *     #4  three-point rig: key + hemisphere fill + a RIM light from behind
 *     #5  FogExp2 aerial depth (set here; eased motion lives in render-loop)
 *   Do NOT strip these back to a single sun + ambient — that flat rig is the #1
 *   amateur tell. Tune the numbers to your scene; keep the structure.
 *
 * NON-OBVIOUS GOTCHAS / WHY THESE NUMBERS
 *   - setPixelRatio(min(devicePixelRatio, 1.75)): the DPR cap. On 3x phones an
 *     uncapped renderer quadruples the pixel count for ~zero visible gain on a
 *     soft pastel scene. 1.75 keeps edges crisp while roughly halving fragment
 *     work on hi-DPI displays. This was a measured win — do not raise it casually.
 *   - ACESFilmic tone mapping + exposure 1.06: gives the pale palette its gentle
 *     filmic roll-off so bright whites don't clip. SRGB output color space pairs
 *     with SRGB canvas textures (set in primitives.js).
 *   - PMREM + RoomEnvironment: free image-based lighting (no downloaded HDRI). It
 *     gives every MeshStandardMaterial correct soft fill + faint reflections, which
 *     is what makes surfaces read as "lit by a room" rather than flat-shaded. Keep
 *     environmentIntensity modest (~0.5–0.7) so direct lights still sculpt form.
 *   - the RIM light (cool, low, from BEHIND the subject) is what separates hero
 *     objects from the backdrop with a bright edge — the single highest-leverage
 *     light after the key. Without it, dark objects melt into a dark background.
 *   - shadow map 1024 + a HAND-TUNED ortho shadow camera frustum: the frustum is
 *     deliberately asymmetric (left -160 / right 200) because the world is a long
 *     horizontal strip, not a cube. If your world is a different shape, resize the
 *     frustum to JUST cover it — a tighter frustum = sharper shadows per texel.
 *   - fog(bg, 110, 290): near/far in world units; it hides the ground plane edge
 *     and fuses distant geometry into the background colour. Tied to camera.far=600.
 * ========================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';   // Biggest-5 #2: free IBL

/* ---- generic design palette (swap these for your brand) ------------------- *
 * Naming convention used across ALL scene/scroll files:
 *   brand   = the primary/route/highlight colour (a single reserved accent)
 *   accent  = the secondary/data/event colour    (one more semantic hue)
 *   bg/ground/water/building* = neutral environment tones
 * EXAMPLE values below are neutral defaults — replace with your own.
 *
 * VALUE-RANGE NOTE (why this default is DEEP, not pale): emissive accents only
 * "pop" and bloom only reads against a darker backdrop. A high-key white scene
 * looks washed-out and student-grade. The default below is a deep, moody blue so
 * the brand/accent glow carries the image. If your brand truly needs a light scene,
 * keep it — but then dial emissive accents up and bloom threshold higher to compensate. */
export const PALETTE = {
  bg:        0x0b1424,  // scene background + fog colour (deep moody navy — see note above)
  fog:       0x0e1a2e,
  ground:    0x111e30,
  water:     0x16314c,
  building:  0x223651,  // primary building face
  buildingB: 0x33506f,  // secondary face / trim (highlight)
  buildingLo:0x18293f,  // shadow-side face
  detail:    0x2a3a52,  // small details, plinths
  dark:      0x0e1828,  // near-black recesses / screens
  legacyBody:0x2a3346,  // EXAMPLE — a desaturated tone for an old/legacy structure
  legacyRib: 0x222b3c,
  glass:     0x2a4566,
  brand:     0xbd0f72,  // EXAMPLE — replace with your primary brand colour
  accent:    0x3f8bff,  // EXAMPLE — replace with your secondary/data colour
  accentGlow:0x7cc0ff,  // bright emissive variant of accent (what blooms)
};

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* shared frame state — read by the render loop and the scroll rig */
export const state = { p: 0, time: 0 };

/* ---------------------------------------------------------------- renderer */
const canvas = document.getElementById('world');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // DPR cap — see header
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* ------------------------------------------------------------------- scene */
export const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.bg);
// FogExp2 (exponential) reads as real aerial depth — distant geometry fuses into the
// background and bloom haze. Tune density to your world scale (smaller = clearer).
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.016);

/* ----------------------------------------------- image-based lighting (IBL) */
// Biggest-5 #2. RoomEnvironment baked through PMREM = soft, physically-plausible
// fill + faint reflections on every MeshStandardMaterial, with zero downloaded
// asset. This is what makes surfaces read as "lit by a room", not flat-shaded.
// Keep intensity modest so the direct lights below still sculpt form.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

/* ------------------------------------------------------------------ camera */
// 32° FOV reads as a long telephoto → flattens the scene into an isometric-ish
// diorama. far=600 matches the fog far so nothing pops in at the horizon.
export const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 600);

/* ----------------------------------------------------------------- resize */
export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);     // `false` = don't set canvas CSS size (CSS owns it)
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ lights */
// Biggest-5 #4 — a real three-point rig, NOT a single sun + ambient (the flat
// amateur tell). Cool hemisphere fill + a shadow-casting KEY (the "sun") + a
// cool RIM from BEHIND that puts a bright edge on every hero object so it lifts
// off the dark backdrop. The IBL above carries the soft global fill on top.
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0xaebfd6, 0.5));

// KEY — the main shadow-caster. `sun` kept as the export name for back-compat.
export const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-26, 42, 24);          // high, off to one side → form-revealing
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);     // crisper contacts than 1024
// Crop the ortho frustum to JUST cover your world (tighter = sharper per texel).
// Defaults below suit a roughly ±55-unit scene; resize for a long horizontal strip.
sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;   sun.shadow.camera.bottom = -55;
sun.shadow.camera.near = 1;   sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0005;     // kills shadow acne on flat tops
sun.shadow.normalBias = 0.03;  // kills peter-panning on thin geometry
sun.shadow.radius = 6;         // soft PCF edge
scene.add(sun);

// RIM — cool, from behind/right, NO shadow. The separation light. (See header.)
export const rim = new THREE.DirectionalLight(0x8fb4ff, 3.2);
rim.position.set(38, 24, -34);
scene.add(rim);

// FILL — a soft frontal bounce so shadow cores never go pure black.
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(30, 20, 30);
scene.add(fill);

/* --------------------------------------------------------- material cache */
// Memoize MeshStandardMaterial by (color + opts) so thousands of meshes share a
// handful of GPU programs/uniform blocks. ALWAYS go through mat() for static
// surfaces; only make a bespoke material when you need to animate it per-frame.
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    // roughness 0.62 + a touch of metalness reads as a real surface under the IBL
    // environment (it picks up soft reflections). 0.92/0 is dead-flat matte — the
    // amateur default. Override per-material for genuinely matte things (paper, felt).
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.04, ...opts }));
  }
  return matCache.get(key);
}

/* An emissive "glow" material for accents (LED strips, halos, screens, route).
 * Anything with emissiveIntensity > ~0.25 is what the optional bloom pass selects
 * (see render-loop.js) — so reserve glowMat for the few things that should glow,
 * not every surface, or the bloom turns to mush. */
export function glowMat(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

/* --------------------------------------------------------- ground + water */
// A big receiving plane + an optional water patch. Genericize positions/sizes.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 600), mat(PALETTE.ground));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// EXAMPLE — a water patch (lower roughness → it catches the rim + IBL as a sheen,
// reading as water rather than matte floor). Remove if your scene has no edge water.
const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 100), mat(PALETTE.water, { roughness: 0.3, metalness: 0.1 }));
water.rotation.x = -Math.PI / 2;
water.position.set(205, 0.02, -64);
scene.add(water);
