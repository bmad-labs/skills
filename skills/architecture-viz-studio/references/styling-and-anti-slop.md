# Styling & Anti-Slop

How to make these pages look professionally designed, not AI-generated. This is the highest-leverage doc in the skill — taste, distilled into rules.

## Table of contents
- [The one rule: restraint](#restraint)
- [Color: one accent, the rest neutral](#color)
- [Type: a real scale, one good pairing](#type)
- [Whitespace, radius, shadow discipline](#whitespace-radius-shadow)
- [Flat chrome (no gradient soup)](#flat-chrome)
- [The "modernized blueprint" dark aesthetic for architecture](#blueprint)
- [The low-poly Three.js style](#low-poly)
- [Motion restraint + prefers-reduced-motion](#motion)
- [The AI-slop tells checklist](#slop-tells)
- [Adopting a provided design system / degrading to neutral defaults](#design-system)

---

## Restraint

Almost every "AI slop" tell is *over-decoration*. The fix is subtraction. A page reads as professional when it is **mostly neutral, calm, and consistent**, with emphasis used **rarely and meaningfully**. Before adding any color, gradient, shadow, glow, or animation, ask: *does this carry information, or is it decoration?* If decoration, cut it. The polished output from our session was 90% greyscale; the brand color appeared on maybe 5% of the pixels.

---

## Color

**One brand accent, reserved for primary/active/route only. Everything else is neutral grey.** No rainbow. No "each card a different color."

- Pick **one** primary brand color (the route/highlight/CTA color) and at most **one** secondary accent for a second semantic meaning (e.g. data/events). The tokens model this exactly: `--primary-500` (+ `--primary-400` hover), `--secondary-500`, then a full neutral ramp `--neutral-100 … --neutral-900`.
- The accent appears on: the active nav item, the primary CTA, the active overlay lens, the request route, the one hero object. **Nothing else.** Body text is `--neutral-900`; secondary text `--neutral-600`/`--neutral-700`; borders `--neutral-200`/`--neutral-300`; surfaces `--neutral-100`.
- Status/semantic colors (success/warn/error, or teal/amber data accents in the blueprint) are a separate small, fixed palette — not decoration, and used only where they mean something.
- Backgrounds are flat neutral (the shell uses `#dfe8f2` to match the 3D scene). Never tint a surface "for visual interest."

If you find yourself reaching for a third hue to make something "pop," the layout/hierarchy is the real problem — fix spacing and weight instead.

---

## Type

A flat, default font stack at one size is a slop tell. Use a **real type scale** and **one** considered pairing.

- **Scale** (modular, ~1.25 ratio): e.g. `12 / 14 / 16 / 20 / 25 / 31 / 39 / 49px`. Body 16–18px, generous `line-height` (1.5–1.65 for body, 1.1–1.25 for display). Limit yourself to ~4 sizes on a page.
- **Weights**: a clear jump — e.g. 400 body, 600 (`--weight-semibold`) for emphasis/headings, occasionally 700 for display. Avoid using 5 weights.
- **One good pairing**: a clean grotesque/humanist sans for everything (Inter, Noto Sans — the shell default — Söhne, General Sans, or system-ui) **plus a monospace** for signatures/code/labels (JetBrains Mono, IBM Plex Mono, ui-monospace). That mono is also the blueprint section's voice (see below). Don't pair two display fonts.
- Tighten display tracking slightly (`letter-spacing: -0.01em` on large headings); leave body alone. Uppercase + wide tracking (`0.08em`) only for tiny eyebrow/label text.

---

## Whitespace, radius, shadow

- **Generous whitespace.** Cramped is the cheapest slop tell. Use a spacing scale (`4 8 12 16 24 32 48 64 96`) and pick from it consistently — never random `13px`/`17px` values. Section padding should feel almost too large. Let things breathe; align to a grid.
- **Consistent border-radius: 2–3px** on chrome (cards, buttons, inputs, modals). Pick one value and use it everywhere. Big pill radii and `border-radius: 20px` blobs read as toy-like; sharp 2–3px reads as engineered/designed. (The low-poly 3D objects get their softness from `RoundedBoxGeometry`, not the UI.)
- **Shadow discipline.** At most 1–2 shadow tiers, soft and low-opacity (`0 1px 2px rgba(0,0,0,.06)`, `0 8px 24px rgba(0,0,0,.10)` for a floating modal). Never stack heavy drop-shadows; never put a shadow on everything. A 1px neutral **border** often reads cleaner than a shadow.

---

## Flat chrome

**No gradient soup in the chrome.** Nav bars, cards, buttons, panels are **flat fills** (a neutral surface + optional 1px border). Gradients belong, if anywhere, to (a) the 3D scene's sky/fog, (b) a single hero backdrop, (c) glow sprites in 3D — never to UI surfaces. A gradient button, a gradient card, a gradient nav = instant slop. Keep WebGL where the richness lives and keep the DOM chrome quiet so the 3D reads as the star.

---

## Blueprint

The interactive architecture section uses a distinct **"modernized blueprint"** dark theme — it signals "this is the engineering view" and contrasts the pale hero. It's deliberately self-contained (hard-coded hexes, not the brand tokens).

- **Dark navy/slate background** (`#0e1726`–`#16202c` range), not pure black.
- **Thin, low-contrast grid** behind the map (`rgba(255,255,255,.04)` 1px lines, ~32px cells) — the "blueprint paper." Subtle; you should barely notice it.
- **Semantic accents: teal + amber** (e.g. `#6fc7cf` data/flow, `#f0b35c` ownership/warn) plus one reserved brand accent (a deeper teal `#1fa9b8` in the templates) for the route. Each overlay lens owns one accent via `--ov-accent`; highlighted strokes/badges inherit it.
- **Monospace for signatures** — node labels, endpoint signatures, type tags, the legend — in mono at 11–13px. This is what makes it read as a technical diagram, not a marketing graphic.
- Nodes are thin-stroked rounded rects with a faint fill; edges are 1.5px strokes. Dim non-active lens elements to ~18% opacity (the `data-ov` / `on-XX` dimming convention) so the active path is unmistakable.
- The nav flips to a `.dark` variant while the dark map is under it (tracked via ScrollTrigger) so it stays legible.

---

## Low-poly

The 3D world style that reads as "designed diorama," not "default Three.js demo":

- **Pale isometric palette.** A long telephoto FOV (~32°) flattens the scene into an isometric-ish diorama. Cool pale blue-greys for environment (`bg`, `ground`, `water`, `building*` tokens), warm neutral for any "legacy/aged" structure. Soft, desaturated — not saturated primaries.
- **`RoundedBoxGeometry` everywhere** for box objects — the soft rounded edge is the whole look. Sharp default `BoxGeometry` reads as a programmer's placeholder.
- **Soft two-light sun rig + PCFSoft shadows**, ACESFilmic tone mapping, slight exposure (1.06) for a gentle filmic roll-off. Fog fuses distant geometry into the background.
- **Brand color only on hero objects.** The world is pale neutral; the one or two objects the story is *about* get the brand accent (and maybe a glow). Containers/crowds/trees stay neutral. Same restraint rule as the UI: emphasis is rare and meaningful.
- Tiny instanced people/containers/trees give scale and life without detail. Keep silhouettes simple; let light and shadow do the work.

---

## Motion

- **Restraint.** Motion should clarify (reveal hierarchy, show flow direction, guide the eye through the story), never just decorate. No bouncing, no spinning logos, no parallax-everything, no scroll-jacking that fights the user. Ease with `power2.out`-ish curves; durations 0.3–0.8s for UI, scrubbed for the journey.
- **Respect `prefers-reduced-motion`.** Detect once (`const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches`) and: collapse the scroll-driver height to `0`, show the 3D scene statically (no scrub, no scene motion), skip auto-tours and reveal animations (show content immediately), and stop ambient animation (rotors, drift). Provide the full information without the movement. This is both an accessibility requirement and a quality signal.

---

## Slop tells

Avoid all of these — each one screams "AI generated":

- [ ] **Centered everything** — every section center-aligned, text and all. Use left-aligned text and asymmetric, intentional layouts.
- [ ] **Purple/blue gradients** on backgrounds, buttons, cards ("AI startup gradient"). Flat fills instead.
- [ ] **Emoji headers** (🚀 Features, ✨ Benefits). Never. Use type weight/size for hierarchy.
- [ ] **Glassmorphism overload** — frosted blurred translucent panels everywhere. At most one, if it earns it.
- [ ] **Default Bootstrap-y look** — that specific blue, rounded-pill buttons, card with heavy shadow, container max-width with everything centered.
- [ ] **Inconsistent spacing** — random px values, no scale, misaligned edges.
- [ ] **Rainbow / one-color-per-card.** One accent, neutrals elsewhere.
- [ ] **Too many fonts / weights / sizes.** One pairing, ~4 sizes.
- [ ] **Big pill radii** (`border-radius: 999px` on cards). 2–3px.
- [ ] **Stacked heavy drop-shadows** and glows on UI chrome.
- [ ] **Generic stock hero** with a vague headline ("Empower your workflow"). Be specific to the actual system.
- [ ] **Animation on everything** / scroll-jacking with no reduced-motion path.
- [ ] **Default Three.js**: sharp grey cubes, harsh single light, no tone mapping, no shadows, saturated rainbow materials.

If two or more of these are present, the page looks AI-made regardless of effort elsewhere.

---

## Design system

### Design-system intake (do this FIRST, before building)
Consistency comes from deciding tokens once, up front — not discovering them mid-build. At the start
of any visualization, **ask the user** for the design system rather than silently defaulting. Keep it
short and concrete (they shouldn't have to write a spec):

1. **Brand colors** — a primary/accent hex, a logo, or a site/page to pull the palette from?
2. **Fonts** — a display + body pairing, or a brand font? (If none, propose a tasteful pairing — *not*
   Inter-everywhere.)
3. **Logo / wordmark** — for the nav and (optionally) in-world signage.
4. **Aesthetic** — dark "blueprint" (architecture maps), pale low-poly 3D world (scroll-stories), or both?
5. **A page/screenshot to match?** — the fastest route to consistency; mirror its palette, type scale,
   spacing, and radius.

If they have **nothing**, don't guess silently — **propose a concrete system** (show the one reserved
accent + the font pairing + the aesthetic) and get a quick thumbs-up. Then **record the decision** in a
`DESIGN-SYSTEM.md` next to the page so later edits and the next session stay consistent. Template:

```md
# Design system — <project>
Accent (primary):   #__  (used ONLY on active/primary/route/one hero object)
Secondary accent:   #__  (one more semantic meaning, e.g. data/events) — or "none"
Neutrals:           bg #__  surface #__  border #__  text #__  muted #__
Display font:       "____"  (headings)         Body font: "____"   Mono: "____"
Type scale:         e.g. 12 · 14 · 16 · 20 · 26 · 40 · 64 (a small modular set)
Radius / spacing:   radius __px · spacing unit __px (4 or 8)
Logo:               <path or "wordmark text">
Aesthetic:          dark-blueprint | pale-low-poly | both
3D PALETTE:         brand #__  accent #__  environment/neutral #__
```
Wire these into the `:root` token block in `styles.css` and the 3D `PALETTE` **before** building any
component, so every piece is consistent from the first line. The `slop-lint.mjs` script will flag drift
(too many accent colors, type-scale sprawl) if you stray.

**When the user provides a design system** (colors, fonts, logos, e.g. a brand kit or a skill like a corporate design system):

1. Map their tokens onto the skill's token names so nothing downstream changes: `--font-primary`, `--weight-semibold`, `--primary-500`/`--primary-400` (their primary), `--secondary-500` (their accent), `--neutral-100…900` (their greyscale).
2. Two ways to apply: edit the `:root` block in `styles.css`, **or** load their design-system CSS *before* `styles.css` so its `:root` wins (cleaner, keeps the skill file pristine).
3. Recolor the 3D `PALETTE` (`brand`, `accent`, `accentGlow`) to their primary/secondary; keep environment tones neutral.
4. Use their logo via the canvas-texture trick for in-world signage and a real `<img>`/SVG in the nav. Respect their logo clear-space and minimum size.
5. **Still apply restraint.** A brand kit is permission to use *their* accent — not permission to abandon the one-accent rule. Honor their color hierarchy.

**When no design system is given**, degrade gracefully to the tasteful neutral defaults already in the tokens: a cool pale-grey environment, a single restrained accent (replace the example teal with something appropriate to the domain — sober blues/teals for infra, warmer for consumer), Noto Sans / system-ui + a mono. Never invent a loud brand. Default to *quiet and neutral* — it always reads as professional, and it's the safe baseline the templates ship with.
