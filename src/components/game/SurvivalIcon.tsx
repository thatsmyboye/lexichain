// Drawn icons for Survival power-ups and shop items, from src/assets/survival/.
// Power-ups come in two forms: "simple" for the small HUD chips and
// "detailed" for the shop.
//
// Four power-ups have no drawn icon yet (Stone Crusher, Safety Net, Double
// Points and Time Freeze are being redrawn). For those, the components fall
// back to the emoji the caller passes, which is what was shown before. To add
// one, import its files and add it to the maps below.
import type { PowerUpType, ShopItemType } from "@/lib/survivalMode";
import { cn } from "@/lib/utils";

import vitalLifeFull from "@/assets/survival/vital-life-full.svg";

import letterRevealSimple from "@/assets/survival/powerup-letter-reveal-simple.svg";
import boardRefreshSimple from "@/assets/survival/powerup-board-refresh-simple.svg";
import lifeLinkSimple from "@/assets/survival/powerup-life-link-simple.svg";
import comboBoostSimple from "@/assets/survival/powerup-combo-boost-simple.svg";
import wildcardTileSimple from "@/assets/survival/powerup-wildcard-tile-simple.svg";
import shieldSimple from "@/assets/survival/powerup-shield-simple.svg";
import extraLifeSimple from "@/assets/survival/powerup-extra-life-simple.svg";

import letterRevealDetailed from "@/assets/survival/powerup-letter-reveal-detailed.svg";
import boardRefreshDetailed from "@/assets/survival/powerup-board-refresh-detailed.svg";
import lifeLinkDetailed from "@/assets/survival/powerup-life-link-detailed.svg";
import comboBoostDetailed from "@/assets/survival/powerup-combo-boost-detailed.svg";
import wildcardTileDetailed from "@/assets/survival/powerup-wildcard-tile-detailed.svg";
import shieldDetailed from "@/assets/survival/powerup-shield-detailed.svg";
import extraLifeDetailed from "@/assets/survival/powerup-extra-life-detailed.svg";

import shopStoneEraser from "@/assets/survival/shop-stone-eraser-detailed.svg";
import shopRandomPowerUp from "@/assets/survival/shop-random-powerup-detailed.svg";
import shopRarePowerUp from "@/assets/survival/shop-rare-powerup-detailed.svg";
import shopCoin from "@/assets/survival/shop-coin.svg";

const POWERUP_SIMPLE_SRCS: Partial<Record<PowerUpType, string>> = {
  letter_reveal: letterRevealSimple,
  board_refresh: boardRefreshSimple,
  life_link: lifeLinkSimple,
  combo_boost: comboBoostSimple,
  wildcard_tile: wildcardTileSimple,
  shield: shieldSimple,
  extra_life: extraLifeSimple,
};

const POWERUP_DETAILED_SRCS: Partial<Record<PowerUpType, string>> = {
  letter_reveal: letterRevealDetailed,
  board_refresh: boardRefreshDetailed,
  life_link: lifeLinkDetailed,
  combo_boost: comboBoostDetailed,
  wildcard_tile: wildcardTileDetailed,
  shield: shieldDetailed,
  extra_life: extraLifeDetailed,
};

const SHOP_ITEM_SRCS: Partial<Record<ShopItemType, string>> = {
  extra_life: extraLifeDetailed,
  stone_eraser: shopStoneEraser,
  shield: shieldDetailed,
  wildcard_tile: wildcardTileDetailed,
  power_up_random: shopRandomPowerUp,
  power_up_rare: shopRarePowerUp,
  hint: letterRevealDetailed,
};

/** A power-up's icon for the HUD chips, or its emoji if it has no icon yet. */
export function PowerUpIcon({
  type,
  variant = "simple",
  fallback,
  className,
}: {
  type: PowerUpType;
  variant?: "simple" | "detailed";
  /** Emoji shown when this power-up has no drawn icon yet. */
  fallback: string;
  className?: string;
}) {
  const src = variant === "detailed" ? POWERUP_DETAILED_SRCS[type] : POWERUP_SIMPLE_SRCS[type];
  if (!src) return <span aria-hidden="true">{fallback}</span>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "inline-block shrink-0 select-none",
        variant === "detailed" ? "h-8 w-8" : "h-3.5 w-3.5",
        className,
      )}
    />
  );
}

/** A shop item's icon, or its emoji if it has no icon yet. */
export function ShopItemIcon({
  type,
  fallback,
  className,
}: {
  type: ShopItemType;
  /** Emoji shown when this item has no drawn icon yet. */
  fallback: string;
  className?: string;
}) {
  const src = SHOP_ITEM_SRCS[type];
  // Same box as the drawn icons, so the text beside it lines up in every row
  if (!src) {
    return (
      <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center text-3xl leading-none">
        {fallback}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-8 w-8 shrink-0 select-none", className)}
    />
  );
}

/** The coin shown beside a price in points. */
export function ShopCoinIcon({ className }: { className?: string }) {
  return (
    <img
      src={shopCoin}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-4 w-4 shrink-0 select-none", className)}
    />
  );
}

/** The heart shown beside a price in lives. */
export function ShopLifeIcon({ className }: { className?: string }) {
  return (
    <img
      src={vitalLifeFull}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-4 w-4 shrink-0 select-none", className)}
    />
  );
}
