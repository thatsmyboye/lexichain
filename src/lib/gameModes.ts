export type AdvancedGameMode = 'classic' | 'time_attack' | 'endless' | 'puzzle' | 'survival' | 'zen' | 'chaos' | 'mini_marathon' | 'weekly_gauntlet' | 'prestige_endless';

export type DailyGameMode = 'daily' | 'daily_5x5';

export const ADVANCED_MODE_NAMES: Record<AdvancedGameMode, string> = {
  classic: 'Classic',
  time_attack: 'Time Attack',
  endless: '(Almost) Endless',
  puzzle: 'Puzzle',
  survival: 'Survival',
  zen: 'Zen',
  chaos: 'Chaos',
  mini_marathon: 'Mini-Marathon',
  weekly_gauntlet: 'Weekly Gauntlet',
  prestige_endless: 'Prestige Endless'
};

export const DAILY_MODE_NAMES: Record<DailyGameMode, string> = {
  daily: 'Daily',
  daily_5x5: 'Daily 5×5'
};

// One-line blurbs for mode tiles. Longer rules live behind each tile's disclosure.
export const MODE_BLURBS: Record<AdvancedGameMode | DailyGameMode, string> = {
  daily: 'One 4×4 board for everyone. 10 moves.',
  daily_5x5: 'A bigger 5×5 board. Same 10 moves.',
  classic: 'The original. No clock, no pressure.',
  time_attack: 'Chain as many words as you can in 60s.',
  endless: 'Keep going until the board runs dry.',
  puzzle: 'Hand-built boards with set goals.',
  survival: 'Waves, bosses and power-ups. Stay alive.',
  zen: 'Relaxed play with hints and undo.',
  chaos: 'The board reshuffles after every word.',
  mini_marathon: 'Three quick 5-move boards in a row.',
  weekly_gauntlet: 'Seven themed puzzles, one per day.',
  prestige_endless: 'Endless with buffs that stick around.'
};

// Modes whose results are tracked in lib/personalBests under the same key.
const PERSONAL_BEST_MODES = new Set<string>(['classic', 'daily', 'daily_5x5', 'practice', 'time_attack', 'endless', 'puzzle', 'survival', 'zen', 'chaos']);

export function getPersonalBestKey(mode: AdvancedGameMode | DailyGameMode): string | null {
  return PERSONAL_BEST_MODES.has(mode) ? mode : null;
}

export function getModeName(mode: AdvancedGameMode | null): string | null {
  if (!mode) return null;
  return ADVANCED_MODE_NAMES[mode] || null;
}
