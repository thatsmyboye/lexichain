-- Create a function to calculate benchmark data that bypasses RLS
-- This function runs with security definer privileges to access all players' data
CREATE OR REPLACE FUNCTION public.calculate_daily_challenge_benchmarks(
  target_challenge_date date,
  days_back integer DEFAULT 30
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
  -- Calculate date range for historical data
  start_date := target_challenge_date - days_back;
  
  -- Get all scores from the date range (bypasses RLS due to SECURITY DEFINER)
  SELECT array_agg(dcr.score ORDER BY dcr.score)
  INTO scores_array
  FROM public.daily_challenge_results dcr
  WHERE dcr.challenge_date >= start_date
    AND dcr.challenge_date < target_challenge_date
    AND dcr.score > 0;
  
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

-- Grant execute permission to authenticated users (for the benchmark calculation)
GRANT EXECUTE ON FUNCTION public.calculate_daily_challenge_benchmarks(date, integer) TO authenticated;

-- Create a function specifically for benchmark calculation that can be called from the frontend
CREATE OR REPLACE FUNCTION public.get_benchmark_data(challenge_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO ''
AS $function$
DECLARE
  benchmark_data record;
  result jsonb;
BEGIN
  -- Call the benchmark calculation function
  SELECT * INTO benchmark_data 
  FROM public.calculate_daily_challenge_benchmarks(challenge_date::date, 30);
  
  -- Log the benchmark calculation for debugging
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'BENCHMARK_CALCULATION',
    'INFO',
    jsonb_build_object(
      'challenge_date', challenge_date,
      'total_scores', benchmark_data.total_scores,
      'bronze', benchmark_data.bronze_percentile,
      'silver', benchmark_data.silver_percentile,  
      'gold', benchmark_data.gold_percentile,
      'platinum', benchmark_data.platinum_percentile
    ),
    auth.uid(),
    now()
  );
  
  -- Return the data as jsonb
  result := jsonb_build_object(
    'bronzePercentile', benchmark_data.bronze_percentile,
    'silverPercentile', benchmark_data.silver_percentile,
    'goldPercentile', benchmark_data.gold_percentile, 
    'platinumPercentile', benchmark_data.platinum_percentile,
    'totalScores', benchmark_data.total_scores,
    'minScore', benchmark_data.min_score,
    'maxScore', benchmark_data.max_score,
    'avgScore', benchmark_data.avg_score
  );
  
  RETURN result;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_benchmark_data(text) TO authenticated;