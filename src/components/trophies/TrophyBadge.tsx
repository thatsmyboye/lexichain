import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement, AchievementId } from "@/lib/achievements";
import frameCommon from "@/assets/trophies/frames/frame-common.svg";
import frameRare from "@/assets/trophies/frames/frame-rare.svg";
import frameEpic from "@/assets/trophies/frames/frame-epic.svg";
import frameLegendary from "@/assets/trophies/frames/frame-legendary.svg";

type Rarity = Achievement["rarity"];

// Each rarity has its own outline (octagon, hexagon, lugged octagon,
// starburst), so the tiers stay distinct without color.
const FRAMES: Record<Rarity, string> = {
  common: frameCommon,
  rare: frameRare,
  epic: frameEpic,
  legendary: frameLegendary,
};

// One emblem per achievement, in a file named by the achievement's ID. A new
// emblem is picked up by adding its file; no list here needs updating.
const EMBLEMS: Partial<Record<AchievementId, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("@/assets/trophies/emblems/*.svg", { eager: true, import: "default" }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".svg".length), url]),
);

interface TrophyBadgeProps {
  id: AchievementId;
  rarity: Rarity;
  unlocked: boolean;
  /** Sets the size, e.g. "h-16 w-16". The art is drawn for 64px and up. */
  className?: string;
}

/**
 * A trophy: its rarity frame with the achievement's emblem in the well.
 * Locked trophies show a padlock instead, so the emblem stays a surprise.
 * Decorative: always pair it with the trophy's name in text.
 *
 * Frames and emblems share one 256 x 256 space and are stacked as two <img>
 * elements, so the gradients inside each file cannot clash across trophies.
 */
export function TrophyBadge({ id, rarity, unlocked, className }: TrophyBadgeProps) {
  const emblem = EMBLEMS[id];
  const layer = "absolute inset-0 h-full w-full";
  return (
    <span aria-hidden="true" className={cn("relative inline-block shrink-0 select-none", className)}>
      <img
        src={FRAMES[rarity]}
        alt=""
        draggable={false}
        className={cn("block h-full w-full", unlocked ? "drop-shadow-md" : "opacity-80 grayscale")}
      />
      {!unlocked ? (
        <Lock className="absolute inset-0 m-auto h-[30%] w-[30%] text-white/85" />
      ) : emblem ? (
        <img src={emblem} alt="" draggable={false} className={layer} />
      ) : (
        // Stand-in until this trophy's emblem is drawn
        <Sparkles className="absolute inset-0 m-auto h-[34%] w-[34%] text-white/90" />
      )}
    </span>
  );
}
