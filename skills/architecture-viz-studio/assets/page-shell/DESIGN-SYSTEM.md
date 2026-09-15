# Design system — <project name>

Fill this in at the START of the build (ask the user; if they have nothing, propose values and get a
thumbs-up). Wire it into the `:root` block of `styles.css` and the 3D `PALETTE` before building any
component, so every piece is consistent from the first line. Keep this file next to the page so later
edits and the next session stay on-brand. See references/styling-and-anti-slop.md → "Design-system intake".

## Tokens

| Token | Value | Notes |
|---|---|---|
| **Accent (primary)** | `#______` | Used ONLY on active / primary / route / the one hero object |
| Secondary accent | `#______` or none | One more semantic meaning (e.g. data/events) |
| Background | `#______` | |
| Surface | `#______` | cards / panels |
| Border | `#______` | |
| Text | `#______` | body |
| Muted text | `#______` | secondary |
| Display font | `"________"` | headings — NOT Inter-everywhere |
| Body font | `"________"` | |
| Mono font | `"________"` | technical labels |
| Type scale | `__ · __ · __ · __ · __ · __ · __` | a small modular set (~6–9 steps) |
| Radius | `__px` | consistent; vary deliberately, not uniformly |
| Spacing unit | `4px` or `8px` | snap margins/paddings to this grid |
| Logo | `<path or wordmark text>` | nav + optional in-world signage |
| Aesthetic | `dark-blueprint` \| `pale-low-poly` \| `both` | |

## 3D PALETTE (if there's a scene)

| Role | Hex |
|---|---|
| brand (route / hero object) | `#______` |
| accent (secondary semantic) | `#______` |
| environment / neutral | `#______` |

## Source

Where these came from (brand kit / a page we matched / proposed-and-approved): ______
