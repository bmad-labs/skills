import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Background from './components/Background';
import PresentMode from './components/PresentMode';
import PresentBar from './components/PresentBar';
import TopBar from './components/TopBar';
import SlideRail from './components/SlideRail';
import GridView from './components/GridView';
import NotesPanel from './components/NotesPanel';
import Toast from './components/Toast';
import { TRANSITIONS, DEFAULT_TRANSITION } from './components/transitions';
import useFullscreen from './components/useFullscreen';

// ─── Slides ─────────────────────────────────────────────────────────────────
// The agent imports each slide here and lists it in SLIDES + NAV_ITEMS.
// NAV_ITEMS entries may carry an optional `notes` string — shown in the Normal-mode
// speaker-notes panel (presenter aid; not slide content, so it lives here).
import Slide00 from './slides/00-EXAMPLE-hero-metrics.jsx';

const SLIDES = [Slide00];
const NAV_ITEMS = [
  { slideIndex: 0, label: 'Hero metrics', notes: '' },
];
const PRESENTATION_NAME = 'Slide Deck';
// ─────────────────────────────────────────────────────────────────────────────

// Normal-mode chrome sizes. Single source of truth is the CSS vars in index.css
// (--deck-rail-w / --deck-topbar-h / --deck-notes-h) — the rail/topbar/notes/grid
// position themselves from those, and we read the same values here for the fit math
// so JS and CSS never drift. Read once at module load (they're static).
const cssPx = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};
const RAIL_W = cssPx('--deck-rail-w', 244);    // SlideRail width
const TOPBAR_H = cssPx('--deck-topbar-h', 48); // TopBar height
const NOTES_H = cssPx('--deck-notes-h', 160);  // NotesPanel height

// Present-mode slide transitions come from components/transitions.js (a catalog
// mirrored in design-system/transitions.csv). The active one is chosen deck-wide via
// the TopBar dropdown; all keep slides overlapping (AnimatePresence mode="sync") so
// there's never a dark gap. Normal mode ignores this and cuts instantly.

// Dev-only edit-mode loader. Stripped from export builds: the standalone build
// runs with VITE_EDIT=off, so this branch is dead-code-eliminated and the overlay
// never ships in deck.html. Returns the loaded flag so the rail's Edit toggle can
// gate on availability. (export-deck.mjs also removes any .em-* nodes at capture.)
function useEditModeLoader() {
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.EditMode);
  useEffect(() => {
    if (import.meta.env.VITE_EDIT === 'off') return;
    if (window.EditMode) { setReady(true); return; }
    if (document.getElementById('em-script')) return;
    const bust = import.meta.env.DEV ? `?t=${Date.now()}` : '';
    const css = document.createElement('link');
    css.id = 'em-css'; css.rel = 'stylesheet'; css.href = `/edit-mode/edit-mode.css${bust}`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.id = 'em-script'; s.src = `/edit-mode/edit-mode.js${bust}`;
    s.onload = () => setReady(!!window.EditMode);
    document.body.appendChild(s);
  }, []);
  return ready;
}

