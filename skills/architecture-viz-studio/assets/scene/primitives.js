/* =============================================================================
 * primitives.js — reusable low-poly builders for the diorama world
 * =============================================================================
 * WHAT THIS IS
 *   A toolkit of stylized, low-poly mesh builders that read as a soft isometric
 *   "model village": rounded boxes, towers, houses, warehouses, stacked crates
 *   (with a ribbed canvas texture + InstancedMesh fields), wind turbines (animated
 *   rotors), crowds of tiny people, a gantry, trees, plus 2D helpers —
 *   canvas-texture labels ("chips") and radial glow-sprite textures. These are
 *   generic, domain-neutral shapes; rename/recolor them to fit your system's
 *   metaphor (a tower = the core service, a crate field = a queue's depth, etc).
 *
 *   Every hard-won proportion and the exact geometry is preserved. Only the
 *   brand-specific wordmarks/colours are genericized — see the PALETTE import and
 *   the `// EXAMPLE` markers.
 *
 * DEPENDS ON
 *   - three + RoundedBoxGeometry addon
 *   - scene-setup.js: `scene`, `mat`, `PALETTE`
 *
 * HOW TO WIRE
 *   import * as P from './primitives.js';
 *   P.tower(0, 0, 6, 14, 6);
 *   P.crateField(-38, 12, 4, 3, 2);
 *   const chip = P.label('SERVICE A', 0, 20, 0, { from: 0.05, to: 0.5 });
 *   // animated builders register into exported arrays (rotors, labels) that the
 *   // render loop ticks — import those from here into render-loop.js.
 *
 * NON-OBVIOUS GOTCHAS
 *   - makeCanvasTexture(): build a 2D <canvas>, wrap in CanvasTexture, set
 *     colorSpace=SRGB + anisotropy. This is how you get text/branding/ribbing
 *     onto a face WITHOUT loading image files. Reuse it for any signage.
 *   - crateMaterials() returns a 6-material array in BoxGeometry FACE ORDER
 *     (+x,-x,+y,-y,+z,-z) so the ribbed "sides" and the panelled "ends" land on
 *     the correct faces. If your box looks wrong, you have the face order wrong.
 *   - InstancedMesh fields: crates are split into ≤2 instanced meshes (accent
 *     vs plain) so a field of hundreds of boxes is 2 draw calls. setMatrixAt per
 *     slot; setColorAt for per-instance tint (people).
 *   - label() bakes text into a canvas sprite chip with renderOrder 20 +
 *     depthTest:false so chips always float above geometry. windowFade() drives
 *     their opacity from scroll progress `p` over a [from,to] window.
 * ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { scene, mat, PALETTE as C } from './scene-setup.js';

/* ===================================================== BASE BOX BUILDERS === */

/* The workhorse: a (rounded) box placed by its FOOTPRINT (x,z) with y as the
 * ground offset — height grows up from y. Returns the mesh so callers can tweak. */
export function box(w, h, d, color, x, z, { y = 0, rounded = true, ry = 0, shadow = true, material = null } = {}) {
  const g = rounded ? new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.08) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material || mat(color));
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}

/* A stepped office tower: body + a setback cap + a small rooftop unit. */
export function tower(x, z, w, h, d, ry = 0) {
  const b = box(w, h, d, C.building, x, z, { ry });
  box(w * 0.55, h * 0.16, d * 0.55, C.buildingB, x, z, { y: h, ry });
  box(w * 0.3, h * 0.1, d * 0.3, C.detail, x + w * 0.18, z - d * 0.14, { y: h + h * 0.16, ry });
  return b;
}

/* A small house with a hip roof (a 4-sided cone rotated 45°), door, window band,
 * and chimney. The cone-as-hip-roof trick is the reusable bit. */
export function house(x, z, w = 7, h = 4.5, d = 8, ry = 0) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.2), mat(C.building));
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1, 4), mat(C.buildingB));
  roof.scale.set(w, h * 0.42, d);           // squash the unit cone to the footprint
  roof.rotation.y = Math.PI / 4;            // 45° → faces align with the box
  roof.position.y = h + (h * 0.42) / 2;
  roof.castShadow = true; grp.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, h * 0.5, 0.2), mat(C.detail));
  door.position.set(0, h * 0.25, d / 2 + 0.05); grp.add(door);
  const winband = new THREE.Mesh(new THREE.BoxGeometry(w * 0.66, h * 0.18, 0.16), mat(C.glass, { roughness: 0.4 }));
  winband.position.set(0, h * 0.62, d / 2 + 0.04); grp.add(winband);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), mat(C.detail));
  chim.position.set(w * 0.28, h + h * 0.42, -d * 0.22); chim.castShadow = true; grp.add(chim);
  grp.position.set(x, 0, z); grp.rotation.y = ry;
  scene.add(grp);
  return grp;
}

