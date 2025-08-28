-- Create security audit table for comprehensive logging
CREATE TABLE public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_level TEXT NOT NULL CHECK (event_level IN ('INFO', 'WARN', 'ERROR')),
  event_details JSONB,
  user_id UUID,
  client_ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (public.current_user_has_role('admin'::public.app_role));

-- Edge functions can insert audit logs (using service role)
CREATE POLICY "Edge functions can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log(created_at DESC);
CREATE INDEX idx_security_audit_log_event_type ON public.security_audit_log(event_type);
CREATE INDEX idx_security_audit_log_event_level ON public.security_audit_log(event_level);

-- Create function to validate admin actions
CREATE OR REPLACE FUNCTION public.validate_admin_action(action_type TEXT, target_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow if user has admin role
  IF NOT public.current_user_has_role('admin'::public.app_role) THEN
    -- Log unauthorized admin attempt
    INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
    VALUES (
      'UNAUTHORIZED_ADMIN_ATTEMPT',
      'ERROR',
      jsonb_build_object('action_type', action_type, 'target_user_id', target_user_id),
      auth.uid(),
      now()
    );
    RETURN FALSE;
  END IF;
  
  -- Log admin action
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'ADMIN_ACTION_VALIDATED',
    'INFO',
    jsonb_build_object('action_type', action_type, 'target_user_id', target_user_id),
    auth.uid(),
    now()
  );
  
  RETURN TRUE;
END;
$$;

-- Create function to audit consumable transactions
CREATE OR REPLACE FUNCTION public.audit_consumable_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log consumable transaction for security audit
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'CONSUMABLE_TRANSACTION',
    'INFO',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'consumable_id', NEW.consumable_id,
      'quantity', NEW.quantity,
      'transaction_type', NEW.transaction_type,
      'source', NEW.source
    ),
    NEW.user_id,
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for consumable transaction auditing
CREATE TRIGGER audit_consumable_transactions
  AFTER INSERT ON public.consumable_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_consumable_transaction();

-- Update the grant_admin_role function to include audit logging
CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow service role or existing admin to grant admin role
  IF auth.jwt() ->> 'role' != 'service_role' AND NOT public.current_user_has_role('admin'::public.app_role) THEN
    -- Log unauthorized attempt
    INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
    VALUES (
      'UNAUTHORIZED_ADMIN_GRANT_ATTEMPT',
      'ERROR',
      jsonb_build_object('target_user_id', target_user_id),
      auth.uid(),
      now()
    );
    RAISE EXCEPTION 'Insufficient permissions to grant admin role';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, 'admin'::public.app_role, auth.uid(), now())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log successful admin role grant
  INSERT INTO public.security_audit_log (event_type, event_level, event_details, user_id, created_at)
  VALUES (
    'ADMIN_ROLE_GRANTED',
    'INFO',
    jsonb_build_object('target_user_id', target_user_id, 'granted_by', auth.uid()),
    target_user_id,
    now()
  );
END;
$$;