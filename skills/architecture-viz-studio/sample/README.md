# Sample — a complete, correct reference page

This is a small but **fully working** scroll-story page that applies every convention in the skill
correctly. It's the fastest way to see how the pieces fit together — read it before building from
scratch, and copy its patterns.

## What it demonstrates

- ⭐ **The studio-grade WOW bar** (`references/wow-quality-bar.md` → the Biggest-5). This isn't a flat
  student scene — it applies: **(1)** the sRGB + ACES tone-mapping pipeline; **(2)** HDRI/`RoomEnvironment`
  IBL via PMREM; **(3)** `pmndrs/postprocessing` **selective bloom** (only the emissive accents glow) +
  vignette + film grain in one merged `EffectPass`; **(4)** three-point lighting with a **rim light** + soft
  contact shadows; **(5)** an eased, **staged** GSAP reveal (nodes rise/scale in with stagger) + damped
  mouse parallax + `FogExp2` depth, on a deep, moody value range so the accents pop. Copy this as the
  template for "wow", not just "no bugs".
- **A continuous animated scene done right** (`main.js`) — flowing particles + a pulsing data-grid, but the
  render loop **pauses when the stage is covered / tab-hidden** (observing the content that scrolls over the
  fixed canvas, not the canvas itself — the documented gotcha), fps + DPR capped, the grid throttled.
- **Recognizable modelled nodes, not generic stacked boxes** — a studio building with a window grid + reel,
  server racks with rack-unit slats + LED strips, a datacenter origin, a satellite-dish edge node, a TV.
- **Named builder functions, one per object**, each setting `userData.vizId` — so feedback resolves to
  exactly one builder. The ground/city/grid set `userData.vizSelectable = false` (backdrops, not targets).
- **Every text element tagged** — headings, paragraphs, nav links, the beat numbers, the footer text
  each carry their own dotted `data-viz-id` (`beat.edge.title`, `footer.text`), not just the
  containers. Passes `text-audit.mjs`.
- **The architect view** (`#architecture` + `diagrams/`) — one dark "blueprint" system map of the CDN
  delivery domain read through **five lenses** (Systems · Data Flow · Asset Sourcing · Ownership ·
  Reliability; keys `1`–`5`, with a gentle auto-tour). Two map nodes **drill down** into a component
  design: *Encode pipeline* opens the SVG **Process Event Pipeline** band (shot-split → … → **Encode
  Engine [PURE]** → … → Publish, with the Event-History T0–TN timeline + pan/zoom), and *Delivery
  workflow* opens the **lanes** view (planners / effect handlers / reads). The *Catalog* node opens an
  **ERD** of the asset store (crow's-foot relationship lines, pan/zoom). This wires the reusable
  `overlay-lens-system`, `component-detail-modal`, `erd-diagram` and `pan-zoom-viewport` modules — only
  the copy is domain-specific. Modals close on ×/backdrop/`Esc`, suppress the `1`–`5` lens keys while
  open, and pause the 3D loop via `window.__setModalRenderPause`.
- **Edit-mode wired** with the optional `viz-manifest.js` (so comments carry `source: file:line`) and
  `viz.js` (the `window.__viz` query API). Toolbar + comment panel are draggable.
- **Restrained, anti-slop styling** (`styles.css`) — one accent, neutral greys, real type scale,
  left-anchored hero. Passes `slop-lint.mjs` (its only flag is the intentional 3-card grid).

## Run it

```sh
# from the skill root, with edit-mode assets reachable:
cp -r assets/edit-mode sample/edit-mode      # the sample's index.html includes edit-mode/*
./scripts/serve.sh sample                    # starts the page (8800) + feedback-bridge (8910) together
# open http://localhost:8800/  — toggle edit mode with the ✎ button or `e`.
# "Copy for AI" copies the markdown AND saves snips to /tmp/viz-edit (bridge is up via serve.sh).
```

The `viz-manifest.json` here was generated with
`node scripts/gen-viz-manifest.mjs sample --as-js` (pointed at the page source only — never at the
edit-mode tooling, or its doc comments pollute the DOM-id source locations).

## The point

If you ever wonder "how should X be wired correctly," look here first — this page has already been
through ~15 rounds of real bug-fixing (see `references/gotchas-and-lessons.md` for the bugs it now
avoids). Don't reinvent; adapt.
