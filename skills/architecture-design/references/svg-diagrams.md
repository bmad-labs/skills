# Hand-Written SVG Diagrams

Adapted from `slide-maker/references/diagrams.md` for standalone design files. Use for C4 views, pipelines,
workflows, concepts, and timelines with ≤ ~10 boxes, when you run on a frontier model (SKILL.md §Diagrams).

A diagram is **layout as meaning**: a lane means an owner, a dashed box means "a wait" or "someone else builds
this", a drop line means "this also fires". Auto-layout cannot say that; you place it.

**Check the mechanism before you draw it.** A clean diagram of the wrong flow is wrong and persuasive. Draw from
the sequences, module design, and API files, not from memory.

## Generate, do not hand-type

Write a small script (`tools/render_<name>.py`) that computes every coordinate and writes the SVG. Hand-typed
coordinates drift; computed ones stay aligned when a box moves. Change the script, never the SVG, then re-run.

```python
W, H = 1240, 800
C = dict(accent="#1565C0", accent_soft="#E3F2FD", muted="#F2F4F7", ink="#37474F",
         border="#B0BEC5", subtle="#D8DDE5", text="#1F2933", text_muted="#5F6B7A", card="#FFFFFF")
FONT = "'Noto Sans', Arial, Helvetica, sans-serif"
out = []

def box(x, y, w, h, kind, title, lines):          # kind: ours | ext | wait | exit
    ...                                              # rect + centred title + muted lines; return edges

def arrow(x1, y1, tx, ty, color):                  # line ends at the head base; head is a polygon
    import math
    L = math.hypot(tx - x1, ty - y1); ux, uy = (tx - x1) / L, (ty - y1) / L
    bx, by = tx - ux * 12, ty - uy * 12; px, py = -uy, ux
    out.append(f'<line x1="{x1}" y1="{y1}" x2="{bx}" y2="{by}" stroke="{color}" stroke-width="1.6"/>')
    out.append(f'<polygon points="{tx},{ty} {bx+px*5},{by+py*5} {bx-px*5},{by-py*5}" fill="{color}"/>')
```

Standalone files use **literal hex** (deck tokens such as `var(--color-accent)` do not resolve outside a deck).

## Conventions

- **Root:** landscape `viewBox` (for example `0 0 1240 400`); `width` and `height` equal to the viewBox;
  `preserveAspectRatio="xMidYMid meet"`. Change all of them together when you crop.
- **No title inside the SVG** when the md already has one. Start at the first row of content.
- **Palette with meaning, kept everywhere:**

  | Role | Fill | Stroke |
  | --- | --- | --- |
  | What we build | accent soft `#E3F2FD` | accent `#1565C0`, 2px |
  | External system | muted `#F2F4F7` | ink `#37474F`, 1.6px |
  | A wait | card `#FFFFFF` | border `#B0BEC5`, dashed `5 4` |
  | An exit branch | muted `#F2F4F7` | subtle `#D8DDE5`, dashed |

  Put this table in the folder README as the colour code.
- **Type:** box titles 13.5–15px bold, body 12–14px, captions 11.5px. Widen a box or shorten copy; never shrink
  type to fit.
- **Text fits with ≥ 4px to spare.** Estimate width at ~0.55 × font size per character for Noto Sans/Arial, then
  check by rendering.
- **Arrowheads are polygons computed from the line angle** (code above). The line ends at the head's base, not at
  the tip.
- **Numeric XML entities only:** `&#183;` `&#8212;`. Named entities break the parse. Escape `&`, `<`, `>`.
- **Caption each lane** with its owner: "Payment capture — outside Order Service".
- **C4 by hand:** every box states name, type, technology; every arrow states intent above the line and
  `[PROTOCOL]` below it.

## Placement rules

- **Peers share one spacing.** Compute it: `gap = (span − total_box_size) / (count − 1)`. Peers are boxes inside
  one boundary.
- **Connections meet the centre of an edge.** One arrow: midpoint. N arrows on one edge: at 1/(N+1), 2/(N+1), … .
  Check both ends, source and target.
- **Straight first.** Align the two boxes so the run is straight. Elbow only when both ends cannot be satisfied;
  route elbows through gutters, never across a box.
- **Label on its connector.** Horizontal run long enough (`run ≥ label width + 8`): bold intent above the line,
  `[PROTOCOL]` below it. Too short (vertical, elbow): cut the line, seat the text in the gap with 8px air each side,
  and compute the head from the second segment. A vertical connector needs ~68px between shapes to carry a
  two-line label. A single-line label is lifted 8px clear of an unbroken line.
- **A label owns its space.** Not on a shape, not across a dashed boundary, not on another label. The fix is
  usually moving the arrow (swap the 1/3 and 2/3 slots), not nudging the text.

## Fixing placement

- Compute the target; do not nudge toward it.
- Solve the constraints together (spacing and centre lines), not one by one.
- Before a move, list its blast radius: the box, its labels, every arrow on it, its spacing group, what it now
  crosses. After the move, re-run every check, not only the one you were fixing.
- A fix that breaks another rule is not a fix. Change the routing or the gutter.
- A defect from a generator is fixed in the generator.

## Validate in three layers

1. **Tools:** `xmllint --noout file.svg`; render to PNG (`rsvg-convert -w 2480 file.svg > /tmp/d.png`, or the
   `playwright-cli` skill) and look at it.
2. **Your eyes, zoomed, one connector at a time.** A full-size view hides a 15px error. Crop each arrow (render at
   3×) and check: head on the line, line not through its label, exit at the edge centre.
3. **The user.** Only a human confirms that the picture matches the real architecture and that the emphasis is right.

"0 findings" means only that the defects your checks know are absent. When you report a clean run, name what the
checks cannot see. When the user reports one defect, look for the whole class: there are usually three or four.

## Worked example (shape)

A pipeline of one unit of work: one lane per phase, steps left to right on a spine, one dashed exit box under each
step that has an exit, blue (accent) hand-off lines between lanes labelled with the message and transport, and a caption
per lane naming its owner. Colour code and regeneration command in the folder README.
