-- Add restrictive policy to deny anonymous access to user_roles table
-- This prevents attackers from discovering admin user assignments
CREATE POLICY "Deny anonymous access to user roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);