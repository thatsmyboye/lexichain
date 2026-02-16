# New Special Tiles — Design Document

## Existing Tiles (for reference)

| Tile | Effect |
|------|--------|
| Stone | Blocks path — cannot be included in words |
| Wild (?) | Represents any letter the player chooses |
| Multiplier (2x/3x/4x) | Multiplies word score |
| XFactor | Transforms diagonal neighbors into random letters |
| Shuffle | Reshuffles all letters on the entire board |

---

## Proposed New Tiles

### 1. Freeze Tile ❄️

- **Rarity**: 6%
- **Effect**: **Locks adjacent tiles in place.** The 4 orthogonal neighbors of a Freeze tile cannot be replaced, shuffled, or transformed by other tile effects (XFactor, Shuffle, board regeneration). They remain exactly as they are until the Freeze tile expires.
- **Expiry**: 3–5 turns
- **Strategic value**: Positive — lets players protect key letters they need for future words. Creates interesting tension with Shuffle and XFactor tiles. Also prevents those neighbors from being swapped out during normal board replenishment.
- **Visual**: Light blue/cyan gradient with a snowflake icon.

---

### 2. Decay Tile 🦠

- **Rarity**: 7%
- **Effect**: **Spreads each turn.** When a Decay tile's expiry counter ticks down, it has a 40% chance to spread to one random orthogonal neighbor (converting that neighbor's letter to a random low-value letter: A, E, I, O, U, S, T, N, R). The spread copy also becomes a Decay tile with 2 turns remaining. Decay tiles themselves can still be used in words — they just degrade the board over time.
- **Expiry**: 3 turns (spread copies get 2 turns)
- **Strategic value**: Negative — creates urgency. Players should use the affected area quickly before vowel-soup takes over. Encourages proactive play.
- **Visual**: Sickly green/yellow gradient with a splatter texture. Pulses on each spread event.

---

### 3. Mirror Tile 🪞

- **Rarity**: 4%
- **Effect**: **Duplicates the letter of whichever tile connects to it in the word path.** When used in a word, the Mirror tile copies the letter of the tile immediately before it in the path. Unlike Wild, the player has no choice — it always echoes the predecessor. This makes it excellent for words with double letters (e.g., connecting T → Mirror = T → E → R spells "TTER...").
- **Expiry**: 2–3 turns
- **Strategic value**: Positive — enables double-letter words that would otherwise be impossible on the board. Distinct from Wild because the player cannot choose the letter freely.
- **Visual**: Silver/chrome gradient with a subtle reflection animation. Displays the mirrored letter once placed in a path.

---

### 4. Magnet Tile 🧲

- **Rarity**: 5%
- **Effect**: **Pulls vowels toward it.** When a Magnet tile spawns, the letters on its 4 orthogonal neighbors are each replaced with a random vowel (A, E, I, O, U) if they aren't vowels already. Non-special tiles only — it won't overwrite other special tiles. This is a one-time effect on spawn.
- **Expiry**: 3–4 turns (but the effect is instant; the tile itself remains as a normal passable tile with no ongoing effect beyond marking the area)
- **Strategic value**: Mixed — creates vowel clusters which can be helpful for forming words, but too many vowels in one area can also make consonant-heavy words harder. Distinct from XFactor because it's targeted (vowels only) and affects orthogonal rather than diagonal neighbors.
- **Visual**: Red/silver horseshoe-magnet gradient. Neighbors briefly animate inward on spawn.

---

### 5. Bomb Tile 💣

- **Rarity**: 4%
- **Effect**: **Destroys tiles in a radius when used.** When a Bomb tile is included in a submitted word, after scoring, all tiles within Manhattan distance 2 (a diamond shape, ~12 tiles) have their letters replaced with completely new random letters. Special tiles in the blast radius are also cleared. The Bomb tile itself is consumed.
- **Expiry**: 2 turns (use it or lose it)
- **Strategic value**: Mixed — powerful board reset for a targeted area. Can break out of dead-end board states, but also destroys any favorable setup nearby. Unlike Shuffle (which rearranges existing letters globally), Bomb generates *new* letters in a *local* area.
- **Visual**: Dark red/black gradient with a fuse icon. Fuse animates shorter each turn as expiry approaches.

---

### 6. Chain Tile ⛓️

