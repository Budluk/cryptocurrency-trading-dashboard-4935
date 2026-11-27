-- =============================================
-- AGENTE AUTÔNOMO: permite reconhecer saídas por take profit fora do chat.
-- Sem esta coluna, o loop só conseguia reconciliar stops (agent_trades.stop_loss).
-- =============================================

ALTER TABLE public.agent_trades ADD COLUMN IF NOT EXISTS take_profit NUMERIC;

COMMENT ON COLUMN public.agent_trades.take_profit IS
  'Preço de take profit enviado ao spot/derivativos; usado pela reconciliação automática.';

CREATE INDEX IF NOT EXISTS idx_agent_trades_open_symbol
  ON public.agent_trades(user_id, symbol, result)
  WHERE result = 'open';
