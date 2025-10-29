-- Create table for tracking user unlocked game modes
CREATE TABLE IF NOT EXISTS user_unlocked_modes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT, -- e.g., 'stripe_purchase_xxx', 'level_unlock', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can't unlock the same mode twice
  UNIQUE(user_id, mode_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_unlocked_modes_user_id ON user_unlocked_modes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unlocked_modes_mode_id ON user_unlocked_modes(mode_id);

-- Enable RLS
ALTER TABLE user_unlocked_modes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own unlocked modes" ON user_unlocked_modes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unlocked modes" ON user_unlocked_modes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_unlocked_modes_updated_at
  BEFORE UPDATE ON user_unlocked_modes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
