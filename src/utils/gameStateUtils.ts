import { getDailyChallengeDate } from './dateUtils';
import type { DailyChallengeGameState } from '@/hooks/useDailyChallengeState';

export interface GameStateInfo {
  hasIncompleteGame: boolean;
  progress?: {
    score: number;
    movesUsed: number;
    wordsFound: number;
    lastSaved?: number;
    timeSinceLastSave?: string;
  };
  canRecover: boolean;
  errors?: string[];
}

export function checkIncompleteGameState(challengeDate?: string): GameStateInfo {
  const targetDate = challengeDate || getDailyChallengeDate();
  const savedState = localStorage.getItem(`daily-challenge-${targetDate}`);
  
  if (!savedState) {
    return { hasIncompleteGame: false, canRecover: false };
  }

  try {
    const gameState = JSON.parse(savedState) as DailyChallengeGameState;
    
    // Validate core game state
    const hasValidCore = gameState.seed === targetDate && 
                        gameState.initialBoard && 
                        gameState.board &&
                        Array.isArray(gameState.usedWords);

    const isGameComplete = gameState.gameOver === true;
    
    if (!hasValidCore) {
      return {
        hasIncompleteGame: false,
        canRecover: false,
        errors: ['Invalid game state structure']
      };
    }

    if (isGameComplete) {
      return { hasIncompleteGame: false, canRecover: false };
    }

    // Game is incomplete and valid
    const lastSavedTime = gameState.lastSaved;
    const timeSinceLastSave = lastSavedTime 
      ? formatTimeSince(lastSavedTime)
      : undefined;

    return {
      hasIncompleteGame: true,
      canRecover: true,
      progress: {
        score: gameState.score || 0,
        movesUsed: gameState.movesUsed || 0,
        wordsFound: gameState.usedWords?.length || 0,
        lastSaved: lastSavedTime,
        timeSinceLastSave
      }
    };
  } catch (error) {
    console.warn('Error parsing saved game state:', error);
    return {
      hasIncompleteGame: false,
      canRecover: false,
      errors: ['Failed to parse saved state']
    };
  }
}

export function clearIncompleteGameState(challengeDate?: string): void {
  const targetDate = challengeDate || getDailyChallengeDate();
  localStorage.removeItem(`daily-challenge-${targetDate}`);
}

export function formatTimeSince(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

export function validateGameStateIntegrity(gameState: any): {
  isValid: boolean;
  canRecover: boolean;
  issues: string[];
  recoveredState?: Partial<DailyChallengeGameState>;
} {
  const issues: string[] = [];
  let canRecover = false;
  let recoveredState: Partial<DailyChallengeGameState> = {};

  if (!gameState) {
    return {
      isValid: false,
      canRecover: false,
      issues: ['Game state is null or undefined']
    };
  }

  // Check seed
  if (!gameState.seed || typeof gameState.seed !== 'string') {
    issues.push('Missing or invalid seed');
  } else {
    canRecover = true;
    recoveredState.seed = gameState.seed;
  }

  // Check boards
  if (!gameState.initialBoard || !Array.isArray(gameState.initialBoard)) {
    issues.push('Missing or invalid initial board');
  } else {
    recoveredState.initialBoard = gameState.initialBoard;
  }

  if (!gameState.board || !Array.isArray(gameState.board)) {
    issues.push('Missing or invalid current board');
    // Try to recover from initial board
    if (gameState.initialBoard) {
      recoveredState.board = JSON.parse(JSON.stringify(gameState.initialBoard));
      issues.push('Recovered current board from initial board');
    }
  } else {
    recoveredState.board = gameState.board;
  }

  // Check game data
  if (!Array.isArray(gameState.usedWords)) {
    issues.push('Missing or invalid used words array');
    recoveredState.usedWords = [];
  } else {
    recoveredState.usedWords = gameState.usedWords;
  }

  if (typeof gameState.score !== 'number') {
    issues.push('Missing or invalid score');
    recoveredState.score = 0;
  } else {
    recoveredState.score = gameState.score;
  }

  if (typeof gameState.movesUsed !== 'number') {
    issues.push('Missing or invalid moves count');
    recoveredState.movesUsed = 0;
  } else {
    recoveredState.movesUsed = gameState.movesUsed;
  }

  // Check other required fields
  recoveredState.specialTiles = Array.isArray(gameState.specialTiles) ? gameState.specialTiles : [];
  recoveredState.unlocked = Array.isArray(gameState.unlocked) ? gameState.unlocked : [];
  recoveredState.streak = typeof gameState.streak === 'number' ? gameState.streak : 0;
  recoveredState.gameOver = Boolean(gameState.gameOver);
  recoveredState.finalGrade = gameState.finalGrade || null;
  recoveredState.lastWordTiles = gameState.lastWordTiles;
  recoveredState.benchmarks = gameState.benchmarks;
  recoveredState.discoverableCount = gameState.discoverableCount;
  recoveredState.boardAnalysis = gameState.boardAnalysis;

  const isValid = issues.length === 0;
  const hasRequiredFields = recoveredState.seed && 
                           recoveredState.initialBoard && 
                           recoveredState.board &&
                           Array.isArray(recoveredState.usedWords);

  return {
    isValid,
    canRecover: canRecover && hasRequiredFields,
    issues,
    recoveredState: hasRequiredFields ? recoveredState as DailyChallengeGameState : undefined
  };
}