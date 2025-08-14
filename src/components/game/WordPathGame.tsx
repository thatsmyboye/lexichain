import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, type Benchmarks } from "@/lib/benchmarks";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";

type Pos = { r: number; c: number };
const keyOf = (p: Pos) => `${p.r},${p.c}`;
const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) <= 1;

// Special tile types
type SpecialTileType = "stone" | "wild" | "xfactor" | "multiplier" | null;
type SpecialTile = {
  type: SpecialTileType;
  value?: number;
  expiryTurns?: number;
};

type GameMode = "classic" | "target" | "daily";

type GameSettings = {
  enableSpecialTiles: boolean;
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

function makeBoard(size: number, seed?: string) {
  if (seed) {
    // Use seeded random for daily challenge
    const rng = seedRandom(seed);
    return Array.from({ length: size }, () => Array.from({ length: size }, () => seededRandomLetter(rng)));
  }
  return Array.from({ length: size }, () => Array.from({ length: size }, () => randomLetter()));
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
  const seed = getDailySeed();
  // Simple hash function to get consistent random number from date string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Use hash to choose between 10 or 15
  return Math.abs(hash) % 2 === 0 ? 10 : 15;
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

// Scoring constants
const RARITY_MULTIPLIER = 1.5; // tunes impact of rare letters
const STREAK_TARGET_LEN = 5; // words >= this length count towards streak

// Special tiles constants
const SPECIAL_TILE_SCORE_THRESHOLD = 150;
const SPECIAL_TILE_RARITIES = {
  stone: 0.15,
  wild: 0.05,
  xfactor: 0.08,
  multiplier: 0.12
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

export default function WordPathGame() {
  const [size, setSize] = useState(4);
  const [board, setBoard] = useState<string[][]>(() => makeBoard(size));
  const [specialTiles, setSpecialTiles] = useState<SpecialTile[][]>(() => 
    Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null })))
  );
  const [path, setPath] = useState<Pos[]>([]);
  const [dragging, setDragging] = useState(false);
  const [usedWords, setUsedWords] = useState<string[]>([]);
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
    enableSpecialTiles: true,
    scoreThreshold: SPECIAL_TILE_SCORE_THRESHOLD,
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

