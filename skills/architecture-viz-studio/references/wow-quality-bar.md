# The wow quality bar — studio-grade vs student-grade 3D

The difference between a scene that makes someone say "wow" and one that looks like a student exercise is
**not the geometry** — it's light, depth, atmosphere, and a graded final image. A flat scene renders
*objects*; a pro scene renders *a photographed/film frame*. This is a hard quality gate: a hero 3D scene
is not done until it clears the **Biggest-5** below. "No bugs" is not the bar; "wow" is.

The single mental model: **render the geometry, then grade the whole image like a film still.** Student
scenes stop at raw `MeshStandardMaterial` + a couple of lights + the default linear render. Pro scenes do
~15 cheap things that compound — and the first 5 do most of the work.

## Table of contents
- [The Biggest-5 (do these or it isn't done)](#biggest-5)
- [0. The render pipeline baseline](#baseline)
- [1. Lighting & shadows](#lighting)
- [2. Materials](#materials)
- [3. Post-processing (the biggest wow lever)](#post)
- [4. Camera & motion](#camera)
- [5. Atmosphere & detail](#atmosphere)
- [6. The taste layer + 60fps discipline](#taste)
- [Version notes](#versions)

---

<a name="biggest-5"></a>
## The Biggest-5 — if you add only five things, in this order

Each builds on the last. A hero scene MUST do at least these before it's called done.

1. **Fix the render pipeline + tone mapping.** `outputColorSpace = SRGBColorSpace`,
   `toneMapping = ACESFilmicToneMapping` (or `AgXToneMapping`/`NeutralToneMapping`), `toneMappingExposure`
   ~1.0, `pixelRatio` capped at 2. **Zero cost.** Fixes the milky/blown-out look that flags 90% of amateur
   scenes — highlights roll off instead of clipping to flat white, colors are correct.
2. **HDRI / environment IBL via PMREM** → `scene.environment`. **One-time cost.** Gives every surface
   correct reflections and soft fill from all angles — the biggest lighting jump for the least work. Use
   `RoomEnvironment` if you have no `.hdr` asset (procedural, zero download).
3. **Post-processing: selective bloom + depth-of-field** (`pmndrs/postprocessing`). **Moderate cost.**
   The single biggest wow lever: emissive accents *glow like light*, the hero pops in focus, the
   background blurs — the frame looks *shot*, not rendered flat.
4. **Three-point lighting with a RIM light + soft contact shadows.** **Cheap–moderate.** A back/rim light
   separates the hero from the background (the most "expensive-looking" trick); soft, slightly transparent
   contact shadows ground it. Hard black sharp-edged shadows scream "default Three.js."
5. **Eased, staged GSAP motion + fog for depth.** **Cheap.** Nothing moves at constant velocity; the hero
   reveals first, supporting elements stagger in with `expo.out`/`power3`. `FogExp2` adds aerial depth.
   Linear tweens and "everything appears at frame 1" are the flat default.

Everything below §1–§5 (clearcoat, N8AO, god rays, particles, reflections, LUT grade, film grain) is
polish on top of these five — high value, but only after the foundation reads correctly.

---

<a name="baseline"></a>
## 0. Render pipeline baseline (do this first or nothing else matters)

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;          // r152+; NOT the removed outputEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping;        // or AgXToneMapping / NeutralToneMapping
renderer.toneMappingExposure = 1.0;                        // grade with this (~0.6–1.4)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));     // cap at 2, never raw DPR
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```
Tone mapping is what makes highlights roll off instead of clipping; sRGB output makes color correct.
Without these, even perfect lighting looks washed-out/milky — the #1 amateur tell. **AgX** (matches
Blender 4.x, natural roll-off) or **Neutral** (Khronos PBR-neutral, accurate product color) often look
better than plain ACES if things go desaturated.

---

<a name="lighting"></a>
## 1. Lighting & shadows

- **Three-point (key / fill / rim).** Key = brightest `DirectionalLight` ~45° front (intensity ~2–4).
  Fill = `HemisphereLight`/low `AmbientLight` opposite, ~⅓–½ key (~0.3–0.8). **Rim = `DirectionalLight`
  from BEHIND the subject (~3–6)** — the single most expensive-looking trick; it separates the hero from
  the background. Flat scenes light from one direction so everything reads as one silhouette blob.
- **RectAreaLight** for soft, photographic key light (softbox/window look → highlights stretch across a
  surface = product-shot signature). Must call `RectAreaLightUniformsLib.init()`. Caveats: **no shadows**,
  only affects `MeshStandard`/`MeshPhysical`. Intensity ~2–8. Cheap (analytic LTC).
- **Soft contact shadows.** Real-time: `PCFSoftShadowMap` + `shadow.bias ~ -0.0005`,
  `shadow.normalBias ~0.03`, `shadow.radius ~3–10`, **a tight `shadow.camera` frustum hugging the scene**
  (the #1 fix for blocky shadows), `shadow.mapSize 1024–2048`. Softer/cheaper: a blurred shadow-catcher
  (drei `ContactShadows` pattern — render depth, blur, project on a ground plane; `opacity ~0.4–0.7`).
  Best static look: `AccumulativeShadows` (bake many randomized samples → one soft texture; ray-traced
  look, ~zero runtime cost after baking).
- **Ambient occlusion** (contact darkening in crevices): `N8AO` (best real-time today; better than the old
  `SSAOPass`) or **bake AO into an `aoMap`** (zero runtime cost — the standard low-poly move). Keep it
  **subtle** — overcooked AO = grimy black halos.
- **HDRI / IBL via PMREM** (biggest single lighting upgrade): `RGBELoader` → `PMREMGenerator.fromEquirect`
  → `scene.environment` (and optionally `.background`). No asset? `RoomEnvironment` → `pmrem.fromScene()`.
  PMREM pre-filters into correct roughness mips so reflections are right at every roughness;
  `environmentIntensity ~0.5–1.5`; rotate the env to place highlights deliberately. **Poly Haven** has
  free CC0 HDRIs (see `finding-3d-models.md`).

**Stylized/low-poly stays rich without physical realism:** bake lighting into vertex colors / a lightmap
(Blender) and ship flat-shaded geometry that's fully lit at zero cost; or `MeshToonMaterial` + a 2–4-step
`gradientMap`; or **matcaps** (`MeshMatcapMaterial` — gorgeous baked lighting for free, ideal for many
instances). Low-poly wins on **art direction** (tight palette + emissive accents + bloom), not light math.

---

<a name="materials"></a>
## 2. Materials

- **`MeshPhysicalMaterial` for the HERO**, `MeshStandardMaterial` for the rest. Physical adds the premium
  layers: `clearcoat`(0–1)+`clearcoatRoughness`(~0.05–0.2) = lacquered/car-paint/phone-glass;
  `sheen`+`sheenColor` = fabric/satin edge glow; `transmission`(0–1)+`ior`(~1.45)+`thickness` = real glass
  (**high perf cost** — needs a transmission pass; cheaper fake: low-opacity + strong env map + fresnel);
  `iridescence` = soap-bubble/oil/anodized shift.
- **Break up constant materials.** A *constant* roughness/metalness reads as CG plastic — add a
  low-contrast `roughnessMap` (even noise) so highlights break across the surface; `normalMap` for
  micro-detail; `aoMap` for baked occlusion. Cheapest way to kill the "default material" look.
- **Fresnel rim glow** (edges catch light) via `material.onBeforeCompile` injecting a
  `dot(normal, viewDir)` term into emissive/output (mix ~0.0–0.6). Implies a rim light and separates the
  object from the background — heavily used in stylized heroes.
- **Emissive accents** (`emissive` + `emissiveIntensity`) on *small* geometry (screens, edges, windows,
  neon) → these become glow sources once bloom is on. Keep emissive a small fraction of the frame.

---

<a name="post"></a>
## 3. Post-processing — the biggest single wow lever

**Use `pmndrs/postprocessing`, not three's `examples/jsm/postprocessing`.** It merges multiple effects
into ONE fullscreen `EffectPass` (one read/write instead of N), handles color space correctly, and has
better AA (SMAA) + modern effects. (Three's example passes are fine for a single effect but get expensive
and color-buggy when chained.)

Tasteful order (bundle 3–6 into a single `EffectPass`):
1. `RenderPass`
2. **AO** — `N8AOPass` / `GTAOEffect` (wants the raw render). `aoRadius` ~0.5–2 world units, `intensity`
   ~1–2. Subtle.
3. **Selective bloom** — `SelectiveBloomEffect` (only emissive accents glow, not the whole bright scene =
   the pro version) or `BloomEffect`. `luminanceThreshold` ~0.7–0.9, `intensity` ~0.3–0.8, `radius`
   ~0.4–0.85. Overcooked bloom (low threshold, high strength) is the #1 tryhard tell — keep the threshold
   high so only genuine highlights bloom.
4. **Depth of field** — `DepthOfFieldEffect` (`focusDistance` on the hero, `bokehScale` ~2–4) or three's
   `BokehPass` (`aperture` ~0.0001–0.002, `maxblur` ~0.005–0.02). Focuses the eye on the hero, blurs the
   background → "shot, not rendered." Cheaper fake: stronger `fog` + a blurred background plane.
5. **Finishing**: `NoiseEffect` (grain opacity ~0.02–0.06 — kills banding, adds "film"), `VignetteEffect`
   (`darkness` ~0.4–0.7), `ChromaticAberrationEffect` (`offset` ~0.0005–0.002 — tiny). If a viewer can
   *name* the effect, it's too strong.
6. **Color grade**: a `LUTEffect` + `.cube` `LookupTexture` is the biggest art-direction lever after
   lighting. Or grade via tone mapping + exposure.
7. `SMAAEffect` **last** (MSAA doesn't apply to post-processed render targets → jagged edges without it).

CDN ESM: `import { EffectComposer, RenderPass, EffectPass, BloomEffect, ... } from
'https://cdn.jsdelivr.net/npm/postprocessing@6/+esm'` (pin the version; match the three version).

---

<a name="camera"></a>
## 4. Camera & motion (feels designed, not linear)

- **Never constant-velocity.** Linear `t` is the universal student tell. Camera dolly: GSAP
  `power2/power3.inOut` (weighty). Reveals: `expo.out` (fast-in, settle — decisive/premium).
  `back.out`/`elastic.out` *sparingly* for playful accent pops only.
- **Dolly + look-at retargeting**: animate camera position AND a separate `target` Vector3 (each with its
  own ease), `camera.lookAt(target)` per frame — don't just rotate in place.
- **Damped mouse parallax**: map pointer to a small camera offset, but **lerp toward it**
  (`cur += (target - cur) * 0.05–0.1`/frame) so it trails smoothly. Snapping to the mouse is the amateur
  version. Multi-layer (foreground moves more than background).
- **Idle drift**: when nothing happens, drift on layered sines (`y += sin(t*0.3)*0.05`) so a static hero
  doesn't feel dead.
- **Staged GSAP reveal** (the hallmark): a timeline where the hero comes in first, then supporting elements
  with `stagger` ~0.05–0.15s, each `from` an offset (`y`/`scale`/`opacity`) with `expo.out` + slight
  overshoot. Drive on scroll with ScrollTrigger (`scrub: true` ties it to scroll). "Everything at frame 1"
  is the flat default.
- **Depth via `FogExp2`** (density ~0.01–0.05, tinted to the background) — nearly free, big readability win,
  pairs with DOF.

---

<a name="atmosphere"></a>
## 5. Atmosphere & detail (fills the "wow")

- **God rays / volumetric fakes**: `GodRaysEffect` (radial blur from a bright mesh; `density ~0.9`,
  `decay ~0.9`, `weight ~0.4`) or additive transparent gradient cones. Implies a thick atmosphere = instant
  cinematic mood.
- **Particles / dust motes**: a `Points` cloud of slow-drifting motes (~500–3000, tiny, low opacity,
  additive) — sells scale and atmosphere, becomes bokeh sparkle under DOF. Animate in a vertex shader, not
  on the CPU.
- **Ground reflections**: `Reflector` / drei `MeshReflectorMaterial` — keep `mixStrength` low (a *hint*,
  not a mirror); `blur` for softness, `resolution ~256–512`. Re-renders the scene once/frame — budget it,
  or fake with a blurred low-opacity flipped copy.
- **Gradient sky/environment** beats flat black; match it to the grade + fog color.
- **Animated noise** on one or two surfaces (flowing energy, shimmer, breathing emissive) adds the
  "living" quality — low amplitude.
- **Instanced detail density**: fill negative space with *cheap* repeated detail (`InstancedMesh` — thousands
  of instances, one draw call). Density implies effort; sparse scenes look unfinished. **But** keep a clear
  focal point + breathing room — composition, not asset-dump.

---

<a name="taste"></a>
## 6. The taste layer + 60fps discipline

- **One hero moment.** Restraint is the real differentiator: animate ONE thing beautifully, let the rest
  support it. Tryhard demos animate everything, so the eye never rests.
- **Consistent art direction**: one palette, one grade (LUT), one lighting mood, one motion language
  (consistent easing). Mixed styles read as "a collection of tutorials."
- **60fps budget discipline** (the wow can't tank perf or it isn't wow): **bake what's static** (lighting,
  AO, shadows → lightmaps/AccumulativeShadows), **compute only what moves**; cap `pixelRatio` at 2; prefer
  `InstancedMesh`; keep the post chain in one merged `EffectPass`; reserve expensive effects (transmission,
  reflector, god rays, real-time shadows) for the **one** hero, not the whole scene. Run the
  `gsap-threejs-playbook.md` performance checklist — wow + jank is a fail.
- **Tasteful vs tryhard, in one line**: tasteful = motivated effects in service of a focal point at locked
  framerate; tryhard = every effect at max, everything animated, framerate dropping. **If you can name the
  effect, it's too strong.**

---

<a name="versions"></a>
## Version notes (verify against the installed three version)

- **`outputEncoding` is gone → use `outputColorSpace = THREE.SRGBColorSpace`.**
- **`physicallyCorrectLights` is gone — physical lights are the default now.** Old tutorials' low intensity
  values will look dark; use the higher ranges above.
- **`AgXToneMapping` + `NeutralToneMapping` exist** alongside ACESFilmic (r160+).
- `pmndrs/postprocessing` is the safe default. WebGPURenderer + TSL is production-viable in 2026 (newer
  Codrops hero demos use it, with MRT selective bloom + node fresnel) — but its post API differs from the
  WebGL `EffectComposer` shown here. Confirm constant/effect names against your pinned versions.
