/**
 * SpecialTilePreview Component
 * Displays a preview of special tiles that will appear after the next move
 * in Daily Challenge mode (without revealing their positions)
 */

import { useRef, useState } from "react";
import type React from "react";
import { SpecialTile } from "@/utils/specialTilePreview";
import { Card } from "@/components/ui/card";
import { SPECIAL_SHAPES } from "@/lib/specialTileShapes";
import { SpecialTileIcon } from "@/components/game/SpecialTileIcon";
import { haptic } from "@/lib/feedback";
import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  SpecialTileTooltip,
  type TileTip,
} from "@/components/game/SpecialTileTooltip";

interface SpecialTilePreviewProps {
  tiles: SpecialTile[];
}

export function SpecialTilePreview({ tiles }: SpecialTilePreviewProps) {
  const [tip, setTip] = useState<TileTip | null>(null);
  const hold = useRef<{ pointerId: number; x: number; y: number; timer: number } | null>(null);

  if (tiles.length === 0) {
    return null;
  }

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  // Touch and hold an upcoming tile to see what it does
  const holdHandlers = (tile: SpecialTile) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      cancelHold();
      if (e.pointerType === "mouse" || !tile.type) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const timer = window.setTimeout(() => {
        hold.current = null;
        haptic("info");
        setTip({
          type: tile.type,
          value: tile.value,
          expiryTurns: tile.expiryTurns,
          upcoming: true,
          anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        });
      }, LONG_PRESS_MS);
      hold.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const h = hold.current;
      if (h && e.pointerId === h.pointerId && Math.hypot(e.clientX - h.x, e.clientY - h.y) > LONG_PRESS_SLOP_PX) {
        cancelHold();
      }
    },
    onPointerUp: cancelHold,
    onPointerCancel: cancelHold,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="flex flex-col gap-1 sm:gap-2 p-2 sm:p-3 bg-muted/50 rounded-lg border border-border">
      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Next{tiles.length > 1 ? " Tiles" : " Tile"}:
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {tiles.map((tile, index) => (
          <TileIcon key={index} tile={tile} {...holdHandlers(tile)} />
        ))}
      </div>
      <SpecialTileTooltip tip={tip} onDismiss={() => setTip(null)} />
    </div>
  );
}

type TileIconProps = { tile: SpecialTile } & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onContextMenu"
>;

function TileIcon({ tile, ...handlers }: TileIconProps) {
  const getTileClasses = () => {
    const shape = SPECIAL_SHAPES[tile.type ?? "default"] ?? SPECIAL_SHAPES.default;
    let baseClasses = `relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center ${shape} border-white/40 transition-all duration-300 `;

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
        "bg-gradient-to-br from-red-200 to-red-300 text-red-900 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    } else if (tile.type === "freeze") {
      baseClasses +=
        "bg-gradient-to-br from-cyan-200 to-blue-300 text-blue-950 shadow-[0_0_20px_rgba(34,211,238,0.5)]";
    } else if (tile.type === "decay") {
      baseClasses +=
        "bg-gradient-to-br from-yellow-200 to-green-400 text-green-950 shadow-[0_0_15px_rgba(132,204,22,0.4)]";
    } else if (tile.type === "mirror") {
      baseClasses +=
        "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-[0_0_20px_rgba(156,163,175,0.5)]";
    } else if (tile.type === "magnet") {
      baseClasses +=
        "bg-gradient-to-br from-red-500 to-gray-600 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)]";
    } else if (tile.type === "bomb") {
      baseClasses +=
        "bg-gradient-to-br from-red-600 to-gray-900 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]";
    } else if (tile.type === "chain") {
      baseClasses +=
        "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]";
    } else if (tile.type === "ghost") {
      baseClasses +=
        "bg-gradient-to-br from-white to-gray-200 text-gray-700 border-dashed shadow-[0_0_15px_rgba(255,255,255,0.3)] dark:from-slate-700 dark:to-slate-800 dark:text-gray-200";
    } else if (tile.type === "tax") {
      baseClasses +=
        "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.4)]";
    }

    return baseClasses;
  };

  return (
    <Card
      {...handlers}
      className={`${getTileClasses()} select-none`}
      style={{ WebkitTouchCallout: "none" }}
    >
      {/* One consistent icon per special type (decorative; the panel text names it) */}
      {tile.type && tile.type !== "multiplier" && (
        <SpecialTileIcon type={tile.type} className="h-5 w-5 sm:h-6 sm:w-6" />
      )}

      {tile.type === "xfactor" && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 bg-white/80 ring-1 ring-black/20 rounded-full"></div>
          <div className="absolute top-1 right-1 w-2 h-2 bg-white/80 ring-1 ring-black/20 rounded-full"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-white/80 ring-1 ring-black/20 rounded-full"></div>
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-white/80 ring-1 ring-black/20 rounded-full"></div>
        </>
      )}

      {tile.type === "multiplier" && (
        <div className="flex flex-col items-center leading-none">
          <SpecialTileIcon type="multiplier" className="h-4 w-4" />
          {tile.value && <span className="text-xs font-bold">{tile.value}x</span>}
        </div>
      )}

      {/* Expiry turns indicator */}
      {tile.expiryTurns !== undefined && (
        <div className="absolute top-0.5 left-0.5 text-[10px] font-bold bg-black/30 text-white px-1 rounded-full min-w-[14px] text-center">
          {tile.expiryTurns}
        </div>
      )}
    </Card>
  );
}
