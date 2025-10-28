export interface AdvancedAchievement {
  id: string;
  name: string;
  description: string;
  category: 'scoring' | 'speed' | 'vocabulary' | 'strategy' | 'special' | 'social' | 'collection';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  tier: number; // 1-5, higher tiers are more difficult
  requirements: AchievementRequirement[];
  rewards: {
    xp: number;
    title?: string;
    color?: string;
    icon?: string;
    unlockFeature?: string;
  };
  prerequisites?: string[]; // Other achievement IDs
  hidden: boolean; // Hidden until unlocked
  unlockLevel?: number; // Minimum player level required
}

export interface AchievementRequirement {
  type: 'score' | 'words' | 'time' | 'streak' | 'accuracy' | 'combo' | 'special' | 'collection';
  operator: 'gte' | 'lte' | 'eq' | 'between';
  value: number | [number, number];
  description: string;
  progress?: number; // Current progress (0-100)
}

export interface AchievementProgress {
  achievementId: string;
  completed: boolean;
  completedAt?: string;
  progress: number; // 0-100
  requirements: Array<{
    type: string;
    completed: boolean;
    progress: number;
  }>;
}

// Advanced Achievement Definitions
export const ADVANCED_ACHIEVEMENTS: AdvancedAchievement[] = [
  // Scoring Achievements
  {
    id: 'score_master_1',
    name: 'Score Apprentice',
    description: 'Reach 1,000 total points across all games',
    category: 'scoring',
    rarity: 'common',
    tier: 1,
    requirements: [
      {
        type: 'score',
        operator: 'gte',
        value: 1000,
        description: 'Total score: 1,000 points'
      }
    ],
    rewards: {
      xp: 50,
      title: 'Score Apprentice',
      color: '#10b981'
    },
    hidden: false
  },
  {
    id: 'score_master_5',
    name: 'Score Virtuoso',
    description: 'Reach 10,000 total points across all games',
    category: 'scoring',
    rarity: 'uncommon',
    tier: 2,
    requirements: [
      {
        type: 'score',
        operator: 'gte',
        value: 10000,
        description: 'Total score: 10,000 points'
      }
    ],
    rewards: {
      xp: 200,
      title: 'Score Virtuoso',
      color: '#3b82f6'
    },
    prerequisites: ['score_master_1'],
    hidden: false
  },
  {
    id: 'score_master_10',
    name: 'Score Legend',
    description: 'Reach 100,000 total points across all games',
    category: 'scoring',
    rarity: 'rare',
    tier: 3,
    requirements: [
      {
        type: 'score',
        operator: 'gte',
        value: 100000,
        description: 'Total score: 100,000 points'
      }
    ],
    rewards: {
      xp: 500,
      title: 'Score Legend',
      color: '#8b5cf6'
    },
    prerequisites: ['score_master_5'],
    hidden: false
  },

  // Speed Achievements
  {
    id: 'speed_demon_1',
    name: 'Quick Draw',
    description: 'Find 10 words in under 2 minutes',
    category: 'speed',
    rarity: 'common',
    tier: 1,
    requirements: [
      {
        type: 'words',
        operator: 'gte',
        value: 10,
        description: 'Find 10 words'
      },
      {
        type: 'time',
        operator: 'lte',
        value: 120,
        description: 'In under 2 minutes'
      }
    ],
    rewards: {
      xp: 75,
      title: 'Quick Draw',
      color: '#f59e0b'
    },
    hidden: false
  },
  {
    id: 'speed_demon_2',
    name: 'Lightning Fast',
    description: 'Find 20 words in under 3 minutes',
    category: 'speed',
    rarity: 'uncommon',
    tier: 2,
    requirements: [
      {
        type: 'words',
        operator: 'gte',
        value: 20,
        description: 'Find 20 words'
      },
      {
        type: 'time',
        operator: 'lte',
        value: 180,
        description: 'In under 3 minutes'
      }
    ],
    rewards: {
      xp: 150,
      title: 'Lightning Fast',
      color: '#ef4444'
    },
    prerequisites: ['speed_demon_1'],
    hidden: false
  },

  // Vocabulary Achievements
  {
    id: 'vocab_master_1',
    name: 'Word Collector',
    description: 'Use 100 unique words across all games',
    category: 'vocabulary',
    rarity: 'common',
    tier: 1,
    requirements: [
      {
        type: 'collection',
        operator: 'gte',
        value: 100,
        description: '100 unique words used'
      }
    ],
    rewards: {
      xp: 100,
      title: 'Word Collector',
      color: '#06b6d4'
    },
    hidden: false
  },
  {
    id: 'vocab_master_2',
    name: 'Lexicon Master',
    description: 'Use 500 unique words across all games',
    category: 'vocabulary',
    rarity: 'rare',
    tier: 3,
    requirements: [
      {
        type: 'collection',
        operator: 'gte',
        value: 500,
        description: '500 unique words used'
      }
    ],
    rewards: {
      xp: 300,
      title: 'Lexicon Master',
      color: '#8b5cf6'
    },
    prerequisites: ['vocab_master_1'],
    hidden: false
  },

  // Strategy Achievements
  {
    id: 'strategy_master_1',
    name: 'Strategic Thinker',
    description: 'Maintain 80% accuracy over 10 consecutive games',
    category: 'strategy',
    rarity: 'uncommon',
    tier: 2,
    requirements: [
      {
        type: 'accuracy',
        operator: 'gte',
        value: 80,
        description: '80% accuracy'
      },
      {
        type: 'streak',
        operator: 'gte',
        value: 10,
        description: 'Over 10 consecutive games'
      }
    ],
    rewards: {
      xp: 200,
      title: 'Strategic Thinker',
      color: '#10b981'
    },
    hidden: false
  },
  {
    id: 'strategy_master_2',
    name: 'Tactical Genius',
    description: 'Achieve perfect accuracy (100%) in any game mode',
    category: 'strategy',
    rarity: 'epic',
    tier: 4,
    requirements: [
      {
        type: 'accuracy',
        operator: 'eq',
        value: 100,
        description: 'Perfect accuracy (100%)'
      }
    ],
    rewards: {
      xp: 500,
      title: 'Tactical Genius',
      color: '#f59e0b'
    },
    hidden: false
  },

  // Special Achievements
  {
    id: 'special_combo_master',
    name: 'Combo Master',
    description: 'Create a 10-word combo in a single game',
    category: 'special',
    rarity: 'rare',
    tier: 3,
    requirements: [
      {
        type: 'combo',
        operator: 'gte',
        value: 10,
        description: '10-word combo'
      }
    ],
    rewards: {
      xp: 400,
      title: 'Combo Master',
      color: '#ec4899'
    },
    hidden: false
  },
  {
    id: 'special_perfect_game',
    name: 'Perfectionist',
    description: 'Complete a game with no invalid word attempts',
    category: 'special',
    rarity: 'epic',
    tier: 4,
    requirements: [
      {
        type: 'accuracy',
        operator: 'eq',
        value: 100,
        description: 'No invalid attempts'
      }
    ],
    rewards: {
      xp: 600,
      title: 'Perfectionist',
      color: '#8b5cf6'
    },
    hidden: false
  },

  // Hidden Achievements
  {
    id: 'hidden_first_word',
    name: 'First Steps',
    description: 'Find your very first word',
    category: 'special',
    rarity: 'common',
    tier: 1,
    requirements: [
      {
        type: 'words',
        operator: 'gte',
        value: 1,
        description: 'Find 1 word'
      }
    ],
    rewards: {
      xp: 25,
      title: 'First Steps',
      color: '#6b7280'
    },
    hidden: true
  },
  {
    id: 'hidden_midnight_player',
    name: 'Night Owl',
    description: 'Play a game between midnight and 3 AM',
    category: 'special',
    rarity: 'uncommon',
    tier: 2,
    requirements: [
      {
        type: 'special',
        operator: 'eq',
        value: 1,
        description: 'Play during midnight hours'
      }
    ],
    rewards: {
      xp: 100,
      title: 'Night Owl',
      color: '#1f2937'
    },
    hidden: true
  },

  // Legendary Achievements
  {
    id: 'legendary_word_god',
    name: 'Word God',
    description: 'Master all aspects of Lexichain - score, speed, vocabulary, and strategy',
    category: 'special',
    rarity: 'legendary',
    tier: 5,
    requirements: [
      {
        type: 'score',
        operator: 'gte',
        value: 1000000,
        description: '1,000,000 total points'
      },
      {
        type: 'collection',
        operator: 'gte',
        value: 1000,
        description: '1,000 unique words'
      },
      {
        type: 'accuracy',
        operator: 'gte',
        value: 95,
        description: '95% average accuracy'
      }
    ],
    rewards: {
      xp: 2000,
      title: 'Word God',
      color: '#fbbf24',
      icon: '👑',
      unlockFeature: 'exclusive_theme'
    },
    prerequisites: ['score_master_10', 'vocab_master_2', 'strategy_master_2'],
    hidden: false,
    unlockLevel: 50
  }
];

