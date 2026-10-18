import { memo } from "react";
import type React from "react";
import type { SpecialTile } from "@/types/game";
import type { TileSkin } from "@/lib/tileSkins";
import { letterRarity } from "@/lib/letterRarity";
import { SPECIAL_SHAPES } from "@/lib/specialTileShapes";
import { cn } from "@/lib/utils";
import { SpecialTileIcon } from "./SpecialTileIcon";

interface BenchmarkColor {
  border: string;
  background: string;
}

type Grade = "bronze" | "silver" | "gold" | "platinum" | "none";

interface GameTileProps {
  letter: string;
  tileKey: string;
  row: number;
  col: number;
  special: SpecialTile;
  isSelected: boolean;
  selectionIndex: number;
  isReused: boolean;
  isAffected: boolean;
  isNewWild: boolean;
  isHint: boolean;
  isFocusTarget: boolean;
  skin: TileSkin;
  benchmarkColor: BenchmarkColor;
  currentGrade: Grade;
  /**
   * Direction (row/col delta, each -1..1) from this frozen tile toward the
   * Freeze tile that froze it, so frost can creep in from that edge.
   * Omitted when unknown: frost then forms evenly around the rim.
   */
  frostDr?: number;
  frostDc?: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onActivate: () => void;
  onFocus: () => void;
}

function getTileClasses(
  special: SpecialTile,
  isSelected: boolean,
  isReused: boolean,
  isAffected: boolean,
  isNewWild: boolean,
  isHint: boolean,
  skin: TileSkin,
  benchmarkColor: BenchmarkColor,
  currentGrade: Grade,
): string {
  let shape = SPECIAL_SHAPES[special.type ?? "default"] ?? SPECIAL_SHAPES.default;
  // Ghosts flicker their mist/outline on a decorative layer instead of fading
  // the whole tile, so the letter keeps full contrast.
  if (special.type === "ghost") shape = shape.replace("animate-tile-fade", "");
  let base = `game-tile relative aspect-square w-full flex items-center justify-center border-2 text-card-foreground shadow-sm select-none outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--brand-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${shape} ${benchmarkColor.border} transition-[transform,box-shadow,background-color] duration-200 `;

  // Special tiles bring their own fill and letter color. Skipping the skin
  // fill matters: its dark: variants would otherwise survive twMerge and
  // repaint special tiles in the skin's colors in dark mode.
  const skinFill = special.type ? "" : skin.baseClasses + " ";

  if (isSelected) {
    base += skin.selectedClasses + " tile-selected shadow-[0_0_20px_hsl(var(--ok)/0.4)] ";
  } else if (isAffected) {
    base += "bg-gradient-to-br from-yellow-300 to-orange-400 text-gray-900 animate-tile-flip shadow-[0_0_20px_rgba(251,191,36,0.5)] ";
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
    base += skinFill;
  } else {
    base += skinFill;
  }

  if (isHint && !isSelected) {
    base += "ring-4 ring-[hsl(var(--brand-500))] animate-tile-pulse ";
  }

  if (special.type === "stone") {
    base += "bg-gradient-to-br from-gray-500 to-gray-700 text-white shadow-[0_0_15px_rgba(75,85,99,0.4)] ";
  } else if (special.type === "wild") {
    base += `bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] ${isNewWild ? "animate-blink-twice" : ""} `;
  } else if (special.type === "xfactor") {
    base += "bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-[0_0_20px_rgba(251,146,60,0.5)] ";
  } else if (special.type === "multiplier") {
    base += "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] ";
  } else if (special.type === "shuffle") {
    base += "bg-gradient-to-br from-red-200 to-red-300 text-red-900 shadow-[0_0_15px_rgba(239,68,68,0.3)] ";
  } else if (special.type === "freeze") {
    base += "bg-gradient-to-br from-cyan-200 to-blue-300 text-blue-950 shadow-[0_0_20px_rgba(34,211,238,0.5)] ";
  } else if (special.type === "decay") {
    base += "bg-gradient-to-br from-yellow-200 to-green-400 text-green-950 shadow-[0_0_15px_rgba(132,204,22,0.4)] ";
  } else if (special.type === "mirror") {
    base += "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-900 shadow-[0_0_20px_rgba(156,163,175,0.5)] ";
  } else if (special.type === "magnet") {
    base += "bg-gradient-to-br from-red-500 to-gray-600 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)] ";
  } else if (special.type === "bomb") {
    base += "bg-gradient-to-br from-red-600 to-gray-900 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] ";
  } else if (special.type === "chain") {
    base += "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] ";
  } else if (special.type === "ghost") {
    base += "bg-gradient-to-br from-white to-gray-200 text-gray-700 border-dashed shadow-[0_0_15px_rgba(255,255,255,0.3)] dark:from-slate-700 dark:to-slate-800 dark:text-gray-200 ";
  } else if (special.type === "tax") {
    base += "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.4)] ";
  }

  // twMerge so later text/background classes (skin, special) win cleanly
  return cn(base);
}

