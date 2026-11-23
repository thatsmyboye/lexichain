// Drawn art for Survival, from src/assets/survival/: power-ups, shop items,
// boss emblems, choice-event icons, risk pips, and the two dialog headers.
// Power-ups come in two forms: "simple" for the small HUD chips and
// "detailed" for the shop.
//
// Every power-up and shop item has an icon today. If a new one is added
// before its art exists, the components fall back to the emoji the caller
// passes; to give it an icon, import its files and add it to the maps below.
import type { BossType, EventType, PowerUpType, ShopItemType } from "@/lib/survivalMode";
import { cn } from "@/lib/utils";

import vitalLifeFull from "@/assets/survival/vital-life-full.svg";

import letterRevealSimple from "@/assets/survival/powerup-letter-reveal-simple.svg";
import boardRefreshSimple from "@/assets/survival/powerup-board-refresh-simple.svg";
import lifeLinkSimple from "@/assets/survival/powerup-life-link-simple.svg";
import comboBoostSimple from "@/assets/survival/powerup-combo-boost-simple.svg";
import wildcardTileSimple from "@/assets/survival/powerup-wildcard-tile-simple.svg";
import shieldSimple from "@/assets/survival/powerup-shield-simple.svg";
import extraLifeSimple from "@/assets/survival/powerup-extra-life-simple.svg";
import stoneCrusherSimple from "@/assets/survival/powerup-stone-crusher-simple.svg";
import safetyNetSimple from "@/assets/survival/powerup-safety-net-simple.svg";
import doublePointsSimple from "@/assets/survival/powerup-double-points-simple.svg";
import timeFreezeSimple from "@/assets/survival/powerup-time-freeze-simple.svg";

import letterRevealDetailed from "@/assets/survival/powerup-letter-reveal-detailed.svg";
import boardRefreshDetailed from "@/assets/survival/powerup-board-refresh-detailed.svg";
import lifeLinkDetailed from "@/assets/survival/powerup-life-link-detailed.svg";
import comboBoostDetailed from "@/assets/survival/powerup-combo-boost-detailed.svg";
import wildcardTileDetailed from "@/assets/survival/powerup-wildcard-tile-detailed.svg";
import shieldDetailed from "@/assets/survival/powerup-shield-detailed.svg";
import extraLifeDetailed from "@/assets/survival/powerup-extra-life-detailed.svg";
import stoneCrusherDetailed from "@/assets/survival/powerup-stone-crusher-detailed.svg";
import safetyNetDetailed from "@/assets/survival/powerup-safety-net-detailed.svg";
import doublePointsDetailed from "@/assets/survival/powerup-double-points-detailed.svg";
import timeFreezeDetailed from "@/assets/survival/powerup-time-freeze-detailed.svg";

import shopStoneEraser from "@/assets/survival/shop-stone-eraser-detailed.svg";
import shopRandomPowerUp from "@/assets/survival/shop-random-powerup-detailed.svg";
import shopRarePowerUp from "@/assets/survival/shop-rare-powerup-detailed.svg";
import shopCoin from "@/assets/survival/shop-coin.svg";

import bossWordLength from "@/assets/survival/boss-word-length-simple.svg";
import bossMultiWord from "@/assets/survival/boss-multi-word-simple.svg";
import bossPointThreshold from "@/assets/survival/boss-point-threshold-simple.svg";
import bossTimeTrial from "@/assets/survival/boss-time-trial-simple.svg";
import bossStoneGauntlet from "@/assets/survival/boss-stone-gauntlet-simple.svg";
import bossLetterLockout from "@/assets/survival/boss-letter-lockout-simple.svg";
import bossPerfectWave from "@/assets/survival/boss-perfect-wave-simple.svg";
import bossMegaWord from "@/assets/survival/boss-mega-word-simple.svg";

import eventMerchant from "@/assets/survival/event-merchant.svg";
import eventBlessing from "@/assets/survival/event-blessing.svg";
import eventCurse from "@/assets/survival/event-curse.svg";
import eventGambit from "@/assets/survival/event-gambit.svg";
import eventMystery from "@/assets/survival/event-mystery.svg";

import riskLow from "@/assets/survival/risk-low.svg";
import riskMedium from "@/assets/survival/risk-medium.svg";
import riskHigh from "@/assets/survival/risk-high.svg";

