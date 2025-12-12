-- Drop existing RLS policies on auto_trader_positions
DROP POLICY IF EXISTS "Users can view their own positions" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Users can insert their own positions" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Users can update their own positions" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Users can delete their own positions" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.auto_trader_positions;

-- Create permissive policies for anonymous access
CREATE POLICY "Allow all select" ON public.auto_trader_positions
  FOR SELECT USING (true);

CREATE POLICY "Allow all insert" ON public.auto_trader_positions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update" ON public.auto_trader_positions
  FOR UPDATE USING (true);

CREATE POLICY "Allow all delete" ON public.auto_trader_positions
  FOR DELETE USING (true);