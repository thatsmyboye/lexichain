-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to clean up unconfirmed users
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete unconfirmed users older than 65 minutes
  DELETE FROM auth.users
  WHERE 
    email_confirmed_at IS NULL 
    AND created_at < NOW() - INTERVAL '65 minutes';
    
  -- Also clean up any orphaned profiles for deleted users
  DELETE FROM public.profiles
  WHERE user_id NOT IN (SELECT id FROM auth.users);
END;
$$;

-- Schedule the cleanup function to run every 10 minutes
SELECT cron.schedule(
  'cleanup-unconfirmed-users',
  '*/10 * * * *', -- Every 10 minutes
  $$SELECT public.cleanup_unconfirmed_users();$$
);