// Pure game engine for Lexichain: board generation, word probing, scoring,
// and special-tile effects. Extracted from WordPathGame.tsx — all functions
// here are UI-free and operate purely on their arguments.
import { toast } from "sonner";
import type { Pos, SpecialTile, SpecialTileType } from "@/types/game";
import type { BoardAnalysis } from "@/lib/benchmarks";
import { LETTERS, letterRarity } from "@/lib/letterRarity";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";
import { getDailyChallengeDate } from "@/utils/dateUtils";

export const SHARE_URL = "lexichain.banton-digital.com";
export const keyOf = (p: Pos) => `${p.r},${p.c}`;
export const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
export const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) <= 1;
export type GameMode = "classic" | "target" | "daily" | "daily_5x5" | "practice" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
export type GameSettings = {
  scoreThreshold: number;
  mode: GameMode;
  targetTier: "bronze" | "silver" | "gold" | "platinum";
  difficulty: "easy" | "medium" | "hard" | "expert";
  gridSize: number;
  dailyMovesLimit: number;
};

// LETTERS is imported from @/lib/letterRarity
export function randomLetter() {
  const total = LETTERS.reduce((a, [, f]) => a + f, 0);
  let x = Math.random() * total;
  for (const [ch, f] of LETTERS) {
    if ((x -= f) <= 0) return ch;
  }
  return "E";
}
export function constrainedRandomLetter(letterCounts: Map<string, number>, seed?: string, seedCounter?: number) {
  const maxLetterInstances = 4;
  const maxAttempts = 50; // Prevent infinite loops

  // For seeded generation, try different seed variations deterministically
  for (let seedVariation = 0; seedVariation < maxAttempts; seedVariation++) {
    let letter: string;
    if (seed && seedCounter !== undefined) {
      // Use position-based seed variation instead of attempts
      const rng = seedRandom(seed + seedCounter + seedVariation);
      letter = seededRandomLetter(rng);
    } else {
      letter = randomLetter();
    }
    const currentCount = letterCounts.get(letter) || 0;
    if (currentCount < maxLetterInstances) {
      letterCounts.set(letter, currentCount + 1);
      return letter;
    }
  }

  // Deterministic fallback: find the first available letter in frequency order
  for (const [letter] of LETTERS) {
    const currentCount = letterCounts.get(letter) || 0;
    if (currentCount < maxLetterInstances) {
      letterCounts.set(letter, currentCount + 1);
      return letter;
    }
  }

  // Ultimate fallback (shouldn't happen with proper grid sizes)
  return "E";
}
export function getAdjacentPositions(pos: Pos, size: number): Pos[] {
  const adjacent: Pos[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue; // Skip the center position
      const newR = pos.r + dr;
      const newC = pos.c + dc;
      if (within(newR, newC, size)) {
        adjacent.push({
          r: newR,
          c: newC
        });
      }
    }
  }
  return adjacent;
}

// Centralized Q-U adjacency validation and fixing function
export function validateAndFixQUAdjacency(
  board: string[][], 
  size: number, 
  letterCounts?: Map<string, number>,
  seed?: string,
  debugMode: boolean = false
): { board: string[][], violations: number, details: string[] } {
  const newBoard = board.map(row => [...row]);
  const workingLetterCounts = letterCounts || new Map<string, number>();
  let violations = 0;
  const details: string[] = [];

  // If no letter counts provided, calculate them
  if (!letterCounts) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const letter = newBoard[r][c];
        workingLetterCounts.set(letter, (workingLetterCounts.get(letter) || 0) + 1);
      }
    }
  }

  // Check all Q tiles for adjacent U tiles
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (newBoard[r][c] === 'Q') {
        const adjacentPositions = getAdjacentPositions({ r, c }, size);
        const hasAdjacentU = adjacentPositions.some(pos => newBoard[pos.r][pos.c] === 'U');
        
        if (!hasAdjacentU) {
          violations++;
          const oldLetter = newBoard[r][c];
          workingLetterCounts.set(oldLetter, (workingLetterCounts.get(oldLetter) || 0) - 1);
          
          // Find replacement letter (avoid Q and respect max count constraints)
          let newLetter;
          let attempts = 0;
          do {
            if (seed && attempts < 10) {
              const rng = seedRandom(seed + r + c + "qfix" + attempts);
              newLetter = seededRandomLetter(rng);
            } else {
              newLetter = randomLetter();
            }
            attempts++;
          } while ((newLetter === 'Q' || (workingLetterCounts.get(newLetter) || 0) >= 4) && attempts < 50);
          
          // Fallback to common letters if still no valid option
          if (attempts >= 50) {
            const fallbackLetters = ['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S'];
            newLetter = fallbackLetters.find(letter => 
              (workingLetterCounts.get(letter) || 0) < 4
            ) || 'E';
          }
          
          workingLetterCounts.set(newLetter, (workingLetterCounts.get(newLetter) || 0) + 1);
          newBoard[r][c] = newLetter;
          
          const detail = `Q at (${r},${c}) replaced with ${newLetter} - no adjacent U`;
          details.push(detail);
          
          if (debugMode) {
            console.log(`Q-U Validation: ${detail}`);
          }
        }
      }
    }
  }

  return { board: newBoard, violations, details };
}
export function makeBoard(size: number, seed?: string) {
  const letterCounts = new Map<string, number>();
  let board: string[][];
  if (seed) {
    // Use seeded random for daily challenge
    board = Array.from({
      length: size
    }, (_, r) => Array.from({
      length: size
    }, (_, c) => constrainedRandomLetter(letterCounts, seed, r * size + c)));
  } else {
    board = Array.from({
      length: size
    }, () => Array.from({
      length: size
    }, () => constrainedRandomLetter(letterCounts)));
  }

  // Use centralized Q-U adjacency validation
  const validation = validateAndFixQUAdjacency(board, size, letterCounts, seed, false);
  return validation.board;
}

