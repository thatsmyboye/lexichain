# Lexichain UI Asset Recommendations

**Prepared for:** Banton Games / Lexichain
**Scope:** Visual asset opportunities identified across all UI screens
**Current state:** The app relies entirely on CSS gradients, Tailwind utilities, Lucide vector icons, and inline emoji. There are zero custom image assets beyond `placeholder.svg`. The UX has strong bones but lacks visual identity and personality.

---

## How to Use This Document

Each entry describes an asset ready to be generated or commissioned. Fields:

- **Location** — exact screen / component where the asset lives
- **Asset Name** — suggested filename (no extension; add `.png`, `.svg`, etc.)
- **Type** — preferred format
- **Dimensions** — output size in pixels (provide @2× for all PNGs)
- **Visual Description** — brief for the generator / artist
- **Notes** — integration context

---

## Tier 1 — Highest Impact

> Brand identity and first-impression assets. Deliver these first.

### 1. Lexichain Wordmark / Logo

| Field | Value |
|-------|-------|
| **Location** | Title Screen (center), Auth Page (top), OG/social images |
| **Suggested filename** | `logo-wordmark` |
| **Type** | Static PNG, transparent background + SVG master |
| **Dimensions** | 600 × 150 px (provide @2× at 1200 × 300) |
| **Visual description** | Stylized "Lexichain" lettering with individual letter-tile squares embedded in or stacked beneath the type; purple-to-violet gradient matching brand tokens (`hsl ~250°`). The word itself can be set in a strong geometric sans, with each letter appearing to sit inside a rounded tile. |
| **Notes** | Currently the title is rendered as a CSS `text-gradient`. A real asset is needed for favicon refresh, PWA manifest, social sharing, and any future app store listings. |

---

### 2. Title Screen Hero Key Visual

| Field | Value |
|-------|-------|
| **Location** | Title Screen — above or flanking the Play button (desktop only, hidden on mobile) |
| **Suggested filename** | `hero-key-visual` |
| **Type** | Static PNG, transparent background |
| **Dimensions** | 800 × 400 px |
| **Visual description** | Isometric or flat-art arrangement of letter-tile squares forming a visible chain — e.g. tiles spelling out W→O→R→D connected by a glowing arc or chain link between each tile. Tiles are rounded squares in the brand palette; the chain glow is a soft violet/purple. Background is transparent so the CSS gradient shows through. |
| **Notes** | Communicates the core mechanic (tile chaining) before a player reads a word. High conversion value on the title screen. |

---

### 3. App Icon / Square Logo

| Field | Value |
|-------|-------|
| **Location** | Browser favicon, PWA icon, social meta image |
| **Suggested filename** | `app-icon` |
| **Type** | PNG, transparent background |
| **Dimensions** | 512 × 512 px |
| **Visual description** | Same tile-chain concept compressed to a square: a stylized "L" formed from two or three connected letter tiles, or the letters "LC" as linked tiles, purple-to-violet gradient. Should read clearly at 32 × 32 px (favicon) and 192 × 192 px (PWA). |
| **Notes** | `favicon.ico` exists at 7.6 KB but is a generic placeholder. This replaces it. |

---

### 4. Game Mode Card Illustrations (× 10)

| Field | Value |
|-------|-------|
| **Location** | Advanced Game Modes screen — inside each mode card, top or background |
| **Suggested filename** | `mode-{id}` (e.g. `mode-classic`, `mode-survival`, …) |
| **Type** | Static PNG, transparent background |
| **Dimensions** | 240 × 160 px each |
| **Notes** | Cards currently show only a generic Lucide icon in a muted box. Distinctive illustration per mode makes modes feel desirable and increases play-through rate. Use a consistent flat/semi-flat style across all 10. |

| Mode ID | Visual Description |
|---------|--------------------|
| `classic` | Calm 4×4 grid of letter tiles with a single glowing green chain path traced across them |
| `time_attack` | Stopwatch/clock face overlaid on tiles; speed lines radiating outward from the center |
| `endless` | An infinity symbol (∞) composed of connected letter tiles, looping back on itself |
| `puzzle` | Jigsaw puzzle piece with letter tiles fitting precisely into pre-cut slots |
| `survival` | A torch or campfire casting orange light on letter tiles scattered in the dark |
| `zen` | Soft circular ripples radiating outward from a single centered tile on a calm surface |
| `chaos` | Tiles scattering in all directions mid-reshuffle, motion-blur trails on each tile |
| `mini_marathon` | Three small linked game boards in a horizontal row with a countdown timer above each |
| `weekly_gauntlet` | A seven-segment shield or 7-cell calendar grid with a different tile icon in each cell |
| `prestige_endless` | A rising bar graph or laurel wreath woven from letter tiles; a prestige star at the apex |

---

## Tier 2 — High Impact

> Store and progression assets. Directly support engagement and conversion.

### 5. Consumable Item Art (× 5)

| Field | Value |
|-------|-------|
| **Location** | Store — individual consumable cards (currently emoji only) |
| **Suggested filename** | `item-{id}` (e.g. `item-hint-revealer`) |
| **Type** | PNG, transparent background |
| **Dimensions** | 128 × 128 px each (provide @2×) |
| **Notes** | Custom art elevates perceived value and trust at the moment of purchase. |

