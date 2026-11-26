#!/usr/bin/env node
/**
 * scene — build an illustrated scene SVG (icon actors, curved coloured arrows, numbered
 * notes) from a small JSON spec, then lint its layout.
 *
 *   node scripts/scene.mjs scenes/*.scene.json            # writes public/diagrams/<name>.svg
 *   node scripts/scene.mjs a.scene.json --out public/x.svg # one spec, explicit output
 *   node scripts/scene.mjs a.scene.json --png              # also writes review/<name>.png at 3x
 *   node scripts/scene.mjs a.scene.json --tokens           # keep var(--token) colours (inline SVG)
 *   node scripts/scene.mjs --icons                         # list available icon names
 *
 * Colours: by default every var(--token) is resolved to its value from the deck's design
 * system (design-system/styles.css and its imports), because a file under public/ is
 * loaded through <img> and cannot see the page's CSS. Pass --tokens only when the SVG is
 * inlined into the JSX.
 * Guide: references/illustrated-scenes.md (anatomy, colour meaning, layout and copy rules).
 *
 * Spec:
 * {
 *   "title": "Account takeover: attack scene",       // <title> of the SVG, for screen readers
 *   "width": 1240, "height": 500,                     // optional; this is the default canvas
 *   "textScale": 1.15,                                 // optional; all text and notes 15% larger
 *   "nodes":  [{ "key": "A", "x": 100, "y": 190, "icon": "venetian-mask", "kind": "attacker",
 *                "label": "Attacker", "sub": "phishing kit", "badge": "danger" }],
 *   "arrows": [{ "from": "A", "to": "P", "kind": "attack", "label": "controls",
 *                "bow": 0, "dashed": false, "width": 2.2, "labelColor": "link", "labelDy": -9,
 *                "labelT": 0.5 }],                  // labelT: where along the arrow the label sits, 0..1
 *   "notes":  [{ "n": 1, "x": 30, "y": 16, "title": "Fake sign-in page",
 *                "text": "The page passes the password and the code on to the real site.",
 *                "kind": "note" }]
 * }
 *   node kinds  person | system | new | link | safe | cause | attacker | evil
 *   arrow kinds normal | neutral | link | safe | failure | attack   (failure = attack, red)
 *   note kinds  note | impact | safe        ("n": null on a safe note draws a check)
 *   badge       danger | ok
 *   "text" is wrapped to the note width; "lines" sets the breaks by hand.
 *
 *   "zones":  [{ "x": 300, "y": 120, "w": 620, "h": 250, "label": "Internal network", "kind": "boundary" }],
 *   "lanes":  [{ "y": 160, "h": 140, "label": "Customer" }],
 *   zone kinds  boundary | new | external
 *
 * Script form, for what JSON cannot express: write <name>.scene.mjs next to the specs and
 * run it with the same command. It imports this file, adds parts, and exports the scene:
 *
 *   import { Scene } from '<relative path to>/scripts/scene.mjs';
 *   const s = new Scene({ title: 'Order flow: how it works', height: 460 });
 *   s.zone({ x: 300, y: 120, w: 620, h: 250, label: 'Internal network' });
 *   s.node({ key: 'A', x: 100, y: 230, icon: 'user', kind: 'person', label: 'Customer' });
 *   s.raw({ svg: '<path d="…"/>', box: { x: 980, y: 300, w: 120, h: 60 }, what: 'timeline' });
 *   export default s;
 *
 * raw() takes any SVG; its box is what the layout check sees, so give every raw drawing
 * one. Arrow geometry, label placement and the check stay in this file for every scene.
 *
 * Icons are lucide icons (kebab-case file names), read from node_modules/lucide-react.
 * Exit code 1 when a lint ERROR is found (overlap, off-canvas, unknown icon or key).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DS_DIR = existsSync(join(ROOT, 'design-system')) ? join(ROOT, 'design-system') : join(ROOT, '..', 'design-system');
const ICON_DIR = join(ROOT, 'node_modules/lucide-react/dist/esm/icons');

const R = 34;            // actor tile radius
const NOTE_W = 236;      // note width
const LINE_H = 16;       // note body line height
const CHAR_W = 6.1;      // average sans-serif advance at 12px (body)
const LABEL_CHAR_W = 6.9; // at 11.5px bold (arrow labels)
const NODE_CHAR_W = 7.6;  // at 13px bold (actor labels)

const NODE = {   // fill, stroke, icon colour
  attacker: ['var(--ink-900)', 'var(--ink-900)', 'var(--text-inverse)'],
  evil:     ['var(--surface-card)', 'var(--status-danger)', 'var(--status-danger)'],
  system:   ['var(--surface-muted)', 'var(--border-default)', 'var(--ink-700)'],
  person:   ['var(--surface-card)', 'var(--status-info)', 'var(--status-info)'],
  link:     ['var(--color-accent-soft)', 'var(--color-accent)', 'var(--color-accent)'],
  new:      ['var(--color-accent)', 'var(--color-accent)', 'var(--text-inverse)'],   // the part we build
  safe:     ['var(--surface-card)', 'var(--status-positive)', 'var(--status-positive)'],
  cause:    ['var(--surface-card)', 'var(--status-danger)', 'var(--status-danger)'],   // root cause of an incident
};
const LINE = {
  attack: 'var(--status-danger)', failure: 'var(--status-danger)', normal: 'var(--status-info)', neutral: 'var(--ink-500)',
  link: 'var(--color-accent)', safe: 'var(--status-positive)',
};
const NOTE = {   // fill, stroke, number badge
  note:   ['var(--surface-muted)', null, 'var(--ink-900)'],
  impact: ['var(--surface-card)', 'var(--status-danger)', 'var(--status-danger)'],
  safe:   ['var(--surface-card)', 'var(--status-positive)', 'var(--status-positive)'],
};

// XML-safe text: named HTML entities break SVG parsing, so every non-ASCII char is numeric.
const esc = (s) => String(s).replace(/&/g, '&#38;').replace(/</g, '&#60;').replace(/>/g, '&#62;')
  .replace(/[^\x00-\x7f]/g, (c) => `&#${c.codePointAt(0)};`);
const f = (n) => Number(n.toFixed(1));

// ---- design tokens -> literal colours ------------------------------------
function readCss(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return '';
  seen.add(file);
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return css.replace(/@import\s+url\(["']?([^"')]+)["']?\)\s*;/g, (_, p) => readCss(resolve(dirname(file), p), seen));
}
function loadTokens() {
  const css = readCss(join(DS_DIR, 'styles.css'));
  const vars = {};
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();  // later wins
  const res = (v, depth = 0) => v.replace(/var\(--([\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, n, fb) =>
    depth > 10 ? (fb || '#000') : (vars[n] != null ? res(vars[n], depth + 1) : (fb || `var(--${n})`)));
  return res;
}
export function resolveTokens(svg) {
  const res = loadTokens();
  // a resolved value lands inside a double-quoted attribute, so its own quotes become single
  return svg.replace(/var\(--[\w-]+(?:\s*,\s*[^)]+)?\)/g, (v) => res(v).replace(/"/g, "'"));
}

const iconCache = {};
function iconNodes(name) {
  if (iconCache[name]) return iconCache[name];
  const file = join(ICON_DIR, `${name}.js`);
  if (!existsSync(file)) return null;
  const src = readFileSync(file, 'utf8');
  const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*?\])\);/);
  if (!m) {  // an old name re-exports its new name: export { default } from './circle-alert.js'
    const alias = src.match(/export\s*\{\s*default\s*\}\s*from\s*'\.\/([\w-]+)\.js'/);
    return alias && alias[1] !== name ? (iconCache[name] = iconNodes(alias[1])) : null;
  }
  // The icon node list is a JS literal with bare keys; quote them and parse it as data.
  const json = m[1].replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":').replace(/,(\s*[}\]])/g, '$1');
  try { return (iconCache[name] = JSON.parse(json)); } catch { return null; }
}
function icon(name, cx, cy, size, color, sw = 2) {
  const nodes = iconNodes(name) || [];
  const s = size / 24;
  const parts = nodes.map(([tag, attrs]) =>
    `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`);
  return `<g transform="translate(${f(cx - size / 2)} ${f(cy - size / 2)}) scale(${f(s * 1000) / 1000})" fill="none" `
    + `stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g>`;
}

function wrap(text, maxPx, charW) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length * charW > maxPx && cur) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export function buildScene(spec) {
  const W = spec.width || 1240, H = spec.height || 500;
  const k = spec.textScale || 1;                  // text size multiplier
  const NW = Math.round(NOTE_W * k), LH = LINE_H * k;
  const back = [], front = [], issues = [], boxes = [];
  const err = (m) => issues.push(['ERROR', m]); const warn = (m) => issues.push(['WARN', m]);
  const nodes = {};

  // ---- lanes and zones: drawn behind everything --------------------------
  for (const ln of spec.lanes || []) {
    const { y, h, label = '' } = ln;
    back.push(`<!-- lane ${label} -->`,
      `<rect x="0" y="${y}" width="${W}" height="${h}" fill="var(--surface-muted)" fill-opacity="0.55"/>`,
      `<text x="14" y="${f(y + 18 * k)}" font-size="${f(11 * k)}" font-weight="bold" letter-spacing="1.2" fill="var(--text-muted)">${esc(label.toUpperCase())}</text>`);
    boxes.push({ what: `lane "${label}" label`, x0: 8, x1: 18 + label.length * 8.2 * k, y0: y + 4, y1: y + 24 * k });
    if (y < 0 || y + h > H) err(`lane "${label}": leaves the canvas`);
  }
  const ZONE = {   // fill, stroke, label colour
    boundary: [null, 'var(--border-default)', 'var(--text-muted)'],
    new:      ['var(--color-accent-soft)', 'var(--color-accent)', 'var(--color-accent)'],
    external: ['var(--surface-muted)', 'var(--border-default)', 'var(--text-muted)'],
  };
  const zones = [];
  for (const z of spec.zones || []) {
    const { x, y, w, h, label = '', kind = 'boundary' } = z;
    if (!ZONE[kind]) { err(`zone "${label}": unknown kind "${kind}"`); continue; }
    const [fill, stroke, lc] = ZONE[kind];
    back.push(`<!-- zone ${label} -->`,
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill || 'none'}"${fill ? ' fill-opacity="0.45"' : ''} stroke="${stroke}" stroke-width="1.5" stroke-dasharray="7 5"/>`,
      `<text x="${x + 14}" y="${f(y + 20 * k)}" font-size="${f(11 * k)}" font-weight="bold" letter-spacing="1.2" fill="${lc}">${esc(label.toUpperCase())}</text>`);
    boxes.push({ what: `zone "${label}" label`, x0: x + 8, x1: x + 18 + label.length * 8.2 * k, y0: y + 6, y1: y + 26 * k });
    zones.push({ label, x0: x, x1: x + w, y0: y, y1: y + h });
    if (x < 0 || y < 0 || x + w > W || y + h > H) err(`zone "${label}": leaves the canvas`);
  }

  // ---- actors -------------------------------------------------------------
  for (const nd of spec.nodes || []) {
    const { key, x, y, kind = 'system', label = '', sub, badge } = nd;
    if (!NODE[kind]) { err(`node ${key}: unknown kind "${kind}"`); continue; }
    if (!iconNodes(nd.icon)) err(`node ${key}: unknown icon "${nd.icon}" (run --icons)`);
    const [fill, stroke, ic] = NODE[kind];
    nodes[key] = { x, y };
    const g = [`<!-- node ${key} -->`,
      `<circle cx="${x}" cy="${y}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
      icon(nd.icon, x, y, 32, ic)];
    if (badge === 'danger' || badge === 'ok') {
      const bx = f(x + R * 0.74), by = f(y - R * 0.74);
      const bf = badge === 'danger' ? 'var(--status-danger)' : 'var(--status-positive)';
      g.push(`<circle cx="${bx}" cy="${by}" r="11" fill="${bf}" stroke="var(--surface-card)" stroke-width="2"/>`);
      g.push(badge === 'danger'
        ? `<text x="${bx}" y="${by + 5}" font-size="14" font-weight="bold" fill="var(--text-inverse)" text-anchor="middle">!</text>`
        : icon('check', bx, by, 14, 'var(--text-inverse)', 3));
    }
    g.push(`<text x="${x}" y="${f(y + R + 20 * k)}" font-size="${f(13 * k)}" font-weight="bold" fill="var(--text-primary)" text-anchor="middle">${esc(label)}</text>`);
    if (sub) g.push(`<text x="${x}" y="${f(y + R + 36 * k)}" font-size="${f(11.5 * k)}" fill="var(--text-secondary)" text-anchor="middle">${esc(sub)}</text>`);
    front.push(...g);
    const half = Math.max(label.length * NODE_CHAR_W, (sub || '').length * CHAR_W) * k / 2;
    const below = R + (sub ? 40 : 25) * k;
    boxes.push({ what: `node ${key}`, x0: x - R, x1: x + R, y0: y - R, y1: y + R, node: key });
    boxes.push({ what: `node ${key} label`, x0: x - half, x1: x + half, y0: y + R + 8, y1: y + below, node: key });
    if (x - half < 0 || x + half > W || y - R < 0 || y + below > H) err(`node ${key}: tile or label leaves the canvas`);
  }

  // ---- notes --------------------------------------------------------------
  const numbers = []; let impacts = 0;
  for (const nt of spec.notes || []) {
    const kind = nt.kind || 'note';
    if (!NOTE[kind]) { err(`note ${nt.n}: unknown kind "${kind}"`); continue; }
    const lines = nt.lines || wrap(nt.text || '', NW - 32 * k, CHAR_W * k);
    const h = f(50 * k + LH * lines.length);
    const { x, y } = nt; const [fill, stroke, badge] = NOTE[kind];
    const tag = nt.n == null ? 'safe' : nt.n;
    const g = [`<!-- note ${tag} -->`,
      `<rect x="${x}" y="${y}" width="${NW}" height="${h}" rx="8" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1.6"` : ''}/>`];
    const cx = f(x + 25 * k), cy = f(y + 25 * k), r = f(12 * k);
    if (nt.n == null) g.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--status-positive)"/>`, icon('check', cx, cy, 15 * k, 'var(--text-inverse)', 3));
    else g.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${badge}"/>`,
      `<text x="${cx}" y="${f(cy + 4.5 * k)}" font-size="${f(12.5 * k)}" font-weight="bold" fill="var(--text-inverse)" text-anchor="middle">${nt.n}</text>`);
    g.push(`<text x="${f(x + 46 * k)}" y="${f(y + 30 * k)}" font-size="${f(13.5 * k)}" font-weight="bold" fill="var(--text-primary)">${esc(nt.title)}</text>`);
    lines.forEach((t, i) => g.push(`<text x="${f(x + 16 * k)}" y="${f(y + 56 * k + LH * i)}" font-size="${f(12 * k)}" fill="var(--text-secondary)">${esc(t)}</text>`));
    front.push(...g);
    boxes.push({ what: `note ${tag}`, x0: x, x1: x + NW, y0: y, y1: y + h, note: true });
    if (x < 0 || y < 0 || x + NW > W || y + h > H) err(`note ${tag}: leaves the canvas (${x},${y} ${NW}x${h})`);
    if (nt.title.length * 7.4 * k > NW - 52 * k) warn(`note ${tag}: title "${nt.title}" may overrun; keep it to 2-4 words`);
    lines.forEach((t) => { if (t.length * CHAR_W * k > NW - 20 * k) warn(`note ${tag}: line "${t}" may overrun the note`); });
    if (lines.length > 3) warn(`note ${tag}: ${lines.length} lines; a note holds one idea in 3 lines or fewer`);
    if (nt.n != null) numbers.push(nt.n);
    if (kind === 'impact') impacts++;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.some((n, i) => n !== i + 1)) warn(`note numbers are ${sorted.join(',')}; number them 1..${sorted.length}, in the order of the story`);
  if (impacts > 1) warn(`${impacts} impact notes; keep one, on the harm`);

  // ---- raw drawings: anything the spec cannot express ---------------------
  for (const r of spec.raw || []) {
    const what = r.what || 'raw drawing';
    (r.layer === 'back' ? back : front).push(`<!-- raw ${what} -->`, r.svg);
    if (r.layer === 'back') continue;   // a background shape is not an obstacle
    if (!r.box) { warn(`${what}: no box, so the layout check cannot see it`); continue; }
    const { x, y, w, h } = r.box;
    boxes.push({ what, x0: x, x1: x + w, y0: y, y1: y + h, note: true });
    if (x < 0 || y < 0 || x + w > W || y + h > H) err(`${what}: leaves the canvas`);
  }

  // ---- arrows -------------------------------------------------------------
  const pathPts = [], pairCount = {}, labelBoxes = [];
  for (const ar of spec.arrows || []) {
    const a = nodes[ar.from], b = nodes[ar.to];
    if (!a || !b) { err(`arrow ${ar.from}-${ar.to}: unknown node key`); continue; }
    const col = LINE[ar.kind || 'attack'];
    if (!col) { err(`arrow ${ar.from}-${ar.to}: unknown kind "${ar.kind}"`); continue; }
    const bow = ar.bow || 0, width = ar.width || 2.2;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const px = -(b.y - a.y) / L, py = (b.x - a.x) / L;
    const qx = mx + px * bow, qy = my + py * bow;            // quadratic control point
    const l0 = Math.hypot(qx - a.x, qy - a.y);
    const sx = a.x + (qx - a.x) / l0 * (R + 3), sy = a.y + (qy - a.y) / l0 * (R + 3);
    const l1 = Math.hypot(b.x - qx, b.y - qy);
    const ux = (b.x - qx) / l1, uy = (b.y - qy) / l1;
    const tx = b.x - ux * (R + 2), ty = b.y - uy * (R + 2);  // tip: 2px off the tile edge
    const bx = tx - ux * 12, by = ty - uy * 12;              // head base: the stroke ends here
    const dash = ar.dashed ? ' stroke-dasharray="6 5"' : '';
    const pair = `${ar.from}-${ar.to}`; pairCount[pair] = (pairCount[pair] || 0) + 1;
    const aid = pairCount[pair] > 1 ? `${pair} ${pairCount[pair]}` : pair;   // one id per arrow
    // a stable name for edit mode: the nth arrow between the same two actors, not its bow
    back.push(`<!-- arrow ${pair}${pairCount[pair] > 1 ? ` ${pairCount[pair]}` : ''} -->`,
      `<path d="M ${f(sx)} ${f(sy)} Q ${f(qx)} ${f(qy)} ${f(bx)} ${f(by)}" fill="none" stroke="${col}" stroke-width="${width}"${dash} stroke-linecap="round"/>`,
      `<polygon points="${f(tx)},${f(ty)} ${f(bx - uy * 5.5)},${f(by + ux * 5.5)} ${f(bx + uy * 5.5)},${f(by - ux * 5.5)}" fill="${col}"/>`);
    for (let t = 0.04; t <= 0.96; t += 0.04) {
      const it = 1 - t;
      pathPts.push({ id: aid, from: ar.from, to: ar.to,
        x: it * it * sx + 2 * it * t * qx + t * t * bx, y: it * it * sy + 2 * it * t * qy + t * t * by });
    }
    if (ar.label) {
      const t = Math.min(0.9, Math.max(0.1, ar.labelT ?? 0.5)), it = 1 - t;
      const mx2 = it * it * sx + 2 * it * t * qx + t * t * bx, my2 = it * it * sy + 2 * it * t * qy + t * t * by;  // point on the curve
      const hw = ar.label.length * LABEL_CHAR_W * k / 2, hh = 7 * k;
      const gx = 2 * it * (qx - sx) + 2 * t * (bx - qx), gy = 2 * it * (qy - sy) + 2 * t * (by - qy);
      const tl = Math.hypot(gx, gy), tdx = gx / tl, tdy = gy / tl;                              // tangent there
      let lx, ly;
      if (hw * Math.abs(tdy) / Math.max(Math.abs(tdx), 0.01) < 3) {   // the line rises < 3px under half the label: keep it level above (or below with labelDy > 0)
        lx = mx2; ly = my2 + (ar.labelDy ?? -9) * k;
      } else {                             // slanted: pushed off the line; a steep arrow may take the place beside it
        const below = (ar.labelDy ?? -9) > 0;
        let nx = -tdy, ny = tdx;
        if ((ny > 0) !== below) { nx = -nx; ny = -ny; }          // a: pushed off along the normal
        const d = hw * Math.abs(nx) + hh * Math.abs(ny) + 9;    //    clear of the line, halo included
        const side = below ? -1 : 1;                             // b: level with the point, beside the line
        const off = (hh + 9) * Math.abs(tdx / tdy) + hw;         //    centre offset so the near edge clears it
        const db = Math.abs(off * tdy);                          //    its distance from the line
        if (Math.abs(tdy) > 0.7 && db < d) { lx = mx2 + side * off; ly = my2 + 3.5 * k; }   // steep arrows only
        else { lx = mx2 + nx * d; ly = my2 + ny * d + 3.5 * k; } // baseline sits ~3.5px under the text centre
      }
      const lc = ar.labelColor ? (LINE[ar.labelColor] || ar.labelColor) : col;
      front.push(`<text x="${f(lx)}" y="${f(ly)}" font-size="${f(11.5 * k)}" font-weight="bold" fill="${lc}" text-anchor="middle" `
        + `stroke="var(--surface-card)" stroke-width="4" paint-order="stroke">${esc(ar.label)}</text>`);
      boxes.push({ what: `label "${ar.label}"`, x0: lx - hw, x1: lx + hw, y0: ly - 11 * k, y1: ly + 3 * k, label: aid });
      labelBoxes.push({ aid, label: ar.label, x0: lx - hw, x1: lx + hw, y0: ly - 11 * k, y1: ly + 3 * k });
    }
  }

  // ---- lint: overlaps -----------------------------------------------------
  const hit = (p, q) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const p = boxes[i], q = boxes[j];
    if (!hit(p, q)) continue;
    if (p.note || q.note) err(`${p.what} overlaps ${q.what}`);
    else if (p.node && q.node) { if (p.node !== q.node) err(`${p.what} overlaps ${q.what}`); }
    else warn(`${p.what} touches ${q.what}`);
  }
  const crossed = new Set();
  for (const pt of pathPts) for (const bx of boxes) {
    const ownTile = (bx.node === pt.from || bx.node === pt.to) && !bx.what.endsWith(' label');
    if (ownTile) continue;
    const pair = `${pt.id}|${bx.what}`;
    if (crossed.has(pair) || !(pt.x > bx.x0 && pt.x < bx.x1 && pt.y > bx.y0 && pt.y < bx.y1)) continue;
    crossed.add(pair);
    if (bx.label === pt.id) warn(`${bx.what} sits on its own arrow; give it a labelDy or shorten it`);
    else (bx.note ? err : warn)(`arrow ${pt.id} runs through ${bx.what} near (${f(pt.x)}, ${f(pt.y)})`);
  }
  for (const lb of labelBoxes) {    // a gap between a label and its arrow makes it read as another arrow's
    let dmin = Infinity;
    for (const pt of pathPts) if (pt.id === lb.aid) {
      const dx = Math.max(lb.x0 - pt.x, 0, pt.x - lb.x1), dy = Math.max(lb.y0 - pt.y, 0, pt.y - lb.y1);
      dmin = Math.min(dmin, Math.hypot(dx, dy));
    }
    if (dmin > 20 * k) warn(`label "${lb.label}" floats ${Math.round(dmin)}px from its arrow; check labelDy, or move it with labelT (0..1)`);
  }
  for (const z of zones) for (const lb of labelBoxes) {   // touching a border from inside or outside
    const g = 4;
    const near = (v, e) => Math.abs(v - e) < g;
    const overlapsX = lb.x0 < z.x1 && z.x0 < lb.x1, overlapsY = lb.y0 < z.y1 && z.y0 < lb.y1;
    if ((overlapsX && (near(lb.y0, z.y0) || near(lb.y1, z.y0) || near(lb.y0, z.y1) || near(lb.y1, z.y1)))
      || (overlapsY && (near(lb.x0, z.x0) || near(lb.x1, z.x0) || near(lb.x0, z.x1) || near(lb.x1, z.x1))))
      warn(`label "${lb.label}" touches the border of zone "${z.label}"`);
  }
  for (const z of zones) for (const bx of boxes) {
    if (!(bx.node || bx.note || bx.label) || bx.what.endsWith(' label')) continue;
    const inter = bx.x0 < z.x1 && z.x0 < bx.x1 && bx.y0 < z.y1 && z.y0 < bx.y1;
    const inside = bx.x0 >= z.x0 && bx.x1 <= z.x1 && bx.y0 >= z.y0 && bx.y1 <= z.y1;
    if (inter && !inside) warn(`${bx.what} straddles the border of zone "${z.label}"${bx.label ? '; move the label or the border' : ''}`);
  }
  const seen = new Set();
  const uniq = issues.filter(([s, m]) => (seen.has(m) ? false : seen.add(m)));

  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="var(--font-sans, sans-serif)">`,
    `<title>${esc(spec.title || 'Scene')}</title>`,
    `<rect width="${W}" height="${H}" fill="var(--surface-card)"/>`,
    ...back, ...front, '</svg>', ''].join('\n');
  return { svg, issues: uniq };
}

/** Builder for the script form. Each method takes the same object as one JSON entry. */
export class Scene {
  constructor(opts = {}) { this.spec = { ...opts, nodes: [], arrows: [], notes: [], zones: [], lanes: [], raw: [] }; }
  node(n) { this.spec.nodes.push(n); return this; }
  arrow(a) { this.spec.arrows.push(a); return this; }
  note(n) { this.spec.notes.push(n); return this; }
  zone(z) { this.spec.zones.push(z); return this; }
  lane(l) { this.spec.lanes.push(l); return this; }
  raw(r) { this.spec.raw.push(r); return this; }
  build() { return buildScene(this.spec); }
}

