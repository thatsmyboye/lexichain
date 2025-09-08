import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, computeBoardSpecificBenchmarks, computeDynamicBenchmarks, type Benchmarks, type BoardAnalysis } from "@/lib/benchmarks";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";
import { supabase } from "@/integrations/supabase/client";
import { useDailyChallengeState } from "@/hooks/useDailyChallengeState";
import { useGoals } from "@/hooks/useGoals";
import { useConsumables } from "@/hooks/useConsumables";
import { ConsumableInventoryPanel, QuickUseBar } from "@/components/consumables/ConsumableInventory";
import { CONSUMABLES, ACHIEVEMENT_CONSUMABLE_REWARDS, type ConsumableId } from "@/lib/consumables";
import type { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";
type Pos = {
  r: number;
  c: number;
};
const keyOf = (p: Pos) => `${p.r},${p.c}`;
const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) <= 1;

// Special tile types
type SpecialTileType = "stone" | "wild" | "xfactor" | "multiplier" | "shuffle" | null;
type SpecialTile = {
  type: SpecialTileType;
  value?: number;
  expiryTurns?: number;
};
type GameMode = "classic" | "target" | "daily" | "practice" | "blitz";
type GameSettings = {
  scoreThreshold: number;
  mode: GameMode;
  targetTier: "bronze" | "silver" | "gold" | "platinum";
  difficulty: "easy" | "medium" | "hard" | "expert";
  gridSize: number;
  dailyMovesLimit: number;
  blitzTimeLimit: number;
};

// Letter frequencies for English to generate fun boards
const LETTERS: Array<[string, number]> = [["E", 12.02], ["T", 9.10], ["A", 8.12], ["O", 7.68], ["I", 7.31], ["N", 6.95], ["S", 6.28], ["R", 6.02], ["H", 5.92], ["D", 4.32], ["L", 3.98], ["U", 2.88], ["C", 2.71], ["M", 2.61], ["F", 2.30], ["Y", 2.11], ["W", 2.09], ["G", 2.03], ["P", 1.82], ["B", 1.49], ["V", 1.11], ["K", 0.69], ["X", 0.17], ["Q", 0.11], ["J", 0.10], ["Z", 0.07]];
function randomLetter() {
  const total = LETTERS.reduce((a, [, f]) => a + f, 0);
  let x = Math.random() * total;
  for (const [ch, f] of LETTERS) {
    if ((x -= f) <= 0) return ch;
  }
  return "E";
}
function constrainedRandomLetter(letterCounts: Map<string, number>, seed?: string, seedCounter?: number) {
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
function getAdjacentPositions(pos: Pos, size: number): Pos[] {
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
function makeBoard(size: number, seed?: string) {
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

  // Validate Q-U adjacency and fix if needed
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'Q') {
        // Check if there's a U adjacent to this Q
        const adjacentPositions = getAdjacentPositions({
          r,
          c
        }, size);
        const hasAdjacentU = adjacentPositions.some(pos => board[pos.r][pos.c] === 'U');
        if (!hasAdjacentU) {
          // No adjacent U found, replace with a different letter
          const oldLetter = board[r][c];
          letterCounts.set(oldLetter, (letterCounts.get(oldLetter) || 0) - 1);
          let newLetter;
          do {
            if (seed) {
              const rng = seedRandom(seed + r + c + "fix");
              newLetter = seededRandomLetter(rng);
            } else {
              newLetter = randomLetter();
            }
          } while (newLetter === 'Q' || (letterCounts.get(newLetter) || 0) >= 4);
          letterCounts.set(newLetter, (letterCounts.get(newLetter) || 0) + 1);
          board[r][c] = newLetter;
        }
      }
    }
  }
  return board;
}

