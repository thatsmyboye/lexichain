export type PermanentTileSkinId = 'original' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'neon';
export type SeasonalTileSkinId = 'harvest' | 'frost' | 'lunar' | 'bloom';
export type TileSkinId = PermanentTileSkinId | SeasonalTileSkinId;

export interface BenchmarkColors {
  bronze: { border: string; background: string };
  silver: { border: string; background: string };
  gold: { border: string; background: string };
  platinum: { border: string; background: string };
}

/** Inclusive month/day window (months are 1–12). May wrap the new year. */
export interface SkinSeason {
  start: { month: number; day: number };
  end: { month: number; day: number };
}

export interface TileSkin {
  id: TileSkinId;
  name: string;
  description: string;
  /** Tile fill + letter color (Tailwind). */
  baseClasses: string;
  selectedClasses: string;
  reusedOverlay: string;
  /** Translucent tint laid over tiles from the last word (no benchmark yet). */
  reusedTint: string;
  /**
   * Surface material drawn on a decorative layer above the fill: grain, noise,
   * gloss, glow. Defined in index.css ("Skin themes & textures").
   */
  textureClass: string;
  /** Tile fill is dark in both themes, so small markers need light colors. */
  darkSurface?: boolean;
  /** Limited-time skin: only selectable inside this window. */
  season?: SkinSeason;
  benchmarkColors: BenchmarkColors;
}

