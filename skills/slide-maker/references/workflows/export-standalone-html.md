# Workflow: Export standalone HTML

**Goal:** a **single self-contained `.html` file** — fonts, CSS, JS all inlined — that
opens in any browser offline, with working slide navigation. The most portable, no-app
way to share or present a deck (email it, drop it on a drive, open from a USB stick).

**Use when** the user wants to present in a browser, share a link/file that "just opens",
or doesn't have/ want PowerPoint. It's the deck itself, not a converted artifact, so
fidelity is exact.

**Input:** an approved HTML deck (from [slide-generate](slide-generate.md)).

## Steps (from inside the copied deck)

```bash
node scripts/export-deck.mjs --format html      # → export/deck.html (one file)
```
- Vite standalone build with `vite-plugin-singlefile` inlines everything into one HTML.
- **Edit mode is stripped** at build time (`VITE_EDIT=off` dead-code-eliminates the
  init; a plugin deletes the edit-mode link + `public/edit-mode/`). Present mode (laser /
  pen) and nav stay — they're presentation features, not authoring.
- First run needs `npm install`.

## Check before handing over
- Open `export/deck.html` directly in a browser (double-click / `open export/deck.html`)
  — it must render fully **offline** (no dev server) with arrow/number-key navigation.
- Confirm no authoring overlay leaked: `grep -c EditMode export/deck.html` → **0**.

## Done when
`export/deck.html` opens offline and navigates. Hand the file/path to the user. Details
+ the strip-on-export guarantees: [deck-template.md](../deck-template.md).
