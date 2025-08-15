-- Add UPDATE policy for goal_progress table
CREATE POLICY "Users can update progress for their own goals" 
ON public.goal_progress 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.player_goals 
    WHERE public.player_goals.id = goal_progress.goal_id 
    AND public.player_goals.user_id = auth.uid()
  )
);