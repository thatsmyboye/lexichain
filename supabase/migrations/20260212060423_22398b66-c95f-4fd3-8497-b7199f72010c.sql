-- Deny anonymous access to daily_challenge_results
CREATE POLICY "deny_anonymous_access" 
ON public.daily_challenge_results 
FOR SELECT 
USING (auth.uid() IS NOT NULL);