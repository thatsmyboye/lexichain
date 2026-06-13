import { memo } from "react";
import type React from "react";
import { Card } from "@/components/ui/card";
import type { SpecialTile } from "@/types/game";
import type { TileSkin } from "@/lib/tileSkins";
import { letterRarity } from "@/lib/letterRarity";
import { SPECIAL_SHAPES } from "@/lib/specialTileShapes";

interface BenchmarkColor {
  border: string;
  background: string;
}

type Grade = "bronze" | "silver" | "gold" | "platinum" | "none";

interface GameTileProps {
  letter: string;
  tileKey: string;
  special: SpecialTile;
  isSelected: boolean;
  selectionIndex: number;
  isReused: boolean;
  isAffected: boolean;
  isNewWild: boolean;
  skin: TileSkin;
  benchmarkColor: BenchmarkColor;
  currentGrade: Grade;
  onPointerDown: () => void;
  onPointerEnter: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onClick: () => void;
}

function getTileClasses(
  special: SpecialTile,
  isSelected: boolean,
  isReused: boolean,
  isAffected: boolean,
  isNewWild: boolean,
  skin: TileSkin,
  benchmarkColor: BenchmarkColor,
  currentGrade: Grade,
): string {
  const shape = SPECIAL_SHAPES[special.type ?? "default"] ?? SPECIAL_SHAPES.default;
  let base = `relative aspect-square flex items-center justify-center ${shape} ${benchmarkColor.border} transition-[transform,box-shadow,background-color] duration-300 `;

  if (isSelected) {
    base += skin.selectedClasses + " shadow-[0_0_20px_rgba(34,197,94,0.4)] ";
  } else if (isAffected) {
    base += "bg-gradient-to-br from-yellow-300 to-orange-400 text-white animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.5)] ";
  } else if (isReused) {
    base += "relative ";
    if (currentGrade !== "none") {
      const ringColor = benchmarkColor.border.replace("border-", "ring-")
        .replace("-600", "-400").replace("-500", "-300").replace("-400", "-300");
      // Ring weight scales with grade so progress reads without color
      const ringWeight = {
        platinum: "ring-4 ring-offset-1 ring-offset-background ring-opacity-70 ",
        gold: "ring-4 ring-opacity-70 ",
        silver: "ring-2 ring-opacity-70 ",
        bronze: "ring-2 ring-opacity-50 ",
      }[currentGrade];
      base += ringWeight + ringColor + " ";
      if (currentGrade === "platinum") base += "shadow-[0_0_8px_rgba(168,85,247,0.4)] ";
      else if (currentGrade === "gold") base += "shadow-[0_0_8px_rgba(234,179,8,0.4)] ";
      else if (currentGrade === "silver") base += "shadow-[0_0_8px_rgba(156,163,175,0.4)] ";
      else base += "shadow-[0_0_8px_rgba(217,119,6,0.4)] ";
    }
  } else {
    base += skin.baseClasses + " ";
  }

  if (special.type === "stone") {
    base += "bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-[0_0_15px_rgba(75,85,99,0.4)] ";
  } else if (special.type === "wild") {
    base += `bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] ${isNewWild ? "animate-blink-twice" : ""} `;
  } else if (special.type === "xfactor") {
    base += "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.5)] ";
  } else if (special.type === "multiplier") {
    base += "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] ";
  } else if (special.type === "shuffle") {
    base += "bg-gradient-to-br from-red-200 to-red-300 text-red-800 shadow-[0_0_15px_rgba(239,68,68,0.3)] ";
  } else if (special.type === "freeze") {
    base += "bg-gradient-to-br from-cyan-300 to-blue-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)] ";
  } else if (special.type === "decay") {
    base += "bg-gradient-to-br from-yellow-300 to-green-500 text-white shadow-[0_0_15px_rgba(132,204,22,0.4)] ";
  } else if (special.type === "mirror") {
    base += "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-[0_0_20px_rgba(156,163,175,0.5)] ";
  } else if (special.type === "magnet") {
    base += "bg-gradient-to-br from-red-400 to-gray-400 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)] ";
  } else if (special.type === "bomb") {
    base += "bg-gradient-to-br from-red-600 to-gray-900 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] ";
  } else if (special.type === "chain") {
    base += "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] ";
  } else if (special.type === "ghost") {
    base += "bg-gradient-to-br from-white/60 to-gray-200/60 text-gray-400 shadow-[0_0_15px_rgba(255,255,255,0.3)] opacity-70 ";
  } else if (special.type === "tax") {
    base += "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] ";
  }

  return base;
}

