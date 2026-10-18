import { useCallback, useSyncExternalStore } from 'react';
import { TileSkinId, getTileSkin, isTileSkinId } from '@/lib/tileSkins';

const STORAGE_KEY = 'lexichain-tile-skin';

// Module-level store so every useTileSkin() caller (Settings, the board, the
// screen theme) sees a change the moment it happens.
let storedSkinId: TileSkinId | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): TileSkinId {
  if (!loaded) {
    loaded = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isTileSkinId(saved)) storedSkinId = saved;
    } catch {
      // Storage unavailable (private mode, blocked): keep the default.
    }
  }
  return storedSkinId ?? 'original';
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

// Keep other tabs in sync too.
function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  storedSkinId = isTileSkinId(e.newValue) ? e.newValue : null;
  loaded = true;
  emit();
}

export function setTileSkin(newSkinId: TileSkinId) {
  storedSkinId = newSkinId;
  loaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, newSkinId);
  } catch {
    // Non-persistent this session; still applies in memory.
  }
  emit();
}

export function useTileSkin() {
  const stored = useSyncExternalStore(subscribe, readStored, () => 'original' as TileSkinId);
  // Resolves out-of-season seasonal skins (and unknown ids) to Original.
  const skin = getTileSkin(stored);

  const changeSkin = useCallback((newSkinId: TileSkinId) => setTileSkin(newSkinId), []);

  return {
    skinId: skin.id,
    skin,
    changeSkin
  };
}
