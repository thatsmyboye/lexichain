/**
 * SpecialTilePreview Component
 * Displays a preview of special tiles that will appear after the next move
 * in Daily Challenge mode (without revealing their positions)
 */

import { SpecialTile } from "@/utils/specialTilePreview";
import { Card } from "@/components/ui/card";

interface SpecialTilePreviewProps {
  tiles: SpecialTile[];
}

export function SpecialTilePreview({ tiles }: SpecialTilePreviewProps) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 sm:gap-2 p-2 sm:p-3 bg-muted/50 rounded-lg border border-border">
      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Next{tiles.length > 1 ? " Tiles" : " Tile"}:
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {tiles.map((tile, index) => (
          <TileIcon key={index} tile={tile} />
        ))}
      </div>
    </div>
  );
}

function TileIcon({ tile }: { tile: SpecialTile }) {
  const getTileClasses = () => {
    let baseClasses =
      "relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg transition-all duration-300 ";

    if (tile.type === "stone") {
      baseClasses +=
        "bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-[0_0_15px_rgba(75,85,99,0.4)]";
    } else if (tile.type === "wild") {
      baseClasses +=
        "bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]";
    } else if (tile.type === "xfactor") {
      baseClasses +=
        "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.5)]";
    } else if (tile.type === "multiplier") {
      baseClasses +=
        "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]";
    } else if (tile.type === "shuffle") {
      baseClasses +=
        "bg-gradient-to-br from-red-200 to-red-300 text-red-800 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    } else if (tile.type === "freeze") {
      baseClasses +=
        "bg-gradient-to-br from-cyan-300 to-blue-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]";
    } else if (tile.type === "decay") {
      baseClasses +=
        "bg-gradient-to-br from-yellow-300 to-green-500 text-white shadow-[0_0_15px_rgba(132,204,22,0.4)]";
    } else if (tile.type === "mirror") {
      baseClasses +=
        "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-[0_0_20px_rgba(156,163,175,0.5)]";
    } else if (tile.type === "magnet") {
      baseClasses +=
        "bg-gradient-to-br from-red-400 to-gray-400 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)]";
    } else if (tile.type === "bomb") {
      baseClasses +=
        "bg-gradient-to-br from-red-600 to-gray-900 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]";
    } else if (tile.type === "chain") {
      baseClasses +=
        "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]";
    } else if (tile.type === "ghost") {
      baseClasses +=
        "bg-gradient-to-br from-white/60 to-gray-200/60 text-gray-400 shadow-[0_0_15px_rgba(255,255,255,0.3)] opacity-70";
    } else if (tile.type === "tax") {
      baseClasses +=
        "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)]";
    }

    return baseClasses;
  };

  return (
    <Card className={getTileClasses()}>
      {/* Icon based on tile type */}
      {tile.type === "stone" && (
        <div className="text-2xl opacity-80">🪨</div>
      )}

      {tile.type === "wild" && (
        <div className="text-2xl font-bold">?</div>
      )}

      {tile.type === "xfactor" && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
          <div className="absolute top-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-white/30 rounded-full"></div>
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
        </>
      )}

      {tile.type === "multiplier" && tile.value && (
        <div className="text-base font-bold">{tile.value}x</div>
      )}

      {tile.type === "shuffle" && (
        <div className="text-sm">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="opacity-60"
          >
            <path
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}

      {tile.type === "freeze" && <div className="text-2xl opacity-80">❄️</div>}
      {tile.type === "decay" && <div className="text-2xl opacity-80">🦠</div>}
      {tile.type === "mirror" && <div className="text-2xl opacity-80">🪞</div>}
      {tile.type === "magnet" && <div className="text-2xl opacity-80">🧲</div>}
      {tile.type === "bomb" && <div className="text-2xl opacity-80">💣</div>}
      {tile.type === "chain" && <div className="text-2xl opacity-80">⛓️</div>}
      {tile.type === "ghost" && <div className="text-2xl opacity-80">👻</div>}
      {tile.type === "tax" && <div className="text-2xl opacity-80">💰</div>}

      {/* Expiry turns indicator */}
      {tile.expiryTurns !== undefined && (
        <div className="absolute top-0.5 left-0.5 text-[10px] font-bold bg-black/30 text-white px-1 rounded-full min-w-[14px] text-center">
          {tile.expiryTurns}
        </div>
      )}
    </Card>
  );
}
