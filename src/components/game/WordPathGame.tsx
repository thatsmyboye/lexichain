import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Pos = { r: number; c: number };
const keyOf = (p: Pos) => `${p.r},${p.c}`;
const within = (r: number, c: number, size: number) => r >= 0 && c >= 0 && r < size && c < size;
const neighbors = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1 || (Math.abs(a.r - b.r) === 1 && Math.abs(a.c - b.c) === 1);

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

export default function WordPathGame() {
  const size = 4;
  const [board, setBoard] = useState<string[][]>(() => makeBoard(size));
  const [path, setPath] = useState<Pos[]>([]);
  const [dragging, setDragging] = useState(false);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [lastWordTiles, setLastWordTiles] = useState<Set<string>>(new Set());
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [score, setScore] = useState(0);
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
        toast.success("Dictionary loaded. Start chaining words!");
      })
      .catch(() => toast.error("Failed to load dictionary. Offline mode."));
    return () => { mounted = false };
  }, []);

  const wordFromPath = useMemo(() => path.map((p) => board[p.r][p.c]).join("").toLowerCase(), [path, board]);

  function clearPath() {
    setPath([]);
    setDragging(false);
  }

  function onNewGame() {
    setBoard(makeBoard(size));
    setPath([]);
    setDragging(false);
    setUsedWords(new Set());
    setLastWordTiles(new Set());
    setScore(0);
  }

  function tryAddToPath(pos: Pos) {
    if (path.length && !neighbors(path[path.length - 1], pos)) return;
    const k = keyOf(pos);
    if (path.find((p) => p.r === pos.r && p.c === pos.c)) return;
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
    const w = wordFromPath;
    if (!dict) {
      toast("Loading dictionary...");
      return clearPath();
    }
    if (w.length < 3) {
      toast.warning("Words must be at least 3 letters");
      return clearPath();
    }
    if (!dict.has(w)) {
      toast.error(`Not a valid word: ${w.toUpperCase()}`);
      return clearPath();
    }
    if (usedWords.has(w)) {
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
    const nextUsed = new Set(usedWords);
    nextUsed.add(w);
    setUsedWords(nextUsed);
    setLastWordTiles(new Set(path.map(keyOf)));
    setScore((s) => s + Math.max(1, w.length - 2));
    toast.success(`✓ ${w.toUpperCase()}`);
    clearPath();
    // Check if any valid move remains (async so UI stays snappy)
    setTimeout(() => {
      if (sorted && dict) {
        const any = hasAnyValidMove(board, lastWordTiles.size ? lastWordTiles : new Set(path.map(keyOf)), dict, sorted, usedWords);
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
            <Button variant="hero" onClick={onNewGame}>New Game</Button>
            <Button variant="secondary" onClick={clearPath} disabled={!path.length}>Clear Path</Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr,300px] gap-8 items-start">
        <div onPointerUp={onPointerUp}>
          <div className="grid grid-cols-4 gap-3 select-none">
            {board.map((row, r) => row.map((ch, c) => {
              const k = keyOf({ r, c });
              const idx = path.findIndex((p) => p.r === r && p.c === c);
              const selected = idx !== -1;
              const reused = lastWordTiles.has(k);
              return (
                <Card
                  key={k}
                  onPointerDown={() => onTilePointerDown({ r, c })}
                  onPointerEnter={() => onTilePointerEnter({ r, c })}
                  className={
                    "relative aspect-square flex items-center justify-center rounded-lg border transition-[transform,box-shadow] " +
                    (selected
                      ? "ring-2 ring-[hsl(var(--brand-500))] bg-accent/40 shadow-[var(--shadow-soft)] scale-[0.98]"
                      : reused
                        ? "bg-secondary/60"
                        : "bg-card")
                  }
                >
                  <div className="text-3xl font-semibold tracking-wide">
                    {ch}
                  </div>
                  {selected && (
                    <div className="absolute top-1 right-2 text-xs font-medium text-muted-foreground">{idx + 1}</div>
                  )}
                </Card>
              );
            }))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Current:</div>
            <div className="text-lg font-semibold">{wordFromPath.toUpperCase()}</div>
            <Button onClick={submitWord} disabled={!isGameReady || path.length < 3}>Submit</Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-3xl font-bold">{score}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-2">Used words</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(usedWords).slice(-20).reverse().map((w) => (
                <span key={w} className="px-2 py-1 rounded-md bg-secondary text-sm">{w.toUpperCase()}</span>
              ))}
              {!usedWords.size && <span className="text-muted-foreground text-sm">None yet</span>}
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
