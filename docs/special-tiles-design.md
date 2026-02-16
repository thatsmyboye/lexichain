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

## Scoring Impact Analysis & Benchmark Adjustments

### Current Scoring Reference

**Formula**: `total = round((base + rarityBonus + lengthBonus) * linkMultiplier * tileMultiplier * consumableMultiplier * modeMultiplier)`

Where `base = L² × 4 + L × 12` (hybrid mode).

| Word Length | Base Score | + Length Bonus | Subtotal |
|-------------|-----------|----------------|----------|
| 3 | 72 | 0 | 72 |
| 4 | 112 | 0 | 112 |
| 5 | 160 | 25 | 185 |
| 6 | 216 | 75 | 291 |
| 7 | 280 | 175 | 455 |
| 8 | 352 | 325 | 677 |

**Current benchmarks** (fixed across all modes):
- Bronze: 1,500 | Silver: 2,500 | Gold: 4,000 | Platinum: 6,000

**Daily challenge**: 10 moves. Typical average word score ~150–300 per word, totaling 1,500–3,000 without multiplier luck.

---

### Tile-by-Tile Scoring Impact

#### 1. Chain Tile — Direct Score Inflation

**Mechanism**: +10 per tile beyond length 4, per Chain tile in the path.

| Word Length | Chain Bonus (1 tile) | Chain Bonus (2 tiles) | % of Base Subtotal |
|-------------|---------------------|-----------------------|--------------------|
| 5 | +10 | +20 | 5–11% of 185 |
| 6 | +20 | +40 | 7–14% of 291 |
| 7 | +30 | +60 | 7–13% of 455 |
| 8 | +40 | +80 | 6–12% of 677 |

**Verdict**: Modest additive boost. At 5% rarity with 3–4 turn expiry, a player might hit 1–2 Chain tiles per 10-word game. Expected per-game inflation: **+30 to +80 points** (~2–3% of a Gold-tier game). The bonus is flat and additive (applied before multipliers in the subtotal), so it compounds with Multiplier tiles.

**Interaction risk**: A Chain tile on an 8-letter word with a 3x Multiplier tile in the same path: `(677 + 40) × 3 = 2,151` vs. `677 × 3 = 2,031`. Delta of +120, meaningful but not game-breaking since both tiles must be in the same path.

**Recommendation**: No benchmark adjustment needed. Impact is minor and self-limiting (flat bonus, not multiplicative).

---

#### 2. Tax Tile — Direct Score Deflation

**Mechanism**: Final score × 0.7 per Tax tile in the path.

| Scenario | Without Tax | With 1 Tax | With 2 Tax | Score Lost |
|----------|-------------|------------|------------|------------|
| 5-letter word, no multiplier | 185 | 130 | 91 | –55 to –94 |
| 6-letter + 2x multiplier | 582 | 407 | 285 | –175 to –297 |
| 7-letter + 3x multiplier | 1,365 | 956 | 669 | –409 to –696 |

**Verdict**: Significant per-word impact. At 8% rarity (the highest of any new tile), Tax tiles will appear frequently. Players can often route around them, but on a 4×4 board with limited adjacency, avoidance isn't always possible. Over a 10-word game where ~2–3 words are forced through Tax tiles, expected per-game deflation: **–150 to –400 points**.

**Interaction risk**: Tax stacking with Tax (0.49x) is punishing but very rare. Tax on a Multiplier path (3x × 0.7 = 2.1x) effectively downgrades a 3x to a 2x — still net positive, so players will still take it.

**Recommendation**: **Reduce Bronze benchmark by 100 points** (1,500 → 1,400) to account for the negative pressure Tax puts on average players. Silver/Gold/Platinum players are more likely to route around Tax tiles effectively, so upper benchmarks can remain. Alternatively, keep benchmarks fixed and reduce Tax rarity from 8% → 6% (see consolidated recommendation below).

---

#### 3. Ghost Tile — Indirect Score Inflation via Path Access

**Mechanism**: No direct scoring effect, but enables longer words by bridging gaps.

Ghost doesn't add points itself, but by enabling paths that weren't possible before, it increases average word length. On a 4×4 grid, many 7+ letter words are blocked by adjacency constraints. Ghost relaxes this.

