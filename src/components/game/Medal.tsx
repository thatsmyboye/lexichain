import { cn } from "@/lib/utils";
import bronzeSimple from "@/assets/medals/medal-bronze-simple.svg";
import silverSimple from "@/assets/medals/medal-silver-simple.svg";
import goldSimple from "@/assets/medals/medal-gold-simple.svg";
import platinumSimple from "@/assets/medals/medal-platinum-simple.svg";
import bronzeDetailed from "@/assets/medals/medal-bronze-detailed.svg";
import silverDetailed from "@/assets/medals/medal-silver-detailed.svg";
import goldDetailed from "@/assets/medals/medal-gold-detailed.svg";
import platinumDetailed from "@/assets/medals/medal-platinum-detailed.svg";
import unearned from "@/assets/medals/medal-unearned.svg";

export type MedalTier = "Bronze" | "Silver" | "Gold" | "Platinum";

// Each tier has its own outline (coin, shield, starburst, diamond), so the
// tiers stay distinct without color. The simple set is drawn for about 20px;
// the detailed set for 80px and up.
const SIMPLE: Record<MedalTier, string> = {
  Bronze: bronzeSimple,
  Silver: silverSimple,
  Gold: goldSimple,
  Platinum: platinumSimple,
};
const DETAILED: Record<MedalTier, string> = {
  Bronze: bronzeDetailed,
  Silver: silverDetailed,
  Gold: goldDetailed,
  Platinum: platinumDetailed,
};

interface MedalProps {
  tier: MedalTier;
  /** Use the detailed art. Leave off below about 40px. */
  detailed?: boolean;
  /** Sets the size, e.g. "h-5 w-5". */
  className?: string;
}

/**
 * A medal image. Decorative: always pair it with the tier's name in text.
 * Rendered as an <img> so the gradients inside each file cannot clash when
 * the same medal appears more than once on a page.
 */
export function Medal({ tier, detailed = false, className }: MedalProps) {
  return (
    <img
      src={(detailed ? DETAILED : SIMPLE)[tier]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block shrink-0 select-none", className)}
    />
  );
}

/**
 * An empty medal slot, for a graded run that ended below Bronze. Drawn for
 * about 80px; it is too fine to read at icon sizes.
 */
export function UnearnedMedal({ className }: { className?: string }) {
  return <img src={unearned} alt="" aria-hidden="true" draggable={false} className={cn("inline-block shrink-0 select-none", className)} />;
}
