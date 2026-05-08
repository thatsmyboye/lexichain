/**
 * Utility for previewing special tiles that will appear after the next move
 * in Daily Challenge mode.
 */

export type SpecialTileType = "stone" | "wild" | "xfactor" | "multiplier" | "shuffle"
  | "freeze" | "decay" | "mirror" | "magnet" | "bomb" | "chain" | "ghost" | "tax";

export interface SpecialTile {
  type: SpecialTileType | null;
  value?: number; // For multipliers (2x, 3x, 4x)
  expiryTurns?: number; // Number of turns until expiry
  frozen?: boolean; // Whether this tile is frozen (protected by adjacent Freeze tile)
}

const SPECIAL_TILE_RARITIES = {
  stone: 0.15,
  multiplier: 0.12,
  xfactor: 0.08,
  tax: 0.08,
  decay: 0.07,
  freeze: 0.06,
  wild: 0.05,
  magnet: 0.05,
  chain: 0.05,
  mirror: 0.04,
  bomb: 0.04,
  shuffle: 0.03,
  ghost: 0.03,
};

/**
 * Seeded random number generator
 * Creates a deterministic RNG from a string seed
 */
function seedRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return function () {
    hash = Math.imul(hash, 0x9e3779b9);
    hash = hash ^ hash >>> 16;
    return (hash >>> 0) / 0x100000000;
  };
}

/**
 * Generates a special tile using seeded randomness
 */
function generateSeededSpecialTile(rng: () => number): SpecialTile {
  const rand = rng();
  let cumulative = 0;

  for (const [type, rarity] of Object.entries(SPECIAL_TILE_RARITIES)) {
    cumulative += rarity;
    if (rand <= cumulative) {
      // Use seeded random for expiry turns (2-4 turns)
      const expiryTurns = Math.floor(rng() * 3) + 2;

      if (type === "multiplier") {
        const multiplierValues = [2, 3, 4];
        const value = multiplierValues[Math.floor(rng() * multiplierValues.length)];
        return {
          type: type as SpecialTileType,
          value,
          expiryTurns,
        };
      }
      return {
        type: type as SpecialTileType,
        expiryTurns,
      };
    }
  }
  return {
    type: null,
  };
}

/**
 * Preview what special tiles will appear after the next word is found
 *
 * @param currentWordCount - Number of words found so far
 * @param dailySeed - The daily challenge seed (date string)
 * @param gridSize - Size of the grid
 * @param currentSpecialTiles - Current state of special tiles on the board
 * @returns Array of special tiles that will appear (without position info)
 */
export function previewNextSpecialTiles(
  currentWordCount: number,
  dailySeed: string,
  gridSize: number,
  currentSpecialTiles: SpecialTile[][]
): SpecialTile[] {
  // Simulate finding the next word
  const nextWordCount = currentWordCount + 1;

  // Count empty positions (same logic as introduceSeededSpecialTiles)
  const emptyPositions: number[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (currentSpecialTiles[r][c].type === null) {
        emptyPositions.push(r * gridSize + c);
      }
    }
  }

  if (emptyPositions.length === 0) {
    return [];
  }

  // Create seeded RNG for the next word count
  const tileCountRng = seedRandom(dailySeed + "_tiles_" + nextWordCount);

  // Deterministic number of tiles to place (1-3)
  const numTilesToPlace = Math.floor(tileCountRng() * 3) + 1;
  const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);

  const previewTiles: SpecialTile[] = [];

  // Generate each tile (without revealing position)
  for (let i = 0; i < tilesToPlace; i++) {
    const tileRng = seedRandom(dailySeed + "_tile_" + nextWordCount + "_" + i);
    const specialTile = generateSeededSpecialTile(tileRng);

    if (specialTile.type !== null) {
      previewTiles.push(specialTile);
    }
  }

  return previewTiles;
}
