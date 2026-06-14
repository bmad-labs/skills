/* =============================================================================
 * erd-diagram.js — DOM-table ERD with measured crow's-foot relationship lines
 * =============================================================================
 * WHAT THIS IS
 *   An entity-relationship diagram engine. Tables are real DOM (<div>) so they
 *   reflow and the browser handles typography; the RELATIONSHIP LINES are then
 *   drawn into an overlaid SVG by MEASURING the laid-out tables (getBoundingClientRect)
 *   and connecting their edges with crow's-foot / single-bar glyphs, cardinality
 *   "1"/"N" labels, and a verb label rotated to follow the curve's tangent.
 *
 *   This is the most refined diagram in the set. The bezier-tangent label math and
 *   the endpoint glyph geometry are preserved EXACTLY — re-deriving them is painful.
 *
 * DEPENDS ON
 *   - DOM containers + the .erd-* CSS classes (see styles.css).
 *   - pan-zoom-viewport.js (mode:'css') for the viewport — optional but expected.
 *   - Nothing else.
 *
 * HOW TO WIRE
 *   import { buildErd, drawErdLines } from './erd-diagram.js';
 *   buildErd(erdBodyEl, ERD);                  // builds the table grid + viewport
 *   // draw AFTER layout settles & the pan transform is at identity:
 *   requestAnimationFrame(() => requestAnimationFrame(() => drawErdLines()));
 *   attachPanZoom({ mode:'css', viewport:#erdViewport, pan:#erdPan, ... });
 *   window.addEventListener('resize', () => modalOpen && drawErdLines());
 *
 * DATA SHAPE
 *   ERD: [ { id, name, tag, kind, fields:[ { n, t, k?, note? } ] } ]
 *        kind ∈ 'truth'|'state'|'emb'|'read'|'ledger' (just a CSS colour theme)
 *        k    ∈ 'pk'|'fk'|'uq'|'emb' (the little key swatch)
 *   ERD_RELS: [ { from, to, fromEnd, toEnd, label } ]
 *        fromEnd/toEnd ∈ 'one' (single bar ||) | 'many' (crow's foot)
 *
 * THE HUB-CENTRED LAYOUT (why lines never cross a table)
 *   Tables are placed in 3 columns: [source] | [THE hub, alone] | [all children].
 *   With the hub alone in the middle and wide empty lanes either side, every line
 *   travels through clear space — it never has to route over another table.
 *
 * FOUR HARD-WON DETAILS (kept verbatim — see inline)
 *   1. LINE-CONNECTS-TO-GLYPH-BASE: the cubic's endpoint is the glyph BASE
 *      (lineEnd), not the table edge. So the curve meets the foot of the crow's-
 *      foot / the centre of the bar cleanly, with no gap or overshoot.
 *   2. CROW'S-FOOT + BAR GEOMETRY: built from the edge point (ex,ey) and a unit
 *      direction (dx,dy) INTO the line, with a perpendicular (px,py)=(-dy,dx).
 *   3. EXIT-POINT SPREADING: when several relations leave the SAME edge of one
 *      table (the hub fans to many children), their exit y's are spread along that
 *      edge, sorted by target centre-y, so feet don't stack on one point.
 *   4. BEZIER TANGENT LABELS: the verb label sits at the cubic's t=0.5 point and
 *      is rotated to the analytic tangent there (clamped to ±90° so text stays
 *      upright). The derivative formula is the standard cubic-bezier dP/dt.
 * ========================================================================== */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ----------------------------- EXAMPLE DATA ------------------------------- *
 * Replace with your own schema. The shape is what matters. (This example mirrors
 * the sample page's video-delivery catalog; swap it for your own domain.) */
export const ERD = [
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

// fromEnd/toEnd: 'one' (||) or 'many' (crow's-foot) at each table edge.
export const ERD_RELS = [
  { from: 'ev', to: 'tk', fromEnd: 'one', toEnd: 'many', label: 'encodes into' },
  { from: 'tk', to: 'add', fromEnd: 'one', toEnd: 'one', label: 'has' },
  { from: 'tk', to: 'ts', fromEnd: 'one', toEnd: 'many', label: 'embeds' },
  { from: 'tk', to: 'br', fromEnd: 'one', toEnd: 'many', label: 'placed as' },
  { from: 'tk', to: 'hist', fromEnd: 'one', toEnd: 'many', label: 'logs' },
  { from: 'tk', to: 'eo', fromEnd: 'one', toEnd: 'many', label: 'tracks' },
];

/* ----------------------------- BUILD THE TABLES --------------------------- *
 * opts.intro    — the caption above the grid (HTML); defaults to the example note.
 * opts.columns  — the 3-column id layout [source[], hub[], children[]]. Defaults to
 *                 the example ids; pass your own so the hub-centred layout matches
 *                 your schema (hub alone in the middle → no line crosses a table). */
export function buildErd(erdBody, data = ERD, rels = ERD_RELS, opts = {}) {
  const tableHtml = (t) => {
    const rows = t.fields.map((f) => {
      const kc = f.k ? ` k-${f.k}` : '';
      const marker = f.k ? `<i class="erd-k k-${f.k}"></i>` : '<i class="erd-k"></i>';
      const note = f.note ? `<span class="erd-note">${esc(f.note)}</span>` : '';
      return `<div class="erd-row${kc}">${marker}<span class="erd-fn">${esc(f.n)}</span>`
        + `<span class="erd-ft">${esc(f.t)}</span>${note}</div>`;
    }).join('');
    return `<div class="erd-table erd-${t.kind}" id="erd-${t.id}">`
      + `<div class="erd-thead"><span class="erd-tname">${esc(t.name)}</span>`
      + `<span class="erd-ttag">${esc(t.tag)}</span></div>${rows}</div>`;
  };
  // hub-centred 3-column layout — hub alone in the middle so no line crosses a table.
  // Columns: [source] | [hub] | [all children]. Pass opts.columns to match your schema.
  const byId = (id) => data.find((t) => t.id === id);
  const cols = opts.columns || [
    ['ev'],                                    // source of truth → connects RIGHT to hub
    ['tk'],                                    // THE hub, alone
    ['add', 'ts', 'br', 'hist', 'eo'],         // children → connect LEFT to hub (fan, no crossing)
  ];
  const intro = opts.intro
    || `<b>EXAMPLE — the leftmost table is the source of truth</b>; every other collection is a replay-rebuildable projection of it.`;
  erdBody.innerHTML = `<div class="erd-note-top">${intro}</div>`
    + `<div class="erd-zoom"><button data-z="out" aria-label="Zoom out">−</button>`
    + `<button data-z="reset" aria-label="Reset view">⤢</button>`
    + `<button data-z="in" aria-label="Zoom in">+</button>`
    + `<span class="pl-hint">scroll to pan · ⌘/ctrl + scroll or pinch to zoom · drag to move</span></div>`
    + `<div class="erd-viewport" id="erdViewport"><div class="erd-pan" id="erdPan">`
    + `<div class="erd-canvas"><svg class="erd-lines" id="erdLines"></svg>`
    + `<div class="erd-grid">`
    + cols.map((ids) => `<div class="erd-col">${ids.map((id) => tableHtml(byId(id))).join('')}</div>`).join('')
    + `</div></div></div></div>`;
}

/* ----------------------------- DRAW THE LINES ----------------------------- *
 * Measured from the DOM, so call AFTER layout has settled and while the pan
 * transform is at identity (otherwise measured coords include the zoom). */
export function drawErdLines(rels = ERD_RELS) {
  const svg = document.getElementById('erdLines');
  const canvas = svg && svg.parentElement;
  if (!svg || !canvas) return;
  const cr = canvas.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${cr.width} ${cr.height}`);
  svg.setAttribute('width', cr.width); svg.setAttribute('height', cr.height);

  // measure a table's box in canvas-local coords
  const box = (id) => {
    const el = document.getElementById('erd-' + id); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left - cr.left, r: r.right - cr.left, t: r.top - cr.top, b: r.bottom - cr.top,
      cx: (r.left + r.right) / 2 - cr.left, cy: (r.top + r.bottom) / 2 - cr.top };
  };

  // --- endpoint glyphs ---
  // (ex,ey) = the point ON THE TABLE EDGE; (dx,dy) = unit dir INTO the line.
  // Each returns { glyph, lineEnd:[x,y], card:[cx,cy] } so the curve connects to
  // the GLYPH BASE (lineEnd), not the table edge — the line-to-glyph-base fix.
  const FOOT = 13, BAR_OFF = 9;
  const oneBar = (ex, ey, dx, dy) => {                 // "1" — a single bar across the line
    const px = -dy, py = dx, o = 6;                    // perpendicular to the line dir
    const bx = ex + dx * BAR_OFF, by = ey + dy * BAR_OFF;
    return { glyph: `<line class="erd-foot one" x1="${bx + px * o}" y1="${by + py * o}" x2="${bx - px * o}" y2="${by - py * o}"/>`,
      lineEnd: [bx, by], card: [ex + dx * 22 + px * 11, ey + dy * 22 + py * 11] };
  };
  const manyFoot = (ex, ey, dx, dy) => {               // "N" — crow's foot converging at the edge
    const px = -dy, py = dx, sp = 8;
    const bx = ex + dx * FOOT, by = ey + dy * FOOT;    // base, where the line connects
    return { glyph: `<path class="erd-foot many" d="M${bx + px * sp},${by + py * sp} L${ex},${ey} L${bx - px * sp},${by - py * sp}"/>`,
      lineEnd: [bx, by], card: [bx + dx * 12 + px * 11, by + dy * 12 + py * 11] };
  };
  const endGlyph = (end, ex, ey, dx, dy) => end === 'many' ? manyFoot(ex, ey, dx, dy) : oneBar(ex, ey, dx, dy);

  // --- exit-point spreading: when many lines leave the SAME edge of one table,
  //     spread their exit points along that edge so feet don't stack. ---
  const exitSpread = {};
  rels.forEach((rel) => {
    const a = box(rel.from), b = box(rel.to); if (!a || !b) return;
    if (b.l >= a.r - 4 || b.r <= a.l + 4) { (exitSpread[rel.from] = exitSpread[rel.from] || []).push(rel); }
  });
  Object.values(exitSpread).forEach((grp) => grp.sort((p, q) => box(p.to).cy - box(q.to).cy));

  let paths = '';
  rels.forEach((rel) => {
    const a = box(rel.from), b = box(rel.to);
    if (!a || !b) return;
    let ex1, ey1, ex2, ey2, da, db;          // e* = table-edge points; da/db: dir into the line
    let ay = a.cy;
    const grp = exitSpread[rel.from];
    if (grp && grp.length > 1) {              // spread this rel's exit along the source edge
      const idx = grp.indexOf(rel), n = grp.length;
      const span = Math.min(a.b - a.t - 24, 30 * (n - 1));
      ay = a.cy - span / 2 + (span / (n - 1)) * idx;
    }
    // pick which edges face each other (horizontal pair preferred; else vertical)
    if (b.l >= a.r - 4)      { ex1 = a.r; ey1 = ay;   ex2 = b.l; ey2 = b.cy; da = [1, 0];  db = [-1, 0]; }
    else if (b.r <= a.l + 4) { ex1 = a.l; ey1 = ay;   ex2 = b.r; ey2 = b.cy; da = [-1, 0]; db = [1, 0]; }
    else if (b.t >= a.b - 4) { ex1 = a.cx; ey1 = a.b; ex2 = b.cx; ey2 = b.t; da = [0, 1];  db = [0, -1]; }
    else                     { ex1 = a.cx; ey1 = a.t; ex2 = b.cx; ey2 = b.b; da = [0, -1]; db = [0, 1]; }

    const g1 = endGlyph(rel.fromEnd, ex1, ey1, da[0], da[1]);
    const g2 = endGlyph(rel.toEnd,   ex2, ey2, db[0], db[1]);
    const [x1, y1] = g1.lineEnd, [x2, y2] = g2.lineEnd;   // curve connects to the GLYPH BASE
    // control points: bow out along the connecting axis so the cubic is smooth
    const horiz = Math.abs(da[0]) === 1;
    const c1x = horiz ? (x1 + x2) / 2 : x1, c1y = horiz ? y1 : (y1 + y2) / 2;
    const c2x = horiz ? (x1 + x2) / 2 : x2, c2y = horiz ? y2 : (y1 + y2) / 2;
    const d = `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;

    // analytic cubic-bezier point + tangent at t (for label position + rotation)
    const bez = (t) => {
      const u = 1 - t;
      const X = u*u*u*x1 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x2;
      const Y = u*u*u*y1 + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*y2;
      const dX = 3*u*u*(c1x-x1) + 6*u*t*(c2x-c1x) + 3*t*t*(x2-c2x);   // dP/dt
      const dY = 3*u*u*(c1y-y1) + 6*u*t*(c2y-c1y) + 3*t*t*(y2-c2y);
      return { X, Y, ang: Math.atan2(dY, dX) * 180 / Math.PI };
    };
    const m = bez(0.5);

    paths += `<path class="erd-line" d="${d}"/>` + g1.glyph + g2.glyph
      + `<text class="erd-card" x="${g1.card[0]}" y="${g1.card[1] + 3}" text-anchor="middle">${rel.fromEnd === 'many' ? 'N' : '1'}</text>`
      + `<text class="erd-card" x="${g2.card[0]}" y="${g2.card[1] + 3}" text-anchor="middle">${rel.toEnd === 'many' ? 'N' : '1'}</text>`;

    // verb label at the midpoint, rotated to follow the tangent (kept upright ±90°)
    let ang = m.ang; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const lx = m.X, ly = m.Y, w = rel.label.length * 6.4 + 14;
    paths += `<g transform="translate(${lx} ${ly}) rotate(${ang})">`
      + `<rect class="erd-lbl-bg" x="${-w / 2}" y="-10" width="${w}" height="20" rx="5"/>`
      + `<text class="erd-lbl" x="0" y="4" text-anchor="middle">${esc(rel.label)}</text></g>`;
  });
  svg.innerHTML = paths;
}

