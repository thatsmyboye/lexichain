-- Fix security audit log RLS policies to prevent unauthorized access
-- Drop existing policies to recreate them with stricter security

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Edge functions can insert audit logs" ON public.security_audit_log;

-- Create comprehensive and secure RLS policies for security_audit_log

-- 1. Only users with admin role can SELECT audit logs
CREATE POLICY "Only admins can view security audit logs" 
ON public.security_audit_log 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  )
);

-- 2. Only service role (edge functions) can INSERT audit logs
CREATE POLICY "Only service role can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- 3. Explicitly deny all UPDATE operations (audit logs should be immutable)
CREATE POLICY "Deny all updates to audit logs" 
ON public.security_audit_log 
FOR UPDATE 
TO authenticated, anon, service_role
USING (false);

-- 4. Explicitly deny all DELETE operations (audit logs should be permanent)
CREATE POLICY "Deny all deletes from audit logs" 
ON public.security_audit_log 
FOR DELETE 
TO authenticated, anon, service_role
USING (false);

-- 5. Ensure no anonymous access whatsoever
CREATE POLICY "Deny anonymous access to audit logs" 
ON public.security_audit_log 
FOR ALL
TO anon
USING (false);

-- Add additional security function to validate admin access with enhanced checks
CREATE OR REPLACE FUNCTION public.validate_audit_log_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    -- Log unauthorized access attempt
    INSERT INTO public.security_audit_log (event_type, event_level, event_details, created_at)
    VALUES (
      'UNAUTHORIZED_AUDIT_LOG_ACCESS_ATTEMPT',
      'ERROR',
      jsonb_build_object(
        'reason', 'unauthenticated_user',
        'timestamp', now(),
        'ip_address', 'unknown'
      ),
      now()
    );
    RETURN false;
  END IF;
  
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  ) THEN
    -- Log unauthorized access attempt by authenticated user
    INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
    VALUES (
      'UNAUTHORIZED_AUDIT_LOG_ACCESS_ATTEMPT',
      'ERROR',
      jsonb_build_object(
        'reason', 'insufficient_privileges',
        'required_role', 'admin',
        'timestamp', now()
      ),
      auth.uid(),
      now()
    );
    RETURN false;
  END IF;
  
  -- Log successful audit log access for monitoring
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'AUDIT_LOG_ACCESS_GRANTED',
    'INFO',
    jsonb_build_object(
      'timestamp', now(),
      'access_type', 'admin_audit_review'
    ),
    auth.uid(),
    now()
  );
  
  RETURN true;
END;
$$;

-- Update the admin SELECT policy to use the enhanced validation function
DROP POLICY IF EXISTS "Only admins can view security audit logs" ON public.security_audit_log;

CREATE POLICY "Enhanced admin access to security audit logs" 
ON public.security_audit_log 
FOR SELECT 
TO authenticated
USING (public.validate_audit_log_access());

-- Add table-level security comment
COMMENT ON TABLE public.security_audit_log IS 'Security audit logs containing sensitive information. Access restricted to admin users only. All operations are logged and monitored.';