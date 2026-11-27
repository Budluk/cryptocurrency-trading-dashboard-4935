-- =============================================
-- AGENTE AUTÔNOMO: memória persistente e auditoria
-- Estado por ativo, trades, versões de prompt e rotina diária.
-- =============================================

CREATE TABLE IF NOT EXISTS public.agent_state (
  user_id UUID NOT NULL DEFAULT auth.uid(),
  symbol TEXT NOT NULL,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  consecutive_stops INTEGER NOT NULL DEFAULT 0,
  daily_pnl_pct NUMERIC NOT NULL DEFAULT 0,
  kill_until TIMESTAMPTZ,
  blacklisted BOOLEAN NOT NULL DEFAULT false,
  last_signal_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);

ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own agent state" ON public.agent_state;
DROP POLICY IF EXISTS "Users can insert own agent state" ON public.agent_state;
DROP POLICY IF EXISTS "Users can update own agent state" ON public.agent_state;
DROP POLICY IF EXISTS "Service role full access to agent state" ON public.agent_state;

CREATE POLICY "Users can view own agent state" ON public.agent_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agent state" ON public.agent_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agent state" ON public.agent_state
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access to agent state" ON public.agent_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Buy', 'Sell')),
  entry NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  qty NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'open' CHECK (result IN ('open', 'win', 'loss', 'stop')),
  pnl_pct NUMERIC,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.agent_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own agent trades" ON public.agent_trades;
DROP POLICY IF EXISTS "Users can insert own agent trades" ON public.agent_trades;
DROP POLICY IF EXISTS "Users can update own agent trades" ON public.agent_trades;
DROP POLICY IF EXISTS "Service role full access to agent trades" ON public.agent_trades;

CREATE POLICY "Users can view own agent trades" ON public.agent_trades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agent trades" ON public.agent_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agent trades" ON public.agent_trades
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access to agent trades" ON public.agent_trades
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_trades_user_symbol_opened
  ON public.agent_trades(user_id, symbol, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_trades_user_result
  ON public.agent_trades(user_id, result);

-- Prompts versionados como dados: permite evolução com regressão e proveniência.
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  version TEXT NOT NULL,
  body TEXT NOT NULL,
  source_url TEXT,
  author TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, version)
);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read prompt versions" ON public.prompt_versions;
DROP POLICY IF EXISTS "Service role full access to prompt versions" ON public.prompt_versions;

CREATE POLICY "Anyone authenticated can read prompt versions" ON public.prompt_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access to prompt versions" ON public.prompt_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_routine_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('loop', 'daily', 'kill_switch', 'blacklist')),
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_routine_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own routine log" ON public.agent_routine_log;
DROP POLICY IF EXISTS "Service role full access to routine log" ON public.agent_routine_log;

CREATE POLICY "Users can view own routine log" ON public.agent_routine_log
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service role full access to routine log" ON public.agent_routine_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_routine_log_created
  ON public.agent_routine_log(created_at DESC);
