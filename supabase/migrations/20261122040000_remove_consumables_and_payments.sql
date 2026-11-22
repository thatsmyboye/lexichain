-- Lexichain is free to play: remove consumables, the rewards that granted
-- them, and what was left of the paid mode unlock.
--
-- Removes:
--   * the three scheduled jobs that called the reward edge functions
--   * the starter-consumables grant on sign-up
--   * the leaderboard reward functions
--   * user_consumables, consumable_transactions, leaderboard_rewards and
--     user_unlocked_modes (the last two are empty)
--
-- This deletes every player's consumable inventory and history. It does not
-- touch scores, streaks, goals, profiles or leaderboards.

-- 1. Scheduled reward distribution
DO $$
DECLARE
  job text;
BEGIN
  FOREACH job IN ARRAY ARRAY[
    'distribute-daily-leaderboard-rewards',
    'distribute-weekly-leaderboard-rewards',
    'distribute-monthly-leaderboard-rewards'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job) THEN
      PERFORM cron.unschedule(job);
    END IF;
  END LOOP;
END $$;

-- 2. Starter consumables on sign-up. The trigger goes first: sign-ups would
--    fail if it outlived the function it calls.
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_consumables();
DROP FUNCTION IF EXISTS public.grant_starter_consumables(uuid);

-- 3. Leaderboard rewards
DROP FUNCTION IF EXISTS public.distribute_daily_leaderboard_rewards(date);
DROP FUNCTION IF EXISTS public.distribute_weekly_leaderboard_rewards(date);
DROP FUNCTION IF EXISTS public.distribute_monthly_leaderboard_rewards(integer, integer);
DROP TABLE IF EXISTS public.leaderboard_rewards;

-- 4. Consumable inventory and history (their triggers and policies go with them)
DROP TABLE IF EXISTS public.consumable_transactions;
DROP TABLE IF EXISTS public.user_consumables;
DROP FUNCTION IF EXISTS public.audit_consumable_transaction();

-- 5. Paid mode unlocks. Every mode is open to everyone; nothing reads this.
DROP TABLE IF EXISTS public.user_unlocked_modes;
