import type { BoardAnalysis } from './benchmarks';

export interface LetterDistribution {
  [letter: string]: number;
}

export interface DetailedBoardAnalysis extends BoardAnalysis {
  gridSize: number;
  totalLetters: number;
  uniqueLetters: number;
  vowelRatio: number;
  commonLetterRatio: number;
  difficultyScore: number;
}

// Letter frequency in English (approximate)
const COMMON_LETTERS = new Set(['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S']);
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export function analyzeBoardComposition(board: string[][]): DetailedBoardAnalysis {
  const gridSize = board.length;
  const totalLetters = gridSize * gridSize;
  const letterCounts: LetterDistribution = {};
  
  // Count letter frequencies
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const letter = board[row][col].toUpperCase();
      letterCounts[letter] = (letterCounts[letter] || 0) + 1;
    }
  }
  
  const uniqueLetters = Object.keys(letterCounts).length;
  
  // Calculate vowel ratio
  let vowelCount = 0;
  let commonLetterCount = 0;
  
  for (const [letter, count] of Object.entries(letterCounts)) {
    if (VOWELS.has(letter)) {
      vowelCount += count;
    }
    if (COMMON_LETTERS.has(letter)) {
      commonLetterCount += count;
    }
  }
  
  const vowelRatio = vowelCount / totalLetters;
  const commonLetterRatio = commonLetterCount / totalLetters;
  
  // Calculate connectivity score (how well letters can connect)
  const connectivityScore = calculateConnectivityScore(board, letterCounts);
  
  // Calculate rarity score potential
  const rarityScorePotential = calculateRarityScore(letterCounts, totalLetters);
  
  // Calculate average word length potential
  const avgWordLength = estimateAverageWordLength(board, letterCounts);
  
  // Estimate maximum score potential
  const maxScorePotential = estimateMaxScorePotential(board, letterCounts);
  
  // Calculate overall difficulty score
  const difficultyScore = calculateDifficultyScore({
    vowelRatio,
    commonLetterRatio,
    uniqueLetters,
    totalLetters,
    connectivityScore,
    rarityScorePotential
  });
  
  return {
    gridSize,
    totalLetters,
    uniqueLetters,
    vowelRatio,
    commonLetterRatio,
    connectivityScore,
    rarityScorePotential,
    avgWordLength,
    maxScorePotential,
    letterDistribution: new Map(Object.entries(letterCounts)),
    difficultyScore
  };
}

function calculateConnectivityScore(board: string[][], letterCounts: LetterDistribution): number {
  const gridSize = board.length;
  let totalConnections = 0;
  let favorableConnections = 0;
  
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const currentLetter = board[row][col].toUpperCase();
      
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
          totalConnections++;
          const neighborLetter = board[newRow][newCol].toUpperCase();
          
          // Favorable connections: vowel-consonant pairs, common letter combinations
          if ((VOWELS.has(currentLetter) && !VOWELS.has(neighborLetter)) ||
              (!VOWELS.has(currentLetter) && VOWELS.has(neighborLetter))) {
            favorableConnections++;
          }
          
          // Boost for common letter pairs
          const pair = currentLetter + neighborLetter;
          if (isCommonLetterPair(pair)) {
            favorableConnections += 0.5;
          }
        }
      }
    }
  }
  
  return totalConnections > 0 ? (favorableConnections / totalConnections) * 100 : 0;
}

function calculateRarityScore(letterCounts: LetterDistribution, totalLetters: number): number {
  // Score based on presence of less common letters
  const rareLetters = new Set(['Q', 'X', 'Z', 'J', 'K', 'V', 'W', 'Y']);
  const uncommonLetters = new Set(['B', 'C', 'F', 'G', 'H', 'M', 'P']);
  
  let rarityScore = 0;
  
  for (const [letter, count] of Object.entries(letterCounts)) {
    const frequency = count / totalLetters;
    
    if (rareLetters.has(letter)) {
      rarityScore += frequency * 300; // High bonus for rare letters
    } else if (uncommonLetters.has(letter)) {
      rarityScore += frequency * 150; // Medium bonus for uncommon letters
    } else if (COMMON_LETTERS.has(letter)) {
      rarityScore += frequency * 50;  // Small bonus for common letters
    }
  }
  
  return Math.min(rarityScore, 1000); // Cap at 1000
}

