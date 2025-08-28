export type GoalCategory = 
  | "achievement" 
  | "exploration" 
  | "progressive" 
  | "daily" 
  | "skill";

export type GoalDifficulty = "easy" | "medium" | "hard" | "expert";

export type GoalCondition = {
  type: "score_in_game" | "words_in_game" | "total_games" | "streak_games" | "longest_word" | "specific_achievement" | "total_score";
  target: number;
  data?: any; // For specific conditions like achievement type
};

export type GoalReward = {
  type: "points" | "title" | "cosmetic";
  value: number | string;
};

export type GoalDefinition = {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  difficulty: GoalDifficulty;
  condition: GoalCondition;
  reward: GoalReward;
  timeLimit?: number; // in hours, for time-limited goals
  prerequisites?: string[]; // other goal IDs that must be completed
};

// Goal definitions organized by category
export const GOAL_DEFINITIONS: Record<string, GoalDefinition> = {
  // Achievement-Focused Goals
  "first_bronze": {
    id: "first_bronze",
    title: "Bronze Achiever",
    description: "Earn your first Bronze rating in a game",
    category: "achievement",
    difficulty: "easy",
    condition: { type: "specific_achievement", target: 1, data: { grade: "Bronze" } },
    reward: { type: "points", value: 100 }
  },
  "first_silver": {
    id: "first_silver", 
    title: "Silver Seeker",
    description: "Reach Silver rating in a game",
    category: "achievement",
    difficulty: "medium",
    condition: { type: "specific_achievement", target: 1, data: { grade: "Silver" } },
    reward: { type: "points", value: 200 },
    prerequisites: ["first_bronze"]
  },
  "gold_standard": {
    id: "gold_standard",
    title: "Gold Standard",
    description: "Achieve Gold rating in a game", 
    category: "achievement",
    difficulty: "hard",
    condition: { type: "specific_achievement", target: 1, data: { grade: "Gold" } },
    reward: { type: "points", value: 500 },
    prerequisites: ["first_silver"]
  },
  
  // Exploration Goals
  "word_explorer": {
    id: "word_explorer",
    title: "Word Explorer",
    description: "Find 15 words in a single game",
    category: "exploration", 
    difficulty: "easy",
    condition: { type: "words_in_game", target: 15 },
    reward: { type: "points", value: 150 }
  },
  "vocabulary_master": {
    id: "vocabulary_master",
    title: "Vocabulary Master", 
    description: "Find 25 words in a single game",
    category: "exploration",
    difficulty: "medium", 
    condition: { type: "words_in_game", target: 25 },
    reward: { type: "points", value: 300 }
  },
  "lexicon_legend": {
    id: "lexicon_legend",
    title: "Lexicon Legend",
    description: "Find 35 words in a single game",
    category: "exploration",
    difficulty: "hard",
    condition: { type: "words_in_game", target: 35 },
    reward: { type: "points", value: 600 }
  },
  
  // Progressive Goals
  "game_rookie": {
    id: "game_rookie",
    title: "Game Rookie",
    description: "Complete 5 standard games",
    category: "progressive",
    difficulty: "easy",
    condition: { type: "total_games", target: 5 },
    reward: { type: "points", value: 200 }
  },
  "seasoned_player": {
    id: "seasoned_player", 
    title: "Seasoned Player",
    description: "Complete 20 standard games",
    category: "progressive",
    difficulty: "medium",
    condition: { type: "total_games", target: 20 },
    reward: { type: "points", value: 500 }
  },
  "veteran_wordsmith": {
    id: "veteran_wordsmith",
    title: "Veteran Wordsmith", 
    description: "Complete 50 standard games",
    category: "progressive",
    difficulty: "hard",
    condition: { type: "total_games", target: 50 },
    reward: { type: "points", value: 1000 }
  },
  
  // Daily Goals (reset each day)
  "daily_scorer": {
    id: "daily_scorer",
    title: "Daily Scorer",
    description: "Score 1000 points in games today",
    category: "daily",
    difficulty: "easy", 
    condition: { type: "total_score", target: 1000 },
    reward: { type: "points", value: 100 },
    timeLimit: 24
  },
  "daily_achiever": {
    id: "daily_achiever",
    title: "Daily Achiever", 
    description: "Complete 3 games today",
    category: "daily",
    difficulty: "easy",
    condition: { type: "total_games", target: 3 },
    reward: { type: "points", value: 150 },
    timeLimit: 24
  },
  
  // Skill-Building Goals
  "score_climber": {
    id: "score_climber",
    title: "Score Climber",
    description: "Score 1500 points in a single game",
    category: "skill",
    difficulty: "medium",
    condition: { type: "score_in_game", target: 1500 },
    reward: { type: "points", value: 250 }
  },
  "high_scorer": {
    id: "high_scorer",
    title: "High Scorer",
    description: "Score 2500 points in a single game", 
    category: "skill",
    difficulty: "hard",
    condition: { type: "score_in_game", target: 2500 },
    reward: { type: "points", value: 500 }
  },
  "word_length_master": {
    id: "word_length_master",
    title: "Word Length Master",
    description: "Find a word with 8 or more letters",
    category: "skill",
    difficulty: "medium",
    condition: { type: "longest_word", target: 8 },
    reward: { type: "points", value: 300 }
  },
  "consistency_king": {
    id: "consistency_king",
    title: "Consistency King",
    description: "Complete 5 games in a row with Bronze or better",
    category: "skill", 
    difficulty: "hard",
    condition: { type: "streak_games", target: 5, data: { minGrade: "Bronze" } },
    reward: { type: "points", value: 750 }
  }
};

// Helper functions for goal management
export function getGoalsByCategory(category: GoalCategory): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS).filter(goal => goal.category === category);
}

export function getGoalsByDifficulty(difficulty: GoalDifficulty): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS).filter(goal => goal.difficulty === difficulty);
}

export function getAvailableGoals(completedGoalIds: string[]): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS).filter(goal => {
    // Check if goal is already completed
    if (completedGoalIds.includes(goal.id)) return false;
    
    // Check prerequisites
    if (goal.prerequisites) {
      return goal.prerequisites.every(prereq => completedGoalIds.includes(prereq));
    }
    
    return true;
  });
}

export function calculateGoalProgress(
  goal: GoalDefinition,
  gameStats: {
    totalGames: number;
    totalScore: number;
    highestScore: number;
    longestWord: number;
    achievementGrades: string[];
    recentStreak: { count: number; minGrade: string };
  }
): number {
  const { condition } = goal;
  
  switch (condition.type) {
    case "total_games":
      return Math.min(gameStats.totalGames, condition.target);
    case "total_score":
      return Math.min(gameStats.totalScore, condition.target);
    case "score_in_game":
      return Math.min(gameStats.highestScore, condition.target);
    case "longest_word":
      return Math.min(gameStats.longestWord, condition.target);
    case "specific_achievement":
      const hasAchievement = gameStats.achievementGrades.includes(condition.data.grade);
      return hasAchievement ? condition.target : 0;
    case "streak_games":
      if (gameStats.recentStreak.minGrade === condition.data.minGrade || 
          ["Bronze", "Silver", "Gold", "Platinum"].indexOf(gameStats.recentStreak.minGrade) >= 
          ["Bronze", "Silver", "Gold", "Platinum"].indexOf(condition.data.minGrade)) {
        return Math.min(gameStats.recentStreak.count, condition.target);
      }
      return 0;
    default:
      return 0;
  }
}