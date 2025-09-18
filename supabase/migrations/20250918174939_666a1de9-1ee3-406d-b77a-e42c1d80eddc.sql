-- Priority 1: Fix Game Analytics Exposure (Critical)
-- Drop the overly permissive policy that allows all authenticated users to view analytics
DROP POLICY IF EXISTS "Daily challenge board analysis is viewable by authenticated use" ON public.daily_challenge_board_analysis;

-- Create a restrictive policy that only allows admin users and service role to view analytics
CREATE POLICY "Only admins can view board analysis" ON public.daily_challenge_board_analysis
FOR SELECT 
USING (
  auth.jwt() ->> 'role' = 'service_role' OR 
  public.current_user_has_role('admin'::public.app_role)
);

-- Priority 2: Add Server-Side Content Validation for Display Names
-- Create a server-side display name validation function
CREATE OR REPLACE FUNCTION public.validate_display_name_server_side(display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  validation_result jsonb;
BEGIN
  -- Basic validation checks
  IF display_name IS NULL OR trim(display_name) = '' THEN
    RETURN jsonb_build_object('isValid', false, 'error', 'Display name cannot be empty');
  END IF;
  
  IF length(trim(display_name)) < 2 THEN
    RETURN jsonb_build_object('isValid', false, 'error', 'Display name must be at least 2 characters long');
  END IF;
  
  IF length(trim(display_name)) > 30 THEN
    RETURN jsonb_build_object('isValid', false, 'error', 'Display name cannot be longer than 30 characters');
  END IF;
  
  -- Check for inappropriate content (server-side enforcement)
  -- Basic profanity check - can be expanded
  IF display_name ~* '\b(fuck|shit|bitch|asshole|bastard|nazi|hitler|nigger|faggot|retard|porn|nude|naked|dick|cock|pussy|cocaine|heroin|meth)\b' THEN
    RETURN jsonb_build_object('isValid', false, 'error', 'Display name contains inappropriate content');
  END IF;
  
  -- Check for excessive special characters
  IF (length(display_name) - length(regexp_replace(display_name, '[^a-zA-Z0-9\s]', '', 'g'))) > length(display_name) * 0.5 THEN
    RETURN jsonb_build_object('isValid', false, 'error', 'Display name contains too many special characters');
  END IF;
  
  -- Log validation attempt for security monitoring
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'DISPLAY_NAME_VALIDATION',
    'INFO',
    jsonb_build_object('display_name_length', length(display_name), 'validation_passed', true),
    auth.uid(),
    now()
  );
  
  RETURN jsonb_build_object('isValid', true);
END;
$$;

-- Add a trigger to enforce server-side validation on profile updates
CREATE OR REPLACE FUNCTION public.enforce_display_name_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  validation_result jsonb;
BEGIN
  -- Only validate if display_name is being changed
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    validation_result := public.validate_display_name_server_side(NEW.display_name);
    
    IF NOT (validation_result ->> 'isValid')::boolean THEN
      -- Log failed validation attempt
      INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
      VALUES (
        'DISPLAY_NAME_VALIDATION_FAILED',
        'WARNING',
        jsonb_build_object('error', validation_result ->> 'error', 'attempted_name', NEW.display_name),
        NEW.user_id,
        now()
      );
      
      RAISE EXCEPTION 'Display name validation failed: %', validation_result ->> 'error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_display_name_validation_trigger ON public.profiles;
CREATE TRIGGER enforce_display_name_validation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_display_name_validation();

-- Priority 3: Enhanced Security Monitoring
-- Add function to monitor suspicious authentication patterns
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  event_level text DEFAULT 'INFO',
  event_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (event_type, event_level, event_details, auth.uid(), now());
END;
$$;

-- Add RLS policy for better audit log security
CREATE POLICY "Service role can insert security logs" ON public.security_audit_log
FOR INSERT 
WITH CHECK (true);

-- Add index for better audit log query performance
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON public.security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at DESC);