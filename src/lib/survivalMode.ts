/**
 * Survival Mode - Enhanced Roguelike Word Game
 *
 * This file contains all type definitions, configurations, and utilities
 * for the enhanced Survival mode gameplay systems.
 */

// ============================================================================
// WAVE CHALLENGE TYPES
// ============================================================================

export type WaveChallengeType =
  | 'word_count'        // Find X words
  | 'min_length'        // All words must be X+ letters
  | 'score_target'      // Reach X points
  | 'speed_round'       // Find X words in Y seconds
  | 'vowel_hunt'        // Find words with X+ vowels
  | 'consonant_chain'   // Find words with X+ consonants
  | 'no_repeat_letters' // Find words with no repeated letters
  | 'long_path'         // Path must use X+ tiles
  | 'corner_to_corner'  // Start and end in corners
  | 'perfect_round';    // No mistakes allowed

export interface WaveChallenge {
  type: WaveChallengeType;
  description: string;
  target?: number;
  timeLimit?: number;
  minLength?: number;
  minTiles?: number;
  requirePerfect?: boolean;
}

// ============================================================================
// BOSS WAVE TYPES
// ============================================================================

export type BossType =
  | 'word_length'      // Find 1 word of X+ letters
  | 'multi_word'       // Find X words of Y+ letters
  | 'point_threshold'  // Earn X+ points in wave
  | 'time_trial'       // Find X words in Y seconds
  | 'stone_gauntlet'   // Board starts with many stones
  | 'letter_lockout'   // Can't use certain letters
  | 'perfect_wave'     // Find X words without errors
  | 'mega_word';       // Find 1 word of 9+ letters

export interface BossWave {
  type: BossType;
  description: string;
  requirement: number;
  timeLimit?: number;
  bannedLetters?: string[];
  stoneCount?: number;
  minLength?: number;
  icon: string;
  color: string;
}

// ============================================================================
// POWER-UP SYSTEM
// ============================================================================

export type PowerUpType =
  | 'letter_reveal'    // Shows 3 valid word starting positions
  | 'stone_crusher'    // Next word removes a stone tile
  | 'life_link'        // Temporary extra life buffer
  | 'combo_boost'      // Multiplier for next X words
  | 'board_refresh'    // Shuffle board without penalty
  | 'safety_net'       // Next invalid word doesn't break combo
  | 'time_freeze'      // Pause difficulty increases
  | 'wildcard_tile'    // One tile acts as any letter
  | 'double_points'    // 2x score for next wave
  | 'shield'           // Protect from losing a life
  | 'extra_life';      // Gain an extra life

export type PowerUpRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PowerUp {
  id: string;
  type: PowerUpType;
  name: string;
  description: string;
  rarity: PowerUpRarity;
  duration: 'instant' | 'waves' | 'words';
  durationValue?: number;
  icon: string;
  color: string;
}

export interface ActivePowerUp {
  powerUp: PowerUp;
  remainingUses?: number;
  remainingWaves?: number;
  activatedAt: number;
}

// ============================================================================
// SHOP SYSTEM
// ============================================================================

export type ShopItemType =
  | 'extra_life'
  | 'stone_eraser'
  | 'shield'
  | 'wildcard_tile'
  | 'time_freeze'
  | 'double_points'
  | 'power_up_random'
  | 'power_up_rare'
  | 'hint';

export interface ShopItem {
  type: ShopItemType;
  name: string;
  description: string;
  cost: number;
  costType: 'points' | 'lives';
  icon: string;
  rarity: PowerUpRarity;
  available: boolean;
}

export interface GambleOption {
  name: string;
  description: string;
  successRate: number;
  reward: string;
  penalty: string;
  icon: string;
}

// ============================================================================
// CHOICE EVENTS SYSTEM
// ============================================================================

export type EventType =
  | 'merchant'   // Trade resources for benefits
  | 'curse'      // Choose which penalty to accept
  | 'blessing'   // Choose which bonus to receive
  | 'gambit'     // High risk, high reward
  | 'mystery';   // Unpredictable outcomes

export interface EventOption {
  text: string;
  effect: EventEffect;
  risk: 'low' | 'medium' | 'high';
}

export interface EventEffect {
  lives?: number;
  score?: number;
  removeStoneTiles?: boolean;
  addStoneTiles?: number;
  shield?: number;
  powerUp?: PowerUpType;
  blessing?: string;
  curse?: string;
  skipWaves?: number;
  gamble?: 'life_gambit' | 'score_gambit'; // BUG FIX #4: Deferred random outcomes
  mystery?: 'mystery_box'; // BUG FIX #4: Deferred random outcomes
}

