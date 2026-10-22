# Guide — tools

## Generator scripts

**Purpose.** Keep one source for contracts and pictures, so docs, schemas, and SVGs never disagree.

**Rules (must).**
- Add a generator when a folder has more than ~5 items of one kind (events, methods) or a diagram with computed
  layout.
- The generator's docstring states usage, what it reads, what it writes, and "never edit the outputs".
- Outputs are committed, so a reader needs no tool to read the package.
- A defect in an output is fixed in the generator, then everything is regenerated.

**Best practices.** Standard library plus `jsonschema` only. One script per output kind. Deterministic output (same
input, same bytes), so a diff shows only real changes.

## README.md — Tool index

**Rules (must).** One row per script (reads, writes, run). One block that checks the whole package; run it before
every report.
