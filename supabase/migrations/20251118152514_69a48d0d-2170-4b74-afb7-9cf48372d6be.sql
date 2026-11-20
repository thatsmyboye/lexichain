-- Drop the overly permissive ALL policy on goal_progress
DROP POLICY IF EXISTS "Users can manage progress for their own goals" ON public.goal_progress;

-- Add explicit SELECT policy
CREATE POLICY "Users can view progress for their own goals"
ON public.goal_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM player_goals
    WHERE player_goals.id = goal_progress.goal_id 
    AND player_goals.user_id = auth.uid()
  )
);

-- Add explicit INSERT policy
CREATE POLICY "Users can insert progress for their own goals"
ON public.goal_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM player_goals
    WHERE player_goals.id = goal_progress.goal_id 
    AND player_goals.user_id = auth.uid()
  )
);

-- Add explicit UPDATE policy
CREATE POLICY "Users can update progress for their own goals"
ON public.goal_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM player_goals
    WHERE player_goals.id = goal_progress.goal_id 
    AND player_goals.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM player_goals
    WHERE player_goals.id = goal_progress.goal_id 
    AND player_goals.user_id = auth.uid()
  )
);

-- Restrict DELETE to system/admin only - users should not delete goal progress records
-- This maintains data integrity and prevents achievement progress manipulation
CREATE POLICY "Only system can delete goal progress"
ON public.goal_progress
FOR DELETE
USING (
  (auth.jwt() ->> 'role')::text = 'service_role'
  OR public.current_user_has_role('admin'::app_role)
);