export interface ChoiceEvent {
  wave: number;
  type: EventType;
  prompt: string;
  description: string;
  options: EventOption[];
  icon: string;
}

// ============================================================================
// ENVIRONMENTAL HAZARDS & BOARD MODIFIERS
// ============================================================================

export type HazardType =
  | 'frozen_tiles'   // Tiles can't be used for X waves
  | 'cracked_tiles'  // Tiles break after 1 use
  | 'locked_rows'    // Entire row is blocked
  | 'locked_cols'    // Entire column is blocked
  | 'fog_of_war'     // Only some tiles visible
  | 'shifting_board' // Letters swap periodically
  | 'gravity'        // Letters fall/rise after use
  | 'mirror_mode';   // Board flips after each word

export interface BoardModifier {
  type: HazardType;
  description: string;
  positions?: { row: number; col: number }[];
  rows?: number[];
  cols?: number[];
  revealedPositions?: { row: number; col: number }[];
  direction?: 'down' | 'up' | 'left' | 'right';
  duration: number; // in waves
  icon: string;
}

// ============================================================================
// COMBO & CHAIN SYSTEM
// ============================================================================

export interface ComboState {
  currentCombo: number;
  maxCombo: number;
  comboMultiplier: number;
  comboActive: boolean;
  lastWordTime: number;
}

export interface ComboMilestone {
  combo: number;
  reward: string;
  multiplier: number;
  icon: string;
}

// ============================================================================
// META-PROGRESSION SYSTEM
// ============================================================================

export interface SurvivalUnlock {
  id: string;
  name: string;
  description: string;
  requirement: {
    type: 'waves_reached' | 'runs_completed' | 'total_score' | 'tiles_cleared';
    value: number;
  };
  effect: StartingBenefit;
  unlocked: boolean;
  icon: string;
}

export interface StartingBenefit {
  extraLives?: number;
  startingPowerUps?: PowerUpType[];
  startingShield?: number;
  scoreBonus?: number;
  permanentMultiplier?: number;
}

export interface SurvivalStats {
  totalWavesReached: number;
  runsCompleted: number;
  totalScore: number;
  totalStoneTilesCleared: number;
  bestRun: number;
  totalBossesDefeated: number;
  perfectWaves: number;
  highestCombo: number;
}

// ============================================================================
// ADAPTIVE DIFFICULTY AI
// ============================================================================

export type SkillLevel = 'novice' | 'intermediate' | 'expert' | 'master';

export interface PlayerPerformance {
  averageWordLength: number;
  averageCombo: number;
  successRate: number;
  averageTimePerWord: number;
  mistakeCount: number;
}

export interface DifficultySettings {
  playerSkill: SkillLevel;
  adjustmentFactor: number; // -0.5 to +0.5
  obstacleFrequency: number;
  challengeDifficulty: number;
}

// ============================================================================
// MAIN SURVIVAL STATE
// ============================================================================

export interface SurvivalState {
  // Core state
  lives: number;
  maxLives: number;
  wave: number;
  wordsThisWave: number;

  // Challenge system
  currentChallenge: WaveChallenge | null;
  isBossWave: boolean;
  currentBoss: BossWave | null;

  // Power-ups and items
  activePowerUps: ActivePowerUp[];
  inventoryPowerUps: PowerUp[];
  shields: number;

  // Combo system
  comboState: ComboState;

  // Board modifiers
  activeModifiers: BoardModifier[];

  // Shop and events
  shopAvailable: boolean;
  pendingEvent: ChoiceEvent | null;

  // Performance tracking
  performance: PlayerPerformance;
  difficulty: DifficultySettings;

  // Meta-progression
  stats: SurvivalStats;
  unlockedBenefits: SurvivalUnlock[];

  // Life recovery tracking
  perfectWaveStreak: number;
  lifeFragments: number; // 3 fragments = 1 life
}

// ============================================================================
// WAVE CHALLENGE CONFIGURATIONS
// ============================================================================

