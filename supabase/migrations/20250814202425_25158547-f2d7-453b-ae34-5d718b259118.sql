-- Create table to track daily challenge results and achievements
CREATE TABLE public.daily_challenge_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  score INTEGER NOT NULL,
  achievement_level TEXT NOT NULL CHECK (achievement_level IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'None')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_date)
);

-- Enable Row Level Security
ALTER TABLE public.daily_challenge_results ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own daily challenge results" 
ON public.daily_challenge_results 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily challenge results" 
ON public.daily_challenge_results 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily challenge results" 
ON public.daily_challenge_results 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_challenge_results_updated_at
BEFORE UPDATE ON public.daily_challenge_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();