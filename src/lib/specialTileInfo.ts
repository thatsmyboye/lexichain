import type { SpecialTile, SpecialTileType } from "@/types/game";

export interface SpecialTileInfo {
  name: string;
  /** A few words, for the How to Play legend. */
  summary: string;
  /** What the tile does, in full, for the touch-and-hold tooltip. */
  detail: string;
}

// One source of truth for what each special tile does. Keep in step with the
// rules in wordPathEngine.ts and WordPathGame.tsx.
export const SPECIAL_TILE_INFO: Record<NonNullable<SpecialTileType>, SpecialTileInfo> = {
  stone: {
    name: "Stone",
    summary: "Cannot be used",
    detail: "Blocks the path. No word can use this tile. It crumbles when its counter runs out.",
  },
  wild: {
    name: "Wild",
    summary: "Any letter",
    detail: "Stands in for any letter. You choose the letter when you play the word, and the tile keeps it.",
  },
  xfactor: {
    name: "X-Factor",
    summary: "Changes adjacent corner tiles",
    detail: "When played, the four tiles diagonal to it get new random letters and lose any special power. Frozen tiles are spared.",
  },
  multiplier: {
    name: "Multiplier",
    summary: "Boost word score",
    detail: "Multiplies the score of the word that uses it.",
  },
  shuffle: {
    name: "Shuffle",
    summary: "Randomizes all unfrozen letters",
    detail: "When played, every letter that isn't frozen moves to a random spot on the board.",
  },
  freeze: {
    name: "Freeze",
    summary: "Locks neighbors in place",
    detail: "Freezes the tiles directly above, below, left, and right of it. Frozen tiles can't be shuffled, blasted, or changed while the Freeze tile remains.",
  },
  decay: {
    name: "Decay",
    summary: "Spreads, degrades letters",
    detail: "After each word it may spread to a neighboring tile, swapping that tile's letter for a common one such as E or S.",
  },
  mirror: {
    name: "Mirror",
    summary: "Copies previous letter",
    detail: "Repeats the letter just before it in your word, so you can spell double letters.",
  },
  magnet: {
    name: "Magnet",
    summary: "Pulls vowels nearby",
    detail: "When it lands, it pulls vowels into the tiles directly above, below, left, and right of it.",
  },
  bomb: {
    name: "Bomb",
    summary: "Blasts nearby tiles",
    detail: "When played, every tile within two steps (up, down, left, or right) gets a new letter and loses any special power. Frozen tiles are spared.",
  },
  chain: {
    name: "Chain",
    summary: "Bonus for long words",
    detail: "Adds 10 points for every tile past the fourth in the word that uses it.",
  },
  ghost: {
    name: "Ghost",
    summary: "Bridge tile, no letter",
    detail: "Adds no letter to your word, and the next tile can be anywhere on the board. One Ghost per word.",
  },
  tax: {
    name: "Tax",
    summary: "-30% word score",
    detail: "Cuts the score of the word that uses it by 30%. Avoid it if you can.",
  },
};

export const FROZEN_TILE_INFO: SpecialTileInfo = {
  name: "Frozen",
  summary: "Locked in place",
  detail: "Locked in place by a neighboring Freeze tile. Shuffle, Bomb, X-Factor, and Decay can't change it.",
};

/** True when a tile has something to explain in a tooltip. */
export function hasTileInfo(tile: SpecialTile | undefined): tile is SpecialTile {
  return !!tile && (tile.type !== null || !!tile.frozen);
}
