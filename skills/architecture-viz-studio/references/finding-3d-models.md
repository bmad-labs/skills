# Finding 3D Models

Best ways to find or make 3D models for these low-poly architecture scenes — with a decision tree, sources (license + format notes), and the load/recolor/optimize pipeline.

## Table of contents
- [Decision tree (read this first)](#decision-tree)
- [Build procedurally — usually the right answer](#procedural)
- [Kit sources (CC0 / permissive)](#kit-sources)
- [AI generation](#ai-generation)
- [Tools](#tools)
- [Loading .glb with GLTFLoader](#loading-glb)
- [Recolor to the palette](#recolor)
- [Optimize (draco, decimate)](#optimize)

---

## Decision tree

1. **Can it be modelled from primitives?** (building, server rack, datacenter, dish, TV, plinth, tube,
   tree, person, gantry.) → **Build it procedurally — but MODEL it, don't stack a few generic boxes.**
   Compose recognizable detail from rounded boxes + cylinders + extrudes + canvas-texture faces (a rack
   has slats + an LED strip; a building has a window grid + rooftop unit). Generic cubes-on-cubes read as
   ugly/slop. Fast, on-brand, license-free, instanceable, fully tweakable — the default for ~80% of scenes.
   See the modelling lesson in `gotchas-and-lessons.md` and the `sample/` builders.
2. **Need a recognizable real object you don't want to model?** (vehicle, specific machine, furniture, landmark.) → **Grab a CC0 low-poly kit asset** (Kenney first). Recolor to the palette.
3. **Need something bespoke that no kit has and primitives can't fake?** → **AI-generate** (Meshy/Tripo) or **model in Blender**, export GLB, recolor, decimate. Last resort — slower, license caveats, off-style risk.

Procedural-first (modelled, not blocky), kit second, AI/custom last.

---

## Procedural

For this pale soft-isometric style, **procedural primitives usually beat imported models**: they match the look exactly, are tiny, carry no license, and can be `InstancedMesh`'d by the hundred. The skill's `primitives.js` already builds rounded buildings, towers, houses, warehouses, ribbed crates (+ instanced fields), wind turbines with animated rotors, crowds of tiny people, a gantry, and trees — copy and parameterize these before importing anything.

Use `RoundedBoxGeometry` for the soft edges, cylinders/cones for towers/trees, `ExtrudeGeometry` for custom footprints, `LatheGeometry` for radial shapes. Canvas-textures for any signage/logo/ribbing (no image files). See gsap-threejs-playbook.md for all of these.

When a model *would* need import but you only need its silhouette at distance, fake it with primitives — at diorama scale, detail reads as noise anyway.

---

## Kit sources

Prefer **CC0** (no attribution, commercial-OK) for zero friction. License legend: ✅ CC0 site-wide
(safe default) · ⚠️ per-asset (CC0 *or* CC-BY — must check each model page) · 🔶 free but terms
restrict shipping/redistribution (verify before using in a deliverable).

### CC0 low-poly kits — the best defaults ✅ (use these first)
- **Kenney.nl** — *top pick.* https://kenney.nl/assets (filter 3D). 40k+ CC0 assets; cohesive low-poly
  kits (City, Nature, Buildings, Vehicles, Furniture, Space, Hexagon tiles…). Flat/soft — matches this
  style out of the box. GLB/GLTF + OBJ + FBX (verify per-kit; a few older packs are OBJ/FBX only).
  CC0 site-wide, no attribution. Also on `kenney-assets.itch.io`.
- **Quaternius** — https://quaternius.com. Thousands of **CC0** low-poly assets, many rigged+animated
  (Ultimate Space/Nature/Modular kits, characters, vehicles, monsters). glTF/GLB/FBX/OBJ/.blend.
  Individual models are easiest to fetch as GLB via Poly Pizza.
- **KayKit / Kay Lousberg** — https://kaylousberg.itch.io. Among the **best-looking free** low-poly kits
  (dungeons, medieval/city builders, animated skeletons/characters, furniture). **CC0.** glTF/GLB + FBX,
  with animations. itch.io pay-what-you-want ($0 valid).
- **Poly Pizza** — https://poly.pizza (explore: /explore · by license: /search/license). ~7k+ curated
  low-poly models (rescued the Google Poly catalog), hosts Quaternius/Kenney + individual artists.
  **GLB** primary download (ideal), has a public API (poly.pizza/docs) → **best programmatic single-model
  source.** ⚠️ **Mixed CC0 + CC-BY, per-asset** — read each model page's license + author; record it.

### Marketplaces with free/CC sections (per-asset — filter carefully)
- **Sketchfab** — https://sketchfab.com/3d-models. The largest CC source. **Filter `Downloadable` + License
  = `cc0` or `by`** (avoid any `nc`/`nd` and the `st`/`ed` Sketchfab-Standard/Editorial licenses — those
  aren't Creative Commons). Most downloads are **CC-BY (attribution required)**; ~2k+ are CC0. glTF/GLB/USDZ.
  Has an OAuth Download API. ⚠️ per-asset; Sketchfab gives a copy-paste attribution string on download.
- **CGTrader / TurboSquid / Free3D (free sections)** 🔶 — large, but mostly **"Royalty-Free"** (their own
  license), **per-asset**, often **glTF-rare** (OBJ/FBX → convert). The Royalty-Free terms typically
  **prohibit redistributing the raw model file** — genuinely ambiguous for a browser-served GLB, so
  **prefer CC0/CC-BY sources for a shipped web page.** Free3D also marks many models "Personal Use Only"
  (cannot ship). Read each model's license line.
- **Clara.io** 🔶 — https://clara.io/library (`?gameCheck=true` free filter). Browser editor; can export
  Three.js JSON + glTF directly. ⚠️ CC per-asset, inconsistently labeled — verify each.

### Textures / HDRIs (not low-poly props, but great for lighting) ✅
- **Poly Haven** — https://polyhaven.com (models · textures · **hdris**). **CC0 site-wide**, public API
  (api.polyhaven.com). Models are photoreal/high-poly (decimate before web use) — but the **HDRIs are the
  standout** for Three.js environment lighting/reflections, and the PBR textures are excellent. Use it for
  HDRI lighting + ground/material textures, not the diorama props.

### Official / Three.js-specific
- **three.js `examples/models`** — https://github.com/mrdoob/three.js/tree/dev/examples/models. The demo
  models (DamagedHelmet, Soldier, Flamingo, LittlestTokyo, Xbot, Parrot…). 🚨 **The three.js CODE is MIT
  but the MODELS are NOT blanket-MIT — each carries its own license, several are CC-BY.** Great for
  prototyping; **check each model's license before shipping** (this is the #1 license mistake).
- **Khronos glTF Sample Assets** — https://github.com/KhronosGroup/glTF-Sample-Assets (the current repo;
  the old `glTF-Sample-Models` is deprecated). Canonical feature/test models for validating your
  GLTFLoader + extension pipeline (Draco/KTX2/embedded variants). ⚠️ per-model license — see each dir's
  README / the `Models/Models.md` table.

### License vetting (apply before shipping — record `{source, url, author, license}` per asset)
- **CC0 / Public Domain** ✅ — use freely, no attribution, commercial OK.
- **CC-BY** ✅ — OK to ship **but must attribute** (author + "via [platform]" + link the license, in a
  CREDITS/about). Most Sketchfab/Poly-Pizza items and several three.js example models.
- **CC-BY-SA** ⚠️ share-alike — usually avoid for proprietary work.
- **CC-BY-NC / -ND** 🚫 — NonCommercial / NoDerivatives — do not ship.
- **"Royalty-Free" / "Free for personal" / "Editorial"** 🔶/🚫 — raw-file redistribution often barred,
  personal/editorial can't ship. Verify or skip.
- **Golden rule:** when unsure, default to the CC0 sources above (Kenney/Quaternius/KayKit/Poly Haven).
  They remove the legal question entirely. **Never ship a model whose license you didn't verify.**

---

## AI generation

Worth it when you need a **specific bespoke object** fast and no kit has it (a particular product, a stylized landmark). Not worth it for anything primitives or a kit can cover — output needs cleanup, may be high-poly, and licensing is murkier.

- **Meshy.ai** — https://meshy.ai — text/image → 3D, GLB/FBX/OBJ/USDZ, auto-retopo + PBR.
- **Tripo3D** — https://www.tripo3d.ai — fast text/image → 3D, GLB export.
- **Luma Genie** — https://lumalabs.ai/genie — GLB/OBJ/FBX/USDZ. (Luma is also strong for photoreal NeRF/
  Gaussian-splat capture of *real* objects — heavier, off-style for flat low-poly.)
- **Rodin / Hyper3D** — https://hyper3d.ai — GLB/FBX/USDZ.

🚨 **License is tier-dependent and changes often.** **Free-tier output is usually non-commercial or
CC-BY-style** — commercial rights generally require a **paid plan with private generation**. Treat
free-tier AI output as **non-commercial by default**; re-verify the live ToS before shipping. Always
expect to **decimate + recolor + re-export** (messy topology, mid-poly) to fit the palette and budget —
treat the output as raw material, not final.

---

## Tools

- **Blender** (free) — the workhorse for custom/cleanup: model or import, decimate, bake, then **File → Export → glTF 2.0 (.glb)** for the `GLTFLoader` pipeline. Apply transforms before export; export `+Y up` (glTF default) — Three.js expects it. Use the *Draco* compression option on export for big meshes.
- **Spline** (spline.design) — browser 3D editor; can export GLTF and even ship an interactive scene. Easy for simple stylized objects; watch poly count and the runtime if you embed its player. Good for quick bespoke props.
- **glTF Transform** (Don McCurdy) — https://gltf-transform.dev — the go-to web optimizer. CLI
  one-liner `gltf-transform optimize in.glb out.glb` does Draco/meshopt compression, texture resize →
  WebP/KTX2, dedup/weld/flatten, and join-meshes-to-cut-draw-calls (often **5–10× smaller**). Run on
  anything imported. (`gltfpack`/meshoptimizer is an alternative CLI.)
- **glTF Report** — https://gltf.report — drag-drop inspector (polycount, draw calls, texture sizes) +
  a scripting tab. **glTF Viewer** — https://gltf-viewer.donmccurdy.com — drag-drop preview/validation.
  Use these to sanity-check a downloaded model before wiring it in.

---

## Loading .glb

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
const loader = new GLTFLoader().setDRACOLoader(draco);   // only needed for draco-compressed glb

loader.load('models/gantry.glb', (gltf) => {
  const obj = gltf.scene;
  obj.traverse((n) => {
    if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }   // imports default to no shadows
  });
  obj.userData.vizId = 'scene.gantry';   // self-identify — see ai-collaboration-protocol.md
  obj.scale.setScalar(0.04);                   // kit units rarely match your world; normalize
  scene.add(obj);
});
```

Gotchas: imported meshes **don't cast/receive shadows** until you set it. Scale is almost never right — normalize to your world units. If many copies, extract the geometry+material and build an `InstancedMesh` instead of cloning the node graph.

---

## Recolor

Force imported models onto the brand palette so they don't clash with the procedural world:

```js
import { PALETTE, mat } from '../scene/scene-setup.js';
obj.traverse((n) => {
  if (n.isMesh) {
    n.material = mat(PALETTE.building);                 // replace entirely with a palette material
    // or just retint: n.material.color.setHex(PALETTE.accent);
  }
});
```

Replacing materials wholesale (with your `mat()` helper) is usually cleaner than tweaking imported PBR maps — it guarantees the soft flat look and drops texture memory. Reserve the brand/accent color for hero objects only (restraint rule); recolor background props to neutral environment tones.

---

## Optimize

- **Draco / meshopt compress** geometry (`gltf-transform draco in.glb out.glb` or gltfpack `-c`) — big download win; needs the matching loader/decoder.
- **Decimate** high-poly imports (Blender Decimate modifier, or gltf-transform `weld` + `simplify`) to a tri count that suits diorama scale — you rarely need >2–5k tris per background prop.
- **Strip what you don't use**: animations, extra UV sets, unused nodes (`gltf-transform prune`). **Resize textures** to ≤512–1024 (`gltf-transform resize`), or drop them entirely if you're recoloring to flat palette materials.
- **Instance repeats** rather than loading N copies. One `InstancedMesh` of containers beats 100 GLB nodes.
- Keep total downloaded model bytes modest — this is a fast-loading marketing/architecture page, not a game; every MB delays first paint of the scene.
