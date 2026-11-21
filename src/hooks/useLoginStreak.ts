import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConsumables } from "./useConsumables";
import type { User } from "@supabase/supabase-js";
import type { ConsumableReward } from "@/lib/consumables";
import { toast } from "@/hooks/use-toast";
import { toZonedTime, format } from 'date-fns-tz';
import { advanceStreak, recallEndedStreak, rememberEndedStreak } from "@/lib/loginStreak";

export interface LoginStreakData {
  currentStreak: number;
  lastLoginDate: string;
  totalLogins: number;
  /**
   * Length of the streak that ended today because a day was missed, or null.
   * Set only on the day the player comes back; see src/lib/loginStreak.ts.
   */
  endedStreak: number | null;
}

/** Today's date in the game's day, which rolls over at midnight US Eastern. */
const todayInEastern = () => format(toZonedTime(new Date(), 'America/New_York'), 'yyyy-MM-dd');

const STREAK_REWARDS: Record<number, ConsumableReward[]> = {
  3: [{ id: "hint_revealer", quantity: 1 }],
  7: [{ id: "hint_revealer", quantity: 2 }, { id: "hammer", quantity: 1 }],
  14: [{ id: "score_multiplier", quantity: 1 }, { id: "hint_revealer", quantity: 2 }],
  30: [{ id: "score_multiplier", quantity: 2 }, { id: "extra_moves", quantity: 1 }],
  50: [{ id: "score_multiplier", quantity: 3 }, { id: "hint_revealer", quantity: 3 }],
  100: [{ id: "extra_moves", quantity: 2 }, { id: "score_multiplier", quantity: 5 }],
};

export function useLoginStreak(user: User | null) {
  const [streakData, setStreakData] = useState<LoginStreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const { awardConsumables } = useConsumables(user);

  const fetchStreakData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("daily_login_streaks")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setStreakData({
          currentStreak: data.current_streak,
          lastLoginDate: data.last_login_date,
          totalLogins: data.total_logins,
          endedStreak: recallEndedStreak(user.id, todayInEastern()),
        });
      } else {
        // Initialize streak data for new user
        await initializeStreak();
      }
    } catch (error) {
      console.error("Error fetching login streak:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeStreak = async () => {
    if (!user) return;

    const today = todayInEastern();
    try {
      const { data, error } = await supabase
        .from("daily_login_streaks")
        .insert({
          user_id: user.id,
          current_streak: 1,
          last_login_date: today,
          total_logins: 1,
        })
        .select()
        .single();

      if (error) throw error;

      setStreakData({
        currentStreak: 1,
        lastLoginDate: today,
        totalLogins: 1,
        endedStreak: null,
      });

      toast({
        title: "Welcome! Your login streak has started!",
      });
    } catch (error) {
      console.error("Error initializing login streak:", error);
    }
  };

  const updateStreak = async () => {
    if (!user || !streakData) return;

    const today = todayInEastern();
    const advance = advanceStreak(streakData, today);
    if (!advance) {
      // Already logged in today
      return;
    }
    const newStreak = advance.currentStreak;

    try {
      const { error } = await supabase
        .from("daily_login_streaks")
        .update({
          current_streak: newStreak,
          last_login_date: today,
          total_logins: streakData.totalLogins + 1,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // A missed day ended the previous streak: remember it for today so the
      // hub can say so instead of silently showing "1 day streak".
      if (advance.endedStreak) rememberEndedStreak(user.id, advance.endedStreak, today);

      const newStreakData = {
        currentStreak: newStreak,
        lastLoginDate: today,
        totalLogins: streakData.totalLogins + 1,
        endedStreak: advance.endedStreak,
      };

      setStreakData(newStreakData);

      if (newStreak > streakData.currentStreak) {
        toast({
          title: `🔥 ${newStreak} day streak!`,
        });

        // Grant milestone consumables for reaching a streak reward threshold
        const rewards = STREAK_REWARDS[newStreak];
        if (rewards) {
          await awardConsumables(rewards, `login_streak_${newStreak}`);
        }
      }
    } catch (error) {
      console.error("Error updating login streak:", error);
    }
  };

  useEffect(() => {
    fetchStreakData();
  }, [user]);

  // Auto-update streak when user is available and streak data is loaded
  useEffect(() => {
    if (user && streakData && !loading) {
      updateStreak();
    }
  }, [user, streakData?.lastLoginDate]); // Only trigger on date change

  return {
    streakData,
    loading,
    updateStreak,
  };
}