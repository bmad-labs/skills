# Visual verification — reading and validating the page like a machine

These pages are visual and animation-timed. You cannot confirm them by reading code,
and a single screenshot misses overflow, clipping, contrast, jank, and "did the WebGL
canvas actually render anything". This doc is the **honest** verification playbook: what
to automate, exactly how, and — importantly — what still needs a human eye no matter what.

The bundled scripts implement all of this: `scripts/verify.mjs` (the stack below),
`scripts/slop-lint.mjs` (anti-slop linting), `scripts/gen-viz-manifest.mjs` + the
`window.__viz` API (reading the UI / resolving ids to source).

## The one principle

**Structure-first, stable ids, vision as a checked fallback.** The 2025–26 agent-grounding
consensus is that *grounding* (mapping intent → the exact element/code), not *seeing*, is the
bottleneck. Raw vision-model coordinate-clicking is unreliable (single-digit accuracy on hard
UI benchmarks). So the page should be **legible to a machine through its DOM + stable ids**,
and pixels are only used to verify what structure can't describe (the WebGL canvas, "does it
look right"). This is why the `data-viz-id` / `userData.vizId` convention is load-bearing, not
cosmetic — it is how both edit-mode and any agent read the page deterministically.

## What to AUTOMATE (and exactly how)

Run `node scripts/verify.mjs <url> --out report.json --shots shots/`. It does:

1. **Console** — fail on any error/warning on load. The cheapest, highest-signal check.
2. **Layout probes across 3 viewports (375 / 768 / 1280)** — pure DOM geometry, deterministic,
   no baseline needed:
   - *Horizontal overflow*: any element whose rect exceeds `documentElement.clientWidth` (1px epsilon).
   - *Text clipping*: tagged element with `scrollWidth > clientWidth` / `scrollHeight > clientHeight`
     under `overflow:hidden|clip` (ellipsis / line-clamp got cut).
   - *Overlap*: two tagged components whose rects intersect >35% of the smaller (ignoring
     ancestor/descendant pairs). Catches "these two nodes collide at mobile width".
   - Gotchas baked in: `getBoundingClientRect` is viewport-relative and already transform-aware
     (GSAP translate/scale is in the rect); `scrollWidth`/`clientWidth` are integer-rounded so a
     1px epsilon avoids false positives; this needs a real layout engine (meaningless in jsdom).
3. **Accessibility + contrast via axe-core (WCAG 2.2 AA)** → machine-readable JSON. Contrast
   violations carry `fgColor` / `bgColor` / `contrastRatio` you can act on directly.
   **Honest caveat:** automated a11y covers only ~1/3 of WCAG *criteria* (~57% of issue
   *instances*, weighted by the common ones). A clean axe run is a floor, not proof of
   accessibility — a page can pass axe and still be unusable by keyboard or screen reader.
   axe also can't read text rendered into `<canvas>`/SVG, so ignore contrast hits there.
4. **WebGL canvas actually rendered** — screenshot the canvas region and assert the pixels
   aren't uniform/black (channel spread + non-black fraction). **Do NOT use `gl.readPixels`** to
   prove rendering: three.js sets `preserveDrawingBuffer:false`, so reading after compositing
   returns black even when rendering is fine — the #1 false-negative trap.
5. **Deterministic animation frames** — to screenshot a specific moment of a GSAP timeline,
   **do NOT use `page.clock`**. It pauses virtual time but does not reliably pin a chosen frame
   (and a tracked Playwright bug stops rAF firing after fastForward). Instead expose a hook in a
   debug build and drive it:
   ```js
   window.__tl = myGsapTimeline;                 // your master gsap.timeline()
   // then, in the test:  __tl.pause(); __tl.progress(0.5);  // jump to exactly 50%
   ```
   For raw `requestAnimationFrame`/Three pages with no GSAP, expose
   `window.__renderFrame = () => renderer.render(scene, camera)` and call it before screotting.
   (`gsap.globalTimeline.pause()` is too broad — it freezes delayedCalls too; pin the specific timeline.)
6. **Jank / CPU during a scripted scroll** — `PerformanceObserver` on `longtask` +
   `long-animation-frame`, plus rAF frame-time distribution (p50/p95, % frames >16.7ms).
   **Report jank, not "fps":** headless GPU timing is not representative of real hardware, so an
   fps number is misleading. Gate on long-tasks / janky-frame % / CPU instead.

### Determinism for WebGL across machines
`toHaveScreenshot` on a Three.js canvas is GPU/driver-dependent and flaky unless you pin one
software renderer + one frame and use a generous `maxDiffPixelRatio`. Current Chromium flags
(the old `--use-gl=swiftshader` is dead; auto-fallback was deprecated so the opt-in is now
required or WebGL context creation fails → blank canvas):
```
--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader
```
On dedicated Linux CI, `--use-gl=angle --use-angle=gl` with Mesa llvmpipe is faster and equally
deterministic; SwiftShader-webgl is the portable cross-OS default.

### Anti-slop linting
Run `node scripts/slop-lint.mjs <url> --json slop.json`. It flags the *mechanical* AI-slop tells
that are actually measurable from DOM + computed styles (purple/indigo CTAs in the 250–300° hue
band, gradient-text heroes, neon glow shadows, uniform radius/padding, centered-Inter hero,
palette sprawl, type-scale sprawl, glassmorphism, emoji nav/headers, identical icon-card grids,
dark low-contrast body text, everything-centered). See `styling-and-anti-slop.md` for the why.

## What STILL needs a human (no tool fixes this — by design)

Automated aesthetic models explain only ~50–72% of human aesthetic ratings, and humans
themselves only agree at ~κ0.73 on "is this appealing" (and 34–48% on "what's wrong with it").
So treat these as **human-only**:

- **Does the metaphor land?** Is the 3D world meaningful or a gimmick for this domain?
- **Does it feel premium / on-brand?** "Looks like something we'd be proud to ship."
- **Is the motion tasteful?** Restrained and meaningful vs. busy and generic.
- **Does the narrative read?** Do the scroll beats tell the story a stakeholder will follow?

A clean `verify` + clean `slop-lint` means **"nothing mechanically broken and no obvious slop
markers"** — it is necessary, not sufficient. State results that honestly: report what you
verified, and hand the taste call to the human (that's what edit-mode is for).

## Reading the UI to act on feedback (the round-trip)

When the user sends edit-mode feedback, each item names a stable id. Resolve it in one hop:

1. If a `viz-manifest.json` was generated (`scripts/gen-viz-manifest.mjs`) and loaded as
   `window.__VIZ_MANIFEST`, edit-mode already attaches `source: {file, line, builderFn, cssRule}`
   to each comment — jump straight there.
2. Otherwise grep the id: `data-viz-id="<id>"` for DOM/SVG, `userData.vizId === '<id>'` /
   `registerVizObject(obj, '<id>')` for 3D. One id maps to exactly one builder.
3. `window.__viz.find(id)` returns the id's kind, on-screen rect, and source at runtime;
   `window.__viz.list()` enumerates every id; `window.__viz.pickAt(ndcX, ndcY)` raycasts the 3D
   scene. Use these to confirm you're editing the thing the user pointed at.

See `ai-collaboration-protocol.md` for the full id convention and edit-feedback JSON contract.
