/* ============================================================================
   dom-walk.browser.js — BROWSER-SIDE slide measurement + serialization.

   Injected into the page (via addScriptTag) by export-pptx-jsx.mjs, this defines
   window.__mtiWalk(): it measures the active slide's DOM and returns a typed
   { layout, ops } array that the Node side turns into pptxgenjs nodes. Runs in the
   browser only — no Node imports, no outer-scope closures. Mirrors the IIFE-inject
   pattern the exporter already uses for the pptxgenjs-jsx bundle.

   The op kinds it emits: rect | rule | text | icon | graphic | table.
   ============================================================================ */
(function () {
  'use strict';
  window.__mtiWalk = async () => {
      const AK = window.ArtifactKitPptxGenJsx;
      if (!AK) throw new Error('ArtifactKitPptxGenJsx global not found after IIFE inject');
      const { readSlideLayout } = AK;
      await AK.measureArtifacts({ document });

      // Serialise an inline <svg> icon → { viewBox, children:[{d,fill,stroke,strokeWidth}], complex }.
      // Every drawable child (path/circle/line/polyline/polygon/rect) is normalised to a
      // path `d` string so the Node-side converter runs one uniform pipeline. Computed
      // fill/stroke are read here so `currentColor` is resolved.
      const COMPLEX = /<(linearGradient|radialGradient|mask|clipPath|use|image|filter|pattern)\b/i;
      const num = (el, a, d = 0) => { const v = parseFloat(el.getAttribute(a)); return isFinite(v) ? v : d; };
      const childToD = (n) => {
        const t = n.tagName.toLowerCase();
        if (t === 'path') return n.getAttribute('d') || '';
        if (t === 'line') return `M${num(n,'x1')} ${num(n,'y1')} L${num(n,'x2')} ${num(n,'y2')}`;
        if (t === 'polyline' || t === 'polygon') {
          const pts = (n.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
          if (pts.length < 4) return '';
          let d = `M${pts[0]} ${pts[1]}`; for (let i = 2; i < pts.length; i += 2) d += ` L${pts[i]} ${pts[i+1]}`;
          return d + (t === 'polygon' ? ' Z' : '');
        }
        if (t === 'circle' || t === 'ellipse') {
          const cx = num(n,'cx'), cy = num(n,'cy'), rx = t==='circle'?num(n,'r'):num(n,'rx'), ry = t==='circle'?num(n,'r'):num(n,'ry');
          if (!(rx>0)||!(ry>0)) return '';
          return `M${cx-rx} ${cy} a${rx} ${ry} 0 1 0 ${2*rx} 0 a${rx} ${ry} 0 1 0 ${-2*rx} 0 Z`;
        }
        if (t === 'rect') {
          const x=num(n,'x'),y=num(n,'y'),w=num(n,'width'),hh=num(n,'height');
          if (!(w>0)||!(hh>0)) return '';
          return `M${x} ${y} L${x+w} ${y} L${x+w} ${y+hh} L${x} ${y+hh} Z`;
        }
        return '';
      };
      const serializeIcon = (host) => {
        const svg = host.querySelector('svg'); if (!svg) return null;
        if (COMPLEX.test(svg.outerHTML)) return { complex: true };
        const vb = (svg.getAttribute('viewBox') || '0 0 24 24').trim().split(/[\s,]+/).map(Number);
        const children = [];
        svg.querySelectorAll('path,circle,ellipse,line,polyline,polygon,rect').forEach((n) => {
          const d = childToD(n); if (!d) return;
          const cs = getComputedStyle(n);
          children.push({ d, fill: cs.fill, stroke: cs.stroke, strokeWidth: cs.strokeWidth });
        });
        return children.length ? { viewBox: vb, children } : null;
      };

      const root = document.querySelector('[data-ak-slide]');
      const rootRect = root.getBoundingClientRect();
      const scaleX = rootRect.width / 1280, scaleY = rootRect.height / 720;  // CSS scale → source px
      const PXIN = 96;
      // box in PPT inches from a live element rect (compensating for the deck's CSS scale)
      const boxOf = (el) => {
        const r = el.getBoundingClientRect();
        const w = (r.width / scaleX) / PXIN, hh = (r.height / scaleY) / PXIN;
        if (!(w > 0) || !(hh > 0)) return null;
        return { x: ((r.left - rootRect.left) / scaleX) / PXIN, y: ((r.top - rootRect.top) / scaleY) / PXIN, w, h: hh };
      };
      const rgbHex = (c) => { const m = (c || '').match(/-?\d+(\.\d+)?/g); if (!m || m.length < 3) return null; if (m.length >= 4 && parseFloat(m[3]) === 0) return null; return m.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(+v))).toString(16).padStart(2, '0')).join('').toUpperCase(); };
      const directText = (el) => { let s = ''; el.childNodes.forEach((n) => { if (n.nodeType === 3) s += n.textContent; }); return s.trim(); };

      // ── named browser-side constants (kept in-page — can't cross the evaluate
      //    boundary, so they're declared here rather than reusing Node-side ones) ──
      const BORDER_W_FRAC = 0.75;        // CSS px border → pt (×0.75) for the line width
      const TEXT_INK = '221815';         // default text colour when none measured
      const FONT_FALLBACK_PX = 16;       // px when fontSize can't be parsed
      const DEFAULT_LH_FRAC = 1.2;       // line-height fallback = 1.2 × font-size
      const GLYPH_W_FRAC = 0.5;          // rough average glyph width (× font-size) for wrap test
      const BIG_FONT_PX = 40;            // "big number" threshold
      const TIGHT_LEADING_FRAC = 1.12;   // line-height ≤ 1.12×fs counts as tight leading
      const TALL_BOX_FRAC = 1.4;         // box taller than 1.4×line → flex-baselined, bottom-anchor
      const SINGLE_LINE_FRAC = 1.6;      // box ≤ 1.6×line tall → source rendered on one line
      const BIG_NUM_DROP_FRAC = 0.13;    // nudge tight big numbers down 13% of font-size
      const WRAP_BUFFER_FRAC = 0.12;     // single-line width buffer = 12% of box width
      const WRAP_BUFFER_MIN = 0.12;      // …clamped to [0.12, 0.6] inches
      const WRAP_BUFFER_MAX = 0.6;
      const BOLD_MIN_WEIGHT = 600;       // font-weight ≥ 600 → bold in PPTX (only 400/700 exist)
      const MAX_WALK_DEPTH = 24;         // recursion guard
      const ICON_MAX_IN = 1.4;           // an <svg> smaller than this (both dims) is an icon, not a chart
      const RULE_MAX_H_IN = 0.12;        // a bg element this thin (and wide enough) is a rule
      const RULE_MIN_W_IN = 0.2;

      // surfaceOf — the fill + border-line + corner-radius of an element's box, the
      // op shape that the icon-chip / container / text-bg branches all need. Returns
      // null fill when there's no visible background. (Dedupes the 5× repeat — G5.)
      const surfaceOf = (cs, box) => {
        const fill = rgbHex(cs.backgroundColor);
        const borderC = rgbHex(cs.borderTopColor);
        const borderW = parseFloat(cs.borderTopWidth) || 0;
        const line = borderC && borderW
          ? { color: borderC, width: Math.max(0.5, borderW * BORDER_W_FRAC) }
          : { type: 'none' };
        return { fill, line, radius: radiusFrac(cs, box), hasBorder: !!(borderC && borderW) };
      };

      // collectColorRuns — split a text leaf into coloured/bold runs so an inline
      // accent <span> keeps its colour. Returns { runs, baseColor, multiColor };
      // runs is null-worthy when the whole leaf is one colour (caller collapses it).
      const collectColorRuns = (el, cs) => {
        const baseColor = rgbHex(cs.color) || TEXT_INK;
        const ttOf = (s) => s === 'uppercase' ? (x) => x.toUpperCase()
          : s === 'lowercase' ? (x) => x.toLowerCase()
          : s === 'capitalize' ? (x) => x.replace(/\b\w/g, (m) => m.toUpperCase()) : (x) => x;
        const runs = [];
        const collect = (node, inherited) => {
          node.childNodes.forEach((n) => {
            if (n.nodeType === 3) {
              const t = ttOf(inherited.tt)(n.textContent);
              if (t) runs.push({ text: t, color: inherited.color, bold: inherited.bold });
            } else if (n.nodeType === 1 && n.tagName !== 'SVG' && n.tagName !== 'svg') {
              const ncs = getComputedStyle(n);
              collect(n, {
                color: rgbHex(ncs.color) || inherited.color,
                bold: parseInt(ncs.fontWeight, 10) >= BOLD_MIN_WEIGHT,
                tt: ncs.textTransform && ncs.textTransform !== 'none' ? ncs.textTransform : inherited.tt,
              });
            }
          });
        };
        collect(el, { color: baseColor, bold: parseInt(cs.fontWeight, 10) >= BOLD_MIN_WEIGHT, tt: cs.textTransform });
        return { runs, baseColor, multiColor: runs.some((r) => r.color !== baseColor) };
      };

      // analyzeTextBox — the renderer-disagreement heuristics for a text leaf:
      // vertical anchor + an optional box nudge so big single-line numbers and
      // single-line strings land where the browser drew them. Returns
      // { valign, tbox, srcSingleLine }.
      const analyzeTextBox = (box, fs, lh, willWrap, txt) => {
        const boxPxH = box.h * PXIN;
        const oneLineH = (isFinite(lh) ? lh : fs * DEFAULT_LH_FRAC);
        // Big single-line numbers ride HIGH in LibreOffice vs Chromium (the box is
        // much taller than the line, or large+tight leading); BOTTOM-anchor matches
        // the source baseline. Normal/wrapping text stays TOP.
        const tightLeading = isFinite(lh) && lh <= fs * TIGHT_LEADING_FRAC;
        const big = fs >= BIG_FONT_PX;
        const tallBox = boxPxH > oneLineH * TALL_BOX_FRAC;
        const valign = (!willWrap && (tallBox || (big && tightLeading))) ? 'bottom' : 'top';
        // A big leading-none number in a box AS TIGHT as the line renders ~13% too
        // HIGH in LibreOffice (it drops the descender space Chromium keeps) — nudge
        // it down. Roomy-box numbers already handled by valign:bottom; don't double.
        let tbox = box;
        if (big && tightLeading && !willWrap && !tallBox) {
          tbox = { ...box, y: box.y + (fs * BIG_NUM_DROP_FRAC) / PXIN };
        }
        // Measured height is ground truth for line count: ~one line tall → single-line.
        return { valign, tbox, srcSingleLine: boxPxH <= oneLineH * SINGLE_LINE_FRAC };
      };

      // analyzePill — chip/pill text (a short single-line label on its own bg) sits
      // CENTERED inside padding, not flush to the box. Returns the centred alignment +
      // padding-inset box, or null when the element isn't a pill. `tbox` is the box so
      // far (post-analyzeTextBox); returns the adjusted one.
      const analyzePill = (cs, box, txt, fs, hasOwnBg, tbox) => {
        const oneLineText = !/\n/.test(txt) && (fs * txt.length * GLYPH_W_FRAC) <= (box.w * PXIN);
        if (!(hasOwnBg && oneLineText)) return null;
        const ta = cs.textAlign;
        const padL = (parseFloat(cs.paddingLeft) || 0) / PXIN;
        const padR = (parseFloat(cs.paddingRight) || 0) / PXIN;
        return {
          chipAlign: ta === 'right' ? 'right' : 'center',   // pills read centred
          chipValign: 'middle',
          tbox: { ...box, x: box.x + padL, w: Math.max(0.1, box.w - padL - padR) },
          forceNoWrap: true,
        };
      };

      // emitTextOp — assemble and push the `text` op for a text leaf: emit the chip
      // background first (so white-on-colour text isn't lost), then the heuristic box
      // (analyzeTextBox), pill centring or single-line buffer, and coloured runs.
      // `hasSvg` flags a text row that also holds an icon (recursed separately).
      const emitTextOp = (el, cs, box, id, txt, hasSvg) => {
        // A text leaf that ALSO has its own background (a pill chip) must emit the
        // fill FIRST — else white-on-white text vanishes. (CONTAINER above only fires
        // for childless wrappers.)
        const surface = surfaceOf(cs, box);
        const hasOwnBg = !!(surface.fill || surface.hasBorder);
        if (hasOwnBg) {
          ops.push({ kind: 'rect', id: id + '.bg', box, fill: surface.fill, line: surface.line, radius: surface.radius });
        }
        const lh = parseFloat(cs.lineHeight);
        const fs = parseFloat(cs.fontSize) || FONT_FALLBACK_PX;
        const ls = parseFloat(cs.letterSpacing);   // tracking-eyebrow etc.
        const willWrap = box.w > 0 && fs * txt.length * GLYPH_W_FRAC > (box.w * PXIN);

        const { valign, tbox: anchoredBox, srcSingleLine } = analyzeTextBox(box, fs, lh, willWrap, txt);
        let tbox = anchoredBox;
        let chipAlign = null, chipValign = null, forceNoWrap = false;
        // A pill/chip centres its text inside padding; otherwise a single-line source
        // gets a width buffer so PowerPoint keeps it on one line.
        const pill = analyzePill(cs, box, txt, fs, hasOwnBg, tbox);
        if (pill) {
          chipAlign = pill.chipAlign; chipValign = pill.chipValign; tbox = pill.tbox; forceNoWrap = pill.forceNoWrap;
        } else if (srcSingleLine && box.w > 0) {
          const buffer = Math.min(WRAP_BUFFER_MAX, Math.max(WRAP_BUFFER_MIN, box.w * WRAP_BUFFER_FRAC));
          tbox = { ...tbox, w: box.w + buffer };
          forceNoWrap = true;
        }

        const { runs, baseColor, multiColor } = collectColorRuns(el, cs);
        const textAlign = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left';
        ops.push({
          kind: 'text', id, box: tbox, text: txt, valign: chipValign || valign,
          color: baseColor,
          runs: (multiColor && runs.length) ? runs : null,
          // keep the exact (px * 72) / PXIN operation order — `px * 0.75` rounds
          // differently in float (e.g. 19.575 vs 19.575000000000003).
          fontPt: (fs * 72) / PXIN,
          bold: parseInt(cs.fontWeight, 10) >= BOLD_MIN_WEIGHT,
          align: chipAlign || textAlign,
          charSpacing: isFinite(ls) && ls ? (ls * 72) / PXIN : null,
          lineSpacingPt: isFinite(lh) ? (lh * 72) / PXIN : null,
          wrap: forceNoWrap ? false : willWrap,   // single-line source → never wrap
          hasSvg,
        });
      };

      // ── classify the slide DOM into an ordered list of draw OPS ──
      // Walk top-down; a node is a CONTAINER (emit bg, recurse) or a LEAF
      // (text / icon / table / rule). data-viz-id is used only as a stable label.
      const ops = [];
      const seenText = new Set();
      const walk = (el, depth) => {
        if (depth > MAX_WALK_DEPTH) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
        const tag = el.tagName.toUpperCase();
        const box = boxOf(el);
        if (!box) { [...el.children].forEach((c) => walk(c, depth + 1)); return; }
        const id = el.getAttribute('data-viz-id') || '';

        // TABLE → native table op (stop recursion)
        if (tag === 'TABLE') { ops.push(serializeTable(el, box, cs)); return; }

        // IMAGE COMPOSITE → a dedicated image/background LAYER: an element whose own
        // subtree is an <img> plus (optionally) overlay/blend divs and NO text at all.
        // The CSS blend (duotone tint, green-multiply, gradient seam) has no native
        // equivalent, so we rasterise the WHOLE layer (image + overlays, composited as
        // the browser shows it) into one <Image> and stop recursing. Catches the
        // cover's duotone hero band and the closing slide's faint-photo band — but NOT
        // a content wrapper that merely contains an image deep inside (that still has
        // text, so the `noText` guard excludes it, keeping the text editable).
        const isImg = el.tagName === 'IMG';
        const hasDirectImg = isImg || [...el.children].some((c) => c.tagName === 'IMG');
        const noText = !(el.textContent || '').trim();
        if (hasDirectImg && noText) {
          const gid = 'graphic-' + ops.length;
          el.setAttribute('data-ak-graphic', gid);
          ops.push({ kind: 'graphic', gid, box });
          return;
        }

        // DECORATIVE BACKGROUND LAYER → a near-full-bleed, text-free container whose
        // children are pure decoration (atmospheric blobs, gradient washes, dot-trail)
        // that the op-classifier would otherwise drop or mis-map. Rasterise the whole
        // layer to one background <Image> so the blobs/gradients survive. Gated on:
        // full-bleed (covers most of the slide) + no text + has visible element
        // children — so it never swallows a real content column. Catches the cover's
        // green corner-blob layer (s1.bg) and similar atmosphere bands.
        const SLIDE_W_IN = 13.333, SLIDE_H_IN = 7.5;
        const fullBleed = box.w >= SLIDE_W_IN * 0.85 && box.h >= SLIDE_H_IN * 0.85;
        const hasVisibleChild = [...el.children].some((c) => {
          const ccs = getComputedStyle(c); const cb = boxOf(c);
          return cb && ccs.display !== 'none' && parseFloat(ccs.opacity) !== 0 &&
            (ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' || (ccs.backgroundImage && ccs.backgroundImage !== 'none') || ccs.boxShadow !== 'none');
        });
        if (fullBleed && noText && hasVisibleChild) {
          const gid = 'graphic-' + ops.length;
          el.setAttribute('data-ak-graphic', gid);
          ops.push({ kind: 'graphic', gid, box });
          return;
        }

        // A direct <svg> element (a CHART / diagram, not an icon-in-a-chip). It has
        // <text> labels + bars/lines that don't convert cleanly to vector → rasterise
        // the whole svg to a PNG so labels and bars all survive faithfully.
        if (tag === 'SVG') {
          const gid = 'graphic-' + ops.length;
          el.setAttribute('data-ak-graphic', gid);
          ops.push({ kind: 'graphic', gid, box });
          return;
        }

        // ICON host: contains a SMALL <svg> and no own text → icon op (vector).
        // Use the SVG's OWN box (its true rendered size), not the host's — the host
        // may shrink-wrap a small icon or pad a large chip, so host-fraction sizing
        // makes icons too small/large. iconBox = the svg rect; iconFrac=1 (fill it).
        const svg = el.querySelector('svg');
        if (svg && !directText(el) && box.w < ICON_MAX_IN && box.h < ICON_MAX_IN) {
          const icon = serializeIcon(el);
          const iconBox = boxOf(svg) || box;     // the icon's actual rendered box
          const surface = surfaceOf(cs, box);    // emit the chip background (if any) first
          if (surface.fill) ops.push({ kind: 'rect', id, box, fill: surface.fill, line: surface.line, radius: surface.radius });
          ops.push({ kind: 'icon', id, box: iconBox, icon: icon && !icon.complex ? icon : null, complex: !!(icon && icon.complex) });
          return;
        }

        // RULE: a thin bar with a background, in EITHER orientation —
        //   • horizontal: short height, wide   (the green title rule, table header rule)
        //   • vertical:   narrow width, tall    (a left/right edge accent strip)
        // A vertical accent (w-1 ≈ 0.04in tall bar) is real brand styling; without the
        // vertical case it has no text and falls through to nothing (the green left-edge
        // accents on the spec cards vanished from the export).
        const surface = surfaceOf(cs, box);
        const isHRule = box.h <= RULE_MAX_H_IN && box.w >= RULE_MIN_W_IN;
        const isVRule = box.w <= RULE_MAX_H_IN && box.h >= RULE_MIN_W_IN;
        if (surface.fill && (isHRule || isVRule) && !directText(el)) {
          ops.push({ kind: 'rule', id, box, fill: surface.fill }); return;
        }

        // CONTAINER: visible bg/border AND has element children → emit bg, recurse
        const hasChildren = [...el.children].some((c) => c.tagName !== 'SVG');
        if ((surface.fill || surface.hasBorder) && hasChildren && !directText(el)) {
          ops.push({ kind: 'rect', id, box, fill: surface.fill, line: surface.line, radius: surface.radius });
          [...el.children].forEach((c) => walk(c, depth + 1));
          return;
        }

        // TEXT leaf: has direct text, or is a text element with no block children
        let txt = (el.textContent || '').trim();
        // Honor CSS text-transform — the rendered DOM uppercases eyebrows/footers, so
        // the PPTX text must match (else ink height + position drift vs source).
        const tt = cs.textTransform;
        if (tt === 'uppercase') txt = txt.toUpperCase();
        else if (tt === 'lowercase') txt = txt.toLowerCase();
        else if (tt === 'capitalize') txt = txt.replace(/\b\w/g, (m) => m.toUpperCase());
        const blocky = [...el.children].some((c) => { const d = getComputedStyle(c).display; return c.tagName !== 'SVG' && d && d.indexOf('inline') !== 0 && (c.textContent || '').trim(); });
        if (txt && !blocky) {
          if (!seenText.has(el)) {
            emitTextOp(el, cs, box, id, txt, !!svg);
            seenText.add(el);
          }
          // still recurse for any nested icons inside a text row
          [...el.children].forEach((c) => { if (c.querySelector && c.querySelector('svg')) walk(c, depth + 1); });
          return;
        }

        // otherwise: structural wrapper → recurse
        [...el.children].forEach((c) => walk(c, depth + 1));
      };

      // table serializer → rows of cell text + per-cell style
      function serializeTable(table, box, cs) {
        const rows = [];
        const rowHeights = [];          // measured row heights (inches)
        let colWidths = null;           // measured column widths (inches) from row 0
        let headerRound = null;         // {box, fill, radius} if the header row is rounded
        let headerRule = null;          // {box, color, width} if the header has a bottom-border rule
        table.querySelectorAll('tr').forEach((tr) => {
          const cells = [];
          const widths = [];
          const trBox = boxOf(tr);
          const trBg = rgbHex(getComputedStyle(tr).backgroundColor);  // zebra stripe lives on the row
          tr.querySelectorAll('th,td').forEach((cell) => {
            const ccs = getComputedStyle(cell);
            const cb = boxOf(cell);
            if (cb) widths.push(cb.w);
            let txt = (cell.textContent || '').trim();
            const tt = ccs.textTransform;                 // honor uppercase headers etc.
            if (tt === 'uppercase') txt = txt.toUpperCase();
            else if (tt === 'lowercase') txt = txt.toLowerCase();
            // cell padding (px) → points, so cell text sits where the browser puts it
            const padL = parseFloat(ccs.paddingLeft) || 0, padR = parseFloat(ccs.paddingRight) || 0;
            const padT = parseFloat(ccs.paddingTop) || 0, padB = parseFloat(ccs.paddingBottom) || 0;
            cells.push({
              text: txt,
              bold: parseInt(ccs.fontWeight, 10) >= 600 || cell.tagName === 'TH',
              color: rgbHex(ccs.color) || '221815',
              fill: rgbHex(ccs.backgroundColor) || trBg,  // fall back to the row's stripe colour
              align: ccs.textAlign === 'center' ? 'center' : ccs.textAlign === 'right' ? 'right' : 'left',
              fontPt: ((parseFloat(ccs.fontSize) || 14) * 72) / 96,
              charSpacing: (parseFloat(ccs.letterSpacing) || 0) * 72 / 96 || undefined,
              // horizontal padding only — valign:middle + the measured row height handle
              // vertical placement; adding T/B margin on top double-counts → rows drift down.
              margin: [1, padR * 0.75, 1, padL * 0.75],  // [T,R,B,L] pt
              header: cell.tagName === 'TH',
            });
          });
          if (cells.length) { rows.push(cells); rowHeights.push(trBox ? trBox.h : null); if (!colWidths) colWidths = widths; }
          // header row with rounded corners → native table cells can't do border-radius,
          // so record the row's fill + radius and draw a RoundRect behind it on build.
          const firstCell = tr.querySelector('th,td');
          if (firstCell && firstCell.tagName === 'TH' && trBox) {
            const hcs = getComputedStyle(firstCell);
            if (!headerRound) {
              const br = parseFloat(hcs.borderTopLeftRadius) || 0;
              const hfill = rgbHex(hcs.backgroundColor);
              if (br > 1 && hfill) headerRound = { box: trBox, fill: hfill, radius: Math.min(0.5, br / (trBox.h * 96)) };
            }
            // a header BOTTOM border (e.g. `border-b-2 border-primary-500`, the light
            // table style) is the separator rule under the header — native table cell
            // borders don't survive the export, so capture it as its own line to draw.
            if (!headerRule) {
              const bbColor = rgbHex(hcs.borderBottomColor);
              const bbW = parseFloat(hcs.borderBottomWidth) || 0;
              if (bbColor && bbW >= 1) headerRule = { box: trBox, color: bbColor, width: bbW };
            }
          }
        });
        return { kind: 'table', id: table.getAttribute('data-viz-id') || '', box, rows, colWidths, rowHeights, headerRound, headerRule };
      }
      function radiusFrac(cs, box) {
        const br = parseFloat(cs.borderTopLeftRadius) || 0;
        if (!br) return 0;
        const minSide = Math.min(box.w, box.h) * 96;            // px
        return Math.min(0.5, br / Math.max(1, minSide));
      }

      [...root.children].forEach((c) => walk(c, 0));
      return { layout: readSlideLayout('slide'), ops };
  };
})();
