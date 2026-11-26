# Illustrated scenes — show how something happens or works, in one picture

A **scene** tells a short story with actors: who acts, what moves between them, and
where it ends — a result, a pain point, or a harm. Actors are round icon tiles, the story moves left to right as curved
coloured arrows, and **numbered notes** sit next to the part of the picture they
explain. A mixed room (product, engineering, security) reads it in one look; the
numbers give the presenter a path to walk.

Scenes are generated, not hand-placed: `deck-template/scripts/scene.mjs` turns a small
JSON spec into the SVG, computes every arrow and arrowhead, and lints the layout. The
general diagram rules in [diagrams.md](diagrams.md) still apply; this file adds what is
specific to scenes.

## Story types

A scene fits any slide whose content is a short story: **actors, an order of events,
and one thing to follow**. Pick the story type first; it decides what the accent and
red mean, and which slide pairs with the scene.

| Story type | The slide explains | Focus (accent) | Red means | Pairs with |
|---|---|---|---|---|
| **Idea** | a proposed solution: who uses it, what the new part does, the result | the `new` actor and its output | not used | a details or decision slide |
| **Before / after** | today's process against the proposed one | the `new` actor in the after scene | the slow or failing step of today | — (two scenes, side by side or on two slides) |
| **Journey** | what a person goes through, step by step | the thing they are trying to get done (`link`) | the worst pain point (`impact` note) | a list of fixes |
| **Data flow** | where a piece of data travels, is stored, and who can read it | the data (`link` actor and `link` arrows labelled with the fields) | a copy or a leak outside the rules; a legitimate transfer is a `link` arrow | a controls slide |
| **Hand-off / approval** | who passes work to whom, and where it waits | the request (`link`) | where it gets stuck | an owners table |
| **Event flow** | which service publishes an event and who reacts | the event (`link`) | a lost or duplicated event | the contract or schema |
| **Incident** | what failed, how it spread, what stopped | — | the `cause` actor, the failure path (`failure` arrows) and the stopped service (`danger` badge) | timeline and actions |
| **Attack or fraud** | how an attacker gets in and what they take | the asset taken (`link`) | the attack path (`attack` arrows) | impact and mitigation |

A scene replaces a row of numbered step cards. Step cards read as a list; a scene shows
*where* each step happens and *who* does it. Use something else when the slide is a
structure (architecture, C4), the exact order of calls (sequence diagram), or steps with
no actors (flow) — see [diagrams.md](diagrams.md). Keep one story type per deck section,
so the colours mean the same thing on every scene the audience sees in a row.
A boundary that matters to the story (a network, a vendor, a team) is a **zone**; one
row per owner in a hand-off is a **lane** — both are in "Script form" below.

## Anatomy

**Actors** — a 34px-radius tile with a lucide icon, a bold label under it and an
optional grey sub-label. The `kind` decides the colours:

| `kind` | Means | Look |
|---|---|---|
| `person` | a person doing their work (a user, a customer, staff) | white tile, blue ring and icon |
| `system` | an existing system or third-party platform | grey tile, grey ring |
| `new` | **the part we build or propose** (idea and before/after stories) | solid accent tile, white icon |
| `link` | **the one thing the story follows**: the data, the request, the event, the money; in a risk story, the asset the attacker is after | accent-soft tile, accent ring |
| `safe` | an actor that ends well, or stays safe | white tile, green ring |
| `cause` | the root cause of an incident: a bad config, a full disk, an expired certificate | white tile, red ring and icon |
| `attacker` | the bad actor | dark ink tile, white icon |
| `evil` | the attacker's tool or foothold: a fake page, a stolen or leaked key, a taken-over mailbox, a public list | white tile, red ring and icon |

A leaked key is the attacker's tool (`evil`); the records it opens are the asset
(`link`). One accent focus per scene: a `new` actor, or a `link` actor — not both.

Badges: `"badge": "danger"` puts a red `!` on the actor that is harmed or stopped;
`"badge": "ok"` puts a green check on the one that ends well.

**Arrows** — quadratic curves between actor centres. The tip lands 2px off the target
tile; the head is a polygon at the curve's end tangent.

| `kind` | Colour | Means |
|---|---|---|
| `normal` | blue | what people do: a request, a click, normal use |
| `neutral` | grey | system-to-system plumbing (a lookup, a call, a scan) |
| `link` | accent | the focus moving: the output of the `new` part, or the thing the story follows |
| `safe` | green | the good outcome, or a path that is safe |
| `failure` | red | where it goes wrong: a failure spreading, a step that breaks |
| `attack` | red | the attack path (same colour as `failure`; the name reads better in a risk spec) |

