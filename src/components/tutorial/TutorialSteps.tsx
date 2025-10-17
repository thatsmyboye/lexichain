import React from 'react';
import { Play, Target, Trophy, Zap, BookOpen, Gamepad2, Star, Users, Settings } from 'lucide-react';
import type { TutorialStep } from './TutorialOverlay';

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Lexichain!',
    description: 'Lexichain is a word-chaining puzzle game where you draw paths through letter grids to form words. Each new word must reuse at least one tile from the previous word.',
    position: 'center',
    action: 'wait',
    icon: <BookOpen className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'game_board',
    title: 'The Game Board',
    description: 'This is your letter grid. You\'ll draw paths through these letters to form words. The board is randomly generated each game to keep things interesting!',
    target: '[data-tutorial="game-board"]',
    position: 'bottom',
    action: 'wait',
    icon: <Gamepad2 className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'drawing_path',
    title: 'Drawing Word Paths',
    description: 'Click and drag to draw a path through adjacent letters. You can move horizontally, vertically, or diagonally to neighboring tiles.',
    target: '[data-tutorial="game-board"]',
    position: 'bottom',
    action: 'custom',
    customAction: () => {
      // This will be handled by the game component
      console.log('Tutorial: Show drawing example');
    },
    icon: <Target className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'word_validation',
    title: 'Word Validation',
    description: 'When you complete a path, the game checks if it forms a valid English word. Valid words are added to your word list and contribute to your score.',
    target: '[data-tutorial="word-list"]',
    position: 'left',
    action: 'wait',
    icon: <Zap className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'scoring_system',
    title: 'Scoring System',
    description: 'Your score is based on word length and letter rarity. Longer words and words with rare letters (like Q, X, Z) give more points. Aim for Bronze, Silver, Gold, or Platinum ratings!',
    target: '[data-tutorial="score-display"]',
    position: 'top',
    action: 'wait',
    icon: <Trophy className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'chain_requirement',
    title: 'The Chain Rule',
    description: 'Here\'s the key rule: Each new word must reuse at least one tile from your previous word. This creates a chain of connected words and adds strategic depth to the game.',
    target: '[data-tutorial="chain-indicator"]',
    position: 'bottom',
    action: 'wait',
    icon: <Star className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'consumables',
    title: 'Consumables & Power-ups',
    description: 'Use consumables to enhance your gameplay! Hint Revealers show word paths, Score Multipliers double your points, and Hammers break stone tiles.',
    target: '[data-tutorial="consumables"]',
    position: 'right',
    action: 'wait',
    icon: <Zap className="h-5 w-5 text-primary" />,
    skipable: true
  },
  {
    id: 'game_modes',
    title: 'Game Modes',
    description: 'Try different game modes! Daily Challenge offers a new puzzle each day, Classic mode has no time limits, and Practice mode helps you improve your skills.',
    target: '[data-tutorial="game-modes"]',
    position: 'top',
    action: 'wait',
    icon: <Gamepad2 className="h-5 w-5 text-primary" />,
    skipable: true
  },
  {
    id: 'achievements',
    title: 'Achievements & Goals',
    description: 'Track your progress with achievements and goals. Complete challenges to earn rewards and climb the leaderboards!',
    target: '[data-tutorial="achievements"]',
    position: 'left',
    action: 'wait',
    icon: <Trophy className="h-5 w-5 text-primary" />,
    skipable: true
  },
  {
    id: 'ready_to_play',
    title: 'Ready to Play!',
    description: 'You\'re all set! Start with the Daily Challenge or try Classic mode. Remember: draw paths, form words, and keep the chain going. Good luck!',
    position: 'center',
    action: 'custom',
    customAction: () => {
      console.log('Tutorial completed - ready to play!');
    },
    icon: <Play className="h-5 w-5 text-primary" />,
    required: true
  }
];

// Tutorial steps for specific game modes
export const DAILY_CHALLENGE_TUTORIAL: TutorialStep[] = [
  {
    id: 'daily_intro',
    title: 'Daily Challenge',
    description: 'Each day brings a new, unique puzzle! Complete it to earn your daily achievement and compete on the leaderboard.',
    position: 'center',
    action: 'wait',
    icon: <Target className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'daily_limits',
    title: 'Move Limits',
    description: 'Daily Challenges have a limited number of moves. Use them wisely! You can earn extra moves through consumables or achievements.',
    target: '[data-tutorial="moves-counter"]',
    position: 'top',
    action: 'wait',
    icon: <Zap className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'daily_rating',
    title: 'Daily Rating',
    description: 'Your performance determines your daily rating: Bronze, Silver, Gold, or Platinum. Higher ratings earn better rewards!',
    target: '[data-tutorial="rating-display"]',
    position: 'bottom',
    action: 'wait',
    icon: <Trophy className="h-5 w-5 text-primary" />,
    required: true
  }
];

export const CONSUMABLES_TUTORIAL: TutorialStep[] = [
  {
    id: 'consumables_intro',
    title: 'Consumables',
    description: 'Consumables are special items that can help you during gameplay. You can earn them through achievements or purchase them in the store.',
    position: 'center',
    action: 'wait',
    icon: <Zap className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'hint_revealer',
    title: 'Hint Revealer',
    description: 'Reveals the complete path of a valid word (4 letters or fewer). Perfect for when you\'re stuck!',
    target: '[data-tutorial="hint-revealer"]',
    position: 'right',
    action: 'wait',
    icon: <Target className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'score_multiplier',
    title: 'Score Multiplier',
    description: 'Doubles the score of your next word. Use it strategically on high-value words for maximum impact!',
    target: '[data-tutorial="score-multiplier"]',
    position: 'right',
    action: 'wait',
    icon: <Trophy className="h-5 w-5 text-primary" />,
    required: true
  },
  {
    id: 'hammer',
    title: 'Hammer',
    description: 'Disables Stone tiles that block your path. Essential for clearing difficult board configurations!',
    target: '[data-tutorial="hammer"]',
    position: 'right',
    action: 'wait',
    icon: <Zap className="h-5 w-5 text-primary" />,
    required: true
  }
];

// Tutorial manager hook
export function useTutorial() {
  const [isActive, setIsActive] = React.useState(false);
  const [currentTutorial, setCurrentTutorial] = React.useState<string | null>(null);
  const [hasCompletedTutorial, setHasCompletedTutorial] = React.useState(false);

  React.useEffect(() => {
    // Check if user has completed tutorial
    const completed = localStorage.getItem('lexichain-tutorial-completed');
    setHasCompletedTutorial(completed === 'true');
  }, []);

  const startTutorial = (tutorialType: 'main' | 'daily' | 'consumables' = 'main') => {
    setCurrentTutorial(tutorialType);
    setIsActive(true);
  };

  const completeTutorial = () => {
    setIsActive(false);
    setCurrentTutorial(null);
    setHasCompletedTutorial(true);
    localStorage.setItem('lexichain-tutorial-completed', 'true');
  };

  const skipTutorial = () => {
    setIsActive(false);
    setCurrentTutorial(null);
  };

  const getTutorialSteps = () => {
    switch (currentTutorial) {
      case 'daily':
        return DAILY_CHALLENGE_TUTORIAL;
      case 'consumables':
        return CONSUMABLES_TUTORIAL;
      default:
        return TUTORIAL_STEPS;
    }
  };

  return {
    isActive,
    currentTutorial,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    getTutorialSteps
  };
}
