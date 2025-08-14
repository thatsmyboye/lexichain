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

export type Achievement = { id: AchievementId; label: string; scoreBonus: number; rarity: "common" | "rare" | "epic" | "legendary" };

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  streak3: { id: "streak3", label: "Streak 3", scoreBonus: 25, rarity: "common" },
  streak5: { id: "streak5", label: "Streak 5", scoreBonus: 50, rarity: "rare" },
  streak8: { id: "streak8", label: "Streak 8", scoreBonus: 100, rarity: "epic" },
  link2: { id: "link2", label: "Tight Link (2+ shared)", scoreBonus: 20, rarity: "common" },
  link3: { id: "link3", label: "Bound Together (3+ shared)", scoreBonus: 40, rarity: "rare" },
  link4: { id: "link4", label: "Perfect Interlock (4+ shared)", scoreBonus: 80, rarity: "epic" },
  long7: { id: "long7", label: "Longshot (7+)", scoreBonus: 35, rarity: "rare" },
  epic8: { id: "epic8", label: "Epic (8+)", scoreBonus: 75, rarity: "epic" },
  rare2: { id: "rare2", label: "Treasure Hunter (2+ ultra rare)", scoreBonus: 60, rarity: "epic" },
  wildWizard: { id: "wildWizard", label: "Wild Wizard", scoreBonus: 30, rarity: "rare" },
  combo3x: { id: "combo3x", label: "Combo Maker (3x+)", scoreBonus: 45, rarity: "rare" },
  chaos3: { id: "chaos3", label: "Chaos Conductor (3+ tiles)", scoreBonus: 40, rarity: "rare" },
  vowelStorm: { id: "vowelStorm", label: "Vowel Storm", scoreBonus: 50, rarity: "rare" },
  consonantCrunch: { id: "consonantCrunch", label: "Consonant Crunch", scoreBonus: 50, rarity: "rare" },
  cartographer10: { id: "cartographer10", label: "Cartographer (10 words)", scoreBonus: 75, rarity: "rare" },
  collector15: { id: "collector15", label: "Collector (15 words)", scoreBonus: 125, rarity: "epic" },
  completionist80: { id: "completionist80", label: "Completionist 80%", scoreBonus: 200, rarity: "epic" },
  completionist100: { id: "completionist100", label: "One With the Board (100%)", scoreBonus: 500, rarity: "legendary" },
  firstWin: { id: "firstWin", label: "First Win", scoreBonus: 100, rarity: "epic" },
  clutch: { id: "clutch", label: "Clutch Finish", scoreBonus: 150, rarity: "epic" }
};

export function vowelRatioOfWord(word: string) {
  const v = new Set(["a","e","i","o","u","y"]);
  let vc = 0;
  for (const ch of word) if (v.has(ch)) vc++;
  return word.length ? vc / word.length : 0;
}
