/* ============================================================================
   svg-to-custgeom.mjs — convert an inline SVG icon (lucide / Material / Font
   Awesome / any set) into pptxgenjs-jsx CustomGeometry nodes: native, RECOLORABLE
   vector shapes in the exported PPTX (not a flat raster).

   Set-agnostic: it reads the icon's *computed* fill/stroke (measured in the page),
   not the library name. Filled child (Material/FA) → filled CustomGeometry; stroke
   child with fill:none (lucide) → open path stroked via `line` (PowerPoint strokes
   open paths). Arcs/smooth-curves are normalised to cubics by `svgpath` so we never
   emit pptx `arcTo`.

   INPUT — `icon` is serialised in the page by export-pptx-jsx.mjs:
     { viewBox: [minX, minY, vbW, vbH],
       children: [ { d, fill, stroke, strokeWidth }, … ] }   // d already normalised to a path string
   `chipBox` is the measured {x,y,w,h} (inches) of the element holding the svg.

   OUTPUT — an array of `h(CustomGeometry, props)` nodes to spread into the slide.
   ============================================================================ */

import svgpathFactory from 'svgpath';
const svgpath = svgpathFactory.default || svgpathFactory;

const isNone = (v) => !v || v === 'none' || v === 'transparent';
// computed color "rgb(r,g,b)" / "rgba(...)" → "RRGGBB" (or null if none/transparent)
function toHex(c) {
  if (isNone(c)) return null;
  const m = c.match(/-?\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  if (m.length >= 4 && parseFloat(m[3]) === 0) return null; // fully transparent
  return m.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(+v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * @param {{viewBox:number[], children:Array}} icon
 * @param {{x:number,y:number,w:number,h:number}} chipBox  inches
 * @param {Function} h                AK.h (createElement)
 * @param {{CustomGeometry:Function}} AK
 * @param {{iconFrac?:number}} [opts] icon size as a fraction of the chip's shorter side (default ~0.5)
 * @returns {Array} CustomGeometry nodes
 */
export function svgToCustomGeometryNodes(icon, chipBox, h, AK, opts = {}) {
  const { CustomGeometry } = AK;
  if (!icon || !Array.isArray(icon.children) || !icon.children.length) return [];
  const [minX, minY, vbW, vbH] = icon.viewBox && icon.viewBox.length === 4 ? icon.viewBox : [0, 0, 24, 24];
  if (!(vbW > 0) || !(vbH > 0)) return [];

  // Centre the icon in the chip at iconFrac of the shorter side, preserving aspect.
  const frac = opts.iconFrac ?? 0.5;
  const iconIn = Math.min(chipBox.w, chipBox.h) * frac;
  const scale = iconIn / Math.max(vbW, vbH);          // inches per SVG user unit
  const drawW = vbW * scale, drawH = vbH * scale;
  const x0 = chipBox.x + (chipBox.w - drawW) / 2;
  const y0 = chipBox.y + (chipBox.h - drawH) / 2;
  // local inches inside the CustomGeometry box (origin at the icon's top-left)
  const lx = (px) => (px - minX) * scale;
  const ly = (py) => (py - minY) * scale;

  const nodes = [];
  for (const child of icon.children) {
    if (!child || !child.d) continue;
    let segs;
    try {
      segs = [];
      svgpath(child.d).abs().unshort().unarc().iterate((s) => segs.push(s));
    } catch (_) { continue; }            // un-parseable child → skip (export still works)
    if (!segs.length) continue;

    // Track the current point so H/V (which svgpath.abs() keeps as 1-coord commands,
    // does NOT expand to L) convert correctly — dropping them was the cylinder-mangling bug.
    const points = [];
    let cx = 0, cy = 0, startX = 0, startY = 0;
    for (const s of segs) {
      const cmd = s[0];
      if (cmd === 'M') { cx = s[1]; cy = s[2]; startX = cx; startY = cy; points.push({ x: lx(cx), y: ly(cy), moveTo: true }); }
      else if (cmd === 'L') { cx = s[1]; cy = s[2]; points.push({ x: lx(cx), y: ly(cy) }); }
      else if (cmd === 'H') { cx = s[1]; points.push({ x: lx(cx), y: ly(cy) }); }
      else if (cmd === 'V') { cy = s[1]; points.push({ x: lx(cx), y: ly(cy) }); }
      else if (cmd === 'C') { points.push({ x: lx(s[5]), y: ly(s[6]), curve: { type: 'cubic', x1: lx(s[1]), y1: ly(s[2]), x2: lx(s[3]), y2: ly(s[4]) } }); cx = s[5]; cy = s[6]; }
      else if (cmd === 'Q') { points.push({ x: lx(s[3]), y: ly(s[4]), curve: { type: 'quadratic', x1: lx(s[1]), y1: ly(s[2]) } }); cx = s[3]; cy = s[4]; }
      else if (cmd === 'Z' || cmd === 'z') { points.push({ close: true }); cx = startX; cy = startY; }
    }
    if (!points.length) continue;

    // Render intent from COMPUTED style, not the icon set.
    const fillHex = toHex(child.fill);
    const strokeHex = toHex(child.stroke);
    const props = { x: x0, y: y0, w: drawW, h: drawH, points };
    if (fillHex) {
      props.fill = { color: fillHex };
      if (strokeHex) props.line = { color: strokeHex, width: ptOf(child.strokeWidth, scale) };
      else props.line = { type: 'none' };
    } else if (strokeHex) {
      props.fill = { type: 'none' };
      props.line = { color: strokeHex, width: ptOf(child.strokeWidth, scale) };
    } else {
      continue;                          // nothing visible
    }
    nodes.push(h(CustomGeometry, props));
  }
  return nodes;
}

// stroke width in SVG user units → points (constant outline, NOT scaled by the box)
function ptOf(strokeWidthUserUnits, scale) {
  const sw = parseFloat(strokeWidthUserUnits);
  const units = isFinite(sw) && sw > 0 ? sw : 2;       // lucide default 2
  return Math.max(0.25, units * scale * 72);
}

// Mark which SVG features we can't vectorise — caller rasterises these instead.
export const COMPLEX_SVG_RE = /<(linearGradient|radialGradient|mask|clipPath|use|image|filter|pattern)\b/i;
