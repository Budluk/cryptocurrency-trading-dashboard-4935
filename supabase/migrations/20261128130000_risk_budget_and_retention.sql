-- =============================================
-- ORÇAMENTO DE RISCO NO SERVIDOR + RETENÇÃO DE TELEMETRIA (28/11/2026)
-- Complementa os gates do agente: limites por usuário ficam no banco e são
-- aplicados também por trigger, independentemente da edge function chamada.
-- Nenhuma ordem é criada por esta migration.
-- =============================================

CREATE TABLE IF NOT EXISTS public.risk_budgets (
  user_id UUID PRIMARY KEY DEFAULT auth.uid(),
  max_daily_loss_pct NUMERIC NOT NULL DEFAULT -2
    CHECK (max_daily_loss_pct >= -100 AND max_daily_loss_pct < 0),
  max_open_positions INTEGER NOT NULL DEFAULT 5
    CHECK (max_open_positions BETWEEN 1 AND 50),
  max_daily_trades INTEGER NOT NULL DEFAULT 20
    CHECK (max_daily_trades BETWEEN 1 AND 500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own risk budget" ON public.risk_budgets;
DROP POLICY IF EXISTS "Users can insert own risk budget" ON public.risk_budgets;
DROP POLICY IF EXISTS "Users can update own risk budget" ON public.risk_budgets;
DROP POLICY IF EXISTS "Service role full access to risk budgets" ON public.risk_budgets;

CREATE POLICY "Users can view own risk budget" ON public.risk_budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own risk budget" ON public.risk_budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risk budget" ON public.risk_budgets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access to risk budgets" ON public.risk_budgets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gate de banco: registra no máximo `max_open_positions` operações abertas e
-- `max_daily_trades` aberturas por dia (UTC). Fechamentos não são bloqueados.
CREATE OR REPLACE FUNCTION public.enforce_risk_budget_on_agent_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lim public.risk_budgets%ROWTYPE;
  open_count INTEGER;
  day_count INTEGER;
BEGIN
  IF NEW.result IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO lim FROM public.risk_budgets WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO open_count
    FROM public.agent_trades
    WHERE user_id = NEW.user_id AND result = 'open';
  SELECT count(*) INTO day_count
    FROM public.agent_trades
    WHERE user_id = NEW.user_id
      AND opened_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF open_count >= lim.max_open_positions THEN
    RAISE EXCEPTION 'Limite de risco: % posições abertas (limite %)', open_count, lim.max_open_positions;
  END IF;
  IF day_count >= lim.max_daily_trades THEN
    RAISE EXCEPTION 'Limite de risco: % operações hoje (limite %)', day_count, lim.max_daily_trades;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_risk_budget_agent_trades ON public.agent_trades;
CREATE TRIGGER enforce_risk_budget_agent_trades
  BEFORE INSERT ON public.agent_trades
  FOR EACH ROW EXECUTE FUNCTION public.enforce_risk_budget_on_agent_trade();

-- Limpeza controlada: telemetria 30 dias, auditoria 90 dias por padrão.
-- Somente service_role pode executar; o agendador usa a mesma service role key
-- já configurada nos Secrets do Actions (nenhum valor é gravado no repositório).
CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry(
  telemetry_days INTEGER DEFAULT 30,
  audit_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t_limit TIMESTAMPTZ := now() - make_interval(days => greatest(telemetry_days, 1));
  a_limit TIMESTAMPTZ := now() - make_interval(days => greatest(audit_days, 1));
  n_ticks INTEGER;
  n_signals INTEGER;
  n_sims INTEGER;
  n_logs INTEGER;
BEGIN
  DELETE FROM public.b3_ticks WHERE created_at < t_limit;
  GET DIAGNOSTICS n_ticks = ROW_COUNT;
  DELETE FROM public.b3_signals WHERE created_at < t_limit;
  GET DIAGNOSTICS n_signals = ROW_COUNT;
  DELETE FROM public.exchange_simulations WHERE created_at < t_limit;
  GET DIAGNOSTICS n_sims = ROW_COUNT;
  DELETE FROM public.agent_routine_log WHERE created_at < a_limit;
  GET DIAGNOSTICS n_logs = ROW_COUNT;
  RETURN jsonb_build_object(
    'b3_ticks', n_ticks,
    'b3_signals', n_signals,
    'exchange_simulations', n_sims,
    'agent_routine_log', n_logs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_telemetry(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_telemetry(INTEGER, INTEGER) TO service_role;