async function loadSpec(p) {
  if (!p.endsWith('.mjs')) return JSON.parse(readFileSync(p, 'utf8'));
  const mod = await import(pathToFileURL(resolve(p)).href);
  const d = typeof mod.default === 'function' && !(mod.default instanceof Scene) ? await mod.default() : mod.default;
  if (!d) throw new Error(`${p}: export default a Scene`);
  return d instanceof Scene ? d.spec : d;
}

// ---- CLI ------------------------------------------------------------------
async function preview(svgFile, pngFile) {
  const { chromium } = await import('playwright');
  const svg = readFileSync(svgFile, 'utf8');
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || [0, 1240, 500];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 3 });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: pngFile, clip: { x: 0, y: 0, width: +w, height: +h } });
  await browser.close();
}

const args = process.argv.slice(2);
// The command runs inside main() so this module finishes loading first: a .scene.mjs file
// imports it back, and a top-level await here would leave both waiting on each other.
async function main() {
  if (args.includes('--icons')) {
    console.log(readdirSync(ICON_DIR).filter((n) => n.endsWith('.js') && n !== 'index.js').map((n) => n.slice(0, -3)).join(' '));
    process.exit(0);
  }
  const oi = args.indexOf('--out');
  const out = oi >= 0 ? args[oi + 1] : null;
  const keepTokens = args.includes('--tokens'), png = args.includes('--png');
  const specs = args.filter((a, i) => !a.startsWith('--') && !(oi >= 0 && i === oi + 1));
  if (!specs.length) { console.error('usage: node scripts/scene.mjs <spec.scene.json...> [--out file.svg] [--png] [--tokens] | --icons'); process.exit(2); }
  let errors = 0;
  for (const p of specs) {
    const spec = await loadSpec(p);
    const { svg, issues } = buildScene(spec);
    const name = basename(p).replace(/\.scene\.(json|mjs)$/, '').replace(/\.json$/, '');
    const target = out || join(ROOT, 'public', 'diagrams', `${name}.svg`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, keepTokens ? svg : resolveTokens(svg));
    console.log(`${issues.length ? '•' : '✓'} ${p} -> ${target}`);
    for (const [sev, m] of issues) { console.log(`  ${sev.padEnd(5)} ${m}`); if (sev === 'ERROR') errors++; }
    if (png) {
      const pngFile = join(ROOT, 'review', `${name}.png`);
      mkdirSync(dirname(pngFile), { recursive: true });
      await preview(target, pngFile);
      console.log(`  preview -> ${pngFile}${keepTokens ? ' (var() colours do not resolve in a preview; drop --tokens to check colours)' : ''}`);
    }
  }
  if (errors) { console.log(`${errors} error(s). Move the note or bow the arrow, then run again.`); process.exit(1); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