- **Rarity**: 5%
- **Effect**: **Bonus points for long paths.** When a Chain tile is included in a word, the player earns +10 bonus points for every tile in the path *beyond* 4. Has no effect on words of length 4 or shorter. Stacks if multiple Chain tiles are in the same word.
- **Expiry**: 3–4 turns
- **Strategic value**: Positive — rewards building long words. Distinct from Multiplier because it adds a flat per-tile bonus rather than multiplying the total score, making it specifically valuable for long words while Multiplier is universally good.
- **Visual**: Bronze/copper gradient with a chain-link icon. Glows brighter as the current path grows longer.

---

### 7. Ghost Tile 👻

- **Rarity**: 3%
- **Effect**: **Pass-through tile.** A Ghost tile can be included in a word path to connect non-adjacent tiles. It contributes no letter to the word — it acts as a "bridge." For example, if tiles F-[Ghost]-N-D are selected, the word is "FND..." with the Ghost skipped for spelling purposes. The path must still be contiguous on the grid. Maximum one Ghost per word.
- **Expiry**: 2 turns
- **Strategic value**: Positive — opens up paths across the board by bridging gaps. Distinct from Wild (which contributes a letter) because Ghost contributes nothing — it's purely a path connector.
- **Visual**: Translucent white/pale gradient with low opacity. The letter underneath is faintly visible.

---

### 8. Tax Tile 💰

- **Rarity**: 8%
- **Effect**: **Reduces word score by 30%.** If a Tax tile is in the submitted word path, the final score is reduced by 30% (applied after all multipliers). Multiple Tax tiles stack multiplicatively (two Tax tiles = 0.7 × 0.7 = 49% of original score).
- **Expiry**: 3–5 turns
- **Strategic value**: Negative — forces players to weigh whether a word through a Tax tile is still worth it. Creates risk/reward decisions, especially when a Tax tile sits between a Multiplier tile and the rest of a high-value path.
- **Visual**: Gold/yellow gradient with a coin-slash icon. Displays "-30%" at the bottom.

---

## Summary Table

| Tile | Type | Rarity | Core Mechanic | Positive/Negative |
|------|------|--------|---------------|-------------------|
| Freeze ❄️ | Passive/area | 6% | Protects neighbors from changes | Positive |
| Decay 🦠 | Passive/spreading | 7% | Degrades nearby letters over time | Negative |
| Mirror 🪞 | Path/letter | 4% | Copies previous tile's letter | Positive |
| Magnet 🧲 | Spawn/area | 5% | Replaces neighbors with vowels | Mixed |
| Bomb 💣 | Path/area | 4% | Replaces all tiles in radius with new letters | Mixed |
| Chain ⛓️ | Path/scoring | 5% | Flat bonus per tile beyond length 4 | Positive |
| Ghost 👻 | Path/bridge | 3% | Bridges non-adjacent tiles (no letter) | Positive |
| Tax 💰 | Path/scoring | 8% | Reduces final score by 30% | Negative |

## Updated Rarity Budget

| Tile | Rarity |
|------|--------|
| Stone | 15% |
| Multiplier | 12% |
| XFactor | 8% |
| **Tax** | **8%** |
| **Decay** | **7%** |
| **Freeze** | **6%** |
| Wild | 5% |
| **Magnet** | **5%** |
| **Chain** | **5%** |
| **Mirror** | **4%** |
| **Bomb** | **4%** |
| Shuffle | 3% |
| **Ghost** | **3%** |
| *(No special tile)* | *remaining %* |

## Implementation Notes

- All new tiles should follow the existing `SpecialTile` interface (`type`, `value?`, `expiryTurns?`).
- `SpecialTileType` union should be extended: `"freeze" | "decay" | "mirror" | "magnet" | "bomb" | "chain" | "ghost" | "tax"`.
- Tiles with spawn-time effects (Magnet, Freeze) should trigger in the tile generation phase.
- Tiles with per-turn effects (Decay spread) should trigger in the expiry/tick phase.
- Tiles with path effects (Mirror, Ghost, Bomb, Chain, Tax) should integrate into `submitWord`.
- Ghost tile requires a modification to word validation — the ghost position's letter must be excluded from the assembled string before dictionary lookup.
- Mirror tile requires knowing the path order to determine the predecessor tile.