/* ----------------------------- THE ERD MODAL CONTROLLER ------------------------- *
 * The full open/close lifecycle for the #erdModal scaffold — the recipe that's easy
 * to get subtly wrong, so it's bundled here (mirrors initDrill in the detail modal):
 *   - builds the tables ONCE on first open (lazy — the ERD is offscreen until clicked)
 *   - draws the relationship lines on a DOUBLE requestAnimationFrame, so layout has
 *     settled AND the pan transform is at identity (measuring mid-zoom skews coords)
 *   - manages focus restore, body-scroll lock, the .modal-open nav hide, and the
 *     window.__setModalRenderPause hook so the 3D loop pauses while the modal is open
 *   - redraws lines on resize while open; closes on ×/backdrop/Esc
 *   - shares the overlay system's `drill` flag so number-key lens switching is
 *     suppressed while the ERD is open
 *
 * HOW TO WIRE
 *   import { initErd } from './erd-diagram.js';
 *   initErd({ data: ERD, rels: ERD_RELS, drill, panZoom: attachPanZoom,
 *             intro: 'The <b>master</b> is the source of truth — …' });   // intro/columns optional
 *
 * Nodes with data-erd open it; everything else is handled. Returns { openErd, closeErd }. */
export function initErd({
  data = ERD, rels = ERD_RELS,
  drill = { open: false },
  panZoom = null,
  intro = undefined,            // caption above the grid (HTML) — omit for the default
  columns = undefined,          // [source[], hub[], children[]] — omit for the default ids
} = {}) {
  const modal = document.getElementById('erdModal');
  const body = document.getElementById('erdBody');
  if (!modal || !body) return { openErd() {}, closeErd() {} };
  let built = false, lastFocus = null;

  function openErd() {
    lastFocus = document.activeElement;
    drill.open = true;                                   // suppress lens number-keys
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');           // hides the nav (CSS)
    if (window.__setModalRenderPause) window.__setModalRenderPause(true);
    if (!built) {
      buildErd(body, data, rels, { intro, columns });
      if (panZoom) panZoom({ mode: 'css', viewport: document.getElementById('erdViewport'),
        pan: document.getElementById('erdPan'), min: 0.4, max: 2.4,
        buttons: body.querySelectorAll('.erd-zoom button') });
      built = true;
    }
    // double-rAF: lines are MEASURED from the DOM, so wait for layout + identity transform
    requestAnimationFrame(() => requestAnimationFrame(() => drawErdLines(rels)));
    const x = modal.querySelector('[data-erd-close]'); if (x && x.focus) x.focus();
  }
  function closeErd() {
    drill.open = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    if (window.__setModalRenderPause) window.__setModalRenderPause(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('[data-erd]').forEach((node) => {
    node.addEventListener('click', openErd);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openErd(); } });
  });
  modal.querySelectorAll('[data-erd-close]').forEach((el) => el.addEventListener('click', closeErd));
  window.addEventListener('keydown', (e) => { if (modal.classList.contains('open') && e.key === 'Escape') closeErd(); });
  window.addEventListener('resize', () => { if (modal.classList.contains('open')) drawErdLines(rels); });

  return { openErd, closeErd };
}
