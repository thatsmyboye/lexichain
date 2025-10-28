-- Fix: Restrict user_roles table access to prevent admin enumeration attacks
-- Regular users should use the has_role() function instead of directly querying the table

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Combined role view policy" ON public.user_roles;

-- Only allow admins and service role to view role assignments
CREATE POLICY "Only admins can view role assignments"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  -- Service role always has access
  (auth.jwt() ->> 'role' = 'service_role') 
  OR 
  -- Admins can view all role assignments
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Log the security policy update
INSERT INTO public.security_audit_log (event_type, event_level, event_details, created_at)
VALUES (
  'SECURITY_POLICY_UPDATED',
  'INFO',
  jsonb_build_object(
    'table', 'user_roles',
    'action', 'restricted_select_to_admins_only',
    'reason', 'prevent_admin_enumeration_attacks'
  ),
  now()
);