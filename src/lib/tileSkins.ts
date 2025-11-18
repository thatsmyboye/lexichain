export type TileSkinId = 'original' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'neon';

export interface BenchmarkColors {
  bronze: { border: string; background: string };
  silver: { border: string; background: string };
  gold: { border: string; background: string };
  platinum: { border: string; background: string };
}

export interface TileSkin {
  id: TileSkinId;
  name: string;
  description: string;
  baseClasses: string;
  selectedClasses: string;
  reusedOverlay: string;
  benchmarkColors: BenchmarkColors;
}

export const TILE_SKINS: Record<TileSkinId, TileSkin> = {
  original: {
    id: 'original',
    name: 'Original',
    description: 'The classic Lexichain design',
    baseClasses: 'bg-card',
    selectedClasses: 'ring-2 ring-green-400 bg-green-50 shadow-[0_4px_12px_-4px_rgba(34,197,94,0.3)] scale-[0.98] dark:bg-green-950 dark:ring-green-500',
    reusedOverlay: 'bg-primary/20 dark:bg-primary/30',
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
    description: 'Deep blue ocean with aquatic colors',
    baseClasses: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950',
    selectedClasses: 'ring-2 ring-cyan-400 bg-cyan-50 shadow-[0_4px_12px_-4px_rgba(34,211,238,0.3)] scale-[0.98] dark:bg-cyan-950 dark:ring-cyan-500',
    reusedOverlay: 'bg-cyan-400/30 dark:bg-cyan-400/40',
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
    description: 'Natural greens and earth tones',
    baseClasses: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950',
    selectedClasses: 'ring-2 ring-emerald-400 bg-emerald-50 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.3)] scale-[0.98] dark:bg-emerald-950 dark:ring-emerald-500',
    reusedOverlay: 'bg-emerald-400/30 dark:bg-emerald-400/40',
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
    description: 'Warm oranges, reds, and pinks',
    baseClasses: 'bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950 dark:to-pink-950',
    selectedClasses: 'ring-2 ring-orange-400 bg-orange-50 shadow-[0_4px_12px_-4px_rgba(251,146,60,0.3)] scale-[0.98] dark:bg-orange-950 dark:ring-orange-500',
    reusedOverlay: 'bg-orange-400/30 dark:bg-orange-400/40',
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
    description: 'Dark purples and blues with starry accents',
    baseClasses: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950',
    selectedClasses: 'ring-2 ring-purple-400 bg-purple-50 shadow-[0_4px_12px_-4px_rgba(168,85,247,0.3)] scale-[0.98] dark:bg-purple-950 dark:ring-purple-500',
    reusedOverlay: 'bg-purple-400/30 dark:bg-purple-400/40',
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
    description: 'Bright neon colors with cyberpunk aesthetic',
    baseClasses: 'bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900',
    selectedClasses: 'ring-2 ring-cyan-400 bg-cyan-500/20 shadow-[0_4px_12px_-4px_rgba(34,211,238,0.5)] scale-[0.98] dark:bg-cyan-500/10 dark:ring-cyan-400',
    reusedOverlay: 'bg-cyan-400/40 dark:bg-cyan-400/50',
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
  }
};

export function getTileSkin(skinId: TileSkinId): TileSkin {
  return TILE_SKINS[skinId] || TILE_SKINS.original;
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

