# Diagrams — when to hand-write an SVG, and how

Charts are data. **Diagrams are layout-as-meaning**: a lane means an owner, a dashed
box means "someone else builds this", a drop-line means "and this fires too". Nothing
generates that for you, which is why this file exists.

> Reconciling with [wow-guide.md](wow-guide.md) "Which chart": that section calls a
> hand-drawn SVG the inferior choice, and it is right — **for charts**. A chart built
> from real values exports as a native editable PowerPoint chart; a hand-drawn one
> does not. A concept diagram has no data to build from, so that trade never applies.

## Pick the tool

| The diagram is | Use | Why |
|---|---|---|
| a sequence / interaction over time | **PlantUML** | lifelines and activation bars are fiddly by hand, and PlantUML gets them right |
| a state machine, or a graph past ~10 nodes | **PlantUML** | auto-layout beats manual placement at that size |
| a concept, an architecture, a timeline, a workflow | **hand-written SVG** | the layout carries the meaning; auto-layout cannot express it, and fighting it costs more than drawing |
| numbers | **neither — build it as data** | see [wow-guide.md](wow-guide.md) "Which chart (decision rules)" |

**If a generated diagram is rejected on how it looks, do not re-generate it — switch
to hand-writing it.** Two rounds of PlantUML tuning is the signal that the tool is the
problem, not the parameters. Re-running the generator with new flags is the expensive
way to arrive at the same rejection.

**Research the mechanism before you draw it.** A beautiful diagram of the wrong
architecture is worse than an ugly one — it is wrong *and* persuasive. Check how the
system actually works before committing to boxes.

## Conventions

These are what separate a diagram that reads from one that merely renders.

**Size it to the slide row.** The diagram row on a 1280×720 slide is about
**1136 × 487px**. Use a landscape `viewBox` near that ratio — `0 0 1240 400` is a good
default. A portrait diagram is height-bound and lands small no matter what you do to it.

**`width` and `height` attributes must equal the `viewBox`.** Always set all three.
The failure this prevents: cropping an SVG by editing `viewBox` alone leaves the
original `height` in place, and with `preserveAspectRatio="none"` on the root the
result is silently **stretched** — a 545-tall crop still carrying `height="1013px"`
renders 1.86× too tall. If you crop, edit `viewBox`, `width`, `height`, **and** any
inline `style` height. All four, every time.

**Give the palette meaning, then keep it.** Each fill says one thing:

| Role | Fill | Stroke |
|---|---|---|
| the thing we build | `var(--color-accent-soft)` | `var(--color-accent)` |
| an external system | `var(--surface-muted)` | `var(--ink-700)` |
| a wait, a pause | `var(--surface-card)` | `var(--border-default)`, **dashed** |
| a no-op branch | `var(--surface-muted)` | `var(--border-subtle)` |

A reader learns the code once and applies it everywhere after. A decorative palette
makes them re-read every label.

**Body text 10.5–13px; titles up to 25.** Below 10.5 it is unreadable once the canvas
is scaled ~0.95× to fit; above 13 the diagram stops fitting.

**Prefer an explicit `<polygon>` arrowhead over `<marker>`.** A marker's placement
depends on `refX`/`refY`/`orient` resolving against the path end, and a mismatch shows
up as a head floating off the line — valid SVG, so it is fiddly to debug. A polygon has
no indirection: the three points are where the head is. Chromium and `rsvg-convert`
both render `orient="auto"` correctly, so markers are not broken — polygons are just
harder to get subtly wrong.

Compute the angle yourself and emit three points:

```xml
<path d="M 384 158 C 430 158 430 100 470 100" stroke="var(--color-accent)" fill="none"/>
<polygon points="478,100 466,94 466,106" fill="var(--color-accent)"/>
```

**Numeric XML entities only.** `&#183;` `&#8212;` `&#8220;`. The named forms
(`&middot;`, `&mdash;`) are HTML, not XML — an SVG using them fails to parse.

**Caption the lane, not just the boxes.** One line naming who owns a region answers
the question a reader would otherwise ask out loud:

```xml
<text x="44" y="306" font-size="12" font-weight="bold">Notification service &#8212; already exists, we build none of it</text>
```

## Where to put the diagram, and what check-slop actually does

Two places a diagram can live. Pick on size, not on the validator:

- **External `.svg` under `public/`, rendered by `<Diagram src="…"/>`.** Right for a
  full-slide diagram: it gets the zoom overlay, and the file stays editable on its own.