// Seeded random number generator
function seedRandom(seed: string) {
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
function seededRandomLetter(rng: () => number) {
  const total = LETTERS.reduce((a, [, f]) => a + f, 0);
  let x = rng() * total;
  for (const [ch, f] of LETTERS) {
    if ((x -= f) <= 0) return ch;
  }
  return "E";
}
function getDailySeed(): string {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}
function getDailyMovesLimit(): number {
  // Fixed at 10 moves for Daily Challenge
  return 10;
}
function binaryHasPrefix(sortedWords: string[], prefix: string) {
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
const K_MIN_WORDS = 12;
const TARGET_VOWEL_MIN = 0.35;
const TARGET_VOWEL_MAX = 0.55;
const RESPAWN_COUNT = 3;
const MUTATION_ROUNDS = 4;
const MAX_ATTEMPTS = 8;
const MAX_DFS_NODES = 30000;
const VOWELS = new Set(["A", "E", "I", "O", "U", "Y"]);
const VOWEL_POOL = LETTERS.filter(([ch]) => VOWELS.has(ch));
const CONSONANT_POOL = LETTERS.filter(([ch]) => !VOWELS.has(ch));

// Scoring constants - RECALIBRATED
const RARITY_MULTIPLIER = 3.0; // increased impact of rare letters
const ULTRA_RARE_MULTIPLIER = 1.5; // additional multiplier for ultra-rare letters
const STREAK_TARGET_LEN = 4; // reduced qualifying length for streaks

// Special tiles constants
const SPECIAL_TILE_SCORE_THRESHOLD = 150;
const SPECIAL_TILE_RARITIES = {
  stone: 0.15,
  wild: 0.05,
  xfactor: 0.08,
  multiplier: 0.12,
  shuffle: 0.03 // Rare occurrence
};

// Letter rarity helpers (based on frequency with a special bucket for ultra-rare letters)
const VERY_RARE = new Set(["J", "Q", "X", "Z"]);
const FREQ_MAP = new Map<string, number>(LETTERS);
function letterRarity(ch: string): number {
  const up = ch.toUpperCase();
  if (VERY_RARE.has(up)) return 2; // ultra-rare
  const f = FREQ_MAP.get(up) ?? 10;
  return f < 2 ? 1 : 0; // rare if frequency < 2%
}
type ScoreBreakdown = {
  base: number;
  rarity: {
    sum: number;
    ultraCount: number;
    bonus: number;
  };
  linkBonus: number;
  linkMultiplier: number;
  lengthBonus: number;
  timeBonus: number;
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
const MULTIPLIER_CAP = 8;
function computeScoreBreakdown(params: {
  actualWord: string;
  wordPath: Pos[];
  board: string[][];
  specialTiles: SpecialTile[][];
  lastWordTiles: Set<string>;
  streak: number;
  mode: "classic" | "daily" | "target" | "practice" | "blitz";
  blitzMultiplier: number;
  activeEffects: Array<{
    id: string;
    data?: Record<string, unknown>;
  }>;
  baseMode?: "hybrid" | "square";
  chainMode?: "cappedLinear" | "linear";
}): ScoreBreakdown {
  const {
    actualWord,
    wordPath,
    board,
    specialTiles,
    lastWordTiles,
    streak,
    mode,
    blitzMultiplier,
    activeEffects,
    baseMode = "hybrid",
    chainMode = "cappedLinear"
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

  const raritySum = wordPath.reduce((acc, p) => acc + letterRarity(board[p.r][p.c]), 0);
  const ultraRareCount = wordPath.reduce((acc, p) => acc + (["J", "Q", "X", "Z"].includes(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);

  // NEW: Percentage-based rarity system
  const rarityBonus = Math.round(base * (raritySum * 0.08)) + Math.round(base * (ultraRareCount * 0.12));

  // NEW: Length-based bonus system (replaces streak-based chain bonus)
  let lengthBonus = 0;
  if (wordLen >= 5) lengthBonus += 25;
  if (wordLen >= 6) lengthBonus += 50;
  if (wordLen >= 7) lengthBonus += 100;
  if (wordLen >= 8) lengthBonus += 150;
  const timeBonus = 0; // Removed blitz functionality

  const scoreMultiplierEffect = activeEffects.find(e => e.id === "score_multiplier");
  let consumableMultiplier = 1;
  if (scoreMultiplierEffect && typeof scoreMultiplierEffect.data?.multiplier === "number") {
    consumableMultiplier = scoreMultiplierEffect.data.multiplier as number;
  }
  const combinedMultiplierRaw = tileMultiplier * consumableMultiplier;
  const combinedApplied = Math.min(MULTIPLIER_CAP, combinedMultiplierRaw);
  const capped = combinedApplied !== combinedMultiplierRaw;
  const totalBeforeMultipliers = Math.round((base + rarityBonus + lengthBonus + timeBonus) * linkMultiplier);
  const total = Math.round(totalBeforeMultipliers * combinedApplied);
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
    timeBonus,
    multipliers: {
      tileMultiplier,
      consumableMultiplier,
      combinedApplied,
      capped,
      cap: MULTIPLIER_CAP as number
    },
    totalBeforeMultipliers,
    total
  };
}
function pickWeighted(pool: Array<[string, number]>) {
  const total = pool.reduce((a, [, f]) => a + f, 0);
  let x = Math.random() * total;
  for (const [ch, f] of pool) {
    if ((x -= f) <= 0) return ch;
  }
  return pool[0]?.[0] ?? "E";
}
function randomVowelWeighted() {
  return pickWeighted(VOWEL_POOL);
}
function randomConsonantWeighted() {
  return pickWeighted(CONSONANT_POOL);
}
function isVowel(ch: string) {
  return VOWELS.has(ch.toUpperCase());
}
function countVowelRatio(grid: string[][]) {
  let v = 0,
    t = 0;
  for (const row of grid) for (const ch of row) {
    t++;
    if (isVowel(ch)) v++;
  }
  return t ? v / t : 0.5;
}
type ProbeResult = {
  words: Set<string>;
  linkFound: boolean;
  usage: Map<string, number>;
  analysis?: BoardAnalysis;
};
function probeGrid(grid: string[][], wordSet: Set<string>, sortedArr: string[], K: number, maxNodes: number, includeAnalysis: boolean = false): ProbeResult {
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
  let maxWordScore = 0;
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
      const k = keyOf(pos);
      if (pp.find(p => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      nodes++;
      if (nodes > maxNodes) {
        return includeAnalysis ? {
          words,
          linkFound,
          usage,
          analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, maxWordScore, totalRarityScore, N)
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
            const wordScore = calculateWordScore(nextWord, nextPath, grid);
            maxWordScore = Math.max(maxWordScore, wordScore);
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
              analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, maxWordScore, totalRarityScore, N)
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
    analysis: computeBoardAnalysis(words, letterFreq, totalWordLength, maxWordScore, totalRarityScore, N)
  } : {
    words,
    linkFound,
    usage
  };
}
function computeBoardAnalysis(words: Set<string>, letterFreq: Map<string, number>, totalWordLength: number, maxWordScore: number, totalRarityScore: number, gridSize: number): BoardAnalysis {
  const wordCount = words.size;
  const avgWordLength = wordCount > 0 ? totalWordLength / wordCount : 4;

  // Connectivity score based on letter distribution evenness
  const totalLetters = gridSize * gridSize;
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
function calculateWordScore(word: string, path: Pos[], grid: string[][]): number {
  // Use the same quadratic formula as the actual game scoring
  const len = word.length;
  const baseScore = len * len * 4 + len * 12;

  // Calculate rarity bonus using actual game logic
  const rarityCount = path.reduce((acc, p) => acc + letterRarity(grid[p.r][p.c]), 0);
  const ultraRareCount = path.reduce((acc, p) => acc + (["J", "Q", "X", "Z"].includes(grid[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
  const rarityBonus = Math.round(baseScore * (rarityCount * 0.08)) + Math.round(baseScore * (ultraRareCount * 0.12));

  // Add length bonuses
  let lengthBonus = 0;
  if (len >= 5) lengthBonus += 25;
  if (len >= 6) lengthBonus += 50;
  if (len >= 7) lengthBonus += 100;
  if (len >= 8) lengthBonus += 150;
  return baseScore + rarityBonus + lengthBonus;
}
function getRarityScore(word: string): number {
  // Updated to match actual game rarity calculation
  return word.split('').reduce((score, char) => {
    return score + letterRarity(char);
  }, 0);
}
function mutateGrid(grid: string[][], usage: Map<string, number>, vowelRatio: number, vMin: number, vMax: number, count: number) {
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
function generateSolvableBoard(size: number, wordSet: Set<string>, sortedArr: string[]) {
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
function handleShuffleTiles(
  wordPath: Pos[], 
  specialTiles: SpecialTile[][], 
  currentBoard: string[][], 
  size: number,
  setBoard: (board: string[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): void {
  const shuffleTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "shuffle");
  if (shuffleTiles.length > 0) {
    // Get all letters from the board and ensure max 4 of each letter
    const allLetters: string[] = [];
    const letterCounts = new Map<string, number>();
    
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const letter = currentBoard[r][c];
        const count = letterCounts.get(letter) || 0;
        letterCounts.set(letter, count + 1);
        allLetters.push(letter);
      }
    }
    
    // Check if any letter exceeds 4 instances and replace extras
    for (const [letter, count] of letterCounts) {
      if (count > 4) {
        const excess = count - 4;
        // Find positions with this letter and replace excess ones
        let replaced = 0;
        for (let i = 0; i < allLetters.length && replaced < excess; i++) {
          if (allLetters[i] === letter) {
            // Replace with a constrained random letter
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
    
    // Redistribute the shuffled letters
    let letterIndex = 0;
    const shuffledBoard = currentBoard.map(row => [...row]);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        shuffledBoard[r][c] = allLetters[letterIndex++];
      }
    }
    
    setBoard(shuffledBoard);
    
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
}

function handleXFactorTiles(
  wordPath: Pos[],
  specialTiles: SpecialTile[][],
  currentBoard: string[][],
  size: number,
  setBoard: (board: string[][]) => void,
  setSpecialTiles: (tiles: SpecialTile[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): number {
  const xFactorTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "xfactor");
  let xChanged = 0;
  
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
        if (within(pos.r, pos.c, size)) {
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

    setBoard(newBoard);
    setSpecialTiles(newSpecialTiles);
    setAffectedTiles(changedTileKeys);
    xChanged = changedTileKeys.size;

    setTimeout(() => {
      setAffectedTiles(new Set());
    }, 1000);

    toast.info("X-Factor activated! Adjacent tiles transformed!");
  }
  
  return xChanged;
}

function checkAndAwardAchievements(
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

function WordPathGame({
  onBackToTitle,
  initialMode = "classic"
}: {
  onBackToTitle?: () => void;
  initialMode?: "classic" | "daily" | "practice" | "blitz";
}) {
  const [user, setUser] = useState<User | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const {
    updateGoalProgress
  } = useGoals(user);
  const dailyChallengeState = useDailyChallengeState(getDailySeed());
  const {
    inventory: consumableInventory,
    activeEffects,
    useConsumable,
    awardConsumables,
    addActiveEffect,
    removeActiveEffect
  } = useConsumables(user);
  const isMobile = useIsMobile();
  const [size, setSize] = useState(4);
  const [board, setBoard] = useState<string[][] | null>(null);
  const [specialTiles, setSpecialTiles] = useState<SpecialTile[][]>(() => Array.from({
    length: size
  }, () => Array.from({
    length: size
  }, () => ({
    type: null
  }))));
  const [dailyChallengeInitialized, setDailyChallengeInitialized] = useState(false);
  const [path, setPath] = useState<Pos[]>([]);
  const [dragging, setDragging] = useState(false);
  const [usedWords, setUsedWords] = useState<{
    word: string;
    score: number;
    breakdown?: ScoreBreakdown;
  }[]>([]);
  const [lastWordTiles, setLastWordTiles] = useState<Set<string>>(new Set());
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [score, setScore] = useState(0);
  const [benchmarks, setBenchmarks] = useState<Benchmarks | null>(null);
  const [discoverableCount, setDiscoverableCount] = useState(0);
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [finalGrade, setFinalGrade] = useState<"None" | "Bronze" | "Silver" | "Gold" | "Platinum">("None");
  const [streak, setStreak] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [usedWordsExpanded, setUsedWordsExpanded] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    scoreThreshold: benchmarks?.bronze || 100,
    // Use Bronze threshold
    mode: "classic",
    targetTier: "silver",
    difficulty: "medium",
    gridSize: 4,
    dailyMovesLimit: getDailyMovesLimit(),
    blitzTimeLimit: 60
  });
  const [showDifficultyDialog, setShowDifficultyDialog] = useState(false);
  const [affectedTiles, setAffectedTiles] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
    timestamp?: number;
  } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [movesUsed, setMovesUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showWildDialog, setShowWildDialog] = useState(false);
  const [wildTileInputs, setWildTileInputs] = useState<Map<string, string>>(new Map());
  const [pendingWildPath, setPendingWildPath] = useState<Pos[] | null>(null);

  // Consumable activation states
  const [activatedConsumables, setActivatedConsumables] = useState<Set<ConsumableId>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  const [blitzMultiplier, setBlitzMultiplier] = useState(1);
  const [blitzStarted, setBlitzStarted] = useState(false);
  const [blitzPaused, setBlitzPaused] = useState(false);

  // Tap-to-select functionality
  const [isTapMode, setIsTapMode] = useState(isMobile);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPos, setLastTapPos] = useState<Pos | null>(null);

  // Initialize user auth
  useEffect(() => {
    const getUser = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  // Start daily challenge if initial mode is daily, start practice if practice mode
  useEffect(() => {
    if (initialMode === "daily") {
      setDailyChallengeInitialized(true);
      startDailyChallenge().catch(console.error);
    } else if (initialMode === "practice") {
      setDailyChallengeInitialized(true);
      startNewPracticeGame().catch(console.error);
    }
  }, [initialMode, dailyChallengeInitialized]);

  // Reset game start time when new game starts
  useEffect(() => {
    setGameStartTime(Date.now());
  }, [board]);

  // Removed blitz timer functionality - TEMPORARILY DISABLED
  // useEffect(() => {
  //   if (settings.mode === "blitz" && blitzStarted && !blitzPaused && !gameOver) {
  //     const interval = setInterval(() => {
  //       setTimeRemaining(prev => {
  //         const newTime = prev - 1;
  //         
  //         // Update multiplier based on time remaining
  //         if (newTime <= 10) {
  //           setBlitzMultiplier(3);
  //         } else if (newTime <= 30) {
  //           setBlitzMultiplier(2);
  //         } else {
  //           setBlitzMultiplier(1);
  //         }
  //         
  //           if (newTime <= 0) {
  //             setGameOver(true);
  //             setFinalGrade(score >= (benchmarks?.platinum || 4000) ? "Platinum"
  //               : score >= (benchmarks?.gold || 2200) ? "Gold"
  //               : score >= (benchmarks?.silver || 1200) ? "Silver"
  //               : score >= (benchmarks?.bronze || 500) ? "Bronze"
  //               : "None");
  //             
  //             // Save state when blitz game ends
  //             saveGameState();
  //             
  //             return 0;
  //         }
  //         
  //         return newTime;
  //       });
  //     }, 1000);
  //     
  //     setTimerInterval(interval as unknown as number);
  //     
  //     return () => {
  //       if (interval) clearInterval(interval);
  //     };
  //   } else {
  //     if (timerInterval) {
  //       clearInterval(timerInterval);
  //       setTimerInterval(null);
  //     }
  //   }
  // }, [settings.mode, blitzStarted, blitzPaused, gameOver, score, benchmarks]);

  // Save standard game result and update goals when game ends
  const saveGameResult = async () => {
    if (!user || settings.mode === "daily" || settings.mode === "practice" || !gameOver) return;
    const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");
    try {
      const gameResult = {
        user_id: user.id,
        score: score,
        words_found: usedWords.length,
        longest_word: longestWord,
        moves_used: movesUsed,
        time_played: Math.round((Date.now() - gameStartTime) / 1000),
        achievement_grade: finalGrade,
        achievements_unlocked: Array.from(unlocked),
        grid_size: size,
        game_mode: settings.mode
      };
      const {
        data,
        error
      } = await supabase.from("standard_game_results").insert(gameResult).select().single();
      if (error) throw error;

      // Update goal progress - TEMPORARILY DISABLED
      // if (data) {
      //   await updateGoalProgress({
      //     score: score,
      //     words_found: usedWords.length,
      //     longest_word: longestWord,
      //     achievement_grade: finalGrade,
      //     game_id: data.id
      //   });
      // }
    } catch (error) {
      console.error("Error saving game result:", error);
    }
  };

  // Save daily challenge result when game ends
  const saveDailyChallengeResult = async () => {
    if (!user || settings.mode !== "daily" || !gameOver) return;
    try {
      const challengeResult = {
        user_id: user.id,
        challenge_date: getDailySeed(),
        // Use the daily seed as the challenge date
        score: score,
        achievement_level: finalGrade
      };
      const {
        error
      } = await supabase.from("daily_challenge_results").insert(challengeResult);
      if (error) throw error;
      console.log("Daily challenge result saved successfully");
    } catch (error) {
      console.error("Error saving daily challenge result:", error);
    }
  };

  // Save game result when game ends
  useEffect(() => {
    if (gameOver) {
      if (settings.mode === "daily") {
        saveDailyChallengeResult();
      } else {
        saveGameResult();
      }
    }
  }, [gameOver, user, settings.mode]);

  // Save and restore daily challenge state
  const saveDailyState = async (initialBoardToSave?: string[][], immediate = false) => {
    if (settings.mode === "daily") {
      const gameState = {
        board,
        initialBoard: initialBoardToSave || board,
        // Use provided initial board or current board
        specialTiles,
        usedWords,
        score,
        streak,
        movesUsed,
        unlocked: Array.from(unlocked),
        gameOver,
        finalGrade,
        lastWordTiles: Array.from(lastWordTiles),
        seed: getDailySeed(),
        benchmarks,
        discoverableCount
      };
      await dailyChallengeState.saveState(gameState, immediate);
    }
  };
  const loadDailyState = async () => {
    const gameState = await dailyChallengeState.loadState();
    if (gameState) {
      setBoard(gameState.board);
      setSpecialTiles(gameState.specialTiles);
      setUsedWords(gameState.usedWords);
      setScore(gameState.score);
      setStreak(gameState.streak);
      setMovesUsed(gameState.movesUsed);
      setUnlocked(new Set(gameState.unlocked));
      setGameOver(gameState.gameOver);
      setFinalGrade(gameState.finalGrade);
      // Restore last word tiles to show shaded tiles from previous attempt
      setLastWordTiles(new Set(gameState.lastWordTiles || []));

      // Restore benchmarks and discoverable count, with fallback for backward compatibility
      if (gameState.benchmarks && gameState.discoverableCount !== undefined) {
        console.log("📊 Benchmarks restored from saved state:", gameState.benchmarks);
        setBenchmarks(gameState.benchmarks);
        setDiscoverableCount(gameState.discoverableCount);
      } else if (dict && sorted && gameState.initialBoard) {
        // Fallback: recalculate benchmarks for existing saves without them
        console.log("📊 Dictionary loaded, recalculating benchmarks from initialBoard...");
        const config = DIFFICULTY_CONFIG["medium"];
        const probe = probeGrid(gameState.initialBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        const bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        console.log("📊 Benchmarks recalculated from initialBoard:", bms);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
      } else {
        console.log("📊 No benchmarks in saved state, dictionary status:", {
          dict: !!dict,
          sorted: !!sorted,
          hasInitialBoard: !!gameState.initialBoard
        });
      }
      return {
        gameState,
        hasInitialBoard: !!gameState.initialBoard
      };
    }
    return false;
  };

  // Strategic save function that prevents saves during initialization
  const saveGameState = useCallback(() => {
    if (settings.mode === "daily" && !isInitializing && board && board.length > 0) {
      saveDailyState();
    }
  }, [settings.mode, isInitializing, board, saveDailyState]);
  useEffect(() => {
    let mounted = true;
    setIsInitializing(true);
    fetch("/words.txt").then(r => r.text()).then(txt => {
      if (!mounted) return;
      const words = txt.split(/\r?\n/).filter(Boolean).map(w => w.trim().toLowerCase());
      const s = new Set<string>();
      for (const w of words) if (w.length >= 3) s.add(w);
      const arr = Array.from(s);
      arr.sort();
      setDict(s);
      setSorted(arr);

      // Only generate a board for classic mode or when no specific mode is set
      // Daily and blitz modes handle their own board generation
      if (!initialMode || initialMode === "classic") {
        setIsGenerating(true);
        const newBoard = generateSolvableBoard(size, s, arr);
        const probe = probeGrid(newBoard, s, arr, K_MIN_WORDS, MAX_DFS_NODES);
        const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
        if (!mounted) return;
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        setUnlocked(new Set());
        setGameOver(false);
        setFinalGrade("None");
        setPath([]);
        setDragging(false);
        setUsedWords([]);
        setLastWordTiles(new Set());
        setScore(0);
        setStreak(0);
        setIsGenerating(false);
        toast.success("Dictionary loaded. Board ready!");
      } else {
        toast.success("Dictionary loaded. Waiting for game mode initialization...");
      }
      setIsInitializing(false);
    }).catch(() => {
      setIsInitializing(false);
      toast.error("Failed to load dictionary. Offline mode.");
    });
    return () => {
      mounted = false;
    };
  }, [initialMode, size]);

  // Dictionary-ready benchmark calculation for daily challenges
  useEffect(() => {
    if (dict && sorted && settings.mode === "daily" && board && !benchmarks && !isGenerating) {
      console.log("📊 Dictionary loaded, recalculating benchmarks for resumed daily challenge...");
      setIsGenerating(true);
      try {
        const difficulty = settings.difficulty || "medium";
        const config = DIFFICULTY_CONFIG[difficulty];
        const probe = probeGrid(board, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        const bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        console.log("📊 Benchmarks recalculated:", bms);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        toast.success("Daily Challenge benchmarks loaded!");
      } catch (error) {
        console.error("Failed to recalculate benchmarks:", error);
        toast.error("Failed to load challenge benchmarks");
      } finally {
        setIsGenerating(false);
      }
    }
  }, [dict, sorted, settings.mode, board, benchmarks, isGenerating, settings.difficulty]);
  const wordFromPath = useMemo(() => board ? path.map(p => board[p.r][p.c]).join("").toLowerCase() : "", [path, board]);

  // Display version that shows ? for Wild tiles during selection
  const displayWordFromPath = useMemo(() => {
    return path.map(p => {
      if (specialTiles[p.r][p.c].type === "wild") {
        return "?";
      }
      return board[p.r][p.c];
    }).join("").toUpperCase();
  }, [path, board, specialTiles]);
  function handleWildSubmit() {
    if (!pendingWildPath || !wildTileInputs.size || !dict) return;
    const wildcardPositions = pendingWildPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    if (wildcardPositions.length !== 1) return;
    const wildPos = wildcardPositions[0];
    const wildIndex = pendingWildPath.findIndex(p => p.r === wildPos.r && p.c === wildPos.c);

    // Create the word with the user's chosen letter
    const testWord = pendingWildPath.map((p, i) => {
      if (i === wildIndex) {
        const wildKey = `${wildPos.r}-${wildPos.c}`;
        return (wildTileInputs.get(wildKey) || '').toLowerCase();
      }
      return board[p.r][p.c];
    }).join("").toLowerCase();

    // Validate the word
    if (testWord.length < 3) {
      return;
    }
    if (!dict.has(testWord)) {
      toast.error(`Not a valid word: ${testWord.toUpperCase()}`);
      return;
    }
    if (usedWords.some(entry => entry.word === testWord)) {
      toast.warning("Already used");
      return;
    }

    // Close dialog and continue with word submission logic
    setShowWildDialog(false);
    setWildTileInputs(new Map());

    // Set the path back and continue submission with the chosen word
    setPath(pendingWildPath);
    setPendingWildPath(null);

    // Now continue with the normal submission process using the validated word
    setTimeout(() => {
      const wildKey = `${wildPos.r}-${wildPos.c}`;
      const wildLetter = wildTileInputs.get(wildKey) || '';
      submitWordWithWildLetter(testWord, pendingWildPath, wildLetter.toLowerCase());
    }, 0);
  }
  // Create a new function for multiple wild letters
  function submitWordWithWildLetters(validatedWord: string, wordPath: Pos[], wildLetters: string[]) {
    if (gameOver) {
      toast.info("Round over");
      return;
    }

    // Check daily challenge move limit
    if (settings.mode === "daily" && movesUsed >= settings.dailyMovesLimit) {
      toast.error("Daily move limit reached!");
      return;
    }
    const actualWord = validatedWord;
    const wildUsed = true;
    const hasStoneTile = wordPath.some(p => specialTiles[p.r][p.c].type === "stone");
    if (hasStoneTile) {
      toast.error("Cannot use words containing Stone tiles!");
      return;
    }
    if (lastWordTiles.size > 0) {
      const overlap = wordPath.some(p => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return;
      }
    }
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath,
      board,
      specialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      blitzMultiplier,
      activeEffects: activeEffects.filter(e => e.id !== "score_multiplier"),
      baseMode: "square",
      chainMode: "linear"
    });
    const totalGain = breakdown.total;
    setUsedWords(prev => [...prev, {
      word: actualWord,
      score: totalGain,
      breakdown
    }]);

    // Save state after successful word submission
    saveGameState();

    // Legacy variables needed for achievements and toasts
    const sharedTilesCount = lastWordTiles.size ? wordPath.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Update the wild tiles with the chosen letters permanently on the board
    const newBoard = board.map(row => [...row]);
    const wildcardPositions = wordPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    
    // Handle multiple wild tiles
    wildcardPositions.forEach((wildPos, index) => {
      if (index < wildLetters.length) {
        newBoard[wildPos.r][wildPos.c] = wildLetters[index].toUpperCase();
      }
    });

    // Remove the wild tile special type since it's now a regular letter
    const newSpecialTiles = specialTiles.map(row => [...row]);
    wildcardPositions.forEach(wildPos => {
      newSpecialTiles[wildPos.r][wildPos.c] = {
        type: null
      };
    });
    
    setBoard(newBoard);
    setSpecialTiles(newSpecialTiles);
    
    // Continue with scoring and game state updates without calling non-existent function
    
    // Rest of word submission continues in the main submitWord flow...
  }
  
  function submitWordWithWildLetter(validatedWord: string, wordPath: Pos[], wildLetter: string) {
    if (gameOver) {
      toast.info("Round over");
      return;
    }

    // Check daily challenge move limit
    if (settings.mode === "daily" && movesUsed >= settings.dailyMovesLimit) {
      toast.error("Daily move limit reached!");
      return;
    }
    const actualWord = validatedWord;
    const wildUsed = true;
    const hasStoneTile = wordPath.some(p => specialTiles[p.r][p.c].type === "stone");
    if (hasStoneTile) {
      toast.error("Cannot use words containing Stone tiles!");
      return;
    }
    if (lastWordTiles.size > 0) {
      const overlap = wordPath.some(p => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return;
      }
    }
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath,
      board,
      specialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      blitzMultiplier,
      activeEffects: activeEffects.filter(e => e.id !== "score_multiplier"),
      baseMode: "square",
      chainMode: "linear"
    });
    const totalGain = breakdown.total;
    setUsedWords(prev => [...prev, {
      word: actualWord,
      score: totalGain,
      breakdown
    }]);

    // Save state after successful word submission
    saveGameState();

    // Legacy variables needed for achievements and toasts
    const sharedTilesCount = lastWordTiles.size ? wordPath.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Update the wild tile(s) with the chosen letter(s) permanently on the board
    const newBoard = board.map(row => [...row]);
    const wildcardPositions = wordPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    
    // Handle single wild tile (backward compatibility)
    if (wildcardPositions.length === 1) {
      const wildPos = wildcardPositions[0];
      newBoard[wildPos.r][wildPos.c] = wildLetter.toUpperCase();

      // Remove the wild tile special type since it's now a regular letter
      const newSpecialTiles = specialTiles.map(row => [...row]);
      newSpecialTiles[wildPos.r][wildPos.c] = {
        type: null
      };
      
      setBoard(newBoard);
      setSpecialTiles(newSpecialTiles);
    }
    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }

    // Handle X-Factor tiles first
    const currentBoardForXFactor = newBoard.map(row => [...row]);
    const xChanged = handleXFactorTiles(
      wordPath, 
      specialTiles, 
      currentBoardForXFactor, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );

    // Handle shuffle tiles (use updated board if X-factor was triggered)
    const currentBoard = xChanged > 0 ? newBoard : currentBoardForXFactor;
    handleShuffleTiles(
      wordPath, 
      specialTiles, 
      currentBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );
    let newSpecialTiles = specialTiles.map(row => [...row]);
    wordPath.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          type: null
        };
      }
    });
    newSpecialTiles = expireSpecialTiles(newSpecialTiles);
    setSpecialTiles(newSpecialTiles);
    setLastWordTiles(new Set(wordPath.map(keyOf)));

    // Check for new achievements using shared function
    const { newAchievements, achievementBonus } = checkAndAwardAchievements(
      actualWord,
      wordPath,
      usedWords,
      unlocked,
      0,
      sharedTilesCount,
      multiplier,
      xChanged,
      true,
      board
    );

    const finalScore = score + totalGain + achievementBonus;
    setScore(finalScore);
    // Remove streak dependency - no longer needed in length-based system

    setUnlocked(prev => {
      const next = new Set(prev);
      newAchievements.forEach(id => next.add(id));
      return next;
    });

    // Show achievement toasts
    newAchievements.forEach(id => {
      const achievement = ACHIEVEMENTS[id];
      const rarityEmoji = {
        common: "🏆",
        rare: "⭐",
        epic: "💎",
        legendary: "👑"
      }[achievement.rarity];
      toast.success(`${rarityEmoji} ${achievement.label} (+${achievement.scoreBonus} pts)`, {
        duration: 4000
      });
    });
    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);

        // Target reached, no firstWin achievement
        toast.success(`Target reached: ${grade}`);
      }
    }
    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);

    // Introduce special tiles if conditions are met
    if (shouldIntroduceSpecialTiles(finalScore, benchmarks?.bronze || 100)) {
      const updatedSpecialTiles = [...newSpecialTiles];
      const emptyPositions: Pos[] = [];

      // Find empty positions (tiles without special tiles)
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (updatedSpecialTiles[r][c].type === null) {
            emptyPositions.push({
              r,
              c
            });
          }
        }
      }

      // Randomly place special tiles (1-3 tiles per trigger)
      const numTilesToPlace = Math.floor(Math.random() * 3) + 1;
      const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
      for (let i = 0; i < tilesToPlace; i++) {
        const randomIndex = Math.floor(Math.random() * emptyPositions.length);
        const pos = emptyPositions.splice(randomIndex, 1)[0];
        const specialTile = generateSpecialTile();
        if (specialTile.type !== null) {
          updatedSpecialTiles[pos.r][pos.c] = specialTile;
        }
      }
      if (tilesToPlace > 0) {
        setSpecialTiles(updatedSpecialTiles);
      }
    }
    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = settings.mode === "daily" && movesUsed + 1 >= settings.dailyMovesLimit;
        const any = hasAnyValidMove(newBoard, lastWordTiles.size ? lastWordTiles : new Set(wordPath.map(keyOf)), dict, sorted, new Set(usedWords.map(entry => entry.word)));
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            if (s >= benchmarks.platinum) grade = "Platinum";else if (s >= benchmarks.gold) grade = "Gold";else if (s >= benchmarks.silver) grade = "Silver";else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);

            // Save state when game ends
            saveGameState();
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${finalScore} (${grade})`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade}`);
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setUnlocked(prev => {
              const next = new Set(prev);
              let bonusScore = 0;
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000
                });
              }
              if (bonusScore > 0) {
                setScore(prevScore => prevScore + bonusScore);
              }
              return next;
            });
          } else {
            if (dailyMovesExceeded) {
              toast.info("Daily Challenge complete!");
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setGameOver(true);

            // Save state when game ends
            saveGameState();
          }
        }
      }
    }, 0);
  }

  function clearPath() {
    setPath([]);
    setDragging(false);
    setIsTapMode(false);
  }

  // Special tile generation functions
  function generateSpecialTile(currentScore: number = 0, gameMode: string = "classic"): SpecialTile {
    const rand = Math.random();
    let cumulative = 0;
    
    // Progressive stone spawning for classic mode
    const modifiedRarities = { ...SPECIAL_TILE_RARITIES };
    if (gameMode === "classic") {
      // Progressive stone spawn rate: base 0.05 + (score/1000) * 0.10, capped at 0.35
      const baseStoneRate = 0.05;
      const progressiveRate = Math.min(0.25, (currentScore / 1000) * 0.10);
      modifiedRarities.stone = baseStoneRate + progressiveRate;
    }
    
    for (const [type, rarity] of Object.entries(modifiedRarities)) {
      cumulative += rarity;
      if (rand <= cumulative) {
        const expiryTurns = Math.floor(Math.random() * 5) + 1; // Random 1-5 turns
        if (type === "multiplier") {
          const multiplierValues = [2, 3, 4];
          const value = multiplierValues[Math.floor(Math.random() * multiplierValues.length)];
          return {
            type: type as SpecialTileType,
            value,
            expiryTurns
          };
        }
        return {
          type: type as SpecialTileType,
          expiryTurns
        };
      }
    }
    return {
      type: null
    };
  }
  function shouldIntroduceSpecialTiles(currentScore: number, bronzeThreshold: number): boolean {
    return currentScore >= bronzeThreshold;
  }
  function createEmptySpecialTilesGrid(size: number): SpecialTile[][] {
    return Array.from({
      length: size
    }, () => Array.from({
      length: size
    }, () => ({
      type: null
    })));
  }
  function expireSpecialTiles(specialTiles: SpecialTile[][]): SpecialTile[][] {
    return specialTiles.map(row => row.map(tile => {
      if (tile.type !== null && tile.expiryTurns !== undefined) {
        const newExpiryTurns = tile.expiryTurns - 1;
        if (newExpiryTurns <= 0) {
          return {
            type: null
          }; // Expire the tile
        }
        return {
          ...tile,
          expiryTurns: newExpiryTurns
        };
      }
      return tile;
    }));
  }

  // Difficulty configurations
  const DIFFICULTY_CONFIG = {
    easy: {
      gridSize: 4,
      minWords: 8,
      scoreMultiplier: 0.7
    },
    medium: {
      gridSize: 4,
      minWords: 12,
      scoreMultiplier: 1.0
    },
    hard: {
      gridSize: 5,
      minWords: 18,
      scoreMultiplier: 1.3
    },
    expert: {
      gridSize: 6,
      minWords: 25,
      scoreMultiplier: 1.6
    }
  };
  function onNewGame() {
    setShowDifficultyDialog(true);
  }
  function startGameWithDifficulty(difficulty: "easy" | "medium" | "hard" | "expert") {
    if (user && settings.mode === "classic" && !gameOver && (score > 0 || usedWords.length > 0)) {
      saveGameResult();
    }
    
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "classic"
    }));
    setSize(newSize);
    setShowDifficultyDialog(false);
    if (dict && sorted) {
      setIsGenerating(true);
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
      try {
        const newBoard = generateSolvableBoard(newSize, dict, sorted);
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES);
        const adjustedWordCount = Math.floor(probe.words.size * config.scoreMultiplier);
        const bms = computeBenchmarksFromWordCount(adjustedWordCount, config.minWords);
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        setUnlocked(new Set());
        setGameOver(false);
        setFinalGrade("None");
        toast.success(`New ${difficulty} board ready!`);
      } finally {
        setIsGenerating(false);
      }
    } else {
      const nb = makeBoard(newSize);
      setBoard(nb);
      setBenchmarks(null);
      setDiscoverableCount(0);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    }
  }
  async function startNewPracticeGame() {
    const difficulty = "medium"; // Challenge Practice uses same config as Daily Challenge
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "practice",
      dailyMovesLimit: getDailyMovesLimit() // Use same 10-move limit as Daily Challenge
    }));
    setSize(newSize);
    if (dict && sorted) {
      setIsGenerating(true);
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
      setGameOver(false);
      setFinalGrade("None");
      setUnlocked(new Set());
      try {
        const newBoard = generateSolvableBoard(newSize, dict, sorted);
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);

        // Use same benchmark calculation as Daily Challenge
        let bms: Benchmarks;
        try {
          if (probe.analysis && user) {
            const {
              supabase
            } = await import('@/integrations/supabase/client');
            bms = await computeDynamicBenchmarks(`practice-${Date.now()}`,
            // Unique seed for practice
            probe.words.size, config.minWords, probe.analysis, supabase);
          } else {
            bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
          }
        } catch (error) {
          console.warn("Failed to compute dynamic benchmarks, falling back to static:", error);
          bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        }
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        toast.success("New practice board ready!");
      } catch (error) {
        console.error("Failed to generate practice board:", error);
        toast.error("Failed to generate new practice board");
      } finally {
        setIsGenerating(false);
      }
    } else {
      const nb = makeBoard(newSize);
      setBoard(nb);
      setBenchmarks(null);
      setDiscoverableCount(0);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    }
  }
  async function startDailyChallenge() {
    const difficulty = "medium"; // Daily challenges use medium difficulty
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    const dailySeed = getDailySeed();

    // Try to load existing daily state first
    const loadResult = await loadDailyState();
    if (loadResult && loadResult.gameState) {
      setSettings(prev => ({
        ...prev,
        difficulty,
        gridSize: newSize,
        mode: "daily",
        dailyMovesLimit: getDailyMovesLimit()
      }));
      setSize(newSize);
      toast.success("Daily Challenge resumed!");
      return;
    }

    // If no saved state, start fresh daily challenge
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "daily",
      dailyMovesLimit: getDailyMovesLimit()
    }));
    setSize(newSize);
    const newBoard = makeBoard(newSize, dailySeed);
    console.log(`Daily Challenge board generated with seed ${dailySeed}:`, newBoard[0].join(''), newBoard[1].join(''), newBoard[2].join(''), newBoard[3].join(''));

    // Reset all game state to initial values
    setPath([]);
    setDragging(false);
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setMovesUsed(0);
    setUnlocked(new Set());
    setGameOver(false);
    setFinalGrade("None");
    setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    setBoard(newBoard);
    if (dict && sorted) {
      setIsGenerating(true);
      try {
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        // Try to compute dynamic benchmarks first, fallback to static if needed
        let bms: Benchmarks;
        try {
          if (probe.analysis && user) {
            bms = await computeDynamicBenchmarks(dailySeed, probe.words.size, config.minWords, probe.analysis, supabase);
          } else if (probe.analysis) {
            bms = computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis);
          } else {
            bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
          }
        } catch (error) {
          console.error('Error computing benchmarks, falling back to static:', error);
          bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        }
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        toast.success(`Daily Challenge ${dailySeed} ready! ${settings.dailyMovesLimit} moves to make your best score.`);

        // Save the initial state with the initial board preserved (immediate save)
        await saveDailyState(newBoard, true);
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Dictionary not loaded yet, set basic state and save board
      setBenchmarks(null);
      setDiscoverableCount(0);

      // Save the initial board immediately, even without dictionary
      await saveDailyState(newBoard, true);
    }
  }
  async function resetDailyChallenge() {
    // Try to get the saved initial board from the current state
    const savedState = await dailyChallengeState.loadState();
    let initialBoard: string[][] | null = null;
    if (savedState && savedState.initialBoard) {
      initialBoard = savedState.initialBoard;
    }

    // Clear saved daily state from both database and localStorage
    await dailyChallengeState.clearState();

    // Reset to initial state
    const difficulty = "medium";
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "daily",
      dailyMovesLimit: getDailyMovesLimit()
    }));
    setSize(newSize);

    // Reset all game state to initial values
    setGameOver(false);
    setFinalGrade("None");
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setMovesUsed(0); // Reset moves to 0 as requested
    setUnlocked(new Set());
    setSpecialTiles(createEmptySpecialTilesGrid(newSize)); // Reset to initial grid state
    setPath([]);
    setDragging(false);
    if (dict && sorted) {
      setIsGenerating(true);
      try {
        let resetBoard: string[][];
        if (initialBoard) {
          // Use the saved initial board to ensure same letters
          resetBoard = initialBoard.map(row => [...row]);
          toast.success("Daily Challenge reset! Same letters, fresh start.");
        } else {
          // If no saved board, load from state or show error
          const savedState = await dailyChallengeState.loadState();
          if (savedState && savedState.initialBoard) {
            resetBoard = savedState.initialBoard.map(row => [...row]);
            toast.success("Daily Challenge reset! Same letters, fresh start.");
          } else {
            toast.error("Cannot reset: original board not found. Please restart Daily Challenge.");
            return;
          }
        }
        const probe = probeGrid(resetBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        // Try to compute dynamic benchmarks first, fallback to static if needed
        let bms: Benchmarks;
        try {
          if (probe.analysis && user) {
            bms = await computeDynamicBenchmarks(getDailySeed(), probe.words.size, config.minWords, probe.analysis, supabase);
          } else if (probe.analysis) {
            bms = computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis);
          } else {
            bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
          }
        } catch (error) {
          console.error('Error computing benchmarks, falling back to static:', error);
          bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        }
        setBoard(resetBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        setUnlocked(new Set());
        setGameOver(false);
        setFinalGrade("None");
        setIsGenerating(false);

        // Save the reset state with the original board preserved
        await saveDailyState(resetBoard, true);
      } catch (error) {
        console.error("Error resetting daily board:", error);
        setIsGenerating(false);
        toast.error("Failed to generate daily board");
      }
    }
  }

  // Consumable handlers
  const handleUseConsumable = async (consumableId: ConsumableId) => {
    if (!user || gameOver) return;
    const consumable = CONSUMABLES[consumableId];

    // Check if consumable can be used in current mode
    if (consumable.dailyModeOnly && settings.mode !== "daily") {
      toast.error("This consumable can only be used in Daily Challenge mode");
      return;
    }

    // Check inventory
    if (!consumableInventory[consumableId] || consumableInventory[consumableId].quantity <= 0) {
      toast.error("You don't have any of this consumable");
      return;
    }

    // Handle different consumable activation patterns
    switch (consumableId) {
      case "hint_revealer":
        // Check if there are words available before consuming
        const availableWords = getAvailableWordsForHint();
        if (availableWords.length === 0) {
          // No words available, end the game
          setGameOver(true);
          return;
        }

        // Words are available, consume the item and activate hint
        const success = await useConsumable(consumableId);
        if (!success) {
          toast.error("Failed to use consumable");
          return;
        }
        handleHintRevealer();
        break;
      case "extra_moves":
        // Extra moves execute immediately on tap
        const successMoves = await useConsumable(consumableId);
        if (!successMoves) {
          toast.error("Failed to use consumable");
          return;
        }
        handleExtraMoves();
        break;
      case "hammer":
        // Hammer immediately breaks all stone tiles on the grid
        if (path.length > 0) {
          toast.error("Cannot use hammer while a word is in progress");
          return;
        }
        
        // Check if user has hammer consumables in inventory
        if (!consumableInventory.hammer || consumableInventory.hammer.quantity <= 0) {
          toast.error("No hammer consumables available");
          return;
        }

        const brokenCount = await breakAllStoneTiles();
        if (brokenCount === 0) {
          toast.error("No stone tiles to break!");
          return;
        }
        break;
      case "score_multiplier":
        // Score multiplier activates/deactivates on tap, executes on word submission
        if (activatedConsumables.has(consumableId)) {
          // Deactivate if already activated
          setActivatedConsumables(prev => {
            const newSet = new Set(prev);
            newSet.delete(consumableId);
            return newSet;
          });
          removeActiveEffect(consumableId);
          toast.info("Score multiplier deactivated");
        } else {
          const successMultiplier = await useConsumable(consumableId);
          if (!successMultiplier) {
            toast.error("Failed to use consumable");
            return;
          }
          setActivatedConsumables(prev => new Set([...prev, consumableId]));
          handleScoreMultiplier();
        }
        break;
    }
  };

  // Helper function to get available words for hinting (4 letters or fewer)
  const getAvailableWordsForHint = () => {
    if (!dict || !sorted || !board) return [];
    const probe = probeGrid(board, dict, sorted, 3, MAX_DFS_NODES);
    return Array.from(probe.words)
      .filter(word => !usedWords.some(used => used.word === word) && word.length >= 3 && word.length <= 4)
      .sort((a, b) => a.length - b.length); // Prefer shorter words
  };
  const handleHintRevealer = () => {
    if (!dict || !sorted || !board) return;
    const availableWords = getAvailableWordsForHint();
    if (availableWords.length === 0) {
      setGameOver(true);
      return;
    }

    // Find the first valid word and illuminate its complete path
    const wordToReveal = availableWords[0];
    const tilesToHighlight = new Set<string>();

    // Find path for the word and highlight all tiles in the path
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c].toLowerCase() === wordToReveal[0].toLowerCase()) {
          // Found starting letter, now find the complete path for this word
          const path = findWordPath(wordToReveal, {
            r,
            c
          });
          if (path && path.length === wordToReveal.length) {
            // Highlight the entire word path
            path.forEach(pos => {
              tilesToHighlight.add(keyOf(pos));
            });
            break;
          }
        }
      }
      if (tilesToHighlight.size > 0) break;
    }
    setAffectedTiles(tilesToHighlight);
    addActiveEffect({
      id: "hint_revealer",
      type: "hint_active",
      duration: 5000,
      expiresAt: new Date(Date.now() + 5000)
    });
    setTimeout(() => {
      setAffectedTiles(new Set());
      removeActiveEffect("hint_revealer");
    }, 5000);
    toast.success(`Hint: Complete path for "${wordToReveal.toUpperCase()}" revealed!`);
  };

  // Helper function to find the path for a specific word
  const findWordPath = (word: string, startPos: Pos): Pos[] | null => {
    if (!board) return null;
    const visited = new Set<string>();
    const path: Pos[] = [startPos];
    const dfs = (pos: Pos, wordIndex: number): boolean => {
      if (wordIndex >= word.length) return true;
      const key = keyOf(pos);
      if (visited.has(key)) return false;
      if (board[pos.r][pos.c].toLowerCase() !== word[wordIndex].toLowerCase()) return false;
      visited.add(key);
      if (wordIndex === word.length - 1) return true;

      // Try all neighbors for next letter
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newPos = {
            r: pos.r + dr,
            c: pos.c + dc
          };
          if (!within(newPos.r, newPos.c, size)) continue;
          if (visited.has(keyOf(newPos))) continue;
          path.push(newPos);
          if (dfs(newPos, wordIndex + 1)) return true;
          path.pop();
        }
      }
      visited.delete(key);
      return false;
    };
    return dfs(startPos, 0) ? path : null;
  };
  const handleScoreMultiplier = () => {
    addActiveEffect({
      id: "score_multiplier",
      type: "score_boost",
      duration: 0,
      // Until next word
      data: {
        multiplier: 2.0
      }
    });
    toast.success("Next word will have 2x score!");
  };
  // New function to break all stone tiles at once
  const breakAllStoneTiles = async (): Promise<number> => {
    // Scan entire grid for stone tiles
    let stonePositions: Pos[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (specialTiles[r][c].type === "stone") {
          stonePositions.push({ r, c });
        }
      }
    }

    if (stonePositions.length === 0) {
      return 0;
    }

    // Use one hammer consumable
    const success = await useConsumable("hammer");
    if (!success) {
      toast.error("Failed to use hammer consumable");
      return 0;
    }

    // Break all stone tiles at once
    const newSpecialTiles = specialTiles.map(row => [...row]);
    stonePositions.forEach(pos => {
      newSpecialTiles[pos.r][pos.c] = { type: null };
    });
    setSpecialTiles(newSpecialTiles);

    const count = stonePositions.length;
    toast.success(`Broke ${count} stone tile${count > 1 ? 's' : ''}!`);
    console.log(`Successfully broke ${count} stone tiles`);
    return count;
  };
  const handleExtraMoves = () => {
    if (settings.mode !== "daily") {
      toast.error("Extra moves can only be used in Daily Challenge mode");
      return;
    }
    setSettings(prev => ({
      ...prev,
      dailyMovesLimit: prev.dailyMovesLimit + 3
    }));
    toast.success("Added 3 extra moves to your daily challenge!");
  };
  function startBlitzGame() {
    const difficulty = settings.difficulty;
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      gridSize: newSize,
      mode: "blitz"
    }));
    setSize(newSize);
    setGameOver(false);
    setFinalGrade("None");
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setMovesUsed(0);
    setUnlocked(new Set());
    setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    setTimeRemaining(settings.blitzTimeLimit);
    setBlitzMultiplier(1);
    setBlitzStarted(false);
    setBlitzPaused(false);
    if (dict && sorted) {
      setIsGenerating(true);
      setPath([]);
      setDragging(false);
      try {
        const newBoard = generateSolvableBoard(newSize, dict, sorted);
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES);
        const adjustedWordCount = Math.floor(probe.words.size * config.scoreMultiplier);
        const bms = computeBenchmarksFromWordCount(adjustedWordCount, config.minWords);
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        toast.success(`Blitz mode started! ${settings.blitzTimeLimit} seconds to score as high as possible!`);
      } finally {
        setIsGenerating(false);
      }
    } else {
      const nb = makeBoard(newSize);
      setBoard(nb);
      setBenchmarks(null);
      setDiscoverableCount(0);
      setPath([]);
      setDragging(false);
    }
  }
  function tryAddToPath(pos: Pos) {
    if (path.length && !neighbors(path[path.length - 1], pos)) return;
    const k = keyOf(pos);
    if (path.find(p => p.r === pos.r && p.c === pos.c)) return;

    // Check if this is a stone tile and it's blocked
    const specialTile = specialTiles[pos.r][pos.c];
    if (specialTile.type === "stone") {
      toast.warning("Stone tile is blocked!");
      return;
    }
    setPath(p => [...p, pos]);
  }
  function onTilePointerDown(pos: Pos) {
    // Only start dragging if not in tap mode
    if (!isTapMode) {
      setDragging(true);
      setPath([pos]);
    }
  }
  function onTilePointerEnter(pos: Pos) {
    if (!dragging) return;
    // allow simple backtrack by moving onto previous-previous tile
    if (path.length >= 2) {
      const prev = path[path.length - 1];
      const prev2 = path[path.length - 2];
      if (pos.r === prev2.r && pos.c === prev2.c) {
        setPath(p => p.slice(0, -1));
        return;
      }
    }
    tryAddToPath(pos);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    // Only reset tap mode if we're not on mobile or if this was actually a drag gesture
    if (!isMobile) {
      setIsTapMode(false);
    }
    submitWord();
  }

  // Touch event handlers for mobile support
  // Store initial touch tile for hammer-aware gesture detection
  const [initialTouchTile, setInitialTouchTile] = useState<{pos: Pos, isStone: boolean} | null>(null);

  function onTouchStart(e: React.TouchEvent, pos: Pos) {
    // Only prevent scrolling when game is active
    if (settings.mode === "blitz" && blitzStarted && !blitzPaused) {
      e.preventDefault(); // Prevent page scrolling
    } else if (settings.mode !== "blitz") {
      e.preventDefault(); // Prevent page scrolling for non-blitz modes
    }
    const touch = e.touches[0];
    setTouchStartPos({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    });

    // Store initial touch tile type for hammer-aware gesture detection
    const isStone = specialTiles[pos.r][pos.c].type === "stone";
    setInitialTouchTile({ pos, isStone });

    // On mobile, always start in tap mode - let gesture detection decide if it becomes a swipe
    if (isMobile) {
      setIsTapMode(true);
    } else {
      // On desktop, start dragging if not in tap mode
      if ((settings.mode !== "blitz" || blitzStarted && !blitzPaused) && !isTapMode) {
        onTilePointerDown(pos);
      }
    }

    // For hammer interactions with stone tiles, we still need to set up touch tracking
    // but we'll handle the hammer logic in onTouchEnd if it remains a tap
  }
  function onTouchMove(e: React.TouchEvent) {
    // Only prevent scrolling when game is active
    if (settings.mode === "blitz" && blitzStarted && !blitzPaused) {
      e.preventDefault(); // Prevent page scrolling
    } else if (settings.mode !== "blitz") {
      e.preventDefault(); // Prevent page scrolling for non-blitz modes
    }
    if (!touchStartPos) return;
    const touch = e.touches[0];
    const currentPos = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Calculate movement distance to detect swipe gesture
    const deltaX = Math.abs(currentPos.x - touchStartPos.x);
    const deltaY = Math.abs(currentPos.y - touchStartPos.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // More forgiving threshold and time-based detection for swipe vs tap
    const currentTime = Date.now();
    const touchDuration = touchStartPos.timestamp ? currentTime - touchStartPos.timestamp : 0;
    const MOVEMENT_THRESHOLD = 30; // Increased from 15px to 30px
    const MIN_SWIPE_TIME = 100; // Must be touching for at least 100ms to be considered a swipe

    // Only convert to swipe if significant movement AND sufficient time has passed
    if (isMobile && distance > MOVEMENT_THRESHOLD && touchDuration > MIN_SWIPE_TIME && isTapMode && !dragging) {
      console.log(`Converting tap to swipe: distance=${distance}px, duration=${touchDuration}ms`);
      setIsTapMode(false);
      setDragging(true);
    }

    // Only process move events if we're dragging
    if (!dragging) return;
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.closest('[data-tile-pos]')) {
      const tileElement = element.closest('[data-tile-pos]') as HTMLElement;
      const posStr = tileElement.getAttribute('data-tile-pos');
      if (posStr) {
        const [r, c] = posStr.split(',').map(Number);
        onTilePointerEnter({
          r,
          c
        });
      }
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    // Only prevent scrolling when game is active
    if (settings.mode === "blitz" && blitzStarted && !blitzPaused) {
      e.preventDefault(); // Prevent page scrolling
    } else if (settings.mode !== "blitz") {
      e.preventDefault(); // Prevent page scrolling for non-blitz modes
    }
    const wasInTapMode = isTapMode;
    setTouchStartPos(null);
    setInitialTouchTile(null); // Clean up initial touch tile tracking

    // Handle drag mode - submit word if we were dragging
    if ((settings.mode !== "blitz" || blitzStarted && !blitzPaused) && dragging) {
      onPointerUp();
      return;
    }

    // Handle tap mode - this was a tap, not a swipe
    if (wasInTapMode && touchStartPos && !dragging) {
      // Use stored initial tile position for reliable tap detection (especially important for hammer)
      if (initialTouchTile) {
        console.log(`Processing tap on stored tile ${initialTouchTile.pos.r},${initialTouchTile.pos.c}`);
        onTileTap(initialTouchTile.pos);
      } else {
        // Fallback to coordinate detection if stored position is unavailable
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.closest('[data-tile-pos]')) {
          const tileElement = element.closest('[data-tile-pos]') as HTMLElement;
          const posStr = tileElement.getAttribute('data-tile-pos');
          if (posStr) {
            const [r, c] = posStr.split(',').map(Number);
            const pos = { r, c };
            console.log(`Processing tap on fallback tile ${r},${c}`);
            onTileTap(pos);
          }
        }
      }
    }
  }

  // Single tap handler for tile selection
  function onTileTap(pos: Pos) {
    const currentTime = Date.now();
    const isDoubleTap = lastTapPos && lastTapPos.r === pos.r && lastTapPos.c === pos.c && currentTime - lastTapTime < 300;

    // Set tap mode when user taps (not during drag)
    if (!dragging) {
      setIsTapMode(true);
    }
    if (isDoubleTap && path.length >= 3) {
      // Double tap to submit (only if we have 3+ letters)
      submitWord();
      return;
    }

    // Handle single tap logic
    if (path.length === 0) {
      // Start new path with tap
      setPath([pos]);
    } else {
      // Check if tile is already in path
      const existingIndex = path.findIndex(p => p.r === pos.r && p.c === pos.c);
      if (existingIndex !== -1) {
        // If tapping a tile already in path, remove it and all tiles after it
        setPath(path.slice(0, existingIndex));
      } else {
        // Try to add to path (must be adjacent to last tile)
        if (path.length && neighbors(path[path.length - 1], pos)) {
          // Check if this is a stone tile and it's blocked
          const specialTile = specialTiles[pos.r][pos.c];
          if (specialTile.type === "stone") {
            toast.warning("Stone tile is blocked!");
            return;
          }
          setPath([...path, pos]);
        } else if (path.length) {
          // Not adjacent - show warning
          toast.warning("Must select adjacent tiles");
        }
      }
    }
    setLastTapTime(currentTime);
    setLastTapPos(pos);
  }

  // Submit word function for tap mode
  function submitTapWord() {
    if (path.length >= 3) {
      submitWord();
    }
  }
  function submitWord() {
    if (gameOver) {
      toast.info("Round over");
      return clearPath();
    }

    // Check daily challenge move limit
    if (settings.mode === "daily" && movesUsed >= settings.dailyMovesLimit) {
      toast.error("Daily move limit reached!");
      return clearPath();
    }
    const actualWord = wordFromPath;
    const wildUsed = false;
    const hasWildTile = path.some(p => specialTiles[p.r][p.c].type === "wild");
    if (hasWildTile && dict) {
      const wildcardPositions = path.filter(p => specialTiles[p.r][p.c].type === "wild");
      if (wildcardPositions.length > 0) {
        // Show dialog to let user choose the letter(s) - allow during blitz pause since user is mid-move
        setPendingWildPath(path);
        setShowWildDialog(true);
        return clearPath();
      }
    }
    if (!dict) {
      return clearPath();
    }
    if (actualWord.length < 3) {
      return clearPath();
    }
    if (!dict.has(actualWord)) {
      toast.error(`Not a valid word: ${actualWord.toUpperCase()}`);
      return clearPath();
    }
    if (usedWords.some(entry => entry.word === actualWord)) {
      toast.warning("Already used");
      return clearPath();
    }
    const hasStoneTile = path.some(p => specialTiles[p.r][p.c].type === "stone");
    if (hasStoneTile) {
      toast.error("Cannot use words containing Stone tiles!");
      return clearPath();
    }
    if (lastWordTiles.size > 0) {
      const overlap = path.some(p => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return clearPath();
      }
    }
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath: path,
      board,
      specialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      blitzMultiplier,
      activeEffects,
      baseMode: "hybrid",
      chainMode: "cappedLinear"
    });
    const totalGain = breakdown.total;
    setUsedWords(prev => [...prev, {
      word: actualWord,
      score: totalGain,
      breakdown
    }]);

    // Save state after successful word submission
    saveGameState();

    // Legacy variables needed for achievements, toasts, and other legacy code
    const sharedTilesCount = lastWordTiles.size ? path.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }

    // Legacy scoring removed - now using breakdown.total

    // Remove score multiplier effect after use if it was active
    const scoreMultiplierEffect = activeEffects.find(e => e.id === "score_multiplier");
    if (scoreMultiplierEffect) {
      removeActiveEffect("score_multiplier");
      // Also remove from activated consumables
      setActivatedConsumables(prev => {
        const newSet = new Set(prev);
        newSet.delete("score_multiplier");
        return newSet;
      });
    }

    // Handle X-Factor tiles first
    const currentBoardForXFactor = board.map(row => [...row]);
    const xChanged = handleXFactorTiles(
      path, 
      specialTiles, 
      currentBoardForXFactor, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );

    // Handle shuffle tiles (use updated board if X-factor was triggered)
    const currentBoard = xChanged > 0 ? board : currentBoardForXFactor;
    handleShuffleTiles(
      path, 
      specialTiles, 
      currentBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );

    let newSpecialTiles = specialTiles.map(row => [...row]);
    path.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          type: null
        };
      }
    });
    newSpecialTiles = expireSpecialTiles(newSpecialTiles);
    setSpecialTiles(newSpecialTiles);
    setLastWordTiles(new Set(path.map(keyOf)));

    // Check for new achievements using shared function
    const { newAchievements: newAchievements2, achievementBonus: achievementBonus2 } = checkAndAwardAchievements(
      actualWord,
      path,
      usedWords,
      unlocked,
      0,
      sharedTilesCount,
      multiplier,
      xChanged,
      false,
      board
    );

    const finalScore = score + totalGain + achievementBonus2;
    setScore(finalScore);
    newAchievements2.forEach(id => {
      const rarityEmoji = ACHIEVEMENTS[id].rarity === "legendary" ? "🏆" : 
                         ACHIEVEMENTS[id].rarity === "epic" ? "💎" : 
                         ACHIEVEMENTS[id].rarity === "rare" ? "⭐" : "🎯";
      toast.success(`${rarityEmoji} Achievement: ${ACHIEVEMENTS[id].label}!`);
    });
    setUnlocked(prev => {
      const next = new Set(prev);
      newAchievements2.forEach(id => next.add(id));
      return next;
    });
    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);

        // Target reached, no firstWin achievement
        toast.success(`Target reached: ${grade}`);
      }
    }
    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);

    // Introduce special tiles if conditions are met
    if (shouldIntroduceSpecialTiles(finalScore, benchmarks?.bronze || 100)) {
      const updatedSpecialTiles = [...newSpecialTiles];
      const emptyPositions: Pos[] = [];

      // Find empty positions (tiles without special tiles)
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (updatedSpecialTiles[r][c].type === null) {
            emptyPositions.push({
              r,
              c
            });
          }
        }
      }

      // Randomly place special tiles (1-3 tiles per trigger)
      const numTilesToPlace = Math.floor(Math.random() * 3) + 1;
      const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
      for (let i = 0; i < tilesToPlace; i++) {
        const randomIndex = Math.floor(Math.random() * emptyPositions.length);
        const pos = emptyPositions.splice(randomIndex, 1)[0];
        const specialTile = generateSpecialTile();
        if (specialTile.type !== null) {
          updatedSpecialTiles[pos.r][pos.c] = specialTile;
        }
      }
      if (tilesToPlace > 0) {
        setSpecialTiles(updatedSpecialTiles);
      }
    }
    clearPath();
    
    // Check if game over due to stone tiles blocking all valid words (Classic mode only)
    if (settings.mode === "classic" && dict && sorted) {
      // Create a test grid with stone tiles marked as blocked
      const testGrid = board.map((row, r) => 
        row.map((letter, c) => 
          specialTiles[r][c].type === "stone" ? "" : letter
        )
      );
      
      // Check if any valid words can still be formed
      const probe = probeGrid(testGrid, dict, sorted, 1, 100);
      if (probe.words.size === 0) {
        setGameOver(true);
        setFinalGrade("None");
        toast.error("Game Over! Stone tiles have blocked all possible words.");
        
        // Record the final score
        if (user) {
          // Game over, record result will be handled by existing game over logic
        }
      }
    }
    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = settings.mode === "daily" && movesUsed + 1 >= settings.dailyMovesLimit;
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, new Set(usedWords.map(entry => entry.word)));
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            if (s >= benchmarks.platinum) grade = "Platinum";else if (s >= benchmarks.gold) grade = "Gold";else if (s >= benchmarks.silver) grade = "Silver";else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${finalScore} (${grade})`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade}`);
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setUnlocked(prev => {
              const next = new Set(prev);
              let bonusScore = 0;
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000
                });
              }
              if (bonusScore > 0) {
                setScore(prevScore => prevScore + bonusScore);
              }
              return next;
            });
          } else {
            if (dailyMovesExceeded) {
              toast.info("Daily Challenge complete!");
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setGameOver(true);
          }
        }
      }
    }, 0);
  }

  function hasAnyValidMove(grid: string[][], mustReuse: Set<string>, wordSet: Set<string>, sortedArr: string[], used: Set<string>) {
    const N = grid.length;
    const dirs = [-1, 0, 1];
    const visited = new Set<string>();
    const stack: {
      pos: Pos;
      path: Pos[];
      word: string;
      reuse: boolean;
    }[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) stack.push({
      pos: {
        r,
        c
      },
      path: [],
      word: "",
      reuse: false
    });
    while (stack.length) {
      const cur = stack.pop()!;
      const {
        pos,
        path: pp,
        word,
        reuse
      } = cur;
      const k = keyOf(pos);
      if (pp.find(p => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      const nextReuse = reuse || mustReuse.has(k) || mustReuse.size === 0;
      if (nextWord.length >= 3 && nextReuse && wordSet.has(nextWord) && !used.has(nextWord)) return true;
      if (!binaryHasPrefix(sortedArr, nextWord)) continue;
      for (const dr of dirs) for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.r + dr,
          nc = pos.c + dc;
        if (!within(nr, nc, N)) continue;
        // adjacency and no revisit
        if (nextPath.find(p => p.r === nr && p.c === nc)) continue;
        stack.push({
          pos: {
            r: nr,
            c: nc
          },
          path: nextPath,
          word: nextWord,
          reuse: nextReuse
        });
      }
    }
    return false;
  }
  const isGameReady = !!dict;
  const shareScoreInline = () => {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const grade = finalGrade !== "None" ? finalGrade : score >= (benchmarks?.platinum || 0) ? "Platinum" : score >= (benchmarks?.gold || 0) ? "Gold" : score >= (benchmarks?.silver || 0) ? "Silver" : score >= (benchmarks?.bronze || 0) ? "Bronze" : "None";

    // Get emoji based on grade
    const gradeEmoji = grade === "Platinum" ? "💎" : grade === "Gold" ? "🥇" : grade === "Silver" ? "🥈" : grade === "Bronze" ? "🥉" : "📊";

    // Get highest single word score
    const topWordScore = usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0;
    const shareText = `🔤 Lexichain Daily ${date}\n${gradeEmoji} ${score} points (${grade})\n📝 Top word: ${topWordScore}\n\nlexichain.lovable.app`;
    if (navigator.share) {
      navigator.share({
        title: 'Lexichain Daily Challenge',
        text: shareText
      });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Copied to clipboard!");
    }
  };
  return (
    <section className="container mx-auto py-4 max-w-7xl">
      <Dialog open={showDifficultyDialog} onOpenChange={setShowDifficultyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Difficulty</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {Object.entries(DIFFICULTY_CONFIG).map(([diff, config]) => <Button key={diff} variant="outline" onClick={() => startGameWithDifficulty(diff as any)} className="justify-between p-4 h-auto">
                <div className="text-left">
                  <div className="font-semibold capitalize">{diff}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.gridSize}×{config.gridSize} grid • {config.minWords}+ discoverable words • {Math.round(config.scoreMultiplier * 100)}% scoring
                  </div>
                </div>
              </Button>)}
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2 mb-4">
        <div className="flex justify-start items-center gap-2">
          {settings.mode === "classic" && <Button variant="hero" onClick={onNewGame} disabled={!isGameReady || isGenerating} size="sm">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          
          {settings.mode === "practice" && <Button variant="outline" onClick={() => {
          startNewPracticeGame().catch(console.error);
        }} disabled={!isGameReady || isGenerating} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          <Button variant="outline" onClick={() => setShowHowToPlay(true)} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
            How to Play
          </Button>
          
          {settings.mode === "blitz" && blitzStarted && !gameOver && <Button variant="outline" onClick={() => setBlitzPaused(!blitzPaused)} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))] ml-3">
              {blitzPaused ? "▶️ Resume" : "⏸️ Pause"}
            </Button>}
          
          <Button variant="outline" onClick={onBackToTitle} size="sm" className={`bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]]`}>
            Back to Title
          </Button>
          
          {settings.mode === "daily" && gameOver}
        </div>
        
      </div>

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto sm:max-w-lg sm:max-h-[85vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>How to play</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span className="text-sm">Drag through adjacent tiles to form words</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span className="text-sm">Words must be 3+ letters and valid</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span className="text-sm">Each word must reuse ≥1 tile from previous</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span className="text-sm">Keep chaining until no valid word remains</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Special Tiles</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                      A
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Stone</div>
                      <div className="text-muted-foreground">Cannot be used</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center text-white text-xs font-bold">
                      ?
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Wild</div>
                      <div className="text-muted-foreground">Any letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute top-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute top-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">X-Factor</div>
                      <div className="text-muted-foreground">Changes adjacent corner tiles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute bottom-0 right-0 text-xs font-bold bg-white/20 px-0.5 rounded text-[10px]">
                        2x
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Multiplier</div>
                      <div className="text-muted-foreground">Boost word score</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-red-200 to-red-300 flex items-center justify-center text-red-800 text-xs font-bold relative">
                      A
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          <div className="w-3 h-3 border border-red-700 rounded-full opacity-70"></div>
                          <div className="absolute inset-0.5 w-2 h-2 border border-red-700 rounded-full opacity-50"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Shuffle</div>
                      <div className="text-muted-foreground">Randomize all letters</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Special tiles appear after reaching Bronze level and expire after a few turns.
                </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Consumable Items</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Tap a consumable in your inventory to use it</span>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔨</span>
                    <div className="text-xs">
                      <div className="font-medium">Hammer</div>
                      <div className="text-muted-foreground">Break stone tiles with a tap</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <div className="text-xs">
                      <div className="font-medium">Hint Revealer</div>
                      <div className="text-muted-foreground">Highlights 3-5 valid words for 10 seconds</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div className="text-xs">
                      <div className="font-medium">Score Multiplier</div>
                      <div className="text-muted-foreground">Doubles the score of your next word</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <div className="text-xs">
                      <div className="font-medium">Extra Moves</div>
                      <div className="text-muted-foreground">Adds 3 extra moves (Daily Challenge only)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wild Letter Input Dialog */}
      <Dialog open={showWildDialog} onOpenChange={setShowWildDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Wild Tile Letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter a letter for the Wild tile to complete your word:
            </div>
            <div className="text-center">
              <div className="text-lg font-mono bg-muted p-2 rounded">
                {pendingWildPath?.map((p, i) => {
                const isWild = specialTiles[p.r][p.c].type === "wild";
                const wildKey = `${p.r}-${p.c}`;
                const letter = isWild ? (wildTileInputs.get(wildKey) || "?").toUpperCase() : board[p.r][p.c];
                return <span key={i} className={isWild ? "text-purple-500 font-bold" : ""}>
                      {letter}
                    </span>;
              })}
              </div>
            </div>
            <div>
              <Input type="text" value={(wildTileInputs.get(`${pendingWildPath?.find(p => specialTiles[p.r][p.c].type === "wild")?.r}-${pendingWildPath?.find(p => specialTiles[p.r][p.c].type === "wild")?.c}`) || '')} onChange={e => {
                if (pendingWildPath) {
                  const wildPos = pendingWildPath.find(p => specialTiles[p.r][p.c].type === "wild");
                  if (wildPos) {
                    const wildKey = `${wildPos.r}-${wildPos.c}`;
                    const newInputs = new Map(wildTileInputs);
                    newInputs.set(wildKey, e.target.value.slice(0, 1).toUpperCase());
                    setWildTileInputs(newInputs);
                  }
                }
              }} onKeyDown={e => {
              if (e.key === 'Enter' && wildTileInputs.size > 0) {
                handleWildSubmit();
              }
            }} placeholder="Enter letter (A-Z)" className="w-full text-center text-lg font-mono" maxLength={1} autoFocus />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
              setShowWildDialog(false);
              setWildTileInputs(new Map());
              setPendingWildPath(null);
            }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleWildSubmit} disabled={wildTileInputs.size === 0 || Array.from(wildTileInputs.values()).some(v => !/[A-Z]/.test(v))} className="flex-1">
                Submit Word
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Score Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Daily Challenge Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--brand-500))]">{score} points</div>
              <div className="text-sm text-muted-foreground">
                {usedWords.length} words • {movesUsed}/{settings.dailyMovesLimit} moves
              </div>
              <div className="text-sm text-muted-foreground">
                Grade: {finalGrade}
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-2">Share this:</div>
              <div className="text-sm font-mono">
                🔤 Lexichain Daily Challenge {getDailySeed()}<br />
                {finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊"} {score} points ({finalGrade})<br />
                📝 Top word: {usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0}<br />
                🎯 {settings.dailyMovesLimit - movesUsed} moves remaining<br />
                <br />
                Play at lexichain.lovable.app
              </div>
            </div>
            <Button onClick={() => {
            const gradeEmoji = finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊";
            const topWordScore = usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0;
            const shareText = `🔤 Lexichain Daily Challenge ${getDailySeed()}\n${gradeEmoji} ${score} points (${finalGrade})\n📝 Top word: ${topWordScore}\n🎯 ${settings.dailyMovesLimit - movesUsed} moves remaining\n\nPlay at lexichain.lovable.app`;
            navigator.clipboard.writeText(shareText);
            toast.success("Copied to clipboard!");
            setShowShareDialog(false);
          }} className="w-full">
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-[auto,280px] gap-3 lg:gap-2 items-start">
        <div className="space-y-4">
          {/* Mobile QuickUse Bar */}
          {isMobile && <div className="lg:hidden">
              <QuickUseBar inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} gameState={{
            gameOver,
            isGenerating
          }} disabled={gameOver || isGenerating} />
            </div>}
          
          {/* Temporarily disabled blitz mode 
           {settings.mode === "practice" && (
            <div className="flex justify-center mb-4">
              <Button 
                onClick={() => {
                  // Reset blitz game state and start new game with current time limit
                  setBlitzStarted(false);
                  setBlitzPaused(false);
                  setTimeRemaining(settings.blitzTimeLimit);
                  setScore(0);
                  setUsedWords([]);
                  setLastWordTiles(new Set());
                  setStreak(0);
                  setGameOver(false);
                  setPath([]);
                  setDragging(false);
                  setSpecialTiles(createEmptySpecialTilesGrid(size));
                  
                  if (dict && sorted) {
                    setIsGenerating(true);
                    try {
                      const newBoard = generateSolvableBoard(size, dict, sorted);
                      const probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
                      const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
                      setBoard(newBoard);
                      setBenchmarks(bms);
                      setDiscoverableCount(probe.words.size);
                      setGameOver(false);
                    } catch (error) {
                      console.error("Failed to generate board:", error);
                      toast.error("Failed to generate new board");
                    } finally {
                      setIsGenerating(false);
                    }
                  }
                }}
                variant="outline" 
                size="sm"
                disabled={isGenerating}
                className="bg-background"
              >
                {isGenerating ? "Generating..." : "New Game"}
              </Button>
            </div>
           )}
           */}
          
          <div className="relative" onPointerUp={onPointerUp} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{
          touchAction: 'auto'
        }}>
            {/* Temporarily disabled blitz overlay
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 backdrop-blur-lg rounded-lg">
                <div className="text-center space-y-4 p-6">
                  {!blitzStarted ? (
                    <>
                      <div className="text-2xl font-bold text-foreground">Ready to Start?</div>
                      <div className="text-muted-foreground">
                        You have {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')} to find as many words as possible!
                      </div>
                      <Button 
                        onClick={() => {
                          setBlitzStarted(true);
                          
                          // Center grid on mobile when game starts
                          if (window.innerWidth <= 768) {
                            setTimeout(() => {
                              const gridElement = document.querySelector('[data-grid-container]');
                              if (gridElement) {
                                gridElement.scrollIntoView({ 
                                  behavior: 'smooth', 
                                  block: 'center',
                                  inline: 'center'
                                });
                              }
                            }, 100);
                          }
                        }}
                        variant="hero"
                        size="lg"
                        className="px-8"
                        style={{ touchAction: 'manipulation' }}
                      >
                        Start Game
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-foreground">⏸️ Paused</div>
                      <div className="text-muted-foreground">
                        Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                      <Button 
                        onClick={() => setBlitzPaused(false)}
                        variant="hero"
                        size="lg"
                        className="px-8"
                      >
                        Resume
                      </Button>
                    </>
                  )}
                </div>
              </div>
             */}
            
            <div className="grid gap-3 select-none max-w-md" data-grid-container style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            touchAction: 'auto'
          }}>
            {board && board.map((row, r) => row.map((ch, c) => {
              const k = keyOf({
                r,
                c
              });
              const idx = path.findIndex(p => p.r === r && p.c === c);
              const selected = idx !== -1;
              const reused = lastWordTiles.has(k);
              const special = specialTiles[r][c];
              const isAffected = affectedTiles.has(k);
              const getTileClasses = () => {
                // Determine current achievement level for border color
                const currentGrade = benchmarks ? score >= benchmarks.platinum ? "platinum" : score >= benchmarks.gold ? "gold" : score >= benchmarks.silver ? "silver" : score >= benchmarks.bronze ? "bronze" : "none" : "none";

                // Define border colors for each achievement level
                const getBorderColor = () => {
                  switch (currentGrade) {
                    case "platinum":
                      return "border-purple-400";
                    case "gold":
                      return "border-yellow-400";
                    case "silver":
                      return "border-gray-400";
                    case "bronze":
                      return "border-amber-600";
                    default:
                      return "border-border";
                  }
                };

                // Define background colors for last word tiles based on achievement level
                const getLastWordBackground = () => {
                  switch (currentGrade) {
                    case "platinum":
                      return "bg-purple-100 dark:bg-purple-950/30";
                    case "gold":
                      return "bg-yellow-100 dark:bg-yellow-950/30";
                    case "silver":
                      return "bg-gray-100 dark:bg-gray-950/30";
                    case "bronze":
                      return "bg-amber-100 dark:bg-amber-950/30";
                    default:
                      return "bg-secondary/60";
                  }
                };
                let baseClasses = `relative aspect-square flex items-center justify-center rounded-lg ${getBorderColor()} border-2 transition-[transform,box-shadow,background-color] duration-300 `;
                if (selected) {
                  baseClasses += "ring-2 ring-green-400 bg-green-50 shadow-[0_4px_12px_-4px_rgba(34,197,94,0.3)] scale-[0.98] dark:bg-green-950 dark:ring-green-500 ";
                } else if (isAffected) {
                  baseClasses += "bg-gradient-to-br from-yellow-300 to-orange-400 text-white animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.5)] ";
                } else if (reused) {
                  baseClasses += getLastWordBackground() + " ";
                } else {
                  baseClasses += "bg-card ";
                }

                // Special tile styling
                if (special.type === "stone") {
                  baseClasses += "bg-gradient-to-br from-gray-400 to-gray-600 text-white ";
                } else if (special.type === "wild") {
                  baseClasses += "bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 text-white ";
                } else if (special.type === "xfactor") {
                  baseClasses += "bg-gradient-to-br from-orange-400 to-red-500 text-white ";
                } else if (special.type === "multiplier") {
                  baseClasses += "bg-gradient-to-br from-blue-400 to-blue-600 text-white ";
                } else if (special.type === "shuffle") {
                  baseClasses += "bg-gradient-to-br from-red-200 to-red-300 text-red-800 ";
                }
                return baseClasses;
              };
              return <Card key={k} data-tile-pos={`${r},${c}`} onPointerDown={() => onTilePointerDown({
                r,
                c
              })} onPointerEnter={() => onTilePointerEnter({
                r,
                c
              })} onTouchStart={e => onTouchStart(e, {
                r,
                c
              })} onClick={() => onTileTap({
                r,
                c
              })} className={getTileClasses()} style={{
                touchAction: 'none'
              }}>
                  <div className="text-3xl font-semibold tracking-wide">
                    {special.type === "wild" ? "?" : ch}
                  </div>
                  {/* Rarity indicators */}
                  {special.type !== "wild" && letterRarity(ch) === 1 && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
                      +
                    </div>}
                  {special.type !== "wild" && letterRarity(ch) === 2 && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                      ★
                    </div>}
                  {selected && <div className="absolute top-1 right-2 text-xs font-medium text-muted-foreground">{idx + 1}</div>}
                  {special.type === "xfactor" && <>
                      <div className="absolute top-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute top-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
                    </>}
                  {special.type === "multiplier" && special.value && <div className="absolute bottom-1 text-xs font-bold bg-white/20 px-1 rounded">
                      {special.value}x
                    </div>}
                  {special.type === "shuffle" && <div className="absolute top-0.5 right-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" className="opacity-60">
                        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>}
                  {special.type !== null && special.expiryTurns !== undefined && <div className="absolute top-1 left-1 text-xs font-bold bg-black/30 text-white px-1 rounded-full min-w-[16px] text-center">
                      {special.expiryTurns}
                    </div>}
                </Card>;
            }))}
            {!board && <div className="col-span-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading game...</p>
                </div>
              </div>}
           </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Current:</span>
              <span className="text-lg font-semibold flex-1">{displayWordFromPath}</span>
            </div>

            {/* Submit Button for Tap Mode */}
            {(isTapMode || isMobile) && <div className="mt-2">
                <Button onClick={submitTapWord} disabled={path.length < 3} variant={path.length >= 3 ? "default" : "outline"} size="sm" className={`transition-all duration-200 ${path.length >= 3 ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-50 cursor-not-allowed"}`}>
                  Submit
                </Button>
              </div>}
            
           </div>
        </div>
        
        <aside className="space-y-2 lg:space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Score</div>
                <div className="text-2xl font-bold">{score}</div>
                {benchmarks && <div className="mt-2 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Daily Challenge Tiers</div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`flex items-center gap-1 ${score >= benchmarks.bronze ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                          🥉 Bronze
                        </span>
                        <span className={score >= benchmarks.bronze ? 'font-medium' : ''}>{benchmarks.bronze}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={`flex items-center gap-1 ${score >= benchmarks.silver ? 'text-gray-500 font-medium' : 'text-muted-foreground'}`}>
                          🥈 Silver
                        </span>
                        <span className={score >= benchmarks.silver ? 'font-medium' : ''}>{benchmarks.silver}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={`flex items-center gap-1 ${score >= benchmarks.gold ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}`}>
                          🥇 Gold
                        </span>
                        <span className={score >= benchmarks.gold ? 'font-medium' : ''}>{benchmarks.gold}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={`flex items-center gap-1 ${score >= benchmarks.platinum ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
                          💎 Platinum
                        </span>
                        <span className={score >= benchmarks.platinum ? 'font-medium' : ''}>{benchmarks.platinum}</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-secondary/20 rounded-full h-2 mt-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{
                    width: `${Math.min(100, score / benchmarks.platinum * 100)}%`
                  }} />
                    </div>
                    <div className="text-xs text-center text-muted-foreground">
                      {score >= benchmarks.platinum ? 'Platinum Achieved!' : score >= benchmarks.gold ? `${benchmarks.platinum - score} to Platinum` : score >= benchmarks.silver ? `${benchmarks.gold - score} to Gold` : score >= benchmarks.bronze ? `${benchmarks.silver - score} to Silver` : `${benchmarks.bronze - score} to Bronze`}
                    </div>
                  </div>}
                {false && <div className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                  const grade = score >= benchmarks.platinum ? "Platinum" : score >= benchmarks.gold ? "Gold" : score >= benchmarks.silver ? "Silver" : score >= benchmarks.bronze ? "Bronze" : "None";
                  const nextTarget = score < benchmarks.bronze ? ["Bronze", benchmarks.bronze] : score < benchmarks.silver ? ["Silver", benchmarks.silver] : score < benchmarks.gold ? ["Gold", benchmarks.gold] : score < benchmarks.platinum ? ["Platinum", benchmarks.platinum] : null;
                  return <>
                          <span>Grade: {grade}</span>
                          {nextTarget && <span className="ml-2">• {(nextTarget[1] as number) - score} to {nextTarget[0] as string}</span>}
                          <span className="ml-2">• Board: {benchmarks.rating}</span>
                        </>;
                })()}
                  </div>}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {score >= (benchmarks?.bronze || 100) ? "Special tiles active!" : ""}
                {gameOver && finalGrade !== "None" && <div className="mt-1 font-medium">Final: {finalGrade}</div>}
                {settings.mode === "daily" && <div className="mt-1 text-xs text-muted-foreground">
                    {settings.dailyMovesLimit - movesUsed} moves remaining
                  </div>}
                {/* Temporarily disabled blitz timer 
                 {settings.mode === "blitz" && (
                  <div className="mt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${timeRemaining <= 10 ? 'text-red-500' : timeRemaining <= 30 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        ⏰ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                    {blitzMultiplier > 1 && (
                      <div className="text-xs text-green-500">
                        {blitzMultiplier}x multiplier active!
                      </div>
                    )}
                  </div>
                 )}
                 */}
                {settings.mode === "daily" && gameOver && <Button variant="outline" size="sm" onClick={shareScoreInline} className="mt-2 h-6 px-2 text-xs bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
                    Share
                  </Button>}
          </div>
        </div>
          {usedWords.length > 0 && (() => {
            const last = usedWords[usedWords.length - 1];
            const bd = last.breakdown;
            if (!bd) return null;
            return <Card className="p-3 mb-3">
                <div className="text-xs text-muted-foreground mb-1">Last word breakdown</div>
                <div className="text-sm font-medium mb-2">{last.word.toUpperCase()} <span className="text-muted-foreground">+{last.score}</span></div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <div>Base</div><div className="text-right">+{bd.base}</div>
                  <div>Rarity</div><div className="text-right">+{Math.round(bd.rarity.bonus)}{bd.rarity.ultraCount > 0 ? <span className="ml-1 text-[10px] opacity-70">(ultra {bd.rarity.ultraCount})</span> : null}</div>
                  <div>Link</div><div className="text-right">×{bd.linkMultiplier.toFixed(1)}</div>
                  <div>Length</div><div className="text-right">+{bd.lengthBonus}</div>
                  {bd.timeBonus > 0 ? <><div>Blitz time</div><div className="text-right">+{bd.timeBonus}</div></> : null}
                  <div className="col-span-2 border-t my-1" />
                  <div>Subtotal</div><div className="text-right">+{bd.totalBeforeMultipliers}</div>
                  <div>Multipliers</div>
                  <div className="text-right">
                    {bd.multipliers.tileMultiplier}x tile {bd.multipliers.consumableMultiplier > 1 ? `· ${bd.multipliers.consumableMultiplier}x consumable` : ""}
                    <div className="text-[10px] text-muted-foreground">
                      Applied: {bd.multipliers.combinedApplied}x{bd.multipliers.capped ? <span className="ml-1 px-1 py-[1px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">capped at {bd.multipliers.cap}x</span> : null}
                    </div>
                  </div>
                  <div className="col-span-2 border-t my-1" />
                  <div className="font-semibold">Total</div><div className="text-right font-semibold">+{bd.total}</div>
                </div>
              </Card>;
          })()}

          </Card>
          

 
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">Used words ({usedWords.length})</div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSortAlphabetically(!sortAlphabetically)} className="h-5 px-2 text-xs">
                  {sortAlphabetically ? "A-Z" : "Latest"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setUsedWordsExpanded(!usedWordsExpanded)} className="h-5 w-5 p-0">
                  <ChevronDown className={`h-3 w-3 transition-transform ${usedWordsExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
            <div className={`transition-all duration-300 ease-out ${sortAlphabetically && !usedWordsExpanded ? 'max-h-16 overflow-hidden' : 'overflow-visible'}`} style={{
            maxHeight: sortAlphabetically && !usedWordsExpanded ? '4rem' : 'none'
          }}>
              {(() => {
              if (!usedWords.length) {
                return <span className="text-muted-foreground text-xs">None yet</span>;
              }
              if (sortAlphabetically) {
                const sortedWords = [...usedWords].sort((a, b) => a.word.localeCompare(b.word));
                return <div className="flex flex-wrap gap-1">
                      {sortedWords.map((entry, index) => (
                        <span key={`${entry.word}-${index}`} className="px-1.5 py-0.5 rounded text-xs bg-secondary">
                          {entry.word.toUpperCase()}
                        </span>
                      ))}
                    </div>;
              } else {
                // Latest sort - 2-column format
                const latestWords = usedWords.slice(-15).reverse();
                return <div className="space-y-1">
                      <Accordion type="multiple" className="w-full">
                        {latestWords.map((entry, index) => (
                          <AccordionItem key={`${entry.word}-${index}`} value={`${entry.word}-${index}`} className="border-b-0">
                            <AccordionTrigger className="py-1 hover:no-underline">
                              <div className="w-full flex justify-between items-center text-xs">
                                <span className="font-medium">{entry.word.toUpperCase()}</span>
                                <span className="text-muted-foreground">+{entry.score}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-2">
                              {entry.breakdown ? (
                                <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                                  <div>Base</div><div className="text-right">+{entry.breakdown.base}</div>
                                  <div>Rarity</div><div className="text-right">+{Math.round(entry.breakdown.rarity.bonus)}</div>
                                  <div>Link</div><div className="text-right">+{entry.breakdown.linkBonus}</div>
                                  <div>Length</div><div className="text-right">+{entry.breakdown.lengthBonus}</div>
                                  {entry.breakdown.timeBonus > 0 ? (
                                    <>
                                      <div>Blitz time</div><div className="text-right">+{entry.breakdown.timeBonus}</div>
                                    </>
                                  ) : null}
                                  <div className="col-span-2 border-t my-1" />
                                  <div>Subtotal</div><div className="text-right">+{entry.breakdown.totalBeforeMultipliers}</div>
                                  <div>Multipliers</div>
                                  <div className="text-right">
                                    {entry.breakdown.multipliers.tileMultiplier}x tile {entry.breakdown.multipliers.consumableMultiplier > 1 ? `· ${entry.breakdown.multipliers.consumableMultiplier}x consumable` : ""}
                                    <div className="text-[10px] text-muted-foreground">
                                      Applied: {entry.breakdown.multipliers.combinedApplied}x{entry.breakdown.multipliers.capped ? (
                                        <span className="ml-1 px-1 py-[1px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">capped</span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="col-span-2 border-t my-1" />
                                  <div className="font-semibold">Total</div><div className="text-right font-semibold">+{entry.breakdown.total}</div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground">No breakdown available</div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>;
              }
            })()}
            </div>
          </Card>


          {/* Consumables Inventory */}
          <ConsumableInventoryPanel inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} disabled={gameOver || isGenerating} activatedConsumables={activatedConsumables} user={user} />

        </aside>
      </div>
      
      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </section>
  );
}

export default WordPathGame;
