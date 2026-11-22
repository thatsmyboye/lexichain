import { cn } from "@/lib/utils";

/**
 * X-Factor corner pointers: four arrowheads aimed at the diagonal neighbours
 * the tile rerolls. Shared by the board tile, How to Play, and the Next Tile
 * preview so the three always match.
 */
export function XFactorPointers({ sizeClass = "h-2.5 w-2.5", insetClass = "1" }: { sizeClass?: string; insetClass?: "0.5" | "1" }) {
  const pos = insetClass === "0.5"
    ? ["top-0.5 left-0.5", "top-0.5 right-0.5", "bottom-0.5 left-0.5", "bottom-0.5 right-0.5"]
    : ["top-1 left-1", "top-1 right-1", "bottom-1 left-1", "bottom-1 right-1"];

  const cls = cn("absolute drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]", sizeClass);

  return (
    <span aria-hidden="true" className="pointer-events-none">
      <svg viewBox="0 0 8 8" className={cn(cls, pos[0])}><polygon points="0.5,0.5 7.5,2 2,7.5" fill="rgba(255,255,255,0.92)" /></svg>
      <svg viewBox="0 0 8 8" className={cn(cls, pos[1])}><polygon points="7.5,0.5 6,7.5 0.5,2" fill="rgba(255,255,255,0.92)" /></svg>
      <svg viewBox="0 0 8 8" className={cn(cls, pos[2])}><polygon points="0.5,7.5 2,0.5 7.5,6" fill="rgba(255,255,255,0.92)" /></svg>
      <svg viewBox="0 0 8 8" className={cn(cls, pos[3])}><polygon points="7.5,7.5 0.5,6 6,0.5" fill="rgba(255,255,255,0.92)" /></svg>
    </span>
  );
}

const MAX_EXPIRY_TURNS = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * 7.8;

/**
 * Expiry ring: a countdown badge whose arc empties as a tile's remaining turns
 * run out. The arc and number turn amber on the last turn.
 */
export function ExpiryRing({ turns, className }: { turns: number; className?: string }) {
  const ratio = Math.max(0, Math.min(1, turns / MAX_EXPIRY_TURNS));
  const urgent = turns <= 1;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1 left-1 z-10 flex h-[18px] w-[18px] items-center justify-center",
        className,
      )}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
        {/* Dark backing disc */}
        <circle cx="10" cy="10" r="9" fill="rgba(7,15,32,0.82)" />
        {/* Depleted track ring */}
        <circle cx="10" cy="10" r="7.8" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        {/* Active remaining-turns arc */}
        <circle
          cx="10"
          cy="10"
          r="7.8"
          fill="none"
          stroke={urgent ? "#facc15" : "#ffffff"}
          strokeWidth="2.1"
          strokeDasharray={`${(ratio * RING_CIRCUMFERENCE).toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
          strokeLinecap="butt"
        />
      </svg>
      <span
        className={cn(
          "relative font-display-num text-[10px] font-bold leading-none",
          urgent ? "text-yellow-300" : "text-white",
        )}
      >
        {turns}
      </span>
    </span>
  );
}
