# deck-media

The slide templates reference photographic placeholders here
(`image6.jpeg`, `image7.jpeg`, …). These stock photos are **not vendored**
from the source design system — they are deck-specific content, not part of
the reusable brand kit.

When a template's `<img src="../assets/deck-media/imageN.jpeg">` resolves to a
missing file, the image area shows its empty box / alt text and the rest of the
slide renders normally. Drop your own 16:9 (or square, for personas) imagery in
here using the same filenames, or edit the `src` in the slide to point at your
asset.
