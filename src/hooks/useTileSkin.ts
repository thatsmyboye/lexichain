import { useState, useEffect } from 'react';
import { TileSkinId, getTileSkin, TILE_SKINS } from '@/lib/tileSkins';

const STORAGE_KEY = 'lexichain-tile-skin';

export function useTileSkin() {
  const [skinId, setSkinId] = useState<TileSkinId>('original');

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in TILE_SKINS) {
      setSkinId(saved as TileSkinId);
    }
  }, []);

  // Save preference when changed
  const changeSkin = (newSkinId: TileSkinId) => {
    setSkinId(newSkinId);
    localStorage.setItem(STORAGE_KEY, newSkinId);
  };

  return {
    skinId,
    skin: getTileSkin(skinId),
    changeSkin
  };
}

