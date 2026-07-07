# Edit mode — point-and-comment feedback on a live deck

Edit mode is a vanilla-JS overlay wired into the deck template
(`deck-template/public/edit-mode/`). A human opens the running deck, **selects the
exact things they mean**, attaches a comment to each, and hands you one payload that
names every target by its stable `data-viz-id`. You read it and edit in one hop —
no "make the third thing smaller… no, the OTHER third thing" round-trips.

It is an **authoring tool only**. Every export strips it (see
[deck-template.md](deck-template.md)).

## First diagnostic when the user reports "no change" / "edit mode vanished"

If the user says *"I don't see any change,"* *"no change detected,"* or *"edit mode just
disappeared,"* the cause is almost always a **dead or restarted dev server** — not the
slides. Edit mode is a script the browser loaded once; if you `pkill vite` / restart
`serve.mjs` (e.g. to clear a Vite cache), the user's existing tab keeps the old script
pointed at a now-dead bridge, HMR swaps slides underneath it, and the overlay wedges or
shows stale pixels. **Check liveness before you debug anything in the JSX:**

```bash
lsof -ti:5173 >/dev/null && echo "vite UP" || echo "vite DOWN"     # page server
lsof -ti:8930 >/dev/null && echo "bridge UP" || echo "bridge DOWN" # feedback bridge
```

If either is down, restart `node scripts/serve.mjs --dev`, confirm it's serving
(`__DECK.total` equals your slide count via a quick headless probe), then tell the user
to **hard-refresh** (`Cmd/Ctrl+Shift+R`) so the fresh edit-mode script loads. Only after
that should you suspect the slides. Never tell the user "it's live, refresh" without
having confirmed the port actually responds — you'll send them to a stale page and
"verify" against renders they aren't seeing.

Related: a mid-session `rm -rf node_modules/.vite` while the dev server is running can
also crash it (the optimizer re-scans and may choke on built artifacts in
`export/` / `dist-standalone/`). If you must clear the Vite cache, kill the server
first, clear, then restart — and keep `optimizeDeps.entries: ['index.html']` +
`server.watch.ignored` for `export/**` and `dist-standalone/**` in `vite.config.js` so
the dev server never crawls exported bundles.

## Annotate every element (the one rule that makes this work)

Tag **every meaningful node** with a dotted `data-viz-id` — headings, eyebrows,
paragraphs, KPI numbers, cards, the accent rule, images — **not just containers**.
Edit mode can only select a node that has its own id; an untagged node falls
through to its parent, so the user can't point at it precisely.

```jsx
<div className="slide-page" data-viz-id="s3">
  <span data-viz-id="s3.eyebrow" className="text-eyebrow …">Adoption</span>
  <h1 data-viz-id="s3.title">… <span data-viz-id="s3.title.accent">week one</span></h1>
  <div data-viz-id="s3.kpi.value">…</div>
</div>
```

Scope ids to the slide (`s3.*`) and keep them stable across edits. When you add a
slide, annotating all its elements is part of the job — the example slide
(`deck-template/src/slides/00-EXAMPLE-hero-metrics.jsx`) shows the pattern.
Components that render a tagged element (`CountUp`, `AccentRule`) forward
`data-viz-id` to their root, so `<CountUp data-viz-id="s3.kpi.value" />` works.

**Inside an `<svg>`, tag the inner shapes too — not just the `<svg>` wrapper.** An SVG
chart/diagram/map with only the root tagged is one giant selectable blob; the user
can't point at a single bar, the path, a label, a marker. Put `data-viz-id` on every
meaningful SVG child (`<path>`, `<rect>`, `<text>`, `<g>` groups, each data point), and
group related primitives under one `<g data-viz-id>` so a logical unit (a labelled
marker = circle + text) selects as one. Derive the child ids from the svg's id
(`${dataVizId}.path`, `${dataVizId}.wall.0`, `${dataVizId}.object.cup`) so they stay
unique across multiple SVGs on a page. Edit mode hit-tests DOM nodes, so a tagged SVG
child is individually selectable exactly like a div.

## Tools

Toggle the whole tool with the ✎ button or the **`e`** key. View toggle: **Normal**
(reveal an element's box + id on hover) / **Expert** (`x` — show all ids at once,
works regardless of the active tool).

Tool shortcuts are **letters** (not numbers) so they never clash with the deck's
`1`–`9` slide-jump keys:

