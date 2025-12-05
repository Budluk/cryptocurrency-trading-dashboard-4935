-- Disable RLS on auto_trader_config to allow anonymous access
ALTER TABLE public.auto_trader_config DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous access to auto_trader_config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can view their own auto trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can create their own auto trader config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Users can update their own auto trader config" ON public.auto_trader_config;