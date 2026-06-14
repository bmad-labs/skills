/* ============================================================================
   viz.js — the `window.__viz` query API (optional companion to edit-mode).

   WHY
   Edit-mode lets a human point; this gives the AI (or any script) a programmatic
   way to ASK the page about its own viz ids and 3D objects, and to resolve an id
   to its source location via the build-time manifest. It's the "read the UI"
   half of the loop: structure-first, stable ids, no coordinate guessing.

   LOAD ORDER
     <script src="viz-manifest.js"></script>   (sets window.__VIZ_MANIFEST; optional)
     <script src="edit-mode/viz.js"></script>
     ...then once your scene exists:  __viz.attachScene({ THREE, renderer, camera, scene })
     and register objects (edit-mode's registerVizObject already tags userData.vizId;
     __viz reads the same tags, so you don't double-register).

   API (all return plain JSON-friendly data)
     __viz.list()                  → [{ id, kind, source? }]               every known id (DOM+SVG+3D)
     __viz.find(id)                → { id, kind, rect?, source?, present }  one id, with on-screen rect + source
     __viz.source(id)              → { file, line, builderFn?, cssRule? }   from the manifest
     __viz.pickAt(ndcX, ndcY)      → id | null                             raycast the 3D scene at NDC coords
     __viz.highlight(id, ms=1500)  → void                                  briefly flash a DOM/SVG element
     __viz.attachScene(ctx)        → void                                  { THREE, renderer, camera, scene }

   Dependency-free. 3D methods are no-ops until attachScene is called.
   ============================================================================ */

(function (global) {
  'use strict';

  const ctx = { THREE: null, renderer: null, camera: null, scene: null };
  const manifest = () => global.__VIZ_MANIFEST || {};

  function attachScene(c) { Object.assign(ctx, c); }

  function source(id) { const m = manifest(); return m[id] || null; }

  // Collect every 3D object carrying userData.vizId.
  function threeIds() {
    const out = [];
    if (!ctx.scene) return out;
    ctx.scene.traverse((o) => { if (o.userData && o.userData.vizId) out.push({ id: o.userData.vizId, obj: o }); });
    return out;
  }

  function list() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      const id = n.getAttribute('data-viz-id');
      if (seen.has(id)) return; seen.add(id);
      const kind = n.namespaceURI && n.namespaceURI.includes('svg') ? 'svg' : 'dom';
      out.push({ id, kind, source: source(id) || undefined });
    });
    threeIds().forEach(({ id }) => {
      if (seen.has(id)) return; seen.add(id);
      out.push({ id, kind: 'three', source: source(id) || undefined });
    });
    return out;
  }

  function rectForDom(id) {
    const n = document.querySelector(`[data-viz-id="${cssEsc(id)}"]`);
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  }

  function rectForThree(id) {
    if (!ctx.THREE || !ctx.scene) return null;
    let obj = null;
    ctx.scene.traverse((o) => { if (o.userData && o.userData.vizId === id) obj = o; });
    if (!obj) return null;
    const box = new ctx.THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;
    const cv = ctx.renderer.domElement, cb = cv.getBoundingClientRect();
    const v = new ctx.THREE.Vector3();
    const cs = [[box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
      [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
      [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
      [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z]];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, front = false;
    for (const c of cs) {
      v.set(c[0], c[1], c[2]).project(ctx.camera);
      if (v.z < 1) front = true;
      const sx = cb.left + (v.x * 0.5 + 0.5) * cb.width;
      const sy = cb.top + (-v.y * 0.5 + 0.5) * cb.height;
      minX = Math.min(minX, sx); minY = Math.min(minY, sy); maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
    }
    return front ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
  }

  function find(id) {
    const dom = document.querySelector(`[data-viz-id="${cssEsc(id)}"]`);
    if (dom) {
      const kind = dom.namespaceURI && dom.namespaceURI.includes('svg') ? 'svg' : 'dom';
      return { id, kind, present: true, rect: rectForDom(id), source: source(id) };
    }
    const three = threeIds().find((t) => t.id === id);
    if (three) return { id, kind: 'three', present: true, rect: rectForThree(id), source: source(id) };
    return { id, present: false, source: source(id) };
  }

  function pickAt(ndcX, ndcY) {
    if (!ctx.THREE || !ctx.scene) return null;
    const ray = new ctx.THREE.Raycaster();
    ray.setFromCamera(new ctx.THREE.Vector2(ndcX, ndcY), ctx.camera);
    const hits = ray.intersectObjects(ctx.scene.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o) { if (o.userData && o.userData.vizId) return o.userData.vizId; o = o.parent; }
    }
    return null;
  }

  function highlight(id, ms) {
    const n = document.querySelector(`[data-viz-id="${cssEsc(id)}"]`);
    if (!n) return;
    const prev = n.style.outline;
    n.style.outline = '2px solid #f0b35c';
    setTimeout(() => { n.style.outline = prev; }, ms || 1500);
  }

  const cssEsc = (s) => (global.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"');

  global.__viz = { list, find, source, pickAt, highlight, attachScene };
})(window);