export const WAVE_CHALLENGES: Record<WaveChallengeType, (wave: number) => WaveChallenge> = {
  word_count: (wave) => ({
    type: 'word_count',
    description: `Find ${Math.min(5 + Math.floor(wave / 10), 8)} words`,
    target: Math.min(5 + Math.floor(wave / 10), 8)
  }),

  min_length: (wave) => ({
    type: 'min_length',
    description: `Find 4 words of ${Math.min(5 + Math.floor(wave / 5), 7)}+ letters`,
    target: 4,
    minLength: Math.min(5 + Math.floor(wave / 5), 7)
  }),

  score_target: (wave) => ({
    type: 'score_target',
    description: `Earn ${50 + wave * 10} points this wave`,
    target: 50 + wave * 10
  }),

  speed_round: (wave) => ({
    type: 'speed_round',
    description: `Find 3 words in ${Math.max(60 - wave * 2, 30)} seconds`,
    target: 3,
    timeLimit: Math.max(60 - wave * 2, 30)
  }),

  vowel_hunt: (wave) => ({
    type: 'vowel_hunt',
    description: `Find 4 words with ${Math.min(3 + Math.floor(wave / 8), 5)}+ vowels each`,
    target: 4,
    minLength: Math.min(3 + Math.floor(wave / 8), 5)
  }),

  consonant_chain: (wave) => ({
    type: 'consonant_chain',
    description: `Find 4 words with ${Math.min(4 + Math.floor(wave / 6), 6)}+ consonants each`,
    target: 4,
    minLength: Math.min(4 + Math.floor(wave / 6), 6)
  }),

  no_repeat_letters: (wave) => ({
    type: 'no_repeat_letters',
    description: 'Find 3 words with no repeated letters',
    target: 3
  }),

  long_path: (wave) => ({
    type: 'long_path',
    description: `Find 3 words using ${Math.min(6 + Math.floor(wave / 5), 10)}+ tiles each`,
    target: 3,
    minTiles: Math.min(6 + Math.floor(wave / 5), 10)
  }),

  corner_to_corner: (wave) => ({
    type: 'corner_to_corner',
    description: 'Find 3 words starting and ending in corners',
    target: 3
  }),

  perfect_round: (wave) => ({
    type: 'perfect_round',
    description: 'Find 4 words without any mistakes',
    target: 4,
    requirePerfect: true
  })
};

// ============================================================================
// BOSS WAVE CONFIGURATIONS
// ============================================================================

export const BOSS_TYPES: Record<BossType, (wave: number) => BossWave> = {
  word_length: (wave) => ({
    type: 'word_length',
    description: `Find 1 word of ${Math.min(7 + Math.floor(wave / 10), 10)}+ letters`,
    requirement: Math.min(7 + Math.floor(wave / 10), 10),
    icon: '👑',
    color: 'text-yellow-500'
  }),

  multi_word: (wave) => ({
    type: 'multi_word',
    description: `Find ${Math.min(2 + Math.floor(wave / 15), 3)} words of 6+ letters`,
    requirement: Math.min(2 + Math.floor(wave / 15), 3),
    minLength: 6,
    icon: '⚔️',
    color: 'text-red-500'
  }),

  point_threshold: (wave) => ({
    type: 'point_threshold',
    description: `Earn ${100 + wave * 15} points in this wave`,
    requirement: 100 + wave * 15,
    icon: '💎',
    color: 'text-blue-500'
  }),

  time_trial: (wave) => ({
    type: 'time_trial',
    description: `Find 5 words in ${Math.max(60 - wave, 30)} seconds`,
    requirement: 5,
    timeLimit: Math.max(60 - wave, 30),
    icon: '⚡',
    color: 'text-purple-500'
  }),

  stone_gauntlet: (wave) => ({
    type: 'stone_gauntlet',
    description: 'Find 3 words on a heavily blocked board',
    requirement: 3,
    stoneCount: Math.min(6 + Math.floor(wave / 5), 10),
    icon: '🗿',
    color: 'text-gray-500'
  }),

  letter_lockout: (wave) => ({
    type: 'letter_lockout',
    description: 'Find 4 words without using certain letters',
    requirement: 4,
    bannedLetters: [],
    icon: '🚫',
    color: 'text-orange-500'
  }),

  perfect_wave: (wave) => ({
    type: 'perfect_wave',
    description: 'Find 3 words without any mistakes',
    requirement: 3,
    icon: '✨',
    color: 'text-pink-500'
  }),

  mega_word: (wave) => ({
    type: 'mega_word',
    description: `Find 1 word of ${Math.min(9 + Math.floor(wave / 15), 12)}+ letters`,
    requirement: Math.min(9 + Math.floor(wave / 15), 12),
    icon: '🔥',
    color: 'text-red-600'
  })
};

