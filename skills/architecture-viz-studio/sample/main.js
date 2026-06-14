// Sample scene — a CDN video-delivery pipeline (a simplified take on Netflix Open
// Connect), styled after a polished low-poly "tech city" hero. The camera flies
// over an ice-blue cityscape; a film travels studio → encode farm → origin → edge
// appliance (in your ISP) → your TV, with glowing particles flowing along the
// route and a pulsing data-grid beneath. Every node registers a userData.vizId so
// edit-mode + the manifest can round-trip a click back to this file.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
// pmndrs/postprocessing — selective bloom + DOF + grade (the biggest "wow" lever).
// Use the raw build (bare-imports `three`) so the importmap resolves it to the SAME
// three instance as the scene — the `+esm` bundle pulls a 2nd copy ("Multiple
// instances of Three.js") which silently breaks the effects.
import {
  EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect,
  NoiseEffect, VignetteEffect, SMAAEffect, BlendFunction,
} from 'postprocessing';
// Architect-view diagram modules (the same reusable bundle the skill ships).
import { initOverlays } from './diagrams/overlay-lens-system.js';
import { initDrill } from './diagrams/component-detail-modal.js';
import { initErd } from './diagrams/erd-diagram.js';
import { attachPanZoom } from './diagrams/pan-zoom-viewport.js';

const stage = document.getElementById('stage');

/* ---------------- palette + layout ----------------
   A deeper, moodier value range than high-key white → the emissive accents pop and
   bloom reads. Deep navy backdrop, mid-blue city, bright cyan accents. */
const PAL = {
  bg: 0x0b1424, fog: 0x0e1a2e,
  city: 0x223651, cityHi: 0x33506f, cityLo: 0x18293f,
  accent: 0x3f8bff, accentSoft: 0x7cc0ff, glass: 0x2a4566,
  node: 0x2a3a52, nodeHi: 0x3e5675, screen: 0x4f9bff, dark: 0x0e1828,
};
const STUDIO = { x: -34, z: 0 };
const FARM   = { x: -16, z: 0 };
const ORIGIN = { x: 2,   z: 0 };
const EDGE   = { x: 19,  z: 0 };
const TV     = { x: 33,  z: 0 };

/* ---------------- renderer / scene / camera ----------------
   Biggest-5 #1: the render pipeline baseline — sRGB output + ACES tone mapping +
   capped DPR. This is what makes highlights roll off and colours read correct
   instead of milky/blown-out (the #1 amateur tell). See references/wow-quality-bar.md */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);               // deep navy backdrop (not white)
scene.fog = new THREE.FogExp2(PAL.fog, 0.016);           // #5: exponential fog → aerial depth

// Biggest-5 #2: image-based lighting. RoomEnvironment + PMREM gives every surface
// correct soft fill + reflections with zero downloaded asset.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 320);
camera.position.set(0, 18, 46);
camera.lookAt(0, 2, 0);

// Biggest-5 #4: three-point lighting. Key (warm-ish) + cool hemisphere fill + a
// RIM light from behind that separates the hero objects from the backdrop.
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0xaebfd6, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(-26, 42, 24); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 6;
Object.assign(key.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 140 });
scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb4ff, 3.2);   // cool rim from behind/right
rim.position.set(38, 24, -34); scene.add(rim);
const fillKey = new THREE.DirectionalLight(0xffffff, 0.5);
fillKey.position.set(30, 20, 30); scene.add(fillKey);

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.04, ...o });
const glowMat = (c, i = 1) => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: i, roughness: 0.4 });
// rounded-box part added to a GROUP (local coords) — the building block of the models
function part(group, w, h, d, c, x = 0, y = 0, z = 0, r = 0.08) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * r);
  const m = new THREE.Mesh(g, c.isMaterial ? c : mat(c));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
// a canvas texture of glowing windows for building faces
function windowsTex(cols, rows, base, lit) {
  const cv = document.createElement('canvas'); cv.width = cols * 16; cv.height = rows * 16;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    ctx.fillStyle = Math.random() < 0.4 ? lit : 'rgba(120,150,190,0.25)';
    ctx.fillRect(c * 16 + 4, r * 16 + 4, 8, 10);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function box(x, y, z, w, h, d, c) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c.isMaterial ? c : mat(c));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}

/* ---------------- (1) DETAILED LOW-POLY CITY (the backdrop) ----------------
   A dense, varied field of buildings on both sides of the route corridor, drawn
   as instanced boxes (one draw call for the whole skyline) with a height/shade
   gradient so it reads as a real cityscape fading into the fog — not blank. */