const SPECIAL_ICONS: Partial<Record<NonNullable<SpecialTile["type"]>, string>> = {
  stone: "🪨", freeze: "❄️", decay: "🦠", mirror: "🪞",
  magnet: "🧲", bomb: "💣", chain: "⛓️", ghost: "👻", tax: "💰",
};

export const GameTile = memo(function GameTile({
  letter,
  tileKey,
  special,
  isSelected,
  selectionIndex,
  isReused,
  isAffected,
  isNewWild,
  skin,
  benchmarkColor,
  currentGrade,
  onPointerDown,
  onPointerEnter,
  onTouchStart,
  onClick,
}: GameTileProps) {
  const classes = getTileClasses(
    special, isSelected, isReused, isAffected, isNewWild,
    skin, benchmarkColor, currentGrade,
  );

  const reusedBg = (() => {
    if (currentGrade === "none") {
      const overlays: Record<string, string> = {
        original: "rgba(168, 85, 247, 0.2)",
        ocean: "rgba(34, 211, 238, 0.3)",
        forest: "rgba(52, 211, 153, 0.3)",
        sunset: "rgba(251, 146, 60, 0.3)",
        midnight: "rgba(168, 85, 247, 0.3)",
        neon: "rgba(34, 211, 238, 0.4)",
      };
      return overlays[skin.id] ?? "rgba(168, 85, 247, 0.2)";
    }
    const colors: Record<string, string> = {
      platinum: "rgba(168, 85, 247, 0.3)",
      gold: "rgba(234, 179, 8, 0.3)",
      silver: "rgba(156, 163, 175, 0.3)",
      bronze: "rgba(217, 119, 6, 0.3)",
    };
    return colors[currentGrade] ?? "rgba(168, 85, 247, 0.2)";
  })();

  return (
    <Card
      key={tileKey}
      data-tile-pos={tileKey}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onTouchStart={onTouchStart}
      onClick={onClick}
      className={classes}
      style={{ touchAction: "none" }}
    >
      {/* Reused tile overlay */}
      {isReused && benchmarkColor.background && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none z-0"
          style={{ backgroundColor: reusedBg }}
        />
      )}

      {/* Reusable glyph so "reused" reads without color */}
      {isReused && !isSelected && (
        <div className="absolute bottom-0.5 left-0.5 text-[10px] leading-none opacity-70 z-10 pointer-events-none">↻</div>
      )}

      <div className="text-3xl font-semibold tracking-wide relative z-10">
        {special.type === "wild" ? "?" : letter}
      </div>

      {/* Rarity indicators */}
      {special.type !== "wild" && letterRarity(letter) === 1 && (
        <div className="absolute top-0.5 right-0.5 text-xs font-bold text-orange-600 dark:text-orange-400 z-10">+</div>
      )}
      {special.type !== "wild" && letterRarity(letter) === 2 && (
        <div className="absolute top-0.5 right-0.5 text-xs font-bold text-purple-600 dark:text-purple-400 z-10">★</div>
      )}

      {/* Selection order */}
      {isSelected && (
        <div className="absolute top-1 right-2 text-xs font-medium text-muted-foreground">
          {selectionIndex + 1}
        </div>
      )}

      {/* X-Factor corner dots */}
      {special.type === "xfactor" && (
        <>
          <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <div className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
        </>
      )}

      {/* Multiplier value */}
      {special.type === "multiplier" && special.value && (
        <div className="absolute bottom-1 text-xs font-bold bg-white/20 px-1 rounded">
          {special.value}x
        </div>
      )}

      {/* Shuffle icon */}
      {special.type === "shuffle" && (
        <div className="absolute top-0.5 right-0.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" className="opacity-60">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* Expiry counter */}
      {special.type !== null && special.expiryTurns !== undefined && (
        <div className="absolute top-1 left-1 text-xs font-bold bg-black/30 text-white px-1 rounded-full min-w-[16px] text-center">
          {special.expiryTurns}
        </div>
      )}

      {/* Special tile emoji */}
      {special.type !== null && special.type in SPECIAL_ICONS && (
        <div className="absolute bottom-0.5 right-0.5 text-xs opacity-80">
          {SPECIAL_ICONS[special.type as keyof typeof SPECIAL_ICONS]}
        </div>
      )}

      {/* Frozen indicator */}
      {special.frozen && (
        <div className="absolute top-0 right-0 text-xs opacity-60">❄</div>
      )}
    </Card>
  );
});
