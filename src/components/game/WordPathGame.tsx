import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, type Benchmarks } from "@/lib/benchmarks";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";
import { supabase } from "@/integrations/supabase/client";
import { useDailyChallengeState } from "@/hooks/useDailyChallengeState";
import { useGoals } from "@/hooks/useGoals";
import { useConsumables } from "@/hooks/useConsumables";
import { ConsumableInventoryPanel, QuickUseBar } from "@/components/consumables/ConsumableInventory";
import { CONSUMABLES, ACHIEVEMENT_CONSUMABLE_REWARDS, type ConsumableId } from "@/lib/consumables";
import type { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";

type Pos = { r: number; c: number };
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

type GameMode = "classic" | "target" | "daily";

type GameSettings = {
  scoreThreshold: number;
  mode: GameMode;
  targetTier: "bronze" | "silver" | "gold" | "platinum";
  difficulty: "easy" | "medium" | "hard" | "expert";
  gridSize: number;
  dailyMovesLimit: number;
};

// Letter frequencies for English to generate fun boards
const LETTERS: Array<[string, number]> = [
  ["E", 12.02], ["T", 9.10], ["A", 8.12], ["O", 7.68], ["I", 7.31], ["N", 6.95],
  ["S", 6.28], ["R", 6.02], ["H", 5.92], ["D", 4.32], ["L", 3.98], ["U", 2.88],
  ["C", 2.71], ["M", 2.61], ["F", 2.30], ["Y", 2.11], ["W", 2.09], ["G", 2.03],
  ["P", 1.82], ["B", 1.49], ["V", 1.11], ["K", 0.69], ["X", 0.17], ["Q", 0.11], ["J", 0.10], ["Z", 0.07],
];

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
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    let letter: string;
    if (seed && seedCounter !== undefined) {
      const rng = seedRandom(seed + seedCounter + attempts);
      letter = seededRandomLetter(rng);
    } else {
      letter = randomLetter();
    }
    
    const currentCount = letterCounts.get(letter) || 0;
    if (currentCount < maxLetterInstances) {
      letterCounts.set(letter, currentCount + 1);
      return letter;
    }
    attempts++;
  }
  
  // Fallback: find any letter with less than max instances
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
        adjacent.push({ r: newR, c: newC });
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
    board = Array.from({ length: size }, (_, r) => 
      Array.from({ length: size }, (_, c) => 
        constrainedRandomLetter(letterCounts, seed, r * size + c)
      )
    );
  } else {
    board = Array.from({ length: size }, () => 
      Array.from({ length: size }, () => constrainedRandomLetter(letterCounts))
    );
  }
  
  // Validate Q-U adjacency and fix if needed
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'Q') {
        // Check if there's a U adjacent to this Q
        const adjacentPositions = getAdjacentPositions({ r, c }, size);
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
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return function() {
    hash = Math.imul(hash, 0x9e3779b9);
    hash = hash ^ (hash >>> 16);
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
  let lo = 0, hi = sortedWords.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const v = sortedWords[mid];
    if (v < prefix) lo = mid + 1; else hi = mid;
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
  shuffle: 0.03  // Rare occurrence
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

function pickWeighted(pool: Array<[string, number]>) {
  const total = pool.reduce((a, [, f]) => a + f, 0);
  let x = Math.random() * total;
  for (const [ch, f] of pool) {
    if ((x -= f) <= 0) return ch;
  }
  return pool[0]?.[0] ?? "E";
}
function randomVowelWeighted() { return pickWeighted(VOWEL_POOL); }
function randomConsonantWeighted() { return pickWeighted(CONSONANT_POOL); }
function isVowel(ch: string) { return VOWELS.has(ch.toUpperCase()); }
function countVowelRatio(grid: string[][]) {
  let v = 0, t = 0;
  for (const row of grid) for (const ch of row) { t++; if (isVowel(ch)) v++; }
  return t ? v / t : 0.5;
}

type ProbeResult = { words: Set<string>; linkFound: boolean; usage: Map<string, number> };

function probeGrid(
  grid: string[][],
  wordSet: Set<string>,
  sortedArr: string[],
  K: number,
  maxNodes: number
): ProbeResult {
  const N = grid.length;
  let nodes = 0;
  const words = new Set<string>();
  const usage = new Map<string, number>();
  let linkFound = false;
  const pathSets: Array<Set<string>> = [];
  const dirs = [-1, 0, 1];

  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const stack: { pos: Pos; path: Pos[]; word: string }[] = [
      { pos: { r, c }, path: [], word: "" },
    ];
    while (stack.length) {
      const cur = stack.pop()!;
      const { pos, path: pp, word } = cur;
      const k = keyOf(pos);
      if (pp.find((p) => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      nodes++;
      if (nodes > maxNodes) return { words, linkFound, usage };

      if (nextWord.length >= 3 && wordSet.has(nextWord)) {
        if (!words.has(nextWord)) {
          words.add(nextWord);
          const set = new Set(nextPath.map(keyOf));
          for (const kk of set) usage.set(kk, (usage.get(kk) ?? 0) + 1);
          for (const s of pathSets) {
            let overlaps = false;
            for (const kk of set) { if (s.has(kk)) { overlaps = true; break; } }
            if (overlaps) { linkFound = true; break; }
          }
          pathSets.push(set);
          if (words.size >= K && linkFound) return { words, linkFound, usage };
        }
      }

      if (!binaryHasPrefix(sortedArr, nextWord)) continue;

      for (const dr of dirs) for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.r + dr, nc = pos.c + dc;
        if (!within(nr, nc, N)) continue;
        if (nextPath.find((p) => p.r === nr && p.c === nc)) continue;
        stack.push({ pos: { r: nr, c: nc }, path: nextPath, word: nextWord });
      }
    }
  }

  return { words, linkFound, usage };
}

function mutateGrid(
  grid: string[][],
  usage: Map<string, number>,
  vowelRatio: number,
  vMin: number,
  vMax: number,
  count: number
) {
  const N = grid.length;
  const positions: Array<{ r: number; c: number; k: string; u: number }> = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = `${r},${c}`;
    positions.push({ r, c, k, u: usage.get(k) ?? 0 });
  }
  positions.sort((a, b) => (a.u - b.u) || (Math.random() - 0.5));
  const chosen = positions.slice(0, Math.min(count, positions.length));
  const biasToVowel = vowelRatio < vMin ? true : vowelRatio > vMax ? false : Math.random() < 0.5;
  const newGrid = grid.map((row) => row.slice());
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

export default function WordPathGame({ onBackToTitle, initialMode = "classic" }: { onBackToTitle?: () => void; initialMode?: "classic" | "daily" }) {
  const [user, setUser] = useState<User | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const { updateGoalProgress } = useGoals(user);
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
  const [board, setBoard] = useState<string[][]>(() => makeBoard(size));
  const [specialTiles, setSpecialTiles] = useState<SpecialTile[][]>(() => 
    Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null })))
  );
  const [path, setPath] = useState<Pos[]>([]);
  const [dragging, setDragging] = useState(false);
  const [usedWords, setUsedWords] = useState<{word: string, score: number}[]>([]);
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
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    scoreThreshold: benchmarks?.bronze || 100, // Use Bronze threshold
    mode: "classic",
    targetTier: "silver",
    difficulty: "medium",
    gridSize: 4,
    dailyMovesLimit: getDailyMovesLimit()
  });
  const [showDifficultyDialog, setShowDifficultyDialog] = useState(false);
  const [affectedTiles, setAffectedTiles] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [movesUsed, setMovesUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showWildDialog, setShowWildDialog] = useState(false);
  const [wildTileInput, setWildTileInput] = useState('');
  const [pendingWildPath, setPendingWildPath] = useState<Pos[] | null>(null);
  
  // Consumable activation states
  const [activatedConsumables, setActivatedConsumables] = useState<Set<ConsumableId>>(new Set());

  // Initialize user auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => setUser(session?.user || null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // Start daily challenge if initial mode is daily
  useEffect(() => {
    if (initialMode === "daily") {
      startDailyChallenge().catch(console.error);
    }
  }, [initialMode]);

  // Reset game start time when new game starts
  useEffect(() => {
    setGameStartTime(Date.now());
  }, [board]);

  // Save standard game result and update goals when game ends
  const saveGameResult = async () => {
    if (!user || settings.mode === "daily" || !gameOver) return;

    const longestWord = usedWords.reduce((longest, wordEntry) => 
      wordEntry.word.length > longest.length ? wordEntry.word : longest, ""
    );

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

      const { data, error } = await supabase
        .from("standard_game_results")
        .insert(gameResult)
        .select()
        .single();

      if (error) throw error;

      // Update goal progress
      if (data) {
        await updateGoalProgress({
          score: score,
          words_found: usedWords.length,
          longest_word: longestWord,
          achievement_grade: finalGrade,
          game_id: data.id
        });
      }
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
        challenge_date: getDailySeed(), // Use the daily seed as the challenge date
        score: score,
        achievement_level: finalGrade
      };

      const { error } = await supabase
        .from("daily_challenge_results")
        .insert(challengeResult);

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
  const saveDailyState = async () => {
    if (settings.mode === "daily") {
      const gameState = {
        board,
        specialTiles,
        usedWords,
        score,
        streak,
        movesUsed,
        unlocked: Array.from(unlocked),
        gameOver,
        finalGrade,
        lastWordTiles: Array.from(lastWordTiles),
        seed: getDailySeed()
      };

      await dailyChallengeState.saveState(gameState);
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
      return true;
    }
    return false;
  };

  // Save state whenever relevant data changes in daily mode
  useEffect(() => {
    if (settings.mode === "daily") {
      saveDailyState();
    }
  }, [board, specialTiles, usedWords, score, streak, movesUsed, unlocked, gameOver, finalGrade, lastWordTiles, settings.mode]);

