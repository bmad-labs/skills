import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { createPortal } from 'react-dom';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;   // the deck stage caps at 3; a diagram lightbox needs more —
                      // 9px PlantUML labels want 3-4x on top of the fit scale.
const PAD = 48;       // viewport inset around the fitted image
const CHROME_H = 72;  // bottom strip reserved for the zoom % + hint
const ZOOM_SPEED = 0.0015;  // per wheel delta unit. The deck stage uses 0.01, tuned
                            // for its own deltas; a trackpad emits deltaY in the
                            // hundreds, which saturated the cap in one flick.

/**
 * A diagram on a slide.
 *
 * INLINE: fits its container — never clipped, never distorted. The slide canvas is
 * itself scaled ~0.95x by App's fit transform and the diagram row is only ~487px
 * tall, so a tall diagram is height-bound and lands under natural size. That is
 * unavoidable at 1280x720; reading fine detail is the overlay's job.
 * Inline = orientation, overlay = reading.
 *
 * OVERLAY: click (or Enter/Space) opens a full-viewport lightbox with wheel-zoom
 * anchored at the cursor, drag-to-pan, and keyboard controls. The interaction model
 * mirrors App.jsx's stage zoom (clampPanFor / cursor-anchored wheel) so the deck
 * feels consistent. One deliberate difference: PLAIN wheel zooms here, with no
 * ctrl/cmd modifier, because a lightbox has nothing else to scroll.
 *
 * The overlay renders through a PORTAL onto document.body. The slide canvas is
 * CSS-transformed to fit the viewport, and a transformed ancestor makes
 * `position: fixed` resolve against that ancestor rather than the viewport — so an
 * in-tree overlay would be scaled down with the slide and mis-target clicks.
 *
 * Exports are unaffected: PDF/PPTX capture the slide with no interaction, so the
 * overlay is never open when a screenshot is taken.
 */
export default function Diagram({ src, alt, id, className = '' }) {
  const [zoomed, setZoomed] = useState(false);

  const open = (e) => { e.stopPropagation(); setZoomed(true); };
  const onKeyOpen = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopPropagation(); setZoomed(true);
    }
  };

  return (
    <>
      <div className={`flex items-center justify-center w-full h-full min-h-0 ${className}`}>
        <img
          src={src}
          alt={alt}
          data-viz-id={id}
          data-diagram-img=""
          onClick={open}
          onKeyDown={onKeyOpen}
          role="button"
          tabIndex={0}
          title="Click to enlarge"
          className="max-w-full max-h-full w-auto h-auto object-contain cursor-zoom-in
                     transition-opacity duration-200 hover:opacity-90"
        />
      </div>
      {zoomed && typeof document !== 'undefined' && createPortal(
        <Lightbox src={src} alt={alt} id={id} onClose={() => setZoomed(false)} />,
        document.body,
      )}
    </>
  );
}

/**
 * The zoom overlay. A separate component so every hook mounts and unmounts with the
 * overlay — state resets cleanly on each open, and nothing listens while it is closed.
 */
