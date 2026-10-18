// Lifetime achievement ("trophy") tracking. Achievements are earned per game;
// this remembers every one a player has ever unlocked, for the trophy case.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";

export interface TrophyRecord {
  unlockedAt: string; // ISO timestamp of the first unlock
  count: number;      // games in which it was earned
}

const KEY = "lexichain-trophies";
export const TROPHIES_EVENT = "lexichain:trophies";

// What each achievement asks of the player, for locked trophies
export const TROPHY_HINTS: Record<AchievementId, string> = {
  wordArtisan: "Play 3 words of 6+ letters in one game",
  lengthMaster: "Play 5 words of 7+ letters in one game",
  epicWordsmith: "Play 3 words of 8+ letters in one game",
  link2: "Reuse 2 tiles from your previous word",
  link3: "Reuse 3 tiles from your previous word",
  link4: "Reuse 4 tiles from your previous word",
  long7: "Play a word of 7+ letters",
  epic8: "Play a word of 8+ letters",
  rare2: "Use 2 of J, Q, X, Z in one word",
  wildWizard: "Complete a word with a Wild tile",
  combo3x: "Score a word with a 3x+ multiplier",
  chaos3: "Transform 3+ tiles with one X-Factor",
  vowelStorm: "Play a 6+ letter word that's 60%+ vowels",
  consonantCrunch: "Play a 6+ letter word that's 80%+ consonants",
  cartographer10: "Play 10 words in one game",
  collector15: "Play 15 words in one game",
  completionist80: "Find 80% of a board's words",
  completionist100: "Find every word on a board",
  clutch: "Reach a new medal tier with your final word",
  streak3: "Log in 3 days in a row",
  streak7: "Log in 7 days in a row",
  streak14: "Log in 14 days in a row",
  streak30: "Log in 30 days in a row",
};

export function getTrophies(): Partial<Record<AchievementId, TrophyRecord>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function save(trophies: Partial<Record<AchievementId, TrophyRecord>>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(trophies));
  } catch {
    // Non-critical
  }
  window.dispatchEvent(new Event(TROPHIES_EVENT));
}

// Records achievements earned in a game. Returns the ones that are new for
// this player's lifetime collection (first-ever unlocks).
export function recordTrophies(ids: string[]): AchievementId[] {
  const trophies = getTrophies();
  const firsts: AchievementId[] = [];
  const now = new Date().toISOString();
  for (const raw of ids) {
    if (!(raw in ACHIEVEMENTS)) continue;
    const id = raw as AchievementId;
    const existing = trophies[id];
    if (existing) {
      trophies[id] = { ...existing, count: existing.count + 1 };
    } else {
      trophies[id] = { unlockedAt: now, count: 1 };
      firsts.push(id);
    }
  }
  if (ids.length) save(trophies);
  return firsts;
}

// Adds trophies the player has earned outside a game (e.g. login streaks)
// without bumping counts for ones they already have.
export function ensureTrophies(ids: AchievementId[]) {
  const trophies = getTrophies();
  const missing = ids.filter(id => !trophies[id]);
  if (!missing.length) return;
  const now = new Date().toISOString();
  for (const id of missing) trophies[id] = { unlockedAt: now, count: 1 };
  save(trophies);
}

// Merge achievements saved with past results (signed-in players)
export async function syncRemoteTrophies(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("standard_game_results")
      .select("achievements_unlocked, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!data?.length) return;
    const trophies = getTrophies();
    let changed = false;
    for (const row of data) {
      for (const raw of row.achievements_unlocked ?? []) {
        if (!(raw in ACHIEVEMENTS)) continue;
        const id = raw as AchievementId;
        if (!trophies[id]) {
          trophies[id] = { unlockedAt: row.created_at, count: 1 };
          changed = true;
        }
      }
    }
    if (changed) save(trophies);
  } catch (err) {
    console.warn("Could not sync trophies:", err);
  }
  try {
    const { data: streak } = await supabase
      .from("daily_login_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle();
    // Only the current streak is stored, so award what it has reached
    const longest = streak?.current_streak ?? 0;
    const earned = ([[3, "streak3"], [7, "streak7"], [14, "streak14"], [30, "streak30"]] as const)
      .filter(([days]) => longest >= days)
      .map(([, id]) => id as AchievementId);
    ensureTrophies(earned);
  } catch (err) {
    console.warn("Could not sync streak trophies:", err);
  }
}

export function useTrophies() {
  const [trophies, setTrophies] = useState(getTrophies);
  useEffect(() => {
    const update = () => setTrophies(getTrophies());
    window.addEventListener(TROPHIES_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(TROPHIES_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return trophies;
}
