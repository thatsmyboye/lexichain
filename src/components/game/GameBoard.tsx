import { memo, useCallback } from "react";
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

  // Stable per-position handlers to avoid re-creating on every render
  const makePointerDown = useCallback(
    (pos: Pos) => () => onTilePointerDown(pos),
    [onTilePointerDown],
  );
  const makePointerEnter = useCallback(
    (pos: Pos) => () => onTilePointerEnter(pos),
    [onTilePointerEnter],
  );
  const makeTouchStart = useCallback(
    (pos: Pos) => (e: React.TouchEvent) => onTileTouch(e, pos),
    [onTileTouch],
  );
  const makeTap = useCallback(
    (pos: Pos) => () => onTileTap(pos),
    [onTileTap],
  );

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
                const pos: Pos = { r, c };
                const k = keyOf(pos);
                const idx = path.findIndex(p => p.r === r && p.c === c);

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
                    onPointerDown={makePointerDown(pos)}
                    onPointerEnter={makePointerEnter(pos)}
                    onTouchStart={makeTouchStart(pos)}
                    onClick={makeTap(pos)}
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
