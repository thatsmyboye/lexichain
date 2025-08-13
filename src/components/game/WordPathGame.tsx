import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Pos = { r: number; c: number };
const keyOf = (p: Pos) => `${p.r},${p.c}`;
const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) <= 1;

// Special tile types
type SpecialTileType = "stone" | "wild" | "xfactor" | "multiplier" | null;
type SpecialTile = {
  type: SpecialTileType;
  value?: number; // for multiplier tiles (2, 3, 4)
};

type GameSettings = {
  enableSpecialTiles: boolean;
  scoreThreshold: number;
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

function makeBoard(size: number) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => randomLetter()));
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
  const size = 4;
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
  const [streak, setStreak] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    enableSpecialTiles: true,
    scoreThreshold: SPECIAL_TILE_SCORE_THRESHOLD
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      if (!mounted) return;
      setBoard(newBoard);
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
      if (type === "multiplier") {
        const multiplierValues = [2, 3, 4];
        const value = multiplierValues[Math.floor(Math.random() * multiplierValues.length)];
        return { type: type as SpecialTileType, value };
      }
      return { type: type as SpecialTileType };
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

function onNewGame() {
  if (dict && sorted) {
    setIsGenerating(true);
    setPath([]);
    setDragging(false);
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setSpecialTiles(createEmptySpecialTilesGrid(size));
    try {
      const newBoard = generateSolvableBoard(size, dict, sorted);
      setBoard(newBoard);
      toast.success("New board ready!");
    } finally {
      setIsGenerating(false);
    }
  } else {
    setBoard(makeBoard(size));
    setPath([]);
    setDragging(false);
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setSpecialTiles(createEmptySpecialTilesGrid(size));
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

  function submitWord() {
    let actualWord = wordFromPath;
    
    // Handle wild tiles
    const hasWildTile = path.some(p => specialTiles[p.r][p.c].type === "wild");
    if (hasWildTile && dict) {
      // Try to find a valid word by substituting wild tiles
      const wildcardPositions = path.filter(p => specialTiles[p.r][p.c].type === "wild");
      if (wildcardPositions.length === 1) {
        const wildPos = wildcardPositions[0];
        const wildIndex = path.findIndex(p => p.r === wildPos.r && p.c === wildPos.c);
        for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          const testWord = actualWord.split('').map((char, i) => 
            i === wildIndex ? letter.toLowerCase() : char
          ).join('');
          if (dict.has(testWord) && !usedWords.includes(testWord)) {
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
    if (lastWordTiles.size > 0) {
      const overlap = path.some((p) => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return clearPath();
      }
    }
    
    setUsedWords(prev => [...prev, actualWord]);

    // Scoring components
    let base = actualWord.length * actualWord.length;

    // Check for multiplier tiles
    const multiplierTiles = path.filter(p => specialTiles[p.r][p.c].type === "multiplier");
    let multiplier = 1;
    multiplierTiles.forEach(p => {
      const tile = specialTiles[p.r][p.c];
      if (tile.value) multiplier *= tile.value;
    });

    // Link depth: overlap with previous word
    const sharedTilesCount = lastWordTiles.size ? path.filter((p) => lastWordTiles.has(keyOf(p))).length : 0;
    const linkBonus = 2 * sharedTilesCount;

    // Rarity bonus: sum tile rarity along the path
    const raritySum = path.reduce((acc, p) => acc + letterRarity(board[p.r][p.c]), 0);
    const rarityBonus = RARITY_MULTIPLIER * raritySum;

    // Chain bonus: streak of consecutive qualifying words (length >= STREAK_TARGET_LEN)
    const qualifies = actualWord.length >= STREAK_TARGET_LEN;
    const nextStreak = qualifies ? streak + 1 : 0;
    const chainBonus = 5 * nextStreak;

    // Time bonus (Blitz mode) - placeholder for future mode
    const timeBonus = 0;

    const totalGain = Math.round((base + rarityBonus + chainBonus + linkBonus + timeBonus) * multiplier);

    // Handle X-Factor tiles
    const xFactorTiles = path.filter(p => specialTiles[p.r][p.c].type === "xfactor");
    if (xFactorTiles.length > 0) {
      const newBoard = board.map(row => [...row]);
      const newSpecialTiles = specialTiles.map(row => [...row]);
      
      xFactorTiles.forEach(xfPos => {
        // Get diagonal neighbors
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
          }
        });
      });
      
      setBoard(newBoard);
      setSpecialTiles(newSpecialTiles);
      toast.info("X-Factor activated! Adjacent tiles transformed!");
    }

    // Clear used special tiles
    const newSpecialTiles = specialTiles.map(row => [...row]);
    path.forEach(p => {
      if (specialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = { type: null };
      }
    });
    setSpecialTiles(newSpecialTiles);

    setLastWordTiles(new Set(path.map(keyOf)));
    const newScore = score + totalGain;
    setScore(newScore);
    setStreak(nextStreak);
    
    // Introduce special tiles if threshold reached
    if (settings.enableSpecialTiles && shouldIntroduceSpecialTiles(newScore, settings.scoreThreshold)) {
      setTimeout(() => {
        if (Math.random() < 0.3) { // 30% chance to add a special tile
          const emptyPositions = [];
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (specialTiles[r][c].type === null) {
                emptyPositions.push({ r, c });
              }
            }
          }
          
          if (emptyPositions.length > 0) {
            const randomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
            const newSpecialTile = generateSpecialTile();
            
            if (newSpecialTile.type !== null) {
              const updatedSpecialTiles = specialTiles.map(row => [...row]);
              updatedSpecialTiles[randomPos.r][randomPos.c] = newSpecialTile;
              setSpecialTiles(updatedSpecialTiles);
              toast.info(`Special tile appeared: ${newSpecialTile.type}!`);
            }
          }
        }
      }, 1000);
    }

    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);
    clearPath();
    
    // Check if any valid move remains (async so UI stays snappy)
    setTimeout(() => {
      if (sorted && dict) {
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, new Set(usedWords));
        if (!any) toast.info("No valid words remain. Game over!");
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

  return (
    <section className="container mx-auto py-8">
      <div
        className="rounded-xl p-6 mb-8 bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] text-[hsl(var(--hero-foreground))] shadow-[var(--shadow-soft)]"
        ref={containerRef}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm/6 opacity-90">Chain words by drawing paths through adjacent letters.</p>
            <p className="text-sm/6 opacity-90">Each new word must reuse at least one tile from the previous word.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="hero" onClick={onNewGame} disabled={!isGameReady || isGenerating}>{isGenerating ? "Generating..." : "New Game"}</Button>
            <Button variant="secondary" onClick={clearPath} disabled={!path.length}>Clear Path</Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr,300px] gap-8 items-start">
        <div onPointerUp={onPointerUp}>
          <div className="grid grid-cols-4 gap-6 select-none">
            {board.map((row, r) => row.map((ch, c) => {
              const k = keyOf({ r, c });
              const idx = path.findIndex((p) => p.r === r && p.c === c);
              const selected = idx !== -1;
              const reused = lastWordTiles.has(k);
              const special = specialTiles[r][c];
              
              const getTileClasses = () => {
                let baseClasses = "relative aspect-square flex items-center justify-center rounded-lg border transition-[transform,box-shadow] ";
                
                if (selected) {
                  baseClasses += "ring-2 ring-green-400 bg-green-50 shadow-[0_4px_12px_-4px_rgba(34,197,94,0.3)] scale-[0.98] dark:bg-green-950 dark:ring-green-500 ";
                } else if (reused) {
                  baseClasses += "bg-secondary/60 ";
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
                  onPointerDown={() => onTilePointerDown({ r, c })}
                  onPointerEnter={() => onTilePointerEnter({ r, c })}
                  className={getTileClasses()}
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
                </Card>
              );
            }))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Current:</div>
            <div className="text-lg font-semibold">{wordFromPath.toUpperCase()}</div>
            <Button onClick={submitWord} disabled={!isGameReady || path.length < 3 || isGenerating}>Submit</Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-3xl font-bold">{score}</div>
            {settings.enableSpecialTiles && (
              <div className="text-xs text-muted-foreground mt-1">
                {score >= settings.scoreThreshold 
                  ? "Special tiles active!" 
                  : `${settings.scoreThreshold - score} points until special tiles`}
              </div>
            )}
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-2">Settings</div>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.enableSpecialTiles}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    enableSpecialTiles: e.target.checked 
                  }))}
                  className="rounded"
                />
                <span>Enable Special Tiles</span>
              </label>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Used words</div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSortAlphabetically(!sortAlphabetically)}
                className="h-6 px-2 text-xs"
              >
                {sortAlphabetically ? "A-Z" : "Latest"}
              </Button>
            </div>
            <div 
              className={`flex flex-wrap gap-2 transition-all duration-300 ease-out overflow-hidden ${
                sortAlphabetically ? 'max-h-96' : 'max-h-32'
              }`}
              style={{
                maxHeight: sortAlphabetically ? 'none' : '8rem'
              }}
            >
              {(() => {
                const displayWords = sortAlphabetically 
                  ? [...usedWords].sort()
                  : usedWords.slice(-20).reverse();
                return displayWords.map((w) => (
                  <span key={w} className="px-2 py-1 rounded-md bg-secondary text-sm">{w.toUpperCase()}</span>
                ));
              })()}
              {!usedWords.length && <span className="text-muted-foreground text-sm">None yet</span>}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-2">How to play</div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Drag through adjacent tiles (8 directions) to form a word.</li>
              <li>Words must be 3+ letters and valid English words.</li>
              <li>Each new word must reuse at least one tile from the previous word.</li>
              <li>Keep chaining until no valid word remains.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </section>
  );
}