`bow` bends an arrow (positive and negative bend to opposite sides); `dashed` marks
control rather than flow ("controls", "buys") or a call that never happens; `label` is
a 1–3 word verb phrase drawn with a white halo — or, in a data flow, the fields the
arrow carries (`name, email`). The script places the label: above a level arrow,
pushed clear of a slanted one on its upper side, and level beside a steep one. A
positive `labelDy` (about +18) moves it to the other side; `labelT` (0 to 1, default
0.5) slides it along the arrow to where there is room. In a bundle of parallel arrows, label the
outermost one, so the label does not sit on its neighbour.

**Notes** — 236px-wide rounded cards. `note` is grey with a dark number; `impact` is
white with a red border and red number, for **the harm or the worst pain**; `safe` is white
with a green border, for **the result** — numbered when it is a step of the story,
`"n": null` (a check instead of a number) when it sits outside it.

## Colour meaning is the code — keep it identical across the deck

Blue, grey, green and red are status colours used as a **semantic code**; the brand accent
marks the focus of the story and nothing else:

- **One accent focus per scene**: the `new` actor (with its `link` output arrow) in an
  idea story, or the `link` actor in a story that follows a thing. It is the
  "selected" item of the picture, not decoration.
- Existing systems stay grey. People are blue. The good result is green.
- Check that the theme's accent and the status blue look different. If they are close
  (an indigo accent next to blue), the reader cannot tell the focus from normal use:
  name both in the footer legend, or set `"width": 3` on the `link` arrows.
- **Red appears only for failure, harm or attack.** An idea scene has no red. A red
  system tile in a risk story means "the attacker controls this".
- The slide footer states the code once, in the words of the story type:
  - risk: `Red: attack path. Blue: normal use. Accent: the customer records. Green: safe. Numbers follow the order of the attack.`
  - data flow: `Accent: customer contact data. Blue: people. Grey: systems. Dashed boxes: account boundaries. Green: data that stays. Numbers follow the order of the flow.`
  - incident: `Red: failure path. Blue: normal use. Grey dashed: never reached. Green: kept working. Numbers follow the order of the incident.`
  - idea: `Accent: the new refund engine. Blue: people. Grey: existing systems. Green: the result. Numbers follow the order of the story.`

## Layout recipe

The canvas is **1240 × 500** (the default). Under a scene-slide header it renders at
about 0.85×, so 12px note text lands near 10px — small for a projected room. Set
`"height": 460` whenever the bottom notes still fit (each note is `50 + 16 × lines`
tall); the scale rises to about 0.9×. Keep the header to the eyebrow, title and facts.
For a large room, add `"textScale": 1.15` — every text and note grows 15% — and cut
each note to two lines. Notes are then 271px wide, so space them about 290px apart.

1. **Actors on the middle band**, y ≈ 190–430, the story running left to right: the
   person who starts it on the left, the result on the right. In a risk story the
   attacker goes top-left, the victim or legitimate user bottom-left, and the harmed
   system far right with the `danger` badge. A side path (an exception, a hand-off to
   a person) drops below the main line, offset 150–180px sideways from the actor above
   it, so its arrow does not cross that actor's label. In an incident, follow the
   failure from the `cause` on the left to the people it hit; parts that kept working
   are `safe` actors with the `ok` badge on the far right, and a healthy part that was
   never reached is a `system` fed by a grey dashed `neutral` arrow, its sub-label saying
   so (`healthy, never called`).
2. **Notes in two bands**: the top band at y = 16, the bottom band at y ≈ 360–400.
   Alternate top and bottom along the story so each note sits next to its actor or
   arrow, never on the path between them. Six actors and five numbered notes is the
   ceiling; past that, fold two steps into one note, merge two actors that share a
   boundary and a role into one tile (`Booking service`, sub-label `web app and API`),
   or split the story over two slides.
3. **Number the notes 1..n in the order of the story**, not the order of placement.
   At most **one `impact` note** (the harm, or the worst pain point) and one numbered
   `safe` note (the result).