**Estimated impact**: If Ghost enables one additional 7-letter word per game that would have otherwise been a 5-letter word: `455 – 185 = +270 points`. At 3% rarity and 2-turn expiry, this will happen in roughly 1 in 4 games.

**Verdict**: Low frequency, high variance. When it hits, it's strong (+200–400 points from a single upgraded word). Average per-game inflation: **+50 to +100 points**.

**Recommendation**: No benchmark adjustment needed. Rarity (3%) and short expiry (2 turns) already constrain it.

---

#### 4. Mirror Tile — Indirect Score Inflation via Word Access

**Mechanism**: Copies predecessor letter, enabling double-letter words.

Similar to Ghost — no direct points, but enables words like BUTTER, COFFEE, RABBIT that require adjacent duplicate letters. These tend to be 6–8 letter words.

**Estimated impact**: Enables ~1 extra viable word per appearance. At 4% rarity, appears roughly every 2–3 games. When it does appear, it might upgrade a 4-letter word to a 6-letter word: `291 – 112 = +179 points`.

**Verdict**: Moderate positive pressure, similar magnitude to Ghost but slightly more frequent. Average per-game inflation: **+40 to +80 points**.

**Recommendation**: No benchmark adjustment needed.

---

#### 5. Freeze Tile — Indirect Score Stabilization

**Mechanism**: Protects neighbors from Shuffle/XFactor/regeneration.

Freeze doesn't affect scoring directly. It preserves board state, which helps players who plan multi-word strategies around specific letters. This is a skill-rewarding mechanic — better players extract more value.

**Estimated impact**: Hard to quantify. Prevents score *loss* from board disruption rather than adding score. Estimated benefit: **+0 to +50 points** per game, skewed toward skilled players.

**Verdict**: Negligible scoring impact. Primarily a quality-of-life tile.

**Recommendation**: No benchmark adjustment needed.

---

#### 6. Decay Tile — Indirect Score Deflation via Board Degradation

**Mechanism**: Spreads to neighbors (40% chance per turn), converting letters to common low-value ones (A, E, I, O, U, S, T, N, R).

Over 3 turns, one Decay tile can spread to 1–2 neighbors. These neighbors get low-value letters, reducing rarity bonus potential and potentially breaking planned word paths.

**Scoring impact of letter degradation**:
- A tile changed from K (rare) to E (common) on a 6-letter word path loses: `round(291 × 1 × 0.08) = 23 points` in rarity bonus.
- A tile changed from Z (ultra-rare) to A: loses `round(291 × 2 × 0.08) + round(291 × 1 × 0.12) = 47 + 35 = 82 points`.
- Indirect cost of broken paths: unquantifiable but real.

**Estimated impact**: At 7% rarity, Decay appears roughly once per game. With spread, it affects 2–4 tiles total. Expected per-game deflation: **–30 to –100 points** from rarity loss and path disruption.

**Verdict**: Moderate negative pressure. The board degradation effect is more about strategic disruption than raw point loss.

**Recommendation**: No benchmark adjustment needed on its own. Combined with Tax, see consolidated recommendation.

---

#### 7. Magnet Tile — Mixed Score Impact

**Mechanism**: Replaces up to 4 orthogonal neighbors with random vowels on spawn.

Vowel clusters help some words but hurt others. Common vowels (A, E, I, O, U) have 0 rarity value, so replacing rare consonants with vowels loses rarity bonus. But vowels are essential for most English words, so having them nearby is often helpful for path-building.

**Estimated impact**: Net approximately neutral. May lose ~20 points per game in rarity bonus but gain it back through better word accessibility.

**Recommendation**: No benchmark adjustment needed.

---

#### 8. Bomb Tile — Neutral (Variance Increase)

**Mechanism**: Replaces ~12 tiles with new random letters after word submission.

Bomb doesn't affect the score of the word it's used in — the blast happens *after* scoring. It resets a local area, which can be positive (escape dead boards) or negative (destroy good setups). Over many games, this averages out.

**Estimated impact**: ~0 average per-game delta. High variance per individual game.

**Recommendation**: No benchmark adjustment needed.

---

### Consolidated Scoring Impact