/* A long warehouse: a box plus three roof ribs (skylight strips). */
export function warehouse(x, z, w = 16, h = 6, d = 10, ry = 0) {
  box(w, h, d, C.building, x, z, { ry });
  for (let i = -1; i <= 1; i++) box(w * 0.96, 0.9, d * 0.22, C.buildingB, x, z + i * d * 0.3, { y: h, ry, rounded: false });
}

/* ============================================ CANVAS-TEXTURE HELPERS ======= */

/* Draw into an offscreen <canvas> and return a CanvasTexture. The cornerstone of
 * "branding without image files" — signage, corrugation, lettering, gradients. */
export function makeCanvasTexture(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Paint vertical ribs over a base fill — the corrugated-metal look. */
export function corrugate(ctx, w, h, base, rib) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rib;
  for (let x = 6; x < w; x += 14) ctx.fillRect(x, 4, 5, h - 8);
}

/* ============================================ STACKED CRATES =============== *
 * A generic stackable crate (think storage/queue depth, NOT any specific domain).
 * Two "kinds": an ACCENT crate (ribbed + a wordmark) and a PLAIN grey one. Each
 * builds a 6-material array in BoxGeometry face order so the panelled ends and the
 * ribbed sides land correctly. */

// EXAMPLE — accent crate side: white wordmark on an accent-colour ribbing.
// Replace 'BRAND' and the hex values with your own.
const brandSideTex = makeCanvasTexture(512, 256, (ctx, w, h) => {
  corrugate(ctx, w, h, '#bd0f72', 'rgba(0,0,0,0.10)');
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 118px "Arial Black", "Noto Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText('BRAND', w / 2, h / 2 + 4);   // EXAMPLE — your wordmark
});
const brandEndTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
  corrugate(ctx, w, h, '#a90d66', 'rgba(0,0,0,0.10)');
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6;
  ctx.strokeRect(18, 14, w - 36, h - 28);
  ctx.beginPath(); ctx.moveTo(w / 2, 14); ctx.lineTo(w / 2, h - 14); ctx.stroke();  // door split
});
const greySideTex = makeCanvasTexture(512, 256, (ctx, w, h) => corrugate(ctx, w, h, '#eef2f7', 'rgba(40,60,90,0.08)'));
const greyEndTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
  corrugate(ctx, w, h, '#e4eaf2', 'rgba(40,60,90,0.08)');
  ctx.strokeStyle = 'rgba(40,60,90,0.22)'; ctx.lineWidth = 6;
  ctx.strokeRect(18, 14, w - 36, h - 28);
  ctx.beginPath(); ctx.moveTo(w / 2, 14); ctx.lineTo(w / 2, h - 14); ctx.stroke();
});
function crateMaterials(kind) {
  const side = kind === 'brand' ? brandSideTex : greySideTex;
  const end  = kind === 'brand' ? brandEndTex  : greyEndTex;
  const plainColor = kind === 'brand' ? 0xbd0f72 : 0xeef2f7;   // EXAMPLE brand hex
  const sideM = new THREE.MeshStandardMaterial({ map: side, roughness: 0.85 });
  const endM  = new THREE.MeshStandardMaterial({ map: end, roughness: 0.85 });
  const plainM = new THREE.MeshStandardMaterial({ color: plainColor, roughness: 0.85 });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z  (ends, top/bottom, sides)
  return [endM, endM, plainM, plainM, sideM, sideM];
}
export const CRATE_GEO = new THREE.BoxGeometry(3.1, 1.4, 1.55);
export const accentCrateMats = crateMaterials('brand');
export const plainCrateMats  = crateMaterials('grey');

/* A field of stacked crates; ~`brandRatio` of them are branded.
 * Drawn as ≤2 InstancedMeshes (accent / plain) — huge draw-call saving. */
