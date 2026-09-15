import { useEffect, useRef } from 'react';

/*
  Present-mode overlay — Google-Slides-style annotation tools, all EPHEMERAL
  (cleared on slide change or via the bar's clear button):
  - laser:     the OS cursor is hidden and replaced by a soft red dot that IS the
               pointer — it tracks the cursor live (no fade).
  - pen:       a thin opaque red marker line.
  - highlight: a thick translucent yellow band, like a highlighter.
  Sits above the slide, below the bar. Tagged data-navigation so it never appears in
  exports/screenshots. `tool` is 'laser' | 'pen' | 'highlight' | null.

  Why two canvases: a translucent highlighter must apply its alpha to the WHOLE
  stroke, not to each tiny segment — otherwise overlapping segment-ends (especially
  on turns) composite over each other and produce dark cross-hatching. So the live
  stroke is drawn opaque on a scratch canvas (one continuous round-joined path), and
  only flattened onto the committed canvas at the stroke's alpha when the stroke ends.
*/
const STROKE = {
  pen:       { color: 'rgb(216,54,42)',  width: 3,  alpha: 1    },
  highlight: { color: 'rgb(250,190,0)',  width: 22, alpha: 0.34 },
};

export default function PresentMode({ tool, clearSignal }) {
  const inkRef = useRef(null);      // committed strokes
  const liveRef = useRef(null);     // current in-progress stroke (opaque)
  const laserRef = useRef(null);
  const drawing = useRef(false);
  const points = useRef([]);        // current stroke's points

  const isInk = tool === 'pen' || tool === 'highlight';

  // size both canvases to the viewport
  useEffect(() => {
    const resize = () => {
      for (const r of [inkRef, liveRef]) {
        const c = r.current; if (!c) continue;
        c.width = window.innerWidth; c.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // clear ink when the slide changes or the clear button is pressed
  useEffect(() => {
    for (const r of [inkRef, liveRef]) {
      const c = r.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }
  }, [clearSignal]);

  useEffect(() => {
    if (!tool) return;
    const ink = inkRef.current, live = liveRef.current, laser = laserRef.current;
    const ictx = ink.getContext('2d'), lctx = live.getContext('2d');

    const moveLaser = (x, y) => {
      laser.style.left = x + 'px'; laser.style.top = y + 'px'; laser.style.opacity = '1';
    };

    // (re)draw the in-progress stroke as ONE continuous path on the live canvas
    const drawLive = () => {
      const s = STROKE[tool];
      lctx.clearRect(0, 0, live.width, live.height);
      const pts = points.current;
      if (pts.length < 2) return;
      lctx.strokeStyle = s.color;
      lctx.lineWidth = s.width;
      lctx.lineCap = 'round';
      lctx.lineJoin = 'round';
      lctx.beginPath();
      lctx.moveTo(pts[0].x, pts[0].y);
      // quadratic smoothing through midpoints → smooth turns, no facets
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        lctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const lastP = pts[pts.length - 1];
      lctx.lineTo(lastP.x, lastP.y);
      lctx.stroke();
    };

    // flatten the finished live stroke onto the committed canvas at its alpha
    const commit = () => {
      const s = STROKE[tool];
      if (points.current.length) {
        ictx.globalAlpha = s.alpha;
        ictx.drawImage(live, 0, 0);
        ictx.globalAlpha = 1;
      }
      lctx.clearRect(0, 0, live.width, live.height);
      points.current = [];
    };

    const onMove = (e) => {
      if (tool === 'laser') { moveLaser(e.clientX, e.clientY); return; }
      if (isInk && drawing.current) {
        points.current.push({ x: e.clientX, y: e.clientY });
        drawLive();
      }
    };
    const onDown = (e) => {
      if (!isInk) return;
      drawing.current = true;
      points.current = [{ x: e.clientX, y: e.clientY }];
    };
    const onUp = () => { if (drawing.current) { drawing.current = false; commit(); } };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      if (laser) laser.style.opacity = '0';
    };
  }, [tool, isInk]);

  const cursor = tool === 'laser' ? 'none' : isInk ? 'crosshair' : 'default';

  return (
    <div data-navigation aria-hidden="true">
      {/* committed strokes */}
      <canvas ref={inkRef} className="fixed inset-0 z-40" style={{ pointerEvents: 'none' }} />
      {/* live stroke (opaque) + the click/cursor surface while a tool is active */}
      <canvas
        ref={liveRef}
        className="fixed inset-0 z-40"
        style={{
          pointerEvents: tool ? 'auto' : 'none', cursor,
          opacity: tool === 'highlight' ? STROKE.highlight.alpha : 1,  // preview the live highlighter translucent
        }}
      />
      {/* laser dot — the replacement pointer while laser is active */}
      <div
        ref={laserRef}
        className="fixed z-40 pointer-events-none rounded-full"
        style={{
          width: 18, height: 18, marginLeft: -9, marginTop: -9, opacity: 0,
          background: 'radial-gradient(circle, rgba(216,54,42,0.98) 0%, rgba(216,54,42,0.6) 42%, rgba(216,54,42,0) 70%)',
          boxShadow: '0 0 14px 5px rgba(216,54,42,0.5)',
          transition: 'opacity 0.2s ease',
        }}
      />
    </div>
  );
}