function shouldIntroduceSpecialTiles(currentScore: number, threshold: number): boolean {
  return currentScore >= threshold;
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

function startDailyChallenge() {
  const difficulty = "medium"; // Daily challenges use medium difficulty
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
      toast.success(`Daily Challenge ${dailySeed} ready! 20 moves to make your best score.`);
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
        const wildPos = wildcardPositions[0];
        const wildIndex = path.findIndex(p => p.r === wildPos.r && p.c === wildPos.c);
        for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          const testWord = actualWord.split('').map((char, i) =>
            i === wildIndex ? letter.toLowerCase() : char
          ).join('');
          if (dict.has(testWord) && !usedWords.includes(testWord)) {
            if (testWord !== actualWord) wildUsed = true;
            actualWord = testWord;
            break;
          }
        }
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
    if (usedWords.includes(actualWord)) {
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

    setUsedWords(prev => [...prev, actualWord]);
    
    // Increment moves for daily challenge
    if (settings.mode === "daily") {
      setMovesUsed(prev => prev + 1);
    }

    let base = actualWord.length * actualWord.length;

    const multiplierTiles = path.filter(p => specialTiles[p.r][p.c].type === "multiplier");
    let multiplier = 1;
    multiplierTiles.forEach(p => {
      const tile = specialTiles[p.r][p.c];
      if (tile.value) multiplier *= tile.value;
    });

    const sharedTilesCount = lastWordTiles.size ? path.filter((p) => lastWordTiles.has(keyOf(p))).length : 0;
    const linkBonus = 2 * sharedTilesCount;

    const raritySum = path.reduce((acc, p) => acc + letterRarity(board[p.r][p.c]), 0);
    const rarityBonus = RARITY_MULTIPLIER * raritySum;

    const qualifies = actualWord.length >= STREAK_TARGET_LEN;
    const nextStreak = qualifies ? streak + 1 : 0;
    const chainBonus = 5 * nextStreak;

    const timeBonus = 0;

    const totalGain = Math.round((base + rarityBonus + chainBonus + linkBonus + timeBonus) * multiplier);

    const xFactorTiles = path.filter(p => specialTiles[p.r][p.c].type === "xfactor");
    let xChanged = 0;
    if (xFactorTiles.length > 0) {
      const newBoard = board.map(row => [...row]);
      const newSpecialTiles = specialTiles.map(row => [...row]);
      const changedTileKeys = new Set<string>();

      xFactorTiles.forEach(xfPos => {
        const diagonals = [
          { r: xfPos.r - 1, c: xfPos.c - 1 },
          { r: xfPos.r - 1, c: xfPos.c + 1 },
          { r: xfPos.r + 1, c: xfPos.c - 1 },
          { r: xfPos.r + 1, c: xfPos.c + 1 }
        ];

        diagonals.forEach(pos => {
          if (within(pos.r, pos.c, size)) {
            newBoard[pos.r][pos.c] = randomLetter();
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

    let newSpecialTiles = specialTiles.map(row => [...row]);
    path.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = { type: null };
      }
    });
    newSpecialTiles = expireSpecialTiles(newSpecialTiles);
    setSpecialTiles(newSpecialTiles);

    setLastWordTiles(new Set(path.map(keyOf)));
    const newScore = score + totalGain;
    setScore(newScore);
    setStreak(nextStreak);

    setUnlocked(prev => {
      const next = new Set(prev);
      if (nextStreak >= 3) next.add("streak3");
      if (nextStreak >= 5) next.add("streak5");
      if (nextStreak >= 8) next.add("streak8");
      if (sharedTilesCount >= 2) next.add("link2");
      if (sharedTilesCount >= 3) next.add("link3");
      if (sharedTilesCount >= 4) next.add("link4");
      if (actualWord.length >= 7) next.add("long7");
      if (actualWord.length >= 8) next.add("epic8");
      const ultraCount = path.reduce((acc, p) => acc + (["J","Q","X","Z"].includes(board[p.r][p.c].toUpperCase()) ? 1 : 0), 0);
      if (ultraCount >= 2) next.add("rare2");
      if (multiplier >= 3) next.add("combo3x");
      if (xChanged >= 3) next.add("chaos3");
      const ratio = vowelRatioOfWord(actualWord);
      if (actualWord.length >= 6 && ratio >= 0.6) next.add("vowelStorm");
      if (actualWord.length >= 6 && ratio <= 0.2) next.add("consonantCrunch");
      if (wildUsed) next.add("wildWizard");
      const nextUsedCount = usedWords.length + 1;
      if (nextUsedCount >= 10) next.add("cartographer10");
      if (nextUsedCount >= 15) next.add("collector15");
      if (discoverableCount > 0) {
        const pct = (nextUsedCount / discoverableCount) * 100;
        if (pct >= 80) next.add("completionist80");
        if (nextUsedCount >= discoverableCount) next.add("completionist100");
      }
      return next;
    });

    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (newScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = (settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1)) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);
        setUnlocked(prev => {
          const next = new Set(prev);
          if (grade === "Gold" || grade === "Platinum") next.add("firstWin");
          return next;
        });
        toast.success(`Target reached: ${grade}`);
      }
    }

    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);
    
    // Introduce special tiles if conditions are met
    if (settings.enableSpecialTiles && shouldIntroduceSpecialTiles(newScore, settings.scoreThreshold)) {
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
        toast.info(`Special tiles appeared! (${tilesToPlace} new)`);
      }
    }
    
    clearPath();

    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = settings.mode === "daily" && (movesUsed + 1) >= settings.dailyMovesLimit;
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, new Set(usedWords));
        
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = newScore;
            if (s >= benchmarks.platinum) grade = "Platinum";
            else if (s >= benchmarks.gold) grade = "Gold";
            else if (s >= benchmarks.silver) grade = "Silver";
            else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);
            
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${newScore} (${grade})`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade}`);
            } else {
              toast.info("No valid words remain. Game over!");
            }
            
            setUnlocked(prev => {
              const next = new Set(prev);
              if (grade === "Gold" || grade === "Platinum") next.add("firstWin");
              if (!dailyMovesExceeded) next.add("clutch");
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
    const shareText = `🔤 Lexichain Daily ${date}\n📊 ${score} points (${grade})\n📝 ${usedWords.length} words\n\nlexichain.lovable.app`;
    
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
                    {config.gridSize}×{config.gridSize} grid • {config.minWords}+ words • {Math.round(config.scoreMultiplier * 100)}% scoring
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
          
          <Button 
            variant="outline" 
            onClick={() => setShowHowToPlay(true)} 
            size="sm"
            className="bg-background text-[hsl(var(--brand-500))] border-[hsl(var(--brand-500))] hover:bg-[hsl(var(--brand-50))] hover:text-[hsl(var(--brand-600))] dark:hover:bg-[hsl(var(--brand-950))]"
          >
            How to Play
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
        
        <div className="flex justify-start items-center gap-1">
          <Button 
            variant={settings.mode === "classic" ? "hero" : "outline"} 
            onClick={() => setSettings(prev => ({ ...prev, mode: "classic" }))} 
            size="sm"
          >
            Classic
          </Button>
          <Button 
            variant={settings.mode === "daily" ? "hero" : "outline"} 
            onClick={() => startDailyChallenge()} 
            size="sm"
          >
            Daily Challenge
          </Button>
        </div>
      </div>

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How to play</DialogTitle>
          </DialogHeader>
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
                📊 {score} points ({finalGrade})<br/>
                📝 {usedWords.length} words in {movesUsed} moves<br/>
                🎯 {settings.dailyMovesLimit - movesUsed} moves remaining<br/>
                <br/>
                Play at lexichain.lovable.app
              </div>
            </div>
            <Button 
              onClick={() => {
                const shareText = `🔤 Lexichain Daily Challenge ${getDailySeed()}\n📊 ${score} points (${finalGrade})\n📝 ${usedWords.length} words in ${movesUsed} moves\n🎯 ${settings.dailyMovesLimit - movesUsed} moves remaining\n\nPlay at lexichain.lovable.app`;
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

      <div className="grid lg:grid-cols-[auto,280px] gap-6 items-start">
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
                  baseClasses += "bg-gradient-to-br from-gray-400 to-gray-600 text-white ";
                } else if (special.type === "wild") {
                  baseClasses += "bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 text-white ";
                } else if (special.type === "xfactor") {
                  baseClasses += "bg-gradient-to-br from-orange-400 to-red-500 text-white ";
                } else if (special.type === "multiplier") {
                  baseClasses += "bg-gradient-to-br from-blue-400 to-blue-600 text-white ";
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
            <span className="text-lg font-semibold flex-1">{wordFromPath.toUpperCase()}</span>
          </div>
        </div>

        <aside className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Score</div>
                <div className="text-2xl font-bold">{score}</div>
                {settings.mode === "daily" && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Moves: {movesUsed}/{settings.dailyMovesLimit}
                  </div>
                )}
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
                {settings.enableSpecialTiles ? (
                  score >= settings.scoreThreshold 
                    ? "Special tiles active!"
                    : `${settings.scoreThreshold - score} until specials`
                ) : "Special tiles off"}
                {gameOver && finalGrade !== "None" && (
                  <div className="mt-1 font-medium">Final: {finalGrade}</div>
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
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.enableSpecialTiles}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableSpecialTiles: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <span>Enable Special Tiles</span>
              </label>
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
              <div className="text-xs text-muted-foreground">Used words</div>
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
              className={`flex flex-wrap gap-1 transition-all duration-300 ease-out overflow-hidden ${
                sortAlphabetically ? 'max-h-64' : 'max-h-24'
              }`}
            >
              {(() => {
                const displayWords = sortAlphabetically 
                  ? [...usedWords].sort()
                  : usedWords.slice(-15).reverse();
                return displayWords.map((w) => (
                  <span key={w} className="px-1.5 py-0.5 rounded text-xs bg-secondary">{w.toUpperCase()}</span>
                ));
              })()}
              {!usedWords.length && <span className="text-muted-foreground text-xs">None yet</span>}
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

        </aside>
      </div>
    </section>
  );
}
