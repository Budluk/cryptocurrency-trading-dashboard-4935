-- Criar tabela para posições do auto trader
CREATE TABLE IF NOT EXISTS public.auto_trader_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC,
  highest_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  leverage INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'OPEN',
  confidence INTEGER NOT NULL DEFAULT 80,
  trailing_stop_percentage NUMERIC DEFAULT 1.5,
  unrealized_pnl NUMERIC DEFAULT 0,
  realized_pnl NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  close_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_auto_trader_positions_user_id ON public.auto_trader_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_trader_positions_status ON public.auto_trader_positions(status);
CREATE INDEX IF NOT EXISTS idx_auto_trader_positions_symbol ON public.auto_trader_positions(symbol);

-- Habilitar RLS
ALTER TABLE public.auto_trader_positions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuários podem gerenciar suas próprias posições
CREATE POLICY "Users can view their own positions"
  ON public.auto_trader_positions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
  ON public.auto_trader_positions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON public.auto_trader_positions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own positions"
  ON public.auto_trader_positions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_auto_trader_positions_updated_at
  BEFORE UPDATE ON public.auto_trader_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();