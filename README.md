# Lexichain

A strategic word-chain game where each word must share at least one tile with the previous word. Play at **[lexichain.banton-digital.com](https://lexichain.banton-digital.com)**.

## How to Play

1. Select adjacent tiles on the grid to spell a word (minimum 3 letters).
2. Every word after the first must **reuse at least one tile** from the previous word — that's the chain.
3. Special tiles appear as the game progresses and add risk, reward, or chaos.
4. Score as many points as possible before time or moves run out.

Tile selection: tap/click a starting tile, then drag or tap adjacent tiles. Release to submit.

## Special Tiles

All 13 special tile types can appear during play. Each is visually distinct by border shape, corner style, and animation — not just color.

| Tile | Shape cue | Effect |
|------|-----------|--------|
| **Stone** 🪨 | Heavy double border, square corners | Blocks the path — cannot be included in any word. Cleared by surrounding plays. |
| **Wild** ? | Dashed border | Acts as any letter you choose. Pick the letter when submitting the word. |
| **Multiplier** | Pulsing border | Multiplies the word's total score by 2×, 3×, or 4×. |
| **X-Factor** | Thick border + corner dots | When used, randomises all four diagonally adjacent tiles (clearing their special types too). |
| **Shuffle** | Shuffle icon | Redistributes all non-frozen board letters randomly when used. |
| **Freeze** ❄️ | Dotted border + inner rim | Freezes orthogonally adjacent tiles on spawn; frozen tiles cannot be shuffled or replaced. |
| **Decay** 🦠 | Yellow-green gradient | Spreads to adjacent tiles each turn, swapping them for low-value letters. |
| **Mirror** 🪞 | Light grey, square corners | Repeats the letter immediately before it in your word path. |
| **Magnet** 🧲 | Red-grey gradient | On spawn, pulls vowels into all orthogonally adjacent positions. |
| **Bomb** 💣 | Circular tile | Blasts all tiles within a Manhattan distance of 2 when used, removing their special types. |
| **Chain** ⛓️ | Amber gradient | Adds +10 bonus per path tile beyond 4, per Chain tile in the word. |
| **Ghost** 👻 | Dashed border + fade | Contributes no letter — useful for routing a path without adding to the word. |
| **Tax** 💰 | Gold gradient | Applies a 0.7× penalty multiplier per Tax tile in the word. Avoid if you can. |

Special tiles have an **expiry counter** (top-left) — they disappear after that many turns if not used.

## Game Modes

| Mode | Description |
|------|-------------|
| **Classic** | Unlimited words; Stone tiles accumulate progressively. |
| **Daily Challenge** | Fixed board, same for all players each day. Share your score. |
| **Daily 5×5** | Like Daily but on a larger grid. |
| **Target** | Reach a score target (Bronze / Silver / Gold / Platinum) with unlimited moves. |
| **Time Attack** | Score as high as possible before time runs out; speed multiplier grows with each word. |
| **Endless** | Stone tiles get denser and stay longer as difficulty escalates. |
| **Zen** | Relaxed play with undo support. Scoring is halved. |
| **Blitz** | Race mode with an escalating multiplier. |
| **Survival** | Wave-based mode with boss challenges, combo rewards, and power-ups. |
| **Puzzle** | Curated boards with specific constraints to solve. |
| **Chaos** | High volatility — anything goes. |

## Accessibility

- All tile types are distinguishable by **shape and border style** in grayscale (no color required).
- Animations respect **`prefers-reduced-motion`**; all tile animations are disabled under that setting.
- Four **colour-blind modes** available (Protanopia, Deuteranopia, Tritanopia, Achromatopsia).
- **High-contrast mode** toggle in settings.
- Full **keyboard navigation** and screen-reader ARIA announcements.

## Development

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

**Stack:** React + TypeScript · Vite · Tailwind CSS · shadcn/ui · Supabase

## Score System

- **Base score**: 10 points per letter.
- **Rarity bonus**: uncommon letters (+5 each), rare letters (+15 and a flat bonus).
- **Length bonuses**: +25 (5 letters), +75 (6), +175 (7), +325 (8+).
- **Link bonus**: +10 per shared tile with the previous word, up to a 2× multiplier at 3+ shared tiles.
- **Tile multipliers** (Multiplier tiles, consumables, mode multipliers) apply on top.
- **Chain tiles** add +10 per extra path tile (beyond 4) per Chain tile in the word.
- **Tax tiles** apply a 0.7× penalty per tile.

## Progression & Consumables

Lexichain has no XP, player levels, or paid store. The structure is intentionally flat:

- **All modes are open.** Every game mode is available to everyone from the start — there is nothing to unlock or level up for. Mode selection lives in `src/components/game/AdvancedGameModes.tsx`.
- **No store or purchases.** There are no in-game purchases, Stripe checkout, or payment routes.
- **Consumables** (Hint Revealer, Hammer, Score Multiplier, Extra Moves) are earned, not bought:
  - **Daily login streaks** grant consumables at milestone days (3, 7, 14, 30, 50, 100) — see `src/hooks/useLoginStreak.ts`. This is the only wired source.
  - Inventory and granting logic live in `src/hooks/useConsumables.ts` (`awardConsumables`).
  - Note: `ACHIEVEMENT_CONSUMABLE_REWARDS` exists in `src/lib/consumables.ts` as a reward table, but achievement-based granting is **not currently wired up** — no code calls `awardConsumables` with it.
