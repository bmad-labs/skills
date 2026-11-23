# Illustrated scenes — show how something happens, in one picture

A **scene** tells a short story with actors: who acts, what moves between them, where
the harm lands. Actors are round icon tiles, the story moves left to right as curved
coloured arrows, and **numbered notes** sit next to the part of the picture they
explain. A mixed room (product, engineering, security) reads it in one look; the
numbers give the presenter a path to walk.

Scenes are generated, not hand-placed: `deck-template/scripts/scene.mjs` turns a small
JSON spec into the SVG, computes every arrow and arrowhead, and lints the layout. The
general diagram rules in [diagrams.md](diagrams.md) still apply; this file adds what is
specific to scenes.

## When a scene is the right picture

| The slide explains | Use |
|---|---|
| how an attack, a fraud, an incident or a failure unfolds | **scene** |
| how a request, a message or a leaked item travels through people and systems | **scene** |
| what the system is made of, and who owns which part | architecture diagram ([diagrams.md](diagrams.md)) |
| the exact order of calls between services | sequence diagram |
| the steps of a process with no actors to show | flow |

A scene replaces a row of numbered step cards. Step cards read as a list; a scene shows
*where* each step happens and *who* does it, which is what the audience is trying to
picture. Use one scene per story; a deck of six risks gets six scenes in one style.

## Anatomy

**Actors** — a 34px-radius tile with a lucide icon, a bold label under it and an
optional grey sub-label. The `kind` decides the colours:

| `kind` | Means | Look |
|---|---|---|
| `attacker` | the bad actor | dark ink tile, white icon |
| `evil` | the attacker's tool or foothold: a fake page, a stolen or leaked key, a taken-over mailbox, a public list | white tile, red ring and icon |
| `system` | your own systems and third-party platforms | grey tile, grey ring |
| `person` | a legitimate user doing normal work | white tile, blue ring and icon |
| `link` | **the one asset the attacker is after**: the data, the money, the token | accent-soft tile, accent ring |
| `safe` | an actor that stays safe | white tile, green ring |

A leaked key is the attacker's tool (`evil`); the records it opens are the asset
(`link`). One `link` actor per scene.

Badges: `"badge": "danger"` puts a red `!` on the actor that gets harmed;
`"badge": "ok"` puts a green check on one that stays safe.

**Arrows** — quadratic curves between actor centres. The tip lands 2px off the target
tile; the head is a polygon at the curve's end tangent.

| `kind` | Colour | Means |
|---|---|---|
| `attack` | red | the attack path |
| `normal` | blue | normal use by legitimate people |
| `neutral` | grey | plumbing that is neither (a lookup, a scan) |
| `link` | accent | the asset moving on its own |
| `safe` | green | a path that is safe |

`bow` bends an arrow (positive and negative bend to opposite sides); `dashed` marks
control rather than flow ("controls", "buys"); `label` is a 1–3 word verb phrase drawn
with a white halo; `labelDy` moves it (default −9, above the line; use about +18 to put
it below).

**Notes** — 236px-wide rounded cards. `note` is grey with a dark number; `impact` is
white with a red border and red number, for **the harm**; `safe` is white with a green
border, and `"n": null` gives it a check instead of a number.

## Colour meaning is the code — keep it identical across the deck

Red, blue and green are status colours used as a **semantic code**; the brand accent
marks one thing only:

- **The accent appears on exactly one actor kind, `link`** — the asset the story is
  about. It is the "selected" item of the picture, not decoration.
- Your own systems stay grey. A red system tile means "the attacker controls this".
- Every scene in a deck uses the same code, and the slide footer states it once:
  `Red: attack path. Blue: normal use. Accent: the customer records. Green: safe. Numbers follow the order of the attack.`
  Name the asset in the legend.

## Layout recipe

The canvas is **1240 × 500** (the default). Under a scene-slide header it renders at
about 0.85×, so 12px note text lands near 10px — small for a projected room. Set
`"height": 460` whenever the bottom notes still fit (each note is `50 + 16 × lines`
tall); the scale rises to about 0.9×. Keep the header to the eyebrow, title and facts.

1. **Actors on the middle band**, y ≈ 190–430, the story running left to right. A
   victim or a legitimate user goes bottom-left, the attacker top-left; the harmed
   system goes far right with the `danger` badge.
2. **Notes in two bands**: the top band at y = 16, the bottom band at y ≈ 360–400.
   Alternate top and bottom along the story so each note sits next to its actor or
   arrow, never on the path between them. Six actors and five numbered notes is the
   ceiling; past that, fold two steps into one note or split the story over two slides.
3. **Number the notes 1..n in the order of the story**, not the order of placement.
   Exactly **one `impact` note**, on the harm.
4. **Show the normal case as a blue `normal` arrow** next to the attack path — the
   contrast is the point (genuine invoices from the same mailbox as the fake one).
   Use an unnumbered `safe` note only for a separate path that stays safe ("Every
   forward is safe"); it sits outside the five.
5. **Controls are drawn by what they do**:
   - a control that partly works narrows the fan: six red arrows in, three out;
   - a control that fails is a grey dashed arrow to an actor whose sub-label says why
     (`nobody reads it`);
   - a control that works is a green `safe` arrow or note.
6. **Volume is shown, not written**: a flood is six red arrows with bows from −110 to
   +120 into one tile; a few getting through is two thin red arrows beside one blue.
7. **Parallel paths** between the same two actors get bows of about ±40, or a fan of
   three labelled paths (bows −170, 0, +170) for "three ways to do it".
8. **Route around actors with `bow`, then move a note** — never shrink text to make
   room.

### Copy

- Note title: 2–4 words, naming the step (`Session taken`, `Links copied`).
- Note body: one idea, three lines or fewer. Write `"text"` and the script wraps it;
  use `"lines"` only to force a break.
- Actor labels name the thing (`Customer mailbox`), sub-labels add the one fact the
  story needs (`taken over`).
- Plain, descriptive sentences.

## Build one

1. **Write the story first**: the actors, the order of events, the harm, the safe
   path. If you cannot write it as five numbered sentences, the scene will not read.
2. **Write the spec** in `scenes/<name>.scene.json` at the deck root. Start from
   `deck-template/scenes/example-refund-fraud.scene.json`; the full field list is in
   the header of `scripts/scene.mjs`.
3. **Generate until no ERROR**, with a preview:
   ```bash
   node scripts/scene.mjs scenes/<name>.scene.json --png   # public/diagrams/<name>.svg + review/<name>.png (3x)
   node scripts/scene.mjs --icons                           # every icon name available
   ```
   ERROR (exit 1) = a note overlaps something, an arrow runs through a note, something
   leaves the canvas, or an icon or key is unknown. WARN = an arrow brushes an actor or
   a label (including the label of the actor it leaves or enters), a line may overrun
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

## On the slide: a two-slide pair

Each story gets a pair. **Slide A** shows the scene; **Slide B** carries impact and
mitigation as text panels. The frame below is Slide A's layout, so skip the catalog
layout pick for it. Slide A:

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

The title stays the same on every Slide A (`How the attack happens`); the eyebrow
carries which story it is. The facts block holds up to three one-line facts taken from
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
