// Per-mode personal bests and "modes played", kept in localStorage so they
// work for guests, and merged with saved results for signed-in players.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PersonalBest {
  score: number;
  words: number;
  longestWord: string;
  grade: string;
  date: string; // ISO timestamp
}

const BESTS_KEY = "lexichain-personal-bests";
const PLAYED_KEY = "lexichain-modes-played";
export const PERSONAL_BESTS_EVENT = "lexichain:personal-bests";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: bests are a convenience, not critical
  }
  window.dispatchEvent(new Event(PERSONAL_BESTS_EVENT));
}

export function getPersonalBests(): Record<string, PersonalBest> {
  return read<Record<string, PersonalBest>>(BESTS_KEY, {});
}

export function getPersonalBest(mode: string): PersonalBest | null {
  return getPersonalBests()[mode] ?? null;
}

export function getModesPlayed(): string[] {
  return read<string[]>(PLAYED_KEY, []);
}

export function hasPlayedMode(mode: string): boolean {
  return getModesPlayed().includes(mode);
}

export function markModePlayed(mode: string) {
  const played = getModesPlayed();
  if (!played.includes(mode)) write(PLAYED_KEY, [...played, mode]);
}

// Records a finished round. Returns whether it beat the previous best.
export function recordResult(
  mode: string,
  result: { score: number; words: number; longestWord: string; grade: string }
): { isNewBest: boolean; previous: PersonalBest | null } {
  markModePlayed(mode);
  const bests = getPersonalBests();
  const previous = bests[mode] ?? null;
  const isNewBest = result.score > 0 && (!previous || result.score > previous.score);
  if (isNewBest) {
    bests[mode] = { ...result, date: new Date().toISOString() };
    write(BESTS_KEY, bests);
  }
  return { isNewBest, previous };
}

// Pull best scores from saved results so bests follow a signed-in player
// across devices. Local entries win when they are higher.
export async function syncRemoteBests(userId: string): Promise<void> {
  try {
    const [standard, daily] = await Promise.all([
      supabase
        .from("standard_game_results")
        .select("game_mode, score, words_found, longest_word, achievement_grade, created_at")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(200),
      supabase
        .from("daily_challenge_results")
        .select("score, word_count, achievement_level, grid_size, created_at")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(50),
    ]);
    const bests = getPersonalBests();
    const played = new Set(getModesPlayed());
    let changed = false;
    const consider = (mode: string, best: PersonalBest) => {
      played.add(mode);
      if (!bests[mode] || best.score > bests[mode].score) {
        bests[mode] = best;
        changed = true;
      }
    };
    for (const row of standard.data ?? []) {
      consider(row.game_mode, {
        score: row.score,
        words: row.words_found,
        longestWord: row.longest_word ?? "",
        grade: row.achievement_grade ?? "None",
        date: row.created_at,
      });
    }
    for (const row of daily.data ?? []) {
      consider(row.grid_size === 5 ? "daily_5x5" : "daily", {
        score: row.score,
        words: row.word_count ?? 0,
        longestWord: "",
        grade: row.achievement_level,
        date: row.created_at,
      });
    }
    if (changed) write(BESTS_KEY, bests);
    if (played.size !== getModesPlayed().length) write(PLAYED_KEY, Array.from(played));
  } catch (err) {
    console.warn("Could not sync personal bests:", err);
  }
}

export function usePersonalBests(): Record<string, PersonalBest> {
  const [bests, setBests] = useState(getPersonalBests);
  useEffect(() => {
    const update = () => setBests(getPersonalBests());
    window.addEventListener(PERSONAL_BESTS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PERSONAL_BESTS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return bests;
}

export function useModesPlayed(): string[] {
  const [played, setPlayed] = useState(getModesPlayed);
  useEffect(() => {
    const update = () => setPlayed(getModesPlayed());
    window.addEventListener(PERSONAL_BESTS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PERSONAL_BESTS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return played;
}
