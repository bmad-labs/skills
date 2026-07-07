/* ============================================================================
   pptx-builders.mjs — NODE-SIDE builders that turn one serialized `op` (from the
   browser DOM walk) into pptxgenjs-jsx node(s). One small builder per op `kind`,
   dispatched by `buildOp`. These run in Node (no DOM) — geometry/style already
   measured into the op.

   Each builder takes (op, ctx) and returns a node, an array of nodes, or null
   (caller filters falsy). `ctx` bundles everything a builder needs:
     { h, nodes:{Text,TextRun,RoundRect,Image,Table,TableRow,TableCell}, AK,
       FONT, BRAND, CJK_H_BUFFER, svgToCustomGeometryNodes }
   ============================================================================ */

const RULE_MIN_H_IN = 0.03;     // LibreOffice rejects cy=0 — floor rule height
const RULE_MIN_W_IN = 0.4;      // keep a rule wide enough to render
const RULE_RADIUS = 0.5;        // pill-rounded rule ends
const TEXT_MIN_PT = 6;          // never emit sub-6pt text
const TEXT_FALLBACK_PT = 12;    // when an op has no measured font size
const CELL_MIN_PT = 7;
const CELL_FALLBACK_PT = 11;
const DEFAULT_CELL_MARGIN = [2, 15, 2, 15];   // measured cell padding fallback (pt)
const RULE_PX_PER_IN = 96;      // header-rule thickness px→in
const RULE_MIN_THICK_IN = 0.014;

// ── rect ────────────────────────────────────────────────────────────────────
function buildRect(op, ctx) {
  const b = op.box;
  return ctx.h(ctx.nodes.RoundRect, {
    x: b.x, y: b.y, w: b.w, h: b.h,
    rectRadius: op.radius || 0,
    fill: op.fill ? { color: op.fill } : { type: 'none' },
    line: op.line || { type: 'none' },
  });
}

// ── rule (a thin filled bar, EITHER orientation) ─────────────────────────────
function buildRule(op, ctx) {
  const b = op.box;
  const vertical = b.h > b.w;   // a tall narrow bar = a vertical edge accent
  let x = b.x, y = b.y, w = b.w, h = b.h;
  if (vertical) {
    // floor the WIDTH (the thin dim); keep the height as measured. Don't inflate to
    // the horizontal-rule min-width, or a 4px accent becomes a fat blob over the text.
    w = Math.max(b.w, RULE_MIN_H_IN);
    h = Math.max(b.h, RULE_MIN_W_IN);
    x = b.x + (b.w - w) / 2;
  } else {
    // horizontal: floor the height, keep/enforce a sensible width.
    h = Math.max(b.h, RULE_MIN_H_IN);
    w = Math.max(b.w, RULE_MIN_W_IN);
    y = b.y + (b.h - h) / 2;
  }
  // rectRadius is a FRACTION of the shorter side; 0.5 = fully rounded (pill capsule).
  return ctx.h(ctx.nodes.RoundRect, {
    x, y, w, h, rectRadius: RULE_RADIUS,
    fill: { color: op.fill || ctx.BRAND.green }, line: { type: 'none' },
  });
}

// ── text (single run, or multiple coloured runs) ─────────────────────────────
function buildText(op, ctx) {
  const { h, nodes: { Text, TextRun }, FONT, BRAND, CJK_H_BUFFER } = ctx;
  const b = op.box;
  const textProps = {
    x: b.x, y: b.y, w: b.w, h: b.h * (op.wrap ? CJK_H_BUFFER : 1),
    fontSize: Math.max(TEXT_MIN_PT, op.fontPt || TEXT_FALLBACK_PT), fontFace: FONT, lang: 'ja-JP',
    color: op.color || BRAND.ink, bold: !!op.bold,
    align: op.align || 'left', valign: op.valign || 'top', margin: 0,
    wrap: !!op.wrap, fit: 'none',
    ...(op.lineSpacingPt ? { lineSpacing: op.lineSpacingPt } : {}),
    ...(op.charSpacing ? { charSpacing: op.charSpacing } : {}),
  };
  if (op.runs && op.runs.length) {
    // multi-colour text (e.g. a green accent word in a black title) → one TextRun
    // per coloured run, so each keeps its own colour in PowerPoint.
    const runNodes = op.runs.map((r) => h(TextRun, {
      text: r.text,
      options: { color: r.color || op.color || BRAND.ink, bold: !!r.bold },
    }));
    return h(Text, textProps, ...runNodes);
  }
  return h(Text, { ...textProps, text: op.text });
}

