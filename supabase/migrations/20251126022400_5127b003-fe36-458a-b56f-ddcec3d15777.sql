-- Desabilitar RLS para acesso anônimo nas tabelas principais

-- Permitir acesso total anônimo à tabela auto_trader_config
DROP POLICY IF EXISTS "Users can view own config" ON auto_trader_config;
DROP POLICY IF EXISTS "Users can insert own config" ON auto_trader_config;
DROP POLICY IF EXISTS "Users can update own config" ON auto_trader_config;

CREATE POLICY "Allow anonymous access" ON auto_trader_config FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela auto_trader_positions
DROP POLICY IF EXISTS "Users can view own positions" ON auto_trader_positions;
DROP POLICY IF EXISTS "Users can insert own positions" ON auto_trader_positions;
DROP POLICY IF EXISTS "Users can update own positions" ON auto_trader_positions;

CREATE POLICY "Allow anonymous access" ON auto_trader_positions FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela risk_management_settings
DROP POLICY IF EXISTS "Users can manage own settings" ON risk_management_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON risk_management_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON risk_management_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON risk_management_settings;

CREATE POLICY "Allow anonymous access" ON risk_management_settings FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela ml_adaptive_config
DROP POLICY IF EXISTS "Users can view own config" ON ml_adaptive_config;
DROP POLICY IF EXISTS "Users can insert own config" ON ml_adaptive_config;
DROP POLICY IF EXISTS "Users can update own config" ON ml_adaptive_config;

CREATE POLICY "Allow anonymous access" ON ml_adaptive_config FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela auto_trader_logs
DROP POLICY IF EXISTS "Users can view own logs" ON auto_trader_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON auto_trader_logs;

CREATE POLICY "Allow anonymous access" ON auto_trader_logs FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela portfolio_rebalance_config
DROP POLICY IF EXISTS "Users can manage own rebalance config" ON portfolio_rebalance_config;

CREATE POLICY "Allow anonymous access" ON portfolio_rebalance_config FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela demo_accounts
DROP POLICY IF EXISTS "Users can view own demo accounts" ON demo_accounts;
DROP POLICY IF EXISTS "Users can insert own demo accounts" ON demo_accounts;
DROP POLICY IF EXISTS "Users can update own demo accounts" ON demo_accounts;

CREATE POLICY "Allow anonymous access" ON demo_accounts FOR ALL USING (true) WITH CHECK (true);

-- Permitir acesso total anônimo à tabela demo_positions
DROP POLICY IF EXISTS "Users can manage own demo positions" ON demo_positions;

CREATE POLICY "Allow anonymous access" ON demo_positions FOR ALL USING (true) WITH CHECK (true);