# Report visualization widgets

Drop-in visual blocks for the HTML briefing. The default is **inline SVG + a little
vanilla JS** — zero dependencies, so a widget renders instantly, works offline, prints,
and can't be broken by a CDN outage or a framework runtime. (That last point is not
theoretical: a live JS-runtime delivery layer is exactly what broke every published
Claude artifact to a blank screen once — see the software-research report on this.)

Reach for a library (Mermaid / Chart.js) only for the two things bespoke SVG is bad at:
diagrams-from-text and standard data charts. Everything else, use a widget.

## The widgets (all zero-dependency)

| File | Use it for | Interactive? |
|------|-----------|--------------|
| `decision-tree.html` | Branching options, "which path", a recommendation flow | No (static SVG) |
| `annotated-diagram.html` | An architecture/mechanism drawing with numbered callouts | No (static SVG) |
| `timeline.html` | A journey, migration sequence, rollout, evolution over time | No (pure CSS) |
| `slider-metric.html` | The ONE "play with it" view — drag a variable, watch numbers recompute | Yes (~30 lines JS) |

Each file is a self-contained copy-paste block with `FILL:` markers and the briefing
palette baked in. Copy it into the report body, replace the FILLs, done.

## Which visual to use (decision order)

1. **Comparing named options across criteria?** → the `Side-by-Side` table already in
   `briefing-template.html` (section 01b). Don't draw a chart for a comparison.
2. **A branching decision / path?** → `decision-tree.html`.
3. **A sequence / journey / rollout over time?** → `timeline.html`.
4. **Explaining how something works (parts + relationships)?** → `annotated-diagram.html`,
   or Mermaid if it's a standard flow/sequence/ER diagram written as text.
5. **One variable the reader should feel the effect of?** → `slider-metric.html`. At most
   one interactive widget per report — more is noise.
6. **Real quantitative data (bar/line/scatter/radar)?** → Chart.js (see below).

Rule of thumb: prefer the table and the static widgets. Add the interactive slider only
when "drag it" genuinely teaches something. Keep any single SVG under ~500 elements — past
that, use Chart.js/Canvas instead.

## Escape hatch: Mermaid (diagrams-from-text)

Good when a diagram is easier written as text than drawn as SVG (flowchart, sequence, ER,
state). It is a real dependency — treat it with care:

- **Pin the exact version.** Mermaid has broken across *minor* releases. Use a fixed
  version, e.g. `mermaid@11.16.0`. Never a floating tag.
- **Keep `securityLevel: 'strict'`.** The interactive `'loose'` mode is the XSS-prone mode;
  don't enable it to get click handlers.
- **It renders client-side only** (no SSR) and is heavy (re-runs layout per diagram). Load
  it once, only when the report actually contains a diagram.
- **Pin with SRI**, or better, inline the library so a CDN outage can't blank the report:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js"
          integrity="sha384-REPLACE_WITH_REAL_HASH" crossorigin="anonymous"></script>
  <script>mermaid.initialize({ startOnLoad: true, securityLevel: 'strict' });</script>
  <pre class="mermaid">flowchart LR; A[Client]-->B[API]-->C[(DB)]</pre>
  ```
  Generate the real SRI hash from the exact file you pin (e.g. `openssl dgst -sha384 -binary
  mermaid.min.js | openssl base64 -A`).

## Escape hatch: Chart.js (standard data charts)

Good for bar/line/scatter/radar of actual numbers (benchmarks, scores, TCO). It's the
smallest mainstream chart lib and takes *data*, not an executable spec, so it has the
narrowest attack surface. Same delivery rules: pin a version, prefer SRI/inline over a bare
CDN tag. Note Chart.js `<canvas>` is invisible to screen readers — add an `aria-label` and a
text fallback. (Chart.js maintenance was slowing as of mid-2026; fine to use, worth watching.)

## Security: the one rule that matters

If YOU fill these templates, the JS is code you control — safe to inline.

If instead you let the model **generate arbitrary widget markup/JS**, that generated code
runs in the report's origin with full DOM access. Sandbox it:

```html
<iframe sandbox="allow-scripts" csp="connect-src 'none'" srcdoc="...generated widget..."></iframe>
```

Use `sandbox="allow-scripts"` WITHOUT `allow-same-origin` (the two together defeat the
sandbox), and block `connect-src` so the widget can't phone home. Subresource Integrity does
**not** help here — SRI verifies a library you load, not the code you injected.