export const TILE_SKINS: Record<TileSkinId, TileSkin> = {
  original: {
    id: 'original',
    name: 'Original',
    description: 'The classic Lexichain design',
    baseClasses: 'bg-card',
    selectedClasses: 'ring-2 ring-green-400 bg-green-50 shadow-[0_4px_12px_-4px_rgba(34,197,94,0.3)] scale-[0.98] text-green-950 dark:bg-green-950 dark:ring-green-500 dark:text-green-50',
    reusedOverlay: 'bg-primary/20 dark:bg-primary/30',
    reusedTint: 'rgba(168, 85, 247, 0.2)',
    textureClass: 'tile-tex-card',
    benchmarkColors: {
      bronze: {
        border: 'border-amber-600',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      silver: {
        border: 'border-gray-400',
        background: 'bg-gray-300/80 dark:bg-gray-700/60'
      },
      gold: {
        border: 'border-yellow-400',
        background: 'bg-yellow-300/80 dark:bg-yellow-800/60'
      },
      platinum: {
        border: 'border-purple-400',
        background: 'bg-purple-300/80 dark:bg-purple-800/60'
      }
    }
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Depths',
    description: 'Sea glass tiles over a deep blue tide',
    // Glass: translucent fill so the frame's caustics blur through.
    baseClasses: 'bg-white/60 text-sky-950 backdrop-blur-[3px] dark:bg-sky-950/55 dark:text-sky-50',
    selectedClasses: 'ring-2 ring-cyan-400 bg-cyan-50 shadow-[0_4px_12px_-4px_rgba(34,211,238,0.3)] scale-[0.98] text-cyan-950 dark:bg-cyan-950 dark:ring-cyan-500 dark:text-cyan-50',
    reusedOverlay: 'bg-cyan-400/30 dark:bg-cyan-400/40',
    reusedTint: 'rgba(34, 211, 238, 0.3)',
    textureClass: 'tile-tex-glass',
    benchmarkColors: {
      bronze: {
        border: 'border-amber-500',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      silver: {
        border: 'border-slate-400',
        background: 'bg-slate-300/80 dark:bg-slate-700/60'
      },
      gold: {
        border: 'border-yellow-300',
        background: 'bg-yellow-300/80 dark:bg-yellow-800/60'
      },
      platinum: {
        border: 'border-cyan-400',
        background: 'bg-cyan-300/80 dark:bg-cyan-800/60'
      }
    }
  },
  forest: {
    id: 'forest',
    name: 'Forest Canopy',
    description: 'Carved wood tiles on a mossy board',
    baseClasses: 'bg-gradient-to-br from-[#f3e2c3] to-[#e0c393] text-[#3b2410] dark:from-[#4a3220] dark:to-[#362314] dark:text-[#fbefdc]',
    selectedClasses: 'ring-2 ring-emerald-400 bg-emerald-50 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.3)] scale-[0.98] text-emerald-950 dark:bg-emerald-950 dark:ring-emerald-500 dark:text-emerald-50',
    reusedOverlay: 'bg-emerald-400/30 dark:bg-emerald-400/40',
    reusedTint: 'rgba(52, 211, 153, 0.3)',
    textureClass: 'tile-tex-wood',
    benchmarkColors: {
      bronze: {
        border: 'border-orange-600',
        background: 'bg-orange-300/80 dark:bg-orange-800/60'
      },
      silver: {
        border: 'border-stone-400',
        background: 'bg-stone-300/80 dark:bg-stone-700/60'
      },
      gold: {
        border: 'border-lime-400',
        background: 'bg-lime-300/80 dark:bg-lime-800/60'
      },
      platinum: {
        border: 'border-emerald-400',
        background: 'bg-emerald-300/80 dark:bg-emerald-800/60'
      }
    }
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Glossy glazed ceramic in warm dusk tones',
    baseClasses: 'bg-gradient-to-br from-orange-50 to-rose-100 text-orange-950 dark:from-[#3d1c14] dark:to-[#4a1f2e] dark:text-orange-50',
    selectedClasses: 'ring-2 ring-orange-400 bg-orange-50 shadow-[0_4px_12px_-4px_rgba(251,146,60,0.3)] scale-[0.98] text-orange-950 dark:bg-orange-950 dark:ring-orange-500 dark:text-orange-50',
    reusedOverlay: 'bg-orange-400/30 dark:bg-orange-400/40',
    reusedTint: 'rgba(251, 146, 60, 0.3)',
    textureClass: 'tile-tex-ceramic',
    benchmarkColors: {
      bronze: {
        border: 'border-red-600',
        background: 'bg-red-300/80 dark:bg-red-800/60'
      },
      silver: {
        border: 'border-rose-400',
        background: 'bg-rose-300/80 dark:bg-rose-800/60'
      },
      gold: {
        border: 'border-amber-400',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      platinum: {
        border: 'border-pink-400',
        background: 'bg-pink-300/80 dark:bg-pink-800/60'
      }
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Sky',
    description: 'Speckled slate under a starry indigo sky',
    baseClasses: 'bg-gradient-to-br from-slate-200 to-indigo-200 text-indigo-950 dark:from-slate-800 dark:to-[#1e1b3a] dark:text-indigo-50',
    selectedClasses: 'ring-2 ring-purple-400 bg-purple-50 shadow-[0_4px_12px_-4px_rgba(168,85,247,0.3)] scale-[0.98] text-purple-950 dark:bg-purple-950 dark:ring-purple-500 dark:text-purple-50',
    reusedOverlay: 'bg-purple-400/30 dark:bg-purple-400/40',
    reusedTint: 'rgba(168, 85, 247, 0.3)',
    textureClass: 'tile-tex-slate',
    benchmarkColors: {
      bronze: {
        border: 'border-violet-600',
        background: 'bg-violet-300/80 dark:bg-violet-800/60'
      },
      silver: {
        border: 'border-indigo-400',
        background: 'bg-indigo-300/80 dark:bg-indigo-800/60'
      },
      gold: {
        border: 'border-yellow-300',
        background: 'bg-yellow-300/80 dark:bg-yellow-800/60'
      },
      platinum: {
        border: 'border-purple-400',
        background: 'bg-purple-300/80 dark:bg-purple-800/60'
      }
    }
  },
  neon: {
    id: 'neon',
    name: 'Neon Cyber',
    description: 'Dark acrylic with glowing edges. Always dark.',
    // Neon tiles (and the whole screen) are dark in both themes, so letters
    // carry their own light color instead of the card foreground.
    baseClasses: 'bg-gradient-to-br from-slate-900 to-slate-950 text-cyan-100',
    selectedClasses: 'ring-2 ring-cyan-400 bg-cyan-500/20 shadow-[0_4px_12px_-4px_rgba(34,211,238,0.5)] scale-[0.98] text-cyan-50 dark:bg-cyan-500/10 dark:ring-cyan-400',
    reusedOverlay: 'bg-cyan-400/40 dark:bg-cyan-400/50',
    reusedTint: 'rgba(34, 211, 238, 0.28)',
    textureClass: 'tile-tex-acrylic',
    darkSurface: true,
    benchmarkColors: {
      bronze: {
        border: 'border-cyan-500',
        background: 'bg-cyan-500/50 dark:bg-cyan-500/40'
      },
      silver: {
        border: 'border-blue-400',
        background: 'bg-blue-500/50 dark:bg-blue-500/40'
      },
      gold: {
        border: 'border-yellow-400',
        background: 'bg-yellow-500/50 dark:bg-yellow-500/40'
      },
      platinum: {
        border: 'border-pink-400',
        background: 'bg-pink-500/50 dark:bg-pink-500/40'
      }
    }
  },

  // ---- Seasonal / event sets (only offered inside their window) ----
  harvest: {
    id: 'harvest',
    name: 'Harvest Moon',
    description: 'Pumpkin parchment under an October moon',
    baseClasses: 'bg-gradient-to-br from-orange-100 to-amber-200 text-orange-950 dark:from-[#3a2412] dark:to-[#24170d] dark:text-orange-100',
    selectedClasses: 'ring-2 ring-orange-500 bg-orange-200 shadow-[0_4px_12px_-4px_rgba(249,115,22,0.4)] scale-[0.98] text-orange-950 dark:bg-orange-900 dark:ring-orange-400 dark:text-orange-50',
    reusedOverlay: 'bg-purple-500/25 dark:bg-purple-400/35',
    reusedTint: 'rgba(126, 34, 206, 0.22)',
    textureClass: 'tile-tex-parchment',
    season: { start: { month: 10, day: 1 }, end: { month: 10, day: 31 } },
    benchmarkColors: {
      bronze: {
        border: 'border-amber-700',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      silver: {
        border: 'border-stone-400',
        background: 'bg-stone-300/80 dark:bg-stone-700/60'
      },
      gold: {
        border: 'border-orange-400',
        background: 'bg-orange-300/80 dark:bg-orange-800/60'
      },
      platinum: {
        border: 'border-purple-500',
        background: 'bg-purple-300/80 dark:bg-purple-800/60'
      }
    }
  },
  frost: {
    id: 'frost',
    name: 'Frost Festival',
    description: 'Frosted ice tiles and holly-red trails',
    baseClasses: 'bg-gradient-to-br from-white to-sky-100 text-blue-950 dark:from-slate-800 dark:to-[#132a4a] dark:text-sky-50',
    selectedClasses: 'ring-2 ring-rose-500 bg-rose-50 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.35)] scale-[0.98] text-rose-950 dark:bg-rose-950 dark:ring-rose-400 dark:text-rose-50',
    reusedOverlay: 'bg-sky-400/30 dark:bg-sky-300/30',
    reusedTint: 'rgba(56, 189, 248, 0.28)',
    textureClass: 'tile-tex-ice',
    season: { start: { month: 12, day: 1 }, end: { month: 1, day: 6 } },
    benchmarkColors: {
      bronze: {
        border: 'border-rose-600',
        background: 'bg-rose-300/80 dark:bg-rose-800/60'
      },
      silver: {
        border: 'border-slate-400',
        background: 'bg-slate-300/80 dark:bg-slate-700/60'
      },
      gold: {
        border: 'border-amber-400',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      platinum: {
        border: 'border-sky-400',
        background: 'bg-sky-300/80 dark:bg-sky-800/60'
      }
    }
  },
  lunar: {
    id: 'lunar',
    name: 'Lunar New Year',
    description: 'Red lacquer tiles edged in gold',
    baseClasses: 'bg-gradient-to-br from-red-700 to-red-800 text-amber-100 dark:from-red-800 dark:to-red-950',
    selectedClasses: 'ring-2 ring-amber-400 bg-amber-100 shadow-[0_4px_12px_-4px_rgba(251,191,36,0.5)] scale-[0.98] text-red-900 dark:bg-amber-900 dark:ring-amber-400 dark:text-amber-50',
    reusedOverlay: 'bg-amber-400/30 dark:bg-amber-400/30',
    reusedTint: 'rgba(251, 191, 36, 0.22)',
    textureClass: 'tile-tex-lacquer',
    darkSurface: true,
    season: { start: { month: 1, day: 20 }, end: { month: 2, day: 20 } },
    benchmarkColors: {
      bronze: {
        border: 'border-amber-700',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      silver: {
        border: 'border-stone-300',
        background: 'bg-stone-300/80 dark:bg-stone-700/60'
      },
      gold: {
        border: 'border-amber-300',
        background: 'bg-amber-300/80 dark:bg-amber-800/60'
      },
      platinum: {
        border: 'border-rose-300',
        background: 'bg-rose-300/80 dark:bg-rose-800/60'
      }
    }
  },
  bloom: {
    id: 'bloom',
    name: 'Bloom',
    description: 'Pressed-petal paper for spring',
    baseClasses: 'bg-gradient-to-br from-pink-50 to-rose-100 text-rose-950 dark:from-[#3a1830] dark:to-[#2a1838] dark:text-pink-50',
    selectedClasses: 'ring-2 ring-lime-500 bg-lime-50 shadow-[0_4px_12px_-4px_rgba(132,204,22,0.4)] scale-[0.98] text-lime-950 dark:bg-lime-950 dark:ring-lime-400 dark:text-lime-50',
    reusedOverlay: 'bg-pink-400/30 dark:bg-pink-400/35',
    reusedTint: 'rgba(236, 72, 153, 0.22)',
    textureClass: 'tile-tex-petal',
    season: { start: { month: 3, day: 20 }, end: { month: 4, day: 30 } },
    benchmarkColors: {
      bronze: {
        border: 'border-orange-500',
        background: 'bg-orange-300/80 dark:bg-orange-800/60'
      },
      silver: {
        border: 'border-stone-400',
        background: 'bg-stone-300/80 dark:bg-stone-700/60'
      },
      gold: {
        border: 'border-yellow-400',
        background: 'bg-yellow-300/80 dark:bg-yellow-800/60'
      },
      platinum: {
        border: 'border-fuchsia-400',
        background: 'bg-fuchsia-300/80 dark:bg-fuchsia-800/60'
      }
    }
  }
};

const monthDay = (m: number, d: number) => m * 100 + d;

/** True when a seasonal skin's window includes `date` (permanent skins always are). */
export function isSkinInSeason(skin: TileSkin, date: Date = new Date()): boolean {
  if (!skin.season) return true;
  const today = monthDay(date.getMonth() + 1, date.getDate());
  const start = monthDay(skin.season.start.month, skin.season.start.day);
  const end = monthDay(skin.season.end.month, skin.season.end.day);
  return start <= end
    ? today >= start && today <= end
    // Window wraps the new year (e.g. Dec 1 – Jan 6)
    : today >= start || today <= end;
}

/** Last day of the current window for an in-season seasonal skin, else null. */
export function getSeasonEnd(skin: TileSkin, date: Date = new Date()): Date | null {
  if (!skin.season || !isSkinInSeason(skin, date)) return null;
  const { start, end } = skin.season;
  const wraps = monthDay(start.month, start.day) > monthDay(end.month, end.day);
  const today = monthDay(date.getMonth() + 1, date.getDate());
  const year = wraps && today >= monthDay(start.month, start.day)
    ? date.getFullYear() + 1
    : date.getFullYear();
  return new Date(year, end.month - 1, end.day);
}

/** Permanent skins plus any seasonal ones whose window includes `date`. */
export function getAvailableSkins(date: Date = new Date()): TileSkin[] {
  return Object.values(TILE_SKINS).filter((skin) => isSkinInSeason(skin, date));
}

export function isTileSkinId(value: unknown): value is TileSkinId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TILE_SKINS, value);
}

/**
 * Resolve a (possibly stored) skin id. Unknown ids and seasonal skins that are
 * out of season fall back to Original.
 */
export function getTileSkin(skinId: TileSkinId | string | null | undefined, date: Date = new Date()): TileSkin {
  if (!isTileSkinId(skinId)) return TILE_SKINS.original;
  const skin = TILE_SKINS[skinId];
  return isSkinInSeason(skin, date) ? skin : TILE_SKINS.original;
}

export function getBenchmarkColor(
  skin: TileSkin,
  grade: 'bronze' | 'silver' | 'gold' | 'platinum' | 'none'
): { border: string; background: string } {
  if (grade === 'none') {
    return { border: 'border-border', background: skin.reusedOverlay };
  }
  return skin.benchmarkColors[grade];
}