- **Pointer** (`V`) — interact with the deck normally; clicks pass through.
- **Select** (`S`) — the main tool:
  - **single** — click one element → one comment.
  - **multiple** — ctrl/⌘+click to add/remove elements; an orange chip shows the
    count; **Enter** (or plain-click) bundles them into ONE comment with many
    `targetIds`.
  - **drag = snip** — press-drag a box: the elements inside highlight live as the
    box passes over them, then on release it captures a screenshot of the **tight
    box around those elements** (or the raw drag box if it hit empty space), records
    their ids as `relatedIds`, and opens the comment popup immediately. Starting
    another drag discards an open, uncommitted popup.
  - **the slide container** (`.slide-page`, e.g. `s3`) wraps everything, so it is NOT
    grabbed by hover or swept into a marquee — that would shadow its content. To comment
    on the whole slide, **hover/click near the slide's edge** (a ~24px band); an interior
    hover/click always targets the content under the cursor instead.
- **Brush** (`B`) — paint a freehand region → screenshot of its bounding box + the
  ids it covers; opens the comment popup.

**Hold LEFT SHIFT** for a momentary **Pointer** (interact with the page); release →
back to the tool you were using. `Escape` cancels a pending selection / drag / popup.

Keys: `e` toggle edit · `x` expert view · `V`/`S`/`B` tools · `1`–`9` jump to slide.

### Capture performance

