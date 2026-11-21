-- Optimize RLS policies by wrapping auth.uid() in SELECT for better performance at scale
-- This makes the auth function result cacheable during policy evaluation

-- Drop existing policies and recreate with optimized auth function calls

-- Daily Challenge Results policies
DROP POLICY IF EXISTS "Users can view their own daily challenge results" ON public.daily_challenge_results;
DROP POLICY IF EXISTS "Users can insert their own daily challenge results" ON public.daily_challenge_results;
DROP POLICY IF EXISTS "Users can update their own daily challenge results" ON public.daily_challenge_results;

CREATE POLICY "Users can view their own daily challenge results" 
ON public.daily_challenge_results 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own daily challenge results" 
ON public.daily_challenge_results 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own daily challenge results" 
ON public.daily_challenge_results 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);

-- Goal Progress policies  
DROP POLICY IF EXISTS "Users can view progress for their own goals" ON public.goal_progress;
DROP POLICY IF EXISTS "Users can insert progress for their own goals" ON public.goal_progress;
DROP POLICY IF EXISTS "Users can update progress for their own goals" ON public.goal_progress;

CREATE POLICY "Users can view progress for their own goals" 
ON public.goal_progress 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM player_goals 
  WHERE player_goals.id = goal_progress.goal_id 
  AND player_goals.user_id = (SELECT auth.uid())
));

CREATE POLICY "Users can insert progress for their own goals" 
ON public.goal_progress 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM player_goals 
  WHERE player_goals.id = goal_progress.goal_id 
  AND player_goals.user_id = (SELECT auth.uid())
));

CREATE POLICY "Users can update progress for their own goals" 
ON public.goal_progress 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM player_goals 
  WHERE player_goals.id = goal_progress.goal_id 
  AND player_goals.user_id = (SELECT auth.uid())
));

-- Player Goals policies
DROP POLICY IF EXISTS "Users can view their own player goals" ON public.player_goals;
DROP POLICY IF EXISTS "Users can insert their own player goals" ON public.player_goals;
DROP POLICY IF EXISTS "Users can update their own player goals" ON public.player_goals;

CREATE POLICY "Users can view their own player goals" 
ON public.player_goals 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own player goals" 
ON public.player_goals 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own player goals" 
ON public.player_goals 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);

-- Standard Game Results policies
DROP POLICY IF EXISTS "Users can view their own standard game results" ON public.standard_game_results;
DROP POLICY IF EXISTS "Users can insert their own standard game results" ON public.standard_game_results;
DROP POLICY IF EXISTS "Users can update their own standard game results" ON public.standard_game_results;

CREATE POLICY "Users can view their own standard game results" 
ON public.standard_game_results 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own standard game results" 
ON public.standard_game_results 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own standard game results" 
ON public.standard_game_results 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);