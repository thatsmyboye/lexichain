-- Add DELETE and UPDATE policies for consumable_transactions table
-- This allows users to manage their own transaction records while preventing manipulation of others' data

-- Allow users to delete their own transaction records
CREATE POLICY "Users can delete their own transactions" 
ON consumable_transactions 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

-- Allow users to update their own transaction records
CREATE POLICY "Users can update their own transactions" 
ON consumable_transactions 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);