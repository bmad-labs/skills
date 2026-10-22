# 09 — Data Pipeline

[`pipeline.svg`](pipeline.svg): the processing pipeline of one <unit of work> in <phase>, drawn as hand SVG
(style: skill `references/svg-diagrams.md`). It follows <the user's pipeline image or the canon pipeline>.

| Lane | Steps | Detail |
| --- | --- | --- |
| 1 · <Phase> | <Step> → <Step> → <Step> | [`../07-sequences/01`](../07-sequences/01-<workflow>.puml) |

Each dashed box under a step is an exit of that step. Every exit ends automatic and visible, or goes to a human.
<State the one exception, if any.>

## Colour code

| Fill and stroke | Meaning |
| --- | --- |
| Magenta border, pink fill | Built in <service> |
| Dark grey border, grey fill | External system |
| Dashed grey border, white fill | A wait |
| Dashed light border, grey fill | An exit branch |

## Change the diagram

The SVG is generated from coordinates computed in [`../tools/render_pipeline.py`](../tools/render_pipeline.py).
Change the script, not the SVG, then run:

```sh
python3 tools/render_pipeline.py 09-data-pipeline/pipeline.svg
xmllint --noout 09-data-pipeline/pipeline.svg
```