useEffect(() => {
  let mounted = true;
  fetch("/words.txt")
    .then((r) => r.text())
    .then((txt) => {
      if (!mounted) return;
      const words = txt.split(/\r?\n/).filter(Boolean).map((w) => w.trim().toLowerCase());
      const s = new Set<string>();
      for (const w of words) if (w.length >= 3) s.add(w);
      const arr = Array.from(s);
      arr.sort();
      setDict(s);
      setSorted(arr);
      // Prepare a solvable board
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
    })
    .catch(() => toast.error("Failed to load dictionary. Offline mode."));
  return () => { mounted = false };
  }, []);

  const wordFromPath = useMemo(() => path.map((p) => board[p.r][p.c]).join("").toLowerCase(), [path, board]);
  
  // Display version that shows ? for Wild tiles during selection
  const displayWordFromPath = useMemo(() => {
    return path.map((p) => {
      if (specialTiles[p.r][p.c].type === "wild") {
        return "?";
      }
      return board[p.r][p.c];
    }).join("").toUpperCase();
  }, [path, board, specialTiles]);

  function handleWildSubmit() {
    if (!pendingWildPath || !wildTileInput || !dict) return;
    
    const wildcardPositions = pendingWildPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    if (wildcardPositions.length !== 1) return;
    
    const wildPos = wildcardPositions[0];
    const wildIndex = pendingWildPath.findIndex(p => p.r === wildPos.r && p.c === wildPos.c);
    
    // Create the word with the user's chosen letter
    const testWord = pendingWildPath.map((p, i) => {
      if (i === wildIndex) {
        return wildTileInput.toLowerCase();
      }
      return board[p.r][p.c];
    }).join("").toLowerCase();
    
    // Validate the word
    if (testWord.length < 3) {
      toast.warning("Words must be at least 3 letters");
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
    setWildTileInput('');
    
    // Set the path back and continue submission with the chosen word
    setPath(pendingWildPath);
    setPendingWildPath(null);
    
    // Now continue with the normal submission process using the validated word
    setTimeout(() => {
      submitWordWithWildLetter(testWord, pendingWildPath, wildTileInput.toLowerCase());
    }, 0);
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
      const overlap = wordPath.some((p) => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return;
      }
    }

    setUsedWords(prev => [...prev, {word: actualWord, score: totalGain}]);
    
    // Update the wild tile with the chosen letter
    const newBoard = board.map(row => [...row]);
    const wildcardPositions = wordPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    if (wildcardPositions.length === 1) {
      const wildPos = wildcardPositions[0];
      newBoard[wildPos.r][wildPos.c] = wildLetter.toUpperCase();
    }
    setBoard(newBoard);
    
    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }

    let base = actualWord.length * actualWord.length;

    const multiplierTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "multiplier");
    let multiplier = 1;
    multiplierTiles.forEach(p => {
      const tile = specialTiles[p.r][p.c];
      if (tile.value) multiplier *= tile.value;
    });

    const sharedTilesCount = lastWordTiles.size ? wordPath.filter((p) => lastWordTiles.has(keyOf(p))).length : 0;
    const linkBonus = 2 * sharedTilesCount;

    const raritySum = wordPath.reduce((acc, p) => acc + letterRarity(board[p.r][p.c]), 0);
    const rarityBonus = RARITY_MULTIPLIER * raritySum;

    const qualifies = actualWord.length >= STREAK_TARGET_LEN;
    const nextStreak = qualifies ? streak + 1 : 0;
    const chainBonus = 5 * nextStreak;

    const timeBonus = 0;

    const totalGain = Math.round((base + rarityBonus + chainBonus + linkBonus + timeBonus) * multiplier);

    const xFactorTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "xfactor");
    let xChanged = 0;
    if (xFactorTiles.length > 0) {
      const newBoardAfterX = newBoard.map(row => [...row]);
      const newSpecialTiles = specialTiles.map(row => [...row]);
      const changedTileKeys = new Set<string>();

      // Count current letters on the board for constraint enforcement
      const currentLetterCounts = new Map<string, number>();
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const letter = newBoardAfterX[r][c];
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
            const oldLetter = newBoardAfterX[pos.r][pos.c];
            currentLetterCounts.set(oldLetter, (currentLetterCounts.get(oldLetter) || 0) - 1);
            
            // Generate new constrained letter
            newBoardAfterX[pos.r][pos.c] = constrainedRandomLetter(currentLetterCounts);
            newSpecialTiles[pos.r][pos.c] = { type: null };
            changedTileKeys.add(keyOf(pos));
          }
        });
      });

      setBoard(newBoardAfterX);
      setSpecialTiles(newSpecialTiles);
      setAffectedTiles(changedTileKeys);
      xChanged = changedTileKeys.size;

      setTimeout(() => {
        setAffectedTiles(new Set());
      }, 1000);

      toast.info("X-Factor activated! Adjacent tiles transformed!");
    }

    // Handle shuffle tiles
    const shuffleTiles = wordPath.filter(p => specialTiles[p.r][p.c].type === "shuffle");
    if (shuffleTiles.length > 0) {
      // Create a copy of the current board
      const currentBoard = (xFactorTiles.length > 0 ? newBoard : board).map(row => [...row]);
      
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

    let newSpecialTiles = specialTiles.map(row => [...row]);
    wordPath.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = { type: null };
      }
    });
    newSpecialTiles = expireSpecialTiles(newSpecialTiles);
    setSpecialTiles(newSpecialTiles);

    setLastWordTiles(new Set(wordPath.map(keyOf)));
    
    // Check for new achievements (same logic as original submitWord)
    const newAchievements: AchievementId[] = [];
    const checkAndAdd = (condition: boolean, achievement: AchievementId) => {
      if (condition && !unlocked.has(achievement)) {
        newAchievements.push(achievement);
      }
    };

    if (nextStreak >= 3) checkAndAdd(true, "streak3");
    if (nextStreak >= 5) checkAndAdd(true, "streak5");
    if (nextStreak >= 8) checkAndAdd(true, "streak8");
    if (sharedTilesCount >= 2) checkAndAdd(true, "link2");
    if (sharedTilesCount >= 3) checkAndAdd(true, "link3");
    if (sharedTilesCount >= 4) checkAndAdd(true, "link4");
    if (actualWord.length >= 7) checkAndAdd(true, "long7");
    if (actualWord.length >= 8) checkAndAdd(true, "epic8");
    const ultraCount = wordPath.reduce((acc, p) => acc + (["J","Q","X","Z"].includes(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
    if (ultraCount >= 2) checkAndAdd(true, "rare2");
    if (multiplier >= 3) checkAndAdd(true, "combo3x");
    if (xChanged >= 3) checkAndAdd(true, "chaos3");
    const ratio = vowelRatioOfWord(actualWord);
    if (actualWord.length >= 6 && ratio >= 0.6) checkAndAdd(true, "vowelStorm");
    if (actualWord.length >= 6 && ratio <= 0.2) checkAndAdd(true, "consonantCrunch");
    if (wildUsed) checkAndAdd(true, "wildWizard");
    const nextUsedCount = usedWords.length + 1;
    if (nextUsedCount >= 10) checkAndAdd(true, "cartographer10");
    if (nextUsedCount >= 15) checkAndAdd(true, "collector15");
    if (discoverableCount > 0) {
      const pct = (nextUsedCount / discoverableCount) * 100;
      if (pct >= 80) checkAndAdd(true, "completionist80");
      if (nextUsedCount >= discoverableCount) checkAndAdd(true, "completionist100");
    }

    // Calculate achievement bonus
    const achievementBonus = newAchievements.reduce((total, id) => total + ACHIEVEMENTS[id].scoreBonus, 0);
    const finalScore = score + totalGain + achievementBonus;
    
    setScore(finalScore);
    setStreak(nextStreak);

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
        duration: 4000,
      });
    });

    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = (settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1)) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);
        
        // Check for firstWin achievement
        if ((grade === "Gold" || grade === "Platinum") && !unlocked.has("firstWin")) {
          const achievement = ACHIEVEMENTS.firstWin;
          setScore(prev => prev + achievement.scoreBonus);
          setUnlocked(prev => {
            const next = new Set(prev);
            next.add("firstWin");
            return next;
          });
          toast.success(`💎 ${achievement.label} (+${achievement.scoreBonus} pts)`, {
            duration: 4000,
          });
        }
        
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
            emptyPositions.push({ r, c });
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
        const dailyMovesExceeded = settings.mode === "daily" && (movesUsed + 1) >= settings.dailyMovesLimit;
        const any = hasAnyValidMove(newBoard, lastWordTiles.size ? lastWordTiles : new Set(wordPath.map(keyOf)), dict, sorted, new Set(usedWords.map(entry => entry.word)));
        
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            if (s >= benchmarks.platinum) grade = "Platinum";
            else if (s >= benchmarks.gold) grade = "Gold";
            else if (s >= benchmarks.silver) grade = "Silver";
            else if (s >= benchmarks.bronze) grade = "Bronze";
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
              
              if ((grade === "Gold" || grade === "Platinum") && !prev.has("firstWin")) {
                next.add("firstWin");
                bonusScore += ACHIEVEMENTS.firstWin.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.firstWin.label} (+${ACHIEVEMENTS.firstWin.scoreBonus} pts)`, {
                  duration: 4000,
                });
              }
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000,
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

  function clearPath() {
    setPath([]);
    setDragging(false);
  }

// Special tile generation functions
function generateSpecialTile(): SpecialTile {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [type, rarity] of Object.entries(SPECIAL_TILE_RARITIES)) {
    cumulative += rarity;
    if (rand <= cumulative) {
      const expiryTurns = Math.floor(Math.random() * 5) + 1; // Random 1-5 turns
      if (type === "multiplier") {
        const multiplierValues = [2, 3, 4];
        const value = multiplierValues[Math.floor(Math.random() * multiplierValues.length)];
        return { type: type as SpecialTileType, value, expiryTurns };
      }
      return { type: type as SpecialTileType, expiryTurns };
    }
  }
  
  return { type: null };
}

function shouldIntroduceSpecialTiles(currentScore: number, bronzeThreshold: number): boolean {
  return currentScore >= bronzeThreshold;
}

function createEmptySpecialTilesGrid(size: number): SpecialTile[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null })));
}

function expireSpecialTiles(specialTiles: SpecialTile[][]): SpecialTile[][] {
  return specialTiles.map(row => 
    row.map(tile => {
      if (tile.type !== null && tile.expiryTurns !== undefined) {
        const newExpiryTurns = tile.expiryTurns - 1;
        if (newExpiryTurns <= 0) {
          return { type: null }; // Expire the tile
        }
        return { ...tile, expiryTurns: newExpiryTurns };
      }
      return tile;
    })
  );
}

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: { gridSize: 4, minWords: 8, scoreMultiplier: 0.7 },
  medium: { gridSize: 4, minWords: 12, scoreMultiplier: 1.0 },
  hard: { gridSize: 5, minWords: 18, scoreMultiplier: 1.3 },
  expert: { gridSize: 6, minWords: 25, scoreMultiplier: 1.6 }
};

function onNewGame() {
  setShowDifficultyDialog(true);
}

function startGameWithDifficulty(difficulty: "easy" | "medium" | "hard" | "expert") {
  const config = DIFFICULTY_CONFIG[difficulty];
  const newSize = config.gridSize;
  
  setSettings(prev => ({ ...prev, difficulty, gridSize: newSize, mode: "classic" }));
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
    setFinalGrade("None")
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
  if (await loadDailyState()) {
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
  
  // Reset all state for fresh daily challenge
  setGameOver(false);
  setFinalGrade("None");
  setUsedWords([]);
  setLastWordTiles(new Set());
  setScore(0);
  setStreak(0);
  setMovesUsed(0);
  setUnlocked(new Set());
  setSpecialTiles(createEmptySpecialTilesGrid(newSize));
  
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
      const newBoard = makeBoard(newSize, dailySeed);
      const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES);
      const bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
      setBoard(newBoard);
      setBenchmarks(bms);
      setDiscoverableCount(probe.words.size);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      toast.success(`Daily Challenge ${dailySeed} ready! ${settings.dailyMovesLimit} moves to make your best score.`);
    } finally {
      setIsGenerating(false);
    }
  } else {
    const nb = makeBoard(newSize, dailySeed);
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

async function resetDailyChallenge() {
  // Clear saved daily state from both database and localStorage
  await dailyChallengeState.clearState();
  
  // Start fresh daily challenge
  const difficulty = "medium";
  const config = DIFFICULTY_CONFIG[difficulty];
  const newSize = config.gridSize;
  const dailySeed = getDailySeed();
  
  setSettings(prev => ({ 
    ...prev, 
    difficulty, 
    gridSize: newSize, 
    mode: "daily",
    dailyMovesLimit: getDailyMovesLimit() 
  }));
  setSize(newSize);
  
  // Reset all state for fresh daily challenge
  setGameOver(false);
  setFinalGrade("None");
  setUsedWords([]);
  setLastWordTiles(new Set());
  setScore(0);
  setStreak(0);
  setMovesUsed(0);
  setUnlocked(new Set());
  setSpecialTiles(createEmptySpecialTilesGrid(newSize));
  
  if (dict && sorted) {
    setIsGenerating(true);
    setPath([]);
    setDragging(false);
    
    try {
      const newBoard = makeBoard(newSize, dailySeed);
      const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES);
      const bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
      setBoard(newBoard);
      setBenchmarks(bms);
      setDiscoverableCount(probe.words.size);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      setIsGenerating(false);
      toast.success("Daily Challenge reset to new board!");
    } catch (error) {
      console.error("Error generating daily board:", error);
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
      // Hint executes immediately on tap
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
      // Hammer activates/deactivates on tap, executes on stone tile tap
      if (activatedConsumables.has(consumableId)) {
        // Deactivate if already activated
        setActivatedConsumables(prev => {
          const newSet = new Set(prev);
          newSet.delete(consumableId);
          return newSet;
        });
        toast.info("Hammer deactivated");
      } else {
        // Check if there are stone tiles to break
        let hasStone = false;
        for (let r = 0; r < size && !hasStone; r++) {
          for (let c = 0; c < size && !hasStone; c++) {
            if (specialTiles[r][c].type === "stone") {
              hasStone = true;
            }
          }
        }
        
        if (!hasStone) {
          toast.error("No stone tiles available to break");
          return;
        }
        
        setActivatedConsumables(prev => new Set([...prev, consumableId]));
        toast.info("Hammer activated! Tap a stone tile to break it.");
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

const handleHintRevealer = () => {
  if (!dict || !sorted) return;
  
  // Use existing probeGrid logic to find words
  const probe = probeGrid(board, dict, sorted, 3, MAX_DFS_NODES);
  const availableWords = Array.from(probe.words).filter(word => 
    !usedWords.some(used => used.word === word) && word.length >= 3
  );
  
  if (availableWords.length === 0) {
    toast.info("No more words to reveal!");
    return;
  }
  
  // Find the first valid word and illuminate its first two letters
  const wordToReveal = availableWords[0];
  const tilesToHighlight = new Set<string>();
  
  // Find path for the word and highlight first two tiles
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c].toLowerCase() === wordToReveal[0].toLowerCase()) {
        // Found starting letter, now find the path for this word
        const path = findWordPath(wordToReveal, { r, c });
        if (path && path.length >= 2) {
          tilesToHighlight.add(keyOf(path[0]));
          tilesToHighlight.add(keyOf(path[1]));
          break;
        }
      }
    }
    if (tilesToHighlight.size >= 2) break;
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
  
  toast.success(`Hint: First two letters of "${wordToReveal.toUpperCase()}" revealed!`);
};

// Helper function to find the path for a specific word
const findWordPath = (word: string, startPos: Pos): Pos[] | null => {
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
        const newPos = { r: pos.r + dr, c: pos.c + dc };
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
    duration: 0, // Until next word
    data: { multiplier: 2.0 }
  });
  
  toast.success("Next word will have 2x score!");
};

const handleHammer = (targetPos?: Pos) => {
  if (path.length > 0) {
    toast.error("Cannot use hammer while a word is in progress");
    return;
  }
  
  if (!targetPos) {
    // This shouldn't happen with the new system, but handle gracefully
    return;
  }
  
  // Check if the target position has a stone tile
  const tile = specialTiles[targetPos.r][targetPos.c];
  if (tile.type !== "stone") {
    toast.error("Can only use hammer on stone tiles");
    return;
  }
  
  // Break the specific stone tile
  const newSpecialTiles = specialTiles.map(row => [...row]);
  newSpecialTiles[targetPos.r][targetPos.c] = { type: null };
  
  setSpecialTiles(newSpecialTiles);
  
  // Deactivate hammer after use
  setActivatedConsumables(prev => {
    const newSet = new Set(prev);
    newSet.delete("hammer");
    return newSet;
  });
  
  toast.success("Stone tile broken!");
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

  function tryAddToPath(pos: Pos) {
    if (path.length && !neighbors(path[path.length - 1], pos)) return;
    const k = keyOf(pos);
    if (path.find((p) => p.r === pos.r && p.c === pos.c)) return;
    
    // Check if this is a stone tile and it's blocked
    const specialTile = specialTiles[pos.r][pos.c];
    if (specialTile.type === "stone") {
      toast.warning("Stone tile is blocked!");
      return;
    }
    
    setPath((p) => [...p, pos]);
  }

  function onTilePointerDown(pos: Pos) {
    setDragging(true);
    setPath([pos]);
  }
  function onTilePointerEnter(pos: Pos) {
    if (!dragging) return;
    // allow simple backtrack by moving onto previous-previous tile
    if (path.length >= 2) {
      const prev = path[path.length - 1];
      const prev2 = path[path.length - 2];
      if (pos.r === prev2.r && pos.c === prev2.c) {
        setPath((p) => p.slice(0, -1));
        return;
      }
    }
    tryAddToPath(pos);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    submitWord();
  }

  // Touch event handlers for mobile support
  function onTouchStart(e: React.TouchEvent, pos: Pos) {
    e.preventDefault(); // Prevent page scrolling
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    onTilePointerDown(pos);
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault(); // Prevent page scrolling
    if (!dragging || !touchStartPos) return;
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.closest('[data-tile-pos]')) {
      const tileElement = element.closest('[data-tile-pos]') as HTMLElement;
      const posStr = tileElement.getAttribute('data-tile-pos');
      if (posStr) {
        const [r, c] = posStr.split(',').map(Number);
        onTilePointerEnter({ r, c });
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault(); // Prevent page scrolling
    setTouchStartPos(null);
    onPointerUp();
  }

  // Single tap handler for mobile
  function onTileTap(pos: Pos) {
    // Check if hammer is activated and this is a stone tile - handle before path logic
    if (activatedConsumables.has("hammer") && specialTiles[pos.r][pos.c].type === "stone") {
      handleHammer(pos);
      return;
    }

    if (path.length === 0) {
      // Start new path with tap
      setDragging(true);
      setPath([pos]);
    } else if (path.length === 1 && path[0].r === pos.r && path[0].c === pos.c) {
      // Double tap on same tile to submit single letter (if valid)
      submitWord();
    } else {
      // Try to add to path or submit if tapping the same tile again
      const isLastTile = path.length > 0 && path[path.length - 1].r === pos.r && path[path.length - 1].c === pos.c;
      if (isLastTile) {
        submitWord();
      } else {
        tryAddToPath(pos);
      }
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
    let actualWord = wordFromPath;
    let wildUsed = false;

    const hasWildTile = path.some(p => specialTiles[p.r][p.c].type === "wild");
    if (hasWildTile && dict) {
      const wildcardPositions = path.filter(p => specialTiles[p.r][p.c].type === "wild");
      if (wildcardPositions.length === 1) {
        // Show dialog to let user choose the letter
        setPendingWildPath(path);
        setShowWildDialog(true);
        return clearPath();
      }
    }

    if (!dict) {
      toast("Loading dictionary...");
      return clearPath();
    }
    if (actualWord.length < 3) {
      toast.warning("Words must be at least 3 letters");
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
      const overlap = path.some((p) => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return clearPath();
      }
    }

    setUsedWords(prev => [...prev, {word: actualWord, score: totalGain}]);
    
    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }

    // RECALIBRATED: Hybrid scoring formula
    let base = (actualWord.length * 8) + (actualWord.length * actualWord.length * 2);

    const multiplierTiles = path.filter(p => specialTiles[p.r][p.c].type === "multiplier");
    let multiplier = 1;
    multiplierTiles.forEach(p => {
      const tile = specialTiles[p.r][p.c];
      if (tile.value) multiplier *= tile.value;
    });

    const sharedTilesCount = lastWordTiles.size ? path.filter((p) => lastWordTiles.has(keyOf(p))).length : 0;
    const linkBonus = 2 * sharedTilesCount;

    const raritySum = path.reduce((acc, p) => acc + letterRarity(board[p.r][p.c]), 0);
    const ultraRareCount = path.reduce((acc, p) => acc + (VERY_RARE.has(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
    const rarityBonus = (RARITY_MULTIPLIER * raritySum) + (ultraRareCount * ULTRA_RARE_MULTIPLIER * 10);

    const qualifies = actualWord.length >= STREAK_TARGET_LEN;
    const nextStreak = qualifies ? streak + 1 : 0;
    // RECALIBRATED: Linear streak bonus with cap to prevent runaway scoring
    const chainBonus = nextStreak > 0 ? Math.min(100, 5 + (nextStreak * 8)) : 0;

    const timeBonus = 0;

    // Apply consumable score multiplier if active
    const scoreMultiplierEffect = activeEffects.find(e => e.id === "score_multiplier");
    const consumableMultiplier = scoreMultiplierEffect?.data?.multiplier || 1;
    
    const totalGain = Math.round((base + rarityBonus + chainBonus + linkBonus + timeBonus) * multiplier * consumableMultiplier);
    
    // Remove score multiplier effect after use
    if (scoreMultiplierEffect) {
      removeActiveEffect("score_multiplier");
      // Also remove from activated consumables
      setActivatedConsumables(prev => {
        const newSet = new Set(prev);
        newSet.delete("score_multiplier");
        return newSet;
      });
    }

    const xFactorTiles = path.filter(p => specialTiles[p.r][p.c].type === "xfactor");
    let xChanged = 0;
    if (xFactorTiles.length > 0) {
      const newBoard = board.map(row => [...row]);
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

    // Handle shuffle tiles
    const shuffleTiles = path.filter(p => specialTiles[p.r][p.c].type === "shuffle");
    if (shuffleTiles.length > 0) {
      // Create a copy of the current board (use updated board if X-factor was triggered)
      const currentBoard = board.map(row => [...row]);
      
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

    let newSpecialTiles = specialTiles.map(row => [...row]);
    path.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = { type: null };
      }
    });
    newSpecialTiles = expireSpecialTiles(newSpecialTiles);
    setSpecialTiles(newSpecialTiles);

    setLastWordTiles(new Set(path.map(keyOf)));
    
    // Check for new achievements
    const newAchievements: AchievementId[] = [];
    const checkAndAdd = (condition: boolean, achievement: AchievementId) => {
      if (condition && !unlocked.has(achievement)) {
        newAchievements.push(achievement);
      }
    };

    if (nextStreak >= 3) checkAndAdd(true, "streak3");
    if (nextStreak >= 5) checkAndAdd(true, "streak5");
    if (nextStreak >= 8) checkAndAdd(true, "streak8");
    if (sharedTilesCount >= 2) checkAndAdd(true, "link2");
    if (sharedTilesCount >= 3) checkAndAdd(true, "link3");
    if (sharedTilesCount >= 4) checkAndAdd(true, "link4");
    if (actualWord.length >= 7) checkAndAdd(true, "long7");
    if (actualWord.length >= 8) checkAndAdd(true, "epic8");
    const ultraCount = path.reduce((acc, p) => acc + (["J","Q","X","Z"].includes(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
    if (ultraCount >= 2) checkAndAdd(true, "rare2");
    if (multiplier >= 3) checkAndAdd(true, "combo3x");
    if (xChanged >= 3) checkAndAdd(true, "chaos3");
    const ratio = vowelRatioOfWord(actualWord);
    if (actualWord.length >= 6 && ratio >= 0.6) checkAndAdd(true, "vowelStorm");
    if (actualWord.length >= 6 && ratio <= 0.2) checkAndAdd(true, "consonantCrunch");
    if (wildUsed) checkAndAdd(true, "wildWizard");
    const nextUsedCount = usedWords.length + 1;
    if (nextUsedCount >= 10) checkAndAdd(true, "cartographer10");
    if (nextUsedCount >= 15) checkAndAdd(true, "collector15");
    if (discoverableCount > 0) {
      const pct = (nextUsedCount / discoverableCount) * 100;
      if (pct >= 80) checkAndAdd(true, "completionist80");
      if (nextUsedCount >= discoverableCount) checkAndAdd(true, "completionist100");
    }

    // Calculate achievement bonus
    const achievementBonus = newAchievements.reduce((total, id) => total + ACHIEVEMENTS[id].scoreBonus, 0);
    const finalScore = score + totalGain + achievementBonus;
    
    setScore(finalScore);
    setStreak(nextStreak);

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
        duration: 4000,
      });
    });

    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = (settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1)) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);
        
        // Check for firstWin achievement
        if ((grade === "Gold" || grade === "Platinum") && !unlocked.has("firstWin")) {
          const achievement = ACHIEVEMENTS.firstWin;
          setScore(prev => prev + achievement.scoreBonus);
          setUnlocked(prev => {
            const next = new Set(prev);
            next.add("firstWin");
            return next;
          });
          toast.success(`💎 ${achievement.label} (+${achievement.scoreBonus} pts)`, {
            duration: 4000,
          });
        }
        
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
            emptyPositions.push({ r, c });
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

    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = settings.mode === "daily" && (movesUsed + 1) >= settings.dailyMovesLimit;
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, new Set(usedWords.map(entry => entry.word)));
        
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            if (s >= benchmarks.platinum) grade = "Platinum";
            else if (s >= benchmarks.gold) grade = "Gold";
            else if (s >= benchmarks.silver) grade = "Silver";
            else if (s >= benchmarks.bronze) grade = "Bronze";
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
              
              if ((grade === "Gold" || grade === "Platinum") && !prev.has("firstWin")) {
                next.add("firstWin");
                bonusScore += ACHIEVEMENTS.firstWin.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.firstWin.label} (+${ACHIEVEMENTS.firstWin.scoreBonus} pts)`, {
                  duration: 4000,
                });
              }
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000,
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

  function hasAnyValidMove(
    grid: string[][],
    mustReuse: Set<string>,
    wordSet: Set<string>,
    sortedArr: string[],
    used: Set<string>
  ) {
    const N = grid.length;
    const dirs = [-1, 0, 1];
    const visited = new Set<string>();
    const stack: { pos: Pos; path: Pos[]; word: string; reuse: boolean }[] = [];

    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) stack.push({ pos: { r, c }, path: [], word: "", reuse: false });

    while (stack.length) {
      const cur = stack.pop()!;
      const { pos, path: pp, word, reuse } = cur;
      const k = keyOf(pos);
      if (pp.find((p) => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      const nextReuse = reuse || mustReuse.has(k) || mustReuse.size === 0;

      if (nextWord.length >= 3 && nextReuse && wordSet.has(nextWord) && !used.has(nextWord)) return true;
      if (!binaryHasPrefix(sortedArr, nextWord)) continue;

      for (const dr of dirs) for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.r + dr, nc = pos.c + dc;
        if (!within(nr, nc, N)) continue;
        // adjacency and no revisit
        if (nextPath.find((p) => p.r === nr && p.c === nc)) continue;
        stack.push({ pos: { r: nr, c: nc }, path: nextPath, word: nextWord, reuse: nextReuse });
      }
    }
    return false;
  }

  const isGameReady = !!dict;

  const shareScoreInline = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const grade = finalGrade !== "None" ? finalGrade : score >= (benchmarks?.platinum || 0) ? "Platinum"
      : score >= (benchmarks?.gold || 0) ? "Gold"
      : score >= (benchmarks?.silver || 0) ? "Silver"
      : score >= (benchmarks?.bronze || 0) ? "Bronze"
      : "None";
    
    // Get emoji based on grade
    const gradeEmoji = grade === "Platinum" ? "💎" 
      : grade === "Gold" ? "🥇"
      : grade === "Silver" ? "🥈" 
      : grade === "Bronze" ? "🥉"
      : "📊";
    
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
            {Object.entries(DIFFICULTY_CONFIG).map(([diff, config]) => (
              <Button
                key={diff}
                variant="outline"
                onClick={() => startGameWithDifficulty(diff as any)}
                className="justify-between p-4 h-auto"
              >
                <div className="text-left">
                  <div className="font-semibold capitalize">{diff}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.gridSize}×{config.gridSize} grid • {config.minWords}+ discoverable words • {Math.round(config.scoreMultiplier * 100)}% scoring
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2 mb-4">
        <div className="flex justify-start items-center gap-2">
          {settings.mode === "classic" && (
            <Button variant="hero" onClick={onNewGame} disabled={!isGameReady || isGenerating} size="sm">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>
          )}
          
          {settings.mode === "daily" && (
            <Button 
              variant="outline" 
              onClick={() => {
                resetDailyChallenge().catch(console.error);
              }} 
              disabled={!isGameReady || isGenerating} 
              size="sm"
              className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
            >
              Reset Daily
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => setShowHowToPlay(true)} 
            size="sm"
            className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
          >
            How to Play
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onBackToTitle} 
            size="sm"
            className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
          >
            Back to Title
          </Button>
          
          {settings.mode === "daily" && gameOver && (
            <Button 
              variant="outline" 
              onClick={() => setShowShareDialog(true)} 
              size="sm"
              className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
            >
              Share Score
            </Button>
          )}
        </div>
        
      </div>

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="sm:max-w-lg">
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
                  const letter = isWild ? (wildTileInput.toUpperCase() || "?") : board[p.r][p.c];
                  return (
                    <span key={i} className={isWild ? "text-purple-500 font-bold" : ""}>
                      {letter}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <Input
                type="text"
                value={wildTileInput}
                onChange={(e) => setWildTileInput(e.target.value.slice(0, 1).toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && wildTileInput) {
                    handleWildSubmit();
                  }
                }}
                placeholder="Enter letter (A-Z)"
                className="w-full text-center text-lg font-mono"
                maxLength={1}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowWildDialog(false);
                  setWildTileInput('');
                  setPendingWildPath(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleWildSubmit}
                disabled={!wildTileInput || !/[A-Z]/.test(wildTileInput)}
                className="flex-1"
              >
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
                🔤 Lexichain Daily Challenge {getDailySeed()}<br/>
                {finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊"} {score} points ({finalGrade})<br/>
                📝 Top word: {usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0}<br/>
                🎯 {settings.dailyMovesLimit - movesUsed} moves remaining<br/>
                <br/>
                Play at lexichain.lovable.app
              </div>
            </div>
            <Button 
              onClick={() => {
                const gradeEmoji = finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊";
                const topWordScore = usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0;
                const shareText = `🔤 Lexichain Daily Challenge ${getDailySeed()}\n${gradeEmoji} ${score} points (${finalGrade})\n📝 Top word: ${topWordScore}\n🎯 ${settings.dailyMovesLimit - movesUsed} moves remaining\n\nPlay at lexichain.lovable.app`;
                navigator.clipboard.writeText(shareText);
                toast.success("Copied to clipboard!");
                setShowShareDialog(false);
              }}
              className="w-full"
            >
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-[auto,280px] gap-3 lg:gap-2 items-start">
        <div className="space-y-4">
          {/* Mobile QuickUse Bar */}
          {isMobile && (
            <div className="lg:hidden">
              <QuickUseBar 
                inventory={consumableInventory}
                onUseConsumable={handleUseConsumable}
                gameMode={settings.mode}
                gameState={{ gameOver, isGenerating }}
                disabled={gameOver || isGenerating}
              />
            </div>
          )}
          <div
            onPointerUp={onPointerUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ touchAction: 'none' }} // Prevent page scrolling on touch
          >
            <div 
              className="grid gap-3 select-none max-w-md"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
            {board.map((row, r) => row.map((ch, c) => {
              const k = keyOf({ r, c });
              const idx = path.findIndex((p) => p.r === r && p.c === c);
              const selected = idx !== -1;
              const reused = lastWordTiles.has(k);
              const special = specialTiles[r][c];
              const isAffected = affectedTiles.has(k);
              
              const getTileClasses = () => {
                // Determine current achievement level for border color
                const currentGrade = benchmarks ? (
                  score >= benchmarks.platinum ? "platinum"
                  : score >= benchmarks.gold ? "gold"
                  : score >= benchmarks.silver ? "silver"
                  : score >= benchmarks.bronze ? "bronze"
                  : "none"
                ) : "none";
                
                // Define border colors for each achievement level
                const getBorderColor = () => {
                  switch (currentGrade) {
                    case "platinum": return "border-purple-400";
                    case "gold": return "border-yellow-400"; 
                    case "silver": return "border-gray-400";
                    case "bronze": return "border-amber-600";
                    default: return "border-border";
                  }
                };
                
                // Define background colors for last word tiles based on achievement level
                const getLastWordBackground = () => {
                  switch (currentGrade) {
                    case "platinum": return "bg-purple-100 dark:bg-purple-950/30";
                    case "gold": return "bg-yellow-100 dark:bg-yellow-950/30"; 
                    case "silver": return "bg-gray-100 dark:bg-gray-950/30";
                    case "bronze": return "bg-amber-100 dark:bg-amber-950/30";
                    default: return "bg-secondary/60";
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
                  baseClasses += activatedConsumables.has("hammer") 
                    ? "bg-gradient-to-br from-gray-400 to-gray-600 text-white ring-2 ring-yellow-400 animate-pulse " 
                    : "bg-gradient-to-br from-gray-400 to-gray-600 text-white ";
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
              
              return (
                <Card
                  key={k}
                  data-tile-pos={`${r},${c}`}
                  onPointerDown={() => onTilePointerDown({ r, c })}
                  onPointerEnter={() => onTilePointerEnter({ r, c })}
                  onTouchStart={(e) => onTouchStart(e, { r, c })}
                  onClick={() => onTileTap({ r, c })}
                  className={getTileClasses()}
                  style={{ touchAction: 'none' }} // Prevent page scrolling on individual tiles
                >
                  <div className="text-3xl font-semibold tracking-wide">
                    {special.type === "wild" ? "?" : ch}
                  </div>
                  {selected && (
                    <div className="absolute top-1 right-2 text-xs font-medium text-muted-foreground">{idx + 1}</div>
                  )}
                  {special.type === "xfactor" && (
                    <>
                      <div className="absolute top-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute top-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
                    </>
                  )}
                  {special.type === "multiplier" && special.value && (
                    <div className="absolute bottom-1 text-xs font-bold bg-white/20 px-1 rounded">
                      {special.value}x
                    </div>
                  )}
                  {special.type === "shuffle" && (
                   <div className="absolute top-0.5 right-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" className="opacity-60">
                        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  )}
                  {special.type !== null && special.expiryTurns !== undefined && (
                    <div className="absolute top-1 left-1 text-xs font-bold bg-black/30 text-white px-1 rounded-full min-w-[16px] text-center">
                      {special.expiryTurns}
                    </div>
                  )}
                </Card>
              );
            }))}
           </div>

           <div className="mt-3 flex items-center gap-3">
             <span className="text-sm text-muted-foreground">Current:</span>
             <span className="text-lg font-semibold flex-1">{displayWordFromPath}</span>
           </div>
           
          </div>
        </div>
        
        <aside className="space-y-2 lg:space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Score</div>
                <div className="text-2xl font-bold">{score}</div>
                {benchmarks && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                      const grade = score >= benchmarks.platinum ? "Platinum"
                        : score >= benchmarks.gold ? "Gold"
                        : score >= benchmarks.silver ? "Silver"
                        : score >= benchmarks.bronze ? "Bronze"
                        : "None";
                      const nextTarget = score < benchmarks.bronze ? ["Bronze", benchmarks.bronze]
                        : score < benchmarks.silver ? ["Silver", benchmarks.silver]
                        : score < benchmarks.gold ? ["Gold", benchmarks.gold]
                        : score < benchmarks.platinum ? ["Platinum", benchmarks.platinum]
                        : null;
                      return (
                        <>
                          <span>Grade: {grade}</span>
                          {nextTarget && (
                            <span className="ml-2">• {(nextTarget[1] as number) - score} to {nextTarget[0] as string}</span>
                          )}
                          <span className="ml-2">• Board: {benchmarks.rating}</span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {score >= (benchmarks?.bronze || 100) 
                  ? "Special tiles active!"
                  : ""}
                {gameOver && finalGrade !== "None" && (
                  <div className="mt-1 font-medium">Final: {finalGrade}</div>
                )}
                {settings.mode === "daily" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {settings.dailyMovesLimit - movesUsed} moves remaining
                  </div>
                )}
                {settings.mode === "daily" && gameOver && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={shareScoreInline}
                    className="mt-2 h-6 px-2 text-xs bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
                  >
                    Share
                  </Button>
                )}
          </div>
        </div>
          </Card>
          

          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-2">Settings</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mode</span>
                <select
                  value={settings.mode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      mode: e.target.value as GameMode,
                    }))
                  }
                  className="bg-card border rounded px-2 py-1 text-sm"
                >
                  <option value="classic">Classic</option>
                  <option value="target">Target Score</option>
                </select>
              </div>
              {settings.mode === "target" && benchmarks && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Target</span>
                  <select
                    value={settings.targetTier}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        targetTier: e.target.value as any,
                      }))
                    }
                    className="bg-card border rounded px-2 py-1 text-sm"
                  >
                    <option value="bronze">Bronze ({benchmarks.bronze})</option>
                    <option value="silver">Silver ({benchmarks.silver})</option>
                    <option value="gold">Gold ({benchmarks.gold})</option>
                    <option value="platinum">Platinum ({benchmarks.platinum})</option>
                  </select>
                </div>
              )}
            </div>
          </Card>
 
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">Used words ({usedWords.length})</div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSortAlphabetically(!sortAlphabetically)}
                className="h-5 px-2 text-xs"
              >
                {sortAlphabetically ? "A-Z" : "Latest"}
              </Button>
            </div>
            <div 
              className={`transition-all duration-300 ease-out overflow-hidden ${
                sortAlphabetically ? 'max-h-64' : 'max-h-24'
              }`}
            >
              {(() => {
                if (!usedWords.length) {
                  return <span className="text-muted-foreground text-xs">None yet</span>;
                }
                
                if (sortAlphabetically) {
                  const sortedWords = [...usedWords].sort((a, b) => a.word.localeCompare(b.word));
                  return (
                    <div className="flex flex-wrap gap-1">
                      {sortedWords.map((entry, index) => (
                        <span key={`${entry.word}-${index}`} className="px-1.5 py-0.5 rounded text-xs bg-secondary">
                          {entry.word.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  );
                } else {
                  // Latest sort - 2-column format
                  const latestWords = usedWords.slice(-15).reverse();
                  return (
                    <div className="space-y-1">
                      {latestWords.map((entry, index) => (
                        <div key={`${entry.word}-${index}`} className="flex justify-between items-center text-xs">
                          <span className="font-medium">{entry.word.toUpperCase()}</span>
                          <span className="text-muted-foreground">+{entry.score}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
              })()}
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-2">Achievements</div>
            <div className="flex flex-wrap gap-1">
              {Array.from(unlocked).length ? (
                Array.from(unlocked).map((id: AchievementId) => (
                  <span key={id} className="px-1.5 py-0.5 rounded text-xs bg-secondary">
                    {ACHIEVEMENTS[id].label}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">None yet</span>
              )}
            </div>
          </Card>

          {/* Consumables Inventory */}
          <ConsumableInventoryPanel 
            inventory={consumableInventory}
            onUseConsumable={handleUseConsumable}
            gameMode={settings.mode}
            disabled={gameOver || isGenerating}
            activatedConsumables={activatedConsumables}
            user={user}
          />

        </aside>
      </div>
      
      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </section>
  );
}
