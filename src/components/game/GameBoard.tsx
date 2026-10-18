import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { GameTile } from "./GameTile";
import type { Pos, SpecialTile } from "@/types/game";
import type { TileSkin } from "@/lib/tileSkins";
import { getBenchmarkColor } from "@/lib/tileSkins";
import type { Benchmarks } from "@/lib/benchmarks";

type Grade = "bronze" | "silver" | "gold" | "platinum" | "none";
export type PathTone = "neutral" | "valid" | "invalid" | "warn";

export interface BoardStamp {
  id: number;
  label: string;
  points: number;
}

interface GameBoardProps {
  board: string[][] | null;
  specialTiles: SpecialTile[][];
  path: Pos[];
  pathTone: PathTone;
  lastWordTiles: Set<string>;
  affectedTiles: Set<string>;
  newWildTiles: Set<string>;
  hintTiles: Set<string>;
  size: number;
  skin: TileSkin;
  score: number;
  benchmarks: Benchmarks | null;
  isInitializing: boolean;
  shakeKey: number;
  stamp: BoardStamp | null;
  overlay?: React.ReactNode;
  focusPos: Pos;
  onFocusPos: (pos: Pos) => void;
  onTilePointerDown: (pos: Pos, e: React.PointerEvent<HTMLButtonElement>) => void;
  onTileActivate: (pos: Pos) => void;
  loadingTip?: string;
}

const keyOf = (p: Pos) => `${p.r},${p.c}`;

// SVG polyline through the centers of the selected tiles. Geometry is
// measured from the grid so it stays aligned at every size and gap.
function PathOverlay({ gridRef, path, size, tone }: {
  gridRef: React.RefObject<HTMLDivElement>;
  path: Pos[];
  size: number;
  tone: PathTone;
}) {
  const [geom, setGeom] = useState({ width: 0, height: 0, gap: 0 });

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setGeom({ width: el.clientWidth, height: el.clientHeight, gap });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef, size]);

  if (path.length < 2 || !geom.width) return null;
  const cell = (geom.width - geom.gap * (size - 1)) / size;
  const rowCell = (geom.height - geom.gap * (size - 1)) / size;
  const points = path
    .map(p => `${p.c * (cell + geom.gap) + cell / 2},${p.r * (rowCell + geom.gap) + rowCell / 2}`)
    .join(" ");
  const color =
    tone === "valid" ? "hsl(var(--ok))"
      : tone === "invalid" ? "hsl(var(--bad))"
      : tone === "warn" ? "hsl(var(--warn))"
      : "hsl(var(--brand-500))";
  const strokeWidth = Math.max(6, cell * 0.12);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 overflow-visible"
      width={geom.width}
      height={geom.height}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={tone === "invalid" ? `${strokeWidth * 0.2} ${strokeWidth * 1.4}` : undefined}
        className="transition-[stroke] duration-150"
      />
    </svg>
  );
}

