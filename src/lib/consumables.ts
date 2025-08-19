// Consumables system types and constants

export type ConsumableId = 
  | "hint_revealer"
  | "score_multiplier" 
  | "hammer"
  | "extra_moves";

export type ConsumableRarity = "common" | "uncommon" | "rare" | "epic";

export type ActiveEffect = {
  id: ConsumableId;
  type: string;
  duration?: number;
  expiresAt?: Date;
  data?: any;
};

export type ConsumableReward = {
  id: ConsumableId;
  quantity: number;
};

export interface Consumable {
  id: ConsumableId;
  name: string;
  description: string;
  icon: string;
  rarity: ConsumableRarity;
  category: "powerup" | "board_modifier" | "special";
  usageDescription: string;
  cooldown?: number; // milliseconds
  dailyModeOnly?: boolean;
}

export const CONSUMABLES: Record<ConsumableId, Consumable> = {
  hint_revealer: {
    id: "hint_revealer",
    name: "Hint Revealer",
    description: "Highlights 3-5 valid words on the board for 10 seconds",
    icon: "💡",
    rarity: "common",
    category: "powerup",
    usageDescription: "Tap to reveal hidden words",
    cooldown: 0
  },
  score_multiplier: {
    id: "score_multiplier", 
    name: "Score Multiplier",
    description: "Doubles the score of your next word",
    icon: "⚡",
    rarity: "rare",
    category: "powerup",
    usageDescription: "Active until next word submission",
    cooldown: 300000 // 5 minutes in classic mode
  },
  hammer: {
    id: "hammer",
    name: "Hammer", 
    description: "Disables Stone tiles after they appear",
    icon: "🔨",
    rarity: "common",
    category: "board_modifier",
    usageDescription: "Breaks stone tiles on the board",
    cooldown: 0
  },
  extra_moves: {
    id: "extra_moves",
    name: "Extra Moves",
    description: "Adds 3 extra moves to your daily challenge",
    icon: "🎯",
    rarity: "epic", 
    category: "special",
    usageDescription: "Daily Challenge only",
    cooldown: 0,
    dailyModeOnly: true
  }
};

export const RARITY_COLORS: Record<ConsumableRarity, string> = {
  common: "border-blue-500 bg-blue-50 dark:bg-blue-950",
  uncommon: "border-green-500 bg-green-50 dark:bg-green-950", 
  rare: "border-purple-500 bg-purple-50 dark:bg-purple-950",
  epic: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
};

// Achievement rewards
export const ACHIEVEMENT_CONSUMABLE_REWARDS: Record<string, ConsumableReward[]> = {
  "first_bronze": [
    { id: "hint_revealer", quantity: 2 },
    { id: "hammer", quantity: 1 }
  ],
  "first_silver": [
    { id: "hint_revealer", quantity: 3 },
    { id: "score_multiplier", quantity: 1 }
  ],
  "gold_standard": [
    { id: "score_multiplier", quantity: 2 },
    { id: "hammer", quantity: 2 }
  ],
  "platinum_achiever": [
    { id: "extra_moves", quantity: 2 },
    { id: "score_multiplier", quantity: 3 }
  ]
};

// Daily login rewards
export const DAILY_LOGIN_REWARDS: Record<number, ConsumableReward[]> = {
  1: [{ id: "hint_revealer", quantity: 1 }],
  2: [{ id: "hammer", quantity: 1 }],
  3: [{ id: "hint_revealer", quantity: 2 }],
  4: [{ id: "score_multiplier", quantity: 1 }],
  5: [{ id: "hint_revealer", quantity: 1 }, { id: "hammer", quantity: 1 }],
  6: [{ id: "score_multiplier", quantity: 1 }],
  7: [
    { id: "hint_revealer", quantity: 3 },
    { id: "score_multiplier", quantity: 2 },
    { id: "extra_moves", quantity: 1 }
  ]
};

// Word discovery bonuses
export const WORD_DISCOVERY_BONUSES = {
  rareLetterWord: {
    condition: (word: string) => /[QXZJ]/.test(word.toUpperCase()),
    reward: { id: "score_multiplier" as ConsumableId, quantity: 1 },
    chance: 0.15
  },
  longWord: {
    condition: (word: string) => word.length >= 8,
    reward: { id: "hint_revealer" as ConsumableId, quantity: 2 },
    chance: 0.25
  }
};