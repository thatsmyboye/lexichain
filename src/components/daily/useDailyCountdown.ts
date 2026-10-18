import { useEffect, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getEasternTimezone } from "@/utils/dateUtils";

// "YYYY-MM-DD" plus `days`, using UTC so local DST never shifts the date
export function shiftDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The instant the next daily puzzle unlocks. Daily dates come from
 * getDailyChallengeDate(), which uses Eastern Time, so the reset is the next
 * midnight in America/New_York (not the player's local midnight).
 */
export function getNextDailyReset(now: Date = new Date()): Date {
  const tz = getEasternTimezone();
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  return fromZonedTime(`${shiftDateString(today, 1)}T00:00:00`, tz);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

export function useDailyCountdown(): { nextAt: Date; msLeft: number; today: string } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nextAt = getNextDailyReset(new Date(now));
  // Same value getDailyChallengeDate() returns, derived from the ticking clock
  const today = formatInTimeZone(new Date(now), getEasternTimezone(), "yyyy-MM-dd");
  return { nextAt, msLeft: nextAt.getTime() - now, today };
}