// Seeded random number generator
export function seedRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return function () {
    hash = Math.imul(hash, 0x9e3779b9);
    hash = hash ^ hash >>> 16;
    return (hash >>> 0) / 0x100000000;
  };
}
export function seededRandomLetter(rng: () => number) {
  const total = LETTERS.reduce((a, [, f]) => a + f, 0);
  let x = rng() * total;
  for (const [ch, f] of LETTERS) {
    if ((x -= f) <= 0) return ch;
  }
  return "E";
}
export function getDailySeed(): string {
  // Use the centralized date utility for consistency
  return getDailyChallengeDate();
}
export function getDailyMovesLimit(): number {
  // Fixed at 10 moves for Daily Challenge
  return 10;
}
export function binaryHasPrefix(sortedWords: string[], prefix: string) {
  let lo = 0,
    hi = sortedWords.length;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    const v = sortedWords[mid];
    if (v < prefix) lo = mid + 1;else hi = mid;
  }
  if (lo >= sortedWords.length) return false;
  return sortedWords[lo].startsWith(prefix);
}

// --- Solvability heuristic helpers & constants ---
export const K_MIN_WORDS = 12;
export const TARGET_VOWEL_MIN = 0.35;
export const TARGET_VOWEL_MAX = 0.55;
export const RESPAWN_COUNT = 3;
export const MUTATION_ROUNDS = 4;
export const MAX_ATTEMPTS = 8;
export const MAX_DFS_NODES = 30000;
export const VOWELS = new Set(["A", "E", "I", "O", "U", "Y"]);
export const VOWEL_POOL = LETTERS.filter(([ch]) => VOWELS.has(ch));
export const CONSONANT_POOL = LETTERS.filter(([ch]) => !VOWELS.has(ch));

// Special tiles constants
export const SPECIAL_TILE_RARITIES = {
  stone: 0.15,
  wild: 0.05,
  xfactor: 0.08,
  multiplier: 0.12,
  shuffle: 0.03,
};

// Enhanced powerups tile rarities (used when toggle is on and mode is not daily)
export const ENHANCED_TILE_RARITIES: Record<string, number> = {
  stone: 0.15,
  multiplier: 0.12,
  xfactor: 0.08,
  tax: 0.08,
  decay: 0.07,
  freeze: 0.06,
  wild: 0.05,
  magnet: 0.05,
  chain: 0.05,
  mirror: 0.04,
  bomb: 0.04,
  shuffle: 0.03,
  ghost: 0.03,
};

export function isEnhancedPowerupsEnabled(): boolean {
  return localStorage.getItem('lexichain-enhanced-powerups') === 'true';
}

// Common low-value letters used by Decay and Magnet effects
export const LOW_VALUE_LETTERS = ["A", "E", "I", "O", "U", "S", "T", "N", "R"];
export const MAGNET_VOWELS = ["A", "E", "I", "O", "U"];