| Tile | Per-Game Avg Impact | Direction | Frequency |
|------|-------------------|-----------|-----------|
| Chain ⛓️ | +30 to +80 | Positive | ~1–2 tiles/game |
| Tax 💰 | –150 to –400 | **Negative** | ~2–3 tiles/game |
| Ghost 👻 | +50 to +100 | Positive | ~0.3 tiles/game |
| Mirror 🪞 | +40 to +80 | Positive | ~0.4 tiles/game |
| Freeze ❄️ | +0 to +50 | Positive | ~0.6 tiles/game |
| Decay 🦠 | –30 to –100 | Negative | ~0.7 tiles/game |
| Magnet 🧲 | ~0 | Neutral | ~0.5 tiles/game |
| Bomb 💣 | ~0 | Neutral | ~0.4 tiles/game |

**Net expected per-game shift**: Approximately **–60 to –190 points**, dominated by Tax tile pressure.

Tax is the primary balance concern because it:
1. Has the highest rarity of any new tile (8%)
2. Applies a multiplicative penalty (0.7x) *after* all bonuses
3. Stacks multiplicatively with itself (0.49x for two)
4. On a 4×4 board, is difficult to consistently avoid

---

### Benchmark Adjustment Recommendations

#### Option A: Adjust Benchmarks (Recommended)

Lower the bottom two thresholds to absorb the net negative pressure from Tax + Decay. Upper tiers stay fixed because skilled players will route around negative tiles more effectively.

| Tier | Current | Proposed | Change | Rationale |
|------|---------|----------|--------|-----------|
| Bronze | 1,500 | **1,400** | –100 | Absorbs ~1 forced Tax word for average players |
| Silver | 2,500 | **2,400** | –100 | Minor relief for intermediate players |
| Gold | 4,000 | 4,000 | 0 | Skilled players avoid Tax; Chain/Ghost offset Decay |
| Platinum | 6,000 | 6,000 | 0 | Top players benefit from Chain/Ghost/Mirror |

Also adjust the corresponding goal thresholds:
- `daily_scorer`: 1,000 → **950** (total daily points)
- `score_climber`: 1,500 → **1,400** (single game)
- `high_scorer`: 2,500 → **2,400** (single game)

Survival mode wave targets (`50 + wave × 10` standard, `100 + wave × 15` boss) remain unchanged — survival has a 1.8x mode multiplier that already buffers against per-word penalties.

#### Option B: Adjust Tile Rarity Instead

If benchmarks should remain fixed at the current values, reduce Tax rarity to equalize the negative/positive pressure:

| Tile | Current Proposed Rarity | Adjusted Rarity |
|------|------------------------|-----------------|
| Tax | 8% | **5%** |
| Decay | 7% | **5%** |
| Chain | 5% | **6%** |

This brings net per-game impact closer to 0, preserving existing benchmarks.

#### Option C: Cap Tax Penalty

Keep Tax at 8% rarity and current benchmarks, but cap the minimum Tax multiplier at 0.6x (instead of allowing 0.7^N stacking). This prevents the worst-case double-Tax scenario (0.49x) while keeping the single-Tax penalty meaningful.

---

### Recommended Approach

**Option A** is recommended because:
- It preserves the intended frequency and impact of each tile design
- Bronze/Silver thresholds haven't been dynamically tuned before (they're hardcoded at fixed values), so a small adjustment is low-risk
- It keeps the balance between positive and negative tiles intentional rather than artificially flattening it
- Gold and Platinum remain aspirational targets that reward mastery of the full tile system

If playtesting shows the impact is less severe than modeled (e.g., players route around Tax more often than expected on larger boards), the adjustment can be reverted with no system-level consequences since benchmarks are simple constants.

---

## Implementation Notes

- All new tiles should follow the existing `SpecialTile` interface (`type`, `value?`, `expiryTurns?`).
- `SpecialTileType` union should be extended: `"freeze" | "decay" | "mirror" | "magnet" | "bomb" | "chain" | "ghost" | "tax"`.
- Tiles with spawn-time effects (Magnet, Freeze) should trigger in the tile generation phase.
- Tiles with per-turn effects (Decay spread) should trigger in the expiry/tick phase.
- Tiles with path effects (Mirror, Ghost, Bomb, Chain, Tax) should integrate into `submitWord`.
- Ghost tile requires a modification to word validation — the ghost position's letter must be excluded from the assembled string before dictionary lookup.
- Mirror tile requires knowing the path order to determine the predecessor tile.