- **Inline `<svg>` in the JSX.** Right for a small diagram sitting beside other content.

**The two are not interchangeable, and this catches people.** `var(--*)` resolves in an
inline `<svg>`, which inherits the page's custom properties. A standalone `.svg` loaded
through `<img src>` has **no access to the host document's CSS** — every `var()` fails
and falls back to black. Verified: an inline rect reads `rgb(79, 70, 229)`; the same
file loaded via `<img>` renders `rgb(0, 0, 0)`.

So: **inline gets tokens, `public/` gets literal hex.** The example below is written in
tokens because it reads better as a teaching artifact. If you save it under `public/`,
substitute your theme's hex first, using the role table above as the map.

Inside an inline `<svg>`, `var(--*)` works in a **presentation attribute** as well as in
a `style`, so `fill="var(--color-accent)"` and `font-family="var(--font-sans)"` both
resolve. Verified — no need for a `style` attribute just to reach a token.

### check-slop will not catch an off-palette diagram — you have to

Do not rely on the validator here. Its raw-hex ERROR skips any `#` preceded by `(`, `"`
or `'` — a rule meant to spare SVG local references like `url(#grad)`, which in JSX
also spares **every hex in a quoted attribute**. Measured on a probe slide:

| Written as | Result |
|---|---|
| `fill="#BD0F72"` | **passes** — quote before `#` |
| `fill={'#024D71'}` | **passes** — quote before `#` |
| `` background: `#FF00AA` `` | ERROR — backtick is not in the skip set |

A diagram full of off-brand hex will therefore report `clean`. Use tokens inline
because it is right and it re-skins, not because anything enforces it — and for a
`public/` file, check the palette against the role table by eye.

The ERROR that reliably *does* fire on a diagram slide is `h-screen` /
`min-h-screen`. There is a second rule for `.glass` / `backdrop-filter:`, but it is
written for CSS syntax — a JSX `className="glass"` or a camelCase `backdropFilter`
slips past it. Neither is needed anyway: `Diagram.jsx` uses inline `position: fixed`
for exactly this reason.

Known-benign WARN: `h-full` outside `slide-content`.
[visual-review.md](visual-review.md) *recommends* `h-full` on scaling artwork. The
warning is expected; do not "fix" it.

## Reading a diagram on the slide

A 1280×720 canvas cannot show a dense diagram at a readable size. **Inline is
orientation; the overlay is reading.** `deck-template/src/components/Diagram.jsx`
gives any diagram a click-to-zoom lightbox — natural size if it fits the screen,
scaled to fit if it does not, then wheel-zoom and drag-to-pan from there:

```jsx
import Diagram from '@/components/Diagram';

<div className="flex-1 min-h-0 flex items-center justify-center">
  <Diagram src="/diagrams/order-flow.svg" alt="…" id="s5.diagram" />
</div>
```

The `alt` text is not optional — it is what a screen reader and an export caption get
instead of the picture. Describe the flow in a sentence, not "diagram".

## Worked example

