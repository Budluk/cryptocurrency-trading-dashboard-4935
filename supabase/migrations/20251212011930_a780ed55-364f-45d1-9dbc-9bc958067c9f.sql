-- Drop existing RLS policies on auto_trader_config
DROP POLICY IF EXISTS "Users can view their own trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can insert their own trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can update their own trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can delete their own trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can manage their own auto trader config" ON public.auto_trader_config;

-- Create permissive policies for anonymous access
CREATE POLICY "Allow all select config" ON public.auto_trader_config
  FOR SELECT USING (true);

CREATE POLICY "Allow all insert config" ON public.auto_trader_config
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update config" ON public.auto_trader_config
  FOR UPDATE USING (true);

CREATE POLICY "Allow all delete config" ON public.auto_trader_config
  FOR DELETE USING (true);