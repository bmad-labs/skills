# Cropping Figures From a PDF Page

Pixels cannot be typed, so this is the one step that must use a tool. Everything else in a
faithful conversion comes from reading the rendered page.

## Why not `pdfimages`

`pdfimages -all` dumps embedded image XObjects. That is the wrong unit of work:

- A multi-panel figure arrives as N separate files with no idea they belong together.
- Alpha channels come out as separate `smask` files.
- Vector figures — block diagrams, flowcharts, plots drawn with PDF drawing operators — have **no
  embedded image at all** and dump nothing.
- Filenames carry XObject order, which has no relation to figure numbers.

Observed on one thesis: about three image objects per figure, and a vector flowchart had zero
embedded images.

**Crop the page region instead.** It captures panels, vector art, and integral labels together,
exactly as the reader sees them.

## Finding the crop box

The box comes from the page's own layout. Three inputs:

```python
import fitz
doc = fitz.open("doc.pdf")
page = doc[4]                                   # 0-indexed

page.search_for("Figure 2.1:")                  # caption rect -> figure's bottom edge
[page.get_image_rects(im[0]) for im in page.get_images(full=True)]   # embedded art extents
[(b[1], b[3], b[4][:40]) for b in page.get_text("blocks")]           # text blocks -> top edge
```

Then: **bottom** = just above the caption. **Top** = below the previous text block, or the content
area top. **Left/right** = the text margins, not the MediaBox — using the full page width pulls in
page numbers and running headers.

### The caption is not part of the figure

`y1` must land **above** the caption's top edge. The caption already lives in the Markdown as
text — baking it into the pixels duplicates it, and it cannot be searched, translated, or fixed
there.

Assert it instead of eyeballing it:

```python
cap = page.search_for("Figure 2.3:")            # non-English sources: "Fig. 6", "图 6", ...
assert cap, "caption not found — verify the label text and page"
y1 = cap[0].y0 - 2                               # 2 pt breathing room, still clear of the text
assert y1 < cap[0].y0, "crop bottom overlaps the caption"
```

This is the most common crop defect in practice, and it survives a casual glance at the PNG
because a caption inside the frame still *looks* correct.

## Render

```python
import fitz

doc  = fitz.open("doc.pdf")
zoom = 200 / 72                                  # 200 dpi; 72 pt = 1 in

def crop(page_no, x0, y0, x1, y1, out):
    page = doc[page_no - 1]                      # 1-indexed page numbers in, as printed
    pix  = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom),
                           clip=fitz.Rect(x0, y0, x1, y1))
    pix.save(out)
    print(f"{out}  {pix.width}x{pix.height}")

crop(5, 72, 100, 540, 400, "assets/figure-2-1.png")
```

200 dpi keeps 8 pt axis labels and legend text readable. 150 dpi starts to soften them; 300 dpi
roughly doubles file size for no gain on screen.

## Two figures on one page

The common trap. Split at the first figure's caption: figure A ends above its caption, figure B
starts below it.

```python
# p12 holds Figure 2.4 (top) and Figure 2.5 (bottom)
crop(12, 72,  80, 540, 360, "assets/figure-2-4.png")   # above 2.4's caption
crop(12, 72, 420, 540, 680, "assets/figure-2-5.png")   # below it, above 2.5's caption
```

Then **open both PNGs** and confirm neither contains any part of the other. Cross-contamination
here is invisible in any automated check.

## Verify

```python
# every referenced asset exists, and every asset is referenced
import re, glob, os
refs = set()
for f in glob.glob("*.md"):
    refs |= set(re.findall(r'assets/[\w.-]+\.png', open(f).read()))
have = set(glob.glob("assets/*.png"))
print("missing:", sorted(refs - have))
print("orphans:", sorted(have - refs))
```

That catches broken links. It cannot tell you the crop is *right* — only opening each image can.
Do that for every file, not a sample:

- Every promised sub-panel present, panel letters `(a)`, `(b)`, … all visible
- Nothing clipped: axis labels, colorbars, scale bars, legend rows
- No body prose, caption text, running header, or page number inside the frame
- Small text actually legible

## When the figure is a full-page plate

Some pages are one large figure with no separate caption block. Crop the content area minus
header and page number:

```python
r = doc[19].rect                                 # 612 x 792 for US Letter
crop(20, 72, 72, r.x1 - 72, 720, "assets/figure-4-1.png")
```

Confirm by eye that the header line and page number are outside the frame.
