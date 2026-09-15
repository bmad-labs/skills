/* =============================================================================
 * overlay-lens-system.js — one system map, switchable "lenses" (overlays)
 * =============================================================================
 * WHAT THIS IS
 *   The architecture-section interaction model: a single static SVG system map
 *   that you read through different OVERLAYS ("lenses"). Selecting a lens sets
 *   `data-ov="<id>"` on the section; CSS then DIMS everything not tagged for that
 *   lens and HIGHLIGHTS the tagged nodes/edges. Includes: the OVERLAYS data shape,
 *   a button picker + side panel, keyboard 1–N, a gentle one-time auto-tour, and
 *   a nav header that flips to a .dark variant while the dark map is under it.
 *
 * THE DIMMING CONVENTION  (the load-bearing idea)
 *   - The section element carries  data-ov="sy" (the active lens id).
 *   - Every SVG node/edge that belongs to a lens gets a class  on-XX  (on-df,
 *     on-es, …). Multiple lenses can tag one node: class="node on-df on-ow".
 *   - CSS does the rest (see styles.css .arch block):
 *       .arch:not([data-ov="sy"]) .node { opacity:.18; }     // dim by default
 *       .arch[data-ov="df"] .node.on-df { opacity:1; }       // light the active lens
 *     So JS only ever flips ONE attribute; all the visual logic is declarative CSS.
 *   - `--ov-accent` is set per lens so highlighted strokes/badges share its colour.
 *
 * DEPENDS ON
 *   - DOM: a section with id (e.g. #architecture) carrying data-ov, an #ovPicker,
 *     #ovName / #ovDesc / #ovList panel slots, and an inline SVG map whose nodes
 *     carry on-XX classes. See page-shell/index.html + styles.css.
 *   - Nothing else. Pure DOM.
 *
 * HOW TO WIRE
 *   import { initOverlays } from './overlay-lens-system.js';
 *   initOverlays({ sectionId: 'architecture', reduced: REDUCED });
 *
 * GENERICIZED
 *   The OVERLAYS below are EXAMPLE lenses with neutral copy. Keep the SHAPE
 *   ({ id, key, name, accent, desc, bullets[] }) and the on-XX tagging convention;
 *   replace the content + the SVG map with yours.
 * ========================================================================== */

/* EXAMPLE overlays — replace copy, keep the shape. `id` must match the on-XX
 * suffix used on the SVG nodes (id 'df' ⇒ class 'on-df'). `key` is the 1..N
 * keyboard shortcut. `accent` colours the active button + highlighted strokes. */
export const OVERLAYS = [
  { id: 'sy', key: '1', name: 'Systems', accent: '#9fb0c2',
    desc: 'EXAMPLE — every component at rest, nothing emphasised.',
    bullets: ['Component inventory bullet one', 'Component inventory bullet two', 'Component inventory bullet three'] },
  { id: 'df', key: '2', name: 'Data Flow', accent: '#1fa9b8',
    desc: 'EXAMPLE — how a fact travels through the system, in then out.',
    bullets: ['Inbound path bullet', 'Transform/classify bullet', 'Outbound path bullet'] },
  { id: 'es', key: '3', name: 'Event Sourcing', accent: '#6fc7cf',
    desc: 'EXAMPLE — state as a fold of an append-only history; replayable.',
    bullets: ['Source-of-truth bullet', 'Fold → persist bullet', 'Replay bullet'] },
  { id: 'ow', key: '4', name: 'Ownership', accent: '#f0b35c',
    desc: 'EXAMPLE — who owns which data and the boundary between systems.',
    bullets: ['Boundary bullet', 'Team-ownership bullet', 'Hosting-vs-data bullet'] },
  { id: 're', key: '5', name: 'Reliability', accent: '#f0b35c',
    desc: 'EXAMPLE — idempotency, retries, transactions, recovery paths.',
    bullets: ['Dedup bullet', 'Exactly-once bullet', 'Retry/escalation bullet'] },
  { id: 'ac', key: '6', name: 'Access', accent: '#1fa9b8',
    desc: 'EXAMPLE — authz and data-visibility scoping.',
    bullets: ['Identity bullet', 'Server-side scoping bullet', 'Per-role visibility bullet'] },
];

export function initOverlays({ sectionId = 'architecture', overlays = OVERLAYS, reduced = false } = {}) {
  const archEl = document.getElementById(sectionId);
  if (!archEl) return;
  const picker = document.getElementById('ovPicker');
  const nameEl = document.getElementById('ovName');
  const descEl = document.getElementById('ovDesc');
  const listEl = document.getElementById('ovList');

  // The ONLY state mutation: set data-ov + accent var, refresh the side panel,
  // mark the active button. All visual emphasis is then pure CSS.
  function setOverlay(ov) {
    archEl.dataset.ov = ov.id;
    archEl.style.setProperty('--ov-accent', ov.accent);
    nameEl.textContent = `${ov.key} · ${ov.name}`;
    descEl.textContent = ov.desc;
    listEl.innerHTML = '';
    ov.bullets.forEach((b) => { const li = document.createElement('li'); li.textContent = b; listEl.appendChild(li); });
    picker.querySelectorAll('.ov-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.ov === ov.id));
  }

  // build the picker buttons
  overlays.forEach((ov) => {
    const btn = document.createElement('button');
    btn.className = 'ov-btn';
    btn.dataset.ov = ov.id;
    btn.innerHTML = `<span class="k">${ov.key}</span><span>${ov.name}</span><span class="swatch" style="background:${ov.accent}"></span>`;
    btn.addEventListener('click', () => setOverlay(ov));
    picker.appendChild(btn);
  });
  setOverlay(overlays[0]);

  // keyboard 1–N while the section is on screen (suppressed while a modal is open).
  // `drill` lets a modal mark itself open so number keys don't switch lenses behind it.
  let archVisible = false;
  const drill = { open: false };
  new IntersectionObserver((entries) => { archVisible = entries[0].isIntersecting; }, { threshold: 0.2 }).observe(archEl);
  window.addEventListener('keydown', (e) => {
    if (!archVisible || drill.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const ov = overlays.find((o) => o.key === e.key);
    if (ov) setOverlay(ov);
  });

  // gentle auto-tour the first time the section scrolls into view; any manual pick cancels it.
  if (!reduced) {
    let toured = false;
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || toured) return;
      toured = true;
      let i = 1;
      const step = () => {
        if (!archVisible || i >= overlays.length) { setOverlay(overlays[0]); return; }
        setOverlay(overlays[i]); i += 1;
        tourTimer = setTimeout(step, 2200);
      };
      let tourTimer = setTimeout(step, 1600);
      picker.addEventListener('click', () => clearTimeout(tourTimer), { once: true });
    }, { threshold: 0.45 }).observe(archEl);
  }

  // nav header colour adapts when the dark map is under it (toggles .nav.dark).
  const navEl = document.querySelector('.nav');
  if (navEl) {
    const onScroll = () => {
      const r = archEl.getBoundingClientRect();
      // the dark section spans the top header band (≈70px) → switch to light-on-dark
      navEl.classList.toggle('dark', r.top <= 70 && r.bottom >= 70);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // expose setOverlay + the drill flag so the drill/ERD modal modules can
  // suppress keyboard lens-switching while they're open.
  return { setOverlay, drill, archEl };
}
