-- Add missing RLS policies for consumable_transactions table

-- Allow users to insert their own transaction records
CREATE POLICY "Users can insert their own consumable transactions"
ON public.consumable_transactions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Allow users to select their own transaction records
CREATE POLICY "Users can select their own consumable transactions"
ON public.consumable_transactions
FOR SELECT
USING (user_id = auth.uid());

-- Allow users to update their own transaction records
CREATE POLICY "Users can update their own consumable transactions"
ON public.consumable_transactions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());