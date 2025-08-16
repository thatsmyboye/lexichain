-- Update function to fix security warning by setting search_path
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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