| Item ID | Visual Description |
|---------|--------------------|
| `hint-revealer` | Glowing lightbulb with a single letter tile visible inside the glass globe |
| `score-multiplier` | A lightning bolt splitting into two beams labelled "×2"; tile motif in the bolt center |
| `hammer` | Heavy stylized hammer mid-swing, cracking a stone letter tile beneath it |
| `extra-moves` | Three footstep-arrows in sequence, each step landing on a tile square |
| `unlock-all-modes` | A golden key whose bow (ring) is shaped like a game controller or tile grid |

---

### 6. Bundle Box Art (× 3)

| Field | Value |
|-------|-------|
| **Location** | Store — bundle cards (Starter, Power, Ultimate) |
| **Suggested filename** | `bundle-starter`, `bundle-power`, `bundle-ultimate` |
| **Type** | PNG, transparent background |
| **Dimensions** | 192 × 192 px each |
| **Visual description** | Illustrated loot/treasure boxes at escalating rarity: **Starter** — simple wood crate with a tile embossed on the lid; **Power** — glowing metal chest with a visible energy aura; **Ultimate** — ornate royal chest with light spilling from the seam and floating tiles above it. |
| **Notes** | Placed in the header area of each bundle card. Directly supports purchase conversion by making tier differentiation obvious at a glance. |

---

### 7. Achievement Medal Badges (× 4)

| Field | Value |
|-------|-------|
| **Location** | Stats Page — Achievement Breakdown grid; in-game achievement reveal |
| **Suggested filename** | `medal-bronze`, `medal-silver`, `medal-gold`, `medal-platinum` |
| **Type** | PNG, transparent background |
| **Dimensions** | 256 × 256 px each |
| **Notes** | Currently displayed as colored number boxes with text labels. Rendered medal art makes achievements feel genuinely earned. |

| Medal | Visual Description |
|-------|-------------------|
| Bronze | Warm amber/copper coin with a chain-link embossed in the center; slight worn-metal texture |
| Silver | Polished silver disc with a star relief; clean, reflective surface |
| Gold | Star-topped gold medallion with a ribbon; rich yellow-gold, slight 3D depth |
| Platinum | Crystalline/prism badge with a purple-violet sheen and subtle sparkle highlights |

---

### 8. Tile Skin Preview Thumbnails (× 6)

| Field | Value |
|-------|-------|
| **Location** | Settings / Tile Skin Selector — beside each skin option |
| **Suggested filename** | `skin-preview-{id}` (e.g. `skin-preview-ocean`) |
| **Type** | PNG |
| **Dimensions** | 280 × 200 px each |
| **Visual description** | Mini mockup of a 4×4 tile grid rendered in each skin's exact color palette, including one "selected" tile with its ring highlight and one "reused" tile with its overlay tint. |
| **Notes** | Lets players evaluate skins before equipping them. |

| Skin ID | Palette Reference |
|---------|-------------------|
| `original` | Neutral card background, green selection ring |
| `ocean` | Blue-to-cyan gradient tiles, cyan selection ring |
| `forest` | Green-to-emerald gradient tiles, emerald selection ring |
| `sunset` | Orange-to-pink gradient tiles, orange selection ring |
| `midnight` | Indigo-to-purple gradient tiles, purple selection ring |
| `neon` | Dark slate background, bright cyan tiles with glow ring |

---

## Tier 3 — Medium Impact

> Contextual illustrations that add personality to high-traffic secondary screens.

### 9. Auth Page Illustration

| Field | Value |
|-------|-------|
| **Location** | Auth Page — above or beside the login/register card |
| **Suggested filename** | `auth-illustration` |
| **Type** | PNG or SVG, transparent background |
| **Dimensions** | 480 × 320 px |
| **Visual description** | Friendly, warm depiction of a player's hand (or a character) connecting tiles on a game board; inviting and approachable, not competitive. Soft purple palette. |
| **Notes** | The auth screen is currently a bare card on a gradient. An illustration at this step builds trust and reduces sign-up abandonment. |

---

### 10. Leaderboard Podium Illustration

| Field | Value |
|-------|-------|
| **Location** | Leaderboard Page — top of page, above player list |
| **Suggested filename** | `leaderboard-podium` |
| **Type** | PNG or SVG |
| **Dimensions** | 640 × 280 px |
| **Visual description** | Three-step competition podium: top step glows gold, 2nd step silver, 3rd step bronze. Each step has small letter tiles stacked on it and a tiny trophy silhouette. Clean, celebratory. |
| **Notes** | The page header is currently text-only. A podium visual anchors the competitive context immediately. |

---

### 11. Purchase Success Celebration

| Field | Value |
|-------|-------|
| **Location** | Payment Success Page — replaces the plain `CheckCircle` Lucide icon |
| **Suggested filename** | `payment-success` |
| **Type** | PNG or animated WebP |
| **Dimensions** | 320 × 320 px |
| **Visual description** | An illustrated "chest opens" moment: a bundle box cracking open with sparkles, star bursts, and letter tiles spilling outward. Warm greens and golds. |
| **Notes** | This is the conversion-confirmation moment — it should feel genuinely rewarding, not just a green checkmark. |

