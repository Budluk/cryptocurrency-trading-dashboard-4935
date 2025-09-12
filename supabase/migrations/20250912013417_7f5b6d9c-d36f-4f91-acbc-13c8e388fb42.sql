-- Corrigir problemas de segurança das funções
CREATE OR REPLACE FUNCTION public.calculate_trading_performance(user_uuid UUID, start_date DATE, end_date DATE)
RETURNS TABLE(
  total_trades BIGINT,
  winning_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  profit_factor NUMERIC,
  max_drawdown NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    ROUND(LEAST(ts.pnl, 0), 2)
  FROM trade_stats ts;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_paper_trade_pnl()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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