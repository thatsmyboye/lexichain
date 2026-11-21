// Rules for the daily login streak, kept free of React and Supabase so they
// can be reasoned about (and tested) on their own. Dates are "yyyy-MM-dd"
// strings in the game's day, which rolls over at midnight US Eastern.

/** A streak this long or longer is worth telling the player it ended. */
export const MIN_STREAK_TO_REPORT_ENDED = 2;

const ENDED_KEY = "lexichain-streak-ended";

/** Whole days from one date string to another; negative if `to` is earlier. */
export function daysBetweenDates(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export interface StreakAdvance {
  /** The streak after today's login. */
  currentStreak: number;
  /** Length of the streak that just ended because a day was missed, or null. */
  endedStreak: number | null;
}

/**
 * What today's login does to a streak. Returns null when nothing changes:
 * the player already logged in today, or the stored date is somehow ahead of
 * today (a clock or time zone slip must never cost anyone their streak).
 */
export function advanceStreak(
  previous: { currentStreak: number; lastLoginDate: string },
  today: string,
): StreakAdvance | null {
  const gap = daysBetweenDates(previous.lastLoginDate, today);
  if (gap <= 0) return null;
  if (gap === 1) return { currentStreak: previous.currentStreak + 1, endedStreak: null };
  return {
    currentStreak: 1,
    endedStreak: previous.currentStreak >= MIN_STREAK_TO_REPORT_ENDED ? previous.currentStreak : null,
  };
}

// The ended streak is remembered on this device for the rest of the day it
// was noticed. The database keeps only the current count, so another device
// opened the same day will show the new streak without the "ended" note.

/** Remember that `length` days of streak ended for this player on `today`. */
export function rememberEndedStreak(userId: string, length: number, today: string): void {
  try {
    localStorage.setItem(ENDED_KEY, JSON.stringify({ userId, length, on: today }));
  } catch {
    // Non-critical
  }
}

/** The streak that ended today for this player, or null. */
export function recallEndedStreak(userId: string, today: string): number | null {
  try {
    const saved = JSON.parse(localStorage.getItem(ENDED_KEY) || "null");
    if (saved && saved.userId === userId && saved.on === today && Number.isInteger(saved.length) && saved.length > 0) {
      return saved.length;
    }
  } catch {
    // Fall through
  }
  return null;
}
