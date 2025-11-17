# Tile Grid Reskinning Plan

## Overview
This document outlines the plan for implementing a tile grid reskinning system that allows users to customize the visual appearance of game tiles, including color changes based on score benchmarks.

## Implementation Strategy

### Option 1: Settings Screen (Recommended)
- **Location**: Add to existing `GameSettings.tsx` Appearance tab
- **Pros**: Centralized settings, consistent with other preferences
- **Cons**: Requires navigating to settings

### Option 2: Quick Access Button
- **Location**: Add button to game mode selection screens or in-game UI
- **Pros**: Quick access during gameplay
- **Cons**: May clutter UI, less discoverable

### Recommended Approach: Hybrid
- Primary: Settings screen (Appearance tab)
- Secondary: Optional quick access button in game mode selection (can be added later)

## Skin Definitions

### 1. Original (Default)
- **Base Colors**: Current implementation
- **Bronze**: `border-amber-600`, `bg-amber-100 dark:bg-amber-950/30`
- **Silver**: `border-gray-400`, `bg-gray-100 dark:bg-gray-950/30`
- **Gold**: `border-yellow-400`, `bg-yellow-100 dark:bg-yellow-950/30`
- **Platinum**: `border-purple-400`, `bg-purple-100 dark:bg-purple-950/30`

### 2. Ocean Depths
- **Theme**: Deep blue ocean with aquatic colors
- **Base**: `bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950`
- **Bronze**: `border-amber-500`, `bg-amber-100/50 dark:bg-amber-900/20`
- **Silver**: `border-slate-400`, `bg-slate-100/50 dark:bg-slate-900/20`
- **Gold**: `border-yellow-300`, `bg-yellow-100/50 dark:bg-yellow-900/20`
- **Platinum**: `border-cyan-400`, `bg-cyan-100/50 dark:bg-cyan-900/20`

### 3. Forest Canopy
- **Theme**: Natural greens and earth tones
- **Base**: `bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950`
- **Bronze**: `border-orange-600`, `bg-orange-100/50 dark:bg-orange-900/20`
- **Silver**: `border-stone-400`, `bg-stone-100/50 dark:bg-stone-900/20`
- **Gold**: `border-lime-400`, `bg-lime-100/50 dark:bg-lime-900/20`
- **Platinum**: `border-emerald-400`, `bg-emerald-100/50 dark:bg-emerald-900/20`

### 4. Sunset Glow
- **Theme**: Warm oranges, reds, and pinks
- **Base**: `bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950 dark:to-pink-950`
- **Bronze**: `border-red-600`, `bg-red-100/50 dark:bg-red-900/20`
- **Silver**: `border-rose-400`, `bg-rose-100/50 dark:bg-rose-900/20`
- **Gold**: `border-amber-400`, `bg-amber-100/50 dark:bg-amber-900/20`
- **Platinum**: `border-pink-400`, `bg-pink-100/50 dark:bg-pink-900/20`

### 5. Midnight Sky
- **Theme**: Dark purples and blues with starry accents
- **Base**: `bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950`
- **Bronze**: `border-violet-600`, `bg-violet-100/50 dark:bg-violet-900/20`
- **Silver**: `border-indigo-400`, `bg-indigo-100/50 dark:bg-indigo-900/20`
- **Gold**: `border-yellow-300`, `bg-yellow-100/50 dark:bg-yellow-900/20` (stars)
- **Platinum**: `border-purple-400`, `bg-purple-100/50 dark:bg-purple-900/20`

### 6. Neon Cyber
- **Theme**: Bright neon colors with cyberpunk aesthetic
- **Base**: `bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900`
- **Bronze**: `border-cyan-500`, `bg-cyan-500/20 dark:bg-cyan-500/10`
- **Silver**: `border-blue-400`, `bg-blue-500/20 dark:bg-blue-500/10`
- **Gold**: `border-yellow-400`, `bg-yellow-500/20 dark:bg-yellow-500/10`
- **Platinum**: `border-pink-400`, `bg-pink-500/20 dark:bg-pink-500/10`

## Technical Implementation

### 1. Skin Configuration Type
```typescript
type TileSkinId = 'original' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'neon';

interface BenchmarkColors {
  bronze: { border: string; background: string };
  silver: { border: string; background: string };
  gold: { border: string; background: string };
  platinum: { border: string; background: string };
}

interface TileSkin {
  id: TileSkinId;
  name: string;
  description: string;
  baseClasses: string;
  selectedClasses: string;
  benchmarkColors: BenchmarkColors;
}
```

### 2. Storage
- Use localStorage key: `lexichain-tile-skin`
- Default: `'original'`
- Persist across sessions

### 3. Integration Points
- `WordPathGame.tsx`: Update `getTileClasses()` function
- `GameSettings.tsx`: Add skin selector to Appearance tab
- Create `useTileSkin` hook for state management

### 4. UI Components
- Skin preview cards with visual examples
- Radio button or card-based selection
- Live preview if possible

## File Structure
```
src/
  hooks/
    useTileSkin.ts          # Hook for managing tile skin state
  lib/
    tileSkins.ts            # Skin definitions and configurations
  components/
    settings/
      TileSkinSelector.tsx  # UI component for selecting skins
```

## Future Enhancements
- Unlockable skins (via achievements, store purchases, level progression)
- Custom skin creator
- Animated skins
- Seasonal/limited-time skins

