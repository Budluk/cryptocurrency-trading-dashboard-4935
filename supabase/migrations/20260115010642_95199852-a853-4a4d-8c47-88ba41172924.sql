-- Re-enable RLS on auto_trader_config table
ALTER TABLE public.auto_trader_config ENABLE ROW LEVEL SECURITY;

-- Create proper policies for auto_trader_config
CREATE POLICY "Users can view own config"
ON public.auto_trader_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
ON public.auto_trader_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
ON public.auto_trader_config
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own config"
ON public.auto_trader_config
FOR DELETE
USING (auth.uid() = user_id);