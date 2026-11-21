-- Add game_mode column to daily_challenge_results to differentiate between daily (4x4) and daily_5x5 modes
-- Previously, both modes shared the same (user_id, challenge_date) unique key, causing the second result to overwrite the first

-- Step 1: Add game_mode column to daily_challenge_results
ALTER TABLE public.daily_challenge_results 
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'daily';

-- Step 2: Drop the old unique constraint and create a new one including game_mode
ALTER TABLE public.daily_challenge_results 
  DROP CONSTRAINT IF EXISTS daily_challenge_results_user_id_challenge_date_key;

ALTER TABLE public.daily_challenge_results 
  ADD CONSTRAINT daily_challenge_results_user_id_challenge_date_game_mode_key 
  UNIQUE (user_id, challenge_date, game_mode);

-- Step 3: Add game_mode column to daily_challenge_board_analysis
ALTER TABLE public.daily_challenge_board_analysis 
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'daily';

-- Step 4: Drop the old primary key and create a new composite primary key
ALTER TABLE public.daily_challenge_board_analysis 
  DROP CONSTRAINT IF EXISTS daily_challenge_board_analysis_pkey;

ALTER TABLE public.daily_challenge_board_analysis 
  ADD CONSTRAINT daily_challenge_board_analysis_pkey 
  PRIMARY KEY (challenge_date, game_mode);

-- Step 5: Update save_daily_challenge_board_analysis function to accept game_mode
CREATE OR REPLACE FUNCTION public.save_daily_challenge_board_analysis(
  challenge_date date,
  word_count integer,
  grid_size integer,
  rarity_score_potential numeric,
  avg_word_length numeric,
  connectivity_score numeric,
  max_score_potential integer,
  letter_distribution jsonb,
  p_game_mode text DEFAULT 'daily'
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
    letter_distribution,
    game_mode
  )
  VALUES (
    challenge_date,
    word_count,
    grid_size,
    rarity_score_potential,
    avg_word_length,
    connectivity_score,
    max_score_potential,
    letter_distribution,
    p_game_mode
  )
  ON CONFLICT (challenge_date, game_mode) 
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

-- Step 6: Update get_enhanced_benchmark_data to filter by game_mode
CREATE OR REPLACE FUNCTION public.get_enhanced_benchmark_data(challenge_date text, p_game_mode text DEFAULT 'daily')
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
  SELECT * INTO benchmark_data 
  FROM public.calculate_daily_challenge_benchmarks(challenge_date::date, 30, p_game_mode);
  
  SELECT * INTO board_analysis
  FROM public.daily_challenge_board_analysis ba
  WHERE ba.challenge_date = get_enhanced_benchmark_data.challenge_date::date
    AND ba.game_mode = p_game_mode;
  
  IF board_analysis IS NOT NULL THEN
    board_difficulty_modifier := GREATEST(0.5, LEAST(2.0, 
      (board_analysis.rarity_score_potential / 100.0) * 
      (1.0 / GREATEST(0.1, board_analysis.connectivity_score / 100.0))
    ));
  END IF;
  
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
  
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'ENHANCED_BENCHMARK_CALCULATION',
    'INFO',
    jsonb_build_object(
      'challenge_date', challenge_date,
      'game_mode', p_game_mode,
      'difficulty_modifier', board_difficulty_modifier,
      'has_board_analysis', board_analysis IS NOT NULL
    ),
    auth.uid(),
    now()
  );
  
  RETURN result;
END;
$function$;

-- Step 7: Update calculate_daily_challenge_benchmarks to filter by game_mode
CREATE OR REPLACE FUNCTION public.calculate_daily_challenge_benchmarks(
  target_challenge_date date,
  days_back integer DEFAULT 30,
  p_game_mode text DEFAULT 'daily'
)
RETURNS TABLE (
  bronze_percentile integer,
  silver_percentile integer, 
  gold_percentile integer,
  platinum_percentile integer,
  total_scores integer,
  min_score integer,
  max_score integer,
  avg_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  start_date date;
  scores_array integer[];
  sorted_scores integer[];
  total_count integer;
BEGIN
  start_date := target_challenge_date - days_back;
  
  SELECT array_agg(dcr.score ORDER BY dcr.score)
  INTO scores_array
  FROM public.daily_challenge_results dcr
  WHERE dcr.challenge_date >= start_date
    AND dcr.challenge_date < target_challenge_date
    AND dcr.score > 0
    AND dcr.game_mode = p_game_mode;
  
  IF scores_array IS NULL OR array_length(scores_array, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0::numeric;
    RETURN;
  END IF;
  
  total_count := array_length(scores_array, 1);
  
  RETURN QUERY SELECT 
    scores_array[GREATEST(1, LEAST(total_count, (total_count * 0.30)::integer))] as bronze_percentile,
    scores_array[GREATEST(1, LEAST(total_count, (total_count * 0.50)::integer))] as silver_percentile,
    scores_array[GREATEST(1, LEAST(total_count, (total_count * 0.85)::integer))] as gold_percentile,
    scores_array[GREATEST(1, LEAST(total_count, (total_count * 0.98)::integer))] as platinum_percentile,
    total_count,
    scores_array[1] as min_score,
    scores_array[total_count] as max_score,
    (SELECT avg(score)::numeric FROM unnest(scores_array) as score) as avg_score;
END;
$function$;

-- Step 8: Update leaderboard functions to accept game_mode parameter

-- Daily leaderboard
CREATE OR REPLACE FUNCTION get_daily_leaderboard(challenge_date DATE, p_game_mode TEXT DEFAULT 'daily')
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    score INTEGER,
    rank BIGINT
) AS $$
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
      AND dcr.game_mode = p_game_mode
    ORDER BY dcr.score DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly leaderboard
CREATE OR REPLACE FUNCTION get_weekly_leaderboard(week_start DATE, p_game_mode TEXT DEFAULT 'daily')
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    best_score INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        MAX(dcr.score) as best_score,
        ROW_NUMBER() OVER (ORDER BY MAX(dcr.score) DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE dcr.challenge_date >= week_start 
    AND dcr.challenge_date < week_start + INTERVAL '7 days'
    AND dcr.game_mode = p_game_mode
    GROUP BY dcr.user_id, p.display_name
    ORDER BY MAX(dcr.score) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly leaderboard
CREATE OR REPLACE FUNCTION get_monthly_leaderboard(year INTEGER, month INTEGER, p_game_mode TEXT DEFAULT 'daily')
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    best_score INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        MAX(dcr.score) as best_score,
        ROW_NUMBER() OVER (ORDER BY MAX(dcr.score) DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE EXTRACT(YEAR FROM dcr.challenge_date) = year
    AND EXTRACT(MONTH FROM dcr.challenge_date) = month
    AND dcr.game_mode = p_game_mode
    GROUP BY dcr.user_id, p.display_name
    ORDER BY MAX(dcr.score) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Update indexes
DROP INDEX IF EXISTS idx_daily_challenge_results_board_analysis;
DROP INDEX IF EXISTS idx_daily_challenge_results_enhanced;
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_mode ON daily_challenge_results(game_mode);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_date_mode ON daily_challenge_results(challenge_date, game_mode);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_enhanced ON daily_challenge_results(challenge_date, game_mode, word_count, grid_size);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_board_analysis_date_mode ON daily_challenge_board_analysis(challenge_date, game_mode);
