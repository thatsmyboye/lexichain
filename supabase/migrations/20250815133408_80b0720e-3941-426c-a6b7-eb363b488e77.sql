-- Create standard_game_results table to track all standard game sessions
CREATE TABLE public.standard_game_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL,
  words_found INTEGER NOT NULL DEFAULT 0,
  longest_word TEXT,
  moves_used INTEGER NOT NULL DEFAULT 0,
  time_played INTEGER, -- in seconds
  achievement_grade TEXT CHECK (achievement_grade IN ('None', 'Bronze', 'Silver', 'Gold', 'Platinum')) DEFAULT 'None',
  achievements_unlocked TEXT[], -- array of achievement IDs
  grid_size INTEGER NOT NULL DEFAULT 4,
  game_mode TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standard_game_results ENABLE ROW LEVEL SECURITY;

-- Create policies for standard_game_results
CREATE POLICY "Users can view their own standard game results" 
ON public.standard_game_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own standard game results" 
ON public.standard_game_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own standard game results" 
ON public.standard_game_results 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create player_goals table to track active and completed goals
CREATE TABLE public.player_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id TEXT NOT NULL, -- identifier for the goal type
  status TEXT CHECK (status IN ('active', 'completed', 'dismissed')) DEFAULT 'active',
  current_progress INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL,
  goal_data JSONB, -- flexible storage for goal-specific data
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- for time-limited goals
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, goal_id, status) -- prevent duplicate active goals
);

-- Enable RLS
ALTER TABLE public.player_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for player_goals
CREATE POLICY "Users can view their own player goals" 
ON public.player_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own player goals" 
ON public.player_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player goals" 
ON public.player_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create goal_progress table for detailed progress tracking
CREATE TABLE public.goal_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.player_goals(id) ON DELETE CASCADE,
  game_result_id UUID REFERENCES public.standard_game_results(id) ON DELETE CASCADE,
  progress_increment INTEGER NOT NULL DEFAULT 0,
  progress_data JSONB, -- stores specific data about what contributed to progress
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for goal_progress
CREATE POLICY "Users can view progress for their own goals" 
ON public.goal_progress 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.player_goals 
    WHERE public.player_goals.id = goal_progress.goal_id 
    AND public.player_goals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert progress for their own goals" 
ON public.goal_progress 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.player_goals 
    WHERE public.player_goals.id = goal_progress.goal_id 
    AND public.player_goals.user_id = auth.uid()
  )
);

-- Add timestamp triggers
CREATE TRIGGER update_standard_game_results_updated_at
BEFORE UPDATE ON public.standard_game_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_goals_updated_at
BEFORE UPDATE ON public.player_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_standard_game_results_user_id ON public.standard_game_results(user_id);
CREATE INDEX idx_standard_game_results_created_at ON public.standard_game_results(created_at DESC);
CREATE INDEX idx_player_goals_user_status ON public.player_goals(user_id, status);
CREATE INDEX idx_goal_progress_goal_id ON public.goal_progress(goal_id);