/* ============================================================================
   edit-mode.js — drop-in visual feedback tool for architecture-viz pages.

   WHY THIS EXISTS
   The hardest part of iterating on a rich visual page with an AI is *pointing*:
   "make THAT box smaller", "this arrow", "the third pipeline step" — words are
   slow and ambiguous, and a single round of feedback can take many turns. This
   overlay lets a human SELECT the exact things they mean (DOM components, a
   snipped area, a free-brush region, or 3D objects in the Three.js scene),
   attach a comment to each, batch them, and hand the AI one payload that names
   every target by its stable id (and, when a viz-manifest is present, the exact
   file/line/builder that produced it). Claude reads that and edits in one hop.

   THE TWO VIEWS (toolbar toggle)
   - Normal view: the page looks normal. On HOVER, the hovered element's rect +
     its `data-viz-id` badge appear. This is true for 3D objects too (their
     projected bounding box + vizId badge show on hover).
   - Expert view: ALL tagged rects + vizId badges are shown at once (DOM, SVG,
     and registered Three.js objects), so you can see the whole id map.

   THE TOOLS (toolbar)
   - Pointer: interact with the page normally — no hover highlights, no rects, clicks
     pass straight through (drill modals open, links work). The page behaves exactly as
     if edit mode were off, but the toolbar stays up so you can switch back. (hotkey 1)
   - Select: hover to reveal, click a component / 3D object to add it as a comment.
     CTRL/⌘+CLICK builds a MULTI-SELECT — keep ctrl/⌘+clicking to add more elements
     (ctrl/⌘+click an already-selected one to remove it); then press Enter or click
     "Comment" (or plain-click) to turn the whole set into ONE comment with many
     targetIds. Escape clears the pending selection.
   - Snip: drag a rectangle; captures a screenshot of the region + auto-detects
     the tagged components inside it.
   - Brush: paint a freehand region; its bounding area + the components it
     covers are captured (good for "this whole messy corner").

   THE PANELS (both DRAGGABLE — drag the toolbar by its ✎ Edit brand, the comment
   panel by its header; they clamp to the viewport so they never get lost)
   - Toolbar (top): view switch, tool switch, and the master close button.
   - Comment panel (side): the running batch of comments with thumbnails;
     edit text, delete, then "Copy for AI" / "Download".

   HOW TO WIRE IT (3 steps)
   1. Tag DOM/SVG: add `data-viz-id="hero.title"` to selectable components.
      RULE: tag EVERY meaningful text element too (headings, paragraphs, nav links,
      footer/header text, numbers) — not just containers. Edit-mode can only select
      a node that has its OWN id; untagged text just selects its parent. Use dotted
      ids under the container (`card.audit.title`, `footer.text`).
   2. Tag 3D objects: `EditMode.registerVizObject(mesh, 'scene.service-core')`,
      and pass the renderer/camera/scene once via
      `EditMode.attachScene({ THREE, renderer, camera, scene })`. Objects that are
      backdrops (ground/sky) set `userData.vizSelectable = false` to opt out of
      selection. (Objects that carry userData.vizId but were never registered are
      still auto-discovered from the scene — but registering is preferred.)
   3. Include this file + edit-mode.css, then `EditMode.init()`. Toggle with the
      floating ✎ button or the `e` key. For publish builds either don't call
      init() or call `EditMode.setPublishMode(true)`.

   OPTIONAL: if a build-time `viz-manifest.json` is loaded as
   `window.__VIZ_MANIFEST` (see scripts/gen-viz-manifest.mjs + window.__viz),
   every exported comment also carries `source: {file,line,builderFn,cssRule}`
   so the AI jumps straight to code. Degrades gracefully if absent.

   DEPENDENCIES: none for DOM/snip/brush. 3D features need three.js, passed in
   via attachScene/registerVizObject. Screenshots use html-to-image if present,
   else read the 3D canvas directly, else fall back to rect+ids (never blocks).

   IMPLEMENTATION NOTES (traps baked into this file — see references/gotchas-and-lessons.md):
   - SVG has no `.hidden` property → the overlay uses toggleAttribute('hidden').
   - `.em-*[hidden]{display:none!important}` in the CSS beats the display-class cascade.
   - Node-safe `inRoot()` guards every contains() check (event targets can be window).
   - Hover/click prioritise a concrete 3D hit over a large background section, but a
     leaf DOM element on top still wins (isLeafComponent).
   - Thin geometry (tubes/lines) uses a screen-space proximity fallback to be pickable.
   ============================================================================ */

