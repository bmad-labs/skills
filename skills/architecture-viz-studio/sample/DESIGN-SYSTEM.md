# Design system — Streamflix delivery sample

A worked example of a filled-in intake. This is the design system the `sample/` page actually uses —
one reserved red accent, neutral greys, a real type scale. It passes `slop-lint.mjs`. (The sample is a
simplified illustration of a CDN video-delivery pipeline, inspired by Netflix Open Connect.)

## Tokens

| Token | Value | Notes |
|---|---|---|
| **Accent (primary)** | `#e50914` (signature red) | The ONE accent — the "stream"/film, eyebrow, card dots, active nav, TV screen |
| Secondary accent | none | (the dark racks / origin are object materials, not UI accents) |
| Background | `#f6f8fb` | cool pale grey |
| Surface | `#ffffff` | cards |
| Border | `#e3e8ef` | |
| Text | `#11161d` (ink) | body |
| Muted text | `#5b6675` | secondary |
| Display font | system stack (`-apple-system, Segoe UI, Roboto…`) | a real pairing would swap a display face in |
| Body font | same system stack | |
| Mono font | `ui-monospace, Menlo` | the beat numbers, technical labels |
| Type scale | `13 · 14.5 · 16 · 17 · 19 · 26 · clamp(40–76)` | small modular set |
| Radius | `12px` | one consistent radius |
| Spacing unit | `8px` | |
| Logo | wordmark "▶ Streamflix · Delivery" | nav |
| Aesthetic | `pale-low-poly` | scroll-story with a pale 3D world |

## 3D PALETTE

| Role | Hex |
|---|---|
| brand (stream / film / origin halo / TV) | `#e50914` |
| racks (encode farm / origin slabs) | `#2b3340` / `#3a4456` |
| edge appliances | `#4a5568` |
| environment / neutral | `#f0f1f5` ground, `#c6cdda` neutral meshes |

## Source

A simplified, original illustration of the path a video takes through a CDN (studio → encode → origin →
edge appliance in your ISP → adaptive playback), inspired by the publicly documented Netflix Open
Connect architecture. The single red accent + neutral greys is the safe, professional default; a real
project would swap in the user's brand accent + font pairing here.
