import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SpecialTileType } from "@/types/game";
import { FROZEN_TILE_INFO, SPECIAL_TILE_INFO } from "@/lib/specialTileInfo";
import { SpecialTileIcon } from "./SpecialTileIcon";

/** How long a touch must rest on a tile before its tooltip opens. */
export const LONG_PRESS_MS = 450;
/** Finger movement allowed during a press before it stops counting as a hold. */
export const LONG_PRESS_SLOP_PX = 10;

export interface TileTip {
  type: SpecialTileType;
  value?: number;
  expiryTurns?: number;
  frozen?: boolean;
  /** Shown for tiles in the Next Tile preview, which aren't on the board yet. */
  upcoming?: boolean;
  /** Screen rectangle of the pressed tile. */
  anchor: { top: number; bottom: number; left: number; width: number };
}

const WIDTH = 272;
const MARGIN = 12;

function turnsLabel(n: number) {
  return `${n} more word${n === 1 ? "" : "s"}`;
}

/**
 * Explains a special tile after a touch-and-hold. Purely informational: it
 * never captures input, and the next touch anywhere dismisses it.
 */
export function SpecialTileTooltip({ tip, onDismiss }: { tip: TileTip | null; onDismiss: () => void }) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!tip) return;
    const dismiss = () => dismissRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [tip]);

  if (!tip) return null;

  const info = tip.type ? SPECIAL_TILE_INFO[tip.type] : FROZEN_TILE_INFO;
  const iconType = tip.type ?? "freeze";
  const title = tip.type === "multiplier" && tip.value ? `${info.name} ${tip.value}×` : info.name;
  const detail = tip.type === "multiplier" && tip.value
    ? `Multiplies the score of the word that uses it by ${tip.value}.`
    : info.detail;

  const notes: string[] = [];
  if (tip.upcoming) notes.push("Lands on the board after your next word.");
  if (tip.type && tip.expiryTurns !== undefined) {
    notes.push(tip.upcoming
      ? `Lasts ${turnsLabel(tip.expiryTurns)} once it lands.`
      : `Disappears after ${turnsLabel(tip.expiryTurns)}.`);
  }
  if (tip.type && tip.frozen) notes.push("Frozen by a neighboring Freeze tile.");

  // Above the tile when there's room, otherwise below; always on screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - MARGIN * 2);
  const center = tip.anchor.left + tip.anchor.width / 2;
  const left = Math.max(MARGIN, Math.min(center - width / 2, vw - MARGIN - width));
  const placeAbove = tip.anchor.top > 150;
  const arrowLeft = Math.max(16, Math.min(center - left, width - 16));
  const position = placeAbove
    ? { bottom: vh - tip.anchor.top + 10 }
    : { top: tip.anchor.bottom + 10 };

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-special-tile-tooltip
      className="pointer-events-none fixed rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-150"
      // Above toasts (sonner stacks at 999999999): the player is holding
      // a tile to read this.
      style={{ left, width, zIndex: 1000000000, ...position }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
          <SpecialTileIcon type={iconType} className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="mt-1.5 text-sm leading-snug">{detail}</p>
      {notes.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">{notes.join(" ")}</p>
      )}
      <span
        aria-hidden="true"
        className={`absolute h-3 w-3 rotate-45 border bg-popover ${placeAbove ? "-bottom-1.5 border-l-0 border-t-0" : "-top-1.5 border-b-0 border-r-0"}`}
        style={{ left: arrowLeft - 6 }}
      />
    </div>,
    document.body,
  );
}