(function (global) {
  'use strict';

  const state = {
    on: false,
    publish: false,
    view: 'normal',             // 'normal' | 'expert'
    tool: 'select',             // 'select' | 'snip' | 'brush'
    comments: [],               // [{ id, kind, targetIds[], relatedIds[], comment, screenshot?, rect? }]
    selection: [],              // in-progress multi-select: [{ id, kind }] held with ctrl/⌘+click
    scene: null,                // { THREE, renderer, camera, scene }
    vizObjects: new Map(),      // vizId -> Object3D
    nextId: 1,
    imageDir: '/tmp/viz-edit',  // where downloaded snips are expected on disk (AI-readable path)
  };

  /* ----------------------------------------------------------------- helpers */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cssEsc = (s) => (global.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  // Node-safe: event targets can be `window`/`document` (not Nodes), which makes
  // root.contains() throw. Guard every "is this our own UI?" check through here.
  const inRoot = (n) => !!(root && n && n.nodeType === 1 && root.contains(n));
  // When a drill/ERD modal is open, scope selection to it: only elements inside the
  // open modal (and the modal itself) are selectable — the main page + 3D scene are
  // behind the backdrop. NOTE: do NOT name this `openPopup` — that already exists for
  // the inline comment-entry popup; a duplicate declaration breaks the whole module.
  // Adjust the `.drill-modal.open` selector to match your modal markup.
  const openModal = () => document.querySelector('.drill-modal.open') || null;
  const inScope = (n) => { const m = openModal(); return !m || (n && m.contains(n)); };
  const vizIdOf = (node) => {
    const t = node && node.closest && node.closest('[data-viz-id]');
    return t ? t.getAttribute('data-viz-id') : null;
  };
  // Resolve a vizId to its source location via an optional build-time manifest.
  const sourceOf = (id) => {
    const m = global.__VIZ_MANIFEST;
    return (m && m[id]) ? m[id] : null;
  };
  // Normalise a snip/brush rect (stored as {left,top,width,height}) into explicit,
  // rounded viewport coordinates so feedback carries unambiguous geometry.
  const normRect = (r) => r ? {
    x: Math.round(r.left), y: Math.round(r.top),
    width: Math.round(r.width), height: Math.round(r.height),
    right: Math.round(r.left + r.width), bottom: Math.round(r.top + r.height),
  } : null;

  /* ----------------------------------------------------------------- UI shell */
  let root, toolbar, panel, list, hint, toggleBtn, overlay, popup;

  function buildUI() {
    root = el('div', 'em-root');
    root.innerHTML = `
      <button class="em-fab" title="Toggle edit mode (e)">✎ Edit</button>

      <div class="em-toolbar" hidden>
        <div class="em-toolbar-row">
          <span class="em-brand">✎ Edit</span>
          <div class="em-group em-views" role="group" aria-label="View">
            <button data-v="normal" class="em-seg is-on" aria-pressed="true" title="Normal: reveal on hover">Normal</button>
            <button data-v="expert" class="em-seg" aria-pressed="false" title="Expert: show all ids">Expert</button>
          </div>
          <div class="em-group em-tools" role="group" aria-label="Tools">
            <button data-t="pointer" class="em-tool" aria-pressed="false" title="Pointer — interact with the page normally (no highlights)">↖ Pointer</button>
            <button data-t="select" class="em-tool is-on" aria-pressed="true" title="Select (hover to reveal · ctrl/⌘+click to comment)">⬚ Select</button>
            <button data-t="snip" class="em-tool" aria-pressed="false" title="Snip a rectangular area">▭ Snip</button>
            <button data-t="brush" class="em-tool" aria-pressed="false" title="Free brush a region">✎ Brush</button>
          </div>
          <button class="em-panel-toggle" title="Show/hide comments">☰ <span class="em-count-mini">0</span></button>
          <button class="em-close" title="Close edit mode (e)">✕</button>
        </div>
        <span class="em-hint"></span>
      </div>

      <div class="em-panel" hidden>
        <div class="em-panel-head">
          <span class="em-title">Comments</span>
          <span class="em-count">0</span>
        </div>
        <div class="em-list"></div>
        <div class="em-foot">
          <button class="em-clear">Clear</button>
          <button class="em-copy">Copy for AI</button>
          <button class="em-dl">Download</button>
        </div>
      </div>

      <svg class="em-overlay" hidden xmlns="http://www.w3.org/2000/svg"></svg>

      <div class="em-popup" hidden>
        <div class="em-popup-tgt"></div>
        <textarea class="em-popup-text" placeholder="What should change here?"></textarea>
        <div class="em-popup-actions">
          <button class="em-popup-cancel">Cancel</button>
          <button class="em-popup-add">Add comment</button>
        </div>
      </div>`;
    document.body.appendChild(root);

    toggleBtn = root.querySelector('.em-fab');
    toolbar   = root.querySelector('.em-toolbar');
    panel     = root.querySelector('.em-panel');
    list      = root.querySelector('.em-list');
    hint      = root.querySelector('.em-hint');
    overlay   = root.querySelector('.em-overlay');
    popup     = root.querySelector('.em-popup');

    toggleBtn.addEventListener('click', () => setOn(!state.on));
    toolbar.querySelector('.em-close').addEventListener('click', () => setOn(false));
    toolbar.querySelector('.em-panel-toggle').addEventListener('click', () => { panel.hidden = !panel.hidden; });
    toolbar.querySelectorAll('.em-seg').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
    toolbar.querySelectorAll('.em-tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.t)));

    panel.querySelector('.em-clear').addEventListener('click', () => { state.comments = []; renderList(); });
    panel.querySelector('.em-copy').addEventListener('click', copyBatch);
    panel.querySelector('.em-dl').addEventListener('click', downloadBatch);

    popup.querySelector('.em-popup-cancel').addEventListener('click', closePopup);
    popup.querySelector('.em-popup-add').addEventListener('click', commitPopup);

    // Make the toolbar and comment panel draggable so they never block content.
    // The toolbar drags by its empty chrome (brand + bar background); the panel
    // drags by its header. Buttons/inputs still work — a drag won't start on them.
    makeDraggable(toolbar, toolbar.querySelector('.em-toolbar-row'));
    makeDraggable(panel, panel.querySelector('.em-panel-head'));

    renderHint();
    renderList();
  }

  /* ----------------------------------------------------------------- drag */
  // Drag `elToMove` by pressing anywhere on `handle` that isn't an interactive
  // control. On first drag we switch the element to absolute left/top positioning
  // (clearing any centering transform / right anchor) so it follows the cursor,
  // and clamp it to stay on-screen.
  function makeDraggable(elToMove, handle) {
    if (!elToMove || !handle) return;
    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', (e) => {
      // ignore drags that start on a real control (button/input/textarea/link/select)
      if (e.target.closest('button, input, textarea, a, select, .em-seg, .em-tool')) return;
      e.preventDefault();
      const start = elToMove.getBoundingClientRect();
      const offX = e.clientX - start.left, offY = e.clientY - start.top;
      // pin to pixel left/top, drop any centering transform / right anchor
      elToMove.style.left = start.left + 'px';
      elToMove.style.top = start.top + 'px';
      elToMove.style.right = 'auto';
      elToMove.style.bottom = 'auto';
      elToMove.style.transform = 'none';
      handle.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const w = elToMove.offsetWidth, h = elToMove.offsetHeight;
        let x = ev.clientX - offX, y = ev.clientY - offY;
        x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
        y = Math.max(4, Math.min(y, window.innerHeight - h - 4));
        elToMove.style.left = x + 'px';
        elToMove.style.top = y + 'px';
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        handle.style.cursor = 'grab';
        document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    });
  }

  /* ----------------------------------------------------------------- on/off */
  // The ✎ button is a hard toggle: opens the full edit UI, or closes it and
  // tears down every transient (overlay, popup, in-progress snip/brush).
  function setOn(on) {
    if (state.publish) return;
    state.on = on;
    document.body.classList.toggle('em-active', on);
    toolbar.hidden = !on;
    panel.hidden = !on;
    // NOTE: SVGElement has no `.hidden` IDL property, so `overlay.hidden = …` is a
    // silent no-op (it sets an expando, not the attribute) — the overlay would
    // stay shown. Toggle the attribute explicitly so it actually hides.
    overlay.toggleAttribute('hidden', !on);
    toggleBtn.classList.toggle('is-on', on);
    if (on) {
      startOverlayLoop();
    } else {
      stopOverlayLoop();
      cancelSnip(); cancelBrush(); closePopup(); clearHover(); clearSelection();
    }
  }
  function setView(v) {
    state.view = v;
    toolbar.querySelectorAll('.em-seg').forEach((b) => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    renderHint();
    drawOverlay();
  }
  function setTool(t) {
    if (t !== 'select') clearSelection();   // leaving Select abandons a pending multi-select
    state.tool = t;
    toolbar.querySelectorAll('.em-tool').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    cancelSnip(); cancelBrush(); closePopup(); clearHover();
    document.body.classList.toggle('em-tool-snip', t === 'snip');
    document.body.classList.toggle('em-tool-brush', t === 'brush');
    document.body.classList.toggle('em-tool-pointer', t === 'pointer');
    if (t === 'pointer' && overlay) overlay.innerHTML = '';   // wipe any lingering rects
    renderHint();
    drawOverlay();
  }
  function renderHint() {
    const byTool = {
      pointer: 'Pointer — interact with the page normally; no highlights. Switch tool to resume editing.',
      select: 'Click to select one · ctrl/⌘+click to add several (one comment) · Enter to finish',
      snip: 'Drag a rectangle to snip an area',
      brush: 'Press and drag to paint a region',
    }[state.tool];
    hint.textContent = byTool + (state.tool !== 'pointer' && state.view === 'expert' ? ' · all ids shown' : '');
  }

  /* ============================================================ OVERLAY LAYER
     One SVG layer over the page draws: hovered rects (normal view), all tagged
     rects (expert view), and projected 3D object boxes. It re-draws on a rAF
     loop while active so it tracks scroll/resize and GSAP-animated layout. */
  let overlayRAF = 0;
  function startOverlayLoop() {
    const tick = () => { if (!state.on) return; drawOverlay(); overlayRAF = requestAnimationFrame(tick); };
    cancelAnimationFrame(overlayRAF);
    overlayRAF = requestAnimationFrame(tick);
  }
  function stopOverlayLoop() { cancelAnimationFrame(overlayRAF); overlayRAF = 0; overlay.innerHTML = ''; }

  function sizeOverlay() {
    overlay.setAttribute('width', window.innerWidth);
    overlay.setAttribute('height', window.innerHeight);
    overlay.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  }

  // Collect the rects we should draw this frame, as {id, rect, kind}.
  function collectRects() {
    const out = [];
    const wantAll = state.view === 'expert';
    const selIds = new Set(state.selection.map((s) => s.id));
    // DOM / SVG components
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (inRoot(n) || !inScope(n)) return;   // a modal is open → only its own elements
      const id = n.getAttribute('data-viz-id');
      const isHover = (n === hoverEl);
      const isSel = selIds.has(id);
      if (!wantAll && !isHover && !isSel) return;   // selected rects always draw
      const b = n.getBoundingClientRect();
      // A perfectly straight edge (vertical or horizontal connector) has 0 width or
      // 0 height — don't drop it; pad the thin axis to a minimum so its highlight is
      // visible and the user can tell it IS selectable.
      const MINW = 10;
      let x = b.left, y = b.top, w = b.width, h = b.height;
      if (w < MINW) { x -= (MINW - w) / 2; w = MINW; }
      if (h < MINW) { y -= (MINW - h) / 2; h = MINW; }
      if (w < 1 || h < 1) return;
      if (y + h < 0 || y > window.innerHeight || x + w < 0 || x > window.innerWidth) return;
      out.push({ id, kind: 'dom', hover: isHover, selected: isSel, rect: { x, y, w, h } });
    });
    // 3D objects: project each viz-tagged object's bounding box to screen.
    // Suppressed while a modal is open — the scene is behind the backdrop.
    if (state.scene && state.scene.THREE && !openModal()) {
      each3dViz((obj, id) => {
        const isHover = (id === hover3dId);
        const isSel = selIds.has(id);
        if (!wantAll && !isHover && !isSel) return;
        const r = projectObject(obj);
        if (r) out.push({ id, kind: 'three', hover: isHover, selected: isSel, rect: r });
      });
    }
    return out;
  }

  // Project an Object3D's world-space bounding box to a screen-space AABB.
  function projectObject(obj) {
    const { THREE, renderer, camera } = state.scene;
    if (!obj || !obj.visible) return null;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;
    const cv = renderer.domElement;
    const cb = cv.getBoundingClientRect();
    const min = box.min, max = box.max;
    const corners = [
      [min.x, min.y, min.z], [min.x, min.y, max.z], [min.x, max.y, min.z], [min.x, max.y, max.z],
      [max.x, min.y, min.z], [max.x, min.y, max.z], [max.x, max.y, min.z], [max.x, max.y, max.z],
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, anyFront = false;
    const v = new THREE.Vector3();
    for (const c of corners) {
      v.set(c[0], c[1], c[2]).project(camera);
      if (v.z < 1) anyFront = true;            // in front of the camera
      const sx = cb.left + (v.x * 0.5 + 0.5) * cb.width;
      const sy = cb.top + (-v.y * 0.5 + 0.5) * cb.height;
      minX = Math.min(minX, sx); minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
    }
    if (!anyFront) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function drawOverlay() {
    if (!state.on) return;
    // Pointer tool: interact with the page normally — no highlights/rects at all.
    if (state.tool === 'pointer') { overlay.innerHTML = ''; renderSelChip(); return; }
    sizeOverlay();
    const rects = collectRects();
    // Build SVG once per frame (cheap for the element counts these pages have).
    let svg = '';
    for (const r of rects) {
      const cls = 'em-rect' + (r.hover ? ' is-hover' : '') + (r.selected ? ' is-selected' : '') + (r.kind === 'three' ? ' is-three' : '');
      svg += `<rect class="${cls}" x="${r.rect.x.toFixed(1)}" y="${r.rect.y.toFixed(1)}" width="${Math.max(0, r.rect.w).toFixed(1)}" height="${Math.max(0, r.rect.h).toFixed(1)}" rx="3"/>`;
      // label badge: always for hover and for selected; in expert view for everything
      const showLabel = r.hover || r.selected || state.view === 'expert';
      if (showLabel) {
        const lx = Math.max(2, r.rect.x);
        const ly = Math.max(11, r.rect.y);
        const w = Math.min(220, 7 * r.id.length + 14);
        const bcls = 'em-badge' + (r.selected ? ' is-selected' : '') + (r.kind === 'three' ? ' is-three' : '');
        svg += `<g class="${bcls}" transform="translate(${lx.toFixed(1)}, ${(ly - 9).toFixed(1)})">`
             + `<rect class="em-badge-bg" width="${w}" height="15" rx="3"/>`
             + `<text class="em-badge-tx" x="6" y="11">${esc(r.id)}</text></g>`;
      }
    }
    overlay.innerHTML = svg;
    // floating count chip while a multi-select is in progress
    renderSelChip();
  }

  // A small follow-the-cursor-free chip near the toolbar telling the user how many
  // elements are in the pending multi-select and how to commit them.
  let selChip = null;
  function renderSelChip() {
    const n = state.selection.length;
    if (!n) { if (selChip) { selChip.remove(); selChip = null; } return; }
    if (!selChip) {
      selChip = el('div', 'em-sel-chip');
      root.appendChild(selChip);
    }
    selChip.innerHTML = `<b>${n}</b> selected `
      + `<button class="em-sel-commit">Comment ↵</button>`
      + `<button class="em-sel-clear">Clear ⎋</button>`;
    selChip.querySelector('.em-sel-commit').onclick = (e) => { e.stopPropagation(); commitSelection(); };
    selChip.querySelector('.em-sel-clear').onclick = (e) => { e.stopPropagation(); clearSelection(); };
  }

  /* ============================================================ HOVER (select)
     Hover is tracked for both DOM (closest data-viz-id) and 3D (raycast). */
  let hoverEl = null, hover3dId = null;

  function clearHover() { hoverEl = null; hover3dId = null; }

  function onMouseMove(e) {
    if (!state.on || state.tool !== 'select') return;
    if (inRoot(e.target)) { clearHover(); return; }
    const t = e.target.closest && e.target.closest('[data-viz-id]');
    const domEl = (t && !inRoot(t)) ? t : null;
    // 3D: raycast whenever the pointer is over the canvas.
    const threeId = isOverCanvas(e) ? pick3dId(e) : null;

    // Priority: a concrete 3D hit beats a DOM element that's merely a large
    // background SECTION overlapping the canvas (e.g. the fixed hero/scene layer
    // the page renders on top of the 3D world). But a real LEAF component the
    // user is pointing at (a card, heading, button — small, actual content) on
    // top of the canvas still wins. So: 3D wins unless the DOM hit is a leaf.
    if (threeId && (!domEl || !isLeafComponent(domEl))) {
      hover3dId = threeId; hoverEl = null;
    } else {
      hoverEl = domEl; hover3dId = null;
    }
  }

  // The 3D scene is selectable only where the canvas is actually VISIBLE — the fixed
  // full-viewport canvas sits behind every scroll section, so a rect-only test would
  // (wrongly) report "over canvas" even when an OPAQUE content section covers it,
  // letting 3D objects be picked through unrelated content. Walk the hit-test stack:
  // 3D is pickable only if the canvas is reached before any opaque layer.
  function isOverCanvas(e) {
    if (!state.scene) return false;
    const cv = state.scene.renderer.domElement;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (el === cv) return true;       // canvas is the topmost paint here → scene shows through
      if (inRoot(el)) continue;         // our own edit-mode UI doesn't occlude the scene
      if (isOpaque(el)) return false;   // an opaque content layer hides the scene at this point
    }
    return false;
  }
  // Opaque enough to hide the canvas behind it: a non-transparent background, a
  // background image, or a backdrop-filter. Transparent wrapper bands (hero/people
  // sections that let the scene show through) return false → scene stays pickable.
  function isOpaque(el) {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
    const m = (cs.backgroundColor || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const p = m[1].split(',').map((s) => parseFloat(s));
    return (p.length >= 4 ? p[3] : 1) > 0.5;
  }

  // A "leaf" component is concrete content the user is genuinely pointing at,
  // not a big structural wrapper that just happens to overlap the 3D canvas.
  // Heuristic: small enough relative to the viewport (a section/hero is huge),
  // OR a clearly interactive/text tag.
  function isLeafComponent(el) {
    const b = el.getBoundingClientRect();
    const vp = window.innerWidth * window.innerHeight;
    const coversLots = (b.width * b.height) > 0.45 * vp;     // section-sized → not a leaf
    if (coversLots) return false;
    return true;
  }

  // Raycast the scene and walk parents to the nearest vizId. Returns the id or null.
  // Thin geometry (the route tube, lines, slender meshes) is almost impossible to
  // hit with a pixel-exact ray, so we do two things: (1) widen the raycaster's
  // Line/Points threshold, and (2) if the direct hit resolves to no vizId, fall
  // back to the registered object whose SCREEN-PROJECTED silhouette passes closest
  // to the cursor (within a tolerance) — so you can click *near* a thin object.
  function pick3dId(e) {
    const { THREE, renderer, camera, scene } = state.scene;
    if (!THREE) return null;
    const cv = renderer.domElement;
    const rect = cv.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    if (ray.params) {                       // make lines/points easier to hit
      if (ray.params.Line) ray.params.Line.threshold = 0.6;
      if (ray.params.Points) ray.params.Points.threshold = 0.6;
    }
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(scene.children, true);
    for (const h of hits) {
      let o = h.object;
      // Walk up to the nearest vizId. If it opted out (the ground plane / water
      // backdrop), break out of THIS hit's walk but let the for-loop CONTINUE to the
      // next hit — otherwise the huge ground plane shadows every selectable object
      // under the cursor and the picker returns nothing (e.g. over open ground where
      // the scene shows through a transparent section).
      while (o) {
        if (o.userData && o.userData.vizId) { if (isSelectable(o)) return o.userData.vizId; break; }
        o = o.parent;
      }
    }
    // proximity fallback: nearest registered object near the cursor. ~28px (not 14)
    // so a large building is grabbable by aiming near it when the direct ray only
    // found the non-selectable ground.
    return nearestVizIdToScreenPoint(e.clientX, e.clientY, 28);
  }

  // For every registered viz object, project a handful of its world points to the
  // screen and measure the closest distance to (px,py). Return the id of the
  // closest one within `tolPx`, else null. Cheap and works for tubes/lines/meshes.
  function nearestVizIdToScreenPoint(px, py, tolPx) {
    const { THREE, renderer, camera } = state.scene;
    if (!THREE) return null;
    const cv = renderer.domElement, cb = cv.getBoundingClientRect();
    const v = new THREE.Vector3();
    const project = (p) => {
      v.copy(p).project(camera);
      if (v.z >= 1) return null;            // behind camera
      return [cb.left + (v.x * 0.5 + 0.5) * cb.width, cb.top + (-v.y * 0.5 + 0.5) * cb.height];
    };
    let best = null, bestD = tolPx;
    each3dViz((obj, id) => {
      if (!obj || !obj.visible) return;
      // sample geometry vertices (sparse) + object centre; covers thin tubes well
      const pts = sampleObjectPoints(obj, THREE);
      for (const wp of pts) {
        const sp = project(wp);
        if (!sp) continue;
        const d = Math.hypot(sp[0] - px, sp[1] - py);
        if (d < bestD) { bestD = d; best = id; }
      }
    });
    return best;
  }

  // An object opts OUT of selection with `userData.vizSelectable = false` (e.g. the
  // ground plane, sky, or other backdrop that carries an id for reference but should
  // never be a comment target). Honoured everywhere selection happens.
  const isSelectable = (obj) => !(obj && obj.userData && obj.userData.vizSelectable === false);

  // Iterate every SELECTABLE viz-tagged 3D object: those explicitly registered AND
  // any in the scene carrying userData.vizId (so an object that set its id but was
  // never passed to registerVizObject is still found — an easy-to-make omission).
  function each3dViz(fn) {
    const seen = new Set();
    state.vizObjects.forEach((obj, id) => { seen.add(id); if (isSelectable(obj)) fn(obj, id); });
    if (state.scene && state.scene.scene) {
      state.scene.scene.traverse((o) => {
        const id = o.userData && o.userData.vizId;
        if (id && !seen.has(id)) { seen.add(id); if (isSelectable(o)) fn(o, id); }
      });
    }
  }

  // Up to ~40 world-space sample points for an object (its meshes' vertices,
  // strided), so a thin tube contributes points all along its length.
  function sampleObjectPoints(obj, THREE) {
    const pts = [];
    obj.updateWorldMatrix(true, false);
    obj.traverse((m) => {
      const g = m.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      const pos = g.attributes.position;
      const stride = Math.max(1, Math.floor(pos.count / 24));
      m.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i += stride) {
        pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
        if (pts.length > 200) return;       // hard cap
      }
    });
    return pts;
  }

  /* ============================================================ CLICK (select)
     Plain click selects (adds a comment with empty text). ctrl/⌘+click opens
     the inline popup so the user can type before committing. */
  // Resolve what the pointer is really over, using the same DOM-vs-3D priority as
  // hover: a concrete 3D object beats a large background section that merely
  // overlaps the canvas. Returns { id, kind } or null.
  function resolveTarget(e) {
    const t = e.target.closest && e.target.closest('[data-viz-id]');
    const domEl = (t && !inRoot(t) && inScope(t)) ? t : null;   // scope to an open modal
    const threeId = (!openModal() && isOverCanvas(e)) ? pick3dId(e) : null;  // no 3D behind a modal
    if (threeId && (!domEl || !isLeafComponent(domEl))) return { id: threeId, kind: 'object' };
    if (domEl) return { id: domEl.getAttribute('data-viz-id'), kind: 'component' };
    return null;
  }

  function onClick(e) {
    if (!state.on || state.publish || state.tool !== 'select') return;
    if (inRoot(e.target)) {
      // a click inside our own UI shouldn't disturb a pending selection
      return;
    }

    const multi = e.ctrlKey || e.metaKey;
    const hit = resolveTarget(e);

    // ctrl/⌘+click → toggle this element in the multi-select set (one comment, many targets)
    if (multi) {
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      toggleSelection(hit);
      return;
    }

    // plain click with a pending multi-select → commit it as ONE comment.
    // (clicking empty space, or any element, ends the multi-select.)
    if (state.selection.length) {
      e.preventDefault(); e.stopPropagation();
      // if they plain-clicked a NEW element, include it before committing
      if (hit && !state.selection.some((s) => s.id === hit.id)) state.selection.push(hit);
      commitSelection();
      return;
    }

    // plain click, no pending selection → single-target comment (original behaviour)
    if (!hit) return;
    e.preventDefault(); e.stopPropagation();
    addComment({ kind: hit.kind, targetIds: [hit.id] });
    toast(`Added ${hit.id} — type your note in the panel`);
  }

  /* -------------------------------------------------- multi-select helpers */
  function toggleSelection(hit) {
    const i = state.selection.findIndex((s) => s.id === hit.id);
    if (i >= 0) {
      state.selection.splice(i, 1);                 // ctrl+click an already-selected id → deselect
      toast(`Removed ${hit.id} (${state.selection.length} selected)`);
    } else {
      state.selection.push({ id: hit.id, kind: hit.kind });
      toast(`Selected ${hit.id} (${state.selection.length}) — ctrl/⌘+click more, then Enter`);
    }
    drawOverlay();
  }
  function clearSelection() {
    if (!state.selection.length) return;
    state.selection = [];
    drawOverlay();
  }
  function commitSelection() {
    const sel = state.selection;
    if (!sel.length) return;
    const ids = sel.map((s) => s.id);
    // kind: 'component'/'object' if homogeneous, else 'multi' (mixed DOM + 3D)
    const kinds = new Set(sel.map((s) => s.kind));
    const kind = kinds.size === 1 ? [...kinds][0] : 'multi';
    state.selection = [];
    addComment({ kind, targetIds: ids });
    drawOverlay();
    toast(`Added ${ids.length} targets — type one note in the panel`);
  }

  /* ----------------------------------------------------------------- popup */
  let popupCtx = null;
  function openPopup(id, kind, x, y) {
    popupCtx = { id, kind };
    popup.querySelector('.em-popup-tgt').textContent = id;
    const ta = popup.querySelector('.em-popup-text');
    ta.value = '';
    popup.hidden = false;
    // clamp into viewport
    const pw = 260, ph = 150;
    popup.style.left = Math.min(x, window.innerWidth - pw - 10) + 'px';
    popup.style.top = Math.min(y, window.innerHeight - ph - 10) + 'px';
    requestAnimationFrame(() => ta.focus());
  }
  function commitPopup() {
    if (!popupCtx) return;
    const text = popup.querySelector('.em-popup-text').value;
    addComment({ kind: popupCtx.kind, targetIds: [popupCtx.id], comment: text });
    closePopup();
  }
  function closePopup() { popup.hidden = true; popupCtx = null; }

  /* ============================================================ SNIP (area) */
  let snip = null, snipBox = null;
  function onDown(e) {
    if (!state.on || inRoot(e.target)) return;
    if (state.tool === 'snip') return startSnip(e);
    if (state.tool === 'brush') return startBrush(e);
  }
  function startSnip(e) {
    e.preventDefault();
    snip = { x: e.clientX, y: e.clientY };
    snipBox = el('div', 'em-snip');
    document.body.appendChild(snipBox);
    positionSnip(e.clientX, e.clientY);
    window.addEventListener('mousemove', onSnipMove, true);
    window.addEventListener('mouseup', onSnipUp, true);
  }
  function positionSnip(x, y) {
    const l = Math.min(snip.x, x), t = Math.min(snip.y, y);
    const w = Math.abs(x - snip.x), h = Math.abs(y - snip.y);
    Object.assign(snipBox.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    snipBox._rect = { left: l, top: t, width: w, height: h };
  }
  function onSnipMove(e) { positionSnip(e.clientX, e.clientY); }
  async function onSnipUp() {
    window.removeEventListener('mousemove', onSnipMove, true);
    window.removeEventListener('mouseup', onSnipUp, true);
    const r = snipBox && snipBox._rect;
    cancelSnip();
    if (!r || r.width < 8 || r.height < 8) return;
    const related = componentsInRect(r);
    const screenshot = await captureRegion(r);
    addComment({ kind: 'area', targetIds: [], relatedIds: related, rect: r, screenshot });
  }
  function cancelSnip() {
    if (snipBox) { snipBox.remove(); snipBox = null; }
    snip = null;
  }

  /* ============================================================ BRUSH (free)
     A freehand path. We collect points, draw them on a transient canvas, then
     resolve the path's bounding box to the same component/screenshot capture as
     snip — but the captured rect is the path's AABB, and components are matched
     by point-in-path against the strokes (more precise than a big rectangle). */
  let brush = null, brushCv = null, brushCtx = null;
  function startBrush(e) {
    e.preventDefault();
    brush = { pts: [[e.clientX, e.clientY]] };
    brushCv = el('canvas', 'em-brush');
    brushCv.width = window.innerWidth; brushCv.height = window.innerHeight;
    document.body.appendChild(brushCv);
    brushCtx = brushCv.getContext('2d');
    window.addEventListener('mousemove', onBrushMove, true);
    window.addEventListener('mouseup', onBrushUp, true);
  }
  function onBrushMove(e) {
    brush.pts.push([e.clientX, e.clientY]);
    drawBrush();
  }
  function drawBrush() {
    brushCtx.clearRect(0, 0, brushCv.width, brushCv.height);
    brushCtx.lineWidth = 22; brushCtx.lineJoin = brushCtx.lineCap = 'round';
    brushCtx.strokeStyle = 'rgba(111,199,207,.35)';
    brushCtx.beginPath();
    brush.pts.forEach((p, i) => i ? brushCtx.lineTo(p[0], p[1]) : brushCtx.moveTo(p[0], p[1]));
    brushCtx.stroke();
  }
  async function onBrushUp() {
    window.removeEventListener('mousemove', onBrushMove, true);
    window.removeEventListener('mouseup', onBrushUp, true);
    const pts = brush ? brush.pts : [];
    cancelBrush();
    if (pts.length < 3) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const r = { left: Math.min(...xs), top: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    if (r.width < 8 && r.height < 8) return;
    const related = componentsNearPath(pts);
    const screenshot = await captureRegion(r);
    addComment({ kind: 'brush', targetIds: [], relatedIds: related, rect: r, screenshot });
  }
  function cancelBrush() {
    if (brushCv) { brushCv.remove(); brushCv = null; brushCtx = null; }
    brush = null;
  }

  /* ------------------------------------------------- component matching */
  function componentsInRect(r) {
    const out = [];
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (inRoot(n) || !inScope(n)) return;   // scope to an open modal
      const b = n.getBoundingClientRect();
      const overlap = !(b.right < r.left || b.left > r.left + r.width ||
                        b.bottom < r.top || b.top > r.top + r.height);
      if (overlap) out.push(n.getAttribute('data-viz-id'));
    });
    // also any 3D objects whose projected box overlaps
    addProjected3dInRect(r, out);
    return [...new Set(out)];
  }
  // Match components whose rect contains any brush point (tighter than AABB).
  function componentsNearPath(pts) {
    const out = [];
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (inRoot(n) || !inScope(n)) return;   // scope to an open modal
      const b = n.getBoundingClientRect();
      if (pts.some((p) => p[0] >= b.left && p[0] <= b.right && p[1] >= b.top && p[1] <= b.bottom)) {
        out.push(n.getAttribute('data-viz-id'));
      }
    });
    // brush AABB for 3D matching
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    addProjected3dInRect({ left: Math.min(...xs), top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }, out);
    return [...new Set(out)];
  }
  function addProjected3dInRect(r, out) {
    if (!(state.scene && state.scene.THREE) || openModal()) return;   // no 3D behind a modal
    each3dViz((obj, id) => {
      const p = projectObject(obj);
      if (!p) return;
      const overlap = !(p.x + p.w < r.left || p.x > r.left + r.width ||
                        p.y + p.h < r.top || p.y > r.top + r.height);
      if (overlap) out.push(id);
    });
  }

  /* ------------------------------------------------- screenshot capture */
  async function captureRegion(r) {
    try {
      if (global.htmlToImage && global.htmlToImage.toCanvas) {
        const full = await global.htmlToImage.toCanvas(document.body, { pixelRatio: 1 });
        return cropCanvas(full, r);
      }
    } catch (_) { /* fall through */ }
    const cv = document.querySelector('canvas:not(.em-brush)');
    if (cv && state.scene) {
      try {
        state.scene.renderer.render(state.scene.scene, state.scene.camera);
        const cb = cv.getBoundingClientRect();
        const sx = (r.left - cb.left) * (cv.width / cb.width);
        const sy = (r.top - cb.top) * (cv.height / cb.height);
        const sw = r.width * (cv.width / cb.width), sh = r.height * (cv.height / cb.height);
        const out = el('canvas'); out.width = Math.max(1, sw | 0); out.height = Math.max(1, sh | 0);
        out.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
      } catch (_) { /* tainted/blank — fall through */ }
    }
    return null;
  }
  function cropCanvas(full, r) {
    const out = el('canvas'); out.width = r.width | 0; out.height = r.height | 0;
    out.getContext('2d').drawImage(full, r.left, r.top, r.width, r.height, 0, 0, r.width, r.height);
    return out.toDataURL('image/png');
  }

  /* ------------------------------------------------- 3D registration */
  function attachScene(ctx) { state.scene = ctx; }
  function registerVizObject(obj, id) {
    if (!obj) return obj;
    obj.userData = obj.userData || {};
    obj.userData.vizId = id;
    state.vizObjects.set(id, obj);
    return obj;
  }

  /* ============================================================ COMMENT LIST */
  function addComment(c) {
    c.id = state.nextId++;
    c.comment = c.comment || '';
    c.sceneContext = captureSceneContext();   // scroll offset + timeline progress + camera
    state.comments.push(c);
    panel.hidden = false;       // surface the panel when something is added
    renderList();
    requestAnimationFrame(() => {
      const ta = list.querySelector(`[data-cid="${c.id}"] textarea`);
      if (ta) ta.focus();
    });
  }

  // Snapshot the exact scene moment a comment was made, so the AI can reproduce it
  // to debug/fix. The load-bearing fields for a scroll-story:
  //   - scrollY / scrollProgress: where on the page the user was (0..1 of the page)
  //   - timelineProgress: the GSAP master timeline's progress 0..1 IF the page
  //     exposed it as `window.__tl` (the convention) — this is the "scene position
  //     in the timeline" that maps a 3D-object comment to a precise camera beat.
  //   - camera: serialized position + lookAt target so the view is replayable.
  // All fields are optional — absent ones are simply omitted (degrades gracefully).
  function captureSceneContext() {
    const ctx = {
      scrollY: Math.round(window.scrollY),
      scrollMax: Math.round(Math.max(0, (document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight)),
      viewport: [window.innerWidth, window.innerHeight],
    };
    ctx.scrollProgress = ctx.scrollMax ? +(ctx.scrollY / ctx.scrollMax).toFixed(4) : 0;
    // GSAP master timeline progress, if the page exposed it (window.__tl)
    const tl = global.__tl;
    if (tl && typeof tl.progress === 'function') {
      try { ctx.timelineProgress = +(+tl.progress()).toFixed(4); } catch (_) {}
      if (tl.totalDuration) { try { ctx.timelineTime = +(tl.time()).toFixed(3); } catch (_) {} }
    }
    // camera pose, if a 3D scene is attached
    if (state.scene && state.scene.camera) {
      const cam = state.scene.camera;
      const r = (n) => +n.toFixed(2);
      ctx.camera = { position: [r(cam.position.x), r(cam.position.y), r(cam.position.z)] };
      if (cam.rotation) ctx.camera.rotation = [r(cam.rotation.x), r(cam.rotation.y), r(cam.rotation.z)];
    }
    return ctx;
  }
  function renderList() {
    const n = state.comments.length;
    panel.querySelector('.em-count').textContent = String(n);
    const mini = toolbar && toolbar.querySelector('.em-count-mini');
    if (mini) mini.textContent = String(n);
    list.innerHTML = state.comments.map((c) => {
      const tgts = (c.kind === 'area' || c.kind === 'brush')
        ? `${c.kind} · ${c.relatedIds.length} inside`
        : (c.targetIds.length > 1
            ? `${c.targetIds.length} elements · ${c.targetIds.join(', ')}`
            : c.targetIds.join(', '));
      const thumb = c.screenshot ? `<img class="em-thumb" src="${c.screenshot}">` : '';
      const kindIcon = { component: '⬚', area: '▭', brush: '✎', object: '◈', multi: '⧉' }[c.kind] || '•';
      return `<div class="em-item" data-cid="${c.id}">
        <div class="em-item-top"><span class="em-kind">${kindIcon}</span>
          <span class="em-tgt" title="${esc(tgts)}">${esc(tgts)}</span>
          <button class="em-del" data-cid="${c.id}" title="Delete">✕</button></div>
        ${thumb}
        <textarea placeholder="What should change here?">${esc(c.comment)}</textarea>
      </div>`;
    }).join('') || `<div class="em-empty">No comments yet. Click to select one element, ctrl/⌘+click to select several into one comment (then Enter), or snip/brush a region.</div>`;
    list.querySelectorAll('.em-item').forEach((item) => {
      const cid = +item.dataset.cid;
      item.querySelector('textarea').addEventListener('input', (e) => {
        const c = state.comments.find((x) => x.id === cid); if (c) c.comment = e.target.value;
      });
      item.querySelector('.em-del').addEventListener('click', () => {
        state.comments = state.comments.filter((x) => x.id !== cid); renderList();
      });
    });
  }

  /* ============================================================ EXPORT */
  function buildBatch() {
    return {
      schema: 'architecture-viz/edit-feedback@2',
      page: location.pathname,
      capturedAt: new Date().toISOString(),
      imageDir: state.imageDir,                   // where the snip PNGs are expected on disk
      comments: state.comments.map((c, i) => {
        const ids = (c.kind === 'area' || c.kind === 'brush') ? c.relatedIds : c.targetIds;
        const sources = {};
        (ids || []).forEach((id) => { const s = sourceOf(id); if (s) sources[id] = s; });
        const file = c.screenshot ? `snip-${i + 1}.png` : undefined;
        return {
          kind: c.kind,
          targetIds: c.targetIds,
          relatedIds: c.relatedIds || [],
          rect: normRect(c.rect),                 // viewport coords of the snip/brush region
          comment: c.comment,
          hasScreenshot: !!c.screenshot,
          screenshotFile: file,                   // the downloaded filename
          imagePath: file ? `${state.imageDir}/${file}` : undefined,  // AI-readable absolute path
          source: Object.keys(sources).length ? sources : undefined,
          sceneContext: c.sceneContext,           // scroll offset + timeline progress + camera pose
        };
      }),
    };
  }
  // "Copy for AI" — copies the markdown to the clipboard AND, when a feedback-bridge
  // is configured, POSTs the batch (+ snip PNGs) to it so the files are written to
  // disk for the AI to read by absolute path. One button, both effects: paste the
  // text into chat, or just tell the assistant to read /tmp/viz-edit. No separate
  // "Send to AI" button.
  function copyBatch() {
    const batch = buildBatch();
    const md = batchToMarkdown(batch);
    // Always copy the markdown to the clipboard first — this is the baseline that
    // works with or without a bridge.
    navigator.clipboard.writeText(md).catch(() => {});
    if (!state.bridge) {
      toast('Copied feedback for AI — paste it into the chat.');
      return;
    }
    // Bridge configured → ALSO write files to disk (with the snip images) so the AI
    // can read them by path. If the bridge is unreachable, fall back to the normal
    // clipboard copy (already done above) and say so.
    batch.markdown = md;
    batch.comments.forEach((c, i) => {
      const live = state.comments[i];
      if (live && live.screenshot) c.screenshotDataUrl = live.screenshot;
    });
    fetch(state.bridge + '/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch),
    }).then((r) => r.json()).then((res) => {
      toast(`Copied + saved ${res.written ? res.written.length : 0} file(s) to ${res.dir} — tell the assistant to read it.`);
    }).catch(() => toast('Bridge offline — copied to clipboard instead. Paste it into the chat.'));
  }
  function downloadBatch() {
    const batch = buildBatch();
    download('edit-feedback.json', JSON.stringify(batch, null, 2), 'application/json');
    state.comments.forEach((c, i) => { if (c.screenshot) downloadDataUrl(`snip-${i + 1}.png`, c.screenshot); });
    toast('Downloaded edit-feedback.json (+ any snips). Attach them in chat.');
  }
  function batchToMarkdown(b) {
    let s = `# Edit feedback (${b.comments.length})\nPage: ${b.page}\n\n`;
    b.comments.forEach((c, i) => {
      const t = (c.kind === 'area' || c.kind === 'brush')
        ? `${c.kind} — components inside: ${c.relatedIds.join(', ') || '(none tagged)'}`
        : (c.targetIds.length > 1
            ? `${c.kind} (${c.targetIds.length} elements — one comment applies to all): ${c.targetIds.join(', ')}`
            : `${c.kind}: ${c.targetIds.join(', ')}`);
      s += `## ${i + 1}. ${t}\n`;
      if (c.rect) s += `_region: ${c.rect.width}×${c.rect.height}px · x:${c.rect.x} y:${c.rect.y} → right:${c.rect.right} bottom:${c.rect.bottom} (viewport coords)_\n`;
      if (c.hasScreenshot) s += `_screenshot: ${c.imagePath || ('snip-' + (i + 1) + '.png')} (read this file for visual context)_\n`;
      if (c.source) {
        for (const [id, src] of Object.entries(c.source)) {
          s += `_${id} → ${src.file}${src.line ? ':' + src.line : ''}${src.builderFn ? ' (' + src.builderFn + ')' : ''}${src.cssRule ? ' · ' + src.cssRule : ''}_\n`;
        }
      }
      // scene moment — the load-bearing context for reproducing a 3D-object comment
      const sc = c.sceneContext;
      if (sc) {
        const bits = [];
        bits.push(`scroll ${sc.scrollY}px (${Math.round((sc.scrollProgress || 0) * 100)}% of page)`);
        if (sc.timelineProgress != null) bits.push(`timeline ${(sc.timelineProgress * 100).toFixed(1)}%`);
        if (sc.timelineTime != null) bits.push(`t=${sc.timelineTime}s`);
        if (sc.camera) bits.push(`camera [${sc.camera.position.join(', ')}]`);
        s += `_scene moment: ${bits.join(' · ')}_\n`;
      }
      s += `\n${c.comment || '_(no comment)_'}\n\n`;
    });
    s += `---\n_When applying: resolve each id to its builder via data-viz-id / userData.vizId`
       + ` (and the source hints above if present). For a 3D-object comment, reproduce the "scene moment"`
       + ` — scroll to that offset / set the timeline to that progress — to see exactly what the user saw.`
       + ` See ai-collaboration-protocol.md._\n`;
    return s;
  }
  function download(name, text, type) {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function downloadDataUrl(name, dataUrl) { const a = el('a'); a.href = dataUrl; a.download = name; a.click(); }
  function toast(msg) {
    const t = el('div', 'em-toast', msg); document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
  }

  /* ============================================================ INIT / API */
  function init(opts = {}) {
    if (state.publish) return;
    if (!root) buildUI();
    if (opts.scene) attachScene(opts.scene);
    if (opts.manifest) global.__VIZ_MANIFEST = opts.manifest;
    // Where downloaded snip PNGs are EXPECTED to live so the AI can read them by
    // absolute path. The browser can't write to disk itself — it downloads the
    // files; the bundled scripts/receive-feedback.mjs (or the user) drops them
    // here. Override per-project via init({ imageDir: '/abs/path' }).
    if (opts.imageDir) state.imageDir = String(opts.imageDir).replace(/\/$/, '');
    // If a feedback-bridge URL is given, "Copy for AI" ALSO POSTs the batch (+ snip
    // PNGs) to the bridge, which writes them to disk so the AI reads them by absolute
    // path. If the bridge is unreachable it silently falls back to a normal clipboard
    // copy. See scripts/feedback-bridge.mjs.
    if (opts.bridge) state.bridge = String(opts.bridge).replace(/\/$/, '');
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', (e) => {
      if (/input|textarea/i.test(e.target.tagName)) {
        if (e.key === 'Escape') { closePopup(); }
        return;
      }
      if (e.key === 'e') setOn(!state.on);
      if (e.key === 'Escape' && state.on) { cancelSnip(); cancelBrush(); closePopup(); clearSelection(); }
      // Enter commits a pending multi-select into one comment
      if ((e.key === 'Enter') && state.on && state.selection.length) {
        e.preventDefault(); commitSelection();
      }
      // quick tool/view hotkeys while active
      if (state.on) {
        if (e.key === '1') setTool('pointer');
        if (e.key === '2') setTool('select');
        if (e.key === '3') setTool('snip');
        if (e.key === '4') setTool('brush');
        if (e.key === 'x') setView(state.view === 'normal' ? 'expert' : 'normal');
      }
    });
    window.addEventListener('resize', () => { if (state.on) drawOverlay(); });
  }
  function setPublishMode(on) {
    state.publish = on;
    if (on && root) { setOn(false); root.style.display = 'none'; }
    else if (root) root.style.display = '';
  }

  global.EditMode = {
    init, attachScene, registerVizObject, setPublishMode,
    getBatch: buildBatch,
    get comments() { return state.comments; },
  };
})(window);
