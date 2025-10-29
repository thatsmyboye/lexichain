-- Create table for tracking unlocked game modes
CREATE TABLE public.user_unlocked_modes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mode_id text NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, mode_id)
);

-- Enable RLS
ALTER TABLE public.user_unlocked_modes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view and manage their own unlocked modes
CREATE POLICY "Users can manage their own unlocked modes"
ON public.user_unlocked_modes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_user_unlocked_modes_user_id ON public.user_unlocked_modes(user_id);

-- Add comment
COMMENT ON TABLE public.user_unlocked_modes IS 'Tracks which advanced game modes each user has unlocked';