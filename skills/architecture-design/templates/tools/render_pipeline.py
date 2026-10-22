"""Generate 09-data-pipeline/pipeline.svg from the STEPS table, with computed coordinates.

Usage: python3 tools/render_pipeline.py 09-data-pipeline/pipeline.svg

Edit STEPS and LANE_CAPTION, never the SVG. Layout: one horizontal spine of steps, equal gaps computed from the
width, one dashed exit box under each step that has an exit, a drop line from the step to its exit.
Literal hex colours: a standalone SVG cannot resolve deck tokens.
"""
import sys

OUT = sys.argv[1]
W = 1240
MARGIN = 24
BOX_W, BOX_H = 176, 76
EXIT_W, EXIT_H = 176, 48
SPINE_Y = 110
EXIT_Y = 250
H = EXIT_Y + EXIT_H + 40
FONT = "'Noto Sans', Arial, Helvetica, sans-serif"
C = dict(accent="#BD0F72", accent_soft="#F8E7F1", muted="#F2F4F7", ink="#37474F", border="#B0BEC5",
         subtle="#D8DDE5", text="#1F2933", text_muted="#5F6B7A", card="#FFFFFF")

LANE_CAPTION = "One order, phase 1 — magenta = built in order-service, grey = external"
# kind: ours | ext | wait. exit: lines of the exit box, or None.
STEPS = [
    ("ours", "INTAKE", "Place order", ["validate, store"], ["invalid → refused,", "not stored"]),
    ("ext", "VENDOR", "Fraud check", ["ORD111 → FRD001"], ["FRD002 or timeout →", "manual review task"]),
    ("wait", "WAIT", "Score back", ["≤ FRAUD_TIMEOUT"], None),
    ("ours", "PAYMENT", "Charge", ["key = orderId"], ["declined → ORD103,", "customer notified"]),
    ("ours", "DONE", "Paid", ["ORD102 published"], None),
]

out = []


def esc(value):
    return value.replace("&", "&#38;").replace("<", "&#60;").replace(">", "&#62;")


def text(x, y, value, size=12, weight="normal", fill=None):
    out.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" '
               f'fill="{fill or C["text"]}" text-anchor="middle">{esc(value)}</text>')


def arrow(x1, y1, tx, ty, color, dash=""):
    """Straight connector; the stroke ends at the head's base, the head is a computed polygon."""
    length = ((tx - x1) ** 2 + (ty - y1) ** 2) ** 0.5
    ux, uy = (tx - x1) / length, (ty - y1) / length
    bx, by = tx - ux * 10, ty - uy * 10
    px, py = -uy, ux
    out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{color}" '
               f'stroke-width="1.6"{dash}/>')
    out.append(f'<polygon points="{tx:.1f},{ty:.1f} {bx + px * 5:.1f},{by + py * 5:.1f} '
               f'{bx - px * 5:.1f},{by - py * 5:.1f}" fill="{color}"/>')


style = {
    "ours": (C["accent_soft"], C["accent"], 2, "", C["accent"]),
    "ext": (C["muted"], C["ink"], 1.6, "", C["ink"]),
    "wait": (C["card"], C["border"], 1.6, ' stroke-dasharray="5 4"', C["text_muted"]),
}

count = len(STEPS)
gap = (W - 2 * MARGIN - count * BOX_W) / (count - 1)
xs = [MARGIN + i * (BOX_W + gap) for i in range(count)]

out.append(f'<text x="{MARGIN}" y="40" font-size="13" font-weight="bold" fill="{C["ink"]}">{esc(LANE_CAPTION)}</text>')
for i, (kind, tag, title, lines, exit_lines) in enumerate(STEPS):
    fill, stroke, width, dash, tag_colour = style[kind]
    x, cx = xs[i], xs[i] + BOX_W / 2
    top = SPINE_Y - BOX_H / 2
    out.append(f'<rect x="{x:.1f}" y="{top:.1f}" width="{BOX_W}" height="{BOX_H}" rx="8" fill="{fill}" '
               f'stroke="{stroke}" stroke-width="{width}"{dash}/>')
    text(cx, top + 18, tag, 10.5, "bold", tag_colour)
    text(cx, top + 37, title, 13.5, "bold")
    for n, line in enumerate(lines):
        text(cx, top + 55 + 14 * n, line, 11.5, fill=C["text_muted"])
    if i + 1 < count:
        arrow(x + BOX_W + 2, SPINE_Y, xs[i + 1] - 2, SPINE_Y, C["text_muted"])
    if exit_lines:
        ex = cx - EXIT_W / 2
        out.append(f'<rect x="{ex:.1f}" y="{EXIT_Y}" width="{EXIT_W}" height="{EXIT_H}" rx="7" fill="{C["muted"]}" '
                   f'stroke="{C["subtle"]}" stroke-width="1.5" stroke-dasharray="5 4"/>')
        first = EXIT_Y + (EXIT_H - 14 * (len(exit_lines) - 1)) / 2 + 4
        for n, line in enumerate(exit_lines):
            text(cx, first + 14 * n, line, 11.5, fill=C["ink"])
        arrow(cx, top + BOX_H + 2, cx, EXIT_Y - 2, C["border"], ' stroke-dasharray="4 4"')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
       f'preserveAspectRatio="xMidYMid meet" font-family="{FONT}">\n'
       f'<rect width="{W}" height="{H}" fill="{C["card"]}"/>\n' + "\n".join(out) + "\n</svg>\n")
open(OUT, "w").write(svg)
print("wrote", OUT, f"gap={gap:.1f}")