export default function App() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const [mode, setMode] = useState('normal');        // 'normal' | 'present'
  const [editOn, setEditOn] = useState(false);       // Normal-mode element-select/comment
  const [gridOpen, setGridOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [zoom, setZoom] = useState(1);               // 1 = fit-to-area
  const [pan, setPan] = useState({ x: 0, y: 0 });    // pan offset (px) when zoomed in
  const [presentTool, setPresentTool] = useState(null);  // 'laser' | 'pen' | null
  const [clearSignal, setClearSignal] = useState(0);
  const [barVisible, setBarVisible] = useState(true);    // present-bar auto-hide
  const [toast, setToast] = useState('');                // transient confirmation message
  const [transition, setTransition] = useState(DEFAULT_TRANSITION);  // deck-wide present transition

  const scalerRef = useRef(null);
  const stageRef = useRef(null);
  const barTimer = useRef(0);
  const fitScaleRef = useRef(1);                     // last computed fit scale (for pan clamping)

  const editReady = useEditModeLoader();
  const fs = useFullscreen();

  const clearInk = useCallback(() => setClearSignal((s) => s + 1), []);
  const goTo = useCallback((i) => { setCurrent((p) => { setDirection(i > p ? 1 : -1); return i; }); }, []);
  const next = useCallback(() => setCurrent((p) => { if (p < SLIDES.length - 1) { setDirection(1); return p + 1; } return p; }), []);
  const prev = useCallback(() => setCurrent((p) => { if (p > 0) { setDirection(-1); return p - 1; } return p; }), []);

  // ── Fit + zoom. The slide is a fixed 1280×720 canvas scaled to "fit" the area
  // available to it (present: the whole viewport; normal: viewport minus rail /
  // topbar / notes, then a thin MARGIN inset on every side so there's always an even
  // gutter). "fit" is the BASELINE: zoom === 1 means fit (shown as 100%), and zoom
  // multiplies that — so 1.5 = 150% of fit. The slide always fits at the default.
  useEffect(() => {
    const fit = () => {
      if (!scalerRef.current) return;
      const isPresent = mode === 'present';
      const MARGIN = isPresent ? 0 : 28;   // px inset on each side in normal mode
      const availW = (isPresent ? window.innerWidth  : window.innerWidth - RAIL_W) - MARGIN * 2;
      const availH = (isPresent ? window.innerHeight : window.innerHeight - TOPBAR_H - (notesOpen ? NOTES_H : 0)) - MARGIN * 2;
      const fitScale = Math.min(availW / 1280, availH / 720);  // largest scale that fits the area
      fitScaleRef.current = fitScale;
      const s = fitScale * (isPresent ? 1 : zoom);
      // The scaler is absolutely positioned at the stage's 50%/50%; translate(-50%,
      // -50%) pins ITS center on the stage center (works at ANY stage size, unlike
      // flex). pan shifts it when zoomed in (0 at fit → stays centered).
      const px = isPresent ? 0 : pan.x;
      const py = isPresent ? 0 : pan.y;
      scalerRef.current.style.transformOrigin = 'center center';
      scalerRef.current.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px) scale(${s})`;
    };
    fit();
    // re-fit after paint too (covers HMR hot-swaps and first-load font/layout shifts
    // where innerWidth/heights settle a tick late)
    const raf = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    // a ResizeObserver on the stage catches any layout change (rail/notes/topbar)
    // without us having to enumerate every trigger — keeps the slide always fitted.
    let ro;
    if (stageRef.current && 'ResizeObserver' in window) {
      ro = new ResizeObserver(fit);
      ro.observe(stageRef.current);
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); ro && ro.disconnect(); };
  }, [mode, zoom, notesOpen, pan]);

  // at fit (zoom ≤ 1) the slide is centered — there's nothing to pan, so keep pan
  // zeroed. (Also reset when leaving normal mode.)
  useEffect(() => {
    if (zoom <= 1 || mode !== 'normal') setPan((p) => (p.x || p.y ? { x: 0, y: 0 } : p));
  }, [zoom, mode]);

  // ── Edit mode (Normal only): drive window.EditMode on/off. init() once wires its
  // listeners + UI; setOn() toggles its selection overlay + comment pins. It owns
  // the bridge POST and pin rendering — we just turn it on/off with the rail's
  // Edit button (its built-in ✎ FAB and `e` key stay in sync via isOn()).
  const emInited = useRef(false);
  useEffect(() => {
    if (!editReady || !window.EditMode) return;
    if (!emInited.current) {
      window.EditMode.init({ bridge: 'http://localhost:8930' });
      emInited.current = true;
    }
    window.EditMode.setOn?.(mode === 'normal' && editOn);
  }, [editReady, editOn, mode]);

  // leaving normal mode drops edit mode + grid; presenting also hides the edit-mode
  // UI entirely (publish mode) so its FAB/overlay never shows over the slide.
  useEffect(() => {
    if (mode !== 'normal') { setEditOn(false); setGridOpen(false); }
    if (window.EditMode) window.EditMode.setPublishMode?.(mode === 'present');
  }, [mode]);

  // ephemeral ink: wipe drawings whenever the slide changes
  useEffect(() => { clearInk(); }, [current, clearInk]);

  // ── Export/automation bridge. The export driver (scripts/lib/deck-driver.mjs)
  // drives the deck headlessly: it reads the slide count and steps through slides
  // here instead of guessing from DOM chrome (which changes with the UI). It also
  // adds .deck-export to <html> so the stage drops its Normal-mode inset and fills
  // the frame after chrome is stripped — capture geometry stays exact.
  useEffect(() => {
    window.__DECK = {
      total: SLIDES.length,
      get current() { return current; },
      goTo,
      next, prev,
      // Headless present toggle for the PPTX/PDF/image exporters and the review
      // shooter: switch to presentation mode (slide content ONLY — no rail / topbar /
      // grid) WITHOUT requesting OS fullscreen (which can't run headless). Every
      // pixel-capture path drives this so source renders and exports line up 1:1.
      setPresent: (on) => setMode(on ? 'present' : 'normal'),
    };
  }, [current, goTo, next, prev]);

  // ── Present-mode enter/exit. enter() requests OS fullscreen (browser-fill
  // fallback if denied — CSS .deck-present handles either). exit() leaves both.
  const enterPresent = useCallback(async () => {
    setMode('present');
    await fs.enter();
  }, [fs]);
  const exitPresent = useCallback(async () => {
    await fs.exit();
    setMode('normal');
    setPresentTool(null);
  }, [fs]);

  // If the user exits OS fullscreen directly (Esc/F11) while we actually entered
  // it, drop back to normal so the UI matches. wasFullscreen guards the
  // browser-fill fallback case (we were never fullscreen → ignore).
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && fs.wasFullscreen.current) {
        setMode('normal'); setPresentTool(null);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [fs.wasFullscreen]);

  // ── Present-bar reveal: the bar lives in the bottom-LEFT corner and only shows
  // when the cursor is near it (a hot-zone), so it stays out of the audience's way.
  // It hides shortly after the cursor leaves the zone. Start hidden.
  useEffect(() => {
    if (mode !== 'present') { setBarVisible(true); return; }
    setBarVisible(false);
    const HOT_W = 360;  // px from the left edge
    const HOT_H = 220;  // px from the bottom edge
    const onMove = (e) => {
      const inZone = e.clientX <= HOT_W && e.clientY >= window.innerHeight - HOT_H;
      if (inZone) {
        setBarVisible(true);
        clearTimeout(barTimer.current);
      } else {
        clearTimeout(barTimer.current);
        barTimer.current = setTimeout(() => setBarVisible(false), 600);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mousemove', onMove); clearTimeout(barTimer.current); };
  }, [mode]);

  const onZoom = useCallback((z) => setZoom(Math.max(0.25, Math.min(3, z))), []);
  const onFit = useCallback(() => setZoom(1), []);

  // clamp a pan offset (for a given zoom) so the zoomed slide can't be dragged
  // completely past the stage edges (keeps the slide covering the visible area).
  const clampPanFor = useCallback((z, x, y) => {
    const el = stageRef.current;
    if (!el) return { x, y };
    const r = el.getBoundingClientRect();
    const sw = 1280 * fitScaleRef.current * z;
    const sh = 720 * fitScaleRef.current * z;
    // max travel from center = half the overflow on each axis (0 if slide ≤ stage)
    const maxX = Math.max(0, (sw - r.width) / 2);
    const maxY = Math.max(0, (sh - r.height) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);
  const clampPan = useCallback((x, y) => clampPanFor(zoom, x, y), [zoom, clampPanFor]);

  // ── Wheel: Ctrl/⌘+wheel (and trackpad pinch) ZOOMS the slide, not the browser
  // page. A plain two-finger scroll PANS the slide when zoomed in. We preventDefault
  // both (non-passive listener) so the page never zooms/scrolls under us. Normal mode
  // only; bound on the stage so the rail/grid scroll normally.
  useEffect(() => {
    if (mode !== 'normal') return;
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // zoom anchored at the CURSOR: the slide point under the mouse stays put.
        // The slide's visual center is at stageCenter + pan; the cursor sits at
        // offset d from that center. When scale grows by `factor`, d grows by
        // `factor`, so shift pan by -d*(factor-1) to pin the cursor's point.
        const r = el.getBoundingClientRect();
        setZoom((z) => {
          const next = Math.max(0.25, Math.min(3, z * Math.exp(-e.deltaY * 0.01)));
          const factor = next / z;                       // actual applied factor (after clamp)
          setPan((p) => {
            const cx = e.clientX - (r.left + r.width / 2) - p.x;   // cursor offset from slide center
            const cy = e.clientY - (r.top + r.height / 2) - p.y;
            return clampPanFor(next, p.x - cx * (factor - 1), p.y - cy * (factor - 1));
          });
          return next;
        });
      } else if (zoom > 1) {
        // plain two-finger scroll → pan the zoomed slide
        e.preventDefault();
        setPan((p) => clampPan(p.x - e.deltaX, p.y - e.deltaY));
      }
      // else: at fit, plain scroll does nothing on the slide (rail/grid handle their own)
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode, zoom, clampPan, clampPanFor]);

  // ── Mouse drag to pan when zoomed in (and not in edit mode, which owns dragging).
  useEffect(() => {
    if (mode !== 'normal' || zoom <= 1 || editOn) return;
    const el = stageRef.current;
    if (!el) return;
    let dragging = false, sx = 0, sy = 0, startPan = { x: 0, y: 0 };
    const down = (e) => {
      if (e.button !== 0) return;
      dragging = true; sx = e.clientX; sy = e.clientY; startPan = pan;
      el.style.cursor = 'grabbing';
    };
    const move = (e) => {
      if (!dragging) return;
      setPan(clampPan(startPan.x + (e.clientX - sx), startPan.y + (e.clientY - sy)));
    };
    const up = () => { dragging = false; el.style.cursor = 'grab'; };
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      el.style.cursor = '';
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [mode, zoom, editOn, pan, clampPan]);

  // ── Keyboard. Slide nav everywhere; mode + tool shortcuts contextual.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey) { const i = +e.key - 1; if (i < SLIDES.length) goTo(i); }
      else if (e.key === 'F5') { e.preventDefault(); mode === 'present' ? exitPresent() : enterPresent(); }
      else if (e.key === 'Escape') {
        if (mode === 'present') exitPresent();
        else if (gridOpen) setGridOpen(false);
        else if (editOn) setEditOn(false);
      }
      // present tools (active in present mode)
      else if (mode === 'present' && (e.key === 'l' || e.key === 'L')) setPresentTool((t) => (t === 'laser' ? null : 'laser'));
      else if (mode === 'present' && (e.key === 'p' || e.key === 'P')) setPresentTool((t) => (t === 'pen' ? null : 'pen'));
      else if (mode === 'present' && (e.key === 'h' || e.key === 'H')) setPresentTool((t) => (t === 'highlight' ? null : 'highlight'));
      else if (mode === 'present' && (e.key === 'c' || e.key === 'C')) clearInk();
      // normal-mode toggles
      else if (mode === 'normal' && (e.key === 'e' || e.key === 'E')) setEditOn((v) => !v);
      else if (mode === 'normal' && (e.key === 'g' || e.key === 'G')) setGridOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goTo, clearInk, mode, gridOpen, editOn, enterPresent, exitPresent]);

  if (!SLIDES.length) {
    return <div className="deck-stage"><p className="text-text-muted">No slides yet</p></div>;
  }
  const Current = SLIDES[current];
  const nav = NAV_ITEMS[current] || {};
  const label = nav.label || `Slide ${current + 1}`;
  const isPresent = mode === 'present';
  const fx = TRANSITIONS[transition] || TRANSITIONS[DEFAULT_TRANSITION];  // active present transition

  // Stage box: full viewport in present; in normal mode it's inset by the
  // rail/topbar/notes. The slide is centered within whatever area remains.
  const stageStyle = isPresent
    ? { position: 'fixed', inset: 0 }
    : {
        position: 'fixed',
        top: TOPBAR_H, left: RAIL_W, right: 0,
        bottom: notesOpen ? NOTES_H : 0,
      };

  return (
    <div className={isPresent ? 'deck-present' : 'deck-normal'}>
      {/* ── chrome: Normal mode only ───────────────────────────────────────── */}
      {!isPresent && (
        <>
          <TopBar
            deckName={PRESENTATION_NAME}
            current={current} total={SLIDES.length}
            gridOpen={gridOpen} onToggleGrid={() => setGridOpen((v) => !v)}
            notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((v) => !v)}
            zoom={zoom} onZoom={onZoom} onFit={onFit}
            transition={transition} onSetTransition={setTransition}
            onPresent={enterPresent}
            onToast={setToast}
          />
          <SlideRail
            slides={SLIDES} navItems={NAV_ITEMS}
            current={current} onGoTo={goTo}
            editOn={editOn} onToggleEdit={() => setEditOn((v) => !v)}
          />
          {notesOpen && <NotesPanel notes={nav.notes} label={label} />}
          {gridOpen && (
            <GridView
              slides={SLIDES} navItems={NAV_ITEMS} current={current}
              onPick={(i) => { goTo(i); setGridOpen(false); }}
            />
          )}
        </>
      )}

      {/* ── stage: the scaled slide canvas (both modes). The slide-change transition
            runs ONLY in Present mode; Normal mode (authoring) switches instantly so
            navigating/editing feels snappy. ──────────────────────────────────── */}
      <div ref={stageRef} className="deck-stage" style={stageStyle}>
        <div ref={scalerRef} className="deck-scaler">
          {/* Present mode runs the chosen transition (slides overlap via mode="sync"
              → no dark gap). Normal mode switches instantly (duration 0). */}
          <AnimatePresence initial={false} custom={direction} mode={isPresent ? 'sync' : 'wait'}>
            <motion.div
              key={current}
              custom={direction}
              variants={isPresent ? fx.variants : undefined}
              initial={isPresent ? 'enter' : false}
              animate={isPresent ? 'center' : { opacity: 1 }}
              exit={isPresent ? 'exit' : { opacity: 1 }}
              transition={isPresent ? fx.transition : { duration: 0 }}
              className="absolute inset-0"
              data-slide-active
              data-slide-index={current}
              data-slide-label={label}
            >
              <Background />
              <Current />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── present overlays: present mode only ────────────────────────────── */}
      {isPresent && (
        <>
          <PresentMode tool={presentTool} clearSignal={clearSignal} />
          <PresentBar
            current={current} total={SLIDES.length}
            onPrev={prev} onNext={next}
            tool={presentTool} onSetTool={setPresentTool} onClearInk={clearInk}
            onExit={exitPresent} visible={barVisible}
          />
        </>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
