# Lexichain custom art and asset list

An itemized list of the custom art, audio, and platform assets that would lift the game, written against the build on `main` as of November 2026. It replaces an earlier asset recommendations file from February 2026, since removed, which predated the logo, skins, trophies, and board depth work.

## What exists today

Almost everything on screen is drawn in code. That keeps the app small and themeable, and it is also why the game has little visual identity of its own.

| Area | How it is made today |
|---|---|
| Logo | Code-drawn wordmark: nine letter tiles joined by chain links (`src/components/brand/Logo.tsx`) |
| Tiles and board | CSS gradients, generated noise textures, and shadows for ten skins (`src/lib/tileSkins.ts`, `src/index.css`) |
| Special tiles | Flat gradient fills with generic line icons from the Lucide icon set (`SpecialTileIcon.tsx`) |
| Medals, trophies, consumables, Survival | Emoji. The source uses 64 different emoji about 250 times |
| Mode and menu icons | Lucide line icons |
| Sound | All 18 sound events are synthesized tones. There are no audio files |
| Typeface | The device's system font. There is no brand typeface |
| App icons | A 192 and 512 icon, one maskable icon, an Apple touch icon, and one social share image |
| Illustrations | None. Empty states, sign-in, and the 404 page are text only |

## How to read this list

- **ID** is a stable handle for briefs and tickets.
- **Qty** counts finished deliverables, not source files.
- **Replaces** says what stands in for the asset today, so the gap is clear.
- **Priority** is P1 for assets players see every session, P2 for regular but secondary surfaces, and P3 for polish.

The format and size rules in the "Delivery specs" section apply to every item unless its row says otherwise.

## Summary

| Section | Items | Deliverables | Priority |
|---|---|---|---|
| A. Board and tiles | 6 | 53 | P1 |
| B. Special tiles | 3 | 29 | P1 |
| C. Motion and effects | 6 | 14 | P2 |
| D. Rewards | 6 | 40 | P1 |
| E. Brand and platform | 8 | 31 | P1 |
| F. Modes and menus | 4 | 19 | P2 |
| G. Survival mode | 7 | 33 | P2 |
| H. Illustrations | 8 | 13 | P3 |
| I. Audio | 4 | 28 | P2 |
| J. Typography | 2 | 2 | P1 |
| **Total** | **54** | **262** | |

---

## A. Board and tiles

The board now has depth: each tile is a raised face over a visible edge, sitting in a recessed tray. Those surfaces are still flat color and generated noise. Real materials are the highest-value art in the game, because the board is on screen for the whole session.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| A1 | Tile face material, one per skin, in light and dark | 19 | CSS gradient plus generated noise | Seamless tile, 256 × 256, WebP or PNG | Ten skins: Original, Ocean, Forest, Sunset, Midnight, Neon, Harvest, Frost, Lunar, Bloom. Letters sit on top, so keep the center calm and low contrast. Neon is dark in both themes and needs one version, not two |
| A2 | Tile edge material, one per skin, in light and dark | 19 | A single flat color per skin | Seamless strip, 256 × 32 | The side of the tile below the face. Wood end grain for Forest, a glass rim for Ocean, lacquer for Lunar. One version for Neon |
| A3 | Tray and frame art, one per skin | 10 | CSS gradient with a border and inset shadow | 9-slice frame, 512 × 512, plus a seamless floor tile 256 × 256 | The surround the tiles sit in. Must stretch to 4×4, 5×5, and 6×6 boards. Seasonal skins can carry small set dressing: leaves, snow, lanterns, petals |
| A4 | Rare-letter foil | 2 | A moving CSS gradient | Seamless gradient map, 256 × 256 | One for rare letters, one stronger version for J, Q, X, Z |
| A5 | Chain link for the word path | 2 | A translucent straight line drawn over the letters | SVG, link and end cap | The trail through selected tiles, drawn as links between tile edges so letters stay readable. Needs to tint to the valid, invalid, and warning colors |
| A6 | "In last word" marker | 1 | The ⛓ character | SVG, 24 × 24 | Small corner mark on tiles reused from the previous word. Should echo the logo's chain link |

