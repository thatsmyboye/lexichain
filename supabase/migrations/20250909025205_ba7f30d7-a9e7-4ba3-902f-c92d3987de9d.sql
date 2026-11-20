-- Schedule cron jobs for leaderboard reward distribution
-- These will run automatically at the specified times
--
-- IMPORTANT: Before applying this migration, store the service_role JWT in
-- Supabase Vault via the Dashboard (Vault > Secrets > Add secret) with the
-- name 'service_role_key'. The token is read at cron-job execution time so
-- it never needs to be written into version control.

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
