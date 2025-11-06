-- Adicionar colunas necessárias para trailing stop e monitoramento de posições
ALTER TABLE auto_trader_positions
ADD COLUMN IF NOT EXISTS current_price NUMERIC,
ADD COLUMN IF NOT EXISTS trailing_stop_percentage NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS unrealized_pnl NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC,
ADD COLUMN IF NOT EXISTS highest_price NUMERIC;

-- Comentários para documentação
COMMENT ON COLUMN auto_trader_positions.current_price IS 'Preço atual do ativo para cálculo de P&L em tempo real';
COMMENT ON COLUMN auto_trader_positions.trailing_stop_percentage IS 'Percentual de trailing stop (padrão 1.5%)';
COMMENT ON COLUMN auto_trader_positions.unrealized_pnl IS 'P&L não realizado da posição aberta';
COMMENT ON COLUMN auto_trader_positions.realized_pnl IS 'P&L realizado após fechamento';
COMMENT ON COLUMN auto_trader_positions.highest_price IS 'Maior preço atingido (BUY) ou menor preço (SELL) para trailing stop';