function Lightbox({ src, alt, id, onClose }) {
  const [nat, setNat] = useState(null);          // natural size, once loaded
  const [zoom, setZoom] = useState(1);           // 1 = fit
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [, bump] = useReducer((n) => n + 1, 0);  // re-render on resize

  const rootRef = useRef(null);
  const fitRef = useRef(1);
  const panRef = useRef(pan);
  panRef.current = pan;

  // Fit = the largest scale at which the natural-size image fits the viewport, minus
  // PAD and the bottom chrome strip. zoom === 1 means fit; zoom multiplies it — the
  // same baseline convention the deck stage uses.
  useEffect(() => {
    const recompute = () => {
      if (nat) {
        const contain = Math.min(
          (window.innerWidth - PAD * 2) / nat.w,
          (window.innerHeight - PAD * 2 - CHROME_H) / nat.h,
        );
        // Open rule: an image SMALLER than the screen shows at its natural size
        // (never blown up and blurry); an image BIGGER than the screen is scaled
        // down to fit whole on screen (never clipped). Zooming in from there is the
        // user's choice, so cap the opening scale at 1:1.
        fitRef.current = Math.min(1, contain);
      }
      bump();
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [nat]);

  // Clamp pan so the image cannot be dragged off-screen. Lifted from App.jsx's
  // clampPanFor: max travel from center = half the overflow on each axis, and 0 when
  // the image is smaller than the viewport (so it stays centered).
  const clampPanFor = useCallback((z, x, y) => {
    if (!nat) return { x, y };
    const sw = nat.w * fitRef.current * z;
    const sh = nat.h * fitRef.current * z;
    const maxX = Math.max(0, (sw - window.innerWidth) / 2);
    const maxY = Math.max(0, (sh - (window.innerHeight - CHROME_H)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [nat]);

  const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  // Wheel: plain wheel zooms (no modifier — nothing else scrolls in a lightbox).
  // Ctrl/cmd+wheel zooms too, which is what a trackpad pinch emits. Anchored at the
  // cursor: the image point under the mouse stays put. The image centre sits at
  // viewportCentre + pan; the cursor is at offset d from it; when scale grows by
  // `factor`, d grows by `factor`, so shift pan by -d*(factor-1) to pin that point.
  // Non-passive so the browser never zooms the page under us.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const cx = window.innerWidth / 2;
      const cy = (window.innerHeight - CHROME_H) / 2;
      setZoom((z) => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * Math.exp(-e.deltaY * ZOOM_SPEED)));
        const factor = next / z;
        setPan((p) => {
          const dx = e.clientX - cx - p.x;
          const dy = e.clientY - cy - p.y;
          return clampPanFor(next, p.x - dx * (factor - 1), p.y - dy * (factor - 1));
        });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampPanFor]);

  // Drag to pan. Pointer Events + setPointerCapture cover mouse, trackpad and touch
  // in one path and keep the drag alive past the viewport edge. `moved` gates the
  // close-on-click below: a drag ending near its origin still fires a click, and
  // without this the overlay would dismiss mid-pan.
  const drag = useRef({ active: false, x: 0, y: 0, start: { x: 0, y: 0 }, moved: false });

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { active: true, x: e.clientX, y: e.clientY, start: panRef.current, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    setPan(clampPanFor(zoom, d.start.x + dx, d.start.y + dy));
  };
  const onPointerUp = (e) => {
    drag.current.active = false;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Close only on a genuine click: not the tail of a drag, and on the backdrop rather
  // than the image — clicking the diagram while inspecting it must never dismiss it.
  const onClick = (e) => {
    if (drag.current.moved) { drag.current.moved = false; return; }
    if (e.target.closest('[data-lightbox-img]')) return;
    onClose();
  };

  // Keyboard, capture phase: the deck listens for Escape/arrows on window, so take the
  // key first and stop it reaching the slide behind the overlay.
  useEffect(() => {
    const onKey = (e) => {
      const stop = () => { e.stopPropagation(); e.preventDefault(); };
      const nudge = (dx, dy) => { stop(); setPan((p) => clampPanFor(zoom, p.x + dx, p.y + dy)); };
      if (e.key === 'Escape') { stop(); onClose(); }
      else if (e.key === '+' || e.key === '=') { stop(); setZoom((z) => Math.min(MAX_ZOOM, z * 1.25)); }
      else if (e.key === '-' || e.key === '_') {
        stop();
        setZoom((z) => {
          const next = Math.max(MIN_ZOOM, z / 1.25);
          setPan((p) => clampPanFor(next, p.x, p.y));
          return next;
        });
      }
      else if (e.key === '0') { stop(); reset(); }
      else if (e.key === 'ArrowRight') nudge(-60, 0);
      else if (e.key === 'ArrowLeft') nudge(60, 0);
      else if (e.key === 'ArrowDown') nudge(0, -60);
      else if (e.key === 'ArrowUp') nudge(0, 60);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, reset, zoom, clampPanFor]);

  const scale = (fitRef.current || 1) * zoom;
  const cursor = dragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'zoom-out');

  // `data-navigation` is what index.css hides under `html.deck-export`. The overlay is
  // never open during a capture today; carrying the attribute makes that structural
  // rather than lucky.
  return (
    <div
      ref={rootRef}
      data-viz-id={`${id}.zoom`}
      data-navigation=""
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed', inset: 0,
        // `.deck-present` is z-index 10, the highest in index.css. Do not lower this
        // below that or the overlay opens BEHIND a presenting slide.
        zIndex: 9999,
        overflow: 'hidden', touchAction: 'none',
        // Theme token, not a hex: the overlay re-skins with the active theme.
        // `color-mix` keeps the slight translucency that reads as "a layer above".
        background: 'color-mix(in srgb, var(--surface-page) 97%, transparent)',
        cursor, userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <img
        data-lightbox-img=""
        data-diagram-img="zoom"
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{
          position: 'absolute',
          top: (window.innerHeight - CHROME_H) / 2,
          left: window.innerWidth / 2,
          width: nat ? nat.w : 'auto',
          height: nat ? nat.h : 'auto',
          // Tailwind Preflight sets `img { max-width: 100%; height: auto }`, which
          // clamped any image wider than the viewport to the viewport BEFORE the
          // transform — an 11861px diagram was squashed to 1512px while keeping its
          // full height, which is the "resizes when I zoom" bug. Override both caps
          // so the intrinsic size we set is the size that is actually used.
          maxWidth: 'none',
          maxHeight: 'none',
          transformOrigin: 'center center',
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          visibility: nat ? 'visible' : 'hidden',
        }}
      />
      <div style={{
        position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '18px', alignItems: 'center',
        fontSize: '13px', color: 'var(--text-muted)', pointerEvents: 'none',
      }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(scale * 100)}%</span>
        <span>Scroll to zoom &middot; drag to pan &middot; 0 to reset &middot; Esc to close</span>
      </div>
    </div>
  );
}
