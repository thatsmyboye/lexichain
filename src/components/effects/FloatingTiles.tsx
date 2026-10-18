import React, { useEffect, useMemo, useState } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STORAGE_KEY = 'lexichain-floating-tiles';
/** Same-tab change notification; dispatched by Settings when the toggle changes. */
export const FLOATING_TILES_CHANGE_EVENT = 'lexichain-floating-tiles-change';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface FloatingTile {
  id: number;
  letter: string;
  size: number;
  left: number;
  duration: number;
  delay: number;
  rotation: number;
  spinDuration: number;
  opacity: number;
}

function generateTiles(count: number): FloatingTile[] {
  const tiles: FloatingTile[] = [];
  for (let i = 0; i < count; i++) {
    tiles.push({
      id: i,
      letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
      size: 28 + Math.random() * 24, // 28-52px
      left: Math.random() * 100,
      duration: 18 + Math.random() * 22, // 18-40s drift
      delay: -(Math.random() * 30), // stagger start
      rotation: Math.random() * 360,
      spinDuration: 8 + Math.random() * 16, // 8-24s spin
      opacity: 0.08 + Math.random() * 0.12, // subtle 0.08-0.20
    });
  }
  return tiles;
}

function readSettingEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * True when the floating tiles background should render: the user hasn't turned it
 * off in Settings and the OS/browser doesn't request reduced motion.
 */
export function useFloatingTilesEnabled(): boolean {
  const [settingEnabled, setSettingEnabled] = useState(readSettingEnabled);
  const [reducedMotion, setReducedMotion] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mql: MediaQueryList | null = null;
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia(REDUCED_MOTION_QUERY);
      setReducedMotion(mql.matches);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handleMotionChange);
      } else {
        mql.addListener(handleMotionChange);
      }
    }

    // Picks up changes made in another tab.
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) setSettingEnabled(readSettingEnabled());
    };
    const handleLocalChange = () => setSettingEnabled(readSettingEnabled());
    window.addEventListener('storage', handleStorage);
    window.addEventListener(FLOATING_TILES_CHANGE_EVENT, handleLocalChange);

    return () => {
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', handleMotionChange);
        } else {
          mql.removeListener(handleMotionChange);
        }
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(FLOATING_TILES_CHANGE_EVENT, handleLocalChange);
    };
  }, []);

  return settingEnabled && !reducedMotion;
}

export function FloatingTiles() {
  const enabled = useFloatingTilesEnabled();
  const tiles = useMemo(() => generateTiles(18), []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes float-drift {
          0% { transform: translateY(110vh) rotate(var(--start-rot)); }
          100% { transform: translateY(-10vh) rotate(calc(var(--start-rot) + 360deg)); }
        }
        @keyframes tile-spin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="absolute"
          style={{
            left: `${tile.left}%`,
            '--start-rot': `${tile.rotation}deg`,
            animation: `float-drift ${tile.duration}s linear ${tile.delay}s infinite`,
            opacity: tile.opacity,
          } as React.CSSProperties}
        >
          <div
            className="flex items-center justify-center rounded-lg border-2 border-primary/30 bg-card/60 font-bold text-primary/50 select-none backdrop-blur-[1px]"
            style={{
              width: tile.size,
              height: tile.size,
              fontSize: tile.size * 0.5,
              animation: `tile-spin ${tile.spinDuration}s linear infinite`,
            }}
          >
            {tile.letter}
          </div>
        </div>
      ))}
    </div>
  );
}
