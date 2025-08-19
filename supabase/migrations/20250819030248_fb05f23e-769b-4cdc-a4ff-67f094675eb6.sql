-- Update RLS policies to use SELECT auth.uid() for better performance at scale

-- Drop existing policies for user_consumables
DROP POLICY IF EXISTS "Users can view their own consumables" ON user_consumables;
DROP POLICY IF EXISTS "Users can insert their own consumables" ON user_consumables;
DROP POLICY IF EXISTS "Users can update their own consumables" ON user_consumables;

-- Create optimized policies for user_consumables
CREATE POLICY "Users can view their own consumables" 
ON user_consumables 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own consumables" 
ON user_consumables 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own consumables" 
ON user_consumables 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);

-- Drop existing policies for consumable_transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON consumable_transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON consumable_transactions;

-- Create optimized policies for consumable_transactions
CREATE POLICY "Users can view their own transactions" 
ON consumable_transactions 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own transactions" 
ON consumable_transactions 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Drop existing policies for daily_login_streaks
DROP POLICY IF EXISTS "Users can view their own login streaks" ON daily_login_streaks;
DROP POLICY IF EXISTS "Users can insert their own login streaks" ON daily_login_streaks;
DROP POLICY IF EXISTS "Users can update their own login streaks" ON daily_login_streaks;

-- Create optimized policies for daily_login_streaks
CREATE POLICY "Users can view their own login streaks" 
ON daily_login_streaks 
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own login streaks" 
ON daily_login_streaks 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own login streaks" 
ON daily_login_streaks 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id);