import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// get_daily_leaderboard returns at most this many rows
const LEADERBOARD_LIMIT = 100;

export interface DailyCommunityStats {
  players: number;
  /** True when the leaderboard was cut off, so `players` is a lower bound */
  truncated: boolean;
  /** The signed-in player's rank, when they appear on the board */
  rank: number | null;
  /** Share of other players they outscored, 0-100; null when unknown */
  percentile: number | null;
}

/**
 * How many players finished today's Daily (4×4) and where the signed-in
 * player sits. Returns null for guests, while loading, on error, or when
 * nobody has played yet, so callers can simply hide the line.
 */
export function useDailyCommunity(user: User | null | undefined, date: string): DailyCommunityStats | null {
  const [stats, setStats] = useState<DailyCommunityStats | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_daily_leaderboard", { challenge_date: date });
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setStats(null);
          return;
        }
        const truncated = data.length >= LEADERBOARD_LIMIT;
        const players = new Set(data.map(row => row.user_id)).size;
        const mine = data.find(row => row.user_id === userId);
        let percentile: number | null = null;
        // Only meaningful when we can see everyone who played
        if (mine && !truncated && players > 1) {
          const beaten = data.filter(row => row.user_id !== userId && row.score < mine.score).length;
          percentile = Math.round((beaten / (players - 1)) * 100);
        }
        setStats({ players, truncated, rank: mine ? Number(mine.rank) : null, percentile });
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  return stats;
}
