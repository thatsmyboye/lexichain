-- Fix security issue: Restrict profile access to authenticated users viewing their own profiles
-- Drop the overly permissive policy
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;

-- Create a secure policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);