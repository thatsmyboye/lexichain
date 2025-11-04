-- Grant admin role to paul.t.boye@gmail.com
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user ID for the specified email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'paul.t.boye@gmail.com';
  
  -- If user exists, grant admin role
  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log the admin grant
    INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
    VALUES (
      'ADMIN_ROLE_GRANTED',
      'INFO',
      jsonb_build_object('target_user_email', 'paul.t.boye@gmail.com', 'granted_by', 'system'),
      target_user_id,
      now()
    );
  END IF;
END $$;