function buildCity() {
  const g = new THREE.Group();
  // deterministic pseudo-random so the skyline is stable across reloads
  let seed = 1337; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cells = [];
  // The city is a LOW backdrop skyline set well back from the route corridor, so it
  // never blocks the main nodes. Buildings only exist beyond the lane; the closer
  // they are to the lane the lower they are, rising only far in the distance.
  for (let gx = -60; gx <= 60; gx += 4.4) {
    for (let gz = -54; gz <= 54; gz += 4.4) {
      if (Math.abs(gz) < 16) continue;                  // wide clear lane (no buildings near nodes)
      if (rnd() < 0.30) continue;                       // gaps → streets
      const jitterX = (rnd() - 0.5) * 1.7, jitterZ = (rnd() - 0.5) * 1.7;
      const w = 1.8 + rnd() * 2.0, d = 1.8 + rnd() * 2.0;
      const edgeDist = Math.abs(gz) - 16;               // distance beyond the lane
      const near = Math.min(1, edgeDist / 30);
      const h = (1.5 + rnd() * rnd() * 14) * (0.25 + near * 0.9);   // low near, taller far
      cells.push({ x: gx + jitterX, z: gz + jitterZ, w, h, d, shade: rnd() });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, mat(PAL.city, { flatShading: false }), cells.length);
  inst.castShadow = true; inst.receiveShadow = true;
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  cells.forEach((c, i) => {
    dummy.position.set(c.x, c.h / 2, c.z);
    dummy.scale.set(c.w, c.h, c.d);
    dummy.rotation.y = 0; dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    // shade: taller + nearer = lighter (ice highlight), shorter = cooler
    const t = Math.min(1, c.h / 18);
    col.set(PAL.cityLo).lerp(new THREE.Color(PAL.cityHi), t * 0.7 + c.shade * 0.3);
    inst.setColorAt(i, col);
  });
  inst.instanceColor.needsUpdate = true;
  g.add(inst);
  // a few accent rooftops glowing faintly (signal towers)
  for (let k = 0; k < 7; k++) {
    const c = cells[Math.floor(rnd() * cells.length)];
    if (!c || c.h < 10) continue;
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat(PAL.accentSoft, 0.8));
    beacon.position.set(c.x, c.h + 0.4, c.z); g.add(beacon);
  }
  g.userData.vizId = 'scene.city';
  g.userData.vizSelectable = false;     // backdrop — never a comment target
  scene.add(g); return g;
}

/* ---------------- (3) PULSING TECH-GRID (the data plane beneath) ----------------
   A flat grid of small glowing tiles on the ground along the route; a travelling
   wave lights tiles up as it sweeps across (driven by time + scroll progress). */
let gridTiles = [];
function buildGrid() {
  const g = new THREE.Group();
  const TW = 1.5, gap = 0.5, cols = 46, rows = 9;
  const x0 = STUDIO.x - 2, z0 = -((rows - 1) * (TW + gap)) / 2;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TW),
      new THREE.MeshStandardMaterial({ color: PAL.glass, emissive: PAL.accent, emissiveIntensity: 0.04, transparent: true, opacity: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x0 + c * (TW + gap), 0.04, z0 + r * (TW + gap));
    g.add(m);
    gridTiles.push({ mesh: m, cx: c / cols, rz: Math.abs(r - (rows - 1) / 2) / (rows / 2) });
  }
  g.userData.vizId = 'scene.grid';
  g.userData.vizSelectable = false;
  scene.add(g); return g;
}

/* ---------------- the CDN nodes — proper low-poly MODELS (not stacked blocks) -----
   Each builder returns a Group positioned at its node so it reads as a recognizable
   object: a studio building with windows, server racks with rack-units + LEDs, a
   datacenter origin, a satellite dish, a flat-screen TV. */

// a reusable server rack: a cabinet with horizontal rack-unit slats + a glowing
// status LED strip down the front. Returns the group + its LED material to pulse.
function serverRack(w = 1.7, h = 3.4, d = 2.4) {
  const r = new THREE.Group();
  part(r, w, h, d, PAL.node, 0, h / 2, 0, 0.06);                 // cabinet
  part(r, w * 0.92, h * 0.96, 0.06, PAL.dark, 0, h / 2, d / 2, 0.02);   // front panel inset
  for (let i = 0; i < 6; i++)                                    // rack-unit slats
    part(r, w * 0.8, h * 0.1, 0.05, PAL.nodeHi, 0, h * 0.12 + i * (h * 0.13), d / 2 + 0.03, 0.02);
  const led = part(r, 0.12, h * 0.74, 0.06, glowMat(PAL.accent, 0.9), w * 0.36, h / 2, d / 2 + 0.04, 0.02);
  r.userData.led = led.material;
  return r;
}

