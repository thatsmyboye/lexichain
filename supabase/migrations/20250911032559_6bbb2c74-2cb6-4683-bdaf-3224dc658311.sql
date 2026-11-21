-- Phase 4.1: Enhanced Daily Challenge Schema
-- Add board analysis columns to daily_challenge_results
ALTER TABLE daily_challenge_results ADD COLUMN IF NOT EXISTS board_analysis jsonb;
ALTER TABLE daily_challenge_results ADD COLUMN IF NOT EXISTS word_count integer;
ALTER TABLE daily_challenge_results ADD COLUMN IF NOT EXISTS grid_size integer DEFAULT 4;

-- Create board analysis summary table
CREATE TABLE IF NOT EXISTS daily_challenge_board_analysis (
  challenge_date date PRIMARY KEY,
  word_count integer NOT NULL,
  grid_size integer NOT NULL DEFAULT 4,
  rarity_score_potential numeric NOT NULL DEFAULT 0,
  avg_word_length numeric NOT NULL DEFAULT 0,
  connectivity_score numeric NOT NULL DEFAULT 0,
  max_score_potential integer NOT NULL DEFAULT 0,
  letter_distribution jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new table
ALTER TABLE daily_challenge_board_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy for board analysis (readable by all authenticated users)
CREATE POLICY "Daily challenge board analysis is viewable by authenticated users" 
ON daily_challenge_board_analysis 
FOR SELECT 
TO authenticated 
USING (true);

-- Create policy for system to insert board analysis
CREATE POLICY "System can manage board analysis" 
ON daily_challenge_board_analysis 
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- Phase 4.2: Enhanced Benchmark Functions
-- Update get_benchmark_data to use board analysis for weighted percentiles
CREATE OR REPLACE FUNCTION public.get_enhanced_benchmark_data(challenge_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  benchmark_data record;
  board_analysis record;
  result jsonb;
  board_difficulty_modifier numeric := 1.0;
BEGIN
  -- Get basic benchmark data
  SELECT * INTO benchmark_data 
  FROM public.calculate_daily_challenge_benchmarks(challenge_date::date, 30);
  
  -- Get board analysis for difficulty adjustment
  SELECT * INTO board_analysis
  FROM public.daily_challenge_board_analysis
  WHERE daily_challenge_board_analysis.challenge_date = get_enhanced_benchmark_data.challenge_date::date;
  
  -- Calculate board difficulty modifier if analysis exists
  IF board_analysis IS NOT NULL THEN
    -- Adjust benchmarks based on board difficulty metrics
    -- Higher rarity_score_potential and lower connectivity_score = harder board
    board_difficulty_modifier := GREATEST(0.5, LEAST(2.0, 
      (board_analysis.rarity_score_potential / 100.0) * 
      (1.0 / GREATEST(0.1, board_analysis.connectivity_score / 100.0))
    ));
  END IF;
  
  -- Apply difficulty modifier to benchmarks
  result := jsonb_build_object(
    'bronzePercentile', (benchmark_data.bronze_percentile * board_difficulty_modifier)::integer,
    'silverPercentile', (benchmark_data.silver_percentile * board_difficulty_modifier)::integer,
    'goldPercentile', (benchmark_data.gold_percentile * board_difficulty_modifier)::integer,
    'platinumPercentile', (benchmark_data.platinum_percentile * board_difficulty_modifier)::integer,
    'totalScores', benchmark_data.total_scores,
    'minScore', benchmark_data.min_score,
    'maxScore', benchmark_data.max_score,
    'avgScore', benchmark_data.avg_score,
    'boardDifficultyModifier', board_difficulty_modifier,
    'boardAnalysis', COALESCE(to_jsonb(board_analysis), '{}'::jsonb)
  );
  
  -- Log the enhanced benchmark calculation
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'ENHANCED_BENCHMARK_CALCULATION',
    'INFO',
    jsonb_build_object(
      'challenge_date', challenge_date,
      'difficulty_modifier', board_difficulty_modifier,
      'has_board_analysis', board_analysis IS NOT NULL
    ),
    auth.uid(),
    now()
  );
  
  RETURN result;
END;
$function$;

-- Function to save board analysis
CREATE OR REPLACE FUNCTION public.save_daily_challenge_board_analysis(
  challenge_date date,
  word_count integer,
  grid_size integer,
  rarity_score_potential numeric,
  avg_word_length numeric,
  connectivity_score numeric,
  max_score_potential integer,
  letter_distribution jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.daily_challenge_board_analysis (
    challenge_date,
    word_count,
    grid_size,
    rarity_score_potential,
    avg_word_length,
    connectivity_score,
    max_score_potential,
    letter_distribution
  )
  VALUES (
    challenge_date,
    word_count,
    grid_size,
    rarity_score_potential,
    avg_word_length,
    connectivity_score,
    max_score_potential,
    letter_distribution
  )
  ON CONFLICT (challenge_date) 
  DO UPDATE SET
    word_count = EXCLUDED.word_count,
    grid_size = EXCLUDED.grid_size,
    rarity_score_potential = EXCLUDED.rarity_score_potential,
    avg_word_length = EXCLUDED.avg_word_length,
    connectivity_score = EXCLUDED.connectivity_score,
    max_score_potential = EXCLUDED.max_score_potential,
    letter_distribution = EXCLUDED.letter_distribution;
END;
$function$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_board_analysis ON daily_challenge_results(challenge_date, board_analysis);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_board_analysis_date ON daily_challenge_board_analysis(challenge_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_enhanced ON daily_challenge_results(challenge_date, word_count, grid_size);