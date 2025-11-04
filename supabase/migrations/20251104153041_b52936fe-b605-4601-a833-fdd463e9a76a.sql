-- Drop the existing catch-all policy
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

-- Create separate, explicit policies for each operation
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert only their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);