function buildStudio() {            // 01 — a studio building (window grid + reel sign)
  const g = new THREE.Group();
  const winT = windowsTex(5, 7, '#7e93b3', '#dfeafd');
  const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.cityHi, roughness: 0.6 });
  const body = part(g, 7, 12, 6, bodyMat, 0, 6, 0, 0.04);
  // window-grid faces on the four sides
  [[0, 0, 3.02, 0], [0, 0, -3.02, Math.PI], [3.52, 0, 0, Math.PI / 2], [-3.52, 0, 0, -Math.PI / 2]].forEach(([x, , z, ry]) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(x ? 5 : 6, 10),
      new THREE.MeshStandardMaterial({ map: winT.clone(), roughness: 0.45, emissive: 0x223a5e, emissiveIntensity: 0.18 }));
    pane.position.set(x, 6.4, z); pane.rotation.y = ry; g.add(pane);
  });
  part(g, 5, 1, 4, PAL.nodeHi, 0, 12.4, 0, 0.1);                 // rooftop unit
  // a film-reel emblem on the roof
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 26), glowMat(PAL.accent, 0.45));
  reel.rotation.x = Math.PI / 2; reel.position.set(0, 13.4, 0); reel.castShadow = true; g.add(reel);
  for (let i = 0; i < 5; i++) {                                  // reel spokes/holes
    const a = (i / 5) * Math.PI * 2;
    part(g, 0.4, 0.6, 0.4, PAL.dark, Math.cos(a) * 0.85, 13.4, Math.sin(a) * 0.85, 0.3);
  }
  g.position.set(STUDIO.x, 0, STUDIO.z);
  g.userData.vizId = 'scene.studio'; scene.add(g); return g;
}

function buildEncodeFarm() {        // 02 — a row of server racks (the encode farm)
  const g = new THREE.Group();
  const leds = [];
  for (let c = 0; c < 5; c++) for (let row = 0; row < 2; row++) {
    const rk = serverRack();
    rk.position.set(-4 + c * 2.0, 0, -1.4 + row * 2.8);
    g.add(rk); leds.push(rk.userData.led);
  }
  g.userData.leds = leds;
  g.position.set(FARM.x, 0, FARM.z);
  g.userData.vizId = 'scene.encode-farm'; scene.add(g); return g;
}

function buildOrigin() {            // 03 — the origin datacenter (bigger racks + halo)
  const g = new THREE.Group();
  // a 3×3 block of taller racks on a plinth
  part(g, 11, 0.6, 11, PAL.nodeHi, 0, 0.3, 0, 0.04);            // plinth
  for (let c = -1; c <= 1; c++) for (let z = -1; z <= 1; z++) {
    const rk = serverRack(2.0, 4.4, 2.6); rk.position.set(c * 3.2, 0.6, z * 3.2); g.add(rk);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.14, 10, 56), glowMat(PAL.accent, 0.75));
  ring.position.set(0, 6.4, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.userData.spin = ring;
  g.position.set(ORIGIN.x, 0, ORIGIN.z);
  g.userData.vizId = 'scene.origin'; scene.add(g); return g;
}

function buildEdge() {              // 04 — an edge CDN node: a satellite dish + cache box
  const g = new THREE.Group();
  // a small cache cabinet
  part(g, 3.2, 2.6, 2.6, PAL.node, 0, 1.3, 0, 0.06);
  part(g, 2.9, 0.16, 0.06, glowMat(PAL.accent, 0.8), 0, 1.6, 1.33, 0.02);   // status strip
  // a satellite dish on a mast (the recognizable "edge of network" shape)
  const mast = part(g, 0.4, 4.5, 0.4, PAL.nodeHi, 1.6, 4.6, 0, 0.3);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
    mat(PAL.cityHi, { side: THREE.DoubleSide, roughness: 0.5 }));
  dish.scale.set(1, 0.5, 1); dish.rotation.set(Math.PI * 0.62, 0, 0.4);
  dish.position.set(1.6, 6.6, 1.2); dish.castShadow = true; g.add(dish);
  const feed = part(g, 0.18, 0.18, 1.4, PAL.dark, 1.6, 6.4, 2.0, 0.3);      // dish feed arm
  feed.rotation.x = 0.5;
  // a couple of small peer cache boxes
  part(g, 1.8, 1.6, 1.8, PAL.node, -2.6, 0.8, 1.4, 0.08);
  part(g, 1.8, 1.6, 1.8, PAL.node, -2.2, 0.8, -1.8, 0.08);
  g.position.set(EDGE.x, 0, EDGE.z);
  g.userData.vizId = 'scene.edge'; scene.add(g); return g;
}

