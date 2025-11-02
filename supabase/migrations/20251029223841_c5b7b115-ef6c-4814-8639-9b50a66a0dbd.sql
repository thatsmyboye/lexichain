-- Add total_xp column to profiles table to track user experience points
ALTER TABLE public.profiles 
ADD COLUMN total_xp integer NOT NULL DEFAULT 0;

-- Create an index for efficient XP queries (leaderboards, etc.)
CREATE INDEX idx_profiles_total_xp ON public.profiles(total_xp DESC);

-- Add a comment explaining the column
COMMENT ON COLUMN public.profiles.total_xp IS 'Total experience points earned by the user across all games';