export function getAchievementsByCategory(category: string): AdvancedAchievement[] {
  return ADVANCED_ACHIEVEMENTS.filter(achievement => achievement.category === category);
}

export function getAchievementsByRarity(rarity: string): AdvancedAchievement[] {
  return ADVANCED_ACHIEVEMENTS.filter(achievement => achievement.rarity === rarity);
}

export function getAchievementsByTier(tier: number): AdvancedAchievement[] {
  return ADVANCED_ACHIEVEMENTS.filter(achievement => achievement.tier === tier);
}

export function getUnlockedAchievements(completedAchievements: Set<string>): AdvancedAchievement[] {
  return ADVANCED_ACHIEVEMENTS.filter(achievement => 
    completedAchievements.has(achievement.id)
  );
}

export function getAvailableAchievements(
  completedAchievements: Set<string>, 
  playerLevel: number
): AdvancedAchievement[] {
  return ADVANCED_ACHIEVEMENTS.filter(achievement => {
    // Not already completed
    if (completedAchievements.has(achievement.id)) return false;
    
    // Level requirement met
    if (achievement.unlockLevel && playerLevel < achievement.unlockLevel) return false;
    
    // Prerequisites met
    if (achievement.prerequisites) {
      return achievement.prerequisites.every(prereq => 
        completedAchievements.has(prereq)
      );
    }
    
    return true;
  });
}

