-- ============================================
-- ADVANCED GAME MODES DATABASE SCHEMA
-- ============================================
-- This migration adds tables for three new game modes:
-- 1. Daily Mini-Marathon
-- 2. Prestige Endless
-- 3. Weekly Gauntlet
-- ============================================

-- ============================================
-- MINI-MARATHON TABLES
-- ============================================

-- Table for storing in-progress mini-marathon states
CREATE TABLE IF NOT EXISTS mini_marathon_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

-- Table for completed mini-marathon results
CREATE TABLE IF NOT EXISTS mini_marathon_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  board1_score INTEGER NOT NULL DEFAULT 0,
  board2_score INTEGER NOT NULL DEFAULT 0,
  board3_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  grade VARCHAR(20), -- bronze, silver, gold, platinum
  total_time_seconds INTEGER,
  combo_bonus_1 INTEGER DEFAULT 0,
  combo_bonus_2 INTEGER DEFAULT 0,
  final_multiplier DECIMAL(4,2),
  words_found INTEGER DEFAULT 0,
  longest_word INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mini_marathon_states_user_date
  ON mini_marathon_states(user_id, marathon_date);
CREATE INDEX IF NOT EXISTS idx_mini_marathon_results_date_score
  ON mini_marathon_results(marathon_date, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_mini_marathon_results_user
  ON mini_marathon_results(user_id, marathon_date);

-- Enable RLS
ALTER TABLE mini_marathon_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_marathon_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mini_marathon_states
CREATE POLICY "Users can view their own marathon states"
  ON mini_marathon_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marathon states"
  ON mini_marathon_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marathon states"
  ON mini_marathon_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marathon states"
  ON mini_marathon_states FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for mini_marathon_results (public read, private write)
CREATE POLICY "Anyone can view marathon results"
  ON mini_marathon_results FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own marathon results"
  ON mini_marathon_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marathon results"
  ON mini_marathon_results FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- PRESTIGE ENDLESS TABLES
-- ============================================

-- Table for storing in-progress prestige endless sessions
CREATE TABLE IF NOT EXISTS prestige_endless_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- Only one active session per user
);

-- Table for completed prestige endless runs
CREATE TABLE IF NOT EXISTS prestige_endless_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  final_wave INTEGER NOT NULL DEFAULT 1,
  total_score BIGINT NOT NULL DEFAULT 0,
  prestige_level INTEGER NOT NULL DEFAULT 0,
  prestige_points_earned INTEGER NOT NULL DEFAULT 0,
  buffs_used JSONB DEFAULT '[]', -- Array of buff objects
  total_time_seconds INTEGER,
  words_found INTEGER DEFAULT 0,
  longest_word INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for persistent prestige endless player stats
CREATE TABLE IF NOT EXISTS prestige_endless_player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prestige_level INTEGER DEFAULT 0,
  total_prestige_points INTEGER DEFAULT 0,
  highest_wave_ever INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  total_waves_completed INTEGER DEFAULT 0,
  purchased_items JSONB DEFAULT '[]', -- Array of shop item IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prestige_endless_states_user
  ON prestige_endless_states(user_id);
CREATE INDEX IF NOT EXISTS idx_prestige_endless_runs_wave
  ON prestige_endless_runs(final_wave DESC);
CREATE INDEX IF NOT EXISTS idx_prestige_endless_runs_user
  ON prestige_endless_runs(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestige_player_stats_highest_wave
  ON prestige_endless_player_stats(highest_wave_ever DESC);

-- Enable RLS
ALTER TABLE prestige_endless_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestige_endless_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestige_endless_player_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prestige_endless_states
CREATE POLICY "Users can view their own prestige states"
  ON prestige_endless_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prestige states"
  ON prestige_endless_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prestige states"
  ON prestige_endless_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prestige states"
  ON prestige_endless_states FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for prestige_endless_runs (public read, private write)
CREATE POLICY "Anyone can view prestige runs"
  ON prestige_endless_runs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own prestige runs"
  ON prestige_endless_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for prestige_endless_player_stats
CREATE POLICY "Anyone can view prestige player stats"
  ON prestige_endless_player_stats FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own prestige player stats"
  ON prestige_endless_player_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prestige player stats"
  ON prestige_endless_player_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- WEEKLY GAUNTLET TABLES
-- ============================================

-- Table for storing in-progress weekly gauntlet states
CREATE TABLE IF NOT EXISTS weekly_gauntlet_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL, -- e.g., "2025-W23"
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

-- Table for completed weekly gauntlet results
CREATE TABLE IF NOT EXISTS weekly_gauntlet_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  puzzles_completed INTEGER NOT NULL DEFAULT 0,
  puzzle_scores JSONB NOT NULL DEFAULT '{}', -- { monday: 1000, tuesday: 1200, ... }
  total_score INTEGER NOT NULL DEFAULT 0,
  completion_bonus DECIMAL(3,2) DEFAULT 1.0,
  grade VARCHAR(20), -- bronze, silver, gold, platinum, diamond
  total_words_found INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

-- Table for tracking individual daily puzzle completions within a week
CREATE TABLE IF NOT EXISTS weekly_gauntlet_daily_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL, -- monday, tuesday, etc.
  score INTEGER NOT NULL DEFAULT 0,
  moves_used INTEGER,
  time_taken_seconds INTEGER,
  words_found INTEGER DEFAULT 0,
  longest_word INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_identifier, day_of_week)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_gauntlet_states_user_week
  ON weekly_gauntlet_states(user_id, week_identifier);
CREATE INDEX IF NOT EXISTS idx_weekly_gauntlet_results_week_score
  ON weekly_gauntlet_results(week_identifier, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_gauntlet_results_user
  ON weekly_gauntlet_results(user_id, week_identifier);
CREATE INDEX IF NOT EXISTS idx_gauntlet_daily_user_week
  ON weekly_gauntlet_daily_completions(user_id, week_identifier);
CREATE INDEX IF NOT EXISTS idx_gauntlet_daily_week_day_score
  ON weekly_gauntlet_daily_completions(week_identifier, day_of_week, score DESC);

-- Enable RLS
ALTER TABLE weekly_gauntlet_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_gauntlet_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_gauntlet_daily_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_gauntlet_states
CREATE POLICY "Users can view their own gauntlet states"
  ON weekly_gauntlet_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gauntlet states"
  ON weekly_gauntlet_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gauntlet states"
  ON weekly_gauntlet_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gauntlet states"
  ON weekly_gauntlet_states FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for weekly_gauntlet_results (public read, private write)
CREATE POLICY "Anyone can view gauntlet results"
  ON weekly_gauntlet_results FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own gauntlet results"
  ON weekly_gauntlet_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gauntlet results"
  ON weekly_gauntlet_results FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for weekly_gauntlet_daily_completions (public read, private write)
CREATE POLICY "Anyone can view daily completions"
  ON weekly_gauntlet_daily_completions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own daily completions"
  ON weekly_gauntlet_daily_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily completions"
  ON weekly_gauntlet_daily_completions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Create triggers for updated_at columns (reusing existing function)
CREATE TRIGGER update_mini_marathon_states_updated_at
  BEFORE UPDATE ON mini_marathon_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prestige_endless_states_updated_at
  BEFORE UPDATE ON prestige_endless_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prestige_endless_player_stats_updated_at
  BEFORE UPDATE ON prestige_endless_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_gauntlet_states_updated_at
  BEFORE UPDATE ON weekly_gauntlet_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
