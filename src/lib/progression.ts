export interface PlayerLevel {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  title: string;
  color: string;
  unlockedFeatures: string[];
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  category: 'scoring' | 'time' | 'hints' | 'special' | 'cosmetic';
  cost: number;
  maxLevel: number;
  currentLevel: number;
  prerequisites: string[];
  effects: {
    type: string;
    value: number;
    description: string;
  }[];
  icon: string;
}

export interface SkillTree {
  id: string;
  name: string;
  description: string;
  nodes: SkillNode[];
  unlockLevel: number;
}

// XP requirements for each level (exponential growth)
export const XP_REQUIREMENTS = [
  0,    // Level 1
  100,  // Level 2
  250,  // Level 3
  450,  // Level 4
  700,  // Level 5
  1000, // Level 6
  1350, // Level 7
  1750, // Level 8
  2200, // Level 9
  2700, // Level 10
  3250, // Level 11
  3850, // Level 12
  4500, // Level 13
  5200, // Level 14
  5950, // Level 15
  6750, // Level 16
  7600, // Level 17
  8500, // Level 18
  9450, // Level 19
  10450, // Level 20
  11500, // Level 21
  12600, // Level 22
  13750, // Level 23
  14950, // Level 24
  16200, // Level 25
  17500, // Level 26
  18850, // Level 27
  20250, // Level 28
  21700, // Level 29
  23200, // Level 30
];

// Level titles and colors
const LEVEL_TITLES = [
  { level: 1, title: "Word Novice", color: "text-gray-500" },
  { level: 5, title: "Letter Learner", color: "text-green-500" },
  { level: 10, title: "Word Builder", color: "text-blue-500" },
  { level: 15, title: "Chain Master", color: "text-purple-500" },
  { level: 20, title: "Lexicon Expert", color: "text-yellow-500" },
  { level: 25, title: "Word Wizard", color: "text-orange-500" },
  { level: 30, title: "Language Legend", color: "text-red-500" },
];

export function calculateLevel(xp: number): PlayerLevel {
  let level = 1;
  let totalXp = xp;
  
  // Find current level
  for (let i = 1; i < XP_REQUIREMENTS.length; i++) {
    if (xp >= XP_REQUIREMENTS[i]) {
      level = i;
    } else {
      break;
    }
  }
  
  // Calculate XP to next level
  const xpToNext = level < XP_REQUIREMENTS.length - 1 
    ? XP_REQUIREMENTS[level] - xp 
    : 0;
  
  // Find appropriate title
  const title = LEVEL_TITLES
    .slice()
    .reverse()
    .find(t => level >= t.level)?.title || "Word Novice";
  
  const color = LEVEL_TITLES
    .slice()
    .reverse()
    .find(t => level >= t.level)?.color || "text-gray-500";
  
  // Determine unlocked features based on level
  const unlockedFeatures: string[] = [];
  if (level >= 2) unlockedFeatures.push('advanced_modes');
  if (level >= 5) unlockedFeatures.push('skill_trees');
  if (level >= 10) unlockedFeatures.push('custom_themes');
  if (level >= 15) unlockedFeatures.push('achievement_categories');
  if (level >= 20) unlockedFeatures.push('premium_features');
  if (level >= 25) unlockedFeatures.push('exclusive_modes');
  
  return {
    level,
    xp,
    xpToNext,
    totalXp,
    title,
    color,
    unlockedFeatures
  };
}

export function calculateXpGain(params: {
  baseScore: number;
  wordsFound: number;
  longestWord: number;
  gameMode: string;
  difficulty: string;
  timeBonus?: number;
  streakBonus?: number;
  perfectGame?: boolean;
}): number {
  const {
    baseScore,
    wordsFound,
    longestWord,
    gameMode,
    difficulty,
    timeBonus = 0,
    streakBonus = 0,
    perfectGame = false
  } = params;
  
  // Base XP from score (1 XP per 10 points)
  let xp = Math.floor(baseScore / 10);
  
  // Word count bonus
  xp += wordsFound * 2;
  
  // Longest word bonus
  xp += longestWord * 3;
  
  // Game mode multiplier
  const modeMultipliers: Record<string, number> = {
    'classic': 1.0,
    'daily': 1.2,
    'practice': 0.8,
    'blitz': 1.5,
    'time_attack': 1.3,
    'endless': 2.0,
    'puzzle': 1.8,
    'survival': 1.6,
    'zen': 0.5
  };
  
  xp *= modeMultipliers[gameMode] || 1.0;
  
  // Difficulty multiplier
  const difficultyMultipliers: Record<string, number> = {
    'easy': 0.8,
    'medium': 1.0,
    'hard': 1.3,
    'expert': 1.6
  };
  
  xp *= difficultyMultipliers[difficulty] || 1.0;
  
  // Time bonus (for timed modes)
  xp += timeBonus;
  
  // Streak bonus
  xp += streakBonus;
  
  // Perfect game bonus
  if (perfectGame) {
    xp *= 1.5;
  }
  
  return Math.floor(xp);
}

