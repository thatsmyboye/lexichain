import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, computeBoardSpecificBenchmarks, computeDynamicBenchmarks, type Benchmarks, type BoardAnalysis } from "@/lib/benchmarks";
import { analyzeBoardComposition, createBoardAnalysisForBenchmarks } from "@/lib/boardAnalysis";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";
import { calculateXpGain } from "@/lib/progression";
import { supabase } from "@/integrations/supabase/client";
import { useDailyChallengeState } from "@/hooks/useDailyChallengeState";
import { useGoals } from "@/hooks/useGoals";
import { useConsumables } from "@/hooks/useConsumables";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { ConsumableInventoryPanel, QuickUseBar } from "@/components/consumables/ConsumableInventory";
import { CONSUMABLES, ACHIEVEMENT_CONSUMABLE_REWARDS, type ConsumableId } from "@/lib/consumables";
import type { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";
import { getDailyChallengeDate } from "@/utils/dateUtils";
import { saveDailyChallengeResultBulletproof, type SaveProgress } from "@/utils/dailyChallengeResultSaver";
import { DailyChallengeSaveIndicator } from "@/components/ui/daily-challenge-save-indicator";
import { SpecialTilePreview } from "@/components/ui/special-tile-preview";
import { previewNextSpecialTiles } from "@/utils/specialTilePreview";
import { dictionaryManager } from "@/utils/dictionaryManager";
import { getPuzzleById, getNextPuzzle, type PuzzleBoard } from "@/lib/puzzleBoards";
import { useTileSkin } from "@/hooks/useTileSkin";
import { getBenchmarkColor } from "@/lib/tileSkins";
import {
  type WaveChallenge,
  type BossWave,
  type PowerUp,
  type ActivePowerUp,
  type ComboState,
  type ShopItem,
  type ChoiceEvent,
  type SurvivalState,
  type PlayerPerformance,
  getRandomWaveChallenge,
  getRandomBossWave,
  getRandomPowerUp,
  POWER_UPS,
  type PowerUpType,
  shouldShowShop,
  shouldTriggerEvent
} from "@/lib/survivalMode";
import {
  validateWaveChallenge,
  isChallengeComplete,
  validateBossWave,
  updateCombo,
  applyPowerUpEffect,
  checkLifeRecovery,
  generateShopItems,
  generateRandomEvent,
  applyEventEffect,
  calculateObstacleCount,
  updatePerformance
} from "@/lib/survivalModeLogic";
import {
  LivesDisplay,
  WaveChallengeDisplay,
  BossWaveDisplay,
  ComboDisplay,
  PowerUpsInventory,
  ShopModal,
  ChoiceEventModal,
  WaveCompleteModal
} from "@/components/game/SurvivalModeUI";
type Pos = {
  r: number;
  c: number;
};
const keyOf = (p: Pos) => `${p.r},${p.c}`;
const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) <= 1;

// Special tile types
type SpecialTileType = "stone" | "wild" | "xfactor" | "multiplier" | "shuffle"
  | "freeze" | "decay" | "mirror" | "magnet" | "bomb" | "chain" | "ghost" | "tax" | null;
type SpecialTile = {
  type: SpecialTileType;
  value?: number;
  expiryTurns?: number;
  frozen?: boolean;
};
type GameMode = "classic" | "target" | "daily" | "practice" | "blitz" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
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