// letterRarity is imported from @/lib/letterRarity
export type ScoreBreakdown = {
  base: number;
  rarity: {
    sum: number;
    ultraCount: number;
    bonus: number;
  };
  linkBonus: number;
  linkMultiplier: number;
  lengthBonus: number;
  multipliers: {
    tileMultiplier: number;
    consumableMultiplier: number;
    combinedApplied: number;
    capped: boolean;
    cap: number;
  };
  totalBeforeMultipliers: number;
  total: number;
};
// Multiplier cap removed - multipliers can now stack without limit
export function computeScoreBreakdown(params: {
  actualWord: string;
  wordPath: Pos[];
  board: string[][];
  specialTiles: SpecialTile[][];
  lastWordTiles: Set<string>;
  streak: number;
  mode: "classic" | "daily" | "daily_5x5" | "target" | "practice" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
  timeAttackSpeedMultiplier?: number;
  activeEffects: Array<{
    id: string;
    data?: Record<string, unknown>;
  }>;
  baseMode?: "hybrid" | "square";
}): ScoreBreakdown {
  const {
    actualWord,
    wordPath,
    board,
    specialTiles,
    lastWordTiles,
    streak,
    mode,
    timeAttackSpeedMultiplier = 1.0,
    activeEffects,
    baseMode = "hybrid"
  } = params;
  const wordLen = actualWord.length;
  // NEW: Enhanced word length scoring - quadratic emphasis on length
  const base = baseMode === "hybrid" ? wordLen * wordLen * 4 + wordLen * 12 : wordLen * wordLen;
  let tileMultiplier = 1;
  for (const p of wordPath) {
    const tile = specialTiles[p.r][p.c];
    if (tile.type === "multiplier" && tile.value) tileMultiplier *= tile.value;
  }
  const sharedTilesCount = lastWordTiles.size ? wordPath.filter(p => lastWordTiles.has(keyOf(p))).length : 0;

  // NEW: Multiplicative link bonus with diminishing returns
  const linkMultiplier = 1 + sharedTilesCount * 0.15 / (1 + sharedTilesCount * 0.05);
  const linkBonus = 0; // Keep for backward compatibility in UI

  // Calculate rarity based on actual letters in the word (respecting ghost and mirror tiles)
  const actualLetters: string[] = [];
  for (let i = 0; i < wordPath.length; i++) {
    const p = wordPath[i];
    const tile = specialTiles[p.r][p.c];
    if (tile.type === "ghost") continue; // Ghost contributes no letter
    if (tile.type === "mirror") {
      if (actualLetters.length > 0) {
        actualLetters.push(actualLetters[actualLetters.length - 1]); // Copy previous letter
      }
      // If no previous letter exists, mirror contributes nothing
    } else {
      actualLetters.push(board[p.r][p.c]);
    }
  }
  const raritySum = actualLetters.reduce((acc, letter) => acc + letterRarity(letter), 0);
  const ultraRareCount = actualLetters.reduce((acc, letter) => acc + (["J", "Q", "X", "Z"].includes(letter.toUpperCase()) ? 1 : 0), 0);

  // NEW: Percentage-based rarity system
  const rarityBonus = Math.round(base * (raritySum * 0.08)) + Math.round(base * (ultraRareCount * 0.12));

  // NEW: Length-based bonus system (replaces streak-based chain bonus)
  let lengthBonus = 0;
  if (wordLen >= 5) lengthBonus += 25;
  if (wordLen >= 6) lengthBonus += 50;
  if (wordLen >= 7) lengthBonus += 100;
  if (wordLen >= 8) lengthBonus += 150;

  // Chain tile: +10 per tile in path beyond 4, per chain tile
  const chainTilesInPath = wordPath.filter(p => specialTiles[p.r][p.c].type === "chain").length;
  let chainBonus = 0;
  if (chainTilesInPath > 0 && wordPath.length > 4) {
    chainBonus = (wordPath.length - 4) * 10 * chainTilesInPath;
  }

  // Tax tile: 0.7x per tax tile (applied after all multipliers)
  const taxTilesInPath = wordPath.filter(p => specialTiles[p.r][p.c].type === "tax").length;
  const taxMultiplier = taxTilesInPath > 0 ? Math.pow(0.7, taxTilesInPath) : 1;

  const scoreMultiplierEffect = activeEffects.find(e => e.id === "score_multiplier");
  let consumableMultiplier = 1;
  if (scoreMultiplierEffect && typeof scoreMultiplierEffect.data?.multiplier === "number") {
    consumableMultiplier = scoreMultiplierEffect.data.multiplier as number;
  }
  
  // Mode-specific multipliers
  let modeMultiplier = 1;
  switch (mode) {
    case "time_attack":
      // Base 1.2x multiplier + speed multiplier (which increases with words found)
      modeMultiplier = 1.2 * timeAttackSpeedMultiplier;
      break;
    case "endless":
      modeMultiplier = 1.5;
      break;
    case "puzzle":
      modeMultiplier = 2.0;
      break;
    case "survival":
      modeMultiplier = 1.8;
      break;
    case "zen":
      modeMultiplier = 0.5;
      break;
    default:
      modeMultiplier = 1;
  }
  
  const combinedMultiplierRaw = tileMultiplier * consumableMultiplier * modeMultiplier;
  const combinedApplied = combinedMultiplierRaw; // No cap - multipliers stack freely
  const capped = false;
  const totalBeforeMultipliers = Math.round((base + rarityBonus + lengthBonus + chainBonus) * linkMultiplier);
  const total = Math.round(totalBeforeMultipliers * combinedApplied * taxMultiplier);
  return {
    base,
    rarity: {
      sum: raritySum,
      ultraCount: ultraRareCount,
      bonus: rarityBonus
    },
    linkBonus,
    linkMultiplier,
    lengthBonus,
    multipliers: {
      tileMultiplier,
      consumableMultiplier,
    combinedApplied,
    capped,
    cap: null
    },
    totalBeforeMultipliers,
    total
  };
}
export function pickWeighted(pool: Array<[string, number]>) {
  const total = pool.reduce((a, [, f]) => a + f, 0);
  let x = Math.random() * total;
  for (const [ch, f] of pool) {
    if ((x -= f) <= 0) return ch;
  }
  return pool[0]?.[0] ?? "E";
}
export function randomVowelWeighted() {
  return pickWeighted(VOWEL_POOL);
}
export function randomConsonantWeighted() {
  return pickWeighted(CONSONANT_POOL);
}
export function isVowel(ch: string) {
  return VOWELS.has(ch.toUpperCase());
}
export function countVowelRatio(grid: string[][]) {
  let v = 0,
    t = 0;
  for (const row of grid) for (const ch of row) {
    t++;
    if (isVowel(ch)) v++;
  }
  return t ? v / t : 0.5;
}
export type ProbeResult = {
  words: Set<string>;
  linkFound: boolean;
  usage: Map<string, number>;
  analysis?: BoardAnalysis;
};
export function probeGrid(grid: string[][], wordSet: Set<string>, sortedArr: string[], K: number, maxNodes: number, includeAnalysis: boolean = false): ProbeResult {
  const N = grid.length;
  let nodes = 0;
  const words = new Set<string>();
  const usage = new Map<string, number>();
  let linkFound = false;
  const pathSets: Array<Set<string>> = [];
  const dirs = [-1, 0, 1];

  // Analysis tracking
  const letterFreq = new Map<string, number>();
  let totalWordLength = 0;
  let totalRarityScore = 0;

  // Initialize letter frequency map for the board
  if (includeAnalysis) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const letter = grid[r][c].toLowerCase();
        letterFreq.set(letter, (letterFreq.get(letter) || 0) + 1);
      }
    }
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const stack: {
      pos: Pos;
      path: Pos[];
      word: string;
    }[] = [{
      pos: {
        r,
        c
      },
      path: [],
      word: ""
    }];
    while (stack.length) {
      const cur = stack.pop()!;
      const {
        pos,
        path: pp,
        word
      } = cur;
      if (pp.find(p => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      nodes++;
      if (nodes > maxNodes) {
        return includeAnalysis ? {
          words,
          linkFound,
          usage,
          analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, totalRarityScore)
        } : {
          words,
          linkFound,
          usage
        };
      }
      if (nextWord.length >= 3 && wordSet.has(nextWord)) {
        if (!words.has(nextWord)) {
          words.add(nextWord);
          const set = new Set(nextPath.map(keyOf));
          for (const kk of set) usage.set(kk, (usage.get(kk) ?? 0) + 1);

          // Analysis calculations
          if (includeAnalysis) {
            totalWordLength += nextWord.length;
            totalRarityScore += getRarityScore(nextWord);
          }
          for (const s of pathSets) {
            let overlaps = false;
            for (const kk of set) {
              if (s.has(kk)) {
                overlaps = true;
                break;
              }
            }
            if (overlaps) {
              linkFound = true;
              break;
            }
          }
          pathSets.push(set);
          if (words.size >= K && linkFound) {
            return includeAnalysis ? {
              words,
              linkFound,
              usage,
              analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, totalRarityScore)
            } : {
              words,
              linkFound,
              usage
            };
          }
        }
      }
      if (!binaryHasPrefix(sortedArr, nextWord)) continue;
      for (const dr of dirs) for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.r + dr,
          nc = pos.c + dc;
        if (!within(nr, nc, N)) continue;
        if (nextPath.find(p => p.r === nr && p.c === nc)) continue;
        stack.push({
          pos: {
            r: nr,
            c: nc
          },
          path: nextPath,
          word: nextWord
        });
      }
    }
  }
  return includeAnalysis ? {
    words,
    linkFound,
    usage,
    analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, totalRarityScore)
  } : {
    words,
    linkFound,
    usage
  };
}
export function computeBoardAnalysis(words: Set<string>, letterFreq: Map<string, number>, totalWordLength: number, totalRarityScore: number): BoardAnalysis {
  const wordCount = words.size;
  const avgWordLength = wordCount > 0 ? totalWordLength / wordCount : 4;

  // Connectivity score based on letter distribution evenness
  const uniqueLetters = letterFreq.size;
  const connectivityScore = Math.min(1.5, uniqueLetters / 8); // Higher diversity = better connectivity

  // Realistic maximum scoring potential using actual game scoring formula
  // Use quadratic base scoring: (length² * 4) + (length * 12)
  let estimatedMaxScore = 0;
  words.forEach(word => {
    const len = word.length;
    const baseScore = len * len * 4 + len * 12;

    // Add realistic rarity bonus (8-20% of base score based on rare letters)
    const rarityCount = word.split('').reduce((count, char) => {
      return count + letterRarity(char);
    }, 0);
    const ultraRareCount = word.split('').reduce((count, char) => {
      return count + (["J", "Q", "X", "Z"].includes(char.toUpperCase()) ? 1 : 0);
    }, 0);
    const rarityBonus = Math.round(baseScore * (rarityCount * 0.08)) + Math.round(baseScore * (ultraRareCount * 0.12));

    // Add length bonuses for longer words
    let lengthBonus = 0;
    if (len >= 5) lengthBonus += 25;
    if (len >= 6) lengthBonus += 50;
    if (len >= 7) lengthBonus += 100;
    if (len >= 8) lengthBonus += 150;

    // Assume potential 1.3x multiplier from links and special tiles
    const wordScore = Math.round((baseScore + rarityBonus + lengthBonus) * 1.3);
    estimatedMaxScore += wordScore;
  });
  return {
    rarityScorePotential: totalRarityScore,
    avgWordLength,
    connectivityScore,
    letterDistribution: letterFreq,
    maxScorePotential: estimatedMaxScore
  };
}
export function getRarityScore(word: string): number {
  // Updated to match actual game rarity calculation
  return word.split('').reduce((score, char) => {
    return score + letterRarity(char);
  }, 0);
}
export function mutateGrid(grid: string[][], usage: Map<string, number>, vowelRatio: number, vMin: number, vMax: number, count: number) {
  const N = grid.length;
  const positions: Array<{
    r: number;
    c: number;
    k: string;
    u: number;
  }> = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = `${r},${c}`;
    positions.push({
      r,
      c,
      k,
      u: usage.get(k) ?? 0
    });
  }
  positions.sort((a, b) => a.u - b.u || Math.random() - 0.5);
  const chosen = positions.slice(0, Math.min(count, positions.length));
  const biasToVowel = vowelRatio < vMin ? true : vowelRatio > vMax ? false : Math.random() < 0.5;
  const newGrid = grid.map(row => row.slice());
  for (const p of chosen) newGrid[p.r][p.c] = biasToVowel ? randomVowelWeighted() : randomConsonantWeighted();
  return newGrid;
}
export function generateSolvableBoard(size: number, wordSet: Set<string>, sortedArr: string[]) {
  let attempts = 0;
  let lastBoard = makeBoard(size);
  while (attempts < MAX_ATTEMPTS) {
    let board = makeBoard(size);
    let probe = probeGrid(board, wordSet, sortedArr, K_MIN_WORDS, MAX_DFS_NODES);
    if (probe.words.size >= K_MIN_WORDS && probe.linkFound) return board;
    let rounds = 0;
    while (rounds < MUTATION_ROUNDS) {
      const vr = countVowelRatio(board);
      board = mutateGrid(board, probe.usage, vr, TARGET_VOWEL_MIN, TARGET_VOWEL_MAX, RESPAWN_COUNT);
      probe = probeGrid(board, wordSet, sortedArr, K_MIN_WORDS, MAX_DFS_NODES);
      if (probe.words.size >= K_MIN_WORDS && probe.linkFound) return board;
      rounds++;
    }
    lastBoard = board;
    attempts++;
  }
  return lastBoard;
}

