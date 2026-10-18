import { useEffect } from "react";
import { useTileSkin } from "@/hooks/useTileSkin";

/**
 * Mirrors the selected tile skin onto <html data-skin="..."> so index.css can
 * theme the whole screen: page background, brand accents (buttons, HUD), the
 * path color and the board frame. Neon also forces the dark palette.
 * Renders nothing; mount once near the app root.
 */
export function SkinThemeSync() {
  const { skinId, skin } = useTileSkin();
  const seasonal = Boolean(skin.season);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = skinId;
    if (seasonal) root.dataset.skinSeasonal = "true";
    else delete root.dataset.skinSeasonal;
    return () => {
      delete root.dataset.skin;
      delete root.dataset.skinSeasonal;
    };
  }, [skinId, seasonal]);

  return null;
}

export default SkinThemeSync;