export function crateField(cx, cz, cols, rows, levels, brandRatio = 0.25, ry = 0) {
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const stack = 1 + Math.floor(Math.random() * levels);
    for (let l = 0; l < stack; l++) slots.push({ c, r, l, brand: Math.random() < brandRatio });
  }
  const grp = new THREE.Group();
  ['brand', 'grey'].forEach((kind) => {
    const list = slots.filter((s) => (kind === 'brand') === s.brand);
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(CRATE_GEO, kind === 'brand' ? accentCrateMats : plainCrateMats, list.length);
    const dummy = new THREE.Object3D();
    list.forEach((s, i) => {
      dummy.position.set(s.c * 3.5, 0.7 + s.l * 1.45, s.r * 2.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
  });
  grp.position.set(cx, 0, cz); grp.rotation.y = ry;
  scene.add(grp);
  return grp;
}

/* ============================================ WIND TURBINES (animated) ===== *
 * Each turbine pushes its rotor Group into `rotors`; the render loop spins them.*/
export const rotors = [];
export function turbine(x, z, h = 9) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 8), mat(0xffffff));
  pole.position.set(x, h / 2, z); pole.castShadow = true; scene.add(pole);
  const nacelle = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 1.1, 2, 0.12), mat(0xffffff));
  nacelle.position.set(x, h, z); scene.add(nacelle);
  const rotor = new THREE.Group();
  rotor.position.set(x, h, z + 0.6);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 4.2, 6), mat(0xffffff));
    blade.position.y = 2.1;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i * Math.PI * 2) / 3;   // 120° apart
    rotor.add(arm);
  }
  rotor.rotation.x = Math.PI / 14;            // slight tilt toward camera
  scene.add(rotor);
  rotors.push(rotor);
}

/* ============================================ TINY PEOPLE ================== *
 * A crowd as two InstancedMeshes (capsule bodies + sphere heads), with subtle
 * per-instance tone variation via setColorAt. */
export function people(cx, cz, n, spread = 14) {
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.5, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const heads  = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = cx + (Math.random() - 0.5) * spread, z = cz + (Math.random() - 0.5) * spread;
    const tone = [0xdfe6ef, 0xcfd9e6, 0xbac4d2][Math.floor(Math.random() * 3)];
    dummy.position.set(x, 0.55, z); dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix); bodies.setColorAt(i, col.set(tone));
    dummy.position.set(x, 1.06, z); dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix); heads.setColorAt(i, col.set(tone));
  }
  bodies.castShadow = true; heads.castShadow = true;
  scene.add(bodies); scene.add(heads);
}

/* ============================================ GANTRY ====================== *
 * A portal-frame gantry: legs + portal beams + sill ties, an accent machinery
 * house, a boom with tie rods, an operator cab, trolley, cables, spreader and a
 * hung crate. A generic piece of automation/handling machinery (warehouses,
 * factories, data centers). The `rod()` helper (orient a cylinder between two
 * points via quaternion) is widely reusable for any strut/tie/cable. */
export function gantry(x, z, ry = 0) {
  const grp = new THREE.Group();
  const W = mat(C.building);
  function member(w, h, d, px, py, pz, m = W) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.12), m);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
    return mesh;
  }
  // orient a thin cylinder so it spans a→b (reusable for any diagonal strut)
  function rod(ax, ay, az, bx, by, bz) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const dir = b.clone().sub(a);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, dir.length(), 6), mat(0xc6cfd9));
    cyl.position.copy(a).lerp(b, 0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    cyl.castShadow = true;
    grp.add(cyl);
  }
  [[-5, -4], [5, -4], [-5, 4], [5, 4]].forEach(([lx, lz]) => member(1.1, 14, 1.1, lx, 7, lz));   // legs
  [-5, 5].forEach((lx) => member(1.0, 1.0, 9.1, lx, 7.2, 0));         // portal beams across
  [-4, 4].forEach((lz) => member(11.1, 1.0, 1.0, 0, 13.2, lz));       // top rails
  [-5, 5].forEach((lx) => member(0.9, 0.9, 9.1, lx, 1.0, 0));         // sill ties
  member(4.6, 2.6, 5.2, 0, 15.0, 0, mat(C.brand));                    // machinery house (accent)
  member(0.9, 4.4, 0.9, 0, 18.4, 2.6);                               // apex frame
  member(1.2, 1.2, 30, 0, 16.6, -9);                                 // cantilever boom
  rod(0, 20.4, 2.6, 0, 17.0, -23.5);
  rod(0, 20.4, 2.6, 0, 17.0, -12);
  member(1.6, 1.4, 1.7, 0, 14.9, -6.2, mat(C.glass, { roughness: 0.4 }));  // operator cab
  member(2.0, 0.7, 2.5, 0, 15.7, -14, mat(C.detail));                // trolley
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([cx2, cz2]) => {
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.06, 5.6, 0.06), mat(0xb8c2cf));
    cable.position.set(cx2, 12.5, -14 + cz2); grp.add(cable);
  });
  member(2.2, 0.35, 1.7, 0, 9.6, -14, mat(C.detail));                // spreader
  const hung = new THREE.Mesh(CRATE_GEO, accentCrateMats);              // hung crate
  hung.position.set(0, 8.7, -14); hung.rotation.y = Math.PI / 2; hung.castShadow = true; grp.add(hung);
  grp.position.set(x, 0, z); grp.rotation.y = ry;
  scene.add(grp);
}