// Shared utility functions for word submission
export function handleShuffleTiles(
  wordPath: Pos[], 
  specialTiles: SpecialTile[][], 
  currentBoard: string[][], 
  size: number,
  setBoard: (board: string[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): string[][] {
  const shuffleTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "shuffle");
  let resultBoard = currentBoard;
  
  if (shuffleTiles.length > 0) {
    // Collect letters from non-frozen positions only; frozen tiles stay in place
    const shuffleablePositions: Pos[] = [];
    const allLetters: string[] = [];
    const letterCounts = new Map<string, number>();

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const letter = currentBoard[r][c];
        const count = letterCounts.get(letter) || 0;
        letterCounts.set(letter, count + 1);
        if (!specialTiles[r][c].frozen) {
          shuffleablePositions.push({ r, c });
          allLetters.push(letter);
        }
      }
    }

    // Check if any letter exceeds 4 instances and replace extras
    for (const [letter, count] of letterCounts) {
      if (count > 4) {
        const excess = count - 4;
        let replaced = 0;
        for (let i = 0; i < allLetters.length && replaced < excess; i++) {
          if (allLetters[i] === letter) {
            const tempCounts = new Map(letterCounts);
            tempCounts.set(letter, tempCounts.get(letter)! - 1);
            allLetters[i] = constrainedRandomLetter(tempCounts);
            replaced++;
          }
        }
      }
    }

    // Shuffle the letters array
    for (let i = allLetters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
    }

    // Redistribute the shuffled letters to non-frozen positions only
    const shuffledBoard = currentBoard.map(row => [...row]);
    for (let i = 0; i < shuffleablePositions.length; i++) {
      const { r, c } = shuffleablePositions[i];
      shuffledBoard[r][c] = allLetters[i];
    }
    
    // Apply Q-U adjacency validation to the shuffled board
    const validation = validateAndFixQUAdjacency(shuffledBoard, size, undefined, undefined, true);
    if (validation.violations > 0) {
      console.log(`Shuffle Q-U Validation: Fixed ${validation.violations} violations`);
    }
    
    resultBoard = validation.board;
    setBoard(resultBoard);
    
    // Set all tiles as affected for visual effect
    const allTileKeys = new Set<string>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        allTileKeys.add(keyOf({ r, c }));
      }
    }
    setAffectedTiles(allTileKeys);
    
    setTimeout(() => {
      setAffectedTiles(new Set());
    }, 1500);
    
    toast.success("Shuffle activated! All letters repositioned!");
  }
  
  return resultBoard;
}

