-- Create puzzle_completions table to track puzzle progress
CREATE TABLE IF NOT EXISTS public.puzzle_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL,
  moves_used INTEGER NOT NULL,
  optional_words_found INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, puzzle_id)
);

-- Enable Row Level Security
ALTER TABLE public.puzzle_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own puzzle completions"
ON public.puzzle_completions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own puzzle completions"
ON public.puzzle_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own puzzle completions"
ON public.puzzle_completions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_puzzle_completions_user_id ON public.puzzle_completions(user_id);
CREATE INDEX idx_puzzle_completions_puzzle_id ON public.puzzle_completions(puzzle_id);