-- Fix RLS performance issues by wrapping auth.uid() in subqueries
-- This prevents re-evaluation of auth.uid() for each row

-- Update user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = (select auth.uid()));

-- Update consumable_transactions policies
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.consumable_transactions;
CREATE POLICY "Users can manage their own transactions" 
ON public.consumable_transactions 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update daily_challenge_results policies
DROP POLICY IF EXISTS "Users can manage their own daily challenge results" ON public.daily_challenge_results;
CREATE POLICY "Users can manage their own daily challenge results" 
ON public.daily_challenge_results 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update daily_challenge_states policies
DROP POLICY IF EXISTS "Users can manage their own daily challenge states" ON public.daily_challenge_states;
CREATE POLICY "Users can manage their own daily challenge states" 
ON public.daily_challenge_states 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update daily_login_streaks policies
DROP POLICY IF EXISTS "Users can manage their own login streaks" ON public.daily_login_streaks;
CREATE POLICY "Users can manage their own login streaks" 
ON public.daily_login_streaks 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update goal_progress policies
DROP POLICY IF EXISTS "Users can manage progress for their own goals" ON public.goal_progress;
CREATE POLICY "Users can manage progress for their own goals" 
ON public.goal_progress 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM player_goals
  WHERE ((player_goals.id = goal_progress.goal_id) AND (player_goals.user_id = (select auth.uid())))))
WITH CHECK (EXISTS ( SELECT 1
   FROM player_goals
  WHERE ((player_goals.id = goal_progress.goal_id) AND (player_goals.user_id = (select auth.uid())))));

-- Update player_goals policies
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.player_goals;
CREATE POLICY "Users can manage their own goals" 
ON public.player_goals 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update profiles policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" 
ON public.profiles 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Update standard_game_results policies
DROP POLICY IF EXISTS "Users can manage their own game results" ON public.standard_game_results;
CREATE POLICY "Users can manage their own game results" 
ON public.standard_game_results 
FOR ALL 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);