export function handleXFactorTiles(
  wordPath: Pos[],
  specialTiles: SpecialTile[][],
  currentBoard: string[][],
  size: number,
  setBoard: (board: string[][]) => void,
  setSpecialTiles: (tiles: SpecialTile[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): { xChanged: number, board: string[][], specialTiles: SpecialTile[][] } {
  const xFactorTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "xfactor");
  let xChanged = 0;
  let resultBoard = currentBoard;
  let resultTiles = specialTiles.map(row => row.map(tile => ({ ...tile })));
  
  if (xFactorTiles.length > 0) {
    const newBoard = currentBoard.map(row => [...row]);
    const newSpecialTiles = specialTiles.map(row => [...row]);
    const changedTileKeys = new Set<string>();

    // Count current letters on the board for constraint enforcement
    const currentLetterCounts = new Map<string, number>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const letter = newBoard[r][c];
        currentLetterCounts.set(letter, (currentLetterCounts.get(letter) || 0) + 1);
      }
    }

    xFactorTiles.forEach(xfPos => {
      const diagonals = [
        { r: xfPos.r - 1, c: xfPos.c - 1 },
        { r: xfPos.r - 1, c: xfPos.c + 1 },
        { r: xfPos.r + 1, c: xfPos.c - 1 },
        { r: xfPos.r + 1, c: xfPos.c + 1 }
      ];
      
      diagonals.forEach(pos => {
        if (within(pos.r, pos.c, size) && !newSpecialTiles[pos.r][pos.c].frozen) {
          // Reduce count of old letter
          const oldLetter = newBoard[pos.r][pos.c];
          currentLetterCounts.set(oldLetter, (currentLetterCounts.get(oldLetter) || 0) - 1);

          // Generate new constrained letter
          newBoard[pos.r][pos.c] = constrainedRandomLetter(currentLetterCounts);
          newSpecialTiles[pos.r][pos.c] = { type: null };
          changedTileKeys.add(keyOf(pos));
        }
      });
    });

    // Apply Q-U adjacency validation after all X-Factor changes
    const validation = validateAndFixQUAdjacency(newBoard, size, currentLetterCounts, undefined, true);
    if (validation.violations > 0) {
      console.log(`X-Factor Q-U Validation: Fixed ${validation.violations} violations`);
    }

    resultBoard = validation.board;
    setBoard(resultBoard);
    setSpecialTiles(newSpecialTiles);
    resultTiles = newSpecialTiles;
    setAffectedTiles(changedTileKeys);
    xChanged = changedTileKeys.size;

    setTimeout(() => {
      setAffectedTiles(new Set());
    }, 1000);

    toast.info("X-Factor activated! Adjacent tiles transformed!");
  }
  
  return { xChanged, board: resultBoard, specialTiles: resultTiles };
}

