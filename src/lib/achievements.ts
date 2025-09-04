export type AchievementId =
  | "wordArtisan"
  | "lengthMaster"
  | "epicWordsmith"
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
  | "clutch"
  | "streak3"
  | "streak7"
  | "streak14"
  | "streak30";

export type Achievement = { id: AchievementId; label: string; scoreBonus: number; rarity: "common" | "rare" | "epic" | "legendary" };

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  // NEW: Length-focused achievement system (replaces streak-based)
  wordArtisan: { id: "wordArtisan", label: "Word Artisan (3 words of 6+ letters)", scoreBonus: 20, rarity: "common" },
  lengthMaster: { id: "lengthMaster", label: "Length Master (5 words of 7+ letters)", scoreBonus: 50, rarity: "rare" },
  epicWordsmith: { id: "epicWordsmith", label: "Epic Wordsmith (3 words of 8+ letters)", scoreBonus: 120, rarity: "epic" },
  link2: { id: "link2", label: "Tight Link (2+ shared)", scoreBonus: 15, rarity: "common" },
  link3: { id: "link3", label: "Bound Together (3+ shared)", scoreBonus: 40, rarity: "rare" },
  link4: { id: "link4", label: "Perfect Interlock (4+ shared)", scoreBonus: 80, rarity: "epic" },
  long7: { id: "long7", label: "Longshot (7+)", scoreBonus: 45, rarity: "rare" },
  epic8: { id: "epic8", label: "Epic (8+)", scoreBonus: 100, rarity: "epic" },
  rare2: { id: "rare2", label: "Treasure Hunter (2+ ultra rare)", scoreBonus: 75, rarity: "epic" },
  wildWizard: { id: "wildWizard", label: "Wild Wizard", scoreBonus: 50, rarity: "rare" },
  combo3x: { id: "combo3x", label: "Combo Maker (3x+)", scoreBonus: 60, rarity: "rare" },
  chaos3: { id: "chaos3", label: "Chaos Conductor (3+ tiles)", scoreBonus: 55, rarity: "rare" },
  vowelStorm: { id: "vowelStorm", label: "Vowel Storm", scoreBonus: 65, rarity: "rare" },
  consonantCrunch: { id: "consonantCrunch", label: "Consonant Crunch", scoreBonus: 65, rarity: "rare" },
  cartographer10: { id: "cartographer10", label: "Cartographer (10 words)", scoreBonus: 80, rarity: "rare" },
  collector15: { id: "collector15", label: "Collector (15 words)", scoreBonus: 150, rarity: "epic" },
  completionist80: { id: "completionist80", label: "Completionist 80%", scoreBonus: 200, rarity: "epic" },
  completionist100: { id: "completionist100", label: "One With the Board (100%)", scoreBonus: 500, rarity: "legendary" },
  clutch: { id: "clutch", label: "Clutch Finish", scoreBonus: 180, rarity: "epic" },
  streak3: { id: "streak3", label: "Dedicated (3 days)", scoreBonus: 30, rarity: "common" },
  streak7: { id: "streak7", label: "Committed (7 days)", scoreBonus: 75, rarity: "rare" },
  streak14: { id: "streak14", label: "Devoted (14 days)", scoreBonus: 150, rarity: "epic" },
  streak30: { id: "streak30", label: "Legendary Streaker (30 days)", scoreBonus: 300, rarity: "legendary" }
};

export function vowelRatioOfWord(word: string) {
  const v = new Set(["a","e","i","o","u","y"]);
  let vc = 0;
  for (const ch of word) if (v.has(ch)) vc++;
  return word.length ? vc / word.length : 0;
}