// Types whose corner icon would collide with their own markers
// (X-Factor corner dots, Multiplier value badge).
const NO_CORNER_ICON = new Set<SpecialTile["type"]>(["xfactor", "multiplier", null]);

// Bomb fuse: an S-curve from the bomb's shoulder (45° on the round tile) up
// past the tile's top-right corner. The 24×24 box covers the tile's top-right
// corner with a small overhang that stays inside the grid gap. The cubic is trimmed with
// de Casteljau so the burning tip sits exactly at the end of what's left.
const FUSE = [[11.7, 12.3], [9.6, 3.8], [20, 10.2], [22.3, 1.2]] as const;
const MAX_FUSE_TURNS = 5;

function fuseGeometry(turnsLeft: number | undefined) {
  const t = turnsLeft === undefined
    ? 1
    : Math.max(0.12, Math.min(1, turnsLeft / MAX_FUSE_TURNS));
  const lerp = (a: readonly number[], b: readonly number[]) =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [p0, p1, p2, p3] = FUSE;
  const a = lerp(p0, p1);
  const b = lerp(p1, p2);
  const c = lerp(p2, p3);
  const ab = lerp(a, b);
  const bc = lerp(b, c);
  const tip = lerp(ab, bc);
  const f = (n: number) => n.toFixed(2);
  return {
    d: `M${f(p0[0])} ${f(p0[1])} C${f(a[0])} ${f(a[1])} ${f(ab[0])} ${f(ab[1])} ${f(tip[0])} ${f(tip[1])}`,
    full: `M${p0.join(" ")} C${p1.join(" ")} ${p2.join(" ")} ${p3.join(" ")}`,
    tip,
  };
}

function BombFuse({ turnsLeft }: { turnsLeft: number | undefined }) {
  const { d, full, tip } = fuseGeometry(turnsLeft);
  const urgent = turnsLeft !== undefined && turnsLeft <= 1;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute -right-[14%] -top-[14%] z-[15] h-[56%] w-[56%] overflow-visible"
    >
      {/* Ash trail: the burnt-off length, so what's left reads as a gauge */}
      <path d={full} fill="none" stroke="rgba(100,100,100,0.55)" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.6 1.2" />
      <path d={d} fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth="3.6" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#e0b46e" strokeWidth="2" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#7c4a1e" strokeWidth="2" strokeLinecap="butt" strokeDasharray="0.9 1.5" />
      {/* Collar where the fuse leaves the bomb */}
      <rect x="9" y="11.4" width="5" height="3.2" rx="0.8" transform="rotate(-45 11.5 13)" fill="#1f2937" stroke="#d1d5db" strokeWidth="0.8" />
      <g transform={`translate(${tip[0].toFixed(2)} ${tip[1].toFixed(2)})`}>
        <g className={cn("tile-bomb-spark", urgent && "tile-bomb-spark-urgent")}>
          <circle r="4.2" fill="rgba(251,146,60,0.45)" />
          <path d="M0 -4.6V-2.2M0 2.2V4.6M-4.6 0H-2.2M2.2 0H4.6M-3.2 -3.2L-1.6 -1.6M1.6 1.6L3.2 3.2M3.2 -3.2L1.6 -1.6M-1.6 1.6L-3.2 3.2" stroke="#fde047" strokeWidth="0.9" strokeLinecap="round" />
          <circle r="1.9" fill="#fef9c3" stroke="#f97316" strokeWidth="0.8" />
        </g>
      </g>
    </svg>
  );
}

