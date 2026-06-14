/* =============================================================================
 * component-detail-modal.js — drill-down modal with a "process pipeline" blueprint
 * =============================================================================
 * WHAT THIS IS
 *   The click-to-drill modal behind a clickable map node. It renders a module's
 *   internals two ways, and a right rail of clickable component cards that swap to
 *   a full detail view (← back restores the overview):
 *     1. ENGINE view — a hand-laid SVG "blueprint": a horizontal Process Event
 *        Pipeline band of steps, dashed annotation callouts that stagger into two
 *        depth rows, external sources merging in on the left, an actor → a
 *        management box dropping into the pipeline at the "append" step, and a
 *        Store → History → T0..TN timeline under it. Pan/zoom via the SVG variant.
 *     2. LANES view — a simpler card-lane layout (a workflow plug-in's components),
 *        also clickable to detail.
 *
 * DEPENDS ON
 *   - DOM scaffold: #drillModal / #drillStage / #drillRail / #drillTabs and the
 *     .pl-* / .dc / .bk-* / .dt-* CSS classes (see styles.css + page-shell).
 *   - pan-zoom-viewport.js (mode:'svg') for the engine canvas.
 *   - Optional: window.__setModalRenderPause(true/false) to pause the 3D loop
 *     while open; and the overlay system's `drill` flag to suppress its keys.
 *
 * HOW TO WIRE
 *   import { initDrill } from './component-detail-modal.js';
 *   initDrill({ designs: { engine: ENGINE_DESIGN, lanes: LANES_DESIGN }, drill });
 *   // nodes with data-drill="engine" open the modal; back/esc/close handled.
 *
 * DATA SHAPES (genericized — keep the shape, replace the copy)
 *   DETAIL[id]      = { title, pill, sig, resp, io, rules[], collab }  (rich detail)
 *   ENGINE_DESIGN   = { title, subtitle, desc, pipeline[], sources[], mgmt[],
 *                       history[], groups[] }
 *     pipeline step = { id?, k, v, cls?, badge?, note?, store? }
 *   LANES_DESIGN    = { title, subtitle, desc, lanes[] }  (cards / grouped cards)
 *
 * NON-OBVIOUS DETAILS (kept verbatim)
 *   - The SVG viewBox is CROPPED to actual content (totalW/totalH pre-computed)
 *     so there's no dead space to pan through.
 *   - Annotation callouts stagger row = k%2 (near/far) so adjacent boxes never
 *     overlap; each box x is clamped to the canvas.
 *   - wrapSvg() is a word-wrapper for <text> (SVG has no auto-wrap) → tspans.
 *   - Clickable steps/cards carry data-detail / data-bk; a delegated rail click
 *     and per-node click both route to showDetail(). The active node gets .sel.
 * ========================================================================== */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pillClass = (p) => (p === 'pure' || p === 'impure' || p === 'boot' || p === 'value') ? p : 'impure';
const pillText  = (p) => ({ pure: 'pure', impure: 'impure', boot: 'boot', value: 'value' }[p] || 'impure');

