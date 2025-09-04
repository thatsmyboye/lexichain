import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConsumables } from "./useConsumables";
import type { User } from "@supabase/supabase-js";
import type { ConsumableReward } from "@/lib/consumables";
import { toast } from "@/hooks/use-toast";

export interface LoginStreakData {
  currentStreak: number;
  lastLoginDate: string;
  totalLogins: number;
}

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

    const today = new Date().toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];
    const lastLogin = new Date(streakData.lastLoginDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already logged in today
      return;
    }

    let newStreak = streakData.currentStreak;
    if (diffDays === 1) {
      // Consecutive day
      newStreak += 1;
    } else {
      // Streak broken, reset to 1
      newStreak = 1;
    }

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

      const newStreakData = {
        currentStreak: newStreak,
        lastLoginDate: today,
        totalLogins: streakData.totalLogins + 1,
      };

      setStreakData(newStreakData);

      // Award streak rewards
      if (STREAK_REWARDS[newStreak]) {
        await awardConsumables(
          STREAK_REWARDS[newStreak],
          `login_streak_${newStreak}`
        );
        
        toast({
          title: `🔥 ${newStreak} day streak! You've earned consumables!`,
          duration: 5000,
        });
      } else if (newStreak > streakData.currentStreak) {
        // Regular streak continuation
        toast({
          title: `🔥 ${newStreak} day streak!`,
        });
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