const SPECIAL_NAMES: Record<NonNullable<SpecialTile["type"]>, string> = {
  stone: "Stone tile, blocked",
  wild: "Wild tile, any letter",
  xfactor: "X-Factor tile",
  multiplier: "Multiplier tile",
  shuffle: "Shuffle tile",
  freeze: "Freeze tile",
  decay: "Decay tile",
  mirror: "Mirror tile, copies previous letter",
  magnet: "Magnet tile",
  bomb: "Bomb tile",
  chain: "Chain tile",
  ghost: "Ghost tile, no letter, bridges to any tile",
  tax: "Tax tile",
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function describeTile(
  letter: string,
  row: number,
  col: number,
  special: SpecialTile,
  selectionIndex: number,
  isReused: boolean,
): string {
  const parts: string[] = [];
  parts.push(special.type === "wild" ? "Wild" : special.type === "ghost" ? "Ghost" : letter);
  parts.push(`row ${row + 1}, column ${col + 1}`);
  if (special.type) {
    let name = SPECIAL_NAMES[special.type];
    if (special.type === "multiplier" && special.value) name += ` ${special.value} times`;
    parts.push(name);
    if (special.expiryTurns !== undefined) parts.push(`expires in ${special.expiryTurns} turn${special.expiryTurns === 1 ? "" : "s"}`);
  }
  if (special.frozen) parts.push("frozen");
  const rarity = special.type === "wild" ? 0 : letterRarity(letter);
  if (rarity === 2) parts.push("very rare letter");
  else if (rarity === 1) parts.push("rare letter");
  if (isReused) parts.push("in last word");
  if (selectionIndex >= 0) parts.push(`selected ${ordinal(selectionIndex + 1)}`);
  return parts.join(", ");
}

export const GameTile = memo(function GameTile({
  letter,
  tileKey,
  row,
  col,
  special,
  isSelected,
  selectionIndex,
  isReused,
  isAffected,
  isNewWild,
  isHint,
  isFocusTarget,
  skin,
  benchmarkColor,
  currentGrade,
  frostDr,
  frostDc,
  onPointerDown,
  onActivate,
  onFocus,
}: GameTileProps) {
  const classes = getTileClasses(
    special, isSelected, isReused, isAffected, isNewWild, isHint,
    skin, benchmarkColor, currentGrade,
  );

  const reusedBg = (() => {
    if (currentGrade === "none") return skin.reusedTint ?? "rgba(168, 85, 247, 0.2)";
    const colors: Record<string, string> = {
      platinum: "rgba(168, 85, 247, 0.3)",
      gold: "rgba(234, 179, 8, 0.3)",
      silver: "rgba(156, 163, 175, 0.3)",
      bronze: "rgba(217, 119, 6, 0.3)",
    };
    return colors[currentGrade] ?? "rgba(168, 85, 247, 0.2)";
  })();

  const rarity = special.type === "wild" ? 0 : letterRarity(letter);

  // Skin material only on plain tiles: special tiles keep their own colors,
  // and selected/affected states keep their flat, high-signal fills.
  const showTexture = special.type === null && !isSelected && !isAffected;

  // Frost creeps in from the edge facing the Freeze tile.
  const hasFrostDir = frostDr !== undefined && frostDc !== undefined && (frostDr !== 0 || frostDc !== 0);
  const frostStyle = hasFrostDir
    ? ({
        "--frost-angle": `${Math.round((Math.atan2(-frostDc!, frostDr!) * 180) / Math.PI)}deg`,
        transformOrigin: `${frostDc! < 0 ? "left" : frostDc! > 0 ? "right" : "center"} ${frostDr! < 0 ? "top" : frostDr! > 0 ? "bottom" : "center"}`,
      } as React.CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      data-tile-pos={tileKey}
      data-selected={isSelected || undefined}
      tabIndex={isFocusTarget ? 0 : -1}
      aria-label={describeTile(letter, row, col, special, selectionIndex, isReused)}
      aria-pressed={isSelected}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onClick={(e) => {
        // Pointer input is handled on pointerdown/up; only keyboard and
        // assistive-tech activations are handled here. Touch taps can also
        // produce detail === 0 clicks, so require an empty pointerType too.
        const pointerType = (e.nativeEvent as PointerEvent).pointerType;
        if (e.detail === 0 && !pointerType) onActivate();
      }}
      className={classes}
      style={{ touchAction: "none" }}
    >
      {/* Skin surface: grain, noise, gloss or glow (see index.css) */}
      {showTexture && (
        <span aria-hidden="true" className={cn("tile-texture", skin.textureClass)} />
      )}

      {/* Purposeful idle motion for special tiles (all off under reduced motion) */}
      {special.type === "freeze" && <span aria-hidden="true" className="tile-freeze-shimmer" />}
      {special.type === "decay" && <span aria-hidden="true" className="tile-decay-blotch" />}
      {special.type === "ghost" && <span aria-hidden="true" className="tile-ghost-wisp" />}

      {/* Reused tile overlay */}
      {isReused && benchmarkColor.background && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] pointer-events-none z-0"
          style={{ backgroundColor: reusedBg }}
        />
      )}

      {/* Foil sheen on rare letters instead of relying on a tiny glyph */}
      {rarity > 0 && (
        <span aria-hidden="true" className={`tile-foil ${rarity === 2 ? "tile-foil-strong" : ""}`} />
      )}

      {/* Chain-link glyph so "reused" reads without color */}
      {isReused && !isSelected && (
        <span aria-hidden="true" className="absolute bottom-0.5 left-1 text-[11px] leading-none opacity-80 z-10 pointer-events-none">⛓</span>
      )}

      <span aria-hidden="true" className="text-[clamp(1.25rem,6vw,1.875rem)] font-semibold tracking-wide relative z-10">
        {special.type === "wild" ? "?" : letter}
      </span>

      {/* Rarity markers */}
      {rarity === 1 && (
        <span aria-hidden="true" className={cn(
          "absolute top-0.5 right-1 text-[13px] leading-none font-black z-10",
          skin.darkSurface && showTexture ? "text-orange-300" : "text-orange-700 dark:text-orange-300",
        )}>+</span>
      )}
      {rarity === 2 && (
        <span aria-hidden="true" className={cn(
          "absolute top-0.5 right-1 text-[13px] leading-none font-black z-10",
          skin.darkSurface && showTexture ? "text-purple-300" : "text-purple-700 dark:text-purple-300",
        )}>★</span>
      )}

      {/* Selection order */}
      {isSelected && (
        <span aria-hidden="true" className="absolute top-1 right-1 z-20 min-w-[18px] rounded-full bg-foreground px-1 text-[11px] font-bold leading-[18px] text-background">
          {selectionIndex + 1}
        </span>
      )}

      {/* X-Factor corner dots */}
      {special.type === "xfactor" && (
        <span aria-hidden="true">
          <span className="absolute top-1 left-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <span className="absolute bottom-1 left-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
          <span className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-white/80 ring-1 ring-black/20 rounded-full" />
        </span>
      )}

      {/* Multiplier value */}
      {special.type === "multiplier" && special.value && (
        <span aria-hidden="true" className="absolute bottom-1 text-xs font-bold bg-black/30 px-1 rounded">
          {special.value}x
        </span>
      )}

      {/* Bomb fuse: burns down as the expiry counter drops */}
      {special.type === "bomb" && <BombFuse turnsLeft={special.expiryTurns} />}

      {/* Expiry ring: depletes as the tile's remaining turns run out */}
      {special.type !== null && special.expiryTurns !== undefined && (
        <span aria-hidden="true" className="absolute top-1 left-1 z-10 flex h-[18px] w-[18px] items-center justify-center">
          <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
            <circle cx="10" cy="10" r="8" fill="rgba(0,0,0,0.7)" />
            <circle
              cx="10" cy="10" r="8" fill="none" stroke="white" strokeWidth="2"
              strokeDasharray={`${Math.min(1, special.expiryTurns / 5) * 50.3} 50.3`}
            />
          </svg>
          <span className="relative text-[10px] font-bold text-white">{special.expiryTurns}</span>
        </span>
      )}

      {/* Special tile icon */}
      {!NO_CORNER_ICON.has(special.type) && special.type !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute z-10 leading-none opacity-90",
            // Bomb tiles are round: tuck the icon inside the circle
            special.type === "bomb" ? "bottom-[11%] right-[11%]" : "bottom-0.5 right-0.5",
            special.type === "magnet" && "tile-magnet-tug",
          )}
        >
          <SpecialTileIcon type={special.type} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </span>
      )}

      {/* Frozen indicator: frost creeps in from the Freeze tile's side */}
      {special.frozen && (
        <span aria-hidden="true" className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-cyan-300/80 pointer-events-none">
          <span
            className={cn("tile-frost", hasFrostDir ? "tile-frost-directional" : "tile-frost-rim")}
            style={frostStyle}
          />
          <span className="absolute top-0.5 right-0.5 z-10 text-white drop-shadow-[0_0_2px_rgba(8,47,73,0.95)]">
            <SpecialTileIcon type="freeze" className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </span>
      )}
    </button>
  );
});