// ============================================================================
// POWER-UP DEFINITIONS
// ============================================================================

export const POWER_UPS: Record<PowerUpType, PowerUp> = {
  letter_reveal: {
    id: 'letter_reveal',
    type: 'letter_reveal',
    name: 'Letter Reveal',
    description: 'Shows 3 valid word starting positions',
    rarity: 'common',
    duration: 'instant',
    icon: '🔍',
    color: 'text-blue-400'
  },

  stone_crusher: {
    id: 'stone_crusher',
    type: 'stone_crusher',
    name: 'Stone Crusher',
    description: 'Next word removes a stone tile',
    rarity: 'common',
    duration: 'words',
    durationValue: 1,
    icon: '🔨',
    color: 'text-gray-400'
  },

  life_link: {
    id: 'life_link',
    type: 'life_link',
    name: 'Life Link',
    description: 'Temporary extra life buffer',
    rarity: 'rare',
    duration: 'waves',
    durationValue: 3,
    icon: '💚',
    color: 'text-green-400'
  },

  combo_boost: {
    id: 'combo_boost',
    type: 'combo_boost',
    name: 'Combo Boost',
    description: '3x multiplier for next 5 words',
    rarity: 'rare',
    duration: 'words',
    durationValue: 5,
    icon: '🔥',
    color: 'text-orange-400'
  },

  board_refresh: {
    id: 'board_refresh',
    type: 'board_refresh',
    name: 'Board Refresh',
    description: 'Shuffle board without penalty',
    rarity: 'common',
    duration: 'instant',
    icon: '🔄',
    color: 'text-cyan-400'
  },

  safety_net: {
    id: 'safety_net',
    type: 'safety_net',
    name: 'Safety Net',
    description: 'Next invalid word doesn\'t break combo',
    rarity: 'rare',
    duration: 'words',
    durationValue: 3,
    icon: '🛡️',
    color: 'text-yellow-400'
  },

  time_freeze: {
    id: 'time_freeze',
    type: 'time_freeze',
    name: 'Time Freeze',
    description: 'No difficulty increase for 3 waves',
    rarity: 'epic',
    duration: 'waves',
    durationValue: 3,
    icon: '❄️',
    color: 'text-blue-300'
  },

  wildcard_tile: {
    id: 'wildcard_tile',
    type: 'wildcard_tile',
    name: 'Wildcard Tile',
    description: 'One tile acts as any letter for 1 wave',
    rarity: 'epic',
    duration: 'waves',
    durationValue: 1,
    icon: '🃏',
    color: 'text-purple-400'
  },

  double_points: {
    id: 'double_points',
    type: 'double_points',
    name: 'Double Points',
    description: '2x score multiplier for next wave',
    rarity: 'rare',
    duration: 'waves',
    durationValue: 1,
    icon: '💰',
    color: 'text-yellow-500'
  },

  shield: {
    id: 'shield',
    type: 'shield',
    name: 'Shield',
    description: 'Protect from losing a life once',
    rarity: 'epic',
    duration: 'instant',
    icon: '🛡️',
    color: 'text-silver-400'
  },

  extra_life: {
    id: 'extra_life',
    type: 'extra_life',
    name: 'Extra Life',
    description: 'Gain an extra life',
    rarity: 'epic',
    duration: 'instant',
    icon: '❤️',
    color: 'text-red-400'
  }
};

// ============================================================================
// COMBO MILESTONES
// ============================================================================

export const COMBO_MILESTONES: ComboMilestone[] = [
  { combo: 3, reward: 'common_powerup', multiplier: 1.5, icon: '🔥' },
  { combo: 5, reward: 'rare_powerup', multiplier: 2.0, icon: '💫' },
  { combo: 7, reward: 'epic_powerup', multiplier: 3.0, icon: '⭐' },
  { combo: 10, reward: 'life_fragment', multiplier: 4.0, icon: '💎' },
  { combo: 15, reward: 'extra_life', multiplier: 5.0, icon: '❤️' }
];

// ============================================================================
// META-PROGRESSION UNLOCKS
// ============================================================================