// word-wrap helper for SVG <text> (SVG has no auto-wrap)
function wrapSvg(str, max) {
  const words = String(str).split(' '); const lines = []; let cur = '';
  words.forEach((w) => {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}

/* ----------------------------- EXAMPLE DATA ------------------------------- *
 * A generic "process pipeline" — replace copy, keep the shape. (This example
 * mirrors the sample page's video-delivery story; swap it for your own domain.) */
export const DETAIL = {
  encode: {
    title: 'EncodeEngine', pill: 'pure',
    sig: 'encode({ shot, rung }): Rendition',
    resp: 'EXAMPLE — the pure core: deterministically encodes one shot at one ladder rung. No I/O, no scheduling, so a failed shot re-encodes in isolation.',
    io: 'In: a shot + a target rung. Out: an encoded rendition (no side effects).',
    rules: [
      'EXAMPLE — per-shot, never per-title — one failure costs one shot.',
      'EXAMPLE — deterministic: replay-equivalent to a cold re-encode.',
    ],
    collab: 'EXAMPLE — fed by ShotSplitter + LadderPlanner; output validated by QualityGate.',
  },
  vmaf: {
    title: 'QualityGate', pill: 'pure',
    sig: 'check({ rendition, target }): keep | bump',
    resp: 'EXAMPLE — compares a rendition’s measured VMAF against the rung target and decides keep / re-encode-higher.',
    io: 'In: rendition + target. Out: pass | bump-rung.',
    rules: ['EXAMPLE — no I/O — just the comparison.', 'EXAMPLE — a bump re-runs only the affected rung.'],
    collab: 'EXAMPLE — consumes EncodeEngine output; feeds the Packager.',
  },
  // ... add one entry per clickable step/card id you want rich detail for.
};

export const ENGINE_DESIGN = {
  title: 'encode pipeline', subtitle: 'the processing engine',
  desc: 'EXAMPLE — a workflow-agnostic processing engine. A title is split into shots, each encoded in parallel into a per-title quality ladder, then validated and published.',
  // pipeline spine (in order); each step may carry a detail id, a style class, a badge and a note callout
  pipeline: [
    { id: 'split', k: 'shot-split', v: 'segment by scene', cls: '' },
    { id: 'plan', k: 'plan ladder', v: 'per-title bitrates', cls: '', store: true },
    { id: 'lease', k: 'lease workers', v: 'farm fan-out', cls: '' },
    { id: 'encode', k: 'Encode Engine', v: 'parallel per-shot', cls: 'fold', badge: 'PURE', note: 'each shot encodes independently; re-encodes a single failed shot, not the title' },
    { id: 'vmaf', k: 'VMAF gate', v: 'quality vs target', cls: '', note: 'compare measured VMAF against the ladder target' },
    { id: 'pack', k: 'package (UoW)', v: 'CMAF · one manifest', cls: '', note: 'stitch shots + write manifest atomically' },
    { id: 'publish', k: 'Publish', v: 'to catalog + fill', cls: '', note: 'final phase; idempotent — safe to replay' },
  ],
  sources: [   // external inputs merging into the pipeline entry
    { k: 'Ingest', v: 'mezzanine → handler' },
    { k: 'Re-encode', v: 'codec add → handler' },
  ],
  mgmt: ['Re-run shot', 'Bump ladder', 'Add codec', 'Pin VMAF'],   // operator actions chips
  history: [   // the Store → History → T0..TN timeline
    { t: 'T0', l: 'MASTER INGESTED' },
    { t: 'T1', l: 'LADDER PLANNED' },
    { t: 'T2', l: 'HDR PASS', skip: true },
    { t: 'TN', l: 'PUBLISHED' },
  ],
  groups: [   // right-rail overview cards (id ⇒ clickable to DETAIL)
    { h: 'Orchestration', items: [
      { id: 'split', n: 'ShotSplitter', t: 'segments the title by scene', p: 'impure' },
    ] },
    { h: 'Engine (pure)', items: [
      { id: 'encode', n: 'EncodeEngine', t: 'the parallel per-shot encoder', p: 'pure' },
      { id: 'vmaf', n: 'QualityGate', t: 'VMAF vs target, pure check', p: 'pure' },
    ] },
  ],
};

export const LANES_DESIGN = {
  title: 'delivery workflow', subtitle: 'pre-position to the edge',
  desc: 'EXAMPLE — plugs into the engine via a manifest: pure planners decide what to pre-position where, impure effects push bytes to appliances during off-peak fill windows.',
  lanes: [
    { h: 'Planners', ct: 'pure', cards: [
      { n: 'demand.forecast', t: 'EXAMPLE — predicts per-region demand', p: 'pure' },
      { n: 'placement.plan', t: 'EXAMPLE — which titles to which appliances', p: 'pure' },
    ] },
    { h: 'Effect handlers', ct: 'impure', cards: [
      { n: 'FillAppliance', t: 'EXAMPLE — pushes bytes to an edge box', code: 'replay: SKIP', p: 'impure' },
    ] },
  ],
};

/* ----------------------------- THE MODAL CONTROLLER ----------------------- */
export function initDrill({
  designs = { engine: ENGINE_DESIGN, lanes: LANES_DESIGN },
  detail = DETAIL,
  drill = { open: false },
  panZoom = null,           // pass attachPanZoom from pan-zoom-viewport.js
} = {}) {
  const modal  = document.getElementById('drillModal');
  const stage  = document.getElementById('drillStage');
  const rail   = document.getElementById('drillRail');
  const tabsEl = document.getElementById('drillTabs');
  if (!modal || !stage || !rail || !tabsEl) return;

  let railOverview = '';   // cached overview HTML so "back" can restore it
  const bkIndex = {};      // card name → card, for lane click-to-detail

  const railCard = (c) => {
    const did = c.id ? ` data-detail="${esc(c.id)}"` : '';
    return `<div class="dc${c.id ? ' clickable' : ''}"${did}><div class="dc-top"><span class="dc-name">${esc(c.n)}</span>`
      + `<span class="dc-pill ${pillClass(c.p)}" style="margin-left:auto">${pillText(c.p)}</span></div>`
      + `<span class="dc-tag">${esc(c.t)}</span></div>`;
  };

  // ---- right-panel detail view for one component (id keyed into DETAIL) ----
  function showDetail(id) {
    const d = detail[id];
    if (!d) return;
    const list = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');
    rail.innerHTML = `<button class="dt-back" id="dtBack">← all components</button>`
      + `<div class="dt-head"><span class="dt-title">${esc(d.title)}</span>`
      + `<span class="dc-pill ${pillClass(d.pill)}">${pillText(d.pill)}</span></div>`
      + `<p class="dt-resp">${esc(d.resp)}</p>`
      + (d.sig ? `<h4>Interface</h4><pre class="dt-sig">${esc(d.sig)}</pre>` : '')
      + (d.io ? `<h4>Inputs → Outputs</h4><p class="dt-io">${esc(d.io)}</p>` : '')
      + (d.rules ? `<h4>Key behaviours</h4><ul class="dt-rules">${list(d.rules)}</ul>` : '')
      + (d.collab ? `<h4>Collaborators</h4><p class="dt-collab">${esc(d.collab)}</p>` : '');
    rail.scrollTop = 0;
    document.getElementById('dtBack').addEventListener('click', () => { rail.innerHTML = railOverview; rail.scrollTop = 0; });
    stage.querySelectorAll('[data-detail]').forEach((el) => el.classList.toggle('sel', el.dataset.detail === id));
  }

  // ---- ENGINE view rendered as SVG (so connectors + dashed callouts are real) ----
  function renderEngine(d) {
    const W = 150, GAP = 34, X0 = 170, BAND_Y = 200, BAND_H = 96;
    const NS = 'http://www.w3.org/2000/svg';
    const totalW = X0 + d.pipeline.length * (W + GAP) + 40;
    const stepX = (i) => X0 + i * (W + GAP);
    const noteSteps = d.pipeline.map((s, i) => ({ s, i })).filter((o) => o.s.note);

    // pre-compute vertical layout so the viewBox crops to actual content (no empty space)
    const boxW = 170, boxH = 58, rowGap = 10;
    const rowTop = BAND_Y + BAND_H + 28;
    const rowBot = rowTop + boxH + rowGap;
    const ehY = BAND_Y + BAND_H + 34;               // Event History under "append"
    const tlEnd = Math.max(ehY + 88 + (d.history.length - 1) * 27, rowBot + boxH);
    const totalH = tlEnd + 24;
    const vbW = Math.max(totalW, 1180);

    let svg = `<svg class="pl-svg" viewBox="0 0 ${vbW} ${totalH}" xmlns="${NS}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<defs><marker id="plArr" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#3c4f63"/></marker></defs>`;
    svg += `<g class="pl-pan">`;

    // top: actor → management box → pipeline (drops in at the "append" step)
    const tmX = stepX(1), tmY = 56, tmW = 380, tmH = 86;
    svg += `<text class="pl-actor-l" x="${tmX + 60}" y="14" text-anchor="middle">Operator</text>`
      + `<circle class="pl-actor" cx="${tmX + 60}" cy="32" r="9"/>`
      + `<path class="pl-conn" d="M${tmX + 60},41 V${tmY}" marker-end="url(#plArr)"/>`;
    svg += `<g class="pl-mgmt-box"><rect x="${tmX}" y="${tmY}" width="${tmW}" height="${tmH}" rx="9"/>`
      + `<text class="pl-mgmt-t" x="${tmX + 14}" y="${tmY + 22}">Management — operator actions</text>`;
    d.mgmt.forEach((m, i) => {
      const cx = tmX + 14 + (i % 3) * 116, cy = tmY + 36 + Math.floor(i / 3) * 24;
      svg += `<g class="pl-chip-g"><rect x="${cx}" y="${cy}" width="108" height="19" rx="9"/>`
        + `<text x="${cx + 54}" y="${cy + 13}" text-anchor="middle">${esc(m)}</text></g>`;
    });
    svg += `</g>`;
    svg += `<path class="pl-conn" d="M${tmX + 60},${tmY + tmH} V${BAND_Y}" marker-end="url(#plArr)"/>`;

    // left: external sources → pipeline entry (centred on the band)
    const srcX = 6, mergeX = X0 - 18, entryY = BAND_Y + BAND_H / 2;
    const srcH = 42, srcGap = 14;
    const srcTop = entryY - (d.sources.length * srcH + (d.sources.length - 1) * srcGap) / 2;
    d.sources.forEach((s, i) => {
      const sy = srcTop + i * (srcH + srcGap);
      svg += `<g class="pl-src"><rect x="${srcX}" y="${sy}" width="120" height="${srcH}" rx="8"/>`
        + `<text class="pl-src-k" x="${srcX + 60}" y="${sy + 18}" text-anchor="middle">${esc(s.k)}</text>`
        + `<text class="pl-src-v" x="${srcX + 60}" y="${sy + 33}" text-anchor="middle">${esc(s.v)}</text></g>`
        + `<path class="pl-conn" d="M${srcX + 120},${sy + 21} H${mergeX} V${entryY}" />`;
    });
    svg += `<path class="pl-conn" d="M${mergeX},${entryY} H${X0}" marker-end="url(#plArr)"/>`;

    // pipeline band frame + label
    svg += `<rect class="pl-band-bg" x="${X0 - 12}" y="${BAND_Y - 24}" width="${d.pipeline.length * (W + GAP) - GAP + 24}" height="${BAND_H + 40}" rx="10"/>`;
    svg += `<text class="pl-band-l" x="${X0 - 4}" y="${BAND_Y - 10}">Process Event Pipeline</text>`;

    // steps
    d.pipeline.forEach((s, i) => {
      const x = stepX(i), y = BAND_Y;
      if (i) svg += `<path class="pl-conn" d="M${x - GAP},${y + BAND_H / 2} H${x}" marker-end="url(#plArr)"/>`;
      const cls = ['pl-step-g', s.cls, s.id ? 'click' : ''].filter(Boolean).join(' ');
      svg += `<g class="${cls}" data-detail="${esc(s.id || '')}">`
        + `<rect x="${x}" y="${y}" width="${W}" height="${BAND_H}" rx="9"/>`
        + `<text class="pl-k" x="${x + 13}" y="${y + 28}">${esc(s.k)}</text>`
        + `<text class="pl-v" x="${x + 13}" y="${y + 48}">${wrapSvg(s.v, 20).map((ln, j) => `<tspan x="${x + 13}" dy="${j ? 15 : 0}">${esc(ln)}</tspan>`).join('')}</text>`;
      if (s.badge) svg += `<text class="pl-badge ${s.cls}" x="${x + 13}" y="${y + BAND_H - 13}">${esc(s.badge)}</text>`;
      svg += `</g>`;
    });

    // fold-engine "loop" caption
    const foldI = d.pipeline.findIndex((s) => s.cls === 'fold');
    if (foldI >= 0) {
      const fx = stepX(foldI);
      svg += `<text class="pl-loop" x="${fx + W / 2}" y="${BAND_Y - 4}" text-anchor="middle">↻ loop from latest stable if conflict</text>`;
    }

    // dashed annotation callouts dropping DOWN, staggered into two depth rows
    noteSteps.forEach((o, k) => {
      const x = stepX(o.i) + W / 2;
      const row = k % 2;                                 // 0 = near, 1 = far
      const boxY = row ? rowBot : rowTop;
      const bx = Math.max(X0 - 16, Math.min(stepX(o.i) - 10, totalW - boxW - 8));   // clamp to canvas
      svg += `<path class="pl-callout" d="M${x},${BAND_Y + BAND_H} V${boxY}"/>`;
      svg += `<g class="pl-note-g"><rect x="${bx}" y="${boxY}" width="${boxW}" height="${boxH}" rx="6"/>`
        + `<text class="pl-note-t" x="${bx + 10}" y="${boxY + 17}">`
        + wrapSvg(o.s.note, 30).slice(0, 3).map((ln, j) => `<tspan x="${bx + 10}" dy="${j ? 14 : 0}">${esc(ln)}</tspan>`).join('')
        + `</text></g>`;
    });

    // Store → Event History → T0..TN timeline (aligned under the "append" step)
    const apX = stepX(1) + W / 2;
    const ehW = 150, ehX = apX - ehW / 2;
    svg += `<path class="pl-conn store" d="M${apX},${BAND_Y + BAND_H} V${ehY}" marker-end="url(#plArr)"/>`;
    svg += `<text class="pl-store-cap" x="${apX + 6}" y="${BAND_Y + BAND_H + 22}">store</text>`;
    svg += `<g class="pl-store-g"><rect x="${ehX}" y="${ehY}" width="${ehW}" height="48" rx="9"/>`
      + `<text class="pl-store-k" x="${apX}" y="${ehY + 21}" text-anchor="middle">Event History</text>`
      + `<text class="pl-store-v" x="${apX}" y="${ehY + 37}" text-anchor="middle">append-only · the truth</text></g>`;
    svg += `<path class="pl-conn" d="M${apX},${ehY + 48} V${ehY + 72}" marker-end="url(#plArr)"/>`;
    d.history.forEach((h, i) => {
      const ty = ehY + 88 + i * 27;
      svg += `<text class="pl-tl-t" x="${ehX}" y="${ty + 4}">${esc(h.t)}</text>`
        + `<circle class="pl-tl-dot ${h.skip ? 'skip' : ''}" cx="${ehX + 48}" cy="${ty}" r="5"/>`
        + `<text class="pl-tl-l" x="${ehX + 62}" y="${ty + 4}">${esc(h.l)}${h.skip ? ' · skipped' : ''}</text>`;
    });

    svg += `</g></svg>`;

    stage.innerHTML = `<div class="pl-zoom"><button data-z="out" aria-label="Zoom out">−</button>`
      + `<button data-z="reset" aria-label="Reset view">⤢</button>`
      + `<button data-z="in" aria-label="Zoom in">+</button>`
      + `<span class="pl-hint">scroll to pan · ⌘/ctrl + scroll or pinch to zoom · drag to move</span></div>`
      + `<div class="pl-viewport" id="plViewport">${svg}</div>`;
    const viewport = stage.querySelector('#plViewport');
    const pan = viewport.querySelector('.pl-pan');

    // pan/zoom (SVG variant) — see pan-zoom-viewport.js
    if (panZoom) panZoom({ mode: 'svg', viewport, pan, viewBoxW: vbW, viewBoxH: totalH,
      min: 0.5, max: 2.6, buttons: stage.querySelectorAll('.pl-zoom button'), skipDragOn: '.pl-step-g.click' });

    // clicks on steps → detail
    stage.querySelectorAll('.pl-step-g.click').forEach((g) => g.addEventListener('click', () => showDetail(g.dataset.detail)));

    railOverview = `<p class="rail-desc">${esc(d.desc)}</p>`
      + `<p class="rail-hint">Click any pipeline step or card for full detail.</p>`
      + d.groups.map((g) => `<h4>${esc(g.h)}</h4>` + g.items.map(railCard).join('')).join('');
    rail.innerHTML = railOverview;
  }

  // ---- LANES view (card lanes; optionally grouped) ----
  function renderLanes(d) {
    const card = (c, group) => {
      bkIndex[c.n] = { ...c, group };
      const code = c.code ? `<span class="dc-code">${esc(c.code)}</span>` : '';
      return `<div class="bk-card clickable ${pillClass(c.p) === 'pure' ? 'pure' : 'impure'}" data-bk="${esc(c.n)}">`
        + `<div class="bk-card-top"><span class="bk-name">${esc(c.n)}</span>`
        + `<span class="dc-pill ${pillClass(c.p)}">${pillText(c.p)}</span>${code}</div>`
        + `<span class="bk-tag">${esc(c.t)}</span></div>`;
    };
    const lane = (l) => {
      let inner = '';
      if (l.groups) {
        inner = l.groups.map((g) => `<div class="bk-sub">${esc(g.s)}</div>`
          + `<div class="bk-grid">${g.cards.map((c) => card(c, g.s)).join('')}</div>`).join('');
      } else {
        inner = `<div class="bk-grid">${l.cards.map((c) => card(c, l.h)).join('')}</div>`;
      }
      const ct = l.ct ? `<span class="ct">${esc(l.ct)}</span>` : '';
      return `<div class="bk-lane"><h3>${esc(l.h)} ${ct}</h3>${inner}</div>`;
    };
    stage.innerHTML = `<div class="bk-wrap">${d.lanes.map(lane).join('')}</div>`;
    stage.querySelectorAll('.bk-card.clickable').forEach((el) => el.addEventListener('click', () => showBkDetail(el.dataset.bk)));
    railOverview = `<p class="rail-desc">${esc(d.desc)}</p>`
      + `<p class="rail-hint">Click any component card for full detail.</p>`;
    rail.innerHTML = railOverview;
  }

  // lane component detail — built from the card itself (+ optional rich DETAIL entry)
  function showBkDetail(name) {
    const c = bkIndex[name]; if (!c) return;
    const r = detail[name] || {};
    const list = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');
    rail.innerHTML = `<button class="dt-back" id="dtBack">← all components</button>`
      + `<div class="dt-head"><span class="dt-title">${esc(c.n)}</span>`
      + `<span class="dc-pill ${pillClass(c.p)}">${pillText(c.p)}</span></div>`
      + (c.group ? `<p class="dt-grp">${esc(c.group)}</p>` : '')
      + `<p class="dt-resp">${esc(r.resp || c.t)}</p>`
      + (c.code ? `<p class="dt-io"><b>key:</b> <code>${esc(c.code)}</code></p>` : '')
      + (r.sig ? `<h4>Interface</h4><pre class="dt-sig">${esc(r.sig)}</pre>` : '')
      + (r.io ? `<h4>Inputs → Outputs</h4><p class="dt-io">${esc(r.io)}</p>` : '')
      + (r.rules ? `<h4>Key behaviours</h4><ul class="dt-rules">${list(r.rules)}</ul>` : '')
      + (r.collab ? `<h4>Collaborators</h4><p class="dt-collab">${esc(r.collab)}</p>` : '');
    rail.scrollTop = 0;
    document.getElementById('dtBack').addEventListener('click', () => { rail.innerHTML = railOverview; rail.scrollTop = 0; });
    stage.querySelectorAll('.bk-card').forEach((el) => el.classList.toggle('sel', el.dataset.bk === name));
  }

  // delegated rail card click → detail
  rail.addEventListener('click', (e) => {
    const card = e.target.closest('[data-detail]');
    if (card && card.dataset.detail) showDetail(card.dataset.detail);
  });

  function renderDrill(which) {
    stage.classList.toggle('engine', which === 'engine');
    if (which === 'engine') renderEngine(designs.engine);
    else renderLanes(designs.lanes);
    tabsEl.querySelectorAll('.drill-tab').forEach((t) => t.classList.toggle('active', t.dataset.go === which));
    stage.scrollTop = 0; stage.scrollLeft = 0; rail.scrollTop = 0;
  }

  // build the two tabs once
  [['engine', designs.engine.title, designs.engine.subtitle],
   ['lanes',  designs.lanes.title,  designs.lanes.subtitle]].forEach(([id, name, sub]) => {
    const b = document.createElement('button');
    b.className = 'drill-tab'; b.dataset.go = id;
    b.innerHTML = `${esc(name)} <small>· ${esc(sub)}</small>`;
    b.addEventListener('click', () => renderDrill(id));
    tabsEl.appendChild(b);
  });

  // ---- open / close (with focus management + render-pause hook) ----
  let lastFocus = null;
  function openDrill(which) {
    lastFocus = document.activeElement;
    drill.open = true;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');           // hides the top nav (CSS)
    if (window.__setModalRenderPause) window.__setModalRenderPause(true);
    renderDrill(which);
    document.getElementById('drillX').focus();
  }
  function closeDrill() {
    drill.open = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    if (window.__setModalRenderPause) window.__setModalRenderPause(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // node clicks + keyboard activation
  document.querySelectorAll('[data-drill]').forEach((node) => {
    node.addEventListener('click', () => openDrill(node.dataset.drill));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrill(node.dataset.drill); }
    });
  });
  modal.querySelectorAll('[data-drill-close]').forEach((el) => el.addEventListener('click', closeDrill));
  window.addEventListener('keydown', (e) => { if (drill.open && e.key === 'Escape') closeDrill(); });

  return { openDrill, closeDrill };
}