// Apply Magnet spawn effect: replace orthogonal neighbors with random vowels
export function applyMagnetSpawnEffect(
  pos: Pos,
  board: string[][],
  specialTiles: SpecialTile[][],
  size: number
): string[][] {
  const newBoard = board.map(row => [...row]);
  const orthogonal = [
    { r: pos.r - 1, c: pos.c },
    { r: pos.r + 1, c: pos.c },
    { r: pos.r, c: pos.c - 1 },
    { r: pos.r, c: pos.c + 1 },
  ];
  for (const adj of orthogonal) {
    if (within(adj.r, adj.c, size) && specialTiles[adj.r][adj.c].type === null) {
      const currentLetter = newBoard[adj.r][adj.c];
      if (!MAGNET_VOWELS.includes(currentLetter.toUpperCase())) {
        newBoard[adj.r][adj.c] = MAGNET_VOWELS[Math.floor(Math.random() * MAGNET_VOWELS.length)];
      }
    }
  }
  return newBoard;
}

// Apply Freeze spawn effect: mark orthogonal neighbors as frozen
export function applyFreezeSpawnEffect(
  pos: Pos,
  specialTiles: SpecialTile[][],
  size: number
): SpecialTile[][] {
  const newTiles = specialTiles.map(row => row.map(t => ({ ...t })));
  const orthogonal = [
    { r: pos.r - 1, c: pos.c },
    { r: pos.r + 1, c: pos.c },
    { r: pos.r, c: pos.c - 1 },
    { r: pos.r, c: pos.c + 1 },
  ];
  for (const adj of orthogonal) {
    if (within(adj.r, adj.c, size)) {
      newTiles[adj.r][adj.c] = { ...newTiles[adj.r][adj.c], frozen: true };
    }
  }
  return newTiles;
}

