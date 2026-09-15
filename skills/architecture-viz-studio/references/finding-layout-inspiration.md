# Finding Layout Inspiration

How to find layout/diagram inspiration online so the output isn't generic — and how to translate it into this skill's templates without copying. Pull the STRUCTURE/INTERACTION idea; re-skin to the brand.

## Table of contents
- [The core move: steal structure, not skin](#core-move)
- [Scroll-story landing pages](#scroll-story)
- [The scrollytelling product-site genre](#scrollytelling-genre)
- [Diagram & architecture layout sources](#diagram-sources)
- [Inspiration from games (the lens system)](#games)
- [How to translate inspiration into the templates](#translate)

---

## Core move

Inspiration sites give you two things worth taking: **structure** (how the page/diagram is organized, the section rhythm, the layout grid) and **interaction** (how the user moves through it — scroll choreography, hover/drill-down, overlays). Take those. **Do not take the skin** — colors, fonts, exact compositions belong to that brand. Re-skin everything to the user's design system (or the neutral defaults). Goal: "this has the *clarity* of a Linear page and the *overlay idea* from ONI," not "this looks like a copy of X."

Concretely: when you study a reference, write down the *verbs* (pins the hero while text scrolls past; reveals a 3D object on enter; dims the map except the active layer) — not the *nouns* (purple gradient, that specific font). Implement the verbs with the skill's templates and the user's palette.

---

## Scroll-story

For cinematic scroll-narrative landing pages (the hero/journey half of these builds):

- **Awwwards** (awwwards.com) — the canonical award gallery; filter by "Sites of the Day," tag *Scroll*, *WebGL*, *3D*. Best single source for scroll-story craft. Study the *pacing*.
- **Godly** (godly.website) — curated, tasteful, less flashy-for-its-own-sake than Awwwards; great for restraint and type.
- **Httpster** (httpster.net) — broad, current, good for clean/typographic directions.
- **Land-book** (land-book.com) — large landing-page library; filter by style/industry to see how a given domain presents itself.
- Also: **SiteInspire**, **Minimal Gallery**, **Lapa Ninja** (landing pages), **Refero** / **Mobbin** (real product UI patterns).

What to extract: section rhythm (how many beats, how long each dwells), where the 3D enters and exits, how copy is paced against scroll, how the nav behaves, where whitespace sits.

---

## Scrollytelling genre

A specific genre to internalize — **isometric-3D-scroll product narratives**:

- **vectrfl.com-style** isometric-3D-scroll pages — an isometric world that the camera flies through as you scroll, objects animating in. This is the closest cousin to the skill's hero journey; study how the camera path is choreographed to the story beats.
- **Stripe / Linear / Vercel-style product pages** — masters of *restraint + motion*: flat chrome, one accent, precise type, subtle scroll reveals, a single tasteful 3D/canvas moment. The bar for "professional, not slop." Linear especially for dark-mode + monospace + crisp diagrams.
- **Apple-style scroll narratives** (product pages, the AirPods/Mac-style pinned-canvas scroll) — the gold standard for *pinned-stage + scrubbed-canvas* storytelling: one fixed visual, content and camera scrubbed by scroll. This is exactly the skill's fixed-canvas + tall-scroll-driver pattern.
- Agency/portfolio WebGL sites (Active Theory, Resn, Active-ish studios) for ambitious camera/material ideas — take the *idea*, dial the flash *way* down for an architecture page.

What to extract: the pinned-stage-scrub mechanic, beat-to-camera-pose mapping, the discipline of *one* 3D moment done well rather than effects everywhere.

---

## Diagram sources

For the reference/diagram half (blueprint map, ERD, component views), learn from how real architects lay things out:

- **C4 model** (c4model.com, Simon Brown) — the discipline of *levels*: System Context → Container → Component → Code. Drives the skill's drill-down (click a node → component detail) and the lane structure. Don't cram all levels in one diagram.
- **Minto Pyramid** — top-down structuring of an argument/system; informs ordering the page so the big claim leads and detail nests below.
- **Crow's-foot ERDs** — the standard for data models (cardinality at endpoints, verb in the middle). Study clean textbook examples for notation; see diagram-catalog.md → ERD for the hub-and-spoke layout that avoids crossings.
- **Observable / D3 galleries** (observablehq.com, d3-graph-gallery) — for force/hierarchy/graph layout ideas and edge-routing inspiration when a diagram gets dense.
- **Excalidraw libraries** & **Whimsical** examples — for the *hand-drawn architecture sketch* vibe and sensible node/edge spacing; good for seeing how humans naturally lay out boxes-and-arrows.
- **Stripe/AWS/Google reference architectures** — for how serious infra diagrams use lanes, boundaries, and managed-service glyphs (deployment/topology).
- The skill's own companion **architecture-diagrams** skill (PlantUML/C4/ERD) — for getting the *content* and notation right before styling it into the interactive SVG.

What to extract: notation correctness, level discipline (drill-down vs cram), lane/boundary structure, edge-routing that doesn't cross.

---

## Games

The **overlay-lens system came from a game**: **Oxygen Not Included**'s overlay metaphor — one base, switchable overlays (oxygen / power / plumbing / temperature) that re-read the *same* map for a different concern. That maps perfectly to architecture: one system map, lenses for Data Flow / Event Sourcing / Ownership / Reliability / Access. SimCity/Cities:Skylines data overlays, Factorio's alt-mode info layer, and Dwarf-Fortress-style designation views are the same idea. When a system has many orthogonal concerns over one topology, reach for an overlay system instead of N diagrams (see diagram-catalog.md → overlay-lens).

More game-derived ideas worth borrowing: tooltip-on-hover for node detail, a "tour" that walks the map once (like a tutorial), color-coded info layers, a legend that doubles as a filter.

---

## Translate

To turn inspiration into output **without copying**:

1. **Name the verb.** Reduce the reference to its structural/interaction mechanic ("pinned canvas, scrubbed camera through 5 beats"; "one map, dimmable layers"; "hub-and-spoke ERD"). Discard the visuals.
2. **Pick the template.** Map the verb to a skill asset: scroll journey → `scroll/scroll-journey.js` + fixed `.stage`; overlay → `diagrams/overlay-lens-system.js`; drill-down → `diagrams/component-detail-modal.js`; ERD → `diagrams/erd-diagram.js`; pan/zoom → `diagrams/pan-zoom-viewport.js`.
3. **Re-skin to the brand.** Apply the user's design system (or neutral defaults) per styling-and-anti-slop.md — colors via tokens, fonts via the pairing, 3D via `PALETTE`. The structure is borrowed; every pixel of skin is the user's.
4. **Fit the content.** Replace example copy/data shapes (`OVERLAYS`, `ERD`, camera beats) with the actual system. Map each beat/node to a real component (and a `userData.vizId` / `data-viz-id`).
5. **Sanity-check against slop tells** and the restraint rules. A reference that looks great can still lead you to over-decorate — keep it quiet.

Never reproduce a reference's exact composition, copy, or assets. Inspiration is for *how it's organized and how it moves*; the result must be unmistakably the user's own system in the user's own brand.