Notes for the artist:

- Tiles render between about 48 and 104 px wide. Check every material at 48 px.
- Each skin's face, edge, and tray are one set. Brief and review them together.
- The four seasonal skins only appear in their date windows: Harvest in October, Frost from December to early January, Lunar from late January to late February, Bloom from late March through April.

## B. Special tiles

There are 13 special tiles. Each is a colored square with a small generic icon in the corner, so players learn them by color. Custom objects would let the shape explain the power.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| B1 | Special tile object art | 13 | Gradient fill plus a Lucide icon | Layered SVG preferred, or PNG 256 × 256 | One per type, listed below. The letter must stay legible on top of or beside the object |
| B2 | Special tile glyphs | 13 | Lucide icons | SVG, 24 × 24, single color | Matching simplified marks for small sizes: the Next Tile preview, the tooltip, and How to Play |
| B3 | State overlays | 3 | CSS shapes | SVG or PNG with transparency, 256 × 256 | Frost overlay for frozen tiles, in a directional and an all-around version, plus the expiry ring |

Suggested direction for B1:

| Tile | Power | Object |
|---|---|---|
| Stone | Blocks the path | A rough rock that stands taller than other tiles, with cracks that deepen as it nears expiry |
| Wild | Any letter | Holographic card with a shifting sheen |
| X-Factor | Rerolls the four diagonal tiles | Tile with four corner studs and an X channel cut into the face |
| Multiplier | Multiplies the word score | Faceted gem, in three cuts for 2×, 3×, and 4× |
| Shuffle | Moves every unfrozen letter | Pinwheel or turbine face |
| Freeze | Locks its neighbors | Block of ice with a snowflake set inside |
| Decay | Spreads and degrades letters | Mossy, pitted tile with creeping tendrils |
| Mirror | Copies the previous letter | Polished mirror with a beveled frame |
| Magnet | Pulls vowels nearby | Horseshoe magnet with field lines |
| Bomb | Blasts tiles within two steps | Round bomb. The fuse already burns down in code and should stay code-drawn |
| Chain | Bonus for long words | Tile wrapped in heavy chain links |
| Ghost | No letter, jumps anywhere | Translucent wisp that floats above the tray |
| Tax | Cuts the word score by 30% | Stack of coins with a bite taken out |

## C. Motion and effects

The particle system exists in the code but nothing uses it, and tile effects are a color flash. These are small assets with a large effect on how rewarding a turn feels.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| C1 | Confetti and spark sprites | 4 | Plain colored dots | SVG or PNG, 32 × 32 each | Letter-tile confetti, a chain link, a star, and a spark. Used for medal tier-ups, trophies, and personal bests |
| C2 | Bomb blast | 1 | An orange flash | Sprite sheet or Lottie, 512 × 512, under 1 second | Rings outward two tiles from the bomb |
| C3 | Shuffle swirl | 1 | An orange flash | Sprite sheet or Lottie, board-sized | Brief vortex over the board before tiles flip |
| C4 | Reaction stamps | 5 | A text label in a rounded box | SVG, about 480 × 240 | Nice, Great, Huge, Legendary, and New best. Lettered and inked like a rubber stamp |
| C5 | Board state banners | 2 | The same text stamp | SVG, about 600 × 160 | "Level N" and "Wave N", with room for a number set in code |
| C6 | Time-pressure vignette | 1 | A pulsing red inner shadow | PNG with transparency, 1024 × 1024, 9-slice | Shown over the board in the last ten seconds of Time Attack |

## D. Rewards