export const SURVIVAL_UNLOCKS: SurvivalUnlock[] = [
  {
    id: 'veterans_edge',
    name: "Veteran's Edge",
    description: 'Start with 4 lives instead of 3',
    requirement: { type: 'waves_reached', value: 20 },
    effect: { extraLives: 1 },
    unlocked: false,
    icon: '❤️'
  },
  {
    id: 'first_aid_kit',
    name: 'First Aid Kit',
    description: 'Start with 1 shield',
    requirement: { type: 'runs_completed', value: 5 },
    effect: { startingShield: 1 },
    unlocked: false,
    icon: '🛡️'
  },
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: 'Start with 1 random power-up',
    requirement: { type: 'total_score', value: 10000 },
    effect: { startingPowerUps: [] },
    unlocked: false,
    icon: '🍀'
  },
  {
    id: 'stone_mason',
    name: 'Stone Mason',
    description: 'Start with Stone Crusher power-up',
    requirement: { type: 'tiles_cleared', value: 50 },
    effect: { startingPowerUps: ['stone_crusher'] },
    unlocked: false,
    icon: '🔨'
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Start with Combo Boost power-up',
    requirement: { type: 'waves_reached', value: 30 },
    effect: { startingPowerUps: ['combo_boost'] },
    unlocked: false,
    icon: '🔥'
  },
  {
    id: 'score_multiplier',
    name: 'Score Multiplier',
    description: 'Permanent 1.2x score multiplier',
    requirement: { type: 'total_score', value: 50000 },
    effect: { permanentMultiplier: 1.2 },
    unlocked: false,
    icon: '💰'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getRandomWaveChallenge(wave: number, excludeTypes: WaveChallengeType[] = []): WaveChallenge {
  const availableTypes = Object.keys(WAVE_CHALLENGES).filter(
    type => !excludeTypes.includes(type as WaveChallengeType)
  ) as WaveChallengeType[];

  const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  return WAVE_CHALLENGES[randomType](wave);
}

export function getRandomBossWave(wave: number): BossWave {
  const bossTypes = Object.keys(BOSS_TYPES) as BossType[];
  const randomType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
  const boss = BOSS_TYPES[randomType](wave);

  // Add banned letters for letter_lockout boss
  if (boss.type === 'letter_lockout') {
    const commonLetters = ['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S'];
    const numBanned = Math.min(2 + Math.floor(wave / 10), 4);
    boss.bannedLetters = [];
    for (let i = 0; i < numBanned; i++) {
      const randomLetter = commonLetters[Math.floor(Math.random() * commonLetters.length)];
      if (!boss.bannedLetters.includes(randomLetter)) {
        boss.bannedLetters.push(randomLetter);
      }
    }
  }

  return boss;
}

export function getRandomPowerUp(rarity?: PowerUpRarity): PowerUp {
  const powerUps = Object.values(POWER_UPS);

  if (rarity) {
    const filtered = powerUps.filter(p => p.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  return powerUps[Math.floor(Math.random() * powerUps.length)];
}

export function calculateComboMultiplier(combo: number): number {
  if (combo >= 15) return 5.0;
  if (combo >= 10) return 4.0;
  if (combo >= 7) return 3.0;
  if (combo >= 5) return 2.0;
  if (combo >= 3) return 1.5;
  return 1.0;
}

export function calculateDifficultyAdjustment(performance: PlayerPerformance, wave: number): number {
  let adjustment = 0;

  // Struggling players get easier challenges
  if (performance.averageWordLength < 4.5 && wave > 5) {
    adjustment -= 0.3;
  }

  // High performers get harder challenges
  if (performance.averageCombo > 5) {
    adjustment += 0.3;
  }

  // Success rate adjustment
  if (performance.successRate < 0.6) {
    adjustment -= 0.2;
  } else if (performance.successRate > 0.9) {
    adjustment += 0.2;
  }

  return Math.max(-0.5, Math.min(0.5, adjustment));
}

export function shouldShowShop(wave: number): boolean {
  // Shop appears every 5 waves after boss
  return wave > 0 && wave % 5 === 0;
}

export function shouldTriggerEvent(wave: number): boolean {
  // Events appear every 3-7 waves randomly
  if (wave < 3) return false;
  return Math.random() < 0.3; // 30% chance each wave after wave 3
}

export function countVowels(word: string): number {
  const vowels = 'AEIOU';
  return word.split('').filter(char => vowels.includes(char.toUpperCase())).length;
}

export function countConsonants(word: string): number {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  return word.split('').filter(char => consonants.includes(char.toUpperCase())).length;
}

export function hasRepeatedLetters(word: string): boolean {
  const letters = word.toUpperCase().split('');
  return new Set(letters).size !== letters.length;
}

export function isCornerPosition(row: number, col: number, gridSize: number = 4): boolean {
  return (row === 0 || row === gridSize - 1) && (col === 0 || col === gridSize - 1);
}
