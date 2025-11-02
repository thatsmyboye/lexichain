// Pre-designed puzzle boards for Puzzle Mode
// Each puzzle has a specific layout, required words, and limited moves

export interface PuzzleBoard {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  board: string[][];
  requiredWords: string[];
  optionalWords?: string[]; // Bonus words for extra points
  maxMoves: number;
  hint?: string;
  xpReward: number;
}

export const PUZZLE_BOARDS: PuzzleBoard[] = [
  {
    id: 'puzzle_1',
    name: 'Word Basics',
    difficulty: 'easy',
    board: [
      ['C', 'A', 'T', 'S'],
      ['R', 'A', 'T', 'E'],
      ['A', 'T', 'E', 'S'],
      ['B', 'A', 'T', 'H']
    ],
    requiredWords: ['CAT', 'RAT', 'BAT', 'RATE', 'BATH'],
    optionalWords: ['CATS', 'ATE', 'EATS'],
    maxMoves: 8,
    hint: 'Find all the common 3-letter words first',
    xpReward: 50
  },
  {
    id: 'puzzle_2',
    name: 'Corner Challenge',
    difficulty: 'easy',
    board: [
      ['S', 'T', 'O', 'P'],
      ['P', 'O', 'T', 'S'],
      ['O', 'P', 'S', 'T'],
      ['T', 'S', 'P', 'O']
    ],
    requiredWords: ['STOP', 'POTS', 'SPOT', 'TOPS'],
    optionalWords: ['POT', 'OPT', 'SOP'],
    maxMoves: 7,
    hint: 'Look for 4-letter words in all directions',
    xpReward: 60
  },
  {
    id: 'puzzle_3',
    name: 'Vowel Hunt',
    difficulty: 'medium',
    board: [
      ['R', 'E', 'A', 'D'],
      ['E', 'A', 'R', 'S'],
      ['A', 'R', 'E', 'A'],
      ['D', 'E', 'A', 'R']
    ],
    requiredWords: ['READ', 'DEAR', 'EARS', 'AREA'],
    optionalWords: ['ARE', 'EAR', 'ERA', 'RED'],
    maxMoves: 8,
    hint: 'Multiple vowels make longer words easier',
    xpReward: 75
  },
  {
    id: 'puzzle_4',
    name: 'Snake Path',
    difficulty: 'medium',
    board: [
      ['G', 'R', 'O', 'W'],
      ['R', 'O', 'W', 'N'],
      ['O', 'W', 'N', 'S'],
      ['W', 'O', 'R', 'D']
    ],
    requiredWords: ['GROW', 'GROWN', 'WORD', 'OWNS'],
    optionalWords: ['ROW', 'OWN', 'OWS'],
    maxMoves: 7,
    hint: 'Some words share common paths',
    xpReward: 80
  },
  {
    id: 'puzzle_5',
    name: 'Letter Cluster',
    difficulty: 'medium',
    board: [
      ['T', 'R', 'I', 'P'],
      ['R', 'I', 'P', 'S'],
      ['I', 'P', 'S', 'T'],
      ['P', 'I', 'T', 'S']
    ],
    requiredWords: ['TRIP', 'RIPS', 'PITS', 'TIPS'],
    optionalWords: ['RIP', 'TIP', 'SIT', 'PIT'],
    maxMoves: 8,
    hint: 'Center letters are key to most words',
    xpReward: 85
  },
  {
    id: 'puzzle_6',
    name: 'Double Trouble',
    difficulty: 'hard',
    board: [
      ['B', 'O', 'O', 'K'],
      ['O', 'O', 'K', 'S'],
      ['O', 'K', 'S', 'L'],
      ['K', 'E', 'E', 'P']
    ],
    requiredWords: ['BOOK', 'BOOKS', 'KEEP', 'LOOKS'],
    optionalWords: ['BOOK', 'LOOK', 'PEEK'],
    maxMoves: 6,
    hint: 'Double letters can be tricky to connect',
    xpReward: 100
  },
  {
    id: 'puzzle_7',
    name: 'Cross Words',
    difficulty: 'hard',
    board: [
      ['F', 'L', 'O', 'W'],
      ['L', 'O', 'W', 'S'],
      ['O', 'W', 'L', 'S'],
      ['W', 'O', 'R', 'D']
    ],
    requiredWords: ['FLOW', 'FLOWS', 'OWLS', 'WORD'],
    optionalWords: ['LOW', 'OWL', 'ROW'],
    maxMoves: 7,
    hint: 'Words can intersect at multiple points',
    xpReward: 110
  },
  {
    id: 'puzzle_8',
    name: 'Spiral Search',
    difficulty: 'hard',
    board: [
      ['S', 'P', 'I', 'N'],
      ['P', 'I', 'N', 'S'],
      ['I', 'N', 'K', 'S'],
      ['N', 'K', 'I', 'T']
    ],
    requiredWords: ['SPIN', 'PINS', 'INKS', 'KNIT'],
    optionalWords: ['PIN', 'INK', 'KIT', 'SIN'],
    maxMoves: 8,
    hint: 'Follow the spiral pattern outward',
    xpReward: 120
  },
  {
    id: 'puzzle_9',
    name: 'Expert Maze',
    difficulty: 'expert',
    board: [
      ['C', 'R', 'O', 'W'],
      ['R', 'O', 'W', 'N'],
      ['O', 'W', 'N', 'S'],
      ['W', 'O', 'R', 'D']
    ],
    requiredWords: ['CROWN', 'CROWNS', 'WORD', 'OWNS', 'GROWN'],
    optionalWords: ['CROW', 'ROW', 'OWN'],
    maxMoves: 7,
    hint: 'Long words require careful planning',
    xpReward: 150
  },
  {
    id: 'puzzle_10',
    name: 'Master Puzzle',
    difficulty: 'expert',
    board: [
      ['S', 'T', 'R', 'E'],
      ['T', 'R', 'E', 'A'],
      ['R', 'E', 'A', 'M'],
      ['E', 'A', 'M', 'S']
    ],
    requiredWords: ['STREAM', 'MASTER', 'DREAM', 'REAMS', 'TEAMS'],
    optionalWords: ['STARE', 'STEAM', 'TRAMS'],
    maxMoves: 8,
    hint: 'Every letter connects to create long words',
    xpReward: 200
  }
];

export function getPuzzleById(id: string): PuzzleBoard | undefined {
  return PUZZLE_BOARDS.find(p => p.id === id);
}

export function getPuzzlesByDifficulty(difficulty: 'easy' | 'medium' | 'hard' | 'expert'): PuzzleBoard[] {
  return PUZZLE_BOARDS.filter(p => p.difficulty === difficulty);
}

export function getNextPuzzle(currentId: string): PuzzleBoard | undefined {
  const currentIndex = PUZZLE_BOARDS.findIndex(p => p.id === currentId);
  if (currentIndex >= 0 && currentIndex < PUZZLE_BOARDS.length - 1) {
    return PUZZLE_BOARDS[currentIndex + 1];
  }
  return undefined;
}
