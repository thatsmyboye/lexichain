// Font-size preference applied by scaling the root font size.
// Tailwind spacing/typography are rem-based, so this scales the whole UI
// consistently for accessibility.

export type FontSize = "small" | "medium" | "large" | "extra-large";

const STORAGE_KEY = "lexichain-font-size";

const ROOT_PX: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  "extra-large": "20px",
};

export function getFontSize(): FontSize {
  const stored = localStorage.getItem(STORAGE_KEY) as FontSize | null;
  return stored && stored in ROOT_PX ? stored : "medium";
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.style.fontSize = ROOT_PX[size];
}

export function setFontSize(size: FontSize): void {
  localStorage.setItem(STORAGE_KEY, size);
  applyFontSize(size);
}
