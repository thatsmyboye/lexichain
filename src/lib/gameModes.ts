export type AdvancedGameMode = 'classic' | 'time_attack' | 'endless' | 'puzzle' | 'survival' | 'zen' | 'chaos' | 'mini_marathon' | 'weekly_gauntlet' | 'prestige_endless';

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

export function getModeName(mode: AdvancedGameMode | null): string | null {
  if (!mode) return null;
  return ADVANCED_MODE_NAMES[mode] || null;
}