Medals and trophies are the reason to keep playing, and all of them are emoji on a gradient circle. This is the section where custom art most changes how the game feels to finish.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| D1 | Medals | 4 | 🥉 🥈 🥇 💎 | SVG, with a 512 × 512 hero render | Bronze, Silver, Gold, Platinum. Used at 20 px on the score track, 80 px on the results screen, and large on the share image, so supply a detailed and a simplified version of each |
| D2 | Unearned medal state | 1 | A grayed-out emoji | SVG | One blank coin shown before a medal is reached |
| D3 | Trophy emblems | 23 | 🏆 ⭐ 💎 👑 chosen by rarity | SVG, 256 × 256 | One emblem per trophy, listed below. Today every trophy of the same rarity looks identical |
| D4 | Rarity frames | 4 | A gradient circle | SVG, 256 × 256 | Common, Rare, Epic, Legendary. The emblem sits inside |
| D5 | Trophy case shelf and locked silhouette | 2 | A grid of bordered cards with a padlock | SVG or 9-slice PNG | A shelf to stand trophies on, and a silhouette treatment for locked ones |
| D6 | Streak flame and personal-best ribbon | 6 | The 🔥 and 🏅 emoji and a Lucide flame | SVG, 48 × 48 | Flame in four growth stages for 1, 7, 14, and 30 days, plus a broken-streak state and a "new best" ribbon |

Trophies needing emblems (D3):

| Rarity | Trophies |
|---|---|
| Common (3) | Dedicated, Tight Link, Word Artisan |
| Rare (10) | Bound Together, Cartographer, Chaos Conductor, Combo Maker, Committed, Consonant Crunch, Length Master, Longshot, Vowel Storm, Wild Wizard |
| Epic (8) | Clutch Finish, Collector, Completionist 80%, Devoted, Epic, Epic Wordsmith, Perfect Interlock, Treasure Hunter |
| Legendary (2) | Legendary Streaker, One With the Board |

The authoritative list, with each trophy's unlock rule, is `src/lib/achievements.ts`.

## E. Brand and platform

The app installs to a home screen and gets shared as a link and an image. These are the assets people see before they play.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| E1 | Logo master files | 3 | A wordmark that only exists as code | SVG: horizontal wordmark, stacked wordmark, single-tile mark | Needed anywhere outside the app: store listings, press, social profiles |
| E2 | App icon set | 6 | Four current icons | PNG at 192, 512, and 1024, plus maskable 512, monochrome 512, and an SVG master | The monochrome version is for Android themed icons. Check the mark at 32 px |
| E3 | Favicon set | 2 | A 48 px `favicon.ico` | SVG favicon and a 32 px ICO fallback | |
| E4 | iOS splash screens | 10 | None. An installed copy opens to a blank screen on iOS | PNG, one per current iPhone and iPad size, light and dark | Logo centered on the brand background |
| E5 | Install screenshots | 5 | None | PNG, four narrow at 1080 × 1920 and one wide at 1920 × 1080 | Listed in the web manifest so the install prompt shows a preview |
| E6 | Social share image | 2 | One 290 KB image | PNG or JPG, 1200 × 630, under 200 KB | One general, one for the Daily Challenge |
| E7 | Share card template | 2 | A flat purple gradient with plain white squares, drawn on a canvas | Background plate at 1080 × 1350 and 1080 × 1920 | The result image players post. It should use the same tile and medal art as the game. Code is in `src/lib/shareCard.ts` |
| E8 | Store listing kit | 1 | None | Feature graphic 1024 × 500, plus a layered source | Only needed if the game is wrapped for an app store |