// ── icon (vector custom-geometry, else rasterised PNG fallback) ──────────────
function buildIcon(op, ctx) {
  const { h, nodes: { Image }, AK, svgToCustomGeometryNodes } = ctx;
  const b = op.box;
  // box is now the icon's OWN rendered rect → fill it (iconFrac:1).
  if (op.icon) {
    try {
      const nodes = svgToCustomGeometryNodes(op.icon, b, h, AK, { iconFrac: 1 });
      if (nodes.length) return nodes;
    } catch (_) { /* fall through to PNG */ }
  }
  if (op.iconPng) return h(Image, { x: b.x, y: b.y, w: b.w, h: b.h, options: { data: op.iconPng } });
  return null;
}

// ── graphic (a chart/diagram svg, rasterised → Image) ────────────────────────
function buildGraphic(op, ctx) {
  const b = op.box;
  // NOTE: pptxgenjs-jsx <Image> needs the data under `options`, not top-level.
  if (op.png) return ctx.h(ctx.nodes.Image, { x: b.x, y: b.y, w: b.w, h: b.h, options: { data: op.png } });
  return null;
}

// ── table (native Table + optional rounded-header shape + bottom-rule bar) ───
function buildTable(op, ctx) {
  const { h, nodes: { Table, TableRow, TableCell, RoundRect }, FONT } = ctx;
  const nCols = Math.max(...op.rows.map((r) => r.length), 1);
  // Use the MEASURED column widths / row heights so cells land where they do in the
  // browser (even splits shift every cell → the dominant table diff). Fall back to
  // even splits only if measurement is missing.
  let colW = op.colWidths && op.colWidths.length === nCols
    ? op.colWidths.slice()
    : Array.from({ length: nCols }, () => op.box.w / nCols);
  // normalise to the table's total width (rounding drift → keep columns summing to box.w)
  const sum = colW.reduce((a, b) => a + b, 0) || 1;
  colW = colW.map((w) => (w / sum) * op.box.w);
  const rowH = (op.rowHeights && op.rowHeights.length === op.rows.length && op.rowHeights.every(Boolean))
    ? op.rowHeights
    : Array.from({ length: op.rows.length }, () => op.box.h / op.rows.length);
  const hr = op.headerRound;
  const rows = op.rows.map((cells, r) => h(TableRow, null,
    ...cells.map((c) => h(TableCell, {
      text: c.text,
      options: {
        fontFace: FONT, fontSize: Math.max(CELL_MIN_PT, c.fontPt || CELL_FALLBACK_PT), bold: !!c.bold,
        color: c.color || '221815', align: c.align || 'left', valign: 'middle',
        // header cells go transparent when we draw a rounded shape behind them
        fill: (hr && r === 0) ? undefined : (c.fill ? { color: c.fill } : undefined),
        ...(c.charSpacing ? { charSpacing: c.charSpacing } : {}),
        margin: c.margin || DEFAULT_CELL_MARGIN,   // measured cell padding (px·0.75 → pt)
      },
    }))));
  // Per-row heights go in pptxgenjs's `rowH` (number[] of inches), NOT a total `h`
  // (which would redistribute evenly) and NOT a TableRow prop (which doesn't exist).
  const table = h(Table, { x: op.box.x, y: op.box.y, w: op.box.w, colW, rowH, fontFace: FONT }, ...rows);
  const extra = [];
  // A rounded green header bar drawn BEHIND the (now-transparent) header cells — native
  // table cells can't do border-radius, so this reproduces `rounded-l-lg/r-lg`.
  if (hr) {
    extra.push(h(RoundRect, { x: hr.box.x, y: hr.box.y, w: hr.box.w, h: hr.box.h, rectRadius: hr.radius, fill: { color: hr.fill }, line: { type: 'none' } }));
  }
  // The header's bottom-border rule (e.g. `border-b-2 border-primary-500`) — native cell
  // borders don't export, so draw it as a thin filled bar along the header's bottom edge.
  const rule = op.headerRule;
  if (rule) {
    const thIn = Math.max(RULE_MIN_THICK_IN, rule.width / RULE_PX_PER_IN);   // px → inches (min ~1px)
    const ry = rule.box.y + rule.box.h - thIn;                              // sit on the header's bottom edge
    extra.push(h(RoundRect, { x: rule.box.x, y: ry, w: rule.box.w, h: thIn, rectRadius: 0, fill: { color: rule.color }, line: { type: 'none' } }));
  }
  return extra.length ? [...extra, table] : [table];
}

// ── dispatch: op.kind → builder (G23 — a lookup, not an if/else chain) ───────
const DISPATCH = {
  rect: buildRect,
  rule: buildRule,
  text: buildText,
  icon: buildIcon,
  graphic: buildGraphic,
  table: buildTable,
};

// Build one op into node(s). Returns an array (flattened by the caller); empty
// for an unknown kind or a builder that produced nothing.
export function buildOp(op, ctx) {
  const builder = DISPATCH[op.kind];
  if (!builder) return [];
  const out = builder(op, ctx);
  if (!out) return [];
  return Array.isArray(out) ? out : [out];
}
