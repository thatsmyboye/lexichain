/**
 * Puzzle Mode Definitions
 * Pre-designed board layouts with specific word requirements
 */

export interface PuzzleDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  board: string[][]; // Pre-designed board layout
  requiredWords: string[]; // Words that must be found (in any order)
  maxMoves: number; // Maximum moves allowed
  perfectSolution?: {
    // Optional: exact sequence of words for perfect solution
    words: string[];
    score?: number;
  };
}

export const PUZZLE_DEFINITIONS: PuzzleDefinition[] = [
  {
    id: 'puzzle-001',
    name: 'Word Chain Basics',
    description: 'Find all 5 required words. Connect them in a chain!',
    difficulty: 'Easy',
    board: [
      ['C', 'A', 'T', 'S'],
      ['R', 'E', 'D', 'O'],
      ['B', 'I', 'G', 'N'],
      ['T', 'O', 'P', 'S']
    ],
    requiredWords: ['CAT', 'RED', 'BIG', 'TOP', 'SON'],
    maxMoves: 10,
    perfectSolution: {
      words: ['CAT', 'RED', 'BIG', 'TOP', 'SON'],
      score: 1500
    }
  },
  {
    id: 'puzzle-002',
    name: 'Letter Links',
    description: 'Use shared tiles to chain these 4 words together.',
    difficulty: 'Medium',
    board: [
      ['W', 'O', 'R', 'D'],
      ['L', 'I', 'N', 'K'],
      ['P', 'A', 'T', 'H'],
      ['G', 'A', 'M', 'E']
    ],
    requiredWords: ['WORD', 'LINK', 'PATH', 'GAME'],
    maxMoves: 8,
    perfectSolution: {
      words: ['WORD', 'LINK', 'PATH', 'GAME'],
      score: 2200
    }
  },
  {
    id: 'puzzle-003',
    name: 'The Challenge',
    description: 'A tougher puzzle requiring precise word order.',
    difficulty: 'Hard',
    board: [
      ['S', 'T', 'A', 'R'],
      ['T', 'I', 'M', 'E'],
      ['R', 'A', 'T', 'E'],
      ['E', 'A', 'S', 'T']
    ],
    requiredWords: ['STAR', 'TIME', 'RATE', 'EAST', 'TEAM'],
    maxMoves: 12,
    perfectSolution: {
      words: ['STAR', 'TIME', 'RATE', 'EAST', 'TEAM'],
      score: 3500
    }
  },
  {
    id: 'puzzle-004',
    name: 'Expert Challenge',
    description: 'Master this complex word chain in limited moves!',
    difficulty: 'Expert',
    board: [
      ['B', 'R', 'E', 'A', 'K'],
      ['R', 'E', 'A', 'D', 'Y'],
      ['E', 'A', 'R', 'T', 'H'],
      ['A', 'R', 'T', 'S', 'Y'],
      ['K', 'Y', 'H', 'Y', 'N']
    ],
    requiredWords: ['BREAK', 'READY', 'EARTH', 'ARTSY', 'BRED'],
    maxMoves: 15,
    perfectSolution: {
      words: ['BREAK', 'READY', 'EARTH', 'ARTSY', 'BRED'],
      score: 5000
    }
  },
  {
    id: 'puzzle-005',
    name: 'Vowel Voyage',
    description: 'Navigate through vowels to complete this chain.',
    difficulty: 'Medium',
    board: [
      ['V', 'O', 'W', 'E', 'L'],
      ['O', 'C', 'E', 'A', 'N'],
      ['W', 'E', 'S', 'T', 'S'],
      ['E', 'A', 'S', 'T', 'S'],
      ['L', 'N', 'S', 'S', 'T']
    ],
    requiredWords: ['VOWEL', 'OCEAN', 'WEST', 'EAST', 'LEAST'],
    maxMoves: 12,
  },
  {
    id: 'puzzle-006',
    name: 'Quick Chain',
    description: 'Fast-paced puzzle with a tight move limit.',
    difficulty: 'Hard',
    board: [
      ['Q', 'U', 'I', 'C', 'K'],
      ['U', 'N', 'I', 'T', 'E'],
      ['I', 'T', 'E', 'M', 'S'],
      ['C', 'T', 'M', 'E', 'S'],
      ['K', 'E', 'S', 'S', 'T']
    ],
    requiredWords: ['QUICK', 'UNITE', 'ITEMS', 'TEAM', 'QUIT'],
    maxMoves: 10,
  }
];

/**
 * Get a random puzzle by difficulty
 */
export function getRandomPuzzle(difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert'): PuzzleDefinition {
  const puzzles = difficulty 
    ? PUZZLE_DEFINITIONS.filter(p => p.difficulty === difficulty)
    : PUZZLE_DEFINITIONS;
  
  if (puzzles.length === 0) {
    return PUZZLE_DEFINITIONS[0]; // Fallback to first puzzle
  }
  
  return puzzles[Math.floor(Math.random() * puzzles.length)];
}

/**
 * Get a puzzle by ID
 */
export function getPuzzleById(id: string): PuzzleDefinition | undefined {
  return PUZZLE_DEFINITIONS.find(p => p.id === id);
}

/**
 * Get the next puzzle after completing one
 */
export function getNextPuzzle(currentPuzzleId: string): PuzzleDefinition | null {
  const currentIndex = PUZZLE_DEFINITIONS.findIndex(p => p.id === currentPuzzleId);
  if (currentIndex === -1 || currentIndex === PUZZLE_DEFINITIONS.length - 1) {
    return null; // No next puzzle
  }
  return PUZZLE_DEFINITIONS[currentIndex + 1];
}