import headerShop from "@/assets/survival/header-shop.svg";
import headerEvent from "@/assets/survival/header-event.svg";

const POWERUP_SIMPLE_SRCS: Partial<Record<PowerUpType, string>> = {
  letter_reveal: letterRevealSimple,
  board_refresh: boardRefreshSimple,
  life_link: lifeLinkSimple,
  combo_boost: comboBoostSimple,
  wildcard_tile: wildcardTileSimple,
  shield: shieldSimple,
  extra_life: extraLifeSimple,
  stone_crusher: stoneCrusherSimple,
  safety_net: safetyNetSimple,
  double_points: doublePointsSimple,
  time_freeze: timeFreezeSimple,
};

const POWERUP_DETAILED_SRCS: Partial<Record<PowerUpType, string>> = {
  letter_reveal: letterRevealDetailed,
  board_refresh: boardRefreshDetailed,
  life_link: lifeLinkDetailed,
  combo_boost: comboBoostDetailed,
  wildcard_tile: wildcardTileDetailed,
  shield: shieldDetailed,
  extra_life: extraLifeDetailed,
  stone_crusher: stoneCrusherDetailed,
  safety_net: safetyNetDetailed,
  double_points: doublePointsDetailed,
  time_freeze: timeFreezeDetailed,
};

const SHOP_ITEM_SRCS: Partial<Record<ShopItemType, string>> = {
  extra_life: extraLifeDetailed,
  stone_eraser: shopStoneEraser,
  shield: shieldDetailed,
  wildcard_tile: wildcardTileDetailed,
  power_up_random: shopRandomPowerUp,
  power_up_rare: shopRarePowerUp,
  hint: letterRevealDetailed,
  time_freeze: timeFreezeDetailed,
  double_points: doublePointsDetailed,
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

// The small boss emblems, for the boss panel. Larger "-detailed" versions sit
// beside them in src/assets/survival/ but nothing draws them yet, so they are
// not imported here; see CLAUDE.md.
const BOSS_SRCS: Record<BossType, string> = {
  word_length: bossWordLength,
  multi_word: bossMultiWord,
  point_threshold: bossPointThreshold,
  time_trial: bossTimeTrial,
  stone_gauntlet: bossStoneGauntlet,
  letter_lockout: bossLetterLockout,
  perfect_wave: bossPerfectWave,
  mega_word: bossMegaWord,
};

const EVENT_SRCS: Record<EventType, string> = {
  merchant: eventMerchant,
  blessing: eventBlessing,
  curse: eventCurse,
  gambit: eventGambit,
  mystery: eventMystery,
};

const RISK_SRCS = {
  low: riskLow,
  medium: riskMedium,
  high: riskHigh,
} as const;

/** A boss's emblem, shown beside "BOSS WAVE!" in the boss panel. */
export function BossIcon({ type, className }: { type: BossType; className?: string }) {
  return (
    <img
      src={BOSS_SRCS[type]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-6 w-6 shrink-0 select-none", className)}
    />
  );
}

/** The icon for a choice event, shown beside its prompt. */
export function EventIcon({ type, className }: { type: EventType; className?: string }) {
  return (
    <img
      src={EVENT_SRCS[type]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-9 w-9 shrink-0 select-none", className)}
    />
  );
}

/** A risk marker. Each level has its own shape as well as its own color. */
export function RiskPipIcon({
  risk,
  className,
}: {
  risk: "low" | "medium" | "high";
  className?: string;
}) {
  return (
    <img
      src={RISK_SRCS[risk]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("inline-block h-3.5 w-3.5 shrink-0 select-none", className)}
    />
  );
}

/**
 * The banner across the top of the shop or choice-event dialog. Each image
 * has the same proportions as its dialog at full width (8:1 and 6:1), so it
 * shows whole on desktop. On narrower screens it keeps a 64px height and
 * trims its left and right ends, which hold only decoration.
 */
export function SurvivalModalHeader({
  kind,
  className,
}: {
  kind: "shop" | "event";
  className?: string;
}) {
  return (
    <img
      src={kind === "shop" ? headerShop : headerEvent}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "block h-auto min-h-[64px] w-full select-none object-cover",
        kind === "shop" ? "aspect-[8/1]" : "aspect-[6/1]",
        className,
      )}
    />
  );
}
