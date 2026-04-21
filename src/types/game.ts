import type { Benchmarks, BoardAnalysis } from '@/lib/benchmarks';

export type Pos = { r: number; c: number };

export type SpecialTileType =
  | 'stone' | 'wild' | 'xfactor' | 'multiplier' | 'shuffle'
  | 'freeze' | 'decay' | 'mirror' | 'magnet' | 'bomb' | 'chain' | 'ghost' | 'tax'
  | null;

export type SpecialTile = {
  type: SpecialTileType;
  value?: number;
  expiryTurns?: number;
  frozen?: boolean;
};

export type ScoreBreakdown = {
  base: number;
  rarity: { sum: number; ultraCount: number; bonus: number };
  linkBonus: number;
  linkMultiplier: number;
  lengthBonus: number;
  timeBonus: number;
  multipliers: {
    tileMultiplier: number;
    consumableMultiplier: number;
    combinedApplied: number;
    capped: boolean;
    cap: number;
  };
  totalBeforeMultipliers: number;
  total: number;
};

export type UsedWord = {
  word: string;
  score: number;
  breakdown?: ScoreBreakdown;
};

export type FinalGrade = 'None' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type { Benchmarks, BoardAnalysis };
