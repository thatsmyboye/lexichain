-- Create table for daily challenge state persistence
CREATE TABLE public.daily_challenge_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_date DATE NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one state per user per day
  UNIQUE(user_id, challenge_date)
);

-- Enable Row Level Security
ALTER TABLE public.daily_challenge_states ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own daily challenge states" 
ON public.daily_challenge_states 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own daily challenge states" 
ON public.daily_challenge_states 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own daily challenge states" 
ON public.daily_challenge_states 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_daily_challenge_states_updated_at
BEFORE UPDATE ON public.daily_challenge_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups
CREATE INDEX idx_daily_challenge_states_user_date 
ON public.daily_challenge_states(user_id, challenge_date);