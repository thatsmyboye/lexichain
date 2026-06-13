// Border style/width, corner radius, and motion per special tile type so tiles
// stay distinguishable without color (color blindness, grayscale, high contrast).
export const SPECIAL_SHAPES: Record<string, string> = {
  default: "rounded-lg border-2",
  stone: "rounded-none border-4 border-double",
  wild: "rounded-lg border-2 border-dashed",
  multiplier: "rounded-lg border-2 animate-tile-pulse",
  freeze: "rounded-sm border-2 border-dotted ring-2 ring-inset ring-white/60",
  bomb: "rounded-full border-2 animate-tile-tick",
  xfactor: "rounded-lg border-4",
  ghost: "rounded-lg border-2 border-dashed animate-tile-fade",
};