4. **In a risk story, show the normal case as a blue `normal` arrow** next to the attack
   path — the contrast is the point (genuine invoices from the same mailbox as the fake one).
   Use an unnumbered `safe` note only for a separate path that stays safe ("Every
   forward is safe"); it sits outside the five.
5. **Controls and checks are drawn by what they do**:
   - a control that partly works narrows the fan: six red arrows in, three out;
   - a control that fails is a grey dashed arrow to an actor whose sub-label says why
     (`nobody reads it`);
   - a control that works is a green `safe` arrow or note.
6. **Volume is shown, not written**: a flood is six red arrows with bows from −110 to
   +120 into one tile; a few getting through is two thin red arrows beside one blue; in
   an idea story, "1 in 10 goes to a person" is a thin dashed grey arrow to a `person`.
7. **Parallel paths** between the same two actors get bows of about ±40, or a fan of
   three labelled paths (bows −170, 0, +170) for "three ways to do it".
8. **Route around actors with `bow`, then move a note** — never shrink text to make
   room.

### Copy

- Note title: 2–4 words, naming the step (`Order checked`, `Decision in seconds`, `Session taken`).
- Note body: one idea, three lines or fewer. Write `"text"` and the script wraps it;
  use `"lines"` only to force a break.
- Actor labels name the thing (`Customer mailbox`), sub-labels add the one fact the
  story needs (`taken over`).
- Plain, descriptive sentences.

## Build one

1. **Pick the story type and write the story first**: the actors, the order of
   events, and how it ends (the result, the pain, or the harm). If you cannot write it as five numbered sentences, the scene will not read.
2. **Write the spec** in `scenes/<name>.scene.json` at the deck root. Start from the example
   that matches the story type in `deck-template/scenes/` —
   `example-refund-idea.scene.json` (idea), `example-customer-data-flow.scene.json`
   (data flow, with zones), `example-checkout-incident.scene.json` (incident) or
   `example-refund-fraud.scene.json` (attack or fraud); the full field list is
   in the header of `scripts/scene.mjs`.
3. **Generate until no ERROR**, with a preview:
   ```bash
   node scripts/scene.mjs scenes/<name>.scene.json --png   # public/diagrams/<name>.svg + review/<name>.png (3x)
   node scripts/scene.mjs --icons                           # every icon name available
   ```
   ERROR (exit 1) = a note overlaps something, an arrow runs through a note, something
   leaves the canvas, or an icon or key is unknown. WARN = an arrow brushes an actor or
   a label (including the label of the actor it leaves or enters), a label floats away
   from its arrow or touches a zone border, a line may overrun
   its note, numbering has gaps, or there is more than one impact note. Treat each WARN
   as a question to answer by looking, not as noise.
4. **Look at the 3× preview**: follow each arrow from tail to head, check every label
   sits clear of its line and of other text, and read the notes in number order. The
   lint estimates text width; your eyes confirm it.
5. **Fix the spec, never the SVG.** The SVG is output; an edit to it is lost on the next
   generate.

**Colours:** the script writes literal colour values resolved from the deck's design
system (`design-system/styles.css` and its imports), because a file under `public/`
is loaded through `<img>` and cannot read the page's CSS. Change the theme, then
generate again. Pass `--tokens` only when you inline the SVG into the JSX, where
`var(--token)` resolves.

## Script form: when JSON is not enough

Most scenes are a JSON spec. Write a short script instead when the scene needs:

- a **drawing the kinds do not cover** — a small timeline, a gauge, a two-row table;
- **computed positions** — a row of N actors, a fan of arrows built in a loop.

Zones and lanes also work in JSON; the script form adds `raw()` and loops. The script
lives next to the specs in `scenes/` as `<name>.scene.mjs`, imports the library, adds
parts, and exports the scene. The same command builds it, with the same checks:

```js
import { Scene } from '../scripts/scene.mjs';

const s = new Scene({ title: 'Order request path', height: 430 });
s.zone({ x: 230, y: 150, w: 280, h: 190, label: 'Cloud provider', kind: 'external' });
s.zone({ x: 560, y: 150, w: 640, h: 190, label: 'Internal network' });
s.node({ key: 'U', x: 100, y: 250, icon: 'user', kind: 'person', label: 'Customer' });
s.node({ key: 'N', x: 680, y: 250, icon: 'zap', kind: 'new', label: 'Order API', sub: 'new' });
s.arrow({ from: 'U', to: 'N', kind: 'normal', label: 'order' });
s.raw({ svg: '<rect x="1000" y="300" width="160" height="80" rx="8" fill="var(--surface-card)" stroke="var(--border-default)"/>',
        box: { x: 1000, y: 300, w: 160, h: 80 }, what: 'SLA box' });
export default s;
```

```bash
node scripts/scene.mjs scenes/order-path.scene.mjs
```

| Part | Draws | Use it for |
|---|---|---|
| `zone({ x, y, w, h, label, kind })` | a dashed rounded box with a label top-left; `boundary` (no fill), `new` (accent), `external` (grey fill) | a network, a cloud account, a team's area, "what we build" |
| `lane({ y, h, label })` | a full-width grey row with a label on the left | one row per owner in a hand-off or approval story |
| `raw({ svg, box, what, layer })` | your own SVG | anything else; `box` is what the check sees, so give every front drawing one; `layer: 'back'` puts a decoration behind everything and outside the check |

Rules for the script form:

- Build actors, arrows and notes with `node()`, `arrow()` and `note()`, never inside
  `raw()`. The shared code places arrowheads and labels and runs the check; a copy
  of that code in one diagram loses every later fix.
- Use token colours inside `raw()` (`var(--surface-card)`), with the same meaning as
  the rest of the scene.
- Keep actors fully inside their zone or lane, and arrow labels off zone borders; the
  check warns on both.
- When a diagram needs a part that more scenes will need, add it to `scene.mjs` as a
  new method rather than as a `raw()` drawing.

## On the slide

The scene gets its own slide, and the slide after it carries what the audience asks
next — the "Pairs with" column of the story-type table: impact and mitigation for a
risk, a details or decision slide for an idea, the actions for an incident.

The frame below is the scene slide's layout, so skip the catalog layout pick for it.
A risk scene:

```jsx
import Diagram from '@/components/Diagram';
import { AccentRule } from '@/components/SlideTransition';

<div className="slide-page flex flex-col" data-viz-id="s10">
  <header className="shrink-0 flex items-end justify-between gap-8" data-viz-id="s10.header">
    <div>
      <span className="text-eyebrow tracking-eyebrow uppercase font-bold text-primary-500">
        Risk 1 of 6 &middot; Account takeover
      </span>
      <h1 className="mt-3 text-h2 font-bold tracking-tight text-text-primary">How the attack happens</h1>
      <AccentRule className="mt-5" />
    </div>
    <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 pb-1" data-viz-id="s10.facts">
      <dt className="text-[12px] tracking-eyebrow uppercase font-bold text-text-muted">Attacker</dt>
      <dd className="text-small text-text-primary">An outsider with a phishing kit</dd>
      {/* Needs, and Risk only when the source rates it: one line each */}
    </dl>
  </header>
  <div className="flex-1 min-h-0 mt-5 flex items-center justify-center" data-viz-id="s10.band">
    <Diagram src="/diagrams/account-takeover.svg" id="s10.scene" alt="Attack scene: …" />
  </div>
  <footer className="shrink-0 mt-4 flex items-center justify-between gap-8" data-viz-id="s10.footer">
    <span className="text-footnote text-text-muted">Red: attack path. Blue: normal use. …</span>
    <span className="shrink-0 text-footnote text-text-muted">10</span>
  </footer>
</div>
```

`check-slop` reports "no clear focal point" on every scene slide: the scene is the
focus by layout, so leave that warning. Do not enlarge the title to clear it.

Keep one title across a deck section (`How the attack happens`, `How it works`); the
eyebrow carries which story it is. An idea scene drops the facts block or uses it for
the two or three numbers the idea promises. The facts block holds up to three one-line facts taken from
the source: `Risk` (only when the source rates it), `Attacker`, `Needs`, or the
`Control bypassed`. A rating the source does not give stays off the slide.

`<Diagram src>` gives the scene a click-to-zoom overlay, which is how a reader at the
back of the room or on a shared copy reads the notes.

## In a printed companion document

A written reference (A4 portrait, built from HTML with Playwright `page.pdf()`) can
reuse the same SVGs. Give each scene its own **landscape plate page** so the notes stay
readable — at portrait width a 1240px scene shrinks to about half size and the 12px
note text prints at 5pt:

```css
@page { size: A4; margin: 18mm; }
@page plate { size: A4 landscape; margin: 13mm 15mm 17mm; }
section.plate { page: plate; break-before: page; }
```

Embed the generated SVG and call
`page.pdf({ preferCSSPageSize: true, printBackground: true })`. Open each story's
section with its plate, then the detail pages.

## Mistakes that reached a reviewer

- An arrow from an actor below the notes ran straight through a note's text. Fix:
  move the actor or bow the arrow; `scene.mjs` now fails on it.
- Notes numbered by position instead of story order (3 above 4 although 4 happened
  first). Number by the story; the lint warns on gaps, not on order — read them in
  sequence before calling it done.
- A risk rating the source never gave, placed in the facts block to fill the slot.
- The brand accent used for the attacker's path, which reads as "we are the attacker".
  The attack is red; the accent marks only the asset.