/* ============================================ TREE ======================== */
export function tree(x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.1 * s, 7), mat(0xcfc4b4));
  trunk.position.set(x, 0.55 * s, z); trunk.castShadow = true; scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15 * s, 2.6 * s, 8), mat(0xb8c6bd));
  crown.position.set(x, 1.1 * s + 1.3 * s, z); crown.castShadow = true; scene.add(crown);
}

/* ============================================ LABEL CHIPS / GLOWS ========== *
 * label(): bakes pill-shaped text into a canvas sprite. Pushes {sp, from, to}
 * into `labels`; the render loop fades each via windowFade(p, from, to). Pass
 * hidden:true for a label you'll animate yourself (e.g. a finale chip). */
export const labels = [];
export function label(text, x, y, z, { accent = false, scale = 1, hidden = false, from = -1, to = 2 } = {}) {
  const pad = 28, fs = 44;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `600 ${fs}px 'Noto Sans', sans-serif`;
  const tw = ctx.measureText(text).width;
  cv.width = tw + pad * 2; cv.height = fs + pad * 1.4;
  const r = 22, w = cv.width, h = cv.height;
  const c2 = cv.getContext('2d');
  c2.beginPath();
  c2.roundRect(2, 2, w - 4, h - 4, r);
  c2.fillStyle = accent ? '#BD0F72' : 'rgba(255,255,255,0.94)';   // EXAMPLE accent = brand hex
  c2.fill();
  c2.strokeStyle = accent ? '#BD0F72' : 'rgba(184,190,200,0.7)';
  c2.lineWidth = 2; c2.stroke();
  c2.font = `600 ${fs}px 'Noto Sans', sans-serif`;
  c2.fillStyle = accent ? '#ffffff' : '#333333';
  c2.textBaseline = 'middle'; c2.textAlign = 'center';
  c2.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = 0.0135 * scale;
  sp.scale.set(w * k, h * k, 1);
  sp.position.set(x, y, z);
  sp.renderOrder = 20;                  // always float above geometry
  if (hidden) sp.material.opacity = 0;
  else labels.push({ sp, from, to });
  scene.add(sp);
  return sp;
}

/* Opacity ramp for a label that should be visible only inside scroll window
 * [from,to]. from<0 means "always on". `ramp` is the fade width in progress. */
export function windowFade(p, from, to, ramp = 0.03) {
  if (from < 0) return 1;
  const a = from <= 0 ? 1 : THREE.MathUtils.clamp((p - from) / ramp, 0, 1);
  const b = THREE.MathUtils.clamp((to - p) / ramp, 0, 1);
  return Math.min(a, b);
}

/* A soft radial glow texture for additive sprites (comet heads, packets, pulses).
 * hex must be a 6-digit '#rrggbb' (alpha is appended). */
export function glowTexture(hex) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, hex + 'ff'); g.addColorStop(0.35, hex + '88'); g.addColorStop(1, hex + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// EXAMPLE glows — one per signal colour. Replace hexes to match your palette.
export const accentGlowTex = glowTexture('#7fd6dd');   // data/event signal — the secondary accent
export const brandGlowTex  = glowTexture('#2bc0d0');   // route/request signal — the reserved brand accent