The snapshot library (`html-to-image`) is vendored next to the overlay
(`public/edit-mode/html-to-image.js`) so it loads instantly, and edit-mode does a
hidden full-page warm render on init — so the first snip is fast (~80ms), not the
~1s a cold first render would cost. Captures use `skipFonts` (the snip is a
reference image; web-font fidelity isn't needed).

## Getting feedback back to you — "Copy for AI"

The comment panel's **"Copy for AI"** is the one button:

- **With the bridge running** (recommended): `node scripts/serve.mjs deck-template`
  starts the feedback-bridge on **:8930**; the deck is pre-wired to it. "Copy for
  AI" POSTs the batch + snip PNGs, and the bridge writes
  `/tmp/mti-slide-edit/edit-feedback.json` + `snip-N.png`. The user says **"read the
  feedback"** and you read the JSON (+ images by absolute `imagePath`).
- **Without the bridge:** "Copy for AI" copies human-readable **markdown** to the
  clipboard. When the user **dragged a snip**, the bridge wrote the PNG and the markdown
  carries its **absolute path** on a `screenshot (Read this image): <path>` line, plus a
  banner at the top. **A snip is the whole point of the comment — when you see that line,
  `Read` the image before acting; the comment ("the table looks bad, make it better")
  only makes sense alongside what it shows.** (If the user pasted markdown with a bare
  `snip-N.png` and no path, the bridge wasn't running — ask them to start `serve.mjs` and
  re-copy, or to attach the image directly.)
- **Download:** saves `edit-feedback.json` + `snip-N.png` to ~/Downloads; the user
  runs `node scripts/receive-feedback.mjs` to land them in `/tmp/mti-slide-edit/`.

## The feedback payload — `mti-slide/edit-feedback@1`

```json
{
  "schema": "mti-slide/edit-feedback@1",
  "page": "/",
  "capturedAt": "2026-06-19T…Z",
  "imageDir": "/tmp/mti-slide-edit",
  "comments": [
    {
      "kind": "component | multi | area | brush",
      "targetIds": ["s3.kpi.value"],          // what was clicked/selected
      "relatedIds": ["s3.card.1", "s3.card.2"],// ids inside a snip/brush/marquee region
      "rect": { "x": 440, "y": 150, "width": 320, "height": 90, "right": 760, "bottom": 240 },
      "comment": "make this number bigger and green",
      "hasScreenshot": true,
      "screenshotFile": "snip-1.png",
      "imagePath": "/tmp/mti-slide-edit/snip-1.png",
      "slideContext": { "index": 2, "label": "Adoption", "viewport": [1920, 1080] }
    }
  ]
}
```

**How you consume it:** for each comment, resolve every `targetIds` /`relatedIds`
by grepping the `data-viz-id` in `src/slides/*.jsx` → that's the exact JSX to edit.
`imagePath` gives visual context for snip/brush comments; `slideContext.label`/
`index` tells you which slide.

## Driving edit mode programmatically (the agent)

Everything a human does by clicking, the agent can do **headlessly** via the
`window.EditMode` API — query elements, box them, author feedback comments, and emit
the SAME `mti-slide/edit-feedback@1` batch. Useful for self-review, automated
annotation, or scripted round-trips. (Edit-mode is injected into the served deck by
the driver; see `scripts/lib/deck-driver.mjs` `injectEditMode`.)

**Inspect — query / box elements (returns geometry):** use this to learn an
element's **position, boundary, coordinates**, or the **spatial relationship**
between elements (gaps, alignment, overlap — all derivable from the returned rects).
The drawn boxes are **orange** (deliberately outside the MTI green/yellow/ink
palette) so an inspection box never reads as actual slide content.

```js
EditMode.inspect({ ids: ['s3.title', 's3.kpi.value'] })  // → [{id,x,y,w,h}, …]
EditMode.inspect({ all: true })                          // box + label every tagged el
EditMode.inspect({ clear: true })                        // remove the overlay
```

**Author feedback — the programmatic equivalent of select → comment → Copy-for-AI:**

```js
// comment on element(s); captures the tight box around them as the snip
await EditMode.addComment({ ids: ['s3.kpi.value'], text: 'make this bigger and green' });
await EditMode.addComment({ ids: ['s3.card.1','s3.card.2'], text: '…' });          // multi
await EditMode.addComment({ rect: {left,top,width,height}, text: '…' });           // area, no ids
// pass screenshot:false to skip the capture (rect/ids still recorded)

EditMode.listComments();        // the comments so far
EditMode.clearComments();
EditMode.getFeedback(true);     // → the full mti-slide/edit-feedback@1 batch + markdown
```

`addComment` infers `kind` (`component` / `multi` / `area`), captures the snip
(tight box around the ids), and stamps `slideContext`. `getFeedback()` returns the
identical batch the human "Copy for AI" produces.

**Built-in inspection tool — `scripts/inspect.mjs`.** The packaged command that runs
this whenever the agent needs to see element positions/relationships. It captures
two ways and writes geometry, to `/tmp` (deck stays clean):

```bash
node scripts/inspect.mjs --slide 1 --ids s1.card.1,s1.card.2   # default: --mode both
node scripts/inspect.mjs --slide 1 --all                       # box every element
node scripts/inspect.mjs --slide 1 --ids s1.kpi.value --mode clean
node scripts/inspect.mjs --slide 1 --ids s1.card.1 --comment "tighten spacing"
```

| flag | effect |
|------|--------|
| `--mode highlight` | capture **with** the orange id boxes — see positions + spatial relations |
| `--mode clean` | capture **without** overlay — the real visual |
| `--mode both` (default) | both PNGs |
| `--all` | target every tagged element on the slide |
| `--ids a,b,c` | target specific elements |
| `--comment "…"` | also author a feedback comment (writes `edit-feedback.json` + `snip-N.png`) |
| `--out <dir>` | output dir (default `/tmp/mti-slide-inspect`) |

Outputs: `geometry.json` (exact `{id,x,y,w,h}`), `slide-NN-highlight.png` (orange
boxes), `slide-NN-clean.png` (clean), and — with `--comment` — the
`mti-slide/edit-feedback@1` batch. **Read the PNGs** to judge layout; read
`geometry.json` for exact coordinates.

## Notes

- DOM-only — no 3D (this is the slide port of architecture-viz-studio's edit mode).
- **Box color convention:** every box drawn ON the slide — hover, selection,
  multi-select, the snip drag box, brush, expert-view, and agent inspect — is
  **orange** (`--em-inspect #FF6A00`), deliberately OUTSIDE the MTI green/yellow/ink
  palette so a box never reads as actual slide content. The toolbar/panel chrome
  stays MTI green — it sits on dark ink, away from the slide.
- The overlay uses its own `--em-*` CSS vars so it never collides with the deck.
- It lives in `public/edit-mode/` for dev convenience; the standalone build deletes
  it from the output and removes its `<link>` (belt-and-suspenders: the export
  driver also removes any `.em-*` nodes before capture).

### Invariants (each was a real bug — don't reintroduce)

- **Edit-mode is a SINGLETON.** The script bails if `window.EditMode` already exists,
  and the App loader re-inits the existing instance instead of injecting a second
  `<script>`. React Strict-Mode's dev double-mount otherwise creates **two `.em-root`s +
  two comment popups**, and clicks/typing land on the wrong one (the popup looks dead).
  Do NOT add a cleanup that removes the instance on unmount — that's what caused the dup.
- **A mousedown/mouseup whose POINT is inside the open popup is for the popup** — bail
  before starting a marquee or closing it. The popup floats over slide content (it opens
  on e.g. the table header), so hit-testing can resolve `e.target` to the element behind
  it; without the point-in-popup guard, clicking the comment box selects that element.
- **A ⌘/ctrl gesture is a toggle-click, never a marquee.** While ctrl is held, skip the
  live marquee `liveHighlight` (it does `state.selection = …`, replacing the buffer) and
  treat the gesture as a toggle even if the hand jittered a few px past the move
  threshold. Otherwise multi-select "randomly resets" mid-selection.
- **Capturing a snip hides `.em-root` (to keep our UI out of the shot), which blurs the
  focused textarea** — save and restore focus around the capture, or the comment box goes
  un-typeable after a snip.
- **The copied "Copy for AI" markdown must carry the snip's ABSOLUTE path** (`screenshot
  (Read this image): /tmp/mti-slide-edit/snip-N.png`) + a banner, so the agent actually
  reads the image. A bare `snip-N.png` filename is invisible to it.