export function calculateAchievementProgress(
  achievement: AdvancedAchievement,
  gameStats: {
    totalScore: number;
    totalWords: number;
    uniqueWords: number;
    averageAccuracy: number;
    gamesPlayed: number;
    bestCombo: number;
    perfectGames: number;
  }
): AchievementProgress {
  const progress: AchievementProgress = {
    achievementId: achievement.id,
    completed: false,
    progress: 0,
    requirements: []
  };

  let totalProgress = 0;
  let completedRequirements = 0;

  for (const requirement of achievement.requirements) {
    let currentValue = 0;
    let targetValue = 0;
    let completed = false;

    switch (requirement.type) {
      case 'score':
        currentValue = gameStats.totalScore;
        targetValue = requirement.value as number;
        break;
      case 'words':
        currentValue = gameStats.totalWords;
        targetValue = requirement.value as number;
        break;
      case 'collection':
        currentValue = gameStats.uniqueWords;
        targetValue = requirement.value as number;
        break;
      case 'accuracy':
        currentValue = gameStats.averageAccuracy;
        targetValue = requirement.value as number;
        break;
      case 'combo':
        currentValue = gameStats.bestCombo;
        targetValue = requirement.value as number;
        break;
      case 'special':
        // Special requirements would need custom logic
        currentValue = 0;
        targetValue = requirement.value as number;
        break;
    }

    // Check if requirement is met
    switch (requirement.operator) {
      case 'gte':
        completed = currentValue >= targetValue;
        break;
      case 'lte':
        completed = currentValue <= targetValue;
        break;
      case 'eq':
        completed = currentValue === targetValue;
        break;
      case 'between':
        const [min, max] = requirement.value as [number, number];
        completed = currentValue >= min && currentValue <= max;
        break;
    }

    const requirementProgress = Math.min(100, (currentValue / targetValue) * 100);
    
    progress.requirements.push({
      type: requirement.type,
      completed,
      progress: requirementProgress
    });

    totalProgress += requirementProgress;
    if (completed) completedRequirements++;
  }

  progress.progress = Math.round(totalProgress / achievement.requirements.length);
  progress.completed = completedRequirements === achievement.requirements.length;

  return progress;
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#6b7280';
    case 'uncommon': return '#10b981';
    case 'rare': return '#3b82f6';
    case 'epic': return '#8b5cf6';
    case 'legendary': return '#fbbf24';
    default: return '#6b7280';
  }
}

export function getRarityIcon(rarity: string): string {
  switch (rarity) {
    case 'common': return '⚪';
    case 'uncommon': return '🟢';
    case 'rare': return '🔵';
    case 'epic': return '🟣';
    case 'legendary': return '🟡';
    default: return '⚪';
  }
}

