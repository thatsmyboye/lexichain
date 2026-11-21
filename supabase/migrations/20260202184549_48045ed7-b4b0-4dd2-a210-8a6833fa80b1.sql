-- Drop the problematic INSERT policies with WITH CHECK (true)
DROP POLICY IF EXISTS "Only service role can insert audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can insert security logs" ON public.security_audit_log;

-- Create a proper INSERT policy that only allows service role
-- Using a check that verifies the request comes from service_role JWT
CREATE POLICY "Service role can insert audit logs"
ON public.security_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also add a deny policy for authenticated users trying to insert
CREATE POLICY "Deny user inserts to audit logs"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Deny anonymous inserts
CREATE POLICY "Deny anonymous inserts to audit logs"
ON public.security_audit_log
FOR INSERT
TO anon
WITH CHECK (false);