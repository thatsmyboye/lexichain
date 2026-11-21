-- Give daily challenge results a game mode, so Daily (4x4) and Daily 5
-- (5x5) results for the same day are stored separately.
--
-- The app has written `game_mode` on every daily result since 2026-02-17,
-- but the migration that added the column was never applied to production,
-- so those saves were rejected. This is a corrected version of that
-- migration. It is written to be safe to run more than once.
--
-- What it fixes compared with the version that was never applied:
--   * Drops BOTH existing unique constraints on (user_id, challenge_date).
--     Production has two; leaving one would still block a second mode.
--   * Drops each function's old signature before creating the new one.
--     Adding an argument with CREATE OR REPLACE creates a second function,
--     and calls that pass only the original arguments become ambiguous.
--   * Keeps `SET search_path` on the leaderboard functions.
--   * Fixes save_daily_challenge_board_analysis, which has failed on every
--     call because `ON CONFLICT (challenge_date)` is ambiguous with the
--     function's own `challenge_date` argument.
--   * Limits game_mode to the modes the app sends.

-- ---------------------------------------------------------------------
-- 1. daily_challenge_results
-- ---------------------------------------------------------------------

ALTER TABLE public.daily_challenge_results
  ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'daily';

-- game_mode is part of the unique key and is supplied by the client, so
-- restrict it to known modes. Add new modes here when the app gains them.
ALTER TABLE public.daily_challenge_results
  DROP CONSTRAINT IF EXISTS daily_challenge_results_game_mode_check;
ALTER TABLE public.daily_challenge_results
  ADD CONSTRAINT daily_challenge_results_game_mode_check
  CHECK (game_mode IN ('daily', 'daily_5x5'));

-- One result per user, per day, per mode.
ALTER TABLE public.daily_challenge_results
  DROP CONSTRAINT IF EXISTS daily_challenge_results_user_id_challenge_date_key;
ALTER TABLE public.daily_challenge_results
  DROP CONSTRAINT IF EXISTS unique_user_challenge_date;
ALTER TABLE public.daily_challenge_results
  DROP CONSTRAINT IF EXISTS daily_challenge_results_user_id_challenge_date_game_mode_key;
ALTER TABLE public.daily_challenge_results
  ADD CONSTRAINT daily_challenge_results_user_id_challenge_date_game_mode_key
  UNIQUE (user_id, challenge_date, game_mode);

-- A btree index over the whole board_analysis JSON serves no query and can
-- reject rows whose JSON is too large to index.
DROP INDEX IF EXISTS public.idx_daily_challenge_results_board_analysis;

-- Leaderboards and benchmarks look results up by date and mode.
DROP INDEX IF EXISTS public.idx_daily_challenge_results_enhanced;
CREATE INDEX IF NOT EXISTS idx_daily_challenge_results_enhanced
  ON public.daily_challenge_results (challenge_date, game_mode, word_count, grid_size);

-- ---------------------------------------------------------------------
-- 2. daily_challenge_board_analysis
-- ---------------------------------------------------------------------

ALTER TABLE public.daily_challenge_board_analysis
  ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_challenge_board_analysis
  DROP CONSTRAINT IF EXISTS daily_challenge_board_analysis_game_mode_check;
ALTER TABLE public.daily_challenge_board_analysis
  ADD CONSTRAINT daily_challenge_board_analysis_game_mode_check
  CHECK (game_mode IN ('daily', 'daily_5x5'));

-- One analysis per day, per mode.
ALTER TABLE public.daily_challenge_board_analysis
  DROP CONSTRAINT IF EXISTS daily_challenge_board_analysis_pkey;
ALTER TABLE public.daily_challenge_board_analysis
  ADD CONSTRAINT daily_challenge_board_analysis_pkey
  PRIMARY KEY (challenge_date, game_mode);

-- ---------------------------------------------------------------------
-- 3. Functions
--
-- Each gains a trailing `p_game_mode` argument that defaults to 'daily',
-- so existing callers that pass only the original arguments keep working
-- and keep seeing Daily (4x4) results. The old signature is dropped first
-- so that only one function of each name exists.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.save_daily_challenge_board_analysis(date, integer, integer, numeric, numeric, numeric, integer, jsonb);

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
    game_mode,
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
    p_game_mode,
    word_count,
    grid_size,
    rarity_score_potential,
    avg_word_length,
    connectivity_score,
    max_score_potential,
    letter_distribution
  )
  -- Named constraint, not a column list: the arguments share the columns'
  -- names, and a column list here is ambiguous inside PL/pgSQL.
  ON CONFLICT ON CONSTRAINT daily_challenge_board_analysis_pkey
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

DROP FUNCTION IF EXISTS public.calculate_daily_challenge_benchmarks(date, integer);

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
  total_count integer;
BEGIN
  -- Calculate date range for historical data
  start_date := target_challenge_date - days_back;

  -- Get all scores for this mode from the date range (bypasses RLS due to SECURITY DEFINER)
  SELECT array_agg(dcr.score ORDER BY dcr.score)
  INTO scores_array
  FROM public.daily_challenge_results dcr
  WHERE dcr.challenge_date >= start_date
    AND dcr.challenge_date < target_challenge_date
    AND dcr.score > 0
    AND dcr.game_mode = p_game_mode;

  -- Handle case where no data is available
  IF scores_array IS NULL OR array_length(scores_array, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0::numeric;
    RETURN;
  END IF;

  total_count := array_length(scores_array, 1);

  -- Calculate percentiles (30th, 50th, 85th, 98th)
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

DROP FUNCTION IF EXISTS public.get_enhanced_benchmark_data(text);

CREATE OR REPLACE FUNCTION public.get_enhanced_benchmark_data(
  challenge_date text,
  p_game_mode text DEFAULT 'daily'
)
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
  FROM public.calculate_daily_challenge_benchmarks(challenge_date::date, 30, p_game_mode);

  -- Get board analysis for difficulty adjustment
  SELECT * INTO board_analysis
  FROM public.daily_challenge_board_analysis ba
  WHERE ba.challenge_date = get_enhanced_benchmark_data.challenge_date::date
    AND ba.game_mode = p_game_mode;

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

DROP FUNCTION IF EXISTS public.get_daily_leaderboard(date);

CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(
  challenge_date date,
  p_game_mode text DEFAULT 'daily'
)
RETURNS TABLE (user_id uuid, display_name text, score integer, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(date);

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  week_start date,
  p_game_mode text DEFAULT 'daily'
)
RETURNS TABLE (user_id uuid, display_name text, best_score integer, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.get_monthly_leaderboard(integer, integer);

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(
  year integer,
  month integer,
  p_game_mode text DEFAULT 'daily'
)
RETURNS TABLE (user_id uuid, display_name text, best_score integer, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Tell the API layer the function signatures changed.
NOTIFY pgrst, 'reload schema';
