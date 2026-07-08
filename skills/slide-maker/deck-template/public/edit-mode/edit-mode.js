/* ============================================================================
   edit-mode.js — drop-in visual feedback tool for slide decks.

   WHY
   The slowest part of iterating on a slide with an AI is *pointing*: "make THAT
   number bigger", "this card", "the eyebrow". This overlay lets a human SELECT the
   exact things they mean — a single element, several elements, a drag-marquee over
   a region, a snipped screenshot area, or a free-brush region — attach a comment to
   each, batch them, and hand the AI one payload naming every target by its stable
   `data-viz-id`. Claude reads that and edits in one hop.

   ANNOTATE EVERY ELEMENT
   Tag EVERY meaningful node with `data-viz-id` (headings, eyebrows, paragraphs,
   KPI numbers, cards, the rule, images) — not just containers. Edit mode can only
   select a node that has its OWN id; an untagged node falls through to its parent.
   Use dotted ids scoped to the slide: `s3.title`, `s3.kpi.1.value`, `s3.card.2`.

   THE TOOLS (toolbar)
   - Pointer: interact with the page normally — clicks pass through, no highlights.
   - Select: THREE gestures —
       • single   — click one element → one comment.
       • multiple — ctrl/⌘+click toggles elements into a buffer; Enter / plain-click
                    bundles them into ONE comment with many targetIds.
       • drag     — press-drag a box → SNIP the area: screenshots the tight box
                    around the tagged elements inside (or the raw drag box if it hit
                    empty space) and records those ids, then opens the comment popup.
                    Starting another drag discards an open, uncommitted popup.
   - Brush: paint a freehand region → its bounding box + the ids it covers.
   - Hold LEFT SHIFT: momentary Pointer (interact with the page); release → back to
     the tool you were using. Keys: V Pointer · S Select · B Brush · e toggle · x view.
     (Tools use LETTERS so they don't clash with the deck's 1-9 slide-jump keys.)

   WIRING (2 steps)
   1. Tag DOM elements with data-viz-id (see above).
   2. Include this file + edit-mode.css, then `EditMode.init({ bridge })`. Toggle
      with the ✎ button or `e`. For publish/export builds, don't call init() (or
      call `EditMode.setPublishMode(true)`).

   FEEDBACK BACK TO THE AI — "Copy for AI":
   - With a bridge (scripts/feedback-bridge.mjs on :8930): POSTs the batch + snip
     PNGs; the bridge writes /tmp/slide-maker-edit/edit-feedback.json + snip-N.png.
     Say "read the feedback" and the AI reads them by absolute path.
   - Without a bridge: copies human-readable markdown to the clipboard (snips not
     included). "Download" saves edit-feedback.json + snip-N.png to ~/Downloads.

   DEPENDENCIES: none. Screenshots use html-to-image if window.htmlToImage is
   present, else fall back to rect+ids (never blocks).
   ============================================================================ */

