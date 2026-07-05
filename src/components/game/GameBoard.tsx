import { memo, useMemo, useRef } from "react";
import type React from "react";
import { GameTile } from "./GameTile";
import type { Pos, SpecialTile } from "@/types/game";
import type { TileSkin } from "@/lib/tileSkins";
import { getBenchmarkColor } from "@/lib/tileSkins";
import type { Benchmarks } from "@/lib/benchmarks";

type Grade = "bronze" | "silver" | "gold" | "platinum" | "none";

interface GameBoardProps {
  board: string[][];
  specialTiles: SpecialTile[][];
  path: Pos[];
  lastWordTiles: Set<string>;
  affectedTiles: Set<string>;
  newWildTiles: Set<string>;
  size: number;
  skin: TileSkin;
  score: number;
  benchmarks: Benchmarks | null;
  isInitializing: boolean;
  onPointerUp: () => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTilePointerDown: (pos: Pos) => void;
  onTilePointerEnter: (pos: Pos) => void;
  onTileTouch: (e: React.TouchEvent, pos: Pos) => void;
  onTileTap: (pos: Pos) => void;
}

const keyOf = (p: Pos) => `${p.r},${p.c}`;

export const GameBoard = memo(function GameBoard({
  board,
  specialTiles,
  path,
  lastWordTiles,
  affectedTiles,
  newWildTiles,
  size,
  skin,
  score,
  benchmarks,
  isInitializing,
  onPointerUp,
  onTouchMove,
  onTouchEnd,
  onTilePointerDown,
  onTilePointerEnter,
  onTileTouch,
  onTileTap,
}: GameBoardProps) {
  const currentGrade: Grade = benchmarks
    ? score >= benchmarks.platinum ? "platinum"
      : score >= benchmarks.gold ? "gold"
      : score >= benchmarks.silver ? "silver"
      : score >= benchmarks.bronze ? "bronze"
      : "none"
    : "none";

  const benchmarkColor = getBenchmarkColor(skin, currentGrade);

  // Keep the latest callbacks in a ref so per-tile handlers can stay
  // referentially stable across renders — otherwise every render hands each
  // GameTile fresh closures and its memo() never bails out.
  const callbacksRef = useRef({ onTilePointerDown, onTilePointerEnter, onTileTouch, onTileTap });
  callbacksRef.current = { onTilePointerDown, onTilePointerEnter, onTileTouch, onTileTap };

  const getTileHandlers = useMemo(() => {
    const cache = new Map<string, {
      onPointerDown: () => void;
      onPointerEnter: () => void;
      onTouchStart: (e: React.TouchEvent) => void;
      onClick: () => void;
    }>();
    return (k: string, r: number, c: number) => {
      let handlers = cache.get(k);
      if (!handlers) {
        const pos: Pos = { r, c };
        handlers = {
          onPointerDown: () => callbacksRef.current.onTilePointerDown(pos),
          onPointerEnter: () => callbacksRef.current.onTilePointerEnter(pos),
          onTouchStart: (e: React.TouchEvent) => callbacksRef.current.onTileTouch(e, pos),
          onClick: () => callbacksRef.current.onTileTap(pos),
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

  return (
    <div
      className="relative"
      onPointerUp={onPointerUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* Dictionary loading overlay */}
      {isInitializing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg gap-3">
          <div
            className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin"
            role="status"
            aria-label="Loading dictionary"
          />
          <p className="text-sm text-muted-foreground">Loading dictionary…</p>
        </div>
      )}

      <div
        className="grid gap-3 select-none max-w-md"
        data-grid-container
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, touchAction: "none" }}
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
                    letter={ch}
                    special={specialTiles[r][c]}
                    isSelected={idx !== -1}
                    selectionIndex={idx}
                    isReused={lastWordTiles.has(k)}
                    isAffected={affectedTiles.has(k)}
                    isNewWild={newWildTiles.has(k)}
                    skin={skin}
                    benchmarkColor={benchmarkColor}
                    currentGrade={currentGrade}
                    onPointerDown={handlers.onPointerDown}
                    onPointerEnter={handlers.onPointerEnter}
                    onTouchStart={handlers.onTouchStart}
                    onClick={handlers.onClick}
                  />
                );
              }),
            )
          : (
            <div className="col-span-full flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading game…</p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
});
