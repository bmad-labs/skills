/* =============================================================================
 * pan-zoom-viewport.js — reusable cursor-anchored pan/zoom for a diagram viewport
 * =============================================================================
 * WHAT THIS IS
 *   A self-contained pan/zoom rig for an inner "content" element inside a clipping
 *   "viewport": wheel (ctrl/⌘ = zoom, else pan), drag-to-pan, two-finger pinch,
 *   and +/−/reset buttons — all with CURSOR-ANCHORED zoom (the point under the
 *   pointer stays fixed). This is high-value, fiddly-to-rederive math.
 *
 *   The source had TWO variants and they differ in ONE thing: how the transform
 *   is written and what coordinate space the deltas live in.
 *     - 'svg'  variant: content is an inner <g> inside an <svg> with a viewBox.
 *              Transform is written as the SVG attribute
 *              `transform="translate(x y) scale(z)"` and pointer deltas are
 *              converted from CSS px → SVG-USER UNITS (multiply by viewBox/box
 *              ratio). Use when the content is SVG and you want crisp vector zoom.
 *     - 'css'  variant: content is a regular DOM block; transform is written as the
 *              CSS `transform: translate(xpx,ypx) scale(z)` and deltas stay in
 *              VIEWPORT PIXELS (no unit conversion). Use for HTML/DOM content
 *              (e.g. an ERD built from <div> tables).
 *   Both share the identical cursor-anchored zoom algebra; only `toUnits()` and
 *   `apply()` differ. They are unified below into one `attachPanZoom(opts)`.
 *
 * DEPENDS ON
 *   - Nothing. Pure DOM. (Pairs with the CSS classes .grabbing / .pl-zoom /
 *     .erd-zoom from styles.css, but those are optional cosmetics.)
 *
 * HOW TO WIRE  (SVG variant — engine pipeline)
 *   attachPanZoom({
 *     mode: 'svg', viewport, pan,            // pan = the inner <g class="pl-pan">
 *     viewBoxW: vbW, viewBoxH: totalH,       // the svg viewBox size
 *     buttons: stage.querySelectorAll('.pl-zoom button'),
 *     min: 0.5, max: 2.6,
 *     skipDragOn: '.pl-step-g.click',        // don't start a drag on clickable nodes
 *   });
 *
 * HOW TO WIRE  (CSS variant — ERD)
 *   attachPanZoom({
 *     mode: 'css', viewport, pan,            // pan = <div class="erd-pan">
 *     buttons: erdBody.querySelectorAll('.erd-zoom button'),
 *     min: 0.4, max: 2.4,
 *   });
 *
 * THE CURSOR-ANCHORED ZOOM MATH (why it works)
 *   A point's content-space coord is  u = (pointer - translate) / zoom.
 *   To keep u fixed while zoom changes to z':  translate' = pointer - u * z'.
 *   That's the whole trick — compute u BEFORE changing z, then solve for the new
 *   translate. `pointer` is in viewport px for 'css', or SVG-user units for 'svg'.
 *
 * GOTCHA
 *   wheel listener MUST be { passive: false } (we preventDefault to stop page
 *   scroll/native zoom). touchmove for pinch likewise. touchstart can stay passive.
 * ========================================================================== */

export function attachPanZoom(opts) {
  const {
    mode = 'css',           // 'svg' | 'css'
    viewport, pan,
    viewBoxW = 0, viewBoxH = 0,
    min = 0.4, max = 2.6,
    buttons = [],
    skipDragOn = null,      // CSS selector: pointerdown on a match won't start a drag
    wheelZoomSpeed = 0.004, // exp(-deltaY * speed) per wheel tick when zooming
  } = opts;
  if (!viewport || !pan) return;

  const view = { z: 1, x: 0, y: 0 };

  // --- apply the transform (the ONE place the two variants diverge in output) ---
  const apply = mode === 'svg'
    ? () => pan.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.z})`)
    : () => { pan.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`; };

  // --- map a client point into the content's "pointer space" ---
  //   svg: convert CSS px → SVG-user units via the viewBox/box ratio
  //   css: pointer space IS viewport px (just offset by the viewport origin)
  const toPointer = mode === 'svg'
    ? (clientX, clientY) => {
        const r = viewport.getBoundingClientRect();
        return { px: (clientX - r.left) * (viewBoxW / r.width), py: (clientY - r.top) * (viewBoxH / r.height) };
      }
    : (clientX, clientY) => {
        const r = viewport.getBoundingClientRect();
        return { px: clientX - r.left, py: clientY - r.top };
      };

  // --- cursor-anchored zoom: keep the point under the pointer fixed ---
  const zoomAt = (clientX, clientY, factor) => {
    const nz = Math.max(min, Math.min(max, view.z * factor));
    if (nz === view.z) return;
    const { px, py } = toPointer(clientX, clientY);
    const u = (px - view.x) / view.z, v = (py - view.y) / view.z;   // content coord under pointer
    view.z = nz;
    view.x = px - u * nz; view.y = py - v * nz;                     // solve new translate
    apply();
  };

  // --- pan delta in pointer space (svg needs the px→unit ratio; css does not) ---
  const panDelta = mode === 'svg'
    ? (dx, dy) => {
        const r = viewport.getBoundingClientRect();
        view.x += dx * (viewBoxW / r.width); view.y += dy * (viewBoxH / r.height);
      }
    : (dx, dy) => { view.x += dx; view.y += dy; };

  apply();

  // --- wheel: ctrl/⌘ (or trackpad pinch, which arrives as ctrl+wheel) ⇒ zoom; else pan ---
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * wheelZoomSpeed));
    else { panDelta(-e.deltaX, -e.deltaY); apply(); }
  }, { passive: false });

  // --- drag to pan (mouse / single finger). For 'css' the drag math is identical;
  //     for 'svg' we re-derive the px→unit ratio at move time (box can resize). ---
  let drag = null;
  const down = (cx, cy) => { drag = { cx, cy, x: view.x, y: view.y }; viewport.classList.add('grabbing'); };
  const move = (cx, cy) => {
    if (!drag) return;
    if (mode === 'svg') {
      const r = viewport.getBoundingClientRect();
      const sx = viewBoxW / r.width, sy = viewBoxH / r.height;
      view.x = drag.x + (cx - drag.cx) * sx; view.y = drag.y + (cy - drag.cy) * sy;
    } else {
      view.x = drag.x + (cx - drag.cx); view.y = drag.y + (cy - drag.cy);
    }
    apply();
  };
  const up = () => { drag = null; viewport.classList.remove('grabbing'); };

  viewport.addEventListener('mousedown', (e) => {
    if (skipDragOn && e.target.closest(skipDragOn)) return;   // let clickable nodes click
    e.preventDefault(); down(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', up);

  // --- touch: 1-finger pan, 2-finger pinch zoom (anchored at the pinch midpoint) ---
  let pinch = null;
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      drag = null;
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      const [a, b] = e.touches;
      const nd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, nd / pinch.d);
      pinch.d = nd;
    } else if (e.touches.length === 1 && drag) {
      move(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  viewport.addEventListener('touchend', () => { up(); pinch = null; });

  // --- buttons: zoom about the viewport centre / reset to identity ---
  buttons.forEach((b) => b.addEventListener('click', () => {
    const r = viewport.getBoundingClientRect();
    if (b.dataset.z === 'in') zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25);
    else if (b.dataset.z === 'out') zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8);
    else { view.z = 1; view.x = 0; view.y = 0; apply(); }
  }));

  // expose the view so callers can reset / read zoom if needed
  return { view, reset: () => { view.z = 1; view.x = 0; view.y = 0; apply(); }, apply };
}
