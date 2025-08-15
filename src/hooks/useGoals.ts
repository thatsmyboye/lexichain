import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { GOAL_DEFINITIONS, getAvailableGoals, calculateGoalProgress, type GoalDefinition } from "@/lib/goals";
import { toast } from "sonner";

export type PlayerGoal = {
  id: string;
  user_id: string;
  goal_id: string;
  status: string;
  current_progress: number;
  target_value: number;
  goal_data?: any;
  started_at: string;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GameStats = {
  totalGames: number;
  totalScore: number;
  highestScore: number;
  longestWord: number;
  achievementGrades: string[];
  recentStreak: { count: number; minGrade: string };
};

export function useGoals(user: User | null) {
  const [activeGoals, setActiveGoals] = useState<PlayerGoal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<PlayerGoal[]>([]);
  const [gameStats, setGameStats] = useState<GameStats>({
    totalGames: 0,
    totalScore: 0,
    highestScore: 0,
    longestWord: 0,
    achievementGrades: [],
    recentStreak: { count: 0, minGrade: "None" }
  });
  const [loading, setLoading] = useState(true);

  // Fetch player goals
  const fetchGoals = async () => {
    if (!user) return;
    
    try {
      const { data: goals, error } = await supabase
        .from("player_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setActiveGoals(goals?.filter(g => g.status === "active") || []);
      setCompletedGoals(goals?.filter(g => g.status === "completed") || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
    }
  };

  // Fetch game statistics
  const fetchGameStats = async () => {
    if (!user) return;

    try {
      const { data: games, error } = await supabase
        .from("standard_game_results")
        .select("score, words_found, longest_word, achievement_grade, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (games) {
        const totalGames = games.length;
        const totalScore = games.reduce((sum, game) => sum + game.score, 0);
        const highestScore = Math.max(...games.map(g => g.score), 0);
        const longestWord = Math.max(...games.map(g => g.longest_word?.length || 0), 0);
        const achievementGrades = [...new Set(games.map(g => g.achievement_grade).filter(g => g !== "None"))];
        
        // Calculate recent streak (last consecutive games with Bronze or better)
        let streakCount = 0;
        let minGrade = "None";
        const gradeOrder = ["None", "Bronze", "Silver", "Gold", "Platinum"];
        
        for (const game of games) {
          if (game.achievement_grade !== "None") {
            streakCount++;
            if (minGrade === "None" || gradeOrder.indexOf(game.achievement_grade) < gradeOrder.indexOf(minGrade)) {
              minGrade = game.achievement_grade;
            }
          } else {
            break;
          }
        }

        setGameStats({
          totalGames,
          totalScore,
          highestScore,
          longestWord,
          achievementGrades,
          recentStreak: { count: streakCount, minGrade }
        });
      }
    } catch (error) {
      console.error("Error fetching game stats:", error);
    }
  };

  // Initialize goals for new users
  const initializeGoals = async () => {
    if (!user || activeGoals.length > 0) return;

    const completedGoalIds = completedGoals.map(g => g.goal_id);
    const availableGoals = getAvailableGoals(completedGoalIds);
    
    // Select 3 starter goals: one from each category (achievement, exploration, progressive)
    const starterGoals = [
      availableGoals.find(g => g.category === "achievement" && g.difficulty === "easy"),
      availableGoals.find(g => g.category === "exploration" && g.difficulty === "easy"),
      availableGoals.find(g => g.category === "progressive" && g.difficulty === "easy")
    ].filter(Boolean) as GoalDefinition[];

    try {
      const goalInserts = starterGoals.map(goal => ({
        user_id: user.id,
        goal_id: goal.id,
        status: "active" as const,
        current_progress: 0,
        target_value: goal.condition.target,
        goal_data: goal.condition.data || null,
        expires_at: goal.timeLimit ? new Date(Date.now() + goal.timeLimit * 60 * 60 * 1000).toISOString() : null
      }));

      const { error } = await supabase
        .from("player_goals")
        .insert(goalInserts);

      if (error) throw error;
      
      await fetchGoals();
      toast.success("Goals activated! Check your progress in the Stats page.");
    } catch (error) {
      console.error("Error initializing goals:", error);
    }
  };

  // Update goal progress
  const updateGoalProgress = async (gameResult: {
    score: number;
    words_found: number;
    longest_word?: string;
    achievement_grade: string;
    game_id?: string;
  }) => {
    if (!user || activeGoals.length === 0) return;

    try {
      // Refresh stats to get latest data
      await fetchGameStats();
      
      const updates: Array<{id: string; progress: number; completed: boolean}> = [];

      for (const playerGoal of activeGoals) {
        const goalDef = GOAL_DEFINITIONS[playerGoal.goal_id];
        if (!goalDef) continue;

        const newProgress = calculateGoalProgress(goalDef, gameStats);
        const isCompleted = newProgress >= goalDef.condition.target;
        
        if (newProgress > playerGoal.current_progress || isCompleted) {
          updates.push({
            id: playerGoal.id,
            progress: newProgress,
            completed: isCompleted
          });
        }
      }

      // Update goals in database
      for (const update of updates) {
        const updateData: any = {
          current_progress: update.progress
        };
        
        if (update.completed) {
          updateData.status = "completed";
          updateData.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from("player_goals")
          .update(updateData)
          .eq("id", update.id);

        if (error) throw error;

        // Show completion toast
        if (update.completed) {
          const goalDef = GOAL_DEFINITIONS[activeGoals.find(g => g.id === update.id)?.goal_id || ""];
          if (goalDef) {
            toast.success(`Goal completed: ${goalDef.title}! +${goalDef.reward.value} points`);
          }
        }
      }

      if (updates.length > 0) {
        await fetchGoals();
      }
    } catch (error) {
      console.error("Error updating goal progress:", error);
    }
  };

  // Add new goal
  const addGoal = async (goalId: string) => {
    if (!user) return false;

    const goalDef = GOAL_DEFINITIONS[goalId];
    if (!goalDef) return false;

    try {
      const { error } = await supabase
        .from("player_goals")
        .insert({
          user_id: user.id,
          goal_id: goalId,
          status: "active",
          current_progress: 0,
          target_value: goalDef.condition.target,
          goal_data: goalDef.condition.data || null,
          expires_at: goalDef.timeLimit ? new Date(Date.now() + goalDef.timeLimit * 60 * 60 * 1000).toISOString() : null
        });

      if (error) throw error;
      
      await fetchGoals();
      toast.success(`Goal activated: ${goalDef.title}`);
      return true;
    } catch (error) {
      console.error("Error adding goal:", error);
      toast.error("Failed to add goal");
      return false;
    }
  };

  // Dismiss goal
  const dismissGoal = async (goalId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("player_goals")
        .update({ status: "dismissed" })
        .eq("user_id", user.id)
        .eq("goal_id", goalId)
        .eq("status", "active");

      if (error) throw error;
      
      await fetchGoals();
      toast.success("Goal dismissed");
      return true;
    } catch (error) {
      console.error("Error dismissing goal:", error);
      toast.error("Failed to dismiss goal");
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchGoals(), fetchGameStats()]);
        setLoading(false);
      };
      
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !loading && activeGoals.length === 0 && completedGoals.length === 0) {
      initializeGoals();
    }
  }, [user, loading, activeGoals.length, completedGoals.length]);

  return {
    activeGoals,
    completedGoals,
    gameStats,
    loading,
    updateGoalProgress,
    addGoal,
    dismissGoal,
    refreshGoals: fetchGoals
  };
}