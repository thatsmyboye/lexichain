-- Grant starter consumables to all registered users
-- First create a function to grant starter consumables
CREATE OR REPLACE FUNCTION public.grant_starter_consumables(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Insert or update 3 of each consumable type for the user
  INSERT INTO public.user_consumables (user_id, consumable_id, quantity)
  VALUES 
    (target_user_id, 'hint_revealer', 3),
    (target_user_id, 'score_multiplier', 3),
    (target_user_id, 'hammer', 3),
    (target_user_id, 'extra_moves', 3)
  ON CONFLICT (user_id, consumable_id) 
  DO UPDATE SET 
    quantity = GREATEST(user_consumables.quantity, 3),
    updated_at = now();

  -- Record the transaction
  INSERT INTO public.consumable_transactions (user_id, consumable_id, quantity, transaction_type, source)
  VALUES 
    (target_user_id, 'hint_revealer', 3, 'earned', 'starter_grant'),
    (target_user_id, 'score_multiplier', 3, 'earned', 'starter_grant'),
    (target_user_id, 'hammer', 3, 'earned', 'starter_grant'),
    (target_user_id, 'extra_moves', 3, 'earned', 'starter_grant')
  ON CONFLICT DO NOTHING; -- Prevent duplicate starter grants
END;
$function$;

-- Grant starter consumables to all existing registered users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
    LOOP
        PERFORM public.grant_starter_consumables(user_record.id);
    END LOOP;
END
$$;

-- Create a trigger to automatically grant starter consumables to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_consumables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only grant if user has confirmed email
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    PERFORM public.grant_starter_consumables(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for new user consumable grants
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE FUNCTION public.handle_new_user_consumables();

-- Update RLS policies to allow admin access for testing
-- Add policies that allow service role or specific admin users to modify consumables
CREATE POLICY "allow_admin_consumables_update" ON public.user_consumables
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    (auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE display_name ILIKE '%admin%'
    ))
  );

CREATE POLICY "allow_admin_transactions_update" ON public.consumable_transactions
  FOR ALL  
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    (auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE display_name ILIKE '%admin%'
    ))
  );

-- Add unique constraint to prevent duplicate user_consumable entries
ALTER TABLE public.user_consumables 
ADD CONSTRAINT unique_user_consumable 
UNIQUE (user_id, consumable_id);