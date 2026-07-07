The repo facts confirm the research: walker at the classification region (now ~lines 270-360), `pptxgenjs ^3.12.0` and `@artifact-kit/pptxgenjs-jsx ^0.1.6` are the deps, the container branch pushes a `rect` op then recurses children (the contiguity property groups rely on), and the references dir holds the docs to update. Here is the report.

---

# Native Bullet Lists + Grouped Shapes for the Node PPTX Exporter — Technical Research & Phased Plan

## 1. TL;DR Recommendation

**Stay on pptxgenjs-jsx for lists and shapes; add a scoped raw-XML post-injection step ONLY for true card grouping.** Concretely: **(Lists)** emit native multi-level bullet/numbered lists with pure pptxgenjs — one `addText` call (one `<Text>` JSX node) whose runs carry `bullet`/`indentLevel`/`breakLine`, producing genuine `<a:buChar>`/`<a:buAutoNum>`/`<a:pPr lvl>` OOXML. Zero new dependency, ~30–40 lines in the walker + build loop. **(Shapes)** keep what already exists — `RoundRect` (`prst="roundRect"`) and `CustomGeometry` (`custGeom`) are already true native editable shapes; do not regress to images. **(Grouping)** pptxgenjs *cannot* emit `<p:grpSp>` (issue #307, open since 2018, unshipped through v4.0.1) — so for single-text cards use the free win of `addText({shape:'roundRect'})` (one `<p:sp>` carrying geometry **and** a txBody = one selectable object), and for multi-element cards (icon+title+body+chip) gate a **raw `<p:grpSp>` post-injection** behind a `--group-cards` flag, reusing the JSZip step the font-embed path already runs, with the `chOff=off / chExt=ext` pass-through invariant and the existing LibreOffice validate gate. Do **not** switch to python-pptx or Apache POI: their grouping APIs are nicer but they force a runtime switch, abandon the JSX wrapper + Node validation tooling, and can't do the browser-geometry measurement the architecture depends on. SmartArt is rejected (4-part undocumented authoring, breaks geometry fidelity).

---

## 2. Native Bullet / Numbered Lists

### 2.1 The API (pptxgenjs-jsx idiom)

A PowerPoint list is **one `addText` call** whose `text` is an **array of run objects**; each run with `breakLine:true` closes the current `<a:p>` and opens the next, so one array → many list paragraphs. The `bullet` property is **paragraph-level**, so a single list item can still hold multiple colored/bold `<a:r>` runs. In this exporter's JSX layer that becomes one `<Text>` node whose children are `<TextRun>` nodes (the layer forwards `options` verbatim — already proven for `color`/`bold`).

```jsx
h(Text, { x, y, w, h, fontFace: FONT, fontSize: 14, valign: 'top', margin: 0, wrap: true, lang: 'ja-JP' },
  h(TextRun, { text: 'Top level', options: { bullet: true, indentLevel: 0, breakLine: true } }),
  h(TextRun, { text: 'Sub item',  options: { bullet: true, indentLevel: 1, breakLine: true } }),
  h(TextRun, { text: 'Deeper',    options: { bullet: { characterCode: '25AA' }, indentLevel: 2, breakLine: true } }),
  // numbered:
  h(TextRun, { text: 'Step one',  options: { bullet: { type: 'number', style: 'arabicPeriod', startAt: 1 }, indentLevel: 0, breakLine: true } }),
)
```

### 2.2 OOXML emitted (verified against pptxgenjs v3.12 `gen-xml.ts` / installed `pptxgen.cjs.js`)

| Input | Emitted into `<a:pPr>` |
|---|---|
| `bullet: true` | `marL="342900" indent="-342900"` + `<a:buSzPct val="100000"/><a:buChar char="&#x2022;"/>` (U+2022 •) |
| `bullet: { characterCode: '2605' }` | `<a:buChar char="&#x2605;"/>` (★). Must be 4-hex or it warns + falls back. (Current key is `characterCode`; deprecated `code` still works.) |
| `bullet: { type:'number', style:'alphaLcPeriod', startAt:1 }` | `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="alphaLcPeriod" startAt="1"/>` — `style→type`, default `arabicPeriod`; `romanUcPeriod` etc. pass through |
| `indentLevel: N` (N>0) | adds `lvl="N"` and recomputes hanging indent `marL = 342900 * (1 + N)`, `indent="-342900"` (level 1 → `marL="685800"`, level 2 → `marL="1028700"`) |
| no bullet | `<a:pPr indent="0" marL="0"><a:buNone/></a:pPr>` (explicit, by design — issue #589) |

Net per item: `<a:p><a:pPr marL="685800" lvl="1" indent="-342900"><a:buSzPct val="100000"/><a:buChar char="•"/></a:pPr><a:r>…</a:r></a:p>` — **genuinely native**: Tab/Shift-Tab promote/demote work, the Increase/Decrease List Level buttons work, numbers auto-renumber. Levels 0–8 map to master list levels (legal up to 32).

### 2.3 Mapping HTML `<ul>`/`<ol>`/nested → the API

- **`<ol>` → numbered** (`bullet:{type:'number'}`), **`<ul>` → bullet** (`bullet:true`); honor `data-pptx-list-type=bullet|number` override when present.
- **indentLevel = nesting depth**: count `<ul>/<ol>` ancestors within the list root, minus one. (Prefer structural nesting depth over CSS `margin-left` — the OOXML hanging indent is a fixed 0.36in ladder and won't pixel-match arbitrary CSS margins anyway.)
- **Per-`<li>` colored/bold runs**: reuse the existing run-splitter (`collect()`) so a `<li>` like "Pick the **right gear** today" yields three `<a:r>` runs in one bulleted paragraph.
- **First run of each `<li>`** carries `bullet` + `indentLevel`; **last run** carries `breakLine:true`.

### 2.4 Authoring gotchas (honor these or the XML degrades)

1. **Never embed literal `•`/`-`** in the text — auto-bullet + literal = double bullet.
2. **`breakLine:true` between items**, not `\n`-in-one-run.
3. **Keep continuation runs option-light** (color/bold only — no `align`, no `bullet`, no `indentLevel`). pptxgenjs calls `genXmlParagraphProperties` for *every* run (verified defect), re-emitting a stray `<a:pPr ... ><a:buNone/></a:pPr>` mid-paragraph; PowerPoint and LibreOffice tolerate it (last/first pPr wins) but it's technically malformed. **Do not set `bullet:false` on continuation runs** (forces an extra line break, issue #97).
4. **Prefer `paraSpaceAfter` over `lineSpacing`** with bullets (Anthropic skill warning).
5. Keep per-run `align` off — it forces a new `<a:p>`.

### 2.5 Code sketch

```js
// ── WALKER (in page.evaluate, BEFORE the TEXT-leaf branch in walk()) ──
const isList = (el) => el.tagName === 'UL' || el.tagName === 'OL'
  || el.getAttribute('data-pptx-role') === 'list';
if (isList(el)) {
  const ordered = el.tagName === 'OL'
    || el.getAttribute('data-pptx-list-type') === 'number';
  const depthOf = (li) => { let d = 0, p = li.parentElement;
    while (p && p !== el.parentElement) { if (/^(UL|OL)$/.test(p.tagName)) d++; p = p.parentElement; }
    return Math.max(0, d - 1); };
  const items = [];
  el.querySelectorAll('li').forEach((li) => {
    const lcs = getComputedStyle(li);
    const runs = []; collect(li, { color: rgbHex(lcs.color) || '221815',
      bold: parseInt(lcs.fontWeight, 10) >= 600, tt: lcs.textTransform });
    const liOrdered = li.closest('ol,ul')?.tagName === 'OL' || ordered;
    items.push({ runs: runs.length ? runs : [{ text: (li.textContent||'').trim(),
                   color: rgbHex(lcs.color) || '221815' }],
                 indentLevel: depthOf(li), ordered: liOrdered,
                 fontPt: ((parseFloat(lcs.fontSize)||16) * 72) / 96 });
  });
  ops.push({ kind: 'list', id, box: boxOf(el), items,
             color: rgbHex(getComputedStyle(el).color) || '221815' });
  return;                       // STOP descending — the whole <ul>/<ol> is one op
}

// ── NODE BUILD (new branch in the `for (const op of measured.ops)` loop) ──
else if (op.kind === 'list') {
  const runNodes = [];
  op.items.forEach((it) => {
    it.runs.forEach((r, ri) => {
      const o = { color: r.color || op.color, bold: !!r.bold };
      if (ri === 0) {                                   // FIRST run carries bullet + level
        o.bullet = it.ordered
          ? { type: 'number', style: 'arabicPeriod', startAt: 1 }
          : true;
        if (it.indentLevel) o.indentLevel = it.indentLevel;
      }
      if (ri === it.runs.length - 1) o.breakLine = true; // close THIS <li>'s paragraph
      runNodes.push(h(TextRun, { text: r.text, options: o }));
    });
  });
  push(h(Text, { x: op.box.x, y: op.box.y, w: op.box.w, h: op.box.h,
    fontFace: FONT, fontSize: Math.max(8, op.items[0]?.fontPt || 12),
    color: op.color, valign: 'top', align: 'left', margin: 0, wrap: true,
    fit: 'none', lang: 'ja-JP' }, ...runNodes));                // ONE addText → native list
}
```

---

## 3. Native Shapes & Grouping

### 3.1 Shapes are already native — keep them

The exporter already emits TRUE native shapes (not images): the `rect`/`rule` ops → `<RoundRect>` → `<p:sp><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj"…/></a:avLst></a:prstGeom>`, and icons → `CustomGeometry` → `<a:custGeom><a:pathLst>`. Both are editable (drag handles, recolor, change preset). Only complex-gradient/mask icons and chart SVGs are deliberately rasterized to PNG. **No change needed; do not switch to images.**

### 3.2 Can pptxgenjs emit `p:grpSp`? — No (verified)

`grep grpSp pptxgen.cjs.js` = **0 matches in object-generation paths** (the only `<p:nvGrpSpPr>`/`<p:grpSpPr>` is the one mandatory zero-extent `<p:spTree>` scaffold). There is no group type in `SLIDE_OBJECT_TYPES`. **Issue #307 is unimplemented through v4.0.1 (June 2025).** A native, editable group of shape+text as one selectable object is **impossible through the library API**.

### 3.3 The free middle tier — `addText({shape})` for single-text cards

For a card whose entire content is one text block on a fill, drop to pptxgenjs core (`addText(runs, {shape: pptx.ShapeType.roundRect, rectRadius, fill, line, …})`). That emits **one `<p:sp>`** carrying both `<a:prstGeom prst="roundRect">` and a `<p:txBody>` — a single selectable, editable object, **no zip surgery**. (The JSX `<RoundRect>` has no txBody slot, so this one case uses core directly.) Does **not** cover icon+heading+body cards — a `<p:sp>` has exactly one txBody and no child shapes.

### 3.4 True multi-element groups — raw `<p:grpSp>` post-injection (the only Node-only path)

OOXML defines `<p:spTree>` and `<p:grpSp>` as the **same complex type** (`CT_GroupShape`), so a group is structurally a sub-tree you splice in. After `write()`, reopen the zip (the font-embed path already does `JSZip.loadAsync(buf)`), parse `ppt/slides/slideN.xml` **with a preserve-order parser** (fast-xml-parser / @xmldom/xmldom — NOT regex, NOT a key-collapsing parser, or sibling order / z-order corrupts), find the card's contiguous `<p:sp>` run, and wrap it in a `<p:grpSp>`.

**The chOff/chExt invariant (the whole trick):** PowerPoint applies `scale = ext/chExt` and `translate = off − chOff*scale` to every child. Set **`chOff = off` and `chExt = ext`** → scale 1, translate 0 → every child's existing absolute EMU `<a:off>/<a:ext>` passes through **unchanged**, no per-child rescale math. `off`/`ext` = the union bounding box of the card's children.

**Why the contiguous-run assumption holds here:** the container branch pushes the card's bg `rect` op, then `[...el.children].forEach(walk)` — verified in the repo at the CONTAINER branch (~line 277). pptxgenjs writes shapes into `<p:spTree>` in add-order, so a card occupies a contiguous `<p:sp>` run = the splice target. Tag the card's bg with a sentinel `objectName` (`ak-card-K`) so pptxgenjs writes a findable `<p:cNvPr name="ak-card-K">`, and record the child count at build time.

```js
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
async function injectGroups(buf, cardRuns /* [{slide, name, count}] */) {
  const JSZip = (await dep('jszip')).default ?? (await dep('jszip'));
  const zip = await JSZip.loadAsync(buf);
  const opt = { ignoreAttributes:false, attributeNamePrefix:'@_', preserveOrder:true, suppressEmptyNode:true };
  const parser = new XMLParser(opt), builder = new XMLBuilder(opt);
  const bySlide = {}; cardRuns.forEach(c => (bySlide[c.slide] ||= []).push(c));
  for (const [slide, cards] of Object.entries(bySlide)) {
    const path = `ppt/slides/slide${slide}.xml`;
    const tree = parser.parse(await zip.file(path).async('string'));
    const spTree = findSpTree(tree);                 // preserveOrder node array
    let maxId = scanMaxCNvPrId(spTree);
    for (const card of cards) {
      const start = spTree.findIndex(n => spName(n) === card.name);
      if (start < 0) continue;
      const run = spTree.slice(start, start + card.count);     // contiguous <p:sp>
      console.assert(run.length === card.count && run.every(isSp), 'card run mismatch');
      const bb  = unionBBox(run);                              // {x,y,cx,cy} EMU
      const grp = makeGrpSp(++maxId, card.name, bb, run);      // chOff=off, chExt=ext
      spTree.splice(start, card.count, grp);                   // replace run with one grpSp
    }
    zip.file(path, builder.build(tree));
  }
  return zip.generateAsync({ type: 'nodebuffer' });            // then run validate-pptx gate
}
function makeGrpSp(id, name, bb, run) {
  return { 'p:grpSp': [
    { 'p:nvGrpSpPr': [ { 'p:cNvPr': [], ':@': { '@_id': String(id), '@_name': name } },
                       { 'p:cNvGrpSpPr': [] }, { 'p:nvPr': [] } ] },
    { 'p:grpSpPr': [ { 'a:xfrm': [
        { 'a:off':  [], ':@': { '@_x': String(bb.x),  '@_y': String(bb.y)  } },
        { 'a:ext':  [], ':@': { '@_cx': String(bb.cx),'@_cy': String(bb.cy) } },
        { 'a:chOff':[], ':@': { '@_x': String(bb.x),  '@_y': String(bb.y)  } },  // = off
        { 'a:chExt':[], ':@': { '@_cx': String(bb.cx),'@_cy': String(bb.cy) } }, // = ext → scale 1
      ] } ] },
    ...run,                                                    // child <p:sp> verbatim
  ] };
}
```

**Risk (HIGH — this is XML surgery):** failure mode is binary — any malformed off/ext/chOff/chExt, duplicated `cNvPr` id, or broken self-closing tag → PowerPoint "found a problem… repair". **The LibreOffice gate catches a blank/repaired render but does NOT reproduce PowerPoint's stricter repair check** — so a green LibreOffice render can still repair in real PowerPoint; require at least one manual PowerPoint open in QA. Other hazards: contiguity breaks if any future op is pushed out of order (assert `run.length === count` and every node `isSp`); ids must stay unique across the whole slide; scope groups to pure `sp`/`custGeom`/text cards first (`p:graphicFrame` tables/charts and `p:pic` need their frame nodes included). Adds `fast-xml-parser` as a real dependency (JSZip is already transitive).

---

## 4. Comparison Matrix

| Candidate | Native lists | Native shapes | True groups | Fits stack | Effort | Runtime switch | Fidelity ceiling | Verdict |
|---|---|---|---|---|---|---|---|---|
| **pptxgenjs native bullets** (`bullet`/`indentLevel`) | ✅ verified `buChar`/`buAutoNum`/`lvl`/`marL` | ✅ already (orthogonal) | ❌ | PERFECT (no runtime change) | Low (~30–40 LoC) | No | Editable lists, no groups | **TOP PICK (lists)** |
| **`addText({shape})` single-shape+text** | n/a | ✅ | ⚠️ one-`sp` cohesion only | PERFECT | Low | No | Cards with 1 text block only | **TOP PICK (simple cards)** |
| **Raw `p:grpSp` post-injection** | n/a (lists done) | ✅ re-parents native sp | ✅ real `p:grpSp` | GOOD (in-Node post-step) | Medium, **fragile** | No | All-or-nothing per slide (repair) | **TOP PICK (multi-element cards, flag-gated)** |
| **Faked visual grouping** (status quo flat siblings) | ❌ | ✅ | ❌ never one unit | PERFECT (it's today) | Zero | No | Multi-element card never one object | **REJECT** (= the gap) |
| **python-pptx** (`add_group_shape`) | ✅ | ✅ | ✅ best API | POOR (Python) | High | **Yes** | n/a — can't measure browser geometry | **REJECT** (integration cost) |
| **Apache POI** (`XSLFGroupShape`) | ✅ | ✅ | ✅ | POOR (JVM) | High | **Yes (heavier)** | n/a — no DOM measurement | **REJECT** |
| **Direct raw OOXML authoring** | ✅ in theory | ✅ | ✅ | PARTIAL (throws away pptxgenjs) | Very high + maintenance | No | Repair traps everywhere | **REJECT** (except the narrow injection subset) |
| **SmartArt** (DrawingDiagram) | ⚠️ loses geometry | ⚠️ no placement control | ⚠️ a diagram, not a `grpSp` | POOR (4-part, no lib support) | Very high | No | Breaks geometry-faithful model | **REJECT** |

---

## 5. Phased Implementation Plan

All phases behind the existing **LibreOffice render-back validate gate** (`scripts/validate-pptx.mjs`, `references/workflows/export-editable-pptx.md`).

### Phase 1 — Native lists (no new dependency)
- **`scripts/export-pptx-jsx.mjs`** — add the `isList` branch in `walk()` *before* the TEXT-leaf branch (~line 285) that emits a single `kind:'list'` op (Section 2.5); add the `op.kind === 'list'` branch in the build loop that maps items→`TextRun`s with first-run `bullet`/`indentLevel` and last-run `breakLine`.
- **Deck-template slide components** — support `data-pptx-role="list"` / `data-pptx-list-type="bullet|number"` annotations on `<ul>`/`<ol>` (plain `<ul>`/`<ol>` already classify; the attributes are the override hook for the role-dispatcher).
- **`references/pptx-editable.md`** — document the list `<Text>`/`<TextRun>` recipe (extend the existing TextRun recipes ~lines 210–238, 299–307); note the continuation-run `buNone` caveat and the "no literal bullet char" rule.
- **Verify** with `verify-pptx.mjs` / `verify-text.mjs`; pre-acknowledge the bullet-gutter column in the pixel diff (`diff-regions.mjs`) since it's new native ink.

### Phase 2 — Grouped cards
- **2a (ship first, low risk):** `addText({shape:'roundRect'})` collapse for single-text cards. Add a classifier in **`export-pptx-jsx.mjs`** that detects "rect op whose only child is one text leaf" and emits one shape-with-text instead of rect + sibling text. Native, no surgery.
- **2b (flag-gated `--group-cards`, medium/fragile):** raw `p:grpSp` post-injection in **`export-pptx-jsx.mjs`** beside the JSZip font-embed block. Tag card bgs with `objectName='ak-card-K'` and record child counts at build time; add `injectGroups()` (Section 3.4); add `fast-xml-parser` to **`deck-template/package.json`**. Scope to pure sp/custGeom/text cards; assert contiguity + sp-only + unique ids. **Add a manual-PowerPoint-open step** to the QA gate (LibreOffice alone is insufficient) — document in **`references/validation.md`** and **`references/workflows/export-editable-pptx.md`**.

### Phase 3 — Polish
- Numbered-list styles (`alphaLcPeriod`/`romanUcPeriod`) + `startAt` from `data-pptx-list-*`; custom bullet glyph via `characterCode` (★ 2605, ✓ 2713).
- Deeper nested levels (3–8) and per-item indent override only if a deck needs it.
- **Connectors/SmartArt: do NOT build** — high effort, low fidelity, breaks the geometry-faithful model. Skip unless a future deck makes them cheap and clearly worth it.
- Update **`references/pptx-export-research.md`** to record the grpSp injection decision and the chOff/chExt invariant as the canonical recipe.

---

## 6. Fidelity Ceiling — What Still Won't Transfer

- **True groups only via fragile surgery.** Without the `--group-cards` injection, multi-element cards export as ungrouped sibling shape+text — visually pixel-identical, but a click selects one piece, not the card. With injection it's fully native but **all-or-nothing per slide** (one malformed attr → whole-file repair); LibreOffice green ≠ PowerPoint safe.
- **Bullet indentation is a fixed ~0.36in EMU ladder**, not the source CSS `margin-left` — native and editable, but deep nests won't pixel-match the browser indent.
- **Stray `<a:buNone/>` pPr on continuation runs** in multi-colored bulleted items — tolerated by PowerPoint and LibreOffice today, technically invalid, unfixable via public API.
- **CSS `::marker` styling collapses** to OOXML's bullet model (one `buChar`/`buAutoNum` + `buSzPct`); independent marker color (`buClr`) and marker images don't transfer.
- **`buAutoNum` numbering restarts per text box** — separate `<ol>` boxes won't continue numbering across boxes (rarely needed).
- **Charts and complex-gradient/mask icons stay rasterized PNG** (deliberate fallback, orthogonal to this work) — a group can *contain* a `<p:pic>` but the picture itself stays non-editable.
- **A card with an icon + multiple text blocks can never be a single `<p:sp>`** — only `addText({shape})` single-text cards get one-object cohesion for free; everything richer needs the `p:grpSp` injection.

Relevant files (absolute): `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/deck-template/scripts/export-pptx-jsx.mjs`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/deck-template/scripts/validate-pptx.mjs`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/deck-template/package.json`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/references/pptx-editable.md`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/references/pptx-export-research.md`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/references/validation.md`, `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/references/workflows/export-editable-pptx.md`.
---

## Implementation status

- **NOT IMPLEMENTED (reverted 2026-06-22).** Phase 1 (native bullet lists) and Phase 2a
  (single-text card fusion) were prototyped and verified in the OOXML, but the rendered
  STYLING/SPACING fidelity (bullet glyph size, hanging-indent ladder vs. CSS margins,
  inter-item spacing) didn't match the source closely enough, so the changes were backed
  out. The exporter remains at native textboxes + shapes + tables + charts; lists export
  as plain text boxes. This research (the approach, OOXML recipes, and the Phase 2b
  `p:grpSp` injection plan) is kept as reference for a future, fidelity-focused attempt.
