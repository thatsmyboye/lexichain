-- Add explicit policy to deny anonymous access to daily_challenge_board_analysis
CREATE POLICY "Deny anonymous access to daily_challenge_board_analysis"
ON public.daily_challenge_board_analysis
FOR SELECT
TO anon
USING (false);