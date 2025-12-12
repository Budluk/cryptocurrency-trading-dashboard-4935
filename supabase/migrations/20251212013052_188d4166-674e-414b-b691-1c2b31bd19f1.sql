-- Garantir que as políticas de UPDATE são completamente permissivas
DROP POLICY IF EXISTS "Allow all update" ON auto_trader_positions;
CREATE POLICY "Allow all update" ON auto_trader_positions FOR UPDATE USING (true) WITH CHECK (true);

-- Também garantir INSERT para logs
DROP POLICY IF EXISTS "Allow anonymous logs" ON auto_trader_logs;
CREATE POLICY "Allow anonymous logs" ON auto_trader_logs FOR ALL USING (true) WITH CHECK (true);