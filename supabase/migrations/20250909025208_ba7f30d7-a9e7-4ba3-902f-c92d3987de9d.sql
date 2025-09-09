-- Schedule cron jobs for leaderboard reward distribution
-- These will run automatically at the specified times

-- Daily rewards: Run at 5:01 AM UTC (12:01 AM EST) every day
SELECT cron.schedule(
  'distribute-daily-leaderboard-rewards',
  '1 5 * * *', 
  $$
  SELECT net.http_post(
    url:='https://bfmofulvsqojwuqyhfqq.supabase.co/functions/v1/distribute-daily-rewards',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbW9mdWx2c3Fvand1cXloZnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTc1OSwiZXhwIjoyMDcwNzc1NzU5fQ.eKovvFgI7t0PQBeGVr1HPccxqrMrPsFlBeHcTj-b5ZE"}'::jsonb,
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
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbW9mdWx2c3Fvand1cXloZnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTc1OSwiZXhwIjoyMDcwNzc1NzU5fQ.eKovvFgI7t0PQBeGVr1HPccxqrMrPsFlBeHcTj-b5ZE"}'::jsonb,
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
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbW9mdWx2c3Fvand1cXloZnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTc1OSwiZXhwIjoyMDcwNzc1NzU5fQ.eKovvFgI7t0PQBeGVr1HPccxqrMrPsFlBeHcTj-b5ZE"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);