## F. Modes and menus

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| F1 | Mode illustrations | 10 | Lucide icons in a colored square | SVG or PNG, 320 × 200 | Classic, Time Attack, Endless, Puzzle, Survival, Zen, Chaos, Mini-Marathon, Weekly Gauntlet, Prestige Endless. Each should show the mode's rule at a glance. Weekly Gauntlet is hidden from players today, so it can wait |
| F2 | Daily cards | 2 | Calendar and grid line icons | SVG or PNG, 320 × 200 | Daily and Daily 5×5. These are the first thing on the title screen |
| F3 | Menu icon set | 6 | Lucide icons | SVG, 24 × 24 | Trophies, Tutorial, Settings, Stats, Leaderboards, Sign in. Only worth doing as a full matching set |
| F4 | Title background layer | 1 | Letter tiles drifting in code | SVG tile set or a looping Lottie | Optional. The drifting tiles work; custom tile art would make them match the board |

## G. Survival mode

Survival has the most game content and the least art: lives, shields, power-ups, and bosses are all emoji in text.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| G1 | Vitals icons | 5 | ❤️ 🛡️ 💚 💔 and gray hearts | SVG, 32 × 32 | Full life, empty life, shield, life fragment, life lost |
| G2 | Power-up icons | 11 | Emoji | SVG, 64 × 64 | Letter Reveal, Stone Crusher, Life Link, Combo Boost, Board Refresh, Safety Net, Time Freeze, Wildcard Tile, Double Points, Shield, Extra Life |
| G3 | Boss emblems | 8 | 👑 ⚔️ 💎 ⚡ 🗿 🚫 ✨ 🔥 | SVG, 128 × 128 | One per boss rule: word length, multiple words, point threshold, time trial, stone gauntlet, letter lockout, perfect wave, mega word |
| G4 | Boss wave board frame | 1 | An orange ring around the board | 9-slice PNG | A distinct, heavier frame while a boss is active |
| G5 | Shop and event art | 2 | Plain dialogs | SVG or PNG, 480 × 240 | A header for the between-wave shop and one for choice events |
| G6 | Combo meter | 1 | Text | SVG, segmented bar | Fills as the combo builds, with a flare state at milestones |
| G7 | Unlock icons | 5 | Emoji | SVG, 64 × 64 | The rewards kept between runs: First Aid Kit, Lucky Charm, Stone Mason, Combo Master, Score Multiplier |

## H. Illustrations

One consistent illustration style across these would give the quieter screens some personality. None of them block play, so they come last.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| H1 | Title hero | 1 | Nothing | SVG or PNG, 800 × 400 | Tiles joined by a chain, showing the core rule before any text |
| H2 | Tutorial gesture | 2 | Text instructions | Lottie or sprite, 240 × 240 | A finger dragging across tiles, and a finger tapping tiles |
| H3 | Consumable items | 4 | 💡 ⚡ 🔨 🎯 | SVG, 96 × 96 | Hint Revealer, Score Multiplier, Hammer, Extra Moves |
| H4 | Empty states | 3 | A line of gray text | SVG, 240 × 200 | No games played, no daily challenges played, no leaderboard scores yet |
| H5 | Sign-in illustration | 1 | A bare form | SVG or PNG, 480 × 320 | Warm and low-pressure. Sign-in is optional, so it should invite, not gate |
| H6 | Not found page | 1 | Text | SVG, 400 × 300 | A chain that ends at a missing tile |
| H7 | Offline and update notices | 1 | Nothing | SVG, 240 × 200 | The app works offline and updates itself. One friendly image covers both |
| H8 | Mascot | Optional | Nothing | Character sheet | A recurring character would unify H1 to H7. Decide this before commissioning the rest, because it changes every brief in this section |

## I. Audio

Every sound is a synthesized tone generated in the browser. It works and costs nothing to download, but it sounds like a prototype. Sound is off by default, so recorded audio is a retention improvement for the players who turn it on.

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| I1 | Core sound set | 18 | Synthesized tones | OGG and M4A, mono, under 30 KB each | One per sound event the game already fires, listed below |
| I2 | Tile select scale | 8 | One tone raised in pitch per letter | Eight short notes in one key | Rises with each letter added to a word, so longer words sound like a run |
| I3 | Ambient loops | 1 | Nothing | One seamless loop, 60 to 90 seconds, under 400 KB | Optional, and off by default. Zen mode is the natural home |
| I4 | Skin sound variants | 1 | Nothing | A second tile-select set | Optional. A wooden clack for Forest or a glass tap for Ocean would make skins feel physical |

