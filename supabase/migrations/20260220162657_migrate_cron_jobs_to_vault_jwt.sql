-- Migrate leaderboard reward cron jobs from hardcoded JWT to Vault-based secrets.
-- Supabase tracks applied migrations in schema_migrations and never re-runs them.
-- If the original cron migration was already applied, it created jobs with hardcoded
-- JWT tokens. This migration updates those jobs to use vault.decrypted_secrets
-- instead, ensuring the security improvement takes effect in all environments.
--
-- Before applying: Store the service_role JWT in Supabase Vault (Vault > Secrets)
-- with the name 'service_role_key'.

-- Unschedule existing jobs (they may have hardcoded tokens from the original migration)
SELECT cron.unschedule('distribute-daily-leaderboard-rewards');
SELECT cron.unschedule('distribute-weekly-leaderboard-rewards');
SELECT cron.unschedule('distribute-monthly-leaderboard-rewards');

-- Re-schedule with vault-based JWT
-- Daily rewards: Run at 5:01 AM UTC (12:01 AM EST) every day
SELECT cron.schedule(
  'distribute-daily-leaderboard-rewards',
  '1 5 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfmofulvsqojwuqyhfqq.supabase.co/functions/v1/distribute-daily-rewards',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret
         FROM vault.decrypted_secrets
         WHERE name = 'service_role_key'
         LIMIT 1),
        (SELECT 1/0)  -- Fail loudly if service_role_key secret is missing from vault
      )
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Weekly rewards: Run at 5:01 AM UTC (12:01 AM EST) every Monday
SELECT cron.schedule(
  'distribute-weekly-leaderboard-rewards',
  '1 5 * * 1',
  $$
  SELECT net.http_post(
    url:='https://bfmofulvsqojwuqyhfqq.supabase.co/functions/v1/distribute-weekly-rewards',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret
         FROM vault.decrypted_secrets
         WHERE name = 'service_role_key'
         LIMIT 1),
        (SELECT 1/0)  -- Fail loudly if service_role_key secret is missing from vault
      )
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Monthly rewards: Run at 5:01 AM UTC (12:01 AM EST) on the 1st of every month
SELECT cron.schedule(
  'distribute-monthly-leaderboard-rewards',
  '1 5 1 * *',
  $$
  SELECT net.http_post(
    url:='https://bfmofulvsqojwuqyhfqq.supabase.co/functions/v1/distribute-monthly-rewards',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret
         FROM vault.decrypted_secrets
         WHERE name = 'service_role_key'
         LIMIT 1),
        (SELECT 1/0)  -- Fail loudly if service_role_key secret is missing from vault
      )
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);
