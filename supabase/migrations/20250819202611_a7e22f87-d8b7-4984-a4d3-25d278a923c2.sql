-- Drop existing individual CRUD policies and replace with consolidated ALL policies for better performance

-- Consumable Transactions - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.consumable_transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.consumable_transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.consumable_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.consumable_transactions;

CREATE POLICY "Users can manage their own transactions" 
ON public.consumable_transactions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- User Consumables - consolidate user policies  
DROP POLICY IF EXISTS "Users can delete their own consumables" ON public.user_consumables;
DROP POLICY IF EXISTS "Users can insert their own consumables" ON public.user_consumables;
DROP POLICY IF EXISTS "Users can update their own consumables" ON public.user_consumables;
DROP POLICY IF EXISTS "Users can view their own consumables" ON public.user_consumables;

CREATE POLICY "Users can manage their own consumables"
ON public.user_consumables
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Daily Challenge Results - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own daily challenge results" ON public.daily_challenge_results;
DROP POLICY IF EXISTS "Users can insert their own daily challenge results" ON public.daily_challenge_results;
DROP POLICY IF EXISTS "Users can update their own daily challenge results" ON public.daily_challenge_results;
DROP POLICY IF EXISTS "Users can view their own daily challenge results" ON public.daily_challenge_results;

CREATE POLICY "Users can manage their own daily challenge results"
ON public.daily_challenge_results
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Daily Challenge States - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own daily challenge states" ON public.daily_challenge_states;
DROP POLICY IF EXISTS "Users can insert their own daily challenge states" ON public.daily_challenge_states;
DROP POLICY IF EXISTS "Users can update their own daily challenge states" ON public.daily_challenge_states;
DROP POLICY IF EXISTS "Users can view their own daily challenge states" ON public.daily_challenge_states;

CREATE POLICY "Users can manage their own daily challenge states"
ON public.daily_challenge_states
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Daily Login Streaks - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own login streaks" ON public.daily_login_streaks;
DROP POLICY IF EXISTS "Users can insert their own login streaks" ON public.daily_login_streaks;
DROP POLICY IF EXISTS "Users can update their own login streaks" ON public.daily_login_streaks;
DROP POLICY IF EXISTS "Users can view their own login streaks" ON public.daily_login_streaks;

CREATE POLICY "Users can manage their own login streaks"
ON public.daily_login_streaks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Player Goals - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.player_goals;
DROP POLICY IF EXISTS "Users can insert their own player goals" ON public.player_goals;
DROP POLICY IF EXISTS "Users can update their own player goals" ON public.player_goals;
DROP POLICY IF EXISTS "Users can view their own player goals" ON public.player_goals;

CREATE POLICY "Users can manage their own goals"
ON public.player_goals
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Goal Progress - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own goal progress" ON public.goal_progress;
DROP POLICY IF EXISTS "Users can insert progress for their own goals" ON public.goal_progress;
DROP POLICY IF EXISTS "Users can update progress for their own goals" ON public.goal_progress;
DROP POLICY IF EXISTS "Users can view progress for their own goals" ON public.goal_progress;

CREATE POLICY "Users can manage progress for their own goals"
ON public.goal_progress
FOR ALL
USING (EXISTS (
  SELECT 1 FROM player_goals 
  WHERE player_goals.id = goal_progress.goal_id 
  AND player_goals.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM player_goals 
  WHERE player_goals.id = goal_progress.goal_id 
  AND player_goals.user_id = auth.uid()
));

-- Profiles - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can manage their own profile"
ON public.profiles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Standard Game Results - consolidate user policies
DROP POLICY IF EXISTS "Users can delete their own game results" ON public.standard_game_results;
DROP POLICY IF EXISTS "Users can insert their own standard game results" ON public.standard_game_results;
DROP POLICY IF EXISTS "Users can update their own standard game results" ON public.standard_game_results;
DROP POLICY IF EXISTS "Users can view their own standard game results" ON public.standard_game_results;

CREATE POLICY "Users can manage their own game results"
ON public.standard_game_results
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);