export const GameBoard = memo(function GameBoard({
  board,
  specialTiles,
  path,
  pathTone,
  lastWordTiles,
  affectedTiles,
  newWildTiles,
  hintTiles,
  size,
  skin,
  score,
  benchmarks,
  isInitializing,
  shakeKey,
  stamp,
  overlay,
  focusPos,
  onFocusPos,
  onTilePointerDown,
  onTileActivate,
  loadingTip,
}: GameBoardProps) {
  const currentGrade: Grade = benchmarks
    ? score >= benchmarks.platinum ? "platinum"
      : score >= benchmarks.gold ? "gold"
      : score >= benchmarks.silver ? "silver"
      : score >= benchmarks.bronze ? "bronze"
      : "none"
    : "none";

  const benchmarkColor = getBenchmarkColor(skin, currentGrade);
  const gridRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!shakeKey) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [shakeKey]);

  // Keep the latest callbacks in a ref so per-tile handlers can stay
  // referentially stable across renders — otherwise every render hands each
  // GameTile fresh closures and its memo() never bails out.
  const callbacksRef = useRef({ onTilePointerDown, onTileActivate, onFocusPos });
  callbacksRef.current = { onTilePointerDown, onTileActivate, onFocusPos };

  const getTileHandlers = useMemo(() => {
    const cache = new Map<string, {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
      onActivate: () => void;
      onFocus: () => void;
    }>();
    return (k: string, r: number, c: number) => {
      let handlers = cache.get(k);
      if (!handlers) {
        const pos: Pos = { r, c };
        handlers = {
          onPointerDown: (e) => callbacksRef.current.onTilePointerDown(pos, e),
          onActivate: () => callbacksRef.current.onTileActivate(pos),
          onFocus: () => callbacksRef.current.onFocusPos(pos),
        };
        cache.set(k, handlers);
      }
      return handlers;
    };
  }, []);

  // O(1) selection lookup instead of scanning the path for every tile
  const pathIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    path.forEach((p, i) => map.set(keyOf(p), i));
    return map;
  }, [path]);

  // Roving tabindex: arrow keys move focus between tiles
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    let next: Pos | null = null;
    if (deltas[e.key]) {
      const [dr, dc] = deltas[e.key];
      next = {
        r: Math.min(size - 1, Math.max(0, focusPos.r + dr)),
        c: Math.min(size - 1, Math.max(0, focusPos.c + dc)),
      };
    } else if (e.key === "Home") {
      next = { r: focusPos.r, c: 0 };
    } else if (e.key === "End") {
      next = { r: focusPos.r, c: size - 1 };
    }
    if (!next) return;
    e.preventDefault();
    onFocusPos(next);
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-tile-pos="${keyOf(next)}"]`);
    el?.focus();
  };

  const safeFocus = focusPos.r < size && focusPos.c < size ? focusPos : { r: 0, c: 0 };

  return (
    <div className="relative mx-auto w-full board-frame">
      {/* Dictionary loading overlay */}
      {isInitializing && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm rounded-xl gap-3 p-6 text-center">
          <div className="flex gap-1.5" role="status" aria-label="Loading dictionary">
            {"LEXI".split("").map((ch, i) => (
              <span
                key={ch}
                className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-[hsl(var(--brand-500))] font-bold text-[hsl(var(--brand-500))] animate-tile-flip"
                style={{ animationDelay: `${i * 120}ms`, animationIterationCount: "infinite" }}
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="text-sm text-foreground/80">Loading dictionary…</p>
          {loadingTip && <p className="max-w-xs text-xs text-foreground/70">Tip: {loadingTip}</p>}
        </div>
      )}

      {overlay}

      <div className={`relative ${shaking ? "animate-shake" : ""}`}>
        <div
          ref={gridRef}
          role="group"
          aria-label={`Letter board, ${size} by ${size}. Use arrow keys to move, Space to select a tile, type letters to trace a word, Enter to submit.`}
          className="grid gap-2 sm:gap-3 select-none"
          data-grid-container
          onKeyDown={onGridKeyDown}
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {board
            ? board.map((row, r) =>
                row.map((ch, c) => {
                  const k = `${r},${c}`;
                  const idx = pathIndexByKey.get(k) ?? -1;
                  const handlers = getTileHandlers(k, r, c);

                  return (
                    <GameTile
                      key={k}
                      tileKey={k}
                      row={r}
                      col={c}
                      letter={ch}
                      special={specialTiles[r]?.[c] ?? { type: null }}
                      isSelected={idx !== -1}
                      selectionIndex={idx}
                      isReused={lastWordTiles.has(k)}
                      isAffected={affectedTiles.has(k)}
                      isNewWild={newWildTiles.has(k)}
                      isHint={hintTiles.has(k)}
                      isFocusTarget={safeFocus.r === r && safeFocus.c === c}
                      skin={skin}
                      benchmarkColor={benchmarkColor}
                      currentGrade={currentGrade}
                      onPointerDown={handlers.onPointerDown}
                      onActivate={handlers.onActivate}
                      onFocus={handlers.onFocus}
                    />
                  );
                }),
              )
            : (
              <div className="col-span-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-foreground/80">Loading game…</p>
                </div>
              </div>
            )}
        </div>
        <PathOverlay gridRef={gridRef} path={path} size={size} tone={pathTone} />

        {/* Reaction stamp: the reward for a word lives on the board, not in a toast */}
        {stamp && (
          <div
            key={stamp.id}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          >
            <div className="animate-stamp rounded-2xl border-4 border-[hsl(var(--brand-500))] bg-background/90 px-5 py-2 text-center shadow-xl -rotate-6">
              <div className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[hsl(var(--brand-600))]">{stamp.label}</div>
              <div className="text-lg font-bold text-foreground">+{stamp.points}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
