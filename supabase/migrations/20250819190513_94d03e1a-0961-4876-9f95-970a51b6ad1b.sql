-- Fix critical security vulnerability: Replace display name-based admin access with proper role-based access control

-- First, drop the vulnerable policies
DROP POLICY IF EXISTS "allow_admin_consumables_update" ON public.user_consumables;
DROP POLICY IF EXISTS "allow_admin_transactions_update" ON public.consumable_transactions;

-- Create an enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create a secure user roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all roles" ON public.user_roles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a security definer function to check user roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Create a helper function to check if current user has a specific role
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role(auth.uid(), _role);
$$;

-- Create secure admin policies for consumables using proper role checking
CREATE POLICY "secure_admin_consumables_access" ON public.user_consumables
    FOR ALL 
    USING (
        auth.jwt() ->> 'role' = 'service_role' OR 
        public.current_user_has_role('admin'::public.app_role)
    );

CREATE POLICY "secure_admin_transactions_access" ON public.consumable_transactions
    FOR ALL 
    USING (
        auth.jwt() ->> 'role' = 'service_role' OR 
        public.current_user_has_role('admin'::public.app_role)
    );

-- Grant default 'user' role to all existing users who don't have roles yet
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT u.id, 'user'::public.app_role, now()
FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
  );

-- Create a function to grant admin role (only callable by service role or existing admin)
CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only allow service role or existing admin to grant admin role
  IF auth.jwt() ->> 'role' != 'service_role' AND NOT public.current_user_has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'Insufficient permissions to grant admin role';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, 'admin'::public.app_role, auth.uid(), now())
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;