-- Create leaderboard rewards tracking table
CREATE TABLE public.leaderboard_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('daily', 'weekly', 'monthly')),
  period TEXT NOT NULL, -- '2025-01-08', '2025-W02', '2025-01' format
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
  rewards_given JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, leaderboard_type, period)
);

-- Enable RLS
ALTER TABLE public.leaderboard_rewards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own leaderboard rewards" 
ON public.leaderboard_rewards 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage all leaderboard rewards" 
ON public.leaderboard_rewards 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_leaderboard_rewards_updated_at
BEFORE UPDATE ON public.leaderboard_rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to distribute daily leaderboard rewards
CREATE OR REPLACE FUNCTION public.distribute_daily_leaderboard_rewards(target_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  reward_config jsonb;
  leaderboard_entry record;
  rewards_given jsonb[];
  total_rewards integer := 0;
BEGIN
  -- Define daily reward configuration
  reward_config := '{
    "1": [{"id": "hint_revealer", "quantity": 5}, {"id": "score_multiplier", "quantity": 2}],
    "2": [{"id": "hint_revealer", "quantity": 4}, {"id": "score_multiplier", "quantity": 1}],
    "3": [{"id": "hint_revealer", "quantity": 3}, {"id": "hammer", "quantity": 1}],
    "4": [{"id": "hint_revealer", "quantity": 3}],
    "5": [{"id": "hint_revealer", "quantity": 2}, {"id": "hammer", "quantity": 1}],
    "6": [{"id": "hint_revealer", "quantity": 2}],
    "7": [{"id": "hint_revealer", "quantity": 2}],
    "8": [{"id": "hint_revealer", "quantity": 1}, {"id": "hammer", "quantity": 1}],
    "9": [{"id": "hint_revealer", "quantity": 1}],
    "10": [{"id": "hint_revealer", "quantity": 1}]
  }'::jsonb;

  -- Get top 10 from daily leaderboard for the target date
  FOR leaderboard_entry IN
    SELECT user_id, display_name, score, rank::integer
    FROM public.get_daily_leaderboard(target_date)
    WHERE rank <= 10
  LOOP
    -- Check if rewards already distributed
    IF NOT EXISTS (
      SELECT 1 FROM public.leaderboard_rewards 
      WHERE user_id = leaderboard_entry.user_id 
      AND leaderboard_type = 'daily' 
      AND period = target_date::text
    ) THEN
      -- Get reward configuration for this rank
      DECLARE
        rank_rewards jsonb;
        reward_item jsonb;
      BEGIN
        rank_rewards := reward_config -> leaderboard_entry.rank::text;
        
        -- Award each consumable in the rank's reward set
        FOR reward_item IN SELECT * FROM jsonb_array_elements(rank_rewards)
        LOOP
          -- Add to user's consumable inventory
          INSERT INTO public.user_consumables (user_id, consumable_id, quantity)
          VALUES (
            leaderboard_entry.user_id, 
            reward_item ->> 'id', 
            (reward_item ->> 'quantity')::integer
          )
          ON CONFLICT (user_id, consumable_id) 
          DO UPDATE SET 
            quantity = user_consumables.quantity + (reward_item ->> 'quantity')::integer,
            updated_at = now();

          -- Record transaction
          INSERT INTO public.consumable_transactions (
            user_id, 
            consumable_id, 
            quantity, 
            transaction_type, 
            source
          )
          VALUES (
            leaderboard_entry.user_id,
            reward_item ->> 'id',
            (reward_item ->> 'quantity')::integer,
            'earned',
            'daily_leaderboard_rank_' || leaderboard_entry.rank
          );
        END LOOP;

        -- Record reward distribution
        INSERT INTO public.leaderboard_rewards (
          user_id, 
          leaderboard_type, 
          period, 
          rank, 
          rewards_given
        )
        VALUES (
          leaderboard_entry.user_id,
          'daily',
          target_date::text,
          leaderboard_entry.rank,
          rank_rewards
        );

        rewards_given := array_append(rewards_given, jsonb_build_object(
          'user_id', leaderboard_entry.user_id,
          'display_name', leaderboard_entry.display_name,
          'rank', leaderboard_entry.rank,
          'score', leaderboard_entry.score,
          'rewards', rank_rewards
        ));
        
        total_rewards := total_rewards + 1;
      END;
    END IF;
  END LOOP;

  -- Log the distribution event
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, created_at)
  VALUES (
    'DAILY_LEADERBOARD_REWARDS_DISTRIBUTED',
    'INFO',
    jsonb_build_object(
      'target_date', target_date,
      'total_rewards_distributed', total_rewards,
      'rewards_given', rewards_given
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_date', target_date,
    'total_rewards_distributed', total_rewards,
    'rewards_given', rewards_given
  );
END;
$$;

-- Create function to distribute weekly leaderboard rewards
CREATE OR REPLACE FUNCTION public.distribute_weekly_leaderboard_rewards(target_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  reward_config jsonb;
  leaderboard_entry record;
  rewards_given jsonb[];
  total_rewards integer := 0;
  week_period text;
BEGIN
  -- Format week period as 'YYYY-WXX'
  week_period := to_char(target_week_start, 'IYYY-W"W"IW');

  -- Define weekly reward configuration (higher than daily)
  reward_config := '{
    "1": [{"id": "hint_revealer", "quantity": 8}, {"id": "score_multiplier", "quantity": 4}, {"id": "extra_moves", "quantity": 1}],
    "2": [{"id": "hint_revealer", "quantity": 6}, {"id": "score_multiplier", "quantity": 3}, {"id": "hammer", "quantity": 2}],
    "3": [{"id": "hint_revealer", "quantity": 5}, {"id": "score_multiplier", "quantity": 2}, {"id": "hammer", "quantity": 1}],
    "4": [{"id": "hint_revealer", "quantity": 4}, {"id": "score_multiplier", "quantity": 1}, {"id": "hammer", "quantity": 1}],
    "5": [{"id": "hint_revealer", "quantity": 4}, {"id": "hammer", "quantity": 2}],
    "6": [{"id": "hint_revealer", "quantity": 3}, {"id": "score_multiplier", "quantity": 1}],
    "7": [{"id": "hint_revealer", "quantity": 3}, {"id": "hammer", "quantity": 1}],
    "8": [{"id": "hint_revealer", "quantity": 2}, {"id": "hammer", "quantity": 1}],
    "9": [{"id": "hint_revealer", "quantity": 2}],
    "10": [{"id": "hint_revealer", "quantity": 2}]
  }'::jsonb;

  -- Get top 10 from weekly leaderboard
  FOR leaderboard_entry IN
    SELECT user_id, display_name, best_score as score, rank::integer
    FROM public.get_weekly_leaderboard(target_week_start)
    WHERE rank <= 10
  LOOP
    -- Check if rewards already distributed
    IF NOT EXISTS (
      SELECT 1 FROM public.leaderboard_rewards 
      WHERE user_id = leaderboard_entry.user_id 
      AND leaderboard_type = 'weekly' 
      AND period = week_period
    ) THEN
      -- Award rewards same logic as daily but with weekly config
      DECLARE
        rank_rewards jsonb;
        reward_item jsonb;
      BEGIN
        rank_rewards := reward_config -> leaderboard_entry.rank::text;
        
        FOR reward_item IN SELECT * FROM jsonb_array_elements(rank_rewards)
        LOOP
          INSERT INTO public.user_consumables (user_id, consumable_id, quantity)
          VALUES (
            leaderboard_entry.user_id, 
            reward_item ->> 'id', 
            (reward_item ->> 'quantity')::integer
          )
          ON CONFLICT (user_id, consumable_id) 
          DO UPDATE SET 
            quantity = user_consumables.quantity + (reward_item ->> 'quantity')::integer,
            updated_at = now();

          INSERT INTO public.consumable_transactions (
            user_id, consumable_id, quantity, transaction_type, source
          )
          VALUES (
            leaderboard_entry.user_id,
            reward_item ->> 'id',
            (reward_item ->> 'quantity')::integer,
            'earned',
            'weekly_leaderboard_rank_' || leaderboard_entry.rank
          );
        END LOOP;

        INSERT INTO public.leaderboard_rewards (
          user_id, leaderboard_type, period, rank, rewards_given
        )
        VALUES (
          leaderboard_entry.user_id, 'weekly', week_period, leaderboard_entry.rank, rank_rewards
        );

        rewards_given := array_append(rewards_given, jsonb_build_object(
          'user_id', leaderboard_entry.user_id,
          'display_name', leaderboard_entry.display_name,
          'rank', leaderboard_entry.rank,
          'score', leaderboard_entry.score,
          'rewards', rank_rewards
        ));
        
        total_rewards := total_rewards + 1;
      END;
    END IF;
  END LOOP;

  INSERT INTO public.security_audit_log (event_type, event_level, event_details, created_at)
  VALUES (
    'WEEKLY_LEADERBOARD_REWARDS_DISTRIBUTED',
    'INFO',
    jsonb_build_object(
      'target_week_start', target_week_start,
      'week_period', week_period,
      'total_rewards_distributed', total_rewards,
      'rewards_given', rewards_given
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_week_start', target_week_start,
    'week_period', week_period,
    'total_rewards_distributed', total_rewards,
    'rewards_given', rewards_given
  );
END;
$$;

-- Create function to distribute monthly leaderboard rewards
CREATE OR REPLACE FUNCTION public.distribute_monthly_leaderboard_rewards(target_year integer, target_month integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  reward_config jsonb;
  leaderboard_entry record;
  rewards_given jsonb[];
  total_rewards integer := 0;
  month_period text;
BEGIN
  -- Format month period as 'YYYY-MM'
  month_period := target_year::text || '-' || lpad(target_month::text, 2, '0');

  -- Define monthly reward configuration (highest rewards)
  reward_config := '{
    "1": [{"id": "hint_revealer", "quantity": 15}, {"id": "score_multiplier", "quantity": 8}, {"id": "extra_moves", "quantity": 3}, {"id": "hammer", "quantity": 5}],
    "2": [{"id": "hint_revealer", "quantity": 12}, {"id": "score_multiplier", "quantity": 6}, {"id": "extra_moves", "quantity": 2}, {"id": "hammer", "quantity": 4}],
    "3": [{"id": "hint_revealer", "quantity": 10}, {"id": "score_multiplier", "quantity": 5}, {"id": "extra_moves", "quantity": 2}, {"id": "hammer", "quantity": 3}],
    "4": [{"id": "hint_revealer", "quantity": 8}, {"id": "score_multiplier", "quantity": 4}, {"id": "extra_moves", "quantity": 1}, {"id": "hammer", "quantity": 3}],
    "5": [{"id": "hint_revealer", "quantity": 7}, {"id": "score_multiplier", "quantity": 3}, {"id": "extra_moves", "quantity": 1}, {"id": "hammer", "quantity": 2}],
    "6": [{"id": "hint_revealer", "quantity": 6}, {"id": "score_multiplier", "quantity": 3}, {"id": "hammer", "quantity": 2}],
    "7": [{"id": "hint_revealer", "quantity": 5}, {"id": "score_multiplier", "quantity": 2}, {"id": "hammer", "quantity": 2}],
    "8": [{"id": "hint_revealer", "quantity": 4}, {"id": "score_multiplier", "quantity": 2}, {"id": "hammer", "quantity": 1}],
    "9": [{"id": "hint_revealer", "quantity": 4}, {"id": "score_multiplier", "quantity": 1}, {"id": "hammer", "quantity": 1}],
    "10": [{"id": "hint_revealer", "quantity": 3}, {"id": "score_multiplier", "quantity": 1}]
  }'::jsonb;

  -- Get top 10 from monthly leaderboard
  FOR leaderboard_entry IN
    SELECT user_id, display_name, best_score as score, rank::integer
    FROM public.get_monthly_leaderboard(target_year, target_month)
    WHERE rank <= 10
  LOOP
    -- Check if rewards already distributed
    IF NOT EXISTS (
      SELECT 1 FROM public.leaderboard_rewards 
      WHERE user_id = leaderboard_entry.user_id 
      AND leaderboard_type = 'monthly' 
      AND period = month_period
    ) THEN
      -- Award rewards same logic as daily/weekly but with monthly config
      DECLARE
        rank_rewards jsonb;
        reward_item jsonb;
      BEGIN
        rank_rewards := reward_config -> leaderboard_entry.rank::text;
        
        FOR reward_item IN SELECT * FROM jsonb_array_elements(rank_rewards)
        LOOP
          INSERT INTO public.user_consumables (user_id, consumable_id, quantity)
          VALUES (
            leaderboard_entry.user_id, 
            reward_item ->> 'id', 
            (reward_item ->> 'quantity')::integer
          )
          ON CONFLICT (user_id, consumable_id) 
          DO UPDATE SET 
            quantity = user_consumables.quantity + (reward_item ->> 'quantity')::integer,
            updated_at = now();

          INSERT INTO public.consumable_transactions (
            user_id, consumable_id, quantity, transaction_type, source
          )
          VALUES (
            leaderboard_entry.user_id,
            reward_item ->> 'id',
            (reward_item ->> 'quantity')::integer,
            'earned',
            'monthly_leaderboard_rank_' || leaderboard_entry.rank
          );
        END LOOP;

        INSERT INTO public.leaderboard_rewards (
          user_id, leaderboard_type, period, rank, rewards_given
        )
        VALUES (
          leaderboard_entry.user_id, 'monthly', month_period, leaderboard_entry.rank, rank_rewards
        );

        rewards_given := array_append(rewards_given, jsonb_build_object(
          'user_id', leaderboard_entry.user_id,
          'display_name', leaderboard_entry.display_name,
          'rank', leaderboard_entry.rank,
          'score', leaderboard_entry.score,
          'rewards', rank_rewards
        ));
        
        total_rewards := total_rewards + 1;
      END;
    END IF;
  END LOOP;

  INSERT INTO public.security_audit_log (event_type, event_level, event_details, created_at)
  VALUES (
    'MONTHLY_LEADERBOARD_REWARDS_DISTRIBUTED',
    'INFO',
    jsonb_build_object(
      'target_year', target_year,
      'target_month', target_month,
      'month_period', month_period,
      'total_rewards_distributed', total_rewards,
      'rewards_given', rewards_given
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_year', target_year,
    'target_month', target_month,
    'month_period', month_period,
    'total_rewards_distributed', total_rewards,
    'rewards_given', rewards_given
  );
END;
$$;