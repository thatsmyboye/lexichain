import { useEffect, useState } from "react";
import { getDailyChallengeDate } from "@/utils/dateUtils";
import type { FinalGrade } from "@/types/game";
import type { DailyGameMode } from "@/lib/gameModes";

export const DAILY_MOVES_LIMIT = 10;

export type DailyStatus =
  | { state: "not_started"; date: string }
  | {
      state: "in_progress" | "done";
      date: string;
      score: number;
      movesUsed: number;
      movesLimit: number;
      wordsFound: number;
      grade: FinalGrade | null;
    };

// Matches useDailyChallengeState(getDailySeed()) and (getDailySeed() + "-5x5")
export function getDailySeedFor(mode: DailyGameMode, date: string): string {
  return mode === "daily_5x5" ? `${date}-5x5` : date;
}

interface StoredDailyState {
  seed?: string;
  score?: number;
  movesUsed?: number;
  usedWords?: unknown[];
  gameOver?: boolean;
  finalGrade?: FinalGrade | null;
}

export function readDailyStatus(mode: DailyGameMode, date: string = getDailyChallengeDate()): DailyStatus {
  const seed = getDailySeedFor(mode, date);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(`daily-challenge-${seed}`);
  } catch {
    // Storage blocked: treat as not started
  }
  if (!raw) return { state: "not_started", date };

  try {
    const saved = JSON.parse(raw) as StoredDailyState;
    if (!saved || (saved.seed && saved.seed !== seed)) return { state: "not_started", date };
    const movesUsed = typeof saved.movesUsed === "number" ? saved.movesUsed : 0;
    const wordsFound = Array.isArray(saved.usedWords) ? saved.usedWords.length : 0;
    // A board that was generated but never played still counts as not started
    if (!saved.gameOver && movesUsed === 0 && wordsFound === 0) return { state: "not_started", date };
    return {
      state: saved.gameOver ? "done" : "in_progress",
      date,
      score: typeof saved.score === "number" ? saved.score : 0,
      movesUsed,
      movesLimit: DAILY_MOVES_LIMIT,
      wordsFound,
      grade: saved.finalGrade ?? null,
    };
  } catch {
    return { state: "not_started", date };
  }
}

function sameStatus(a: DailyStatus, b: DailyStatus): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Today's status for a daily mode, read from the saved game in localStorage.
 * Re-checks periodically (which also picks up the date rolling over), when
 * another tab writes storage, and when the page becomes visible again.
 */
export function useDailyStatus(mode: DailyGameMode): DailyStatus {
  const [status, setStatus] = useState<DailyStatus>(() => readDailyStatus(mode));

  useEffect(() => {
    const refresh = () => {
      const next = readDailyStatus(mode);
      setStatus(prev => (sameStatus(prev, next) ? prev : next));
    };
    refresh();
    const interval = window.setInterval(refresh, 5000);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  return status;
}
