-- =============================================
-- FIX OVERLY PERMISSIVE RLS POLICIES
-- Replace USING (true) policies with user-scoped policies
-- =============================================

-- ==================
-- risk_management_settings
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON risk_management_settings;

CREATE POLICY "Users can view own risk settings"
ON risk_management_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own risk settings"
ON risk_management_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own risk settings"
ON risk_management_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==================
-- ml_adaptive_config
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON ml_adaptive_config;

CREATE POLICY "Users can view own ML config"
ON ml_adaptive_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ML config"
ON ml_adaptive_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ML config"
ON ml_adaptive_config
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==================
-- portfolio_rebalance_config
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON portfolio_rebalance_config;

CREATE POLICY "Users can view own rebalance config"
ON portfolio_rebalance_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rebalance config"
ON portfolio_rebalance_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rebalance config"
ON portfolio_rebalance_config
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==================
-- demo_accounts
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON demo_accounts;

CREATE POLICY "Users can view own demo accounts"
ON demo_accounts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own demo accounts"
ON demo_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own demo accounts"
ON demo_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==================
-- demo_positions
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON demo_positions;

CREATE POLICY "Users can view own demo positions"
ON demo_positions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own demo positions"
ON demo_positions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own demo positions"
ON demo_positions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==================
-- auto_trader_config (ensure user-scoped)
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON auto_trader_config;
DROP POLICY IF EXISTS "Allow all select config" ON auto_trader_config;
DROP POLICY IF EXISTS "Allow all insert config" ON auto_trader_config;
DROP POLICY IF EXISTS "Allow all update config" ON auto_trader_config;
DROP POLICY IF EXISTS "Allow all delete config" ON auto_trader_config;

CREATE POLICY "Users can view own auto trader config"
ON auto_trader_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto trader config"
ON auto_trader_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto trader config"
ON auto_trader_config
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto trader config"
ON auto_trader_config
FOR DELETE
USING (auth.uid() = user_id);

-- ==================
-- auto_trader_positions (ensure user-scoped)
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON auto_trader_positions;
DROP POLICY IF EXISTS "Allow all select" ON auto_trader_positions;
DROP POLICY IF EXISTS "Allow all insert" ON auto_trader_positions;
DROP POLICY IF EXISTS "Allow all update" ON auto_trader_positions;
DROP POLICY IF EXISTS "Allow all delete" ON auto_trader_positions;

CREATE POLICY "Users can view own positions"
ON auto_trader_positions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
ON auto_trader_positions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
ON auto_trader_positions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
ON auto_trader_positions
FOR DELETE
USING (auth.uid() = user_id);

-- ==================
-- auto_trader_logs (ensure user-scoped)
-- ==================
DROP POLICY IF EXISTS "Allow anonymous access" ON auto_trader_logs;
DROP POLICY IF EXISTS "Allow anonymous logs" ON auto_trader_logs;
DROP POLICY IF EXISTS "Allow all logs" ON auto_trader_logs;

CREATE POLICY "Users can view own logs"
ON auto_trader_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
ON auto_trader_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can insert any logs (for webhooks)
CREATE POLICY "Service role can insert any logs"
ON auto_trader_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- ==================
-- ai_learning_data (ensure user-scoped)
-- ==================
DROP POLICY IF EXISTS "Allow all selects on ai_learning_data" ON ai_learning_data;
DROP POLICY IF EXISTS "Allow all inserts on ai_learning_data" ON ai_learning_data;
DROP POLICY IF EXISTS "Allow all updates on ai_learning_data" ON ai_learning_data;

CREATE POLICY "Users can view own learning data"
ON ai_learning_data
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning data"
ON ai_learning_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning data"
ON ai_learning_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role for webhook logging
CREATE POLICY "Service role can insert any learning data"
ON ai_learning_data
FOR INSERT
TO service_role
WITH CHECK (true);

-- ==================
-- ai_decisions (new table for gateway logging)
-- ==================
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT auth.uid(),
  symbol TEXT NOT NULL,
  final_action TEXT NOT NULL CHECK (final_action IN ('BUY', 'SELL', 'WAIT')),
  final_confidence INTEGER NOT NULL CHECK (final_confidence >= 0 AND final_confidence <= 100),
  target_price NUMERIC,
  stop_loss NUMERIC,
  leverage INTEGER,
  sources TEXT[] NOT NULL DEFAULT '{}',
  gate_pass BOOLEAN NOT NULL DEFAULT false,
  gate_blocked_by TEXT[],
  consensus BOOLEAN NOT NULL DEFAULT false,
  raw_sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI decisions"
ON ai_decisions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI decisions"
ON ai_decisions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert any AI decisions"
ON ai_decisions
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX idx_ai_decisions_user_created ON ai_decisions(user_id, created_at DESC);
CREATE INDEX idx_ai_decisions_symbol_created ON ai_decisions(symbol, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON ai_decisions TO authenticated;
GRANT ALL ON ai_decisions TO service_role;