function estimateAverageWordLength(board: string[][], letterCounts: LetterDistribution): number {
  // Estimate based on grid size and letter distribution
  const gridSize = board.length;
  const uniqueLetters = Object.keys(letterCounts).length;
  
  // More unique letters and larger grids tend to support longer words
  const baseLength = 3.5; // Average minimum word length
  const uniquenessBonus = (uniqueLetters / (gridSize * gridSize)) * 2;
  const sizeBonus = gridSize > 4 ? (gridSize - 4) * 0.3 : 0;
  
  return Math.min(baseLength + uniquenessBonus + sizeBonus, 8); // Cap at reasonable maximum
}

function estimateMaxScorePotential(board: string[][], letterCounts: LetterDistribution): number {
  const gridSize = board.length;
  const totalLetters = gridSize * gridSize;
  
  // Base scoring potential
  let potential = 0;
  
  // Letter values (simplified Scrabble-like scoring)
  const letterValues: { [key: string]: number } = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10
  };
  
  // Calculate potential based on letter values and estimated word formation
  for (const [letter, count] of Object.entries(letterCounts)) {
    const value = letterValues[letter] || 1;
    potential += count * value * 50; // Base multiplier for word formation
  }
  
  // Grid size multiplier
  const gridMultiplier = gridSize <= 4 ? 1.0 : gridSize <= 6 ? 1.5 : 2.0;
  
  return Math.round(potential * gridMultiplier);
}

function calculateDifficultyScore(params: {
  vowelRatio: number;
  commonLetterRatio: number;
  uniqueLetters: number;
  totalLetters: number;
  connectivityScore: number;
  rarityScorePotential: number;
}): number {
  // Optimal vowel ratio is around 0.35-0.45
  const vowelScore = Math.abs(params.vowelRatio - 0.4) * 100;
  
  // Common letters should be balanced
  const commonScore = Math.abs(params.commonLetterRatio - 0.6) * 50;
  
  // Letter diversity score
  const diversityScore = (params.uniqueLetters / params.totalLetters) * 100;
  
  // Connectivity affects difficulty
  const connectivityScore = 100 - params.connectivityScore;
  
  // Rarity makes it harder
  const rarityScore = params.rarityScorePotential / 10;
  
  // Lower scores = easier, higher scores = harder
  const totalDifficulty = vowelScore + commonScore + connectivityScore + rarityScore - diversityScore;
  
  return Math.max(0, Math.min(100, totalDifficulty));
}

function isCommonLetterPair(pair: string): boolean {
  const commonPairs = new Set([
    'TH', 'HE', 'IN', 'ER', 'AN', 'RE', 'ED', 'ND', 'ON', 'EN',
    'AT', 'OU', 'IT', 'ES', 'TE', 'OR', 'TI', 'HI', 'AS', 'TO',
    'ST', 'NG', 'SE', 'HA', 'VE', 'DE', 'OF', 'LE', 'CO', 'NT'
  ]);
  
  return commonPairs.has(pair) || commonPairs.has(pair.split('').reverse().join(''));
}

export function createBoardAnalysisForBenchmarks(analysis: DetailedBoardAnalysis): BoardAnalysis {
  return {
    rarityScorePotential: analysis.rarityScorePotential,
    avgWordLength: analysis.avgWordLength,
    connectivityScore: analysis.connectivityScore,
    letterDistribution: analysis.letterDistribution,
    maxScorePotential: analysis.maxScorePotential
  };
}