// Skill Trees
export const SKILL_TREES: SkillTree[] = [
  {
    id: 'scoring',
    name: 'Scoring Mastery',
    description: 'Enhance your scoring potential and word value',
    unlockLevel: 5,
    nodes: [
      {
        id: 'score_boost',
        name: 'Score Amplifier',
        description: 'Increase base score multiplier',
        category: 'scoring',
        cost: 10,
        maxLevel: 5,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'score_multiplier',
            value: 0.1,
            description: '+10% score per level'
          }
        ],
        icon: '🎯'
      },
      {
        id: 'word_length_bonus',
        name: 'Length Specialist',
        description: 'Extra points for longer words',
        category: 'scoring',
        cost: 15,
        maxLevel: 3,
        currentLevel: 0,
        prerequisites: ['score_boost'],
        effects: [
          {
            type: 'length_bonus',
            value: 5,
            description: '+5 points per letter over 5'
          }
        ],
        icon: '📏'
      },
      {
        id: 'rare_letter_expert',
        name: 'Rare Letter Expert',
        description: 'Bonus points for using rare letters',
        category: 'scoring',
        cost: 20,
        maxLevel: 4,
        currentLevel: 0,
        prerequisites: ['score_boost'],
        effects: [
          {
            type: 'rare_letter_bonus',
            value: 0.2,
            description: '+20% bonus for rare letters'
          }
        ],
        icon: '💎'
      }
    ]
  },
  {
    id: 'time',
    name: 'Time Mastery',
    description: 'Master time-based challenges and efficiency',
    unlockLevel: 10,
    nodes: [
      {
        id: 'time_extension',
        name: 'Time Extension',
        description: 'Extra time in timed modes',
        category: 'time',
        cost: 12,
        maxLevel: 3,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'time_bonus',
            value: 10,
            description: '+10 seconds per level'
          }
        ],
        icon: '⏰'
      },
      {
        id: 'quick_thinking',
        name: 'Quick Thinking',
        description: 'Faster word recognition and validation',
        category: 'time',
        cost: 18,
        maxLevel: 4,
        currentLevel: 0,
        prerequisites: ['time_extension'],
        effects: [
          {
            type: 'validation_speed',
            value: 0.1,
            description: '+10% faster word validation'
          }
        ],
        icon: '⚡'
      }
    ]
  },
  {
    id: 'hints',
    name: 'Hint Mastery',
    description: 'Unlock powerful hint and assistance systems',
    unlockLevel: 15,
    nodes: [
      {
        id: 'word_hints',
        name: 'Word Hints',
        description: 'Get hints for available words',
        category: 'hints',
        cost: 25,
        maxLevel: 3,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'hint_accuracy',
            value: 0.2,
            description: '+20% hint accuracy per level'
          }
        ],
        icon: '💡'
      },
      {
        id: 'pattern_recognition',
        name: 'Pattern Recognition',
        description: 'Highlight potential word patterns',
        category: 'hints',
        cost: 30,
        maxLevel: 2,
        currentLevel: 0,
        prerequisites: ['word_hints'],
        effects: [
          {
            type: 'pattern_highlight',
            value: 1,
            description: 'Highlight word patterns'
          }
        ],
        icon: '🔍'
      }
    ]
  },
  {
    id: 'special',
    name: 'Special Abilities',
    description: 'Unlock special powers and game mechanics',
    unlockLevel: 20,
    nodes: [
      {
        id: 'wild_card',
        name: 'Wild Card',
        description: 'Convert any letter to any other letter',
        category: 'special',
        cost: 50,
        maxLevel: 2,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'wild_cards',
            value: 1,
            description: '+1 wild card per level'
          }
        ],
        icon: '🃏'
      },
      {
        id: 'board_reshuffle',
        name: 'Board Reshuffle',
        description: 'Reshuffle the board when stuck',
        category: 'special',
        cost: 40,
        maxLevel: 1,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'reshuffle_uses',
            value: 1,
            description: 'Reshuffle board once per game'
          }
        ],
        icon: '🔀'
      }
    ]
  },
  {
    id: 'cosmetic',
    name: 'Cosmetic Enhancements',
    description: 'Customize your visual experience',
    unlockLevel: 8,
    nodes: [
      {
        id: 'particle_effects',
        name: 'Enhanced Particles',
        description: 'More spectacular particle effects',
        category: 'cosmetic',
        cost: 15,
        maxLevel: 3,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'particle_intensity',
            value: 0.3,
            description: '+30% particle intensity per level'
          }
        ],
        icon: '✨'
      },
      {
        id: 'theme_unlock',
        name: 'Theme Unlocker',
        description: 'Unlock new visual themes',
        category: 'cosmetic',
        cost: 20,
        maxLevel: 5,
        currentLevel: 0,
        prerequisites: [],
        effects: [
          {
            type: 'theme_unlock',
            value: 1,
            description: 'Unlock 1 theme per level'
          }
        ],
        icon: '🎨'
      }
    ]
  }
];

export function getSkillTreeById(id: string): SkillTree | undefined {
  return SKILL_TREES.find(tree => tree.id === id);
}

export function canUnlockSkill(skillId: string, playerLevel: number, availableXp: number, unlockedSkills: Set<string>): boolean {
  const skill = SKILL_TREES
    .flatMap(tree => tree.nodes)
    .find(node => node.id === skillId);
  
  if (!skill) return false;
  
  // Check if player level is sufficient
  if (playerLevel < skill.cost / 10) return false;
  
  // Check if enough XP available
  if (availableXp < skill.cost) return false;
  
  // Check prerequisites
  return skill.prerequisites.every(prereq => unlockedSkills.has(prereq));
}

export function getSkillEffect(skillId: string, level: number): number {
  const skill = SKILL_TREES
    .flatMap(tree => tree.nodes)
    .find(node => node.id === skillId);
  
  if (!skill) return 0;
  
  const effect = skill.effects[0];
  return effect ? effect.value * level : 0;
}