// Process Decay spread during the expiry/tick phase
export function processDecaySpread(
  specialTiles: SpecialTile[][],
  board: string[][],
  size: number
): { tiles: SpecialTile[][], board: string[][] } {
  const newTiles = specialTiles.map(row => row.map(t => ({ ...t })));
  const newBoard = board.map(row => [...row]);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (specialTiles[r][c].type === "decay") {
        // 40% chance to spread to one random orthogonal neighbor
        if (Math.random() < 0.4) {
          const orthogonal = [
            { r: r - 1, c: c },
            { r: r + 1, c: c },
            { r: r, c: c - 1 },
            { r: r, c: c + 1 },
          ].filter(p => within(p.r, p.c, size) && newTiles[p.r][p.c].type === null && !newTiles[p.r][p.c].frozen);

          if (orthogonal.length > 0) {
          const target = orthogonal[Math.floor(Math.random() * orthogonal.length)];
          // Convert neighbor's letter to a random low-value letter
          newBoard[target.r][target.c] = LOW_VALUE_LETTERS[Math.floor(Math.random() * LOW_VALUE_LETTERS.length)];
          // Spread copy becomes decay with 2 turns (set to 3 since expireSpecialTiles decrements in same turn)
          newTiles[target.r][target.c] = { type: "decay", expiryTurns: 3 };
          }
        }
      }
    }
  }
  return { tiles: newTiles, board: newBoard };
}

