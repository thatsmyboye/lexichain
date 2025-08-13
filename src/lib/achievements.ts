export type AchievementId =
  | "streak3"
  | "streak5"
  | "streak8"
  | "link2"
  | "link3"
  | "link4"
  | "long7"
  | "epic8"
  | "rare2"
  | "wildWizard"
  | "combo3x"
  | "chaos3"
  | "vowelStorm"
  | "consonantCrunch"
  | "cartographer10"
  | "collector15"
  | "completionist80"
  | "completionist100"
  | "firstWin"
  | "clutch";

export type Achievement = { id: AchievementId; label: string };

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  streak3: { id: "streak3", label: "Streak 3" },
  streak5: { id: "streak5", label: "Streak 5" },
  streak8: { id: "streak8", label: "Streak 8" },
  link2: { id: "link2", label: "Tight Link (2+ shared)" },
  link3: { id: "link3", label: "Bound Together (3+ shared)" },
  link4: { id: "link4", label: "Perfect Interlock (4+ shared)" },
  long7: { id: "long7", label: "Longshot (7+)" },
  epic8: { id: "epic8", label: "Epic (8+)" },
  rare2: { id: "rare2", label: "Treasure Hunter (2+ ultra rare)" },
  wildWizard: { id: "wildWizard", label: "Wild Wizard" },
  combo3x: { id: "combo3x", label: "Combo Maker (3x+)" },
  chaos3: { id: "chaos3", label: "Chaos Conductor (3+ tiles)" },
  vowelStorm: { id: "vowelStorm", label: "Vowel Storm" },
  consonantCrunch: { id: "consonantCrunch", label: "Consonant Crunch" },
  cartographer10: { id: "cartographer10", label: "Cartographer (10 words)" },
  collector15: { id: "collector15", label: "Collector (15 words)" },
  completionist80: { id: "completionist80", label: "Completionist 80%" },
  completionist100: { id: "completionist100", label: "One With the Board (100%)" },
  firstWin: { id: "firstWin", label: "First Win" },
  clutch: { id: "clutch", label: "Clutch Finish" }
};

export function vowelRatioOfWord(word: string) {
  const v = new Set(["a","e","i","o","u","y"]);
  let vc = 0;
  for (const ch of word) if (v.has(ch)) vc++;
  return word.length ? vc / word.length : 0;
}
