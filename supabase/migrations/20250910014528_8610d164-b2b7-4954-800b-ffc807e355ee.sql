-- Add unique constraint to prevent duplicate daily challenge results
-- and improve the leaderboard data integrity

-- First, check for existing duplicates and clean them up
DELETE FROM public.daily_challenge_results dcr1
WHERE EXISTS (
  SELECT 1 FROM public.daily_challenge_results dcr2
  WHERE dcr2.user_id = dcr1.user_id 
  AND dcr2.challenge_date = dcr1.challenge_date 
  AND dcr2.id > dcr1.id
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.daily_challenge_results 
ADD CONSTRAINT unique_user_challenge_date 
UNIQUE (user_id, challenge_date);

-- Update the get_daily_leaderboard function to handle timezone consistently
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(challenge_date date)
RETURNS TABLE(user_id uuid, display_name text, score integer, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        dcr.score,
        ROW_NUMBER() OVER (ORDER BY dcr.score DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE dcr.challenge_date = get_daily_leaderboard.challenge_date
    ORDER BY dcr.score DESC
    LIMIT 100;
END;
$function$;