// Handle Bomb blast: replace all tiles within Manhattan distance 2 with new random letters
export function handleBombBlast(
  bombPos: Pos,
  board: string[][],
  specialTiles: SpecialTile[][],
  size: number,
  setBoard: (board: string[][]) => void,
  setSpecialTiles: (tiles: SpecialTile[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): { board: string[][], specialTiles: SpecialTile[][] } {
  const newBoard = board.map(row => [...row]);
  const newTiles = specialTiles.map(row => row.map(t => ({ ...t })));
  const changedKeys = new Set<string>();
  const letterCounts = new Map<string, number>();

  // Count existing letters for constraint
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const letter = newBoard[r][c];
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dist = Math.abs(r - bombPos.r) + Math.abs(c - bombPos.c);
      if (dist <= 2 && !(r === bombPos.r && c === bombPos.c)) {
        // Skip frozen tiles
        if (newTiles[r][c].frozen) continue;
        // Replace letter
        const oldLetter = newBoard[r][c];
        letterCounts.set(oldLetter, (letterCounts.get(oldLetter) || 0) - 1);
        newBoard[r][c] = constrainedRandomLetter(letterCounts);
        // Clear special tile
        newTiles[r][c] = { type: null };
        changedKeys.add(keyOf({ r, c }));
      }
    }
  }

  // Clear the bomb itself
  newTiles[bombPos.r][bombPos.c] = { type: null };

  const validation = validateAndFixQUAdjacency(newBoard, size, letterCounts, undefined, true);
  setBoard(validation.board);
  setSpecialTiles(newTiles);
  setAffectedTiles(changedKeys);

  setTimeout(() => setAffectedTiles(new Set()), 1500);
  toast.info("Bomb detonated! Area reset with new letters!");
  
  return { board: validation.board, specialTiles: newTiles };
}

export function checkAndAwardAchievements(
  actualWord: string,
  wordPath: Pos[],
  usedWords: Array<{word: string, score: number, breakdown?: any}>,
  unlocked: Set<AchievementId>,
  discoverableCount: number,
  sharedTilesCount: number,
  multiplier: number,
  xChanged: number,
  wildUsed: boolean,
  board: string[][]
): { newAchievements: AchievementId[], achievementBonus: number } {
  const newAchievements: AchievementId[] = [];
  const checkAndAdd = (condition: boolean, achievement: AchievementId) => {
    if (condition && !unlocked.has(achievement)) {
      newAchievements.push(achievement);
    }
  };

  // NEW: Length-based achievement checking system (replaces streak-based)
  // Track words by length for new achievements
  const currentGameWords = [...usedWords, { word: actualWord, score: 0, breakdown: {} }];
  const sixPlusWords = currentGameWords.filter(w => w.word.length >= 6).length;
  const sevenPlusWords = currentGameWords.filter(w => w.word.length >= 7).length;
  const eightPlusWords = currentGameWords.filter(w => w.word.length >= 8).length;

  // Length-based achievements
  if (sixPlusWords >= 3) checkAndAdd(true, "wordArtisan");
  if (sevenPlusWords >= 5) checkAndAdd(true, "lengthMaster");
  if (eightPlusWords >= 3) checkAndAdd(true, "epicWordsmith");
  
  // Link achievements
  if (sharedTilesCount >= 2) checkAndAdd(true, "link2");
  if (sharedTilesCount >= 3) checkAndAdd(true, "link3");
  if (sharedTilesCount >= 4) checkAndAdd(true, "link4");
  
  // Word length achievements
  if (actualWord.length >= 7) checkAndAdd(true, "long7");
  if (actualWord.length >= 8) checkAndAdd(true, "epic8");
  
  // Ultra rare letter achievements
  const ultraCount = wordPath.reduce((acc, p) => acc + (["J","Q","X","Z"].includes(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
  if (ultraCount >= 2) checkAndAdd(true, "rare2");
  
  // Multiplier and special tile achievements
  if (multiplier >= 3) checkAndAdd(true, "combo3x");
  if (xChanged >= 3) checkAndAdd(true, "chaos3");
  
  // Vowel/consonant achievements
  const ratio = vowelRatioOfWord(actualWord);
  if (actualWord.length >= 6 && ratio >= 0.6) checkAndAdd(true, "vowelStorm");
  if (actualWord.length >= 6 && ratio <= 0.2) checkAndAdd(true, "consonantCrunch");
  
  // Wild card achievement
  if (wildUsed) checkAndAdd(true, "wildWizard");

  // Word count achievements
  const nextUsedCount = usedWords.length + 1;
  if (nextUsedCount >= 10) checkAndAdd(true, "cartographer10");
  if (nextUsedCount >= 15) checkAndAdd(true, "collector15");

  // Completion achievements
  if (discoverableCount > 0) {
    const pct = (nextUsedCount / discoverableCount) * 100;
    if (pct >= 80) checkAndAdd(true, "completionist80");
    if (nextUsedCount >= discoverableCount) checkAndAdd(true, "completionist100");
  }

  // Calculate achievement bonus
  const achievementBonus = newAchievements.reduce((total, id) => total + ACHIEVEMENTS[id].scoreBonus, 0);
  
  return { newAchievements, achievementBonus };
}