---

### 12. Payment Canceled Illustration

| Field | Value |
|-------|-------|
| **Location** | Payment Canceled Page |
| **Suggested filename** | `payment-canceled` |
| **Type** | PNG |
| **Dimensions** | 320 × 280 px |
| **Visual description** | A slightly sad-looking letter tile with a broken chain link hanging below it; muted, desaturated palette — not punishing, just wistful. Subtle "try again?" energy. |
| **Notes** | Softens the abandonment moment and leaves the door open for retry. |

---

### 13. Empty Stats Illustration

| Field | Value |
|-------|-------|
| **Location** | Stats Page — empty state shown when no games have been played yet |
| **Suggested filename** | `empty-stats` |
| **Type** | PNG or SVG |
| **Dimensions** | 240 × 200 px |
| **Visual description** | A blank trophy shelf or empty scoreboard with a single unlit tile in the center; soft, encouraging mood. Pairs with the existing copy "Start playing to see your stats!" |
| **Notes** | Currently a small muted `Target` Lucide icon. Illustrated empty states measurably increase first-play rates. |

---

### 14. Achievement Level Row Icons (× 4)

| Field | Value |
|-------|-------|
| **Location** | Stats Page — Challenge History list rows; inline achievement label |
| **Suggested filename** | `icon-bronze`, `icon-silver`, `icon-gold`, `icon-platinum` |
| **Type** | PNG, transparent background |
| **Dimensions** | 32 × 32 px each (provide @2×) |
| **Visual description** | Compact, tier-colored icon versions of the full medals (#7 above) — same visual language, reduced to icon scale. |
| **Notes** | Currently the same `Medal` Lucide icon is reused in the same color for every row, making tier differentiation depend solely on text. |

---

## Tier 4 — Polish

> Incremental quality improvements; tackle after Tiers 1–3 are complete.

| # | Asset Name | Filename | Type | Dimensions | Visual Description | Location |
|---|------------|----------|------|------------|--------------------|----------|
| 15 | Streak Flame Icon | `icon-streak-flame` | SVG | 48 × 48 px | Stylized animated-ready flame with a soft violet-orange glow; replaces the 🔥 emoji | Title Screen — login streak badge |
| 16 | Special Tile Textures (per skin, per type) | `tile-texture-{skin}-{type}` | PNG semi-transparent | 128 × 128 px | Stone-tile crack texture, golden highlight shimmer, multiplier tile glow — one per tile type per skin | Game board special tile overlays |
| 17 | Mode Selection Button Icons (× 3) | `btn-daily`, `btn-daily-5x5`, `btn-more-modes` | PNG transparent | 96 × 96 px each | Daily Challenge = calendar + sun; Daily 5×5 = larger grid icon; More Game Modes = game controller | Mode Selection Screen buttons |
| 18 | Settings Page Header Illustration | `settings-illustration` | PNG or SVG | 400 × 160 px | A paintbrush or palette mid-stroke painting a letter tile; communicates customization | Settings / Tile Skin Selector |
| 19 | 404 Not Found Illustration | `404-illustration` | PNG or SVG | 400 × 300 px | A tile grid with a large "?" tile in the center; surrounding tiles spell "LOST"; the chain path ends at the question mark | 404 / Not Found page |

---

## Style & Format Reference

| Property | Specification |
|----------|--------------|
| **Art style** | Flat / semi-flat with subtle depth. Consistent with the app's clean Tailwind aesthetic. Avoid photorealism or heavy gradients. |
| **Color palette** | Brand purple/violet (`hsl ~250° 47% 11%`), brand-400 through brand-600 (violet), warm amber/orange for achievement tiers, cyan for Neon skin accents. |
| **Corner radius** | All tile art should use slightly rounded corners matching the app's `border-radius: 0.5rem` language. |
| **Export formats** | PNG with transparency for all items. SVG preferred for logo, icons, and empty-state illustrations. Provide `@2×` (double resolution) for all PNGs. |
| **Dark mode** | All assets must work on both light and dark backgrounds. Use transparent backgrounds; avoid white fills or white halos. |
| **File size targets** | Illustrations < 150 KB per PNG; icons < 30 KB per PNG; SVGs should be cleaned and minified. |
| **Naming convention** | `kebab-case`, no spaces. Group by category prefix: `logo-`, `mode-`, `item-`, `bundle-`, `medal-`, `skin-preview-`, `icon-`, `empty-`, `payment-`. |

---

## Suggested Delivery Order

1. **Logo wordmark + App icon** — unlocks favicon, social sharing, OG tags immediately
2. **Mode card illustrations (×10)** — highest visible surface area in the app
3. **Consumable item art + Bundle box art** — store conversion
4. **Achievement medal badges (×4)** — stats page and in-game reward moments
5. **Tile skin preview thumbnails (×6)** — settings UX
6. **Auth + leaderboard + payment illustrations** — secondary screens
7. **Tier 4 polish** — streak icon, special tiles, 404, empty states