(function (global) {
  'use strict';

  // Idempotent: if this script runs twice (React Strict-Mode double-mount, a stray
  // second <script>, a hot reload), keep the FIRST instance. A second instance would
  // build a second .em-root + comment popup, and clicks/typing would land on the wrong
  // one. The App loader also guards, but this makes the module self-protecting.
  if (global.EditMode) return;

  const SCHEMA = 'slide-maker/edit-feedback@1';

  const state = {
    on: false,
    publish: false,
    view: 'normal',             // 'normal' | 'expert'
    tool: 'select',             // 'pointer' | 'select' | 'brush'
    comments: [],               // [{ id, kind, targetIds[], relatedIds[], comment, screenshot?, rect? }]
    selection: [],              // in-progress multi-select: [{ id }]
    bridge: null,               // e.g. 'http://localhost:8930'
    imageDir: '/tmp/slide-maker-edit',
    nextId: 1,
  };

  /* --------------------------------------------------------------- helpers */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag) => document.createElementNS(SVGNS, tag);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inRoot = (n) => !!(root && n && n.nodeType === 1 && root.contains(n));
  // Rail/grid thumbnails ([data-thumb]) render the real slide components, so they carry
  // DUPLICATE data-viz-id nodes. They must NEVER be selectable or highlighted — a
  // selection rect / id box appearing over the left slide list is the bug this guards.
  const inThumb = (n) => !!(n && n.nodeType === 1 && n.closest && n.closest('[data-thumb]'));
  // A node is a real edit target only if it's a tagged slide node that is NOT our own UI
  // and NOT inside a thumbnail. Use this everywhere we enumerate/hit-test [data-viz-id].
  const selectable = (n) => !!(n && n.nodeType === 1 && !inRoot(n) && !inThumb(n));
  const vizIdOf = (node) => {
    const t = node && node.closest && node.closest('[data-viz-id]');
    return (t && selectable(t)) ? t.getAttribute('data-viz-id') : null;
  };
  // The slide container (.slide-page) wraps everything, so a naive nearest-ancestor or
  // center-in-marquee test grabs it constantly when the user is really aiming at the
  // content inside it. Treat it as selectable ONLY when the cursor is near the slide
  // EDGE — a deliberate "I mean the whole slide" gesture, not interior hovering.
  const EDGE = 24;   // px band inside the slide border that counts as "the container"
  const isSlideContainer = (n) => !!(n && n.nodeType === 1 && n.classList && n.classList.contains('slide-page'));
  // is a screen point inside an element's box? (used to protect the floating popup from
  // mousedowns that hit-test to slide content behind it)
  const pointInEl = (n, x, y) => {
    if (!n || n.hidden) return false;
    const b = n.getBoundingClientRect();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  };
  const nearSlideEdge = (n, x, y) => {
    const b = n.getBoundingClientRect();
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false;
    return (x - b.left < EDGE) || (b.right - x < EDGE) || (y - b.top < EDGE) || (b.bottom - y < EDGE);
  };
  const normRect = (r) => r ? {
    x: Math.round(r.left), y: Math.round(r.top),
    width: Math.round(r.width), height: Math.round(r.height),
    right: Math.round(r.left + r.width), bottom: Math.round(r.top + r.height),
  } : null;
  // current slide context — looks for a tagged slide root or a data-slide-index
  function slideContext() {
    const active = document.querySelector('[data-slide-active]') ||
                   document.querySelector('.slide-page');
    const idx = active && active.getAttribute('data-slide-index');
    const label = active && (active.getAttribute('data-slide-label') ||
                  active.getAttribute('data-viz-id'));
    return {
      index: idx != null ? +idx : null,
      label: label || null,
      viewport: [window.innerWidth, window.innerHeight],
    };
  }

  /* --------------------------------------------------------------- UI shell */
  let root, toolbar, panel, list, hint, toggleBtn, overlay, popup;

  function buildUI() {
    root = el('div', 'em-root');
    root.innerHTML = `
      <button class="em-fab" title="Toggle edit mode (e)">✎ Edit</button>

      <div class="em-toolbar" hidden>
        <div class="em-toolbar-row">
          <span class="em-brand" title="Drag to move" aria-label="Drag to move"></span>
          <div class="em-group em-views" role="group" aria-label="View">
            <button data-v="normal" class="em-seg is-on" aria-pressed="true" title="Normal: reveal on hover">Normal</button>
            <button data-v="expert" class="em-seg" aria-pressed="false" title="Expert: show all ids">Expert</button>
          </div>
          <div class="em-group em-tools" role="group" aria-label="Tools">
            <button data-t="pointer" class="em-tool" aria-pressed="false" title="Pointer (V) — interact normally">↖ Pointer</button>
            <button data-t="select" class="em-tool is-on" aria-pressed="true" title="Select (S) — click an element, ctrl-click several, or drag a box to snip an area">⬚ Select</button>
            <button data-t="brush" class="em-tool" aria-pressed="false" title="Free-brush a region (B)">✎ Brush</button>
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

      <svg class="em-overlay" hidden xmlns="${SVGNS}"></svg>

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

    makeDraggable(toolbar, toolbar.querySelector('.em-toolbar-row'));
    makeDraggable(panel, panel.querySelector('.em-panel-head'));

    renderHint();
    renderList();
  }

  /* --------------------------------------------------------------- drag */
  function makeDraggable(elToMove, handle) {
    if (!elToMove || !handle) return;
    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, textarea, a, select, .em-seg, .em-tool')) return;
      e.preventDefault();
      const start = elToMove.getBoundingClientRect();
      const offX = e.clientX - start.left, offY = e.clientY - start.top;
      elToMove.style.left = start.left + 'px';
      elToMove.style.top = start.top + 'px';
      elToMove.style.right = 'auto'; elToMove.style.bottom = 'auto'; elToMove.style.transform = 'none';
      handle.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
      const onMove = (ev) => {
        const w = elToMove.offsetWidth, h = elToMove.offsetHeight;
        let x = Math.max(4, Math.min(ev.clientX - offX, window.innerWidth - w - 4));
        let y = Math.max(4, Math.min(ev.clientY - offY, window.innerHeight - h - 4));
        elToMove.style.left = x + 'px'; elToMove.style.top = y + 'px';
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        handle.style.cursor = 'grab'; document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    });
  }

  /* --------------------------------------------------------------- on/off */
  function setOn(on) {
    if (state.publish) return;
    state.on = on;
    document.body.classList.toggle('em-active', on);
    toolbar.hidden = !on; panel.hidden = !on;
    overlay.toggleAttribute('hidden', !on);   // SVGElement has no .hidden IDL prop
    toggleBtn.classList.toggle('is-on', on);
    if (on) { setTool(state.tool); startOverlayLoop(); }
    else { stopOverlayLoop(); cancelDrag(); closePopup(); clearHover(); clearSelection(); }
  }
  function setView(v) {
    state.view = v;
    toolbar.querySelectorAll('.em-seg').forEach((b) => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    renderHint(); drawOverlay();
  }
  function setTool(t) {
    if (t !== 'select') clearSelection();
    state.tool = t;
    toolbar.querySelectorAll('.em-tool').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    cancelDrag(); closePopup(); clearHover();
    ['select', 'brush', 'pointer'].forEach((k) => document.body.classList.toggle('em-tool-' + k, t === k));
    // Pointer wipes the hover/selection overlay — UNLESS Expert view is on, which is a
    // "show all ids" *view* independent of the active tool.
    if (t === 'pointer' && overlay && state.view !== 'expert') overlay.innerHTML = '';
    renderHint(); drawOverlay();
  }
  function renderHint() {
    const byTool = {
      pointer: 'Pointer — interact with the page normally. Switch tool to resume editing.',
      select: 'Click one · ctrl/⌘+click several · drag a box to snip an area',
      brush: 'Press and drag to paint a region',
    }[state.tool];
    hint.textContent = byTool + (state.tool === 'select' && state.view === 'expert' ? ' · all ids shown' : '');
  }

  /* ============================================================ OVERLAY LAYER */
  let overlayRAF = 0, hoverEl = null;
  function startOverlayLoop() {
    const tick = () => { if (!state.on) return; drawOverlay(); overlayRAF = requestAnimationFrame(tick); };
    cancelAnimationFrame(overlayRAF); overlayRAF = requestAnimationFrame(tick);
  }
  function stopOverlayLoop() { cancelAnimationFrame(overlayRAF); overlayRAF = 0; overlay.innerHTML = ''; }
  function sizeOverlay() {
    overlay.setAttribute('width', window.innerWidth);
    overlay.setAttribute('height', window.innerHeight);
    overlay.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  }
  function clearHover() { hoverEl = null; }

  function collectRects() {
    const out = [];
    const wantAll = state.view === 'expert';
    const selIds = new Set(state.selection.map((s) => s.id));
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (!selectable(n)) return;   // skips our UI AND rail/grid thumbnails
      const id = n.getAttribute('data-viz-id');
      const isHover = (n === hoverEl);
      const isSel = selIds.has(id);
      if (!wantAll && !isHover && !isSel) return;
      const b = n.getBoundingClientRect();
      const MINW = 10;
      let x = b.left, y = b.top, w = b.width, h = b.height;
      if (w < MINW) { x -= (MINW - w) / 2; w = MINW; }
      if (h < MINW) { y -= (MINW - h) / 2; h = MINW; }
      if (w < 1 || h < 1) return;
      if (x + w < 0 || y + h < 0 || x > window.innerWidth || y > window.innerHeight) return;
      out.push({ id, rect: { x, y, w, h }, isHover, isSel });
    });
    return out;
  }

  function drawOverlay() {
    // Expert view ("show all ids") draws regardless of the active tool — it's a view,
    // not a tool. Otherwise Pointer suppresses the overlay (page behaves normally).
    if (!state.on || (state.tool === 'pointer' && state.view !== 'expert')) { overlay.innerHTML = ''; return; }
    sizeOverlay();
    const rects = collectRects();
    const frag = document.createDocumentFragment();
    for (const r of rects) {
      const rect = svgEl('rect');
      rect.setAttribute('class', 'em-rect' + (r.isHover ? ' is-hover' : '') + (r.isSel ? ' is-selected' : ''));
      rect.setAttribute('x', r.rect.x); rect.setAttribute('y', r.rect.y);
      rect.setAttribute('width', r.rect.w); rect.setAttribute('height', r.rect.h);
      rect.setAttribute('rx', 3);
      frag.appendChild(rect);
      if (r.isHover || r.isSel || state.view === 'expert') {
        const tw = Math.max(28, r.id.length * 6.6 + 10);
        const g = svgEl('g');
        g.setAttribute('class', 'em-badge' + (r.isSel ? ' is-selected' : ''));
        const by = Math.max(0, r.rect.y - 16);
        const bg = svgEl('rect');
        bg.setAttribute('class', 'em-badge-bg');
        bg.setAttribute('x', r.rect.x); bg.setAttribute('y', by);
        bg.setAttribute('width', tw); bg.setAttribute('height', 15); bg.setAttribute('rx', 3);
        const tx = svgEl('text');
        tx.setAttribute('class', 'em-badge-tx');
        tx.setAttribute('x', r.rect.x + 5); tx.setAttribute('y', by + 11);
        tx.textContent = r.id;
        g.appendChild(bg); g.appendChild(tx); frag.appendChild(g);
      }
    }
    overlay.innerHTML = '';
    overlay.appendChild(frag);
  }

  /* ============================================================ PROGRAMMATIC INSPECT
     Static, headless overlay for agent visual self-review: draw labeled rects for
     specific ids (or all), with NO toolbar/FAB and NO rAF loop. Used by
     scripts/shoot-slides.mjs via EditMode.inspect(...). Returns rect geometry. */
  function ensureOverlayEl() {
    if (overlay) return;
    // minimal: create just the SVG overlay if init()/buildUI() wasn't called
    overlay = svgEl('svg');
    overlay.setAttribute('class', 'em-overlay');
    document.body.appendChild(overlay);
  }
  function drawInspect(targetIds /* Set|null → null means all */) {
    ensureOverlayEl();
    overlay.toggleAttribute('hidden', false);
    sizeOverlay();
    const out = [];
    const frag = document.createDocumentFragment();
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (!selectable(n)) return;   // skips our UI AND rail/grid thumbnails
      const id = n.getAttribute('data-viz-id');
      if (targetIds && !targetIds.has(id)) return;
      const b = n.getBoundingClientRect();
      const MINW = 10;
      let x = b.left, y = b.top, w = b.width, h = b.height;
      if (w < MINW) { x -= (MINW - w) / 2; w = MINW; }
      if (h < MINW) { y -= (MINW - h) / 2; h = MINW; }
      if (w < 1 || h < 1) return;
      // `is-inspect` → ORANGE styling, distinct from the theme accent palette so an
      // agent inspection box is never confused with actual slide content.
      const rect = svgEl('rect');
      rect.setAttribute('class', 'em-rect is-inspect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('rx', 3);
      frag.appendChild(rect);
      const tw = Math.max(28, id.length * 6.6 + 10);
      const g = svgEl('g'); g.setAttribute('class', 'em-badge is-inspect');
      const by = Math.max(0, y - 16);
      const bg = svgEl('rect'); bg.setAttribute('class', 'em-badge-bg');
      bg.setAttribute('x', x); bg.setAttribute('y', by); bg.setAttribute('width', tw); bg.setAttribute('height', 15); bg.setAttribute('rx', 3);
      const tx = svgEl('text'); tx.setAttribute('class', 'em-badge-tx');
      tx.setAttribute('x', x + 5); tx.setAttribute('y', by + 11); tx.textContent = id;
      g.appendChild(bg); g.appendChild(tx); frag.appendChild(g);
      out.push({ id, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    });
    overlay.innerHTML = ''; overlay.appendChild(frag);
    return out;
  }

  /* ============================================================ SELECTION */
  function clearSelection() { state.selection = []; removeSelChip(); }
  function toggleSelect(id) {
    const i = state.selection.findIndex((s) => s.id === id);
    if (i >= 0) state.selection.splice(i, 1); else state.selection.push({ id });
    renderSelChip();
  }
  let selChip = null;
  function renderSelChip() {
    if (!state.selection.length) { removeSelChip(); return; }
    if (!selChip) {
      selChip = el('div', 'em-sel-chip');
      selChip.innerHTML = `<span><b class="em-sel-n">0</b> selected</span>
        <button class="em-sel-commit">Comment</button><button class="em-sel-cancel">Clear</button>`;
      root.appendChild(selChip);
      selChip.querySelector('.em-sel-commit').addEventListener('click', commitSelection);
      selChip.querySelector('.em-sel-cancel').addEventListener('click', clearSelection);
    }
    selChip.querySelector('.em-sel-n').textContent = state.selection.length;
  }
  function removeSelChip() { if (selChip) { selChip.remove(); selChip = null; } }
  function commitSelection() {
    if (!state.selection.length) return;
    const ids = state.selection.map((s) => s.id);
    clearSelection();
    openPopup({ kind: ids.length > 1 ? 'multi' : 'component', targetIds: ids });
  }

  /* ============================================================ POINTER EVENTS */
  let drag = null;   // { tool, x0, y0, x1, y1, box, points? }

  function onMouseMove(e) {
    if (!state.on) return;
    if (drag) { updateDrag(e); return; }
    if (state.tool === 'pointer') return;
    let node = e.target.closest && e.target.closest('[data-viz-id]');
    if (node && inRoot(node)) node = null;
    // If the nearest tagged ancestor is the slide container, only hover it when the
    // cursor is in the edge band — otherwise the whole-slide box shadows its content.
    if (node && isSlideContainer(node) && !nearSlideEdge(node, e.clientX, e.clientY)) node = null;
    hoverEl = node || null;
  }

  function onMouseDown(e) {
    if (!state.on || state.tool === 'pointer') return;
    if (inRoot(e.target)) return;             // clicks on our own UI
    if (e.button !== 0) return;
    // The popup floats over the slide and can overlap content (e.g. it opens on the
    // table header). A mousedown whose POINT is inside the open popup is meant for the
    // popup (clicking into the textarea) even if hit-testing resolved e.target to a
    // slide element underneath — bail so we don't close it + start a marquee on the
    // element behind it. (This is the "click the comment box → it selects the element
    // instead" bug.)
    if (!popup.hidden && pointInEl(popup, e.clientX, e.clientY)) return;
    // Starting a new selection supersedes any open, uncommitted popup: hide and
    // ignore it (typed text dropped), then capture the new selection instead.
    if (!popup.hidden) closePopup();
    if (state.tool === 'select') {
      // ctrl/⌘+click → toggle into multi-select buffer (handled on click, not drag)
      // start a potential marquee; if it stays tiny it becomes a plain click, if it
      // moves it becomes a snip-of-the-area.
      drag = { tool: 'marquee', x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, moved: false, ctrl: e.ctrlKey || e.metaKey };
      e.preventDefault();
    } else if (state.tool === 'brush') {
      drag = { tool: 'brush', points: [[e.clientX, e.clientY]], moved: false };
      e.preventDefault();
    }
  }

  function updateDrag(e) {
    if (drag.tool === 'brush') {
      // brush has no x0/y0 — measure movement from the first point
      const [px, py] = drag.points[0];
      if (Math.abs(e.clientX - px) > 4 || Math.abs(e.clientY - py) > 4) drag.moved = true;
      drag.points.push([e.clientX, e.clientY]); drawBrush();
      liveHighlight(brushBBox(drag.points));   // light up elements under the stroke
      return;
    }
    drag.x1 = e.clientX; drag.y1 = e.clientY;
    const dx = Math.abs(drag.x1 - drag.x0), dy = Math.abs(drag.y1 - drag.y0);
    if (dx > 4 || dy > 4) drag.moved = true;
    // A ⌘/ctrl gesture is a toggle-click that adds ONE element to the running buffer —
    // it is never a marquee. So while ctrl is held, don't draw the live marquee box and
    // (critically) don't run liveHighlight, which REPLACES state.selection wholesale and
    // would wipe the accumulated buffer the instant the hand jitters a few px. (This is
    // the "multi-select randomly resets while holding Command" bug.)
    if (drag.ctrl || e.ctrlKey || e.metaKey) return;
    drawDragBox();
    liveHighlight(boxRect(drag));              // light up elements as the box covers them
  }
  // While dragging, mark the elements currently inside the box as selected so their
  // rects draw live (cheap — just updates the selection set + redraws the overlay).
  function liveHighlight(rect) {
    const ids = idsInRect(rect);
    state.selection = ids.map((id) => ({ id }));
    drawOverlay();
  }

  function onMouseUp(e) {
    // a mouseup inside the open popup is the user interacting with it — never treat it
    // as finishing a slide selection.
    if (!popup.hidden && pointInEl(popup, e.clientX, e.clientY)) return;
    if (!state.on || !drag) {
      // plain click in select with no drag started elsewhere
      return;
    }
    const d = drag; drag = null;
    removeDragBox(); removeBrush();
    const rect = boxRect(d);
    if (d.tool === 'select' || d.tool === 'marquee') {
      // Honor the modifier from EITHER mousedown OR the live mouseup — sampling only at
      // mousedown meant a slightly-late Cmd press (or a missed keydown) turned an
      // intended ⌘+click into a plain click that wiped the buffer.
      const ctrl = d.ctrl || e.ctrlKey || e.metaKey;
      // When Cmd is held, the intent is ALWAYS "add this element to the selection" — even
      // if the hand jittered a few px (which would otherwise flip this into a marquee
      // snip that REPLACES the whole buffer via highlightSelected). So a ⌘-gesture is
      // treated as a toggle-click regardless of `moved`. THIS is the "multi-select
      // randomly resets while holding Command" bug: a tiny drag during a ⌘-click.
      if (!d.moved || ctrl) {
        // a click (or a ⌘-click that wobbled): toggle, never snip
        let node = e.target.closest && e.target.closest('[data-viz-id]');
        if (node && inRoot(node)) node = null;
        // same edge rule as hover: a click in the slide interior shouldn't grab the
        // whole-slide container — only an edge click means "the slide itself".
        if (node && isSlideContainer(node) && !nearSlideEdge(node, e.clientX, e.clientY)) node = null;
        const id = node ? node.getAttribute('data-viz-id') : null;
        if (!id) { if (!ctrl) clearSelection(); return; }
        if (ctrl) { toggleSelect(id); return; }       // ctrl/⌘+click toggles
        // plain click: if a buffer exists, commit buffer+this; else single comment
        if (state.selection.length) { toggleSelect(id); commitSelection(); }
        else openPopup({ kind: 'component', targetIds: [id] });
        return;
      }
      // drag → snip the area + record the elements inside. Show the selected element
      // boxes and open the comment popup IMMEDIATELY (no waiting on the screenshot),
      // then capture the tight box around them (or the raw drag box if empty) in the
      // background and attach the image when it's ready.
      const ids = idsInRect(rect);
      const captureRect = ids.length ? unionRectOfIds(ids) : rect;
      highlightSelected(ids);   // draw their boxes right away
      openPopupAsync({ kind: 'area', targetIds: [], relatedIds: ids, rect: normRect(domRect(captureRect)) }, captureRect);
      return;
    }
    if (d.tool === 'brush') {
      if (!d.moved) return;
      const bb = brushBBox(d.points);
      const ids = idsInRect(bb);
      highlightSelected(ids);
      openPopupAsync({ kind: 'brush', targetIds: [], relatedIds: ids, rect: normRect(domRect(bb)) }, bb);
      return;
    }
  }

  // rect helpers — drag boxes stored as {x0,y0,x1,y1}; convert to {left,top,width,height}
  function boxRect(d) {
    if (d.tool === 'brush') return brushBBox(d.points);
    const left = Math.min(d.x0, d.x1), top = Math.min(d.y0, d.y1);
    return { left, top, width: Math.abs(d.x1 - d.x0), height: Math.abs(d.y1 - d.y0) };
  }
  function brushBBox(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }
  function domRect(r) { return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  function idsInRect(r) {
    const out = [];
    const R = { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (!selectable(n)) return;   // skips our UI AND rail/grid thumbnails
      // The slide container's center is inside ANY marquee, so it would always be swept
      // into a multi-select — never what the user means (it'd box the whole slide). A
      // marquee is for grabbing CONTENT; grab the whole slide by clicking its edge.
      if (isSlideContainer(n)) return;
      const b = n.getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      // include if the element's center is inside the box (intuitive for marquee)
      if (cx >= R.left && cx <= R.right && cy >= R.top && cy <= R.bottom) out.push(n.getAttribute('data-viz-id'));
    });
    return out;
  }
  // tight bounding box around the given ids' rendered rects (+ small pad), so a
  // drag-snip captures snugly around what got selected rather than the loose drag box.
  function unionRectOfIds(ids, pad = 6) {
    const set = new Set(ids);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    document.querySelectorAll('[data-viz-id]').forEach((n) => {
      if (!selectable(n) || !set.has(n.getAttribute('data-viz-id'))) return;
      const b = n.getBoundingClientRect();
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom); any = true;
    });
    if (!any) return null;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(window.innerWidth, maxX + pad); maxY = Math.min(window.innerHeight, maxY + pad);
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  /* drag-box + brush visuals */
  let dragBox = null, brushCanvas = null;
  function drawDragBox() {
    // Select-drag now snips an area → use the solid capture-region style.
    if (!dragBox) { dragBox = el('div', 'em-snip'); root.appendChild(dragBox); }
    const r = boxRect(drag);
    Object.assign(dragBox.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  function removeDragBox() { if (dragBox) { dragBox.remove(); dragBox = null; } }
  function drawBrush() {
    if (!brushCanvas) {
      brushCanvas = el('canvas', 'em-brush');
      brushCanvas.width = window.innerWidth; brushCanvas.height = window.innerHeight;
      root.appendChild(brushCanvas);
    }
    const ctx = brushCanvas.getContext('2d');
    ctx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    ctx.strokeStyle = '#FF6A00'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);   // orange — off theme palette
    ctx.beginPath();
    drag.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  }
  function removeBrush() { if (brushCanvas) { brushCanvas.remove(); brushCanvas = null; } }
  function cancelDrag() { drag = null; removeDragBox(); removeBrush(); }

  /* ============================================================ SCREENSHOT */
  // Load html-to-image on first capture. It's vendored next to this script
  // (public/edit-mode/html-to-image.js) so it loads INSTANTLY from disk — no network
  // round-trip — which is what kept the first snip fast. Falls back to a CDN only if
  // the local copy is missing. Cached on window after load.
  let h2iPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(global.htmlToImage);
      s.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function selfDir() {
    // derive the dir this edit-mode.js was loaded from, so the sibling lib resolves
    // regardless of where the deck is served. document.currentScript is null by the
    // time captureRegion runs, so find our own <script> by src.
    const me = [...document.scripts].find((s) => /\/edit-mode\/edit-mode\.js(\?|$)/.test(s.src));
    if (me) return me.src.replace(/edit-mode\.js(\?.*)?$/, '');
    return '/edit-mode/';
  }
  function ensureHtmlToImage() {
    if (global.htmlToImage && global.htmlToImage.toCanvas) return Promise.resolve(global.htmlToImage);
    if (h2iPromise) return h2iPromise;
    h2iPromise = loadScript(selfDir() + 'html-to-image.js')
      .catch(() => loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'));
    return h2iPromise;
  }
  async function captureRegion(r) {
    try {
      const h2i = await ensureHtmlToImage();
      if (!h2i || !h2i.toCanvas) return null;
      // hide our own UI so the toolbar/panel/overlay don't appear in the snip.
      // CAVEAT: hiding `root` blurs whatever inside it had focus (a hidden element
      // can't hold focus) — and the comment popup we just opened lives in `root`, so
      // without this its textarea silently loses focus mid-snip and the user can't
      // type. Remember the focused field and restore it after the capture.
      const wasHidden = root.style.visibility;
      const refocus = (root.contains(document.activeElement)) ? document.activeElement : null;
      root.style.visibility = 'hidden';
      let canvas;
      try {
        // Speed: skipFonts avoids re-embedding the display font on every snip (the bulk
        // of the cost — the snip is a reference image, web-font fidelity isn't
        // critical); pixelRatio 1 + no cacheBust keep it light.
        canvas = await h2i.toCanvas(document.body, {
          backgroundColor: '#ffffff', skipFonts: true, cacheBust: false, pixelRatio: 1,
        });
      } finally {
        root.style.visibility = wasHidden;
        // restore focus + caret to the comment box so typing works immediately
        if (refocus && refocus.isConnected) { try { refocus.focus(); } catch (_) {} }
      }
      const dpr = 1;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(r.width * dpr));
      out.height = Math.max(1, Math.round(r.height * dpr));
      out.getContext('2d').drawImage(
        canvas, r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr,
        0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    } catch (_) { return null; }   // screenshot optional — comment still works with rect + ids
  }

  /* ============================================================ POPUP / COMMENTS */
  let pending = null;

  // Show the boxes of the just-selected elements immediately (puts them in the
  // selection set so the overlay loop draws their rects + id badges this frame).
  function highlightSelected(ids) {
    state.selection = ids.map((id) => ({ id }));
    drawOverlay();
  }

  // Open the popup right away, then attach the screenshot when capture finishes — so
  // the user sees instant feedback instead of a frozen ~2.5s gap while the image
  // library loads. A new selection (which sets a fresh `pending`) supersedes the
  // late-arriving image so it never lands on the wrong comment.
  function openPopupAsync(c, captureRect) {
    openPopup(c);
    const mine = c;                       // identity guard
    captureRegion(captureRect).then((shot) => {
      // captureRegion briefly hides our UI (which blurs the textarea); once it's done
      // and the popup is visible again, put the caret back so the user can type — the
      // post-capture focus is what makes the multi-select/snip popup actually editable.
      if (pending === mine && !popup.hidden) {
        const ta = popup.querySelector('.em-popup-text');
        if (ta && document.activeElement !== ta) ta.focus();
      }
      if (!shot) return;
      mine.screenshot = shot;             // so commit picks it up
      if (pending === mine && !popup.hidden) showPopupThumb(shot);
    });
  }
  function showPopupThumb(src) {
    let img = popup.querySelector('.em-popup-thumb');
    if (!img) {
      img = el('img', 'em-popup-thumb');
      popup.insertBefore(img, popup.querySelector('.em-popup-text'));
    }
    img.src = src;
  }

  function openPopup(c) {
    pending = c;
    const thumb = popup.querySelector('.em-popup-thumb'); if (thumb) thumb.remove();
    popup.querySelector('.em-popup-tgt').textContent =
      c.targetIds && c.targetIds.length ? c.targetIds.join(', ')
      : (c.relatedIds && c.relatedIds.length ? `${c.kind}: ${c.relatedIds.length} element(s)` : c.kind);
    const ta = popup.querySelector('.em-popup-text'); ta.value = '';
    popup.hidden = false;
    if (c.screenshot) showPopupThumb(c.screenshot);
    // position near the cursor-ish center; clamp
    popup.style.left = Math.min(window.innerWidth - 280, Math.max(16, window.innerWidth / 2 - 130)) + 'px';
    popup.style.top = Math.min(window.innerHeight - 180, Math.max(70, window.innerHeight / 2 - 90)) + 'px';
    setTimeout(() => ta.focus(), 0);
  }
  function closePopup() {
    popup.hidden = true; pending = null;
    const thumb = popup.querySelector('.em-popup-thumb'); if (thumb) thumb.remove();
    clearSelection();   // drop the highlighted boxes
  }
  function commitPopup() {
    if (!pending) return;
    const text = popup.querySelector('.em-popup-text').value.trim();
    const c = Object.assign({ id: state.nextId++, comment: text, slideContext: slideContext() }, pending);
    state.comments.push(c);
    pending = null; popup.hidden = true;
    const thumb = popup.querySelector('.em-popup-thumb'); if (thumb) thumb.remove();
    clearSelection();   // drop the highlighted boxes
    renderList();
  }

  function renderList() {
    const n = state.comments.length;
    root.querySelector('.em-count').textContent = n;
    root.querySelector('.em-count-mini').textContent = n;
    if (!n) { list.innerHTML = '<div class="em-empty">No comments yet. Select something and describe the change.</div>'; return; }
    list.innerHTML = '';
    state.comments.forEach((c) => {
      const item = el('div', 'em-item');
      const tgt = (c.targetIds && c.targetIds.length) ? c.targetIds.join(', ')
                : (c.relatedIds && c.relatedIds.length) ? `${c.kind} · ${c.relatedIds.length} ids` : c.kind;
      item.innerHTML = `<div class="em-item-top"><span class="em-kind">${esc(c.kind)}</span>
        <span class="em-tgt" title="${esc(tgt)}">${esc(tgt)}</span>
        <button class="em-del" title="Delete">✕</button></div>
        ${c.screenshot ? `<img class="em-thumb" src="${c.screenshot}" alt="snip">` : ''}
        <textarea placeholder="What should change here?">${esc(c.comment || '')}</textarea>`;
      item.querySelector('.em-del').addEventListener('click', () => {
        state.comments = state.comments.filter((x) => x.id !== c.id); renderList();
      });
      item.querySelector('textarea').addEventListener('input', (e) => { c.comment = e.target.value; });
      list.appendChild(item);
    });
  }

  /* ============================================================ EXPORT */
  function buildBatch() {
    return {
      schema: SCHEMA,
      page: location.pathname,
      capturedAt: new Date().toISOString(),
      imageDir: state.imageDir,
      comments: state.comments.map((c, i) => ({
        kind: c.kind,
        targetIds: c.targetIds || [],
        relatedIds: c.relatedIds || [],
        rect: c.rect || null,
        comment: c.comment || '',
        hasScreenshot: !!c.screenshot,
        screenshotFile: c.screenshot ? `snip-${i + 1}.png` : null,
        screenshotDataUrl: c.screenshot || undefined,
        slideContext: c.slideContext || null,
      })),
    };
  }
  function batchToMarkdown(batch) {
    const dir = (batch.imageDir || '/tmp/slide-maker-edit').replace(/\/$/, '');
    const shots = batch.comments.filter((c) => c.screenshotFile);
    let md = `# Slide edit feedback\n\n${batch.comments.length} comment(s) · ${batch.capturedAt}\n\n`;
    // If any comment carries a snip, tell the agent up front to actually open the
    // images — a bare "snip-1.png" filename is invisible to it otherwise. The bridge
    // writes each PNG to <dir>, so we hand over the absolute path it can Read directly.
    if (shots.length) {
      md += `> **${shots.length} screenshot(s) attached — Read each image file below before acting; the comment refers to what's shown in it.**\n\n`;
    }
    batch.comments.forEach((c, i) => {
      const tgt = c.targetIds.length ? c.targetIds.join(', ') : (c.relatedIds.length ? c.relatedIds.join(', ') : c.kind);
      md += `## ${i + 1}. ${c.kind} — ${tgt}\n`;
      if (c.slideContext && c.slideContext.label) md += `slide: ${c.slideContext.label}\n`;
      if (c.rect) md += `area: ${c.rect.width}×${c.rect.height} at (${c.rect.x},${c.rect.y})\n`;
      if (c.screenshotFile) md += `screenshot (Read this image): ${dir}/${c.screenshotFile}\n`;
      md += `\n${c.comment || '(no comment)'}\n\n`;
    });
    return md;
  }
  async function copyBatch() {
    if (!state.comments.length) { toast('No comments to copy'); return; }
    const batch = buildBatch();
    const md = batchToMarkdown(batch);
    try { await navigator.clipboard.writeText(md); } catch (_) {}
    if (state.bridge) {
      try {
        const r = await fetch(state.bridge + '/feedback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({}, batch, { markdown: md })),
        });
        if (r.ok) { const j = await r.json(); toast(`Saved to ${j.dir || state.imageDir} — tell the AI "read the feedback"`); return; }
      } catch (_) { /* bridge down → clipboard fallback already done */ }
    }
    toast('Copied markdown to clipboard (run the bridge for snips + one-click)');
  }
  function downloadBatch() {
    if (!state.comments.length) { toast('No comments to download'); return; }
    const batch = buildBatch();
    // strip dataUrls into separate PNG downloads
    batch.comments.forEach((c, i) => {
      if (c.screenshotDataUrl) { downloadDataUrl(c.screenshotDataUrl, c.screenshotFile || `snip-${i + 1}.png`); delete c.screenshotDataUrl; }
    });
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' });
    downloadDataUrl(URL.createObjectURL(blob), 'edit-feedback.json');
    toast('Downloaded edit-feedback.json + snips');
  }
  function downloadDataUrl(url, name) {
    const a = el('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ============================================================ misc */
  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', 'em-toast'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // Momentary Pointer: holding LEFT Shift temporarily switches to Pointer so the
  // user can interact with the page, then snaps back to their tool on release.
  let shiftPrevTool = null;
  function onKey(e) {
    if (state.publish) return;
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === 'e' && !typing && !e.metaKey && !e.ctrlKey) { setOn(!state.on); return; }
    if (!state.on) return;
    // hold-Left-Shift → momentary Pointer (ignore auto-repeat + while typing)
    if (e.code === 'ShiftLeft' && !e.repeat && shiftPrevTool === null && !typing) {
      shiftPrevTool = state.tool;
      if (state.tool !== 'pointer') setTool('pointer');
      return;
    }
    if (typing) return;
    // Tool shortcuts are LETTERS (not 1/2/3) so they don't collide with the deck's
    // number-key slide-jump. V Pointer · S Select · B Brush. (Present mode uses L/P/C.)
    if (e.key === 'Escape') { cancelDrag(); closePopup(); clearSelection(); }
    else if (e.key === 'Enter' && state.selection.length) commitSelection();
    else if (e.key === 'x' || e.key === 'X') setView(state.view === 'normal' ? 'expert' : 'normal');
    else if (e.key === 'v' || e.key === 'V') setTool('pointer');
    else if (e.key === 's' || e.key === 'S') setTool('select');
    else if (e.key === 'b' || e.key === 'B') setTool('brush');
  }
  function onKeyUp(e) {
    if (state.publish || !state.on) return;
    // release Left Shift → restore the tool we had before the momentary Pointer
    if (e.code === 'ShiftLeft' && shiftPrevTool !== null) {
      const t = shiftPrevTool; shiftPrevTool = null;
      if (state.tool !== t) setTool(t);
    }
  }

  /* ============================================================ public API */
  const EditMode = {
    init(opts = {}) {
      if (state.publish) return EditMode;
      if (!root) buildUI();
      if (opts.bridge) state.bridge = opts.bridge.replace(/\/$/, '');
      if (opts.imageDir) state.imageDir = opts.imageDir;
      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('resize', sizeOverlay);
      // If the window loses focus while Shift is held, the keyup may never fire —
      // restore the tool so we don't get stuck in momentary Pointer.
      window.addEventListener('blur', () => {
        if (shiftPrevTool !== null) { const t = shiftPrevTool; shiftPrevTool = null; if (state.tool !== t) setTool(t); }
      });
      // Warm up the snapshot pipeline the moment edit mode initialises, so the FIRST
      // real snip is already fast. The first html-to-image render of a page costs
      // ~1s (full DOM serialization); doing a real FULL-body warm render here (in the
      // background, hidden) pays that cost upfront instead of on the user's first
      // selection. Subsequent captures are ~40ms.
      ensureHtmlToImage().then((h2i) => {
        if (h2i && h2i.toCanvas) {
          h2i.toCanvas(document.body, { backgroundColor: '#ffffff', skipFonts: true, cacheBust: false, pixelRatio: 1 }).catch(() => {});
        }
      }).catch(() => {});
      return EditMode;
    },
    setPublishMode(on) {
      state.publish = !!on;
      if (on && root) { setOn(false); root.style.display = 'none'; }
      else if (root) root.style.display = '';
      return EditMode;
    },
    // Programmatic on/off so a host UI (e.g. the deck's Normal-mode Edit toggle) can
    // drive edit mode instead of the built-in ✎ FAB / `e` key. No-op under publish.
    setOn(on) { if (!state.publish && root) setOn(!!on); return EditMode; },
    isOn() { return !!state.on; },
    // Programmatic inspection for agent visual self-review (headless, no UI chrome):
    //   inspect({ all: true })            → box + label every tagged element
    //   inspect({ ids: ['s0.title', …] }) → box + label only those
    //   inspect({ clear: true })          → remove the overlay
    // Returns [{ id, x, y, w, h }] geometry (viewport px). Does NOT require init().
    inspect(opts = {}) {
      if (opts.clear) { if (overlay) { overlay.innerHTML = ''; overlay.toggleAttribute('hidden', true); } return []; }
      const ids = opts.all ? null : new Set(opts.ids || []);
      return drawInspect(ids);
    },

    // ─── Agent comment authoring ───────────────────────────────────────────────
    // The programmatic equivalent of a human selecting + commenting. Lets an agent
    // build the SAME slide-maker/edit-feedback@1 batch the human "Copy for AI" flow
    // produces, headlessly. Reuses the same capture + batch machinery.
    //
    //   await EditMode.addComment({ ids: ['s0.kpi.value'], text: 'make this bigger' })
    //   await EditMode.addComment({ ids: ['s0.card.1','s0.card.2'], text: '…', screenshot: true })
    //   EditMode.addComment({ rect: {left,top,width,height}, text: '…' })  // area, no ids
    //
    // opts: { ids?:string[], rect?:{left,top,width,height}, text?:string,
    //         screenshot?:boolean (default true when ids/rect given) }
    // Returns the stored comment object. `screenshot:true` captures the tight box
    // around the ids (or the given rect) — async, so await it if you need the image.
    async addComment(opts = {}) {
      const ids = (opts.ids || []).filter(Boolean);
      // resolve the capture/related rect: tight box of ids, else the explicit rect.
      let captureRect = null, relatedIds = ids;
      if (ids.length) captureRect = unionRectOfIds(ids) || null;
      else if (opts.rect) captureRect = opts.rect;
      if (!captureRect && opts.rect) captureRect = opts.rect;
      let shot = null;
      const wantShot = opts.screenshot !== false && !!captureRect;
      if (wantShot) { try { shot = await captureRegion(captureRect); } catch (_) {} }
      const kind = ids.length ? (ids.length > 1 ? 'multi' : 'component') : 'area';
      const c = {
        id: state.nextId++, kind,
        targetIds: ids.length ? ids : [],
        relatedIds: ids.length ? [] : relatedIds,
        rect: captureRect ? normRect(domRect(captureRect)) : null,
        comment: opts.text || '',
        screenshot: shot || undefined,
        slideContext: slideContext(),
      };
      // for an ids-based comment, also record the elements as relatedIds for context
      if (ids.length && captureRect) c.relatedIds = ids.slice();
      state.comments.push(c);
      if (root) renderList();          // reflect in the panel too, if UI is up
      return c;
    },
    listComments() { return state.comments.slice(); },
    clearComments() { state.comments = []; if (root) renderList(); return EditMode; },
    // The full batch the bridge/Copy-for-AI would emit (slide-maker/edit-feedback@1).
    // includeImages=false strips the base64 dataURLs (smaller payload to read back).
    getFeedback(includeImages = true) {
      const batch = buildBatch();
      if (!includeImages) batch.comments.forEach((c) => { delete c.screenshotDataUrl; });
      batch.markdown = batchToMarkdown(batch);
      return batch;
    },
  };

  global.EditMode = EditMode;
})(window);
