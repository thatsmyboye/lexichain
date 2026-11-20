-- Add DELETE policies for user data where appropriate

-- Allow users to delete their own consumables inventory
CREATE POLICY "Users can delete their own consumables" 
ON user_consumables 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own login streaks (if they want to reset)
CREATE POLICY "Users can delete their own login streaks" 
ON daily_login_streaks 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own daily challenge results
CREATE POLICY "Users can delete their own daily challenge results" 
ON daily_challenge_results 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own daily challenge states
CREATE POLICY "Users can delete their own daily challenge states" 
ON daily_challenge_states 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own goal progress
CREATE POLICY "Users can delete their own goal progress" 
ON goal_progress 
FOR DELETE 
USING (EXISTS ( SELECT 1
   FROM player_goals
  WHERE ((player_goals.id = goal_progress.goal_id) AND (player_goals.user_id = (SELECT auth.uid())))));

-- Allow users to delete their own goals
CREATE POLICY "Users can delete their own goals" 
ON player_goals 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile" 
ON profiles 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to delete their own standard game results
CREATE POLICY "Users can delete their own game results" 
ON standard_game_results 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Note: consumable_transactions table intentionally does NOT have DELETE policy
-- This preserves transaction history for audit purposes and prevents data manipulation