Sound events for I1: tile select, word complete, word invalid, medal tier up, trophy unlocked, game start, game over, level up, hint used, timer tick, button click, button hover, success, error, notification, skill unlock, theme change, achievement.

## J. Typography

| ID | Asset | Qty | Replaces | Format and size | Notes |
|---|---|---|---|---|---|
| J1 | Display typeface for tile letters, the logo, and scores | 1 | The device's system font | WOFF2, variable if possible, under 60 KB after subsetting | The letters are the game. One licensed face makes the board look the same on every device. Needs clear capitals at 24 px and distinct I, L, and O |
| J2 | Tabular numerals | 1 | System font digits | Part of J1, or a companion face | Scores count up on screen, so digits must be equal width |

---

## Delivery specs

| Property | Rule |
|---|---|
| Vector first | Deliver SVG wherever the art allows. It scales to any tile size and can be recolored in code |
| Raster | PNG or WebP with transparency at twice the display size. No baked-in backgrounds or white halos |
| Light and dark | Every asset must read on both themes. Supply two versions where one cannot do both |
| Color | Build from the brand purple and each skin's own palette. Keep text and letter areas at a contrast of at least 4.5 to 1 |
| Meaning without color | Special tiles and medals must stay distinguishable in grayscale. Shape carries the meaning; color supports it |
| Motion | Under one second for anything that plays during a turn. Supply a still frame for players who have reduced motion turned on |
| File size | Icons under 10 KB, tile materials under 20 KB, illustrations under 150 KB, the whole first-load set under 500 KB |
| Naming | Lowercase with hyphens, prefixed by section: `tile-face-forest-light`, `special-bomb`, `medal-gold`, `trophy-wild-wizard` |
| Source files | Keep layered sources outside the repo, or in a folder that is excluded from the build |
| Licensing | Fonts and any stock elements need a license that covers web embedding and app distribution |

## Suggested order

1. **Typeface and logo masters (J1, J2, E1).** Everything else is drawn to match them.
2. **Tile materials, edges, and trays for the Original skin (A1 to A3).** One skin first, to set the standard, then the other nine.
3. **Medals and special tile objects (D1, D2, B1 to B3).** The two things players look at most after the letters.
4. **App icons, splash screens, and share images (E2 to E7).** These reach people who have not played yet.
5. **Trophies and effects (D3 to D6, C1 to C6).** The reward loop.
6. **Core sound set (I1, I2).**
7. **Modes, Survival, and illustrations (F, G, H).**

## Where assets plug in

| Asset group | Code that draws it today |
|---|---|
| Tile materials, edges, trays | `src/lib/tileSkins.ts` and the "Skin themes & textures" section of `src/index.css` |
| Special tile art and glyphs | `src/components/game/GameTile.tsx`, `SpecialTileIcon.tsx`, and `src/lib/specialTileInfo.ts` |
| Word path | `PathOverlay` in `src/components/game/GameBoard.tsx` |
| Medals | `src/components/game/GameHud.tsx` and `ResultsDialog.tsx` |
| Trophies | `src/pages/TrophiesPage.tsx` and `src/lib/achievements.ts` |
| Share image | `src/lib/shareCard.ts` |
| Survival icons | `src/lib/survivalMode.ts` and `src/components/game/SurvivalModeUI.tsx` |
| Mode art | `src/components/game/AdvancedGameModes.tsx` and `src/components/daily/DailyHub.tsx` |
| Sounds | `src/components/effects/SoundSystem.tsx` |
| Icons, splash screens, manifest | `public/icons/`, `public/manifest.json`, and `index.html` |
