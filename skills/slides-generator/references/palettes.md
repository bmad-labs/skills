# Color Palette Library

> 80 color palettes, organized by style

---

## File Structure Index (AI Layered Reading Guide)

> **Important**: AI should read on-demand in layers, avoid reading the entire file at once.

| Content | Line Range | Description |
|---------|------------|-------------|
| Quick Query Index | 32-117 | 80 palettes with ID/name/tags/scenario |
| AI Usage Guide | 117-150 | Color value mapping and derivation rules |
| Dark/Black Themes | 155-365 | 18 palette details |
| Light/Minimal Themes | 366-432 | 6 palette details |
| Neon/Cyberpunk | 433-486 | 5 palette details |
| Natural Landscapes | 487-579 | 9 palette details |
| Seasonal Themes | 580-620 | 3 palette details |
| Metallic Colors | 621-661 | 3 palette details |
| Brand/Tech | 662-715 | 5 palette details |
| Food Inspired | 716-795 | 8 palette details |
| Weather/Mood | 796-823 | 2 palette details |
| Vintage/Retro | 824-864 | 3 palette details |
| Dual Color Contrast | 865-996 | 10 palette details |
| Monochrome | 997-1076 | 6 palette details |
| Professional/Business | 1077-1143 | 5 palette details |
| Regional/Cultural | 1144-1158 | 1 palette details |
| Other Palettes | 1159-1250 | 8 palette details |
| Brand-Inspired Themes | 1280-1400 | 3 palette details (Redis) |

---

## Quick Query Index

