-- 1. Sistema de Backtesting e Performance
CREATE TABLE public.signal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  signal_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  symbol TEXT NOT NULL DEFAULT 'BTC/USD',
  entry_price NUMERIC NOT NULL,
  target_price NUMERIC,
  stop_loss NUMERIC,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  timeframe TEXT NOT NULL,
  reasoning TEXT,
  actual_outcome TEXT CHECK (actual_outcome IN ('WIN', 'LOSS', 'BREAK_EVEN', 'PENDING')),
  exit_price NUMERIC,
  pnl_percentage NUMERIC,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'EXPIRED'))
);

-- 2. Alertas Inteligentes
CREATE TABLE public.trading_alerts_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'BTC/USD',
  alert_type TEXT NOT NULL CHECK (alert_type IN ('PRICE_LEVEL', 'SIGNAL_CONFIDENCE', 'VOLUME_SPIKE', 'NEWS_SENTIMENT')),
  conditions JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notifications JSONB NOT NULL DEFAULT '{"email": false, "push": true, "sound": true}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.triggered_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_config_id UUID NOT NULL REFERENCES public.trading_alerts_config(id),
  user_id UUID NOT NULL REFERENCES auth.users,
  trigger_data JSONB NOT NULL,
  message TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_taken TEXT
);

-- 5. Sistema de Trading Simulado melhorado
CREATE TABLE public.paper_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  demo_account_id UUID NOT NULL REFERENCES public.demo_accounts(id),
  signal_id UUID REFERENCES public.signal_history(id),
  symbol TEXT NOT NULL DEFAULT 'BTC/USD',
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  entry_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  current_price NUMERIC,
  unrealized_pnl NUMERIC DEFAULT 0,
  realized_pnl NUMERIC,
  fees NUMERIC DEFAULT 0,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  close_reason TEXT,
  notes TEXT
);

-- Performance Analytics
CREATE TABLE public.trading_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  profit_factor NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  sharpe_ratio NUMERIC,
  avg_win NUMERIC NOT NULL DEFAULT 0,
  avg_loss NUMERIC NOT NULL DEFAULT 0,
  largest_win NUMERIC NOT NULL DEFAULT 0,
  largest_loss NUMERIC NOT NULL DEFAULT 0,
  avg_trade_duration INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_alerts_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggered_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own signal history" ON public.signal_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create signal history" ON public.signal_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their signal history" ON public.signal_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own alert configs" ON public.trading_alerts_config
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own triggered alerts" ON public.triggered_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their paper trades" ON public.paper_trades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their performance" ON public.trading_performance
  FOR ALL USING (auth.uid() = user_id);

-- Functions para performance
CREATE OR REPLACE FUNCTION public.calculate_trading_performance(user_uuid UUID, start_date DATE, end_date DATE)
RETURNS TABLE(
  total_trades BIGINT,
  winning_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  profit_factor NUMERIC,
  max_drawdown NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH trade_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE realized_pnl > 0) as wins,
      COALESCE(SUM(realized_pnl), 0) as pnl,
      COALESCE(SUM(realized_pnl) FILTER (WHERE realized_pnl > 0), 0) as gross_profit,
      COALESCE(ABS(SUM(realized_pnl) FILTER (WHERE realized_pnl < 0)), 0) as gross_loss
    FROM public.paper_trades 
    WHERE user_id = user_uuid 
      AND status = 'CLOSED'
      AND closed_at::date BETWEEN start_date AND end_date
  )
  SELECT 
    ts.total,
    ts.wins,
    CASE WHEN ts.total > 0 THEN ROUND((ts.wins::NUMERIC / ts.total::NUMERIC) * 100, 2) ELSE 0 END,
    ROUND(ts.pnl, 2),
    CASE WHEN ts.gross_loss > 0 THEN ROUND(ts.gross_profit / ts.gross_loss, 2) ELSE 0 END,
    -- Simplified max drawdown calculation
    ROUND(LEAST(ts.pnl, 0), 2)
  FROM trade_stats ts;
END;
$$;

-- Trigger para atualizar paper trades em tempo real
CREATE OR REPLACE FUNCTION public.update_paper_trade_pnl()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Atualizar unrealized_pnl baseado no current_price
  IF NEW.current_price IS NOT NULL AND NEW.status = 'OPEN' THEN
    IF NEW.action = 'BUY' THEN
      NEW.unrealized_pnl = (NEW.current_price - NEW.entry_price) * NEW.quantity;
    ELSE
      NEW.unrealized_pnl = (NEW.entry_price - NEW.current_price) * NEW.quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_paper_trade_pnl_trigger
  BEFORE UPDATE ON public.paper_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_paper_trade_pnl();