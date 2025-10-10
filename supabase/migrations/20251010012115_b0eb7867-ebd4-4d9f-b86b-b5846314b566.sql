-- Tabela de configurações do Auto Trader
CREATE TABLE IF NOT EXISTS public.auto_trader_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_confidence NUMERIC NOT NULL DEFAULT 85,
  max_position_size NUMERIC NOT NULL DEFAULT 1000,
  max_simultaneous_positions INTEGER NOT NULL DEFAULT 5,
  risk_per_trade_percentage NUMERIC NOT NULL DEFAULT 2,
  use_stop_loss BOOLEAN NOT NULL DEFAULT true,
  use_take_profit BOOLEAN NOT NULL DEFAULT true,
  trailing_stop_percentage NUMERIC DEFAULT 2,
  allowed_symbols TEXT[] DEFAULT ARRAY['BTC/USD', 'ETH/USD'],
  excluded_symbols TEXT[] DEFAULT ARRAY[]::TEXT[],
  timeframes TEXT[] DEFAULT ARRAY['1h', '4h'],
  operating_hours_start INTEGER DEFAULT 0,
  operating_hours_end INTEGER DEFAULT 24,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de posições abertas do Auto Trader
CREATE TABLE IF NOT EXISTS public.auto_trader_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.auto_trader_config(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  entry_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  current_price NUMERIC,
  unrealized_pnl NUMERIC DEFAULT 0,
  realized_pnl NUMERIC,
  confidence NUMERIC NOT NULL,
  reasoning TEXT,
  exchange_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  close_reason TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs do Auto Trader
CREATE TABLE IF NOT EXISTS public.auto_trader_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.auto_trader_positions(id) ON DELETE SET NULL,
  log_type TEXT NOT NULL CHECK (log_type IN ('INFO', 'WARNING', 'ERROR', 'TRADE', 'ANALYSIS')),
  symbol TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de backtesting
CREATE TABLE IF NOT EXISTS public.backtesting_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_snapshot JSONB NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  profit_factor NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  sharpe_ratio NUMERIC,
  trades_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_trader_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_trader_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_trader_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtesting_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies para auto_trader_config
CREATE POLICY "Users can view their own auto trader config"
  ON public.auto_trader_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto trader config"
  ON public.auto_trader_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto trader config"
  ON public.auto_trader_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto trader config"
  ON public.auto_trader_config FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para auto_trader_positions
CREATE POLICY "Users can view their own positions"
  ON public.auto_trader_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own positions"
  ON public.auto_trader_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON public.auto_trader_positions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies para auto_trader_logs
CREATE POLICY "Users can view their own logs"
  ON public.auto_trader_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
  ON public.auto_trader_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies para backtesting_results
CREATE POLICY "Users can view their own backtesting results"
  ON public.backtesting_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backtesting results"
  ON public.backtesting_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backtesting results"
  ON public.backtesting_results FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_auto_trader_config_updated_at
  BEFORE UPDATE ON public.auto_trader_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_auto_trader_positions_updated_at
  BEFORE UPDATE ON public.auto_trader_positions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Índices para melhor performance
CREATE INDEX idx_auto_trader_positions_user_status ON public.auto_trader_positions(user_id, status);
CREATE INDEX idx_auto_trader_positions_symbol ON public.auto_trader_positions(symbol);
CREATE INDEX idx_auto_trader_logs_user_created ON public.auto_trader_logs(user_id, created_at DESC);
CREATE INDEX idx_backtesting_results_user_created ON public.backtesting_results(user_id, created_at DESC);