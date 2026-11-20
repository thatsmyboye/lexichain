-- Create consumables tables for the lexichain game

-- User consumable inventory
CREATE TABLE public.user_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consumable_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, consumable_id)
);

-- Consumable usage/earning transactions
CREATE TABLE public.consumable_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consumable_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earned', 'used', 'purchased'
  quantity INTEGER NOT NULL,
  source TEXT, -- 'achievement', 'daily_login', 'word_bonus', 'manual_use', etc.
  game_result_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily login streak tracking
CREATE TABLE public.daily_login_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE NOT NULL,
  total_logins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_login_streaks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_consumables
CREATE POLICY "Users can view their own consumables" 
ON public.user_consumables 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consumables" 
ON public.user_consumables 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consumables" 
ON public.user_consumables 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS policies for consumable_transactions
CREATE POLICY "Users can view their own transactions" 
ON public.consumable_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
ON public.consumable_transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for daily_login_streaks
CREATE POLICY "Users can view their own login streaks" 
ON public.daily_login_streaks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login streaks" 
ON public.daily_login_streaks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own login streaks" 
ON public.daily_login_streaks 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_consumables_updated_at
BEFORE UPDATE ON public.user_consumables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_login_streaks_updated_at
BEFORE UPDATE ON public.daily_login_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key references for game results
ALTER TABLE public.consumable_transactions 
ADD CONSTRAINT fk_game_result 
FOREIGN KEY (game_result_id) 
REFERENCES public.standard_game_results(id) 
ON DELETE SET NULL;