| ID | Name | Tags | Recommended Scenario | Style | Jump |
|----|------|------|----------------------|-------|------|
| 01 | Dark Sapphire Blue | dark,blue,professional,tech | Tech products,dark mode | glass | [→](#dark-sapphire-blue) |
| 02 | dark-blue-green-red | dark,colorful,high contrast | Visual impact | glass | [→](#dark-blue-green-red) |
| 03 | dark-blue-red-blush | dark,blue,red accent | Dark tech | glass | [→](#dark-blue-red-blush) |
| 04 | Dark Sage Green | dark,green,natural | Nature/eco | glass | [→](#dark-sage-green) |
| 05 | purple-dark-black-blue | dark,purple,neon | Cyberpunk | glass | [→](#purple-dark-black-blue) |
| 06 | gold-dark | dark,gold,luxury | Luxury brands | glass | [→](#gold-dark) |
| 07 | dark-dull-peach | dark,peach,warm | Warm dark | glass | [→](#dark-dull-peach) |
| 08 | dark-brick-mustard | dark,yellow,red | Energetic dark | glass | [→](#dark-brick-mustard) |
| 09 | dark-chartreuse | dark,yellow-green,natural | Nature tech | glass | [→](#dark-chartreuse) |
| 10 | dark-lavendar | dark,purple,romantic | Romantic dark | glass | [→](#dark-lavendar) |
| 11 | moody-intense-red | dark,red,intense,passionate | Passionate showcase | glass | [→](#moody-intense-red) |
| 12 | maroon-dull-browns | dark,maroon,brown,vintage | Vintage style | flat | [→](#maroon-dull-browns) |
| 13 | space | dark,space,starry,gold accent | Sci-fi space | glass | [→](#space) |
| 14 | starry-night | dark,starry,artistic,Van Gogh style | Art showcase | glass | [→](#starry-night) |
| 15 | moon-and-mars | dark,space,Mars colors | Space theme | glass | [→](#moon-and-mars) |
| 16 | Electric City Nights | dark,blue,city,tech | Tech products | glass | [→](#electric-city-nights) |
| 17 | hacker-news | dark,orange,tech,geek | Geek/developer | glass | [→](#hacker-news) |
| 18 | minimal-modern-light | light,minimal,blue,modern | Corporate website | flat | [→](#minimal-modern-light) |
| 19 | white-with-blue | light,blue,fresh | Fresh products | flat | [→](#white-with-blue) |
| 20 | black-and-white | minimal,black-white,classic | Minimal design | flat | [→](#black-and-white) |
| 21 | blueberry-contrast | light,soft,contrast | Soft showcase | flat | [→](#blueberry-contrast) |
| 22 | orange-flat-shadow | light,orange,flat,modern | Modern flat | flat | [→](#orange-flat-shadow) |
| 23 | neon | neon,purple,nightclub,sci-fi | Nightclub/sci-fi | glass | [→](#neon) |
| 24 | cyberpunk | cyberpunk,neon,sci-fi,future | Cyberpunk | glass | [→](#cyberpunk) |
| 25 | neon-downtown-lights | neon,city,night,colorful | City nightscape | glass | [→](#neon-downtown-lights) |
| 26 | dance-network | neon,pink,cyan,energetic | Energetic showcase | glass | [→](#dance-network) |
| 27 | summer-meadow | nature,summer,meadow,green | Nature/summer | flat | [→](#summer-meadow) |
| 28 | rustic-mountain-cabin | nature,mountain,cabin,brown | Nature/mountain | flat | [→](#rustic-mountain-cabin) |
| 29 | ocean-sunset | nature,ocean,sunset,warm | Sunset/ocean | flat | [→](#ocean-sunset) |
| 30 | deserted-island | nature,island,beach,tropical | Tropical/travel | flat | [→](#deserted-island) |
| 31 | dull-green-forest | nature,forest,green,subdued | Forest/subdued | flat | [→](#dull-green-forest) |
| 32 | deep-green | nature,deep green,forest,energetic | Eco/energetic | flat | [→](#deep-green) |
| 33 | marigold-forest-green | nature,marigold,forest green,autumn | Autumn/nature | flat | [→](#marigold-forest-green) |
| 34 | halloween-warm | seasonal,halloween,warm,orange | Halloween | flat | [→](#halloween-warm) |
| 35 | spring | seasonal,spring,fresh,soft | Spring/fresh | flat | [→](#spring) |
| 36 | autumn | seasonal,autumn,leaves,warm | Autumn/warm | flat | [→](#autumn) |
| 37 | gold-and-silver | metallic,gold,silver,luxury | Luxury | glass | [→](#gold-and-silver) |
| 38 | mahogany-and-gold | metallic,mahogany,gold,premium | Premium products | glass | [→](#mahogany-and-gold) |
| 39 | vermilion-and-gold | metallic,vermilion,gold,Chinese style | Chinese style | flat | [→](#vermilion-and-gold) |
| 40 | react | brand,React,tech,frontend | Frontend/tech | glass | [→](#react) |
| 41 | facebook | brand,social media,blue | Social media | flat | [→](#facebook) |
| 42 | tiktok | brand,social media,red | Social media | glass | [→](#tiktok) |
| 43 | fc-barcelona | brand,football,sports | Sports/athletic | flat | [→](#fc-barcelona) |
| 44 | almonds | food,almonds,brown,natural | Food/natural | flat | [→](#almonds) |
| 45 | tomatoes-cucumbers | food,tomato,cucumber,fresh | Food/fresh | flat | [→](#tomatoes-cucumbers) |
| 46 | ruby | food,ruby,red,passionate | Passionate showcase | glass | [→](#ruby) |
| 47 | chocolate-mint | food,chocolate,mint,fresh | Food/fresh | flat | [→](#chocolate-mint) |
| 48 | caramel-sage-green | food,caramel,sage,warm | Warm/natural | flat | [→](#caramel-sage-green) |
| 49 | dull-peach | food,peach,soft,warm | Soft warm | flat | [→](#dull-peach) |
| 50 | sunny-day | weather,sunny,bright,warm | Sunny/bright | flat | [→](#sunny-day) |
| 51 | rainy-morning | weather,rainy,morning,calm | Calm/peaceful | flat | [→](#rainy-morning) |
| 52 | vintage-cyan-coral | vintage,cyan,coral,nostalgic | Vintage style | flat | [→](#vintage-cyan-coral) |
| 53 | vintage-jewelry-shop | vintage,jewelry,elegant,neutral | Elegant vintage | flat | [→](#vintage-jewelry-shop) |
| 54 | pantone-2023 | trend,2023,pink,soft | Trend/fashion | flat | [→](#pantone-2023) |
| 55 | blush-and-slate | dual,blush,slate,soft | Soft dual-tone | flat | [→](#blush-and-slate) |
| 56 | olive-and-coral | dual,olive,coral,natural | Natural dual-tone | flat | [→](#olive-and-coral) |
| 57 | navy-and-blush | dual,navy,blush,elegant | Elegant dual-tone | flat | [→](#navy-and-blush) |
| 58 | turquoise-and-rust | dual,turquoise,rust,contrast | Contrast dual-tone | flat | [→](#turquoise-and-rust) |
| 59 | fuscia-and-turquoise | dual,fuchsia,turquoise,energetic | Energetic dual-tone | glass | [→](#fuscia-and-turquoise) |
| 60 | aubergine-burnt-orange | dual,aubergine,burnt orange,bold | Bold dual-tone | flat | [→](#aubergine-burnt-orange) |
| 61 | celadon-and-lilac | dual,celadon,lilac,soft | Soft dual-tone | flat | [→](#celadon-and-lilac) |
| 62 | periwinkle-and-coral | dual,periwinkle,coral,romantic | Romantic dual-tone | flat | [→](#periwinkle-and-coral) |
| 63 | jade-and-coral | dual,jade,coral,contrast | Contrast dual-tone | flat | [→](#jade-and-coral) |
| 64 | tangerine-and-beige | dual,tangerine,beige,warm | Warm dual-tone | flat | [→](#tangerine-and-beige) |
| 65 | lavendar | mono,lavender,purple,romantic | Romantic/soft | flat | [→](#lavendar) |
| 66 | cerulean | mono,cerulean,bright,fresh | Fresh/bright | flat | [→](#cerulean) |
| 67 | turquoise | mono,turquoise,fresh,natural | Fresh natural | flat | [→](#turquoise) |
| 68 | chartreuse | mono,chartreuse,energetic,fresh | Energetic fresh | flat | [→](#chartreuse) |
| 69 | gray-blue-modern | mono,gray-blue,professional,modern | Professional modern | flat | [→](#gray-blue-modern) |
| 70 | deep-purple-gray | mono,deep purple-gray,elegant,vintage | Elegant vintage | flat | [→](#deep-purple-gray) |
| 71 | banking-website | professional,banking,finance,trust | Finance/corporate | flat | [→](#banking-website) |
| 72 | crimson-light-gray | professional,crimson,formal,emphasis | Formal/emphasis | flat | [→](#crimson-light-gray) |
| 73 | kelly-green-primary | professional,green,eco,success | Eco/success | flat | [→](#kelly-green-primary) |
| 74 | slate-maroon-pink | professional,gray,maroon,formal | Formal occasions | flat | [→](#slate-maroon-pink) |
| 75 | dull-grays-orange | professional,gray,orange,modern | Modern professional | flat | [→](#dull-grays-orange) |
| 76 | sweden | regional,Sweden,flag,Nordic | Nordic style | flat | [→](#sweden) |
| 77 | redis-predictions | dark,red,tech,enterprise,SaaS | Tech predictions, AI demos | flat | [→](#redis-predictions) |
| 78 | redis-docs-dark | dark,slate,developer,documentation | Developer docs, technical | glass | [→](#redis-docs-dark) |
| 79 | redis-docs-light | light,slate,developer,documentation,AI | Developer docs, AI content | flat | [→](#redis-docs-light) |
| 80 | skillsmp | light,terminal,developer,tools,code-editor | Developer tools, skill marketplace | flat | [→](#skillsmp) |

---

## AI Usage Guide

### Retrieval Process
1. Parse user requirement keywords (e.g., "tech feel", "energetic", "professional")
2. Match keywords in the "Tags" column of the index
3. Read the "Style" column to determine visual style (glass/flat)
4. Jump to anchor to read complete palette
5. Intelligently derive complete 10-color set from 5 core values

### Style Descriptions
Each palette has a default visual style, which users can override:

| Style | Description | Visual Features |
|-------|-------------|-----------------|
| glass | Glassmorphism | `bg-white/10 backdrop-blur-md border-white/20`, suitable for tech/product demos |
| flat | Flat minimal | `bg-white shadow-sm border-gray-200`, suitable for data reports/formal occasions |

### Color Value Mapping Rules
Each palette provides 5 core color values, mapped as follows:
- **Value 1** → `bg-100` (main background)
- **Value 2** → `primary-100` (primary accent)
- **Value 3** → `primary-200` (secondary accent)
- **Value 4** → `accent-100` (contrast accent)
- **Value 5** → Auxiliary color (derive others based on light/dark)

### AI Derivation of Remaining Variables
- `primary-300`: Lighten primary-100 by 30%
- `accent-200`: Darken accent-100 by 20%
- `text-100`: Light text for dark backgrounds, dark text for light backgrounds
- `text-200`: Slightly lighter/softer than text-100
- `bg-200`: Adjust bg-100 by ±5%
- `bg-300`: Border color, between bg-100 and text-200

---

## Palette Details

### Dark/Black Themes

#### dark-sapphire-blue
**Tags:** dark, blue, professional, tech

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0f1c2e` | bg-100 (main background) |
| 2 | `#1f3a5f` | primary-100 (primary accent) |
| 3 | `#4d648d` | primary-200 (secondary accent) |
| 4 | `#3d5a80` | accent-100 (contrast accent) |
| 5 | `#cee8ff` | Light text/decoration |

---

#### dark-blue-green-red
**Tags:** dark, colorful, high contrast

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0d1f2d` | bg-100 |
| 2 | `#0d6e6e` | primary-100 |
| 3 | `#4a9d9c` | primary-200 |
| 4 | `#ff3d3d` | accent-100 |
| 5 | `#ffe0c8` | Light decoration |

---

#### dark-blue-red-blush
**Tags:** dark, blue, red accent

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1a1f2b` | bg-100 |
| 2 | `#2c3a4f` | primary-100 |
| 3 | `#56647b` | primary-200 |
| 4 | `#ff4d4d` | accent-100 |
| 5 | `#ffecda` | Light decoration |

---

#### dark-sage-green
**Tags:** dark, green, natural

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1e1e1e` | bg-100 |
| 2 | `#2e8b57` | primary-100 |
| 3 | `#61bc84` | primary-200 |
| 4 | `#8fbc8f` | accent-100 |
| 5 | `#345e37` | Dark decoration |

---

#### purple-dark-black-blue
**Tags:** dark, purple, neon

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1a1a1a` | bg-100 |
| 2 | `#6a00ff` | primary-100 |
| 3 | `#a64aff` | primary-200 |
| 4 | `#00e5ff` | accent-100 |
| 5 | `#00829b` | accent-200 |

---

#### gold-dark
**Tags:** dark, gold, luxury

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1e1e1e` | bg-100 |
| 2 | `#ffd700` | primary-100 |
| 3 | `#ddb900` | primary-200 |
| 4 | `#c49216` | accent-100 |
| 5 | `#5e3b00` | Dark decoration |

---

#### dark-dull-peach
**Tags:** dark, peach, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#3c2f2f` | bg-100 |
| 2 | `#e6b8a2` | primary-100 |
| 3 | `#c79b86` | primary-200 |
| 4 | `#c96a4e` | accent-100 |
| 5 | `#ffffdc` | Light decoration |

---

#### dark-brick-mustard
**Tags:** dark, yellow, red

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#2b2b2b` | bg-100 |
| 2 | `#ffc857` | primary-100 |
| 3 | `#deab3a` | primary-200 |
| 4 | `#d90429` | accent-100 |
| 5 | `#ffbfaf` | Light decoration |

---

#### dark-chartreuse
**Tags:** dark, yellow-green, natural

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#3b3f36` | bg-100 |
| 2 | `#8cc63f` | primary-100 |
| 3 | `#628d2a` | primary-200 |
| 4 | `#f2c94c` | accent-100 |
| 5 | `#d0a00f` | accent-200 |

---

#### dark-lavendar
**Tags:** dark, purple, romantic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#3b2d4d` | bg-100 |
| 2 | `#7b4f8e` | primary-100 |
| 3 | `#563763` | primary-200 |
| 4 | `#b794c0` | accent-100 |
| 5 | `#895896` | accent-200 |

---

#### moody-intense-red
**Tags:** dark, red, intense, passionate

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#4c0000` | bg-100 |
| 2 | `#ff5733` | primary-100 |
| 3 | `#ff8a5f` | primary-200 |
| 4 | `#ffc300` | accent-100 |
| 5 | `#916600` | accent-200 |

---

#### maroon-dull-browns
**Tags:** dark, maroon, brown, vintage

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#5c0e0e` | bg-100 |
| 2 | `#8b3626` | primary-100 |
| 3 | `#61261b` | primary-200 |
| 4 | `#b5651d` | accent-100 |
| 5 | `#7f4714` | accent-200 |

---

#### space
**Tags:** dark, space, starry, gold accent

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0f1626` | bg-100 |
| 2 | `#ffffff` | primary-100 |
| 3 | `#e0e0e0` | primary-200 |
| 4 | `#ffd700` | accent-100 |
| 5 | `#917800` | accent-200 |

---

#### starry-night
**Tags:** dark, starry, artistic, Van Gogh style

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0b0f2b` | bg-100 |
| 2 | `#ffc107` | primary-100 |
| 3 | `#dda400` | primary-200 |
| 4 | `#00bcd4` | accent-100 |
| 5 | `#005e74` | accent-200 |

---

#### moon-and-mars
**Tags:** dark, space, Mars colors

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1c1c1c` | bg-100 |
| 2 | `#ff5733` | primary-100 |
| 3 | `#ff8a5f` | primary-200 |
| 4 | `#ffc300` | accent-100 |
| 5 | `#916600` | accent-200 |

---

#### electric-city-nights
**Tags:** dark, blue, city, tech

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1e1e1e` | bg-100 |
| 2 | `#0085ff` | primary-100 |
| 3 | `#69b4ff` | primary-200 |
| 4 | `#006fff` | accent-100 |
| 5 | `#e1ffff` | Light decoration |

---

#### hacker-news
**Tags:** dark, orange, tech, geek

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#1d1f21` | bg-100 |
| 2 | `#ff6600` | primary-100 |
| 3 | `#ff983f` | primary-200 |
| 4 | `#f5f5f5` | accent-100 |
| 5 | `#929292` | accent-200 |

---

### Light/Minimal Themes

#### minimal-modern-light
**Tags:** light, minimal, blue, modern

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 |
| 2 | `#3f51b5` | primary-100 |
| 3 | `#757de8` | primary-200 |
| 4 | `#2196f3` | accent-100 |
| 5 | `#003f8f` | text-100 |

---

#### white-with-blue
**Tags:** light, blue, fresh

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 |
| 2 | `#0077c2` | primary-100 |
| 3 | `#59a5f5` | primary-200 |
| 4 | `#00bfff` | accent-100 |
| 5 | `#00619a` | text-100 |

---

#### black-and-white
**Tags:** minimal, black-white, classic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#000000` | bg-100 |
| 2 | `#ffffff` | primary-100 |
| 3 | `#e0e0e0` | primary-200 |
| 4 | `#7f7f7f` | accent-100 |
| 5 | `#ffffff` | text-100 |

---

#### blueberry-contrast
**Tags:** light, soft, contrast

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#fffff3` | bg-100 |
| 2 | `#f7cac9` | primary-100 |
| 3 | `#5c5c5c` | primary-200 |
| 4 | `#ebebeb` | accent-100 |
| 5 | `#333333` | text-100 |

---

#### orange-flat-shadow
**Tags:** light, orange, flat, modern

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 |
| 2 | `#ff6600` | primary-100 |
| 3 | `#ff983f` | primary-200 |
| 4 | `#f5f5f5` | accent-100 |
| 5 | `#929292` | text-200 |

---

### Neon/Cyberpunk

#### neon
**Tags:** neon, purple, nightclub, sci-fi

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#241b35` | bg-100 |
| 2 | `#6c35de` | primary-100 |
| 3 | `#a364ff` | primary-200 |
| 4 | `#cb80ff` | accent-100 |
| 5 | `#373737` | bg-200 |

---

#### cyberpunk
**Tags:** cyberpunk, neon, sci-fi, future

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0f0f0f` | bg-100 |
| 2 | `#ff6b6b` | primary-100 |
| 3 | `#dd4d51` | primary-200 |
| 4 | `#00ffff` | accent-100 |
| 5 | `#00999b` | accent-200 |

---

#### neon-downtown-lights
**Tags:** neon, city, night, colorful

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#141414` | bg-100 |
| 2 | `#ff00ff` | primary-100 |
| 3 | `#b300b2` | primary-200 |
| 4 | `#00ffff` | accent-100 |
| 5 | `#00b2b3` | accent-200 |

---

#### dance-network
**Tags:** neon, pink, cyan, energetic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f5f5` | bg-100 |
| 2 | `#ff4081` | primary-100 |
| 3 | `#ff79b0` | primary-200 |
| 4 | `#00e5ff` | accent-100 |
| 5 | `#00829b` | accent-200 |

---

### Natural Landscapes

#### summer-meadow
**Tags:** nature, summer, meadow, green

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5ecd7` | bg-100 |
| 2 | `#8fbf9f` | primary-100 |
| 3 | `#68a67d` | primary-200 |
| 4 | `#f18f01` | accent-100 |
| 5 | `#833500` | accent-200 |

---

#### rustic-mountain-cabin
**Tags:** nature, mountain, cabin, brown

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e5e5e5` | bg-100 |
| 2 | `#8b5d33` | primary-100 |
| 3 | `#be8a5e` | primary-200 |
| 4 | `#bfbfbf` | accent-100 |
| 5 | `#616161` | text-200 |

---

#### ocean-sunset
**Tags:** nature, ocean, sunset, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f9afaf` | bg-100 |
| 2 | `#ffdab9` | primary-100 |
| 3 | `#dfb28a` | primary-200 |
| 4 | `#ffbda3` | accent-100 |
| 5 | `#975f48` | text-100 |

---

#### deserted-island
**Tags:** nature, island, beach, tropical

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5ecd7` | bg-100 |
| 2 | `#8b6b61` | primary-100 |
| 3 | `#bc998e` | primary-200 |
| 4 | `#f2a900` | accent-100 |
| 5 | `#854e00` | accent-200 |

---

#### dull-green-forest
**Tags:** nature, forest, green, subdued

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#4b5320` | bg-100 |
| 2 | `#8f9779` | primary-100 |
| 3 | `#656b53` | primary-200 |
| 4 | `#b5c99e` | accent-100 |
| 5 | `#80a15a` | accent-200 |

---

#### deep-green
**Tags:** nature, deep green, forest, energetic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0b4f30` | bg-100 |
| 2 | `#1db954` | primary-100 |
| 3 | `#14823b` | primary-200 |
| 4 | `#ffd700` | accent-100 |
| 5 | `#b39600` | accent-200 |

---

#### marigold-forest-green
**Tags:** nature, marigold, forest green, autumn

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5deb3` | bg-100 |
| 2 | `#228b22` | primary-100 |
| 3 | `#5bbc51` | primary-200 |
| 4 | `#8f9779` | accent-100 |
| 5 | `#373f25` | text-100 |

---

### Seasonal Themes

#### halloween-warm
**Tags:** seasonal, halloween, warm, orange

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7eedd` | bg-100 |
| 2 | `#ff7f50` | primary-100 |
| 3 | `#dd6236` | primary-200 |
| 4 | `#8b4513` | accent-100 |
| 5 | `#ffd299` | primary-300 |

---

#### spring
**Tags:** seasonal, spring, fresh, soft

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f5dc` | bg-100 |
| 2 | `#7fb3d5` | primary-100 |
| 3 | `#6296b7` | primary-200 |
| 4 | `#f7cac9` | accent-100 |
| 5 | `#926b6a` | accent-200 |

---

#### autumn
**Tags:** seasonal, autumn, leaves, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7e1b8` | bg-100 |
| 2 | `#8b4513` | primary-100 |
| 3 | `#61300d` | primary-200 |
| 4 | `#ff672a` | accent-100 |
| 5 | `#ff7a45` | accent-200 |

---

### Metallic Colors

#### gold-and-silver
**Tags:** metallic, gold, silver, luxury

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7f7f7` | bg-100 |
| 2 | `#ffd700` | primary-100 |
| 3 | `#ddb900` | primary-200 |
| 4 | `#c0c0c0` | accent-100 |
| 5 | `#626262` | text-200 |

---

#### mahogany-and-gold
**Tags:** metallic, mahogany, gold, premium

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#6b3e26` | bg-100 |
| 2 | `#dca10f` | primary-100 |
| 3 | `#b98900` | primary-200 |
| 4 | `#c85a17` | accent-100 |
| 5 | `#ffeea4` | text-100 |

---

#### vermilion-and-gold
**Tags:** metallic, vermilion, gold, Chinese style

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#efd8bb` | bg-100 |
| 2 | `#c74331` | primary-100 |
| 3 | `#8b2f22` | primary-200 |
| 4 | `#f2c335` | accent-100 |
| 5 | `#c2950c` | accent-200 |

---

### Brand/Tech

#### react
**Tags:** brand, React, tech, frontend

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#282c34` | bg-100 |
| 2 | `#61dafb` | primary-100 |
| 3 | `#39bcdc` | primary-200 |
| 4 | `#ff4081` | accent-100 |
| 5 | `#ffe4ff` | primary-300 |

---

#### facebook
**Tags:** brand, social media, blue

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#3b5998` | bg-100 |
| 2 | `#ffffff` | primary-100 |
| 3 | `#e0e0e0` | primary-200 |
| 4 | `#ff7f00` | accent-100 |
| 5 | `#d2d2d2` | bg-200 |

---

#### tiktok
**Tags:** brand, social media, red

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7f7f7` | bg-100 |
| 2 | `#ee1d52` | primary-100 |
| 3 | `#ff607e` | primary-200 |
| 4 | `#ffc107` | accent-100 |
| 5 | `#916400` | accent-200 |

---

#### fc-barcelona
**Tags:** brand, football, sports

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#004d98` | bg-100 |
| 2 | `#a50044` | primary-100 |
| 3 | `#dc486f` | primary-200 |
| 4 | `#ffc400` | accent-100 |
| 5 | `#916700` | accent-200 |

---

### Food Inspired

#### almonds
**Tags:** food, almonds, brown, natural

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f5dc` | bg-100 |
| 2 | `#8b5a2b` | primary-100 |
| 3 | `#be8756` | primary-200 |
| 4 | `#ffebcd` | accent-100 |
| 5 | `#9a896e` | text-200 |

---

#### tomatoes-cucumbers
**Tags:** food, tomato, cucumber, fresh

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7f7f7` | bg-100 |
| 2 | `#ff6347` | primary-100 |
| 3 | `#dc442e` | primary-200 |
| 4 | `#7fff00` | accent-100 |
| 5 | `#009900` | accent-200 |

---

#### ruby
**Tags:** food, ruby, red, passionate

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f7cac9` | bg-100 |
| 2 | `#9b111e` | primary-100 |
| 3 | `#d24a46` | primary-200 |
| 4 | `#ff5733` | accent-100 |
| 5 | `#fff3bf` | primary-300 |

---

#### chocolate-mint
**Tags:** food, chocolate, mint, fresh

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5ecd7` | bg-100 |
| 2 | `#8b5f3d` | primary-100 |
| 3 | `#bd8c68` | primary-200 |
| 4 | `#a8dadc` | accent-100 |
| 5 | `#4a797b` | accent-200 |

---

#### caramel-sage-green
**Tags:** food, caramel, sage, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5efe7` | bg-100 |
| 2 | `#c7b299` | primary-100 |
| 3 | `#a9957d` | primary-200 |
| 4 | `#a68b5b` | accent-100 |
| 5 | `#483507` | text-100 |

---

#### dull-peach
**Tags:** food, peach, soft, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5d7b5` | bg-100 |
| 2 | `#e89e6d` | primary-100 |
| 3 | `#c88252` | primary-200 |
| 4 | `#c96a41` | accent-100 |
| 5 | `#ffffcd` | primary-300 |

---

### Weather/Mood

#### sunny-day
**Tags:** weather, sunny, bright, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f9d9b7` | bg-100 |
| 2 | `#ffc300` | primary-100 |
| 3 | `#dda600` | primary-200 |
| 4 | `#ff5733` | accent-100 |
| 5 | `#fff3bf` | primary-300 |

---

#### rainy-morning
**Tags:** weather, rainy, morning, calm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#b7c9d3` | bg-100 |
| 2 | `#5e7d7e` | primary-100 |
| 3 | `#8cacad` | primary-200 |
| 4 | `#a7a37e` | accent-100 |
| 5 | `#4b4928` | text-100 |

---

### Vintage/Retro

#### vintage-cyan-coral
**Tags:** vintage, cyan, coral, nostalgic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e0e7e9` | bg-100 |
| 2 | `#5da399` | primary-100 |
| 3 | `#40867d` | primary-200 |
| 4 | `#ff6b6b` | accent-100 |
| 5 | `#8f001a` | accent-200 |

---

#### vintage-jewelry-shop
**Tags:** vintage, jewelry, elegant, neutral

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5efe8` | bg-100 |
| 2 | `#bfae9f` | primary-100 |
| 3 | `#937962` | primary-200 |
| 4 | `#c9beb9` | accent-100 |
| 5 | `#978178` | text-200 |

---

#### pantone-2023
**Tags:** trend, 2023, pink, soft

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 |
| 2 | `#bb2649` | primary-100 |
| 3 | `#f35d74` | primary-200 |
| 4 | `#ffadad` | accent-100 |
| 5 | `#ffd6a5` | accent-200 |

---

### Dual Color Contrast

#### blush-and-slate
**Tags:** dual, blush, slate, soft

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5ecec` | bg-100 |
| 2 | `#bfbfbf` | primary-100 |
| 3 | `#a2a2a2` | primary-200 |
| 4 | `#f2bac9` | accent-100 |
| 5 | `#8e5c6a` | accent-200 |

---

#### olive-and-coral
**Tags:** dual, olive, coral, natural

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f2efe9` | bg-100 |
| 2 | `#8f9779` | primary-100 |
| 3 | `#737b5e` | primary-200 |
| 4 | `#ffb6b9` | accent-100 |
| 5 | `#98585c` | accent-200 |

---

#### navy-and-blush
**Tags:** dual, navy, blush, elegant

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f2f2f2` | bg-100 |
| 2 | `#2c3e50` | primary-100 |
| 3 | `#57687c` | primary-200 |
| 4 | `#f7cac9` | accent-100 |
| 5 | `#926b6a` | accent-200 |

---

#### turquoise-and-rust
**Tags:** dual, turquoise, rust, contrast

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#b2dfdb` | bg-100 |
| 2 | `#795548` | primary-100 |
| 3 | `#a98274` | primary-200 |
| 4 | `#ffc107` | accent-100 |
| 5 | `#916400` | accent-200 |

---

#### fuscia-and-turquoise
**Tags:** dual, fuchsia, turquoise, energetic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#fce4ec` | bg-100 |
| 2 | `#00bcd4` | primary-100 |
| 3 | `#009fb6` | primary-200 |
| 4 | `#ff4081` | accent-100 |
| 5 | `#ffe4ff` | primary-300 |

---

#### aubergine-burnt-orange
**Tags:** dual, aubergine, burnt orange, bold

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#5b2c6f` | bg-100 |
| 2 | `#ff6f61` | primary-100 |
| 3 | `#df4e43` | primary-200 |
| 4 | `#ffb347` | accent-100 |
| 5 | `#925700` | accent-200 |

---

#### celadon-and-lilac
**Tags:** dual, celadon, lilac, soft

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e6f2ea` | bg-100 |
| 2 | `#b0c5d1` | primary-100 |
| 3 | `#93a8b3` | primary-200 |
| 4 | `#d1b0c5` | accent-100 |
| 5 | `#715467` | accent-200 |

---

#### periwinkle-and-coral
**Tags:** dual, periwinkle, coral, romantic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f0e8ee` | bg-100 |
| 2 | `#b5d3d2` | primary-100 |
| 3 | `#98b5b4` | primary-200 |
| 4 | `#ffb6c1` | accent-100 |
| 5 | `#985863` | accent-200 |

---

#### jade-and-coral
**Tags:** dual, jade, coral, contrast

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f2efe9` | bg-100 |
| 2 | `#00a896` | primary-100 |
| 3 | `#008b7a` | primary-200 |
| 4 | `#ff6b6b` | accent-100 |
| 5 | `#8f001a` | accent-200 |

---

#### tangerine-and-beige
**Tags:** dual, tangerine, beige, warm

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5e6cc` | bg-100 |
| 2 | `#ffa07a` | primary-100 |
| 3 | `#de835f` | primary-200 |
| 4 | `#ffc0cb` | accent-100 |
| 5 | `#99616c` | accent-200 |

---

### Monochrome

#### lavendar
**Tags:** mono, lavender, purple, romantic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f3f7` | bg-100 |
| 2 | `#8b5fbf` | primary-100 |
| 3 | `#61398f` | primary-200 |
| 4 | `#d6c6e1` | accent-100 |
| 5 | `#9a73b5` | accent-200 |

---

#### cerulean
**Tags:** mono, cerulean, bright, fresh

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#007ba7` | bg-100 |
| 2 | `#00a8e8` | primary-100 |
| 3 | `#0076a2` | primary-200 |
| 4 | `#ffb400` | accent-100 |
| 5 | `#b37e00` | accent-200 |

---

#### turquoise
**Tags:** mono, turquoise, fresh, natural

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e0f2f1` | bg-100 |
| 2 | `#26a69a` | primary-100 |
| 3 | `#408d86` | primary-200 |
| 4 | `#80cbc4` | accent-100 |
| 5 | `#43a49b` | accent-200 |

---

#### chartreuse
**Tags:** mono, chartreuse, energetic, fresh

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#dfff00` | bg-100 |
| 2 | `#7fff00` | primary-100 |
| 3 | `#aaff70` | primary-200 |
| 4 | `#00ff7f` | accent-100 |
| 5 | `#00971f` | accent-200 |

---

#### gray-blue-modern
**Tags:** mono, gray-blue, professional, modern

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#b7c4cf` | bg-100 |
| 2 | `#2e4057` | primary-100 |
| 3 | `#596b84` | primary-200 |
| 4 | `#f73859` | accent-100 |
| 5 | `#a3a3a3` | bg-200 |

---

#### deep-purple-gray
**Tags:** mono, deep purple-gray, elegant, vintage

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#44496b` | bg-100 |
| 2 | `#c9ada7` | primary-100 |
| 3 | `#ab908b` | primary-200 |
| 4 | `#f2ccb8` | accent-100 |
| 5 | `#8e6d5b` | accent-200 |

---

### Professional/Business

#### banking-website
**Tags:** professional, banking, finance, trust

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f5f5` | bg-100 |
| 2 | `#0070c0` | primary-100 |
| 3 | `#004e86` | primary-200 |
| 4 | `#ffc000` | accent-100 |
| 5 | `#b38600` | accent-200 |

---

#### crimson-light-gray
**Tags:** professional, crimson, formal, emphasis

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e9e9e9` | bg-100 |
| 2 | `#8b0000` | primary-100 |
| 3 | `#c2402a` | primary-200 |
| 4 | `#ff6347` | accent-100 |
| 5 | `#8d0000` | accent-200 |

---

#### kelly-green-primary
**Tags:** professional, green, eco, success

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e6fbe3` | bg-100 |
| 2 | `#4caf50` | primary-100 |
| 3 | `#2a9235` | primary-200 |
| 4 | `#ffc107` | accent-100 |
| 5 | `#916400` | accent-200 |

---

#### slate-maroon-pink
**Tags:** professional, gray, maroon, formal

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#4a4e4d` | bg-100 |
| 2 | `#b33a3a` | primary-100 |
| 3 | `#ea6a64` | primary-200 |
| 4 | `#f2bac9` | accent-100 |
| 5 | `#8e5c6a` | accent-200 |

---

#### dull-grays-orange
**Tags:** professional, gray, orange, modern

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#efefef` | bg-100 |
| 2 | `#ffa500` | primary-100 |
| 3 | `#dd8900` | primary-200 |
| 4 | `#808080` | accent-100 |
| 5 | `#2b2b2b` | text-100 |

---

### Regional/Cultural

#### sweden
**Tags:** regional, Sweden, flag, Nordic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f5f5f5` | bg-100 |
| 2 | `#005b99` | primary-100 |
| 3 | `#4e88ca` | primary-200 |
| 4 | `#ffd700` | accent-100 |
| 5 | `#e9aa2b` | accent-200 |

---

### Other Palettes

#### mystery-purple-gray
**Tags:** mysterious, dark, purple-gray, elegant

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#151931` | bg-100 |
| 2 | `#e7d1bb` | primary-100 |
| 3 | `#c8b39e` | primary-200 |
| 4 | `#a096a5` | accent-100 |
| 5 | `#463e4b` | bg-200 |

---

#### red-cyan-contrast
**Tags:** red, cyan, contrast, energetic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 |
| 2 | `#de283b` | primary-100 |
| 3 | `#ff6366` | primary-200 |
| 4 | `#25b1bf` | accent-100 |
| 5 | `#005461` | accent-200 |

---

#### red-gray-modern
**Tags:** red, gray, modern, professional

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#fbfbfb` | bg-100 |
| 2 | `#c21d03` | primary-100 |
| 3 | `#fd5732` | primary-200 |
| 4 | `#393939` | accent-100 |
| 5 | `#bebebe` | bg-200 |

---

#### orange-cyan-fresh
**Tags:** orange, cyan, fresh, energetic

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f4fdfd` | bg-100 |
| 2 | `#ee6c4d` | primary-100 |
| 3 | `#cc4f34` | primary-200 |
| 4 | `#f7d1b3` | accent-100 |
| 5 | `#927156` | accent-200 |

---

#### playful
**Tags:** pink, playful, cute, feminine

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#f9d5e5` | bg-100 |
| 2 | `#ffc2d0` | primary-100 |
| 3 | `#e0a4b2` | primary-200 |
| 4 | `#ff9aa2` | accent-100 |
| 5 | `#963c48` | accent-200 |

---

#### dull-blue-pink
**Tags:** blue, pink, contrast, soft

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#e6e6fa` | bg-100 |
| 2 | `#6b5b95` | primary-100 |
| 3 | `#4b4068` | primary-200 |
| 4 | `#ff7f11` | accent-100 |
| 5 | `#be5800` | accent-200 |

---

## Usage Recommendations

### By Scenario

| Scenario | Recommended Palettes |
|----------|---------------------|
| Corporate website | minimal-modern-light, banking-website |
| Tech products | react, cyberpunk, electric-city-nights, dark-sapphire-blue, skillsmp |
| E-commerce | playful, pantone-2023, fuscia-and-turquoise |
| Social media | tiktok, facebook, dance-network |
| Nature/eco | summer-meadow, deep-green, marigold-forest-green |
| Luxury brands | gold-dark, mahogany-and-gold, gold-and-silver |
| Dark mode | dark-sapphire-blue, space, starry-night |

### By Mood

| Mood | Recommended Palettes |
|------|---------------------|
| Energetic/passionate | neon, cyberpunk, tomatoes-cucumbers |
| Calm/peaceful | rainy-morning, cerulean, turquoise |
| Warm/cozy | autumn, halloween-warm, caramel-sage-green |
| Professional/trustworthy | banking-website, navy-and-blush, slate-maroon-pink |
| Romantic/soft | lavendar, periwinkle-and-coral, blush-and-slate |
| Developer/Technical | redis-docs-dark, redis-docs-light, hacker-news, react, skillsmp |
| AI/Predictions | redis-predictions, redis-docs-light, dark-sapphire-blue, space |

---

## Brand-Inspired Themes

### redis-predictions
**Tags:** dark, red, tech, enterprise, SaaS, AI, predictions
**Inspired by:** [Redis 2026 Predictions](https://redis.io/2026-predictions/)

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#10141c` | bg-100 (dark navy background) |
| 2 | `#ec2d01` | primary-100 (Redis red, CTAs) |
| 3 | `#f64516` | primary-200 (hover red) |
| 4 | `#694539` | accent-100 (muted brown) |
| 5 | `#ffffff` | text-100 (white text) |

**Extended Palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| bg-200 | `#1a1f2a` | elevated cards |
| bg-300 | `#252b38` | borders, dividers |
| text-200 | `#bbbbbc` | secondary text |
| text-muted | `#6a6a6b` | muted labels |
| accent-200 | `#6a100d` | dark red accent |

**Typography:** System sans-serif stack (-apple-system, Segoe UI, Roboto)
**Style:** flat (minimal, content-focused, enterprise SaaS)

**Recommended for:**
- AI/ML product demos
- Tech predictions presentations
- Enterprise SaaS pitches
- Forward-looking trend reports

---

### redis-docs-dark
**Tags:** dark, slate, developer, documentation, technical, modern
**Inspired by:** [Redis AI Documentation](https://redis.io/docs/latest/develop/ai/)

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#0f172a` | bg-100 (dark slate background) |
| 2 | `#3b82f6` | primary-100 (blue accent) |
| 3 | `#60a5fa` | primary-200 (light blue) |
| 4 | `#fbbf24` | accent-100 (amber highlight) |
| 5 | `#f8fafc` | text-100 (off-white text) |

**Extended Palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| bg-200 | `#1e293b` | elevated surfaces, cards |
| bg-300 | `#334155` | code blocks, borders |
| text-200 | `#94a3b8` | secondary text |
| text-muted | `#64748b` | muted text, labels |
| accent-200 | `#d97706` | dark amber |
| code-bg | `#1e293b` | code block background |

**Typography:**
- Display: Space Grotesk (variable weight)
- Body: Geist (400)
- Code: Geist Mono, Space Mono

**Style:** glass (subtle glassmorphism for cards, developer-focused)

**Recommended for:**
- Technical documentation presentations
- Developer-focused demos
- API/SDK showcases
- Code-heavy slides
- AI/ML technical content

---

### redis-docs-light
**Tags:** light, red, developer, documentation, AI, modern, technical, clean
**Inspired by:** [Redis AI Documentation](https://redis.io/docs/latest/develop/ai/)

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 (pure white background) |
| 2 | `#dc382d` | primary-100 (Redis red accent) |
| 3 | `#b82d24` | primary-200 (darker red hover) |
| 4 | `#161f31` | accent-100 (dark navy text) |
| 5 | `#161f31` | text-100 (primary text) |

**Extended Palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| bg-200 | `#f9f9f9` | secondary background, card hover |
| bg-300 | `#e5e5e5` | borders, dividers, card outlines |
| text-200 | `#6b7280` | secondary/metadata text, breadcrumbs |
| text-muted | `#9ca3af` | muted labels, placeholders |
| accent-200 | `#ff6b5b` | light red for icons |
| code-bg | `#1e293b` | code block background (dark) |
| code-text | `#f8fafc` | code text (light on dark) |
| link | `#dc382d` | accent links (Commands, etc.) |

**Typography:**
- Display: System sans-serif (-apple-system, BlinkMacSystemFont, Segoe UI)
- Body: System sans-serif (clean, readable)
- Code: Monospace (JetBrains Mono, Fira Code)

**UI Elements:**
- Cards: white bg, `#e5e5e5` border, no shadow, `rounded-lg`
- Icons: Redis red `#dc382d` or coral `#ff6b5b`
- Active nav indicator: vertical red bar on left
- Links: underlined text, red for accent links
- Buttons: red bg `#dc382d` with white text

**Style:** flat (clean documentation style, minimal shadows, high readability)

**Recommended for:**
- Technical documentation presentations
- AI/ML feature showcases
- Developer tutorials
- API walkthroughs
- Clean, professional technical content

---

### skillsmp
**Tags:** light, terminal, developer, tools, code-editor, IDE, marketplace, skills
**Inspired by:** [Skills Marketplace Categories](https://skillsmp.com/categories)

| Value | Hex | Usage |
|-------|-----|-------|
| 1 | `#ffffff` | bg-100 (pure white background) |
| 2 | `#00bfa5` | primary-100 (teal/cyan for keywords like "export", "import") |
| 3 | `#00a68e` | primary-200 (darker teal for hover) |
| 4 | `#7c4dff` | accent-100 (purple for highlights) |
| 5 | `#1a1a1a` | text-100 (primary dark text) |

**Extended Palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| bg-200 | `#f8f8f8` | card backgrounds, elevated surfaces |
| bg-300 | `#e8e8e8` | borders, dividers |
| text-200 | `#666666` | secondary text, comments (// syntax) |
| text-muted | `#999999` | muted labels, placeholders |
| accent-200 | `#e91e63` | pink/red for status indicators, warnings |
| accent-300 | `#4caf50` | green for numbers, success states |
| terminal-red | `#ff5f57` | traffic light dot - close |
| terminal-yellow | `#ffbd2e` | traffic light dot - minimize |
| terminal-green | `#28c940` | traffic light dot - maximize |
| chip-bg | `#f0f0f0` | chip/tag background |
| chip-border | `#d0d0d0` | chip/tag border |

**Typography:**
- Display: JetBrains Mono, Fira Code, or SF Mono (monospace for code feel)
- Body: Inter, -apple-system, sans-serif (clean, readable)
- Code: JetBrains Mono, Fira Code

**UI Elements:**
- Cards: White bg with subtle border (`#e8e8e8`), code-editor chrome with traffic light dots
- File tabs: `filename.ts` style headers with colored dots
- Comments: `// 37081 skills` style for metadata/counts
- Keywords: Teal `export`, `import` before titles
- Chips/Tags: Rounded pills with light bg, subtle border
- Terminal prompt: `$` prefix for commands, `$ pwd: ~ / path` style breadcrumbs
- Status indicator: Green dot for "ready" state
- Numbers: Green accent color for stats/counts

**Card Patterns:**
```
┌─────────────────────────────────────┐
│ ● ● ●  filename.ts           $ cmd →│  (traffic lights + file + action)
├─────────────────────────────────────┤
│ 🔧 export Title                     │  (icon + keyword + title)
│ // 12345 items                      │  (comment-style metadata)
└─────────────────────────────────────┘
```

**Navigation Style:**
- Breadcrumb: `$ pwd: ~ / categories` (terminal-style path)
- Nav chips: Rounded buttons with `$` prefix commands
- Active state: Darker bg or underline

**Hover Animations:**
- **Card hover**: Border color transitions from `#e8e8e8` to primary teal `#00bfa5`
- **Text color change**: Card title/content transitions to primary teal on hover
- **Arrow reveal**: Right arrow (`→`) appears in bottom-right corner on hover
- **Smooth transition**: `transition: all 0.2s ease` for color and border changes
- **No scale/shadow**: Cards stay flat, only color changes (no lift effect)

**Hover State Example:**
```
Normal state:                      Hover state:
┌─────────────────────┐           ┌─────────────────────┐ ← teal border
│ filename.ts       ● │           │ filename.ts       ● │
│                     │           │                     │
│ import Title        │  ──────►  │ import Title        │ ← teal text
│ // 1234 skills      │           │ // 1234 skills      │ ← teal numbers
│                     │           │                   → │ ← arrow appears
└─────────────────────┘           └─────────────────────┘
```

**Framer Motion Implementation:**
```jsx
// Card hover animation
<motion.div
  className="border border-gray-200 rounded-lg p-4"
  whileHover={{
    borderColor: '#00bfa5',
    transition: { duration: 0.2 }
  }}
>
  <motion.span
    className="text-gray-900"
    whileHover={{ color: '#00bfa5' }}
  >
    import Title
  </motion.span>
  <motion.span
    className="opacity-0"
    whileHover={{ opacity: 1 }}
  >
    →
  </motion.span>
</motion.div>
```

**Style:** flat (clean, IDE-inspired, code-editor aesthetic)

**Recommended for:**
- Developer tools presentations
- Skill/plugin marketplace demos
- CLI tool showcases
- Technical product catalogs
- IDE/editor feature presentations
- API/SDK directory displays