`order_workflow` — a horizontal track with three human steps, two waits, and dashed
drop-lines to a second lane showing what each step also triggers. This is the whole
file; copy it and edit.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 400"
     width="1240" height="400"
     font-family="'Noto Sans', Arial, Helvetica, sans-serif">
  <title>order_workflow</title>
  <rect width="1240" height="400" fill="var(--surface-card)"/>

  <!-- (1) Caption the workflow before the first box: name it, then state the
       one invariant a reader needs to hold while reading the rest. -->
  <text x="24" y="30" font-size="13" font-weight="bold" fill="var(--color-accent)">order_workflow</text>
  <text x="24" y="50" font-size="12" fill="var(--text-muted)">correlationId = order id &#183; one order is ever one workflow</text>

  <!-- (2) The SPINE. One line behind every node, drawn first so boxes sit on top.
       It reads as "this is a sequence" before any label is parsed. -->
  <line x1="70" y1="150" x2="1170" y2="150" stroke="var(--border-subtle)" stroke-width="2"/>

  <circle cx="70" cy="150" r="13" fill="var(--ink-700)"/>
  <text x="70" y="192" font-size="12" font-weight="bold" text-anchor="middle" fill="var(--text-primary)">START</text>
  <text x="70" y="209" font-size="11" fill="var(--text-muted)" text-anchor="middle">order placed</text>

  <!-- a step WE build: accent-soft fill, accent stroke, 2px -->
  <rect x="132" y="112" width="176" height="76" rx="8"
        fill="var(--color-accent-soft)" stroke="var(--color-accent)" stroke-width="2"/>
  <text x="220" y="134" font-size="10.5" font-weight="bold" fill="var(--color-accent)" text-anchor="middle">HUMAN TASK</text>
  <text x="220" y="153" font-size="13" font-weight="bold" fill="var(--text-primary)" text-anchor="middle">Check the order</text>
  <text x="220" y="172" font-size="11" fill="var(--text-secondary)" text-anchor="middle">stock and address</text>

  <!-- a WAIT: white fill, DASHED grey stroke. Shorter than a task box, because it
       is something happening TO us, not work we do. -->
  <rect x="340" y="122" width="150" height="56" rx="8"
        fill="var(--surface-card)" stroke="var(--border-default)" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="415" y="145" font-size="10.5" font-weight="bold" fill="var(--text-muted)" text-anchor="middle">WAIT</text>
  <text x="415" y="164" font-size="12" fill="var(--text-primary)" text-anchor="middle">payment cleared</text>

  <rect x="522" y="112" width="176" height="76" rx="8"
        fill="var(--color-accent-soft)" stroke="var(--color-accent)" stroke-width="2"/>
  <text x="610" y="134" font-size="10.5" font-weight="bold" fill="var(--color-accent)" text-anchor="middle">HUMAN TASK</text>
  <text x="610" y="153" font-size="13" font-weight="bold" fill="var(--text-primary)" text-anchor="middle">Pack the order</text>
  <text x="610" y="172" font-size="11" fill="var(--text-secondary)" text-anchor="middle">pick, pack, label</text>

  <circle cx="1170" cy="150" r="13" fill="var(--surface-card)" stroke="var(--ink-700)" stroke-width="2"/>
  <circle cx="1170" cy="150" r="7" fill="var(--ink-700)"/>
  <text x="1170" y="192" font-size="12" font-weight="bold" text-anchor="middle" fill="var(--text-primary)">END</text>

  <!-- (3) ARROWHEADS as polygons, grouped so the fill is stated once.
       Each sits just before the box it points into. -->
  <g fill="var(--text-muted)">
    <polygon points="128,150 118,145 118,155"/>
    <polygon points="336,150 326,145 326,155"/>
    <polygon points="518,150 508,145 508,155"/>
    <polygon points="1153,150 1143,145 1143,155"/>
  </g>

  <!-- (4) DROP-LINES to the second lane. Dashed + accent = "this also fires,
       but it is not the main sequence". Dropping DOWN rather than branching
       sideways keeps the spine unbroken and the reading order intact. -->
  <g stroke="var(--color-accent)" stroke-width="1.6" fill="none" stroke-dasharray="4 4">
    <path d="M 220 190 L 220 268"/>
    <path d="M 610 190 L 610 268"/>
  </g>
  <g fill="var(--color-accent)">
    <polygon points="220,276 215,264 225,264"/>
    <polygon points="610,276 605,264 615,264"/>
  </g>
  <text x="232" y="232" font-size="10.5" font-weight="bold" fill="var(--color-accent)">on assign</text>
  <text x="622" y="232" font-size="10.5" font-weight="bold" fill="var(--color-accent)">on assign</text>

  <!-- the second lane: dashed border + a caption naming its owner -->
  <rect x="24" y="282" width="1192" height="106" rx="10"
        fill="var(--surface-muted)" stroke="var(--border-subtle)" stroke-width="1.5" stroke-dasharray="6 5"/>
  <text x="44" y="306" font-size="12" font-weight="bold" fill="var(--ink-700)">Notification service &#8212; already exists, we build none of it</text>

  <rect x="132" y="318" width="176" height="50" rx="7"
        fill="var(--surface-card)" stroke="var(--ink-700)" stroke-width="1.6"/>
  <text x="220" y="340" font-size="11.5" font-weight="bold" fill="var(--ink-700)" text-anchor="middle">notify_check</text>
  <text x="220" y="357" font-size="10.5" fill="var(--text-muted)" text-anchor="middle">its own template</text>

  <rect x="522" y="318" width="176" height="50" rx="7"
        fill="var(--surface-card)" stroke="var(--ink-700)" stroke-width="1.6"/>
  <text x="610" y="340" font-size="11.5" font-weight="bold" fill="var(--ink-700)" text-anchor="middle">notify_pack</text>
  <text x="610" y="357" font-size="10.5" fill="var(--text-muted)" text-anchor="middle">its own template</text>
</svg>
```