// Centralized Q-U adjacency validation and fixing function
function validateAndFixQUAdjacency(
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

  // Use centralized Q-U adjacency validation
  const validation = validateAndFixQUAdjacency(board, size, letterCounts, seed, false);
  return validation.board;
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
  // Use the centralized date utility for consistency
  return getDailyChallengeDate();
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

// Enhanced powerups tile rarities (used when toggle is on and mode is not daily)
const ENHANCED_TILE_RARITIES: Record<string, number> = {
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

function isEnhancedPowerupsEnabled(): boolean {
  return localStorage.getItem('lexichain-enhanced-powerups') === 'true';
}

// Common low-value letters used by Decay and Magnet effects
const LOW_VALUE_LETTERS = ["A", "E", "I", "O", "U", "S", "T", "N", "R"];
const MAGNET_VOWELS = ["A", "E", "I", "O", "U"];

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
// Multiplier cap removed - multipliers can now stack without limit
function computeScoreBreakdown(params: {
  actualWord: string;
  wordPath: Pos[];
  board: string[][];
  specialTiles: SpecialTile[][];
  lastWordTiles: Set<string>;
  streak: number;
  mode: "classic" | "daily" | "target" | "practice" | "blitz" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
  blitzMultiplier: number;
  timeAttackSpeedMultiplier?: number;
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
    timeAttackSpeedMultiplier = 1.0,
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

  const timeBonus = 0; // Removed blitz functionality

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
    case "blitz":
      modeMultiplier = blitzMultiplier;
      break;
    default:
      modeMultiplier = 1;
  }
  
  const combinedMultiplierRaw = tileMultiplier * consumableMultiplier * modeMultiplier;
  const combinedApplied = combinedMultiplierRaw; // No cap - multipliers stack freely
  const capped = false;
  const totalBeforeMultipliers = Math.round((base + rarityBonus + lengthBonus + chainBonus + timeBonus) * linkMultiplier);
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
    timeBonus,
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

function handleXFactorTiles(
  wordPath: Pos[],
  specialTiles: SpecialTile[][],
  currentBoard: string[][],
  size: number,
  setBoard: (board: string[][]) => void,
  setSpecialTiles: (tiles: SpecialTile[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): { xChanged: number, board: string[][] } {
  const xFactorTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "xfactor");
  let xChanged = 0;
  let resultBoard = currentBoard;
  
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
    setAffectedTiles(changedTileKeys);
    xChanged = changedTileKeys.size;

    setTimeout(() => {
      setAffectedTiles(new Set());
    }, 1000);

    toast.info("X-Factor activated! Adjacent tiles transformed!");
  }
  
  return { xChanged, board: resultBoard };
}

// Apply Magnet spawn effect: replace orthogonal neighbors with random vowels
function applyMagnetSpawnEffect(
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
function applyFreezeSpawnEffect(
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
function processDecaySpread(
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
function handleBombBlast(
  bombPos: Pos,
  board: string[][],
  specialTiles: SpecialTile[][],
  size: number,
  setBoard: (board: string[][]) => void,
  setSpecialTiles: (tiles: SpecialTile[][]) => void,
  setAffectedTiles: (tiles: Set<string>) => void
): string[][] {
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
  
  return validation.board;
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
  onBackToAdvancedModes,
  initialMode = "classic",
  initialPuzzleId
}: {
  onBackToTitle?: () => void;
  onBackToAdvancedModes?: () => void;
  initialMode?: "classic" | "daily" | "practice" | "blitz" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
  initialPuzzleId?: string;
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
  const { syncBackupResults } = useOfflineSync();
  const isMobile = useIsMobile();
  const { skin } = useTileSkin();
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
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);
  const [finalGrade, setFinalGrade] = useState<"None" | "Bronze" | "Silver" | "Gold" | "Platinum">("None");
  const [streak, setStreak] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [usedWordsExpanded, setUsedWordsExpanded] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [showXpGain, setShowXpGain] = useState(false);
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
  const [newWildTiles, setNewWildTiles] = useState<Set<string>>(new Set());

  // Consumable activation states
  const [activatedConsumables, setActivatedConsumables] = useState<Set<ConsumableId>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  const [blitzMultiplier, setBlitzMultiplier] = useState(1);
  const [blitzStarted, setBlitzStarted] = useState(false);
  const [blitzPaused, setBlitzPaused] = useState(false);
  
  // Advanced mode states
  const [timeAttackTimeRemaining, setTimeAttackTimeRemaining] = useState(60);
  const [timeAttackStarted, setTimeAttackStarted] = useState(false);
  const [timeAttackWordsFound, setTimeAttackWordsFound] = useState(0);
  const [timeAttackSpeedMultiplier, setTimeAttackSpeedMultiplier] = useState(1.0);
  const [endlessDifficulty, setEndlessDifficulty] = useState(1);

  // Enhanced Survival Mode State
  const [survivalLives, setSurvivalLives] = useState(3);
  const [survivalMaxLives, setSurvivalMaxLives] = useState(5);
  const [survivalWave, setSurvivalWave] = useState(1);
  const [survivalWordsThisWave, setSurvivalWordsThisWave] = useState(0);
  const [survivalBossWordRequired, setSurvivalBossWordRequired] = useState(false);
  const [survivalCurrentChallenge, setSurvivalCurrentChallenge] = useState<WaveChallenge | null>(null);
  const [survivalCurrentBoss, setSurvivalCurrentBoss] = useState<BossWave | null>(null);
  const [survivalChallengeProgress, setSurvivalChallengeProgress] = useState(0);
  const [survivalBossProgress, setSurvivalBossProgress] = useState(0);
  const [survivalWaveScore, setSurvivalWaveScore] = useState(0);
  const [survivalActivePowerUps, setSurvivalActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [survivalInventoryPowerUps, setSurvivalInventoryPowerUps] = useState<PowerUp[]>([]);
  const [survivalShields, setSurvivalShields] = useState(0);
  const [survivalComboState, setSurvivalComboState] = useState<ComboState>({
    currentCombo: 0,
    maxCombo: 0,
    comboMultiplier: 1.0,
    comboActive: false,
    lastWordTime: 0
  });
  const [survivalShowShop, setSurvivalShowShop] = useState(false);
  const [survivalPendingEvent, setSurvivalPendingEvent] = useState<ChoiceEvent | null>(null);
  const [survivalPerfectWaveStreak, setSurvivalPerfectWaveStreak] = useState(0);
  const [survivalLifeFragments, setSurvivalLifeFragments] = useState(0);
  const [survivalMistakesThisWave, setSurvivalMistakesThisWave] = useState(0);
  const [survivalPerformance, setSurvivalPerformance] = useState<PlayerPerformance>({
    averageWordLength: 4.5,
    averageCombo: 0,
    successRate: 1.0,
    averageTimePerWord: 5,
    mistakeCount: 0
  });
  const [survivalDifficultyFrozen, setSurvivalDifficultyFrozen] = useState(0);
  const [survivalChallengeTimeRemaining, setSurvivalChallengeTimeRemaining] = useState<number | undefined>(undefined);
  const [survivalPointsMultiplier, setSurvivalPointsMultiplier] = useState(1.0);
  const [survivalShowWaveComplete, setSurvivalShowWaveComplete] = useState(false);
  const [survivalWaveCompleteData, setSurvivalWaveCompleteData] = useState<any>(null);

  const [zenHintsUsed, setZenHintsUsed] = useState(0);
  const [zenUndoStack, setZenUndoStack] = useState<Array<{board: string[][], specialTiles: SpecialTile[][], usedWords: typeof usedWords, score: number}>>([]);
  
  // Puzzle mode states
  const [puzzleMode, setPuzzleMode] = useState(false);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null);
  const [puzzleRequiredWords, setPuzzleRequiredWords] = useState<Set<string>>(new Set());
  const [puzzleFoundWords, setPuzzleFoundWords] = useState<Set<string>>(new Set());
  const [puzzleMovesRemaining, setPuzzleMovesRemaining] = useState(10);
  const [puzzleOptionalWords, setPuzzleOptionalWords] = useState<Set<string>>(new Set());
  const [endlessStarted, setEndlessStarted] = useState(false);
  const [survivalStarted, setSurvivalStarted] = useState(false);
  const [zenStarted, setZenStarted] = useState(false);
  const [chaosStarted, setChaosStarted] = useState(false);
  
  // Zen mode hint highlighting
  const [hintHighlight, setHintHighlight] = useState<Pos[] | null>(null);

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
    } else if (initialMode === "time_attack") {
      setSettings(prev => ({ ...prev, mode: "time_attack" }));
      setTimeAttackTimeRemaining(60);
      setTimeAttackStarted(false);
      setTimeAttackWordsFound(0);
      setTimeAttackSpeedMultiplier(1.0);
    } else if (initialMode === "endless") {
      setSettings(prev => ({ ...prev, mode: "endless" }));
      setEndlessDifficulty(1);
    } else if (initialMode === "puzzle") {
      setSettings(prev => ({ ...prev, mode: "puzzle" }));
      // Puzzle initialization is handled by loadPuzzle() when initialPuzzleId is provided
    } else if (initialMode === "survival") {
      setSettings(prev => ({ ...prev, mode: "survival" }));
      setSurvivalLives(3);
      setSurvivalWave(1);
    } else if (initialMode === "zen") {
      setSettings(prev => ({ ...prev, mode: "zen" }));
      setZenHintsUsed(0);
      setZenUndoStack([]);
    } else if (initialMode === "chaos") {
      setSettings(prev => ({ ...prev, mode: "chaos" }));
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

  // Time Attack timer with visual warnings
  useEffect(() => {
    if (settings.mode === "time_attack" && timeAttackStarted && !gameOver) {
      const interval = setInterval(() => {
        setTimeAttackTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Visual warnings at 30s and 10s
          if (newTime === 30) {
            toast.warning('⏰ 30 seconds remaining!', { duration: 2000 });
          } else if (newTime === 10) {
            toast.error('⚡ 10 seconds left!', { duration: 2000 });
          }
          
          if (newTime <= 0) {
            // Time's up! Calculate and display XP, then end game
            const longestWord = usedWords.reduce((longest, wordEntry) => 
              wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
            );
            
            const xpGain = calculateXpGain({
              baseScore: score,
              wordsFound: usedWords.length,
              longestWord: longestWord.length,
              gameMode: settings.mode,
              difficulty: settings.difficulty,
              timeBonus: 0,
              streakBonus: 0,
              perfectGame: false
            });
            
            setXpGained(xpGain);
            setShowXpGain(true);
            
            // Hide XP gain display after 5 seconds
            setTimeout(() => setShowXpGain(false), 5000);
            
            // Show completion toast
            toast.success(`⏱️ Time Attack Complete! Score: ${score} • +${xpGain} XP`, {
              duration: 4000
            });
            
            setGameOver(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [settings.mode, timeAttackStarted, gameOver, usedWords, score, settings.difficulty]);

  // Save standard game result and update goals when game ends
  const saveGameResult = useCallback(async () => {
    if (settings.mode === "daily" || settings.mode === "practice" || !gameOver) return;
    if (!user) {
      console.log("Cannot save XP - user not logged in");
      return;
    }
    
    const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");
    
    // Calculate XP gain
    const xpGain = calculateXpGain({
      baseScore: score,
      wordsFound: usedWords.length,
      longestWord: longestWord.length,
      gameMode: settings.mode,
      difficulty: settings.difficulty,
      timeBonus: 0,
      streakBonus: 0,
      perfectGame: finalGrade === "Platinum"
    });
    
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
      
      // Save game result
      const { data, error } = await supabase
        .from("standard_game_results")
        .insert(gameResult)
        .select()
        .single();
      
      if (error) throw error;

      // Update user's total XP with retry logic for mobile
      let xpUpdateSuccess = false;
      let retries = 3;
      
      while (!xpUpdateSuccess && retries > 0) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("total_xp")
            .eq("user_id", user.id)
            .single();
          
          if (profileError) throw profileError;
          
          const newTotalXp = (profileData?.total_xp || 0) + xpGain;
          
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ total_xp: newTotalXp })
            .eq("user_id", user.id);
          
          if (updateError) throw updateError;
          
          xpUpdateSuccess = true;
          console.log(`✅ XP saved: +${xpGain} XP (Total: ${newTotalXp})`);
        } catch (xpError) {
          retries--;
          console.error(`XP save attempt failed (${retries} retries left):`, xpError);
          
          if (retries > 0) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          } else {
            // Store XP locally for later sync if all retries fail
            const pendingXp = localStorage.getItem('pending_xp') || '0';
            localStorage.setItem('pending_xp', String(parseInt(pendingXp) + xpGain));
            console.log(`📱 XP stored locally for later sync: ${xpGain}`);
            toast.warning("XP will be synced when connection improves");
          }
        }
      }
    } catch (error) {
      console.error("Error saving game result:", error);
      toast.error("Failed to save game result");
    }
  }, [settings.mode, settings.difficulty, gameOver, user, usedWords, score, finalGrade, movesUsed, gameStartTime, size, unlocked]);

  // Bulletproof daily challenge result saving
  const saveDailyChallengeResult = async () => {
    if (!user || settings.mode !== "daily" || !gameOver) return;
    
    // Prepare enhanced data for the progressive save strategy
    const detailedAnalysis = analyzeBoardComposition(board);
    const enhancedData = {
      board_analysis: {
        gridSize: detailedAnalysis.gridSize,
        wordCount: discoverableCount,
        rarityScore: detailedAnalysis.rarityScorePotential,
        avgWordLength: detailedAnalysis.avgWordLength,
        connectivityScore: detailedAnalysis.connectivityScore,
        maxScorePotential: detailedAnalysis.maxScorePotential,
        difficultyScore: detailedAnalysis.difficultyScore
      },
      word_count: discoverableCount,
      grid_size: board.length
    };
    
    // Save board analysis to database separately (non-blocking)
    try {
      const challengeDate = getDailyChallengeDate();
      await supabase.rpc('save_daily_challenge_board_analysis', {
        challenge_date: challengeDate,
        word_count: discoverableCount,
        grid_size: board.length,
        rarity_score_potential: detailedAnalysis.rarityScorePotential,
        avg_word_length: detailedAnalysis.avgWordLength,
        connectivity_score: detailedAnalysis.connectivityScore,
        max_score_potential: detailedAnalysis.maxScorePotential,
        letter_distribution: Object.fromEntries(detailedAnalysis.letterDistribution)
      });
    } catch (boardAnalysisError) {
      console.warn('Failed to save board analysis (non-critical):', boardAnalysisError);
    }
    
    // Use bulletproof save with progress feedback
    const saveSuccess = await saveDailyChallengeResultBulletproof(
      user,
      score,
      finalGrade,
      enhancedData,
      (progress) => {
        setSaveProgress(progress);
      }
    );
    
    if (!saveSuccess) {
      console.log('[Daily Challenge] Result saved to local backup for later sync');
    }
    
    // Clear progress after a delay to show final state
    setTimeout(() => setSaveProgress(null), 3000);
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

  // Auto-save game result when game ends (for standard modes)
  useEffect(() => {
    if (gameOver && user && settings.mode !== "daily" && settings.mode !== "practice") {
      saveGameResult();
    }
  }, [gameOver, user, settings.mode, saveGameResult]);

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
  
  // Puzzle mode helpers
  const savePuzzleCompletion = async (lastWord: string) => {
    if (!user || !currentPuzzleId) return;
    
    const puzzle = getPuzzleById(currentPuzzleId);
    if (!puzzle) return;
    
    const optionalFound = Array.from(puzzleFoundWords).filter(
      w => puzzle.optionalWords?.includes(w)
    ).length;
    
    try {
      const { error } = await supabase
        .from('puzzle_completions' as any)
        .upsert({
          user_id: user.id,
          puzzle_id: currentPuzzleId,
          moves_used: puzzle.maxMoves - puzzleMovesRemaining + 1,
          optional_words_found: optionalFound,
          score: score,
          completed_at: new Date().toISOString()
        });
      
      if (!error) {
        // Award XP for puzzle completion
        const xpGain = puzzle.xpReward + (optionalFound * 20);
        setXpGained(xpGain);
        setShowXpGain(true);
        setTimeout(() => setShowXpGain(false), 5000);
        
        toast.success(`🧩 Puzzle Complete! +${xpGain} XP`, {
          description: `All required words found! ${optionalFound} bonus words.`
        });
        
        setGameOver(true);
      }
    } catch (err) {
      console.error('Error saving puzzle completion:', err);
    }
  };
  
  const loadPuzzle = (puzzleId: string) => {
    const puzzle = getPuzzleById(puzzleId);
    if (!puzzle || !dict || !sorted) return;
    
    setPuzzleMode(true);
    setCurrentPuzzleId(puzzleId);
    setPuzzleRequiredWords(new Set(puzzle.requiredWords.map(w => w.toUpperCase())));
    setPuzzleFoundWords(new Set());
    setPuzzleMovesRemaining(puzzle.maxMoves);
    setPuzzleOptionalWords(new Set((puzzle.optionalWords || []).map(w => w.toUpperCase())));
    
    // Set the fixed puzzle board
    setBoard(puzzle.board.map(row => [...row]));
    setSize(puzzle.board.length);
    setUsedWords([]);
    setScore(0);
    setStreak(0);
    setGameOver(false);
    setPath([]);
    
    // Calculate benchmarks for the puzzle board
    const probe = probeGrid(puzzle.board, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
    const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
    setBenchmarks(bms);
    setDiscoverableCount(probe.words.size);
    
    toast.success(`🧩 ${puzzle.name} loaded! Find all required words in ${puzzle.maxMoves} moves.`);
  };
  // Enhanced dictionary loading useEffect
  useEffect(() => {
    let mounted = true;
    setIsInitializing(true);
    
    dictionaryManager.loadDictionary()
      .then(({ dict, sorted, status }) => {
        if (!mounted) return;
        
        setDict(dict);
        setSorted(sorted);
        console.log("📖 Enhanced dictionary loaded:", status);
        
          // Only generate a board for classic mode or when no specific mode is set
          // Daily and blitz modes handle their own board generation
          if (!initialMode || initialMode === "classic" || initialMode === "time_attack" || initialMode === "zen" || initialMode === "endless" || initialMode === "puzzle" || initialMode === "survival" || initialMode === "chaos") {
            setIsGenerating(true);
            let newBoard: string[][];
            let probe: any;
            let bms: Benchmarks | null = null;
            
            // Puzzle mode boards are loaded via loadPuzzle(), skip board generation here
            if (initialMode !== "puzzle") {
              newBoard = generateSolvableBoard(size, dict, sorted);
              probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
              
              if (!mounted) return;
              setBoard(newBoard);
              if (bms) setBenchmarks(bms);
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
              setMovesUsed(0);
              setIsGenerating(false);
              
              // Auto-start endless mode when board is ready
              if (initialMode === "endless") {
                setEndlessStarted(true);
                setEndlessDifficulty(1);
                toast.success('🎯 Endless Mode Started! Clear all words to advance!', { duration: 3000 });
              } else {
                toast.success(`Dictionary loaded (${status.wordCount.toLocaleString()} words). Board ready!`);
              }
            } else {
              // Puzzle mode - just load dictionary, board will be loaded via loadPuzzle()
              setIsGenerating(false);
            }
          } else {
            toast.success(`Dictionary loaded (${status.wordCount.toLocaleString()} words). Waiting for game mode initialization...`);
          }
          setIsInitializing(false);
        })
        .catch((error) => {
          if (!mounted) return;
          console.error("Dictionary loading failed:", error);
          setIsInitializing(false);
          toast.error("Failed to load dictionary. Please refresh the page.");
        });
    
    return () => {
      mounted = false;
    };
  }, [initialMode, size]);
  
  // Puzzle mode initialization
  useEffect(() => {
    if (initialPuzzleId && dict && sorted && !puzzleMode) {
      loadPuzzle(initialPuzzleId);
    }
  }, [initialPuzzleId, dict, sorted]);

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
  // Resolves the word from the path, handling Ghost (skip) and Mirror (copy previous) tiles
  const wordFromPath = useMemo(() => {
    if (!board) return "";
    const letters: string[] = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const tile = specialTiles[p.r][p.c];
      if (tile.type === "ghost") continue; // Ghost contributes no letter
      if (tile.type === "mirror") {
        if (letters.length > 0) {
          letters.push(letters[letters.length - 1]); // Copy previous letter
        }
        // If no previous letter exists, mirror contributes nothing
      } else {
        letters.push(board[p.r][p.c]);
      }
    }
    return letters.join("").toLowerCase();
  }, [path, board, specialTiles]);

  // Display version that shows ? for Wild, Ghost as a bridge icon, Mirror as mirrored letter
  const displayWordFromPath = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const tile = specialTiles[p.r][p.c];
      if (tile.type === "wild") {
        parts.push("?");
      } else if (tile.type === "ghost") {
        // Ghost is skipped in display — it contributes no letter
        continue;
      } else if (tile.type === "mirror" && parts.length > 0) {
        parts.push(parts[parts.length - 1]);
      } else {
        parts.push(board[p.r][p.c]);
      }
    }
    return parts.join("").toUpperCase();
  }, [path, board, specialTiles]);
  function handleWildSubmit() {
    if (!pendingWildPath || !wildTileInputs.size || !dict) return;
    const wildcardPositions = pendingWildPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    if (wildcardPositions.length !== 1) return;
    const wildPos = wildcardPositions[0];
    const wildIndex = pendingWildPath.findIndex(p => p.r === wildPos.r && p.c === wildPos.c);

    // Create the word with the user's chosen letter, respecting ghost/mirror behavior
    const letters: string[] = [];
    for (let i = 0; i < pendingWildPath.length; i++) {
      const p = pendingWildPath[i];
      const tile = specialTiles[p.r][p.c];
      
      if (i === wildIndex) {
        const wildKey = `${wildPos.r}-${wildPos.c}`;
        letters.push((wildTileInputs.get(wildKey) || '').toLowerCase());
      } else if (tile.type === "ghost") {
        continue; // Ghost contributes no letter
      } else if (tile.type === "mirror") {
        if (letters.length > 0) {
          letters.push(letters[letters.length - 1]); // Copy previous letter
        }
        // If no previous letter exists, mirror contributes nothing
      } else {
        letters.push(board[p.r][p.c]);
      }
    }
    const testWord = letters.join("").toLowerCase();

    // Validate the word using enhanced dictionary manager
    const validation = dictionaryManager.validateWord(testWord);
    if (!validation.isValid) {
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
      timeAttackSpeedMultiplier,
      activeEffects,
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

    // Apply Q-U adjacency validation if any Q letters were placed
    const hasNewQ = wildcardPositions.some((wildPos, index) => 
      index < wildLetters.length && wildLetters[index].toUpperCase() === 'Q'
    );
    const validatedBoard = hasNewQ ? 
      validateAndFixQUAdjacency(newBoard, size, undefined, undefined, true).board : 
      newBoard;

    // Remove the wild tile special type since it's now a regular letter
    const newSpecialTiles = specialTiles.map(row => [...row]);
    wildcardPositions.forEach(wildPos => {
      newSpecialTiles[wildPos.r][wildPos.c] = {
        type: null
      };
    });
    
    setBoard(validatedBoard);
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
    
    // Check puzzle mode move limit
    if (puzzleMode && puzzleMovesRemaining <= 0) {
      toast.error("Puzzle move limit reached!");
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
      timeAttackSpeedMultiplier,
      activeEffects,
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

      // Apply Q-U adjacency validation if a Q letter was placed
      const validatedBoard = wildLetter.toUpperCase() === 'Q' ? 
        validateAndFixQUAdjacency(newBoard, size, undefined, undefined, true).board : 
        newBoard;

      // Remove the wild tile special type since it's now a regular letter
      const newSpecialTiles = specialTiles.map(row => [...row]);
      newSpecialTiles[wildPos.r][wildPos.c] = {
        type: null
      };
      
      setBoard(validatedBoard);
      setSpecialTiles(newSpecialTiles);
    }
    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }
    
    // Save state for Zen mode undo (before making changes)
    if (settings.mode === "zen") {
      setZenUndoStack(prev => [...prev, {
        board: board ? board.map(row => [...row]) : [],
        specialTiles: specialTiles.map(row => row.map(tile => ({ ...tile }))),
        usedWords: [...usedWords],
        score: score
      }]);
    }

    // Handle X-Factor tiles first and track board state through all effects
    let trackedBoard = newBoard.map(row => [...row]);
    const xFactorResult = handleXFactorTiles(
      wordPath, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );
    const xChanged = xFactorResult.xChanged;
    trackedBoard = xFactorResult.board;

    // Handle shuffle tiles (use updated board from X-factor)
    trackedBoard = handleShuffleTiles(
      wordPath, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );

    // Handle Bomb tile blasts (after scoring, before clearing path tiles)
    const bombTilesInPath = wordPath.filter(p => specialTiles[p.r][p.c].type === "bomb");
    if (bombTilesInPath.length > 0) {
      for (const bombPos of bombTilesInPath) {
        trackedBoard = handleBombBlast(bombPos, trackedBoard, specialTiles, size, setBoard, setSpecialTiles, setAffectedTiles);
      }
    }

    let newSpecialTiles = specialTiles.map(row => [...row]);
    wordPath.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          ...specialTiles[p.r][p.c],
          type: null
        };
      }
    });

    // Process Decay spread before expiry (enhanced powerups only, not daily)
    if (isEnhancedPowerupsEnabled() && settings.mode !== "daily") {
      const decayResult = processDecaySpread(newSpecialTiles, trackedBoard, size);
      newSpecialTiles = decayResult.tiles;
      trackedBoard = decayResult.board;
      setBoard(trackedBoard);
    }

    newSpecialTiles = expireSpecialTiles(newSpecialTiles);

    // Clear frozen flags from tiles whose adjacent Freeze tile expired
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newSpecialTiles[r][c].frozen) {
          // Check if any adjacent tile is still a Freeze tile
          const orthogonal = [
            { r: r - 1, c: c }, { r: r + 1, c: c },
            { r: r, c: c - 1 }, { r: r, c: c + 1 },
          ];
          const stillFrozen = orthogonal.some(
            adj => within(adj.r, adj.c, size) && newSpecialTiles[adj.r][adj.c].type === "freeze"
          );
          if (!stillFrozen) {
            newSpecialTiles[r][c] = { ...newSpecialTiles[r][c], frozen: false };
          }
        }
      }
    }

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
        const grade = settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);
        
        // Calculate and display XP gained
        const longestWord = usedWords.reduce((longest, wordEntry) => 
          wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
        );
        
        const xpGain = calculateXpGain({
          baseScore: finalScore,
          wordsFound: usedWords.length,
          longestWord: longestWord.length,
          gameMode: settings.mode,
          difficulty: settings.difficulty,
          timeBonus: 0,
          streakBonus: 0,
          perfectGame: grade === "Platinum"
        });
        
        setXpGained(xpGain);
        setShowXpGain(true);
        setTimeout(() => setShowXpGain(false), 5000);
        
        setGameOver(true);
        toast.success(`🎯 Target reached: ${grade} • +${xpGain} XP`);
      }
    }
    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);
    
    // Time Attack mode: Update speed multiplier based on words found
    if (settings.mode === "time_attack" && timeAttackStarted) {
      const newWordsFound = timeAttackWordsFound + 1;
      setTimeAttackWordsFound(newWordsFound);
      
      // Speed multiplier increases every 3 words (1.0x -> 1.2x -> 1.4x -> 1.6x -> 2.0x max)
      const newMultiplier = Math.min(2.0, 1.0 + Math.floor(newWordsFound / 3) * 0.2);
      if (newMultiplier > timeAttackSpeedMultiplier) {
        setTimeAttackSpeedMultiplier(newMultiplier);
        toast.success(`⚡ Speed Multiplier: ${newMultiplier.toFixed(1)}x!`, { duration: 2000 });
      }
      
      // Time bonus: Add 2 seconds for each word found (longer words give more time)
      const timeBonus = Math.min(5, Math.floor(actualWord.length / 2));
      setTimeAttackTimeRemaining(prev => Math.min(60, prev + timeBonus));
      if (timeBonus > 0) {
        toast.info(`+${timeBonus}s time bonus!`, { duration: 1500 });
      }
    }
    
    // Enhanced Survival mode: Track words and check for challenge/boss completion
    if (settings.mode === "survival" && survivalStarted) {
      // Update combo system
      const hasSafetyNet = survivalActivePowerUps.some(ap => ap.powerUp.type === 'safety_net' && (ap.remainingUses || 0) > 0);

      // BUG FIX #3: Calculate time before updating combo (to use old timestamp)
      const timeSpent = survivalComboState.lastWordTime > 0
        ? (Date.now() - survivalComboState.lastWordTime) / 1000
        : 5; // Default 5 seconds for first word

      const { newCombo, rewards } = updateCombo(survivalComboState, true, hasSafetyNet);
      setSurvivalComboState(newCombo);

      // Apply combo multiplier to score
      const comboScore = Math.floor(totalGain * newCombo.comboMultiplier * survivalPointsMultiplier);
      const waveScore = survivalWaveScore + comboScore;
      setSurvivalWaveScore(waveScore);

      // Update performance tracking
      const updatedPerf = updatePerformance(
        survivalPerformance,
        actualWord,
        newCombo.currentCombo,
        true,
        timeSpent
      );
      setSurvivalPerformance(updatedPerf);

      // Process combo rewards
      rewards.forEach(reward => {
        if (reward === 'common_powerup') {
          const powerUp = getRandomPowerUp('common');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`🎁 Combo reward: ${powerUp.name}!`);
        } else if (reward === 'rare_powerup') {
          const powerUp = getRandomPowerUp('rare');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`⭐ Rare combo reward: ${powerUp.name}!`);
        } else if (reward === 'epic_powerup') {
          const powerUp = getRandomPowerUp('epic');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`💎 Epic combo reward: ${powerUp.name}!`);
        } else if (reward === 'life_fragment') {
          const newFragments = survivalLifeFragments + 1;
          if (newFragments >= 3) {
            setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
            setSurvivalLifeFragments(0);
            toast.success('💎 Life fragments combined! +1 life');
          } else {
            setSurvivalLifeFragments(newFragments);
            toast.success(`💎 Life fragment earned! (${newFragments}/3)`);
          }
        } else if (reward === 'extra_life') {
          // BUG FIX #6: Handle 15-word combo reward
          setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
          toast.success('❤️ LEGENDARY COMBO! +1 Life!', { duration: 4000 });
        }
      });

      // Boss wave logic
      if (survivalBossWordRequired && survivalCurrentBoss) {
        const pathPositions = path.map(p => ({ row: p.r, col: p.c }));
        const bossResult = validateBossWave(
          survivalCurrentBoss,
          actualWord,
          pathPositions,
          survivalBossProgress,
          waveScore
        );

        if (bossResult.valid) {
          setSurvivalBossProgress(bossResult.progress);

          if (bossResult.complete) {
            // Boss defeated!
            toast.success(bossResult.message || '👑 Boss defeated!', { duration: 3000 });

            // Wave complete - check for life recovery and rewards
            const perfectWave = survivalMistakesThisWave === 0;
            const newPerfectStreak = perfectWave ? survivalPerfectWaveStreak + 1 : 0;
            setSurvivalPerfectWaveStreak(newPerfectStreak);

            const recovery = checkLifeRecovery(
              survivalWave,
              newPerfectStreak,
              survivalLifeFragments,
              true, // boss defeated
              newCombo.currentCombo
            );

            if (recovery.lives > 0) {
              setSurvivalLives(prev => Math.min(prev + recovery.lives, survivalMaxLives));
              toast.success(recovery.message || `❤️ +${recovery.lives} life!`, { duration: 3000 });
            }
            setSurvivalLifeFragments(recovery.fragments);

            // Advance to next wave
            const nextWave = survivalWave + 1;
            setSurvivalWave(nextWave);
            setSurvivalWordsThisWave(0);
            setSurvivalChallengeProgress(0);
            setSurvivalBossProgress(0);
            setSurvivalWaveScore(0);
            setSurvivalMistakesThisWave(0);
            setSurvivalBossWordRequired(false);
            setSurvivalCurrentBoss(null);

            // Check for events or shop
            if (shouldShowShop(nextWave)) {
              setSurvivalShowShop(true);
            } else if (shouldTriggerEvent(nextWave)) {
              const event = generateRandomEvent(nextWave);
              if (event) {
                setSurvivalPendingEvent(event);
              }
            } else {
              // Generate next wave challenge
              const nextChallenge = getRandomWaveChallenge(nextWave);
              setSurvivalCurrentChallenge(nextChallenge);
              toast.info(`🌊 Wave ${nextWave}: ${nextChallenge.description}`, { duration: 4000 });
            }

            // BUG FIX #2: Properly expire power-ups and handle durations
            setSurvivalActivePowerUps(prev =>
              prev.map(ap => ({
                ...ap,
                remainingWaves: ap.remainingWaves !== undefined ? ap.remainingWaves - 1 : undefined
              })).filter(ap => ap.remainingWaves === undefined || ap.remainingWaves > 0)
            );

            if (survivalDifficultyFrozen > 0) {
              setSurvivalDifficultyFrozen(prev => prev - 1);
            }

            // BUG FIX #9: Reset double points multiplier after wave
            if (survivalPointsMultiplier > 1.0) {
              setSurvivalPointsMultiplier(1.0);
            }
          } else if (bossResult.message) {
            toast.info(bossResult.message);
          }
        } else if (bossResult.message) {
          toast.error(bossResult.message);
        }
      }
      // Regular challenge logic
      else if (survivalCurrentChallenge) {
        const pathPositions = path.map(p => ({ row: p.r, col: p.c }));
        const challengeResult = validateWaveChallenge(
          survivalCurrentChallenge,
          actualWord,
          pathPositions,
          survivalChallengeProgress,
          waveScore
        );

        if (challengeResult.valid) {
          setSurvivalChallengeProgress(challengeResult.progress);
          if (challengeResult.message) {
            toast.info(challengeResult.message);
          }

          // Check if challenge is complete
          if (isChallengeComplete(survivalCurrentChallenge, challengeResult.progress)) {
            const nextWave = survivalWave + 1;

            // Check if next wave is a boss wave
            if (nextWave % 5 === 0) {
              // BUG FIX #1: Advance wave counter before boss
              setSurvivalWave(nextWave);
              setSurvivalWordsThisWave(0);
              setSurvivalChallengeProgress(0);
              setSurvivalWaveScore(0);
              setSurvivalMistakesThisWave(0);

              const boss = getRandomBossWave(nextWave);
              setSurvivalCurrentBoss(boss);
              setSurvivalBossWordRequired(true);
              setSurvivalCurrentChallenge(null);
              toast.warning(`${boss.icon} Boss Wave ${nextWave}! ${boss.description}`, { duration: 4000 });
            } else {
              // Regular wave complete
              const perfectWave = survivalMistakesThisWave === 0;
              const newPerfectStreak = perfectWave ? survivalPerfectWaveStreak + 1 : 0;
              setSurvivalPerfectWaveStreak(newPerfectStreak);

              const recovery = checkLifeRecovery(
                survivalWave,
                newPerfectStreak,
                survivalLifeFragments,
                false,
                newCombo.currentCombo
              );

              if (recovery.lives > 0) {
                setSurvivalLives(prev => Math.min(prev + recovery.lives, survivalMaxLives));
                toast.success(recovery.message || `❤️ +${recovery.lives} life!`, { duration: 3000 });
              }
              setSurvivalLifeFragments(recovery.fragments);

              // Advance wave
              setSurvivalWave(nextWave);
              setSurvivalWordsThisWave(0);
              setSurvivalChallengeProgress(0);
              setSurvivalWaveScore(0);
              setSurvivalMistakesThisWave(0);

              // Check for shop or events
              if (shouldShowShop(nextWave)) {
                setSurvivalShowShop(true);
              } else if (shouldTriggerEvent(nextWave)) {
                const event = generateRandomEvent(nextWave);
                if (event) {
                  setSurvivalPendingEvent(event);
                }
              } else {
                const nextChallenge = getRandomWaveChallenge(nextWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.success(`✨ Wave ${survivalWave} complete!\n🌊 Wave ${nextWave}: ${nextChallenge.description}`, { duration: 4000 });
              }

              // BUG FIX #2: Properly expire power-ups
              setSurvivalActivePowerUps(prev =>
                prev.map(ap => ({
                  ...ap,
                  remainingWaves: ap.remainingWaves !== undefined ? ap.remainingWaves - 1 : undefined
                })).filter(ap => ap.remainingWaves === undefined || ap.remainingWaves > 0)
              );

              if (survivalDifficultyFrozen > 0) {
                setSurvivalDifficultyFrozen(prev => prev - 1);
              }

              // BUG FIX #9: Reset double points multiplier after wave
              if (survivalPointsMultiplier > 1.0) {
                setSurvivalPointsMultiplier(1.0);
              }
            }
          }
        } else if (challengeResult.message) {
          toast.error(challengeResult.message);
          setSurvivalMistakesThisWave(prev => prev + 1);
        }
      }

      setSurvivalWordsThisWave(prev => prev + 1);

      // BUG FIX #2: Properly expire word-based power-ups
      setSurvivalActivePowerUps(prev =>
        prev.map(ap => ({
          ...ap,
          remainingUses: ap.remainingUses !== undefined ? ap.remainingUses - 1 : undefined
        })).filter(ap => ap.remainingUses === undefined || ap.remainingUses > 0)
      );
    }

    // Introduce special tiles if conditions are met
    if (shouldIntroduceSpecialTiles(usedWords.length)) {
      let updatedSpecialTiles: SpecialTile[][];
      let newWildPositions: string[];

      if (settings.mode === "daily") {
        // Use seeded special tiles for daily challenge - all players get same tiles
        const result = introduceSeededSpecialTiles(
          newSpecialTiles,
          usedWords.length + 1, // +1 because we just completed a word
          score,
          size,
          getDailySeed()
        );
        updatedSpecialTiles = result.tiles;
        newWildPositions = result.newWildPositions;
      } else {
        // Non-daily modes use random special tiles
        updatedSpecialTiles = [...newSpecialTiles];
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
        newWildPositions = [];
        let currentBoard = board;
        for (let i = 0; i < tilesToPlace; i++) {
          const randomIndex = Math.floor(Math.random() * emptyPositions.length);
          const pos = emptyPositions.splice(randomIndex, 1)[0];
          const specialTile = generateSpecialTile(
            score,
            settings.mode,
            settings.mode === "endless" ? endlessDifficulty : 1
          );
          if (specialTile.type !== null) {
            // Preserve frozen flag if it exists
            const existingFrozen = updatedSpecialTiles[pos.r][pos.c].frozen;
            updatedSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: existingFrozen || specialTile.frozen };
            // Track newly spawned Wild tiles
            if (specialTile.type === "wild") {
              newWildPositions.push(keyOf(pos));
            }
            // Apply spawn effects for enhanced tiles
            if (specialTile.type === "magnet") {
              currentBoard = applyMagnetSpawnEffect(pos, currentBoard, updatedSpecialTiles, size);
              setBoard(currentBoard);
            }
            if (specialTile.type === "freeze") {
              updatedSpecialTiles = applyFreezeSpawnEffect(pos, updatedSpecialTiles, size);
            }
          }
        }
      }

      setSpecialTiles(updatedSpecialTiles);
      // Add new Wild tiles to tracking set
      if (newWildPositions.length > 0) {
        setNewWildTiles(prev => {
          const updated = new Set(prev);
          newWildPositions.forEach(key => updated.add(key));
          return updated;
        });
        // Remove from tracking after blink animation completes (1.2s)
        setTimeout(() => {
          setNewWildTiles(prev => {
            const updated = new Set(prev);
            newWildPositions.forEach(key => updated.delete(key));
            return updated;
          });
        }, 1200);
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
            
            // Handle endless mode - regenerate board instead of ending game
            if (settings.mode === "endless") {
              // Increment difficulty - linear progression is fine for now
              // Could be adjusted to exponential or step-based if needed
              setEndlessDifficulty(prev => prev + 1);
              // Regenerate board with increased difficulty
              setIsGenerating(true);
              if (dict && sorted) {
                const newBoard = generateSolvableBoard(size, dict, sorted);
                setBoard(newBoard);
                setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
                setUsedWords([]);
                setLastWordTiles(new Set());
                // FIX: Don't reset score in endless mode - it should accumulate
                setStreak(0);
                setIsGenerating(false);
              }
              toast.success(`🎯 New Board! Difficulty: ${endlessDifficulty + 1}`, { duration: 2000 });
              return;
            }
            
            // Handle survival mode - lose a life instead of ending game
            if (settings.mode === "survival") {
              setSurvivalLives(prev => {
                const newLives = prev - 1;
                if (newLives <= 0) {
                  // Survival mode ended - calculate and display XP
                  const longestWord = usedWords.reduce((longest, wordEntry) => 
                    wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
                  );
                  
                  const xpGain = calculateXpGain({
                    baseScore: score,
                    wordsFound: usedWords.length,
                    longestWord: longestWord.length,
                    gameMode: settings.mode,
                    difficulty: settings.difficulty,
                    timeBonus: 0,
                    streakBonus: 0,
                    perfectGame: false
                  });
                  
                  setXpGained(xpGain);
                  setShowXpGain(true);
                  
                  // Hide XP gain display after 5 seconds
                  setTimeout(() => setShowXpGain(false), 5000);
                  
                  // Show completion toast
                  toast.info(`💀 Survival Mode Complete! Wave ${survivalWave} • Score: ${score} • +${xpGain} XP`, {
                    duration: 4000
                  });
                  
                  setGameOver(true);
                  return 0;
                } else {
                  // Continue with new wave
                  const newWave = survivalWave + 1;
                  setSurvivalWave(newWave);
                  setIsGenerating(true);
                  if (dict && sorted) {
                    const newBoard = generateSolvableBoard(size, dict, sorted);
                    setBoard(newBoard);
                    setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
                    setUsedWords([]);
                    setLastWordTiles(new Set());
                    // FIX: Don't reset score in survival mode - it should accumulate
                    setStreak(0);
                    setIsGenerating(false);
                  }
                  toast.success(`🌊 Wave ${newWave}! ${newWave % 5 === 0 ? '⚡ Boss Wave - Find a 7+ letter word!' : ''}`, { duration: 3000 });
                  return newLives;
                }
              });
              return;
            }
            
            if (s >= benchmarks.platinum) grade = "Platinum";else if (s >= benchmarks.gold) grade = "Gold";else if (s >= benchmarks.silver) grade = "Silver";else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);

            // Calculate and display XP gained
            const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");
            const xpGain = calculateXpGain({
              baseScore: finalScore,
              wordsFound: usedWords.length,
              longestWord: longestWord.length,
              gameMode: settings.mode,
              difficulty: settings.difficulty,
              timeBonus: 0,
              streakBonus: 0,
              perfectGame: grade === "Platinum"
            });
            
            setXpGained(xpGain);
            setShowXpGain(true);
            
            // Hide XP gain display after 5 seconds
            setTimeout(() => setShowXpGain(false), 5000);

            // Save state when game ends
            saveGameState();
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${finalScore} (${grade}) • +${xpGain} XP`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade} • +${xpGain} XP`);
            } else {
              toast.info(`No valid words remain. Game over! • +${xpGain} XP`);
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
            // Calculate and display XP gained
            const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");
            const xpGain = calculateXpGain({
              baseScore: score,
              wordsFound: usedWords.length,
              longestWord: longestWord.length,
              gameMode: settings.mode,
              difficulty: settings.difficulty,
              timeBonus: 0,
              streakBonus: 0,
              perfectGame: false
            });
            
            setXpGained(xpGain);
            setShowXpGain(true);
            
            // Hide XP gain display after 5 seconds
            setTimeout(() => setShowXpGain(false), 5000);

            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! • +${xpGain} XP`);
            } else {
              toast.info(`No valid words remain. Game over! • +${xpGain} XP`);
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
  function generateSpecialTile(currentScore: number = 0, gameMode: string = "classic", endlessDifficultyLevel: number = 1): SpecialTile {
    const rand = Math.random();
    let cumulative = 0;

    // Use enhanced rarities if toggle is on and mode is not daily
    const useEnhanced = isEnhancedPowerupsEnabled() && gameMode !== "daily";
    const baseRarities: Record<string, number> = useEnhanced ? { ...ENHANCED_TILE_RARITIES } : { ...SPECIAL_TILE_RARITIES };

    // Progressive stone spawning for classic mode
    if (gameMode === "classic") {
      // Progressive stone spawn rate: base 0.05 + (score/1000) * 0.10, capped at 0.35
      const baseStoneRate = 0.05;
      const progressiveRate = Math.min(0.25, (currentScore / 1000) * 0.10);
      baseRarities.stone = baseStoneRate + progressiveRate;
    } else if (gameMode === "endless") {
      // Endless mode: difficulty affects special tile rarities
      const difficultyFactor = Math.min(1.0, endlessDifficultyLevel / 10);

      const baseStoneRate = 0.15;
      const maxStoneRate = 0.40;
      baseRarities.stone = baseStoneRate + (maxStoneRate - baseStoneRate) * difficultyFactor;

      const helpfulReduction = 1 - difficultyFactor * 0.3;
      baseRarities.wild = (baseRarities.wild || 0.05) * helpfulReduction;
      baseRarities.multiplier = (baseRarities.multiplier || 0.12) * helpfulReduction;
      baseRarities.xfactor = (baseRarities.xfactor || 0.08) * helpfulReduction;

      // Normalize rarities to ensure they sum to a reasonable probability
      const totalRarity = Object.values(baseRarities).reduce((sum, r) => sum + r, 0);
      if (totalRarity > 0.5) {
        const scale = 0.5 / totalRarity;
        Object.keys(baseRarities).forEach(key => {
          baseRarities[key] *= scale;
        });
      }
    }

    for (const [type, rarity] of Object.entries(baseRarities)) {
      cumulative += rarity;
      if (rand <= cumulative) {
        // Calculate expiry turns based on tile type
        let expiryTurns: number;
        if (type === "stone" && gameMode === "endless") {
          const difficultyFactor = Math.min(1.0, endlessDifficultyLevel / 10);
          const baseMin = 3;
          const baseMax = 5;
          const maxMin = 8;
          const maxMax = 12;
          const minTurns = Math.floor(baseMin + (maxMin - baseMin) * difficultyFactor);
          const maxTurns = Math.floor(baseMax + (maxMax - baseMax) * difficultyFactor);
          expiryTurns = Math.floor(Math.random() * (maxTurns - minTurns + 1)) + minTurns;
        } else {
          // Tile-specific expiry ranges
          expiryTurns = getExpiryTurnsForType(type);
        }

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

  // Returns appropriate expiry turns for each tile type
  function getExpiryTurnsForType(type: string): number {
    switch (type) {
      case "freeze": return Math.floor(Math.random() * 3) + 3;   // 3-5
      case "decay": return 3;
      case "mirror": return Math.floor(Math.random() * 2) + 2;   // 2-3
      case "magnet": return Math.floor(Math.random() * 2) + 3;   // 3-4
      case "bomb": return 2;
      case "chain": return Math.floor(Math.random() * 2) + 3;    // 3-4
      case "ghost": return 2;
      case "tax": return Math.floor(Math.random() * 3) + 3;      // 3-5
      default: return Math.floor(Math.random() * 5) + 1;         // 1-5 (existing tiles)
    }
  }
  function shouldIntroduceSpecialTiles(wordCount: number): boolean {
    return wordCount >= 1;
  }

  // Seeded special tile generation for Daily Challenge mode
  // Ensures all players get the same special tiles at the same positions
  function generateSeededSpecialTile(rng: () => number, currentScore: number = 0): SpecialTile {
    const rand = rng();
    let cumulative = 0;
    
    // Daily challenge uses balanced rarities (no progressive stone spawning)
    const dailyRarities = { ...SPECIAL_TILE_RARITIES };
    
    for (const [type, rarity] of Object.entries(dailyRarities)) {
      cumulative += rarity;
      if (rand <= cumulative) {
        // Use seeded random for expiry turns (2-4 turns for consistency)
        const expiryTurns = Math.floor(rng() * 3) + 2;
        
        if (type === "multiplier") {
          const multiplierValues = [2, 3, 4];
          const value = multiplierValues[Math.floor(rng() * multiplierValues.length)];
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

  // Introduces special tiles deterministically for Daily Challenge mode
  // All players with the same seed and word count will get identical special tiles
  function introduceSeededSpecialTiles(
    currentSpecialTiles: SpecialTile[][],
    wordCount: number,
    currentScore: number,
    gridSize: number,
    dailySeed: string
  ): { tiles: SpecialTile[][], newWildPositions: string[] } {
    const updatedSpecialTiles = currentSpecialTiles.map(row => [...row]);
    const emptyPositions: Pos[] = [];

    // Find empty positions (tiles without special tiles)
    // Use consistent ordering (row-major) for deterministic position selection
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (updatedSpecialTiles[r][c].type === null) {
          emptyPositions.push({ r, c });
        }
      }
    }

    if (emptyPositions.length === 0) {
      return { tiles: updatedSpecialTiles, newWildPositions: [] };
    }

    // Create seeded RNG for this word count
    const tileCountRng = seedRandom(dailySeed + "_tiles_" + wordCount);
    
    // Deterministic number of tiles to place (1-3)
    const numTilesToPlace = Math.floor(tileCountRng() * 3) + 1;
    const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
    const newWildPositions: string[] = [];

    // Create a shuffled copy of positions using seeded random
    const shuffledPositions = [...emptyPositions];
    const shuffleRng = seedRandom(dailySeed + "_shuffle_" + wordCount);
    for (let i = shuffledPositions.length - 1; i > 0; i--) {
      const j = Math.floor(shuffleRng() * (i + 1));
      [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
    }

    for (let i = 0; i < tilesToPlace; i++) {
      const pos = shuffledPositions[i];
      // Each tile gets its own seeded RNG based on word count and tile index
      const tileRng = seedRandom(dailySeed + "_tile_" + wordCount + "_" + i);
      const specialTile = generateSeededSpecialTile(tileRng, currentScore);
      
      if (specialTile.type !== null) {
        updatedSpecialTiles[pos.r][pos.c] = specialTile;
        if (specialTile.type === "wild") {
          newWildPositions.push(keyOf(pos));
        }
      }
    }

    return { tiles: updatedSpecialTiles, newWildPositions };
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
  
  // End the current game and collect XP
  async function onEndGame() {
    if (settings.mode === "classic" && !gameOver && (score > 0 || usedWords.length > 0)) {
      // Calculate and display XP gained
      const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");
      const xpGain = calculateXpGain({
        baseScore: score,
        wordsFound: usedWords.length,
        longestWord: longestWord.length,
        gameMode: settings.mode,
        difficulty: settings.difficulty,
        timeBonus: 0,
        streakBonus: 0,
        perfectGame: false
      });
      
      setXpGained(xpGain);
      setShowXpGain(true);
      
      // Hide XP gain display after 5 seconds
      setTimeout(() => setShowXpGain(false), 5000);
      
      setGameOver(true);
      
      // Save game result and XP immediately
      await saveGameResult();
      
      toast.success(`Game ended! Score: ${score.toLocaleString()} • +${xpGain} XP`);
    } else if (gameOver) {
      toast.info("Game already ended!");
    } else {
      toast.info("No progress to save yet!");
    }
  }
  
  function startGameWithDifficulty(difficulty: "easy" | "medium" | "hard" | "expert") {
    if (settings.mode === "classic" && !gameOver && (score > 0 || usedWords.length > 0)) {
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
          // No words available, calculate XP and end the game
          const longestWord = usedWords.reduce((longest, wordEntry) => 
            wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
          );
          
          const xpGain = calculateXpGain({
            baseScore: score,
            wordsFound: usedWords.length,
            longestWord: longestWord.length,
            gameMode: settings.mode,
            difficulty: settings.difficulty,
            timeBonus: 0,
            streakBonus: 0,
            perfectGame: false
          });
          
          setXpGained(xpGain);
          setShowXpGain(true);
          setTimeout(() => setShowXpGain(false), 5000);
          
          toast.info(`No valid words remain. Game over! • +${xpGain} XP`);
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
      // No words available, calculate XP and end the game
      const longestWord = usedWords.reduce((longest, wordEntry) => 
        wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
      );
      
      const xpGain = calculateXpGain({
        baseScore: score,
        wordsFound: usedWords.length,
        longestWord: longestWord.length,
        gameMode: settings.mode,
        difficulty: settings.difficulty,
        timeBonus: 0,
        streakBonus: 0,
        perfectGame: false
      });
      
      setXpGained(xpGain);
      setShowXpGain(true);
      setTimeout(() => setShowXpGain(false), 5000);
      
      toast.info(`No valid words remain. Game over! • +${xpGain} XP`);
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
    // Ghost tiles can bridge non-adjacent tiles - only when the last tile in path is a ghost
    const lastTile = path.length > 0 ? specialTiles[path[path.length - 1].r][path[path.length - 1].c] : null;
    const canSkipAdjacency = lastTile?.type === "ghost";
    
    if (path.length && !canSkipAdjacency && !neighbors(path[path.length - 1], pos)) return;
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
        // Try to add to path (must be adjacent to last tile, unless last tile is a ghost)
        const lastTile = specialTiles[path[path.length - 1].r][path[path.length - 1].c];
        const canSkipAdjacency = lastTile.type === "ghost";
        const isAdjacent = neighbors(path[path.length - 1], pos);
        
        if (path.length && (isAdjacent || canSkipAdjacency)) {
          // Check if this is a stone tile and it's blocked
          const specialTile = specialTiles[pos.r][pos.c];
          if (specialTile.type === "stone") {
            toast.warning("Stone tile is blocked!");
            return;
          }
          setPath([...path, pos]);
        } else if (path.length) {
          // Not adjacent and no ghost - show warning
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
    
    // Check puzzle mode move limit
    if (puzzleMode && puzzleMovesRemaining <= 0) {
      toast.error("Puzzle move limit reached!");
      return clearPath();
    }
    const actualWord = wordFromPath;
    const wildUsed = false;
    
    // Ghost tile: maximum one per word (check before wild dialog to enforce limit)
    const ghostCount = path.filter(p => specialTiles[p.r][p.c].type === "ghost").length;
    if (ghostCount > 1) {
      toast.error("Only one Ghost tile per word!");
      return clearPath();
    }
    
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
    // Enhanced word validation with better error messages
    const validation = dictionaryManager.validateWord(actualWord);
    
    if (!validation.isValid) {
      toast.error(`"${actualWord.toUpperCase()}" is not a valid word`);
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
      timeAttackSpeedMultiplier,
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
    
    // Zen mode: save current state before processing word
    if (settings.mode === 'zen') {
      setZenUndoStack(prev => [...prev, { 
        board: board.map(r => [...r]), 
        specialTiles: specialTiles.map(r => [...r]),
        usedWords: [...usedWords],
        score 
      }]);
    }
    
    // Puzzle mode: check required words and decrement moves
    if (puzzleMode && currentPuzzleId) {
      setPuzzleFoundWords(prev => new Set([...prev, actualWord.toUpperCase()]));
      setPuzzleMovesRemaining(prev => prev - 1);
      
      // Check if all required words are now found
      const allRequiredFound = Array.from(puzzleRequiredWords).every(w => 
        puzzleFoundWords.has(w) || w === actualWord.toUpperCase()
      );
      
      if (allRequiredFound) {
        // Puzzle completed!
        setTimeout(() => {
          savePuzzleCompletion(actualWord);
        }, 1000);
        return;
      }
      
      if (puzzleMovesRemaining <= 1 && !allRequiredFound) {
        // Out of moves
        setTimeout(() => {
          setGameOver(true);
          toast.error(`Puzzle incomplete! You found ${puzzleFoundWords.size}/${puzzleRequiredWords.size} required words.`);
        }, 1000);
      }
    }
    
    // Survival mode: check for boss word completion and increment wave progress
    if (settings.mode === 'survival') {
      setSurvivalWordsThisWave(prev => prev + 1);
      
      // Check if boss word requirement is met (7+ letter word)
      if (survivalBossWordRequired && actualWord.length >= 7) {
        setSurvivalBossWordRequired(false);
        toast.success('👑 Boss word completed! Wave cleared!', { duration: 3000 });
      }
      
      // Apply progressive difficulty every 5 words within a wave
      if (survivalWordsThisWave > 0 && survivalWordsThisWave % 5 === 0) {
        // Add stone tiles as difficulty increases
        const emptyPositions: Pos[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (specialTiles[r][c].type === null) {
              emptyPositions.push({ r, c });
            }
          }
        }
        
        if (emptyPositions.length > 0) {
          const newSpecialTilesForDifficulty = specialTiles.map(row => [...row]);
          const randomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
          newSpecialTilesForDifficulty[randomPos.r][randomPos.c] = {
            type: 'stone',
            expiryTurns: undefined
          };
          setSpecialTiles(newSpecialTilesForDifficulty);
          toast.warning('⚠️ Difficulty increased! Stone tile added.', { duration: 2000 });
        }
      }
    }

    // Legacy variables needed for achievements, toasts, and other legacy code
    const sharedTilesCount = lastWordTiles.size ? path.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Increment moves for daily challenge, puzzle mode, and chaos mode
    if (settings.mode === "daily" || settings.mode === "puzzle" || (settings.mode === "chaos" && chaosStarted)) {
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

    // Handle X-Factor tiles first and track board state through all effects
    let trackedBoard = board.map(row => [...row]);
    const xFactorResult = handleXFactorTiles(
      path, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );
    const xChanged = xFactorResult.xChanged;
    trackedBoard = xFactorResult.board;

    // Handle shuffle tiles (use updated board from X-factor)
    trackedBoard = handleShuffleTiles(
      path, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );

    // Handle Bomb tile blasts (after scoring, before clearing path tiles)
    const bombTilesInPath = path.filter(p => specialTiles[p.r][p.c].type === "bomb");
    if (bombTilesInPath.length > 0) {
      for (const bombPos of bombTilesInPath) {
        trackedBoard = handleBombBlast(bombPos, trackedBoard, specialTiles, size, setBoard, setSpecialTiles, setAffectedTiles);
      }
    }

    let newSpecialTiles = specialTiles.map(row => [...row]);
    path.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          ...specialTiles[p.r][p.c],
          type: null
        };
      }
    });

    // Process Decay spread before expiry (enhanced powerups only, not daily)
    if (isEnhancedPowerupsEnabled() && settings.mode !== "daily") {
      const decayResult = processDecaySpread(newSpecialTiles, trackedBoard, size);
      newSpecialTiles = decayResult.tiles;
      trackedBoard = decayResult.board;
      setBoard(trackedBoard);
    }

    newSpecialTiles = expireSpecialTiles(newSpecialTiles);

    // Clear frozen flags from tiles whose adjacent Freeze tile expired
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newSpecialTiles[r][c].frozen) {
          // Check if any adjacent tile is still a Freeze tile
          const orthogonal = [
            { r: r - 1, c: c }, { r: r + 1, c: c },
            { r: r, c: c - 1 }, { r: r, c: c + 1 },
          ];
          const stillFrozen = orthogonal.some(
            adj => within(adj.r, adj.c, size) && newSpecialTiles[adj.r][adj.c].type === "freeze"
          );
          if (!stillFrozen) {
            newSpecialTiles[r][c] = { ...newSpecialTiles[r][c], frozen: false };
          }
        }
      }
    }

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
    if (shouldIntroduceSpecialTiles(usedWords.length)) {
      let updatedSpecialTiles: SpecialTile[][];
      let newWildPositions: string[];

      if (settings.mode === "daily") {
        // Use seeded special tiles for daily challenge - all players get same tiles
        const result = introduceSeededSpecialTiles(
          newSpecialTiles,
          usedWords.length + 1, // +1 because we just completed a word
          score,
          size,
          getDailySeed()
        );
        updatedSpecialTiles = result.tiles;
        newWildPositions = result.newWildPositions;
      } else {
        // Non-daily modes use random special tiles
        updatedSpecialTiles = [...newSpecialTiles];
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
        newWildPositions = [];
        let currentBoard = board;
        for (let i = 0; i < tilesToPlace; i++) {
          const randomIndex = Math.floor(Math.random() * emptyPositions.length);
          const pos = emptyPositions.splice(randomIndex, 1)[0];
          const specialTile = generateSpecialTile(
            score,
            settings.mode,
            settings.mode === "endless" ? endlessDifficulty : 1
          );
          if (specialTile.type !== null) {
            // Preserve frozen flag if it exists
            const existingFrozen = updatedSpecialTiles[pos.r][pos.c].frozen;
            updatedSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: existingFrozen || specialTile.frozen };
            // Track newly spawned Wild tiles
            if (specialTile.type === "wild") {
              newWildPositions.push(keyOf(pos));
            }
            // Apply spawn effects for enhanced tiles
            if (specialTile.type === "magnet") {
              currentBoard = applyMagnetSpawnEffect(pos, currentBoard, updatedSpecialTiles, size);
              setBoard(currentBoard);
            }
            if (specialTile.type === "freeze") {
              updatedSpecialTiles = applyFreezeSpawnEffect(pos, updatedSpecialTiles, size);
            }
          }
        }
      }

      setSpecialTiles(updatedSpecialTiles);
      // Add new Wild tiles to tracking set
      if (newWildPositions.length > 0) {
        setNewWildTiles(prev => {
          const updated = new Set(prev);
          newWildPositions.forEach(key => updated.add(key));
          return updated;
        });
        // Remove from tracking after blink animation completes (1.2s)
        setTimeout(() => {
          setNewWildTiles(prev => {
            const updated = new Set(prev);
            newWildPositions.forEach(key => updated.delete(key));
            return updated;
          });
        }, 1200);
      }
    }
    
    // Chaos Mode: Reshuffle board after every word (only if started)
    if (settings.mode === "chaos" && chaosStarted && dict && sorted) {
      setTimeout(() => {
        // Keep some random tiles, shuffle others
        const newBoard = board.map(row => [...row]);
        const tilesToReshuffle = Math.floor(Math.random() * 5) + 3; // 3-7 tiles reshuffled
        const positions: Pos[] = [];
        
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            positions.push({ r, c });
          }
        }
        
        // Shuffle positions randomly
        for (let i = positions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Track which tiles will be changed for visual effect
        const changedTileKeys = new Set<string>();
        
        // Replace random tiles with new letters
        const letterCounts = new Map<string, number>();
        for (let i = 0; i < Math.min(tilesToReshuffle, positions.length); i++) {
          const pos = positions[i];
          newBoard[pos.r][pos.c] = constrainedRandomLetter(letterCounts);
          changedTileKeys.add(keyOf(pos));
        }
        
        // Validate Q-U adjacency
        const validation = validateAndFixQUAdjacency(newBoard, size, undefined, undefined, false);
        const validatedBoard = validation.board;
        
        // Ensure at least 1 valid word exists
        const probe = probeGrid(validatedBoard, dict, sorted, 1, 1000);
        if (probe.words.size > 0) {
          setBoard(validatedBoard);
          
          // Show visual effect on changed tiles
          setAffectedTiles(changedTileKeys);
          setTimeout(() => setAffectedTiles(new Set()), 1000);
          
          // Chaos Mode: Occasionally turn special tiles into traps (20% chance)
          if (Math.random() < 0.2) {
            const updatedTraps = newSpecialTiles.map(row => [...row]);
            const specialPositions: Pos[] = [];
            
            for (let r = 0; r < size; r++) {
              for (let c = 0; c < size; c++) {
                if (updatedTraps[r][c].type !== null && updatedTraps[r][c].type !== 'stone') {
                  specialPositions.push({ r, c });
                }
              }
            }
            
            if (specialPositions.length > 0) {
              const trapPos = specialPositions[Math.floor(Math.random() * specialPositions.length)];
              const oldType = updatedTraps[trapPos.r][trapPos.c].type;
              
              // Convert special tile to trap - spawn stone tiles instead
              if (oldType === 'multiplier' || oldType === 'xfactor') {
                // Find empty positions for stone tiles
                const emptyPos: Pos[] = [];
                for (let r = 0; r < size; r++) {
                  for (let c = 0; c < size; c++) {
                    if (updatedTraps[r][c].type === null) {
                      emptyPos.push({ r, c });
                    }
                  }
                }
                
                // Spawn 3 stone tiles
                const stonesToSpawn = Math.min(3, emptyPos.length);
                for (let i = 0; i < stonesToSpawn; i++) {
                  const idx = Math.floor(Math.random() * emptyPos.length);
                  const pos = emptyPos.splice(idx, 1)[0];
                  updatedTraps[pos.r][pos.c] = { type: 'stone', expiryTurns: undefined };
                }
                
                // Remove the trap tile
                updatedTraps[trapPos.r][trapPos.c] = { type: null };
                setSpecialTiles(updatedTraps);
                toast.warning('⚠️ TRAP! Multiplier spawned stone tiles!', { duration: 3000 });
              } else if (oldType === 'wild') {
                // Wild tile trap: temporarily block vowels on next word
                toast.warning('⚠️ TRAP! Wild tile turned dangerous!', { duration: 3000 });
                // Remove wild tile
                updatedTraps[trapPos.r][trapPos.c] = { type: null };
                setSpecialTiles(updatedTraps);
              }
            }
          }
          
          toast.info('🔀 Chaos! Board reshuffled!', { duration: 2000 });
        }
      }, 500);
      
      // Check if Chaos mode move limit reached (15 moves)
      if (movesUsed + 1 >= 15) {
        setTimeout(() => {
          const longestWord = usedWords.reduce((longest, wordEntry) => 
            wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
          );
          
          const xpGain = calculateXpGain({
            baseScore: finalScore,
            wordsFound: usedWords.length,
            longestWord: longestWord.length,
            gameMode: settings.mode,
            difficulty: settings.difficulty,
            timeBonus: 0,
            streakBonus: 0,
            perfectGame: false
          });
          
          setXpGained(xpGain);
          setShowXpGain(true);
          setTimeout(() => setShowXpGain(false), 5000);
          
          setFinalGrade("None");
          setGameOver(true);
          saveGameResult();
          
          toast.success(`🎊 Chaos Round Complete! Score: ${finalScore.toLocaleString()} • +${xpGain} XP`, { duration: 5000 });
        }, 1500);
      }
    }
    
    clearPath();
    
    // Check if game over due to stone tiles blocking all valid words (Classic, Zen, Chaos, or Endless mode)
    if ((settings.mode === "classic" || settings.mode === "zen" || (settings.mode === "chaos" && chaosStarted) || (settings.mode === "endless" && endlessStarted)) && dict && sorted) {
      // Create a test grid with stone tiles marked as blocked
      const testGrid = board.map((row, r) => 
        row.map((letter, c) => 
          specialTiles[r][c].type === "stone" ? "" : letter
        )
      );
      
      // Check if any valid words can still be formed
      const probe = probeGrid(testGrid, dict, sorted, 1, 100);
      if (probe.words.size === 0) {
        // Handle Zen and Chaos modes - regenerate board instead of ending game
        if (settings.mode === "zen" || settings.mode === "chaos") {
          setIsGenerating(true);
          if (dict && sorted) {
            const newBoard = generateSolvableBoard(size, dict, sorted);
            setBoard(newBoard);
            setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
            setUsedWords([]);
            setLastWordTiles(new Set());
            setScore(0);
            setStreak(0);
            setIsGenerating(false);
            toast.info(`${settings.mode === "chaos" ? "Chaos" : "Zen"} mode: New board generated - no valid words remained!`);
          }
        } else if (settings.mode === "endless" && endlessStarted) {
          // Endless mode: Stone tiles blocked all words - end the run
          const longestWord = usedWords.reduce((longest, wordEntry) => 
            wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
          );
          
          const xpGain = calculateXpGain({
            baseScore: score,
            wordsFound: usedWords.length,
            longestWord: longestWord.length,
            gameMode: settings.mode,
            difficulty: settings.difficulty,
            timeBonus: 0,
            streakBonus: 0,
            perfectGame: false
          });
          
          setXpGained(xpGain);
          setShowXpGain(true);
          setTimeout(() => setShowXpGain(false), 5000);
          
          setFinalGrade("None");
          setGameOver(true);
          saveGameResult();
          
          toast.error(`💎 Stone tiles blocked all words! Endless Run Complete • Reached Level ${endlessDifficulty} • Score: ${score.toLocaleString()} • +${xpGain} XP`, { duration: 5000 });
        } else {
          // Classic mode: Game over due to stones blocking all words
          const longestWord = usedWords.reduce((longest, wordEntry) => 
            wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
          );
          
          const xpGain = calculateXpGain({
            baseScore: score,
            wordsFound: usedWords.length,
            longestWord: longestWord.length,
            gameMode: settings.mode,
            difficulty: settings.difficulty,
            timeBonus: 0,
            streakBonus: 0,
            perfectGame: false
          });
          
          setXpGained(xpGain);
          setShowXpGain(true);
          setTimeout(() => setShowXpGain(false), 5000);
          
          setFinalGrade("None");
          setGameOver(true);
          toast.error(`💎 Stone tiles blocked all words! Game Over • +${xpGain} XP`);
        }
      }
    }
    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = settings.mode === "daily" && movesUsed + 1 >= settings.dailyMovesLimit;
        // Check if puzzle mode is out of moves
        const puzzleMovesExceeded = puzzleMode && puzzleMovesRemaining <= 1;
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, new Set(usedWords.map(entry => entry.word)));
        if (!any || dailyMovesExceeded || puzzleMovesExceeded) {
          // Handle puzzle mode - check completion on move limit
          if (puzzleMode && puzzleMovesExceeded && currentPuzzleId) {
            const puzzle = getPuzzleById(currentPuzzleId);
            if (puzzle) {
              const allRequiredFound = Array.from(puzzleRequiredWords).every(word => 
                puzzleFoundWords.has(word)
              );
              if (!allRequiredFound) {
                setGameOver(true);
                setFinalGrade("None");
                toast.error("Puzzle incomplete! Move limit reached.");
              }
            }
            // If all required words found, completion is already handled in submitWord
          }
          // Handle Zen and Chaos mode - regenerate board instead of ending game
          if (settings.mode === "zen" || settings.mode === "chaos") {
            setIsGenerating(true);
            if (dict && sorted) {
              const newBoard = generateSolvableBoard(size, dict, sorted);
              setBoard(newBoard);
              setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
              setUsedWords([]);
              setLastWordTiles(new Set());
              setScore(0);
              setStreak(0);
              setIsGenerating(false);
              toast.info("Zen mode: New board generated - no valid words remained!");
            }
          } else if (benchmarks) {
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
      {/* XP Gain Display */}
      {showXpGain && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-500">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl">✨</div>
                <div>
                  <div className="font-bold text-lg">+{xpGained} XP</div>
                  <div className="text-sm opacity-90">Experience Gained!</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
        <div className="grid grid-cols-2 md:flex md:justify-start md:items-center gap-2">
          {settings.mode === "classic" && <Button variant="hero" onClick={onNewGame} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          
          {settings.mode === "practice" && <Button variant="outline" onClick={() => {
          startNewPracticeGame().catch(console.error);
        }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1 bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          {settings.mode === "time_attack" && !timeAttackStarted && <Button variant="outline" onClick={() => {
            setTimeAttackStarted(true);
            setTimeAttackTimeRemaining(60);
            setTimeAttackWordsFound(0);
            setTimeAttackSpeedMultiplier(1.0);
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1 bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Start Timer
            </Button>}
          
          
          {settings.mode === "survival" && !survivalStarted && <Button variant="outline" onClick={() => {
            setSurvivalStarted(true);
            setSurvivalLives(3);
            setSurvivalMaxLives(5);
            setSurvivalWave(1);
            setSurvivalWordsThisWave(0);
            setSurvivalChallengeProgress(0);
            setSurvivalWaveScore(0);
            setSurvivalMistakesThisWave(0);
            setSurvivalShields(0);
            setSurvivalLifeFragments(0);
            setSurvivalPerfectWaveStreak(0);
            setSurvivalActivePowerUps([]);
            setSurvivalInventoryPowerUps([]);
            setSurvivalComboState({
              currentCombo: 0,
              maxCombo: 0,
              comboMultiplier: 1.0,
              comboActive: false,
              lastWordTime: 0
            });

            // Generate first wave challenge
            const firstChallenge = getRandomWaveChallenge(1);
            setSurvivalCurrentChallenge(firstChallenge);
            setSurvivalBossWordRequired(false);
            setSurvivalCurrentBoss(null);

            toast.success(`💀 Survival Mode Started!\n${firstChallenge.description}`, { duration: 4000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1 bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Start Survival
            </Button>}
          
          {settings.mode === "zen" && !zenStarted && <Button variant="outline" onClick={() => {
            setZenStarted(true);
            toast.success('🧘 Zen Mode - Take your time, no pressure!', { duration: 3000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1 bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Begin Zen Practice
            </Button>}
          
          {settings.mode === "zen" && zenStarted && <Button variant="outline" onClick={() => {
            // Reset to previous state (FIX: removed the save that was creating infinite loop)
            if (zenUndoStack.length > 0) {
              const prevState = zenUndoStack[zenUndoStack.length - 1];
              setBoard(prevState.board);
              setSpecialTiles(prevState.specialTiles);
              setUsedWords(prevState.usedWords);
              setScore(prevState.score);
              setZenUndoStack(prev => prev.slice(0, -1));
            }
          }} disabled={zenUndoStack.length === 0} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Undo ({zenUndoStack.length})
            </Button>}
          
          {settings.mode === "zen" && <Button variant="outline" onClick={() => {
            if (board && dict && sorted) {
              // Find a valid word and highlight it using probeGrid
              const probe = probeGrid(board, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              const validWords = Array.from(probe.words).filter(w => !usedWords.some(uw => uw.word === w));
              if (validWords.length > 0) {
                const hintWord = validWords[Math.floor(Math.random() * validWords.length)];
                // Find the starting position for this word
                let hintPath: Pos[] | null = null;
                for (let r = 0; r < size && !hintPath; r++) {
                  for (let c = 0; c < size && !hintPath; c++) {
                    if (board[r][c].toLowerCase() === hintWord[0].toLowerCase()) {
                      hintPath = findWordPath(hintWord, { r, c });
                      if (hintPath && hintPath.length === hintWord.length) {
                        break;
                      } else {
                        hintPath = null;
                      }
                    }
                  }
                }
                if (hintPath) {
                  setPath(hintPath);
                  setHintHighlight(hintPath);
                  setTimeout(() => setHintHighlight(null), 5000);
                  setZenHintsUsed(prev => prev + 1);
                  toast.info(`Hint: ${hintWord.toUpperCase()} (${hintPath.length} letters)`);
                }
              }
            }
          }} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Hint ({zenHintsUsed})
          </Button>}
          
          {settings.mode === "chaos" && !chaosStarted && <Button variant="outline" onClick={() => {
            setChaosStarted(true);
            setMovesUsed(0);
            toast.success('🔀 Chaos Mode Started! Board reshuffles after each word. 15 moves!', { duration: 3000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1 bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Start Chaos
          </Button>}
          
          {settings.mode === "chaos" && (chaosStarted || gameOver) && <Button variant="hero" onClick={() => {
            if (dict && sorted) {
              setIsGenerating(true);
              const newBoard = generateSolvableBoard(size, dict, sorted);
              const probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
              
              setBoard(newBoard);
              setBenchmarks(bms);
              setDiscoverableCount(probe.words.size);
              setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
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
              setChaosStarted(true);
              setIsGenerating(false);
              
              toast.success('🔀 New Chaos Round! 15 moves to survive!', { duration: 3000 });
            }
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              {isGenerating ? "Generating..." : gameOver ? "New Round" : "Restart Round"}
          </Button>}
          
          <Button variant="outline" onClick={() => setShowHowToPlay(true)} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
            How to Play
          </Button>

          {onBackToAdvancedModes && (
            <Button variant="outline" onClick={onBackToAdvancedModes} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
              Back to Advanced Modes
            </Button>
          )}

          {settings.mode === "blitz" && blitzStarted && !gameOver && <Button variant="outline" onClick={() => setBlitzPaused(!blitzPaused)} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))] ml-3">
              {blitzPaused ? "▶️ Resume" : "⏸️ Pause"}
            </Button>}

          {settings.mode === "classic" && !gameOver && <Button variant="outline" onClick={onEndGame} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
            End Game
          </Button>}

          {settings.mode === "endless" && endlessStarted && !gameOver && <Button variant="outline" onClick={async () => {
            // End endless run and collect XP
            const longestWord = usedWords.reduce((longest, wordEntry) => 
              wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
            );
            const xpGain = calculateXpGain({
              baseScore: score,
              wordsFound: usedWords.length,
              longestWord: longestWord.length,
              gameMode: settings.mode,
              difficulty: settings.difficulty,
              timeBonus: 0,
              streakBonus: 0,
              perfectGame: false
            });
            
            setXpGained(xpGain);
            setShowXpGain(true);
            setTimeout(() => setShowXpGain(false), 5000);
            
            setGameOver(true);
            await saveGameResult();
            
            toast.success(`Endless Run Complete! Reached Level ${endlessDifficulty} • Score: ${score.toLocaleString()} • +${xpGain} XP`);
          }} size="sm" className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]">
            End Run
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
            {settings.mode === "endless" ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">(Almost) Endless Mode</h3>
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
                    <span className="text-sm">When no words remain, a new board appears automatically</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Difficulty increases with each new board</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Strategy Tips</h3>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Your score accumulates across all boards - aim for high-scoring words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Plan ahead to maximize tile reuse and word chains</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Special tiles become more common as difficulty increases</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">There's no time limit - take your time to find the best words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Try to clear each board completely before moving to the next</span>
                  </div>
                </div>
              </>
            ) : (
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
            )}
            
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
                  Special tiles appear after forming your first valid word and expire after a few turns.
                </div>

                {/* Enhanced Powerups tile descriptions (shown when toggle is active and not daily mode) */}
                {isEnhancedPowerupsEnabled() && settings.mode !== "daily" && (
                  <>
                    <h4 className="text-xs font-semibold text-foreground mt-3">Enhanced Powerups</h4>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-300 to-blue-400 flex items-center justify-center text-white text-xs">
                          ❄️
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Freeze</div>
                          <div className="text-muted-foreground">Locks neighbors in place</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-300 to-green-500 flex items-center justify-center text-white text-xs">
                          🦠
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Decay</div>
                          <div className="text-muted-foreground">Spreads, degrades letters</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-gray-800 text-xs">
                          🪞
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Mirror</div>
                          <div className="text-muted-foreground">Copies previous letter</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-red-400 to-gray-400 flex items-center justify-center text-white text-xs">
                          🧲
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Magnet</div>
                          <div className="text-muted-foreground">Pulls vowels nearby</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-gray-900 flex items-center justify-center text-white text-xs">
                          💣
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Bomb</div>
                          <div className="text-muted-foreground">Blasts nearby tiles</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs">
                          ⛓️
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Chain</div>
                          <div className="text-muted-foreground">Bonus for long words</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-white/60 to-gray-200/60 flex items-center justify-center text-gray-400 text-xs opacity-70">
                          👻
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Ghost</div>
                          <div className="text-muted-foreground">Bridge tile, no letter</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white text-xs">
                          💰
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">Tax</div>
                          <div className="text-muted-foreground">-30% word score</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Enhanced tiles are enabled in Settings. They do not appear in Daily Challenge mode.
                    </div>
                  </>
                )}
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
          {/* Mobile QuickUse Bar + Special Tile Preview */}
          {isMobile && <div className="lg:hidden flex items-center justify-center gap-2 mb-3">
              <QuickUseBar inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} gameState={{
            gameOver,
            isGenerating
          }} disabled={gameOver || isGenerating} />
              {settings.mode === "daily" && !gameOver && usedWords.length >= 1 && (() => {
                const nextTiles = previewNextSpecialTiles(
                  usedWords.length,
                  getDailySeed(),
                  size,
                  specialTiles
                );
                return nextTiles.length > 0 ? (
                  <SpecialTilePreview tiles={nextTiles} />
                ) : null;
              })()}
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
              
              // Determine current achievement level for border color (shared by tile classes and overlay)
              const currentGrade = benchmarks ? score >= benchmarks.platinum ? "platinum" : score >= benchmarks.gold ? "gold" : score >= benchmarks.silver ? "silver" : score >= benchmarks.bronze ? "bronze" : "none" : "none";

              // Get benchmark colors from selected skin (shared by tile classes and overlay)
              const benchmarkColor = getBenchmarkColor(skin, currentGrade as 'bronze' | 'silver' | 'gold' | 'platinum' | 'none');
              
              const getTileClasses = () => {
                
                let baseClasses = `relative aspect-square flex items-center justify-center rounded-lg ${benchmarkColor.border} border-2 transition-[transform,box-shadow,background-color] duration-300 `;
                
                if (selected) {
                  // Use skin's selected classes with enhanced glow
                  baseClasses += skin.selectedClasses + " shadow-[0_0_20px_rgba(34,197,94,0.4)] ";
                } else if (isAffected) {
                  // Affected tiles (e.g., from consumables) keep their special styling
                  baseClasses += "bg-gradient-to-br from-yellow-300 to-orange-400 text-white animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.5)] ";
                } else if (reused) {
                  // Last word tiles: DON'T apply skin background - let overlay show through
                  baseClasses += "relative ";
                  
                  // Add a subtle ring accent and shadow when benchmark is reached
                  if (currentGrade !== 'none') {
                    // Convert border color to ring color for accent
                    let ringColor = benchmarkColor.border.replace('border-', 'ring-');
                    // Adjust shade to be slightly lighter for ring effect
                    ringColor = ringColor
                      .replace('-600', '-400')
                      .replace('-500', '-300')
                      .replace('-400', '-300');
                    baseClasses += "ring-2 " + ringColor + " ring-opacity-70 ";
                    
                    // Add a subtle shadow based on grade for extra visibility
                    if (currentGrade === 'platinum') {
                      baseClasses += "shadow-[0_0_8px_rgba(168,85,247,0.4)] ";
                    } else if (currentGrade === 'gold') {
                      baseClasses += "shadow-[0_0_8px_rgba(234,179,8,0.4)] ";
                    } else if (currentGrade === 'silver') {
                      baseClasses += "shadow-[0_0_8px_rgba(156,163,175,0.4)] ";
                    } else {
                      baseClasses += "shadow-[0_0_8px_rgba(217,119,6,0.4)] ";
                    }
                  }
                } else {
                  // Default tiles use skin's base classes
                  baseClasses += skin.baseClasses + " ";
                }

                // Special tile styling with enhanced visual effects (these override skin colors)
                if (special.type === "stone") {
                  baseClasses += "bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-[0_0_15px_rgba(75,85,99,0.4)] ";
                } else if (special.type === "wild") {
                  const isNewWild = newWildTiles.has(k);
                  baseClasses += `bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] ${isNewWild ? 'animate-blink-twice' : ''} `;
                } else if (special.type === "xfactor") {
                  baseClasses += "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.5)] ";
                } else if (special.type === "multiplier") {
                  baseClasses += "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] ";
                } else if (special.type === "shuffle") {
                  baseClasses += "bg-gradient-to-br from-red-200 to-red-300 text-red-800 shadow-[0_0_15px_rgba(239,68,68,0.3)] ";
                } else if (special.type === "freeze") {
                  baseClasses += "bg-gradient-to-br from-cyan-300 to-blue-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)] ";
                } else if (special.type === "decay") {
                  baseClasses += "bg-gradient-to-br from-yellow-300 to-green-500 text-white shadow-[0_0_15px_rgba(132,204,22,0.4)] ";
                } else if (special.type === "mirror") {
                  baseClasses += "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-[0_0_20px_rgba(156,163,175,0.5)] ";
                } else if (special.type === "magnet") {
                  baseClasses += "bg-gradient-to-br from-red-400 to-gray-400 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)] ";
                } else if (special.type === "bomb") {
                  baseClasses += "bg-gradient-to-br from-red-600 to-gray-900 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] ";
                } else if (special.type === "chain") {
                  baseClasses += "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] ";
                } else if (special.type === "ghost") {
                  baseClasses += "bg-gradient-to-br from-white/60 to-gray-200/60 text-gray-400 shadow-[0_0_15px_rgba(255,255,255,0.3)] opacity-70 ";
                } else if (special.type === "tax") {
                  baseClasses += "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] ";
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
                  {/* Overlay for last-played tiles (critical for gameplay) */}
                  {reused && benchmarkColor.background && (
                    <div 
                      className="absolute inset-0 rounded-lg pointer-events-none z-0"
                      style={{
                        backgroundColor: (() => {
                          // If no benchmark reached, use skin-specific default overlay
                          if (currentGrade === 'none') {
                            // Map each skin to its overlay color
                            const skinOverlays: Record<string, string> = {
                              original: 'rgba(168, 85, 247, 0.2)',   // primary purple
                              ocean: 'rgba(34, 211, 238, 0.3)',      // cyan
                              forest: 'rgba(52, 211, 153, 0.3)',     // emerald
                              sunset: 'rgba(251, 146, 60, 0.3)',     // orange
                              midnight: 'rgba(168, 85, 247, 0.3)',   // purple
                              neon: 'rgba(34, 211, 238, 0.4)'        // cyan
                            };
                            return skinOverlays[skin.id] || 'rgba(168, 85, 247, 0.2)';
                          }
                          
                          // When benchmark is reached, use benchmark-specific colors
                          const benchmarkColors: Record<string, string> = {
                            platinum: 'rgba(168, 85, 247, 0.3)',  // purple
                            gold: 'rgba(234, 179, 8, 0.3)',       // yellow
                            silver: 'rgba(156, 163, 175, 0.3)',   // gray
                            bronze: 'rgba(217, 119, 6, 0.3)'      // orange/amber
                          };
                          return benchmarkColors[currentGrade] || 'rgba(168, 85, 247, 0.2)';
                        })()
                      }}
                    />
                  )}
                  
                  <div className="text-3xl font-semibold tracking-wide relative z-10">
                    {special.type === "wild" ? "?" : special.type === "mirror" ? "🪞" : special.type === "ghost" ? ch : ch}
                  </div>
                  {/* Rarity indicators */}
                  {special.type !== "wild" && letterRarity(ch) === 1 && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-orange-600 dark:text-orange-400 z-10">
                      +
                    </div>}
                  {special.type !== "wild" && letterRarity(ch) === 2 && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-purple-600 dark:text-purple-400 z-10">
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
                  {special.type === "stone" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">
                      🪨
                    </div>}
                  {special.type === "freeze" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">❄️</div>}
                  {special.type === "decay" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">🦠</div>}
                  {special.type === "mirror" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">🪞</div>}
                  {special.type === "magnet" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">🧲</div>}
                  {special.type === "bomb" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">💣</div>}
                  {special.type === "chain" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">⛓️</div>}
                  {special.type === "ghost" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">👻</div>}
                  {special.type === "tax" && <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">💰</div>}
                  {special.frozen && <div className="absolute top-0 right-0 text-xs opacity-60">❄</div>}
                </Card>;
            }))}
            {!board && <div className="col-span-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading game...</p>
                </div>
              </div>}
           </div>

            <div className="mt-4 flex items-center gap-3 p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-muted backdrop-blur-sm">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Current:</span>
              <span className="text-xl font-bold flex-1 bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-600">{displayWordFromPath || "..."}</span>
            </div>

            {/* Submit Button for Tap Mode */}
            {(isTapMode || isMobile) && <div className="mt-3">
                <Button
                  onClick={submitTapWord}
                  disabled={path.length < 3}
                  variant={path.length >= 3 ? "default" : "outline"}
                  size="lg"
                  className={`w-full transition-all duration-300 ${
                    path.length >= 3
                      ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg hover:shadow-xl hover:scale-105"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  Submit Word
                </Button>
              </div>}
            
           </div>
        </div>
        
        <aside className="space-y-2 lg:space-y-3">
          <Card className="p-4 bg-gradient-to-br from-card/95 to-muted/30 backdrop-blur-sm border-brand-500/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Score</div>
                <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-600">{score}</div>
                
                {/* Mode-specific indicators */}
                {settings.mode === "time_attack" && timeAttackStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Time Remaining</div>
                      <div className={`text-2xl font-bold ${timeAttackTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : timeAttackTimeRemaining <= 30 ? 'text-orange-500' : 'text-green-500'}`}>
                        ⏱️ {timeAttackTimeRemaining}s
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Speed Multiplier</div>
                      <div className={`text-lg font-bold ${timeAttackSpeedMultiplier >= 2.0 ? 'text-yellow-500' : timeAttackSpeedMultiplier >= 1.4 ? 'text-green-500' : 'text-blue-500'}`}>
                        ⚡ {timeAttackSpeedMultiplier.toFixed(1)}x
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-gradient-to-r from-blue-400 via-green-400 to-yellow-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (timeAttackSpeedMultiplier - 1) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Words: {timeAttackWordsFound} • Next ⚡ at {Math.ceil(timeAttackWordsFound / 3) * 3 + 3 - timeAttackWordsFound} words
                    </div>
                  </div>
                )}
                
                {settings.mode === "endless" && endlessStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Difficulty Level</div>
                      <div className="text-lg font-bold text-purple-500 flex items-center gap-2">
                        <span className="text-2xl">∞</span> 
                        <span>Level {endlessDifficulty}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stone Spawn Rate</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div 
                          className="bg-gradient-to-r from-gray-400 to-gray-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, 15 + (endlessDifficulty * 2.5))}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Math.round(15 + Math.min(25, endlessDifficulty * 2.5))}%
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Words: {usedWords.length} • Boards: {endlessDifficulty}
                    </div>
                  </div>
                )}
                
                {settings.mode === "survival" && survivalStarted && (
                  <div className="mt-2 space-y-3">
                    {/* Wave Display */}
                    <div>
                      <div className="text-xs text-muted-foreground">Wave</div>
                      <div className="text-lg font-bold text-blue-500 flex items-center gap-2">
                        <span>Wave {survivalWave}</span>
                        {survivalWave % 5 === 0 && <span className="text-orange-500 animate-pulse">⚡ BOSS</span>}
                      </div>
                    </div>

                    {/* Lives Display */}
                    <LivesDisplay
                      lives={survivalLives}
                      maxLives={survivalMaxLives}
                      shields={survivalShields}
                      lifeFragments={survivalLifeFragments}
                    />

                    {/* Combo Display */}
                    <ComboDisplay comboState={survivalComboState} />

                    {/* Boss Wave Display */}
                    {survivalBossWordRequired && survivalCurrentBoss && (
                      <BossWaveDisplay
                        boss={survivalCurrentBoss}
                        progress={survivalBossProgress}
                        timeRemaining={survivalChallengeTimeRemaining}
                      />
                    )}

                    {/* Wave Challenge Display */}
                    {!survivalBossWordRequired && survivalCurrentChallenge && (
                      <WaveChallengeDisplay
                        challenge={survivalCurrentChallenge}
                        progress={survivalChallengeProgress}
                        timeRemaining={survivalChallengeTimeRemaining}
                      />
                    )}

                    {/* Power-Ups Inventory */}
                    <PowerUpsInventory
                      activePowerUps={survivalActivePowerUps}
                      inventoryPowerUps={survivalInventoryPowerUps}
                      onActivate={(powerUp) => {
                        const result = applyPowerUpEffect(powerUp.type, {});
                        if (result.success) {
                          toast.success(result.message);

                          // BUG FIX #5: Implement all power-up effects
                          if (result.effect.lives) {
                            setSurvivalLives(prev => Math.min(prev + result.effect.lives, survivalMaxLives));
                          }
                          if (result.effect.shield) {
                            setSurvivalShields(prev => prev + result.effect.shield);
                          }
                          if (result.effect.removeStones) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 1,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.refreshBoard) {
                            // Regenerate board
                            const newBoard = Array.from({ length: size }, () =>
                              Array.from({ length: size }, () => randomLetter())
                            );
                            setBoard(newBoard);
                          }
                          if (result.effect.revealHints) {
                            // TODO: Implement hint system
                            toast.info('Hint system coming soon!');
                          }
                          if (result.effect.freezeDifficulty) {
                            setSurvivalDifficultyFrozen(3);
                          }
                          if (result.effect.wildcardActive) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingWaves: 1,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.pointsMultiplier) {
                            setSurvivalPointsMultiplier(result.effect.pointsMultiplier);
                          }
                          if (result.effect.comboBoost) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 5,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.lifeLink) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingWaves: 3,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.safetyNet) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 3,
                              activatedAt: Date.now()
                            }]);
                          }

                          // Remove from inventory
                          setSurvivalInventoryPowerUps(prev => {
                            const idx = prev.findIndex(p => p.id === powerUp.id);
                            if (idx >= 0) {
                              return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                            }
                            return prev;
                          });
                        }
                      }}
                    />

                    {/* Wave Score */}
                    <div className="text-xs text-muted-foreground">
                      Wave Score: <span className="font-bold text-foreground">{survivalWaveScore}</span>
                    </div>
                  </div>
                )}
                
                {settings.mode === "zen" && zenStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Zen Mode</div>
                      <div className="text-sm text-green-500">
                        🧘 No pressure
                      </div>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-xs text-green-600 dark:text-green-400">
                        💡 Tip: {(() => {
                          const tips = [
                            "Longer words (5+ letters) give bonus points!",
                            "Rare letters like Q, X, Z give extra score",
                            "Reusing tiles from your last word adds multipliers",
                            "Look for word endings like -ING, -TION, -ED",
                            "Try to chain words with shared letters",
                            "Special tiles can multiply your score",
                            "Use the Hint button if you're stuck!",
                            "Undo lets you try different strategies"
                          ];
                          return tips[usedWords.length % tips.length];
                        })()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Hints: {zenHintsUsed} | Undos available: {zenUndoStack.length}
                    </div>
                  </div>
                )}
                
                {benchmarks && settings.mode !== "endless" && settings.mode !== "puzzle" && <div className="mt-3 space-y-2 p-2 bg-muted/30 rounded-lg border border-muted">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Challenge Tiers</div>
                    <div className="space-y-1.5">
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.bronze
                          ? 'bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-600/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.bronze ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                          🥉 Bronze
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.bronze ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>{benchmarks.bronze}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.silver
                          ? 'bg-gradient-to-r from-gray-400/20 to-gray-300/10 border border-gray-400/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.silver ? 'text-gray-600 dark:text-gray-300' : 'text-muted-foreground'}`}>
                          🥈 Silver
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.silver ? 'text-gray-600 dark:text-gray-300' : 'text-muted-foreground'}`}>{benchmarks.silver}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.gold
                          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/10 border border-yellow-500/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.gold ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                          🥇 Gold
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.gold ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>{benchmarks.gold}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.platinum
                          ? 'bg-gradient-to-r from-purple-500/20 to-purple-400/10 border border-purple-500/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.platinum ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                          💎 Platinum
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.platinum ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>{benchmarks.platinum}</span>
                      </div>
                    </div>
                    {/* Enhanced Progress bar */}
                    <div className="w-full bg-secondary/30 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${
                        score >= benchmarks.platinum
                          ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                          : score >= benchmarks.gold
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                            : score >= benchmarks.silver
                              ? 'bg-gradient-to-r from-gray-400 to-gray-300'
                              : score >= benchmarks.bronze
                                ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                                : 'bg-gradient-to-r from-primary/60 to-primary/40'
                      }`} style={{
                    width: `${Math.min(100, score / benchmarks.platinum * 100)}%`
                  }} />
                    </div>
                    <div className="text-xs text-center font-medium">
                      {score >= benchmarks.platinum ? (
                        <span className="text-purple-600 dark:text-purple-400 font-bold">✨ Platinum Achieved!</span>
                      ) : score >= benchmarks.gold ? (
                        <span className="text-yellow-600 dark:text-yellow-400">{benchmarks.platinum - score} to Platinum</span>
                      ) : score >= benchmarks.silver ? (
                        <span className="text-gray-600 dark:text-gray-400">{benchmarks.gold - score} to Gold</span>
                      ) : score >= benchmarks.bronze ? (
                        <span className="text-orange-600 dark:text-orange-400">{benchmarks.silver - score} to Silver</span>
                      ) : (
                        <span className="text-muted-foreground">{benchmarks.bronze - score} to Bronze</span>
                      )}
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
                {usedWords.length >= 1 ? "Special tiles active!" : ""}
                {gameOver && finalGrade !== "None" && <div className="mt-1 font-medium">Final: {finalGrade}</div>}
                {settings.mode === "daily" && (
                  <>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {settings.dailyMovesLimit - movesUsed} moves remaining
                    </div>
                    {!gameOver && usedWords.length >= 1 && (() => {
                      const nextTiles = previewNextSpecialTiles(
                        usedWords.length,
                        getDailySeed(),
                        size,
                        specialTiles
                      );
                      return nextTiles.length > 0 ? (
                        <div className="mt-2 hidden lg:block">
                          <SpecialTilePreview tiles={nextTiles} />
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
                {settings.mode === "time_attack" && (
                  <div className="mt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${timeAttackTimeRemaining <= 10 ? 'text-red-500' : timeAttackTimeRemaining <= 30 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        ⏰ {Math.floor(timeAttackTimeRemaining / 60)}:{(timeAttackTimeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                )}
                {settings.mode === "endless" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {endlessStarted ? (
                      <span className="flex items-center gap-1">
                        <span className="text-purple-500 font-medium">∞ Level {endlessDifficulty}</span>
                        <span>| Words: {usedWords.length}</span>
                      </span>
                    ) : (
                      <span>Endless mode ready</span>
                    )}
                  </div>
                )}
                {settings.mode === "survival" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {survivalStarted ? (
                      <span className="flex items-center gap-2">
                        <span>{'❤️'.repeat(survivalLives)}</span>
                        <span className="text-blue-500 font-medium">Wave {survivalWave}</span>
                        {survivalBossWordRequired && <span className="text-orange-500 font-medium animate-pulse">👑 BOSS</span>}
                      </span>
                    ) : (
                      <span>Press "Start Survival" to begin</span>
                    )}
                  </div>
                )}
                {settings.mode === "zen" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Hints used: {zenHintsUsed} | Undos: {zenUndoStack.length}
                  </div>
                )}
                {settings.mode === "chaos" && (
                  <div className="mt-1 text-xs">
                    {!chaosStarted ? (
                      <div className="text-muted-foreground">
                        Press "Start Chaos" to begin
                      </div>
                    ) : (
                      <div className={`font-medium ${movesUsed >= 13 ? 'text-red-500 animate-pulse' : movesUsed >= 10 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        🔀 Moves: {movesUsed}/15
                      </div>
                    )}
                  </div>
                )}
                {puzzleMode && currentPuzzleId && (() => {
                  const puzzle = getPuzzleById(currentPuzzleId);
                  if (!puzzle) return null;
                  return (
                    <div className="mt-1 text-xs space-y-1">
                      <div className="font-medium text-muted-foreground">
                        🧩 {puzzle.name}
                      </div>
                      <div className="text-muted-foreground">
                        Moves: {puzzle.maxMoves - puzzleMovesRemaining}/{puzzle.maxMoves}
                      </div>
                      <div className="text-muted-foreground">
                        Required words: {puzzleFoundWords.size}/{puzzleRequiredWords.size}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {puzzle.requiredWords.map(word => (
                          <span 
                            key={word}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              puzzleFoundWords.has(word.toUpperCase())
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
                {puzzleMode && gameOver && currentPuzzleId && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => loadPuzzle(currentPuzzleId)}
                      className="w-full text-xs"
                    >
                      🔄 Replay Puzzle
                    </Button>
                    {getNextPuzzle(currentPuzzleId) && (
                      <Button 
                        variant="hero" 
                        size="sm" 
                        onClick={() => {
                          const nextPuzzle = getNextPuzzle(currentPuzzleId);
                          if (nextPuzzle) {
                            loadPuzzle(nextPuzzle.id);
                          }
                        }}
                        className="w-full text-xs"
                      >
                        ➡️ Next Puzzle: {getNextPuzzle(currentPuzzleId)?.name}
                      </Button>
                    )}
                  </div>
                )}
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
                                  <div>Link</div><div className="text-right">×{entry.breakdown.linkMultiplier.toFixed(1)}</div>
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

      {/* Survival Mode Modals */}
      {settings.mode === "survival" && survivalStarted && (
        <>
          {/* Shop Modal */}
          {survivalShowShop && (
            <ShopModal
              items={generateShopItems(survivalWave, score)}
              currentScore={score}
              currentLives={survivalLives}
              onPurchase={(item) => {
                if (item.costType === 'points' && score >= item.cost) {
                  setScore(prev => prev - item.cost);

                  // Apply item effect
                  switch (item.type) {
                    case 'extra_life':
                      setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
                      toast.success('❤️ +1 Life!');
                      break;
                    case 'stone_eraser':
                      // Remove all stone tiles
                      setSpecialTiles(prev => prev.map(row => row.map(tile =>
                        tile.type === 'stone' ? { type: null } : tile
                      )));
                      toast.success('🧹 All stones removed!');
                      break;
                    case 'shield':
                      setSurvivalShields(prev => prev + 1);
                      toast.success('🛡️ +1 Shield!');
                      break;
                    case 'time_freeze':
                      setSurvivalDifficultyFrozen(3);
                      toast.success('❄️ Difficulty frozen for 3 waves!');
                      break;
                    case 'double_points':
                      setSurvivalPointsMultiplier(2.0);
                      toast.success('💰 Double points for next wave!');
                      break;
                    case 'power_up_random':
                      const randomPU = getRandomPowerUp();
                      setSurvivalInventoryPowerUps(prev => [...prev, randomPU]);
                      toast.success(`🎲 Received ${randomPU.name}!`);
                      break;
                    case 'power_up_rare':
                      const rarePU = getRandomPowerUp(Math.random() < 0.5 ? 'rare' : 'epic');
                      setSurvivalInventoryPowerUps(prev => [...prev, rarePU]);
                      toast.success(`⭐ Received ${rarePU.name}!`);
                      break;
                  }

                  setSurvivalShowShop(false);

                  // Generate next wave challenge
                  const nextChallenge = getRandomWaveChallenge(survivalWave);
                  setSurvivalCurrentChallenge(nextChallenge);
                  toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
                } else {
                  toast.error('Not enough resources!');
                }
              }}
              onClose={() => {
                setSurvivalShowShop(false);
                const nextChallenge = getRandomWaveChallenge(survivalWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
              }}
            />
          )}

          {/* Choice Event Modal */}
          {survivalPendingEvent && (
            <ChoiceEventModal
              event={survivalPendingEvent}
              onChoice={(optionIndex) => {
                const option = survivalPendingEvent.options[optionIndex];

                // BUG FIX #4: Handle gambles and mysteries at choice time
                let actualEffect = { ...option.effect };

                if (option.effect.gamble === 'life_gambit') {
                  // 60% chance to gain 1 life, 40% chance to lose 1 life
                  actualEffect.lives = Math.random() < 0.6 ? 1 : -1;
                  actualEffect.gamble = undefined;
                } else if (option.effect.gamble === 'score_gambit') {
                  // 50% chance to gain 500 points, 50% chance to lose 300 points
                  actualEffect.score = Math.random() < 0.5 ? 500 : -300;
                  actualEffect.gamble = undefined;
                } else if (option.effect.mystery === 'mystery_box') {
                  // 50% chance for good outcome, 50% for bad
                  if (Math.random() < 0.5) {
                    actualEffect.powerUp = 'combo_boost';
                    actualEffect.lives = 1;
                  } else {
                    actualEffect.addStoneTiles = 2;
                    actualEffect.score = -100;
                  }
                  actualEffect.mystery = undefined;
                }

                const messages = applyEventEffect(actualEffect, {});

                // Apply effects
                if (actualEffect.lives) {
                  setSurvivalLives(prev => Math.max(0, Math.min(prev + actualEffect.lives, survivalMaxLives)));
                }
                if (actualEffect.score) {
                  setScore(prev => Math.max(0, prev + actualEffect.score));
                }
                if (actualEffect.removeStoneTiles) {
                  setSpecialTiles(prev => prev.map(row => row.map(tile =>
                    tile.type === 'stone' ? { type: null } : tile
                  )));
                }
                // BUG FIX #7: Implement addStoneTiles effect
                if (actualEffect.addStoneTiles) {
                  setSpecialTiles(prev => {
                    const newTiles = [...prev.map(row => [...row])];
                    const emptyPositions: Array<{r: number, c: number}> = [];

                    // Find all empty positions
                    for (let r = 0; r < size; r++) {
                      for (let c = 0; c < size; c++) {
                        if (newTiles[r][c].type === null) {
                          emptyPositions.push({ r, c });
                        }
                      }
                    }

                    // Add stone tiles to random empty positions
                    const stonesToAdd = Math.min(actualEffect.addStoneTiles, emptyPositions.length);
                    for (let i = 0; i < stonesToAdd; i++) {
                      const randomIndex = Math.floor(Math.random() * emptyPositions.length);
                      const pos = emptyPositions.splice(randomIndex, 1)[0];
                      newTiles[pos.r][pos.c] = { type: 'stone' };
                    }

                    return newTiles;
                  });
                }
                if (actualEffect.shield) {
                  setSurvivalShields(prev => prev + actualEffect.shield);
                }
                if (actualEffect.powerUp) {
                  const powerUp = POWER_UPS[actualEffect.powerUp];
                  setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
                }

                // Show messages
                messages.forEach(msg => toast.info(msg));

                setSurvivalPendingEvent(null);

                // Generate next wave challenge
                const nextChallenge = getRandomWaveChallenge(survivalWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
              }}
            />
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </section>
  );
}

export default WordPathGame;