function buildTV() {                // 05 — a flat-screen TV on a stand (glows on play)
  const g = new THREE.Group();
  part(g, 5.0, 0.3, 1.4, PAL.dark, 0, 0.15, 0, 0.1);            // stand foot
  part(g, 0.6, 2.0, 0.6, PAL.dark, 0, 1.2, 0, 0.1);            // neck
  part(g, 9.4, 5.8, 0.5, PAL.dark, 0, 5.0, 0, 0.05);          // bezel
  const screen = part(g, 8.6, 5.0, 0.06, glowMat(PAL.screen, 0.5), 0, 5.0, 0.3, 0.01);
  // a thin "play" triangle on the screen
  const tri = new THREE.Mesh(new THREE.CircleGeometry(0.9, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }));
  tri.rotation.z = -Math.PI / 2; tri.position.set(0, 5.0, 0.35); g.add(tri);
  g.userData.screen = screen.material;
  g.position.set(TV.x, 0, TV.z);
  g.userData.vizId = 'scene.tv'; scene.add(g); return g;
}

/* the route the film follows (subtle tube) */
function buildRoute() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(STUDIO.x + 2, 3.0, STUDIO.z + 2), new THREE.Vector3(FARM.x, 2.4, FARM.z + 2),
    new THREE.Vector3(ORIGIN.x, 3.0, ORIGIN.z + 2), new THREE.Vector3(EDGE.x, 2.2, EDGE.z + 2),
    new THREE.Vector3(TV.x, 4.6, TV.z + 1),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 110, 0.10, 8), glowMat(PAL.accentSoft, 0.25));
  tube.userData.vizId = 'scene.route'; scene.add(tube);
  return { curve, tube };
}

/* ---------------- (2) FLOWING PARTICLES along the route ----------------
   A stream of glowing points that ride the curve continuously — the "data
   flowing" effect. One Points object, positions updated each frame. */
