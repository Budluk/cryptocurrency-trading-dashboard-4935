-- =============================================
-- FIX OVERLY PERMISSIVE RLS POLICIES
-- Replace USING (true) policies with user-scoped policies
-- =============================================

-- ==================
-- auto_trader_positions
-- ==================
DROP POLICY IF EXISTS "Allow all select" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Allow all insert" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Allow all update" ON public.auto_trader_positions;
DROP POLICY IF EXISTS "Allow all delete" ON public.auto_trader_positions;

CREATE POLICY "Users view own positions" 
ON public.auto_trader_positions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own positions" 
ON public.auto_trader_positions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own positions" 
ON public.auto_trader_positions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own positions" 
ON public.auto_trader_positions 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================
-- auto_trader_config
-- ==================
DROP POLICY IF EXISTS "Allow all select config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Allow all insert config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Allow all update config" ON public.auto_trader_config;
DROP POLICY IF EXISTS "Allow all delete config" ON public.auto_trader_config;

CREATE POLICY "Users view own config" 
ON public.auto_trader_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own config" 
ON public.auto_trader_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own config" 
ON public.auto_trader_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own config" 
ON public.auto_trader_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================
-- auto_trader_logs
-- ==================
DROP POLICY IF EXISTS "Allow anonymous logs" ON public.auto_trader_logs;
DROP POLICY IF EXISTS "Allow all logs" ON public.auto_trader_logs;

CREATE POLICY "Users view own logs" 
ON public.auto_trader_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own logs" 
ON public.auto_trader_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==================
-- ai_learning_data
-- ==================
DROP POLICY IF EXISTS "Allow all selects on ai_learning_data" ON public.ai_learning_data;
DROP POLICY IF EXISTS "Allow all inserts on ai_learning_data" ON public.ai_learning_data;
DROP POLICY IF EXISTS "Allow all updates on ai_learning_data" ON public.ai_learning_data;

CREATE POLICY "Users view own learning data" 
ON public.ai_learning_data 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own learning data" 
ON public.ai_learning_data 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own learning data" 
ON public.ai_learning_data 
FOR UPDATE 
USING (auth.uid() = user_id);