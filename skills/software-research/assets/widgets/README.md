# Report visualization widgets

Drop-in visual blocks for the HTML briefing. The default is **inline SVG + a little
vanilla JS** — zero dependencies, so a widget renders instantly, works offline, prints,
and can't be broken by a CDN outage or a framework runtime. (That last point is not
theoretical: a live JS-runtime delivery layer is exactly what broke every published
Claude artifact to a blank screen once — see the software-research report on this.)

Reach for a library (Mermaid / Chart.js) only for the two things bespoke SVG is bad at:
diagrams-from-text and standard data charts. Everything else, use a widget.

## The widgets (all zero-dependency)

Every file is a self-contained copy-paste block with `FILL:` markers and the briefing
palette baked in. Copy it into the report body, replace the FILLs, done. Grouped by job:

**Compare & decide**
| File | Use it for |
|------|-----------|
| `comparison-matrix.html` | options × criteria, pass/warn/fail/partial cells (also feature-support) |
| `weighted-decision-matrix.html` | options × weighted drivers, shaded, computed total + winner (editable weights) |
| `quadrant-plot.html` | generic 2×2 scatter engine — set labels for value-vs-effort, power-vs-interest, etc. |
| `risk-heatmap.html` | likelihood × impact stoplight grid with risks plotted |
| `decision-tree.html` | branching options, "which path", a recommendation flow |
| `rice-score-table.html` | RICE prioritization: Reach·Impact·Confidence/Effort score |

**Numbers & evidence**
| File | Use it for |
|------|-----------|
| `metric-bars.html` | ranked horizontal bars for one metric (benchmark, bundle KB, cost), winner highlighted |
| `range-bar.html` | min–median–max / p50-p95-p99 spread per option |
| `donut-gauge.html` | single circular %/score (coverage, confidence, error budget) |
| `kpi-row.html` | row of big-number cards with up/down delta |
| `evidence-confidence.html` | per-finding source-tier (1–6) + confidence (1–10) — the trust indicator |
| `severity-summary.html` | CVE roll-up: crit/high/med/low bars + CVSS chip + affected range |
| `radar-scores.html` | multi-attribute scoring polygon (ISO 25010) |
| `cost-tco-breakdown.html` | stacked TCO bars (license/build/ops/migration) |
| `cost-projection-lines.html` | cost over time, current vs chosen path |
| `cost-treemap.html` | proportional "where the money goes" rectangles |

**Explain how it works**
| File | Use it for |
|------|-----------|
| `annotated-diagram.html` | a drawing with numbered callouts |
| `sequence-flow.html` | actor lifelines + numbered message arrows (request/failure path) |
| `c4-container-view.html` | C4 boxes + labeled connectors (hand-placed) |
| `state-machine.html` | states + transitions, hand-placed (auto-layout → Mermaid) |
| `before-after-architecture.html` | current vs proposed, side by side |
| `capacity-scaling-curve.html` | a metric vs load, knee/saturation |
| `quality-attribute-tree.html` | ATAM utility tree: attribute → refinement → scenario (H/M/L) |
| `code-compare.html` | two code snippets side-by-side / A-B tabs |
| `diff-block.html` | unified +/- diff |

**Sequence & status over time**
| File | Use it for |
|------|-----------|
| `timeline.html` | a journey / evolution over time |
| `phasing-roadmap.html` | Now / Next / Later lanes |
| `migration-checklist.html` | ordered steps with effort/risk/breaking tags |
| `deployment-pipeline.html` | CI/CD stages + gate type + status |
| `rollout-bar.html` | canary/blue-green % split + rollback marker |
| `rag-status-board.html` | workstreams × Red/Amber/Green + road-to-green |
| `slider-metric.html` | the ONE interactive "drag it" view — recomputes numbers |

**Org & management**
| File | Use it for |
|------|-----------|
| `org-chart-tree.html` | reporting hierarchy (hand-placed) |
| `team-topologies-map.html` | 4 team types + 3 interaction modes |
| `raci-matrix.html` | tasks × roles, R/A/C/I |
| `skills-heatmap.html` | people × skills proficiency (spot single-points-of-failure) |
| `okr-alignment-tree.html` | company → team → individual goals + progress |
| `ownership-map.html` | team → service (Conway's law) |
| `escalation-ladder.html` | on-call → lead → manager → IC → exec + SLA |
| `spotify-model-grid.html` | squads × tribes × chapters × guilds |
| `region-az-topology.html` | regions/AZs + replication links |
| `maturity-radar-rings.html` | Adopt/Trial/Assess/Hold rings + blips |
| `error-budget-gauge.html` | SLO budget arc + burn bands |

**Inline accents**
| File | Use it for |
|------|-----------|
| `callout.html` | note / tip / important / warning / danger boxes (also "gotchas") |
| `status-badge.html` | small `label:value` pills (version, license, "recommended") |
| `verdict-card.html` | standalone at-a-glance recommendation card |

## Which visual to use (decision order)

1. **Comparing named options across criteria?** → `comparison-matrix.html` (or the
   `Side-by-Side` table in `briefing-template.html` for the headline compare). Add
   `weighted-decision-matrix.html` when drivers have weights.
2. **A branching decision / path?** → `decision-tree.html`.
3. **Positioning options on two axes?** → `quadrant-plot.html` (set the axis/quadrant labels).
4. **Ranking one metric across options?** → `metric-bars.html`; spread → `range-bar.html`.
5. **A sequence / journey / rollout over time?** → `timeline.html`, `phasing-roadmap.html`,
   or `deployment-pipeline.html` / `rollout-bar.html` for delivery.
6. **Explaining how something works?** → `annotated-diagram.html` / `sequence-flow.html` /
   `c4-container-view.html`, or Mermaid if it's a standard flow/sequence/ER written as text.
7. **One variable the reader should feel?** → `slider-metric.html`. At most one interactive
   widget per report — more is noise.
8. **Org / ownership / management topic?** → the Org & management group above.
9. **A caveat, gotcha, or headline verdict?** → `callout.html`, `status-badge.html`,
   `verdict-card.html`.
10. **Real quantitative data at scale (thousands of points)?** → Chart.js (see below).

Rule of thumb: prefer the table and static widgets; add the interactive slider only when
"drag it" genuinely teaches something. Keep any single interactive SVG under ~1–2k elements —
past that, use Chart.js/Canvas. For any tree/graph/diagram, the widget uses **hand-placed
coordinates** — don't try to auto-layout; a large auto-laid-out graph is Mermaid's job.

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

## Escape hatch: highlight.js (code syntax coloring)

`code-compare.html` colors its snippets with highlight.js (v11.11.1), loaded from a CDN
pinned with Subresource Integrity — a real tokenizer is the only way to get correct
per-language coloring, so this is the one widget that isn't zero-dependency. Set the
language per block via `class="language-ts|js|json|bash|python|…"`. Include the highlight.js
`<link>`+`<script>` block **once** per report even if you use several code widgets.

Trade-off: a report with highlighted code is no longer fully offline. If a report must open
offline, delete the highlight.js block — the code still renders in plain monospace, just
uncolored. `diff-block.html` deliberately has **no** highlighter: in a diff the green/red
line color is the meaning, and a token highlighter would fight it.

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