const PCOUNT = 90;
let particles, pData;
function buildParticles(curve) {
  const pos = new Float32Array(PCOUNT * 3);
  pData = new Array(PCOUNT).fill(0).map((_, i) => ({ t: i / PCOUNT, speed: 0.06 + Math.random() * 0.05 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sprite = makeDotSprite();
  const m = new THREE.PointsMaterial({ size: 1.5, map: sprite, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, color: PAL.accentSoft });
  particles = new THREE.Points(geo, m);
  particles.userData.curve = curve;
  particles.userData.vizId = 'scene.flow';
  particles.userData.vizSelectable = false;
  scene.add(particles);
}
function makeDotSprite() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(160,200,255,0.8)');
  grd.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------------- assemble ---------------- */
buildCity();
buildGrid();
const studio = buildStudio();
const farm = buildEncodeFarm();
const origin = buildOrigin();
const edge = buildEdge();
const tv = buildTV();
const route = buildRoute();
buildParticles(route.curve);

/* ---------------- (Biggest-5 #3) POST-PROCESSING ----------------
   Selective bloom (only the emissive accents glow, not the whole bright scene) +
   depth-of-field (focus the pipeline, blur the far city) + a whisper of grain &
   vignette. Bundled into ONE EffectPass so they merge into a single fullscreen
   pass. This is the single biggest "wow" lever. See references/wow-quality-bar.md */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new SelectiveBloomEffect(scene, camera, {
  blendFunction: BlendFunction.ADD, luminanceThreshold: 0.55, luminanceSmoothing: 0.3,
  intensity: 2.0, radius: 0.72, mipmapBlur: true,
});
bloom.inverted = false;
// only the glowing accents bloom: route, particles, origin halo, encode LEDs, TV, studio reel
bloom.selection.set([]);
scene.traverse((o) => {
  const m = o.material;
  if (m && m.emissive && m.emissiveIntensity > 0.25) bloom.selection.add(o);
});
particles && bloom.selection.add(particles);

const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY });
grain.blendMode.opacity.value = 0.05;
const vignette = new VignetteEffect({ darkness: 0.55, offset: 0.42 });

// One merged EffectPass: bloom + vignette + grain + SMAA. DOF is intentionally
// LEFT OUT — depth-of-field is the most expensive post pass and the FogExp2 already
// provides the "blurred far city" depth cue cheaply. Re-add DepthOfFieldEffect on a
// page that targets only high-end GPUs.
composer.addPass(new EffectPass(camera, bloom, vignette, grain, new SMAAEffect()));

/* ---------------- scroll choreography + window.__tl hook ---------------- */
const state = { p: 0, time: 0 };
const tl = gsap.timeline({ paused: true });
tl.to(state, { p: 1, duration: 1, ease: 'none' });
window.__tl = tl;

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.create({
  trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.6,
  onUpdate: (self) => { state.p = self.progress; tl.progress(self.progress); },
});

/* ---------------- render loop ----------------
   This scene has CONTINUOUS motion (flowing particles, pulsing grid), so it runs
   every visible frame — but still PAUSES when the stage is off-screen or the tab
   is hidden, fps-capped at 60, DPR capped. (See gsap-threejs-playbook: continuous
   mode is the right call when motion must run with no input.) */
gsap.ticker.fps(60);
const _v = new THREE.Vector3();
let stageVisible = true;
let modalOpen = false;          // set by the drill/ERD modals via __setModalRenderPause
let gridTick = 0;

// let the architect-view modals pause the 3D loop while they're open (DOM-only work).
window.__setModalRenderPause = (on) => { modalOpen = on; };

// (Biggest-5 #4/#5) damped mouse parallax — lerp toward the pointer so the camera
// trails smoothly (snapping to the mouse is the amateur version).
const ptr = { x: 0, y: 0, cx: 0, cy: 0 };
addEventListener('pointermove', (e) => {
  ptr.x = (e.clientX / innerWidth - 0.5);
  ptr.y = (e.clientY / innerHeight - 0.5);
});
const _look = new THREE.Vector3();

function frame(_t, dtMs) {
  if (!stageVisible || modalOpen || document.hidden) return;
  const dt = Math.min((dtMs || 16) / 1000, 0.05);
  state.time += dt;
  const p = state.p;

  // camera dollies along the corridor as you scroll, with an eased height arc, a
  // gentle idle drift, and damped mouse parallax layered on top.
  ptr.cx += (ptr.x - ptr.cx) * 0.06; ptr.cy += (ptr.y - ptr.cy) * 0.06;
  const ease = p * p * (3 - 2 * p);                 // smoothstep — non-linear dolly
  const camX = -38 + ease * 74 + ptr.cx * 6;
  const camZ = 46 - ease * 12 + Math.sin(state.time * 0.25) * 0.6;
  const camY = 19 - ease * 5 + Math.sin(state.time * 0.4) * 0.4 - ptr.cy * 4;
  camera.position.set(camX, camY, camZ);
  _look.set(camX * 0.45 + ptr.cx * 3, 2.6 - ptr.cy * 1.5, 0);
  camera.lookAt(_look);

  // origin halo spins; encode LEDs flicker; TV brightens near the end
  if (origin.userData.spin) origin.userData.spin.rotation.z += dt * 0.8;
  if (farm.userData.leds) farm.userData.leds.forEach((m, i) => { m.emissiveIntensity = 0.6 + Math.sin(state.time * 4 + i) * 0.35; });
  if (tv.userData.screen) tv.userData.screen.emissiveIntensity = 0.45 + Math.max(0, p - 0.78) * 3.0;

  // (2) flow the particles along the route
  const curve = particles.userData.curve;
  const arr = particles.geometry.attributes.position.array;
  for (let i = 0; i < PCOUNT; i++) {
    const pd = pData[i];
    pd.t += pd.speed * dt;
    if (pd.t > 1) pd.t -= 1;
    curve.getPointAt(pd.t, _v);
    arr[i * 3] = _v.x; arr[i * 3 + 1] = _v.y + 0.15; arr[i * 3 + 2] = _v.z;
  }
  particles.geometry.attributes.position.needsUpdate = true;

  // (3) pulse the grid — a wave sweeping left→right, biased to the scroll position.
  // Throttle to ~30Hz (every other frame) and skip tiles far from the camera band:
  // updating 400+ materials every frame is the heaviest per-frame cost.
  gridTick = (gridTick + 1) % 2;
  if (gridTick === 0) {
    for (const t of gridTiles) {
      if (Math.abs(t.cx - p) > 0.35) { if (t.lit) { t.mesh.material.emissiveIntensity = 0.04; t.lit = false; } continue; }
      const wave = Math.sin((t.cx - state.time * 0.18) * Math.PI * 6) * 0.5 + 0.5;
      const near = Math.max(0, 1 - Math.abs(t.cx - p) * 4);     // brightest under the camera
      t.mesh.material.emissiveIntensity = 0.04 + wave * (0.1 + near * 0.7) * (1 - t.rz * 0.6);
      t.lit = true;
    }
  }

  composer.render();                 // render THROUGH the post-processing composer
}
gsap.ticker.add(frame);
window.__renderFrame = () => frame(0, 16);   // test hook

// PAUSE the continuous loop once the 3D stage is visually covered. The stage is
// `position:fixed; inset:0`, so it ALWAYS intersects the viewport — observing the
// canvas is useless (the documented gotcha). Instead watch the solid `.cards`
// section that scrolls OVER the stage: once it fills the lower viewport, the city
// is hidden → stop rendering. Also pause on tab-hide.
const coverEl = document.querySelector('.cards');
if (coverEl) {
  const coverObs = new IntersectionObserver(
    ([e]) => { stageVisible = !(e.isIntersecting && e.intersectionRatio > 0.5); },
    { threshold: [0, 0.5, 1] });
  coverObs.observe(coverEl);
}
document.addEventListener('visibilitychange', () => { /* frame() already checks document.hidden */ });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ---------------- (Biggest-5 #5) staged intro reveal ----------------
   The nodes rise + fade in with a stagger and an eased overshoot on load — the
   hero comes in first, the rest follow. "Everything at frame 1" is the flat
   default; a staged reveal reads as designed. (Respects reduced-motion.) */
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const nodes = [studio, farm, origin, edge, tv];
  nodes.forEach((n) => { n.userData._y = n.position.y; n.position.y -= 9; n.scale.setScalar(0.001); });
  gsap.to(nodes.map((n) => n.position), {
    y: (i) => nodes[i].userData._y, duration: 1.3, ease: 'expo.out', stagger: 0.12, delay: 0.25,
  });
  gsap.to(nodes.map((n) => n.scale), {
    x: 1, y: 1, z: 1, duration: 1.1, ease: 'back.out(1.4)', stagger: 0.12, delay: 0.25,
  });
}

/* ================================================================================
 * ARCHITECT VIEW — wire the diagrams/ modules to the #architecture system map.
 * The data below is the CDN-delivery domain expressed in the modules' generic
 * shapes: OVERLAYS (lenses), ENGINE_DESIGN (the encode pipeline), LANES_DESIGN
 * (the delivery workflow), and an ERD (the asset catalog). Same modules, same
 * shapes the skill ships — only the copy is domain-specific.
 * ============================================================================== */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- lenses: read the same map five ways (id must match the on-XX SVG classes) ---- */
const OVERLAYS = [
  { id: 'sy', key: '1', name: 'Systems', accent: '#9fb0c2',
    desc: 'Every part of the delivery system at rest — studio side, control plane, edge.',
    bullets: ['Studio master → ingest → encode', 'Catalog stores the encoded ladders', 'Edge appliances serve the last hop'] },
  { id: 'df', key: '2', name: 'Data Flow', accent: '#1fa9b8',
    desc: 'How one title travels — encoded once, pre-positioned everywhere, streamed to fit.',
    bullets: ['Master → ingest → encode pipeline', 'Pipeline → catalog + fill windows', 'Fill → edge appliance → player'] },
  { id: 'es', key: '3', name: 'Asset Sourcing', accent: '#6fc7cf',
    desc: 'The mezzanine master is the source of truth; every rendition is a re-derivable projection.',
    bullets: ['Mezzanine = append-only source', 'Ladder renditions fold from it', 'Re-encode = replay from master'] },
  { id: 'ow', key: '4', name: 'Ownership', accent: '#f0b35c',
    desc: 'Studios own the masters; Streamflix owns the pipeline; ISPs host the edge boxes.',
    bullets: ['Studio: the source master', 'Streamflix: encode + catalog + fill', 'ISP: hosts the appliance, Streamflix-owned software'] },
  { id: 're', key: '5', name: 'Reliability', accent: '#f0b35c',
    desc: 'Idempotent encodes, pre-positioned fills, and adaptive fallback if an edge is cold.',
    bullets: ['Per-shot encode retries in isolation', 'Fill before play — never on the hot path', 'Player falls back to the next-nearest hop'] },
];

/* ---- ENGINE view: the encode pipeline as the generic process pipeline ---- */
const ENGINE_DESIGN = {
  title: 'encode pipeline', subtitle: 'the processing engine',
  desc: 'A workflow-agnostic processing engine. A title is split into shots, each encoded in parallel into a per-title quality ladder, then validated and published to the catalog.',
  pipeline: [
    { id: 'split', k: 'shot-split', v: 'segment by scene', cls: '' },
    { id: 'plan', k: 'plan ladder', v: 'per-title bitrates', cls: '', store: true },
    { id: 'lease', k: 'lease workers', v: 'farm fan-out', cls: '' },
    { id: 'encode', k: 'Encode Engine', v: 'parallel per-shot', cls: 'fold', badge: 'PURE', note: 'each shot encodes independently; re-encodes a single failed shot, not the title' },
    { id: 'vmaf', k: 'VMAF gate', v: 'quality vs target', cls: '', note: 'compare measured VMAF against the ladder target' },
    { id: 'pack', k: 'package (UoW)', v: 'CMAF · one manifest', cls: '', note: 'stitch shots + write manifest atomically' },
    { id: 'publish', k: 'Publish', v: 'to catalog + fill', cls: '', note: 'final phase; idempotent — safe to replay' },
  ],
  sources: [
    { k: 'Ingest', v: 'mezzanine → handler' },
    { k: 'Re-encode', v: 'codec add → handler' },
  ],
  mgmt: ['Re-run shot', 'Bump ladder', 'Add codec', 'Pin VMAF'],
  history: [
    { t: 'T0', l: 'MASTER INGESTED' },
    { t: 'T1', l: 'LADDER PLANNED' },
    { t: 'T2', l: 'HDR PASS', skip: true },
    { t: 'TN', l: 'PUBLISHED' },
  ],
  groups: [
    { h: 'Orchestration', items: [
      { id: 'split', n: 'ShotSplitter', t: 'segments the title by scene', p: 'impure' },
      { id: 'plan', n: 'LadderPlanner', t: 'derives per-title bitrates', p: 'pure' },
    ] },
    { h: 'Engine (pure)', items: [
      { id: 'encode', n: 'EncodeEngine', t: 'the parallel per-shot encoder', p: 'pure' },
      { id: 'vmaf', n: 'QualityGate', t: 'VMAF vs target, pure check', p: 'pure' },
    ] },
    { h: 'Publishing', items: [
      { id: 'pack', n: 'Packager', t: 'CMAF stitch + manifest, one txn', p: 'impure' },
      { id: 'publish', n: 'Publisher', t: 'pushes to catalog + fill', p: 'impure' },
    ] },
  ],
};

/* ---- detail entries (id → rich card) for clickable steps ---- */
const DETAIL = {
  encode: {
    title: 'EncodeEngine', pill: 'pure',
    sig: 'encode({ shot, rung }): Rendition',
    resp: 'The pure core: deterministically encodes one shot at one ladder rung. No I/O, no scheduling — given the same shot and rung it always yields the same rendition, so a failed shot re-encodes in isolation.',
    io: 'In: a shot + a target rung. Out: an encoded rendition (no side effects).',
    rules: ['Per-shot, never per-title — one failure costs one shot.', 'Deterministic: replay-equivalent to a cold re-encode.'],
    collab: 'Fed by ShotSplitter + LadderPlanner; output validated by QualityGate.',
  },
  vmaf: {
    title: 'QualityGate', pill: 'pure',
    resp: 'Compares a rendition’s measured VMAF against the rung target and decides keep / re-encode-higher. Pure: a function of (measured, target).',
    io: 'In: rendition + target. Out: pass | bump-rung.',
    rules: ['No I/O — just the comparison.', 'A bump re-runs only the affected rung.'],
  },
  publish: {
    title: 'Publisher', pill: 'impure',
    resp: 'Pushes the packaged title to the catalog and queues it for the next off-peak fill window. Idempotent — re-publishing the same version is a no-op.',
    io: 'In: a packaged title. Out: catalog upsert + fill job.',
    rules: ['Idempotent on (titleId, version).', 'Publish never blocks playback — fill happens later.'],
  },
};

/* ---- LANES view: the delivery workflow plug-in ---- */
const LANES_DESIGN = {
  title: 'delivery workflow', subtitle: 'pre-position to the edge',
  desc: 'Plugs into the control plane: pure planners decide what to pre-position where, impure effects push bytes to appliances during off-peak fill windows.',
  lanes: [
    { h: 'Planners', ct: 'pure', cards: [
      { n: 'demand.forecast', t: 'predicts per-region demand', p: 'pure' },
      { n: 'placement.plan', t: 'which titles to which appliances', p: 'pure' },
      { n: 'window.schedule', t: 'picks off-peak fill windows', p: 'pure' },
    ] },
    { h: 'Effect handlers', ct: 'impure', cards: [
      { n: 'FillAppliance', t: 'pushes bytes to an edge box', code: 'replay: SKIP', p: 'impure' },
      { n: 'EvictCold', t: 'reclaims space for hot titles', code: 'replay: ALWAYS', p: 'impure' },
    ] },
    { h: 'Reads', cards: [
      { n: 'ListPlacements', t: 'what is where, right now', p: 'impure' },
      { n: 'GetApplianceHealth', t: 'per-box fill + cache state', p: 'impure' },
    ] },
  ],
};

/* ---- ERD: the asset catalog (ids kept as the module’s hub-layout expects) ---- */
const ERD = [
  { id: 'ev', name: 'titles', tag: 'source of truth · the master', kind: 'truth', fields: [
    { n: 'titleId', t: 'string (uuid)', k: 'pk' },
    { n: 'mezzanineRef', t: 'string', k: 'uq', note: 'the mezzanine master' },
    { n: 'duration', t: 'int (ms)' },
    { n: 'addedTs', t: 'Date', note: 'ordering key' },
  ] },
  { id: 'tk', name: 'assets', tag: 'derived state · per encode', kind: 'state', fields: [
    { n: 'assetId', t: 'string (uuid)', k: 'pk' },
    { n: 'titleId', t: 'string', k: 'fk' },
    { n: 'version', t: 'int', note: 'optimistic CAS' },
    { n: 'status', t: 'enum', note: 'ENCODING|READY|PUBLISHED' },
    { n: 'ladder[]', t: 'Rung', k: 'emb' },
    { n: 'manifests', t: 'TypedMap', k: 'emb', note: 'HLS · DASH' },
  ] },
  { id: 'add', name: 'manifests «typed»', tag: 'embedded', kind: 'emb', fields: [
    { n: 'hls', t: 'string (url)' },
    { n: 'dash', t: 'string (url)', note: 'null until packaged' },
  ] },
  { id: 'ts', name: 'Rung «embedded»', tag: 'asset.ladder[]', kind: 'emb', fields: [
    { n: '_id', t: 'string', k: 'pk' },
    { n: 'bitrate', t: 'int (kbps)' },
    { n: 'codec', t: 'enum', note: 'H.264|AV1' },
    { n: 'vmaf', t: 'float' },
  ] },
  { id: 'br', name: 'placements', tag: 'projection · what is where', kind: 'read', fields: [
    { n: 'id', t: 'string', k: 'pk' },
    { n: 'assetId', t: 'string', k: 'fk' },
    { n: 'applianceId', t: 'string', note: 'the edge box' },
  ] },
  { id: 'hist', name: 'fill_history', tag: 'projection · activity feed', kind: 'read', fields: [
    { n: 'id', t: 'string', k: 'pk' },
    { n: 'assetId', t: 'string', k: 'fk' },
    { n: 'filledTs', t: 'Date' },
  ] },
  { id: 'eo', name: 'fill_outcomes', tag: 'idempotency ledger', kind: 'ledger', fields: [
    { n: 'idempotencyKey', t: 'string', k: 'pk', note: 'UNIQUE' },
    { n: 'status', t: 'enum' },
    { n: 'attempts', t: 'int', note: '≤ 3' },
  ] },
];
const ERD_RELS = [
  { from: 'ev', to: 'tk', fromEnd: 'one', toEnd: 'many', label: 'encodes into' },
  { from: 'tk', to: 'add', fromEnd: 'one', toEnd: 'one', label: 'has' },
  { from: 'tk', to: 'ts', fromEnd: 'one', toEnd: 'many', label: 'embeds' },
  { from: 'tk', to: 'br', fromEnd: 'one', toEnd: 'many', label: 'placed as' },
  { from: 'tk', to: 'hist', fromEnd: 'one', toEnd: 'many', label: 'logs' },
  { from: 'tk', to: 'eo', fromEnd: 'one', toEnd: 'many', label: 'tracks' },
];

/* ---- wire the modules (the same one-liners the page-shell import graph shows) ---- */
const { drill } = initOverlays({ sectionId: 'architecture', overlays: OVERLAYS, reduced: REDUCED });
initDrill({ designs: { engine: ENGINE_DESIGN, lanes: LANES_DESIGN }, detail: DETAIL, drill, panZoom: attachPanZoom });
initErd({ data: ERD, rels: ERD_RELS, drill, panZoom: attachPanZoom,
  intro: '<b>The mezzanine master is the source of truth</b> — every asset, rendition and placement is a re-encodable projection of it.' });

/* ---------------- edit mode ---------------- */
EditMode.attachScene({ THREE, renderer, camera, scene });
[studio, farm, origin, edge, tv, route.tube].forEach((o) =>
  EditMode.registerVizObject(o, o.userData.vizId));
if (window.__viz) window.__viz.attachScene({ THREE, renderer, camera, scene });
EditMode.init({ bridge: 'http://localhost:8910' });
