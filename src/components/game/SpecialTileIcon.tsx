import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Biohazard,
  Bomb,
  Coins,
  FlipHorizontal2,
  Ghost,
  Link,
  Magnet,
  Mountain,
  Shuffle,
  Snowflake,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { SpecialTileType } from "@/types/game";
import { cn } from "@/lib/utils";

/**
 * One consistent line-icon per special tile type. Chosen to stay readable at
 * 12–16px, and always decorative: the tile's aria-label carries the meaning.
 */
const SPECIAL_TILE_ICONS: Record<NonNullable<SpecialTileType>, LucideIcon> = {
  stone: Mountain,
  wild: Sparkles,
  xfactor: X,
  multiplier: Zap,
  shuffle: Shuffle,
  freeze: Snowflake,
  decay: Biohazard,
  mirror: FlipHorizontal2,
  magnet: Magnet,
  bomb: Bomb,
  chain: Link,
  ghost: Ghost,
  tax: Coins,
};

interface SpecialTileIconProps extends Omit<LucideProps, "ref"> {
  type: NonNullable<SpecialTileType>;
}

export function SpecialTileIcon({ type, className, strokeWidth = 2.25, ...rest }: SpecialTileIconProps) {
  const Icon = SPECIAL_TILE_ICONS[type];
  if (!Icon) return null;
  return (
    <Icon
      {...rest}
      aria-hidden="true"
      focusable="false"
      strokeWidth={strokeWidth}
      className={cn("h-3.5 w-3.5 shrink-0", className)}
    />
  );
}
