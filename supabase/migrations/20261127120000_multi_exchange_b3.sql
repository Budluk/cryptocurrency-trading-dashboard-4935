-- =============================================
-- B3 + MULTI-CORRETORAS (27/11/2026)
-- B3 registra sinais do pregão (WINZ26 / WDOZ26), sem ordens.
-- Outras corretoras ficam em simulação até opt-in explícito.
-- =============================================

CREATE TABLE IF NOT EXISTS public.b3_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL CHECK (symbol IN ('WINZ26', 'WDOZ26')),
  price NUMERIC NOT NULL CHECK (price > 0),
  atr NUMERIC,
  rsi NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b3_ticks_symbol_created_idx
  ON public.b3_ticks (symbol, created_at DESC);

CREATE TABLE IF NOT EXISTS public.b3_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL CHECK (symbol IN ('WINZ26', 'WDOZ26')),
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  price NUMERIC NOT NULL CHECK (price > 0),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  qty NUMERIC NOT NULL DEFAULT 1,
  atr NUMERIC,
  rsi NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  leverage NUMERIC,
  source TEXT NOT NULL DEFAULT 'tradingview-webhook',
  mode TEXT NOT NULL DEFAULT 'signal_only' CHECK (mode = 'signal_only'),
  executed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b3_signals_created_idx
  ON public.b3_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS b3_signals_symbol_created_idx
  ON public.b3_signals (symbol, created_at DESC);

-- Rejeita explicitamente contratos vencidos herdados do plano antigo.
ALTER TABLE public.b3_signals DROP CONSTRAINT IF EXISTS b3_signals_no_expired_symbol;
ALTER TABLE public.b3_signals ADD CONSTRAINT b3_signals_no_expired_symbol
  CHECK (symbol NOT IN ('WINZ25', 'WDOF26'));

CREATE TABLE IF NOT EXISTS public.b3_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL CHECK (symbol IN ('WINZ26', 'WDOZ26')),
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b3_analysis_created_idx
  ON public.b3_analysis (created_at DESC);

CREATE TABLE IF NOT EXISTS public.exchange_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  exchange TEXT NOT NULL,
  action TEXT NOT NULL,
  symbol TEXT,
  side TEXT,
  qty NUMERIC,
  price NUMERIC,
  leverage NUMERIC,
  simulated BOOLEAN NOT NULL DEFAULT true CHECK (simulated = true),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exchange_simulations_user_created_idx
  ON public.exchange_simulations (user_id, created_at DESC);

-- RLS: leitura para usuários autenticados; escrita apenas por service_role.
ALTER TABLE public.b3_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read b3 ticks" ON public.b3_ticks;
CREATE POLICY "Authenticated users can read b3 ticks" ON public.b3_ticks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role full access to b3 ticks" ON public.b3_ticks;
CREATE POLICY "Service role full access to b3 ticks" ON public.b3_ticks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read b3 signals" ON public.b3_signals;
CREATE POLICY "Authenticated users can read b3 signals" ON public.b3_signals
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role full access to b3 signals" ON public.b3_signals;
CREATE POLICY "Service role full access to b3 signals" ON public.b3_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read b3 analysis" ON public.b3_analysis;
CREATE POLICY "Authenticated users can read b3 analysis" ON public.b3_analysis
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role full access to b3 analysis" ON public.b3_analysis;
CREATE POLICY "Service role full access to b3 analysis" ON public.b3_analysis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own exchange simulations" ON public.exchange_simulations;
CREATE POLICY "Users can read own exchange simulations" ON public.exchange_simulations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own exchange simulations" ON public.exchange_simulations;
CREATE POLICY "Users can insert own exchange simulations" ON public.exchange_simulations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to exchange simulations" ON public.exchange_simulations;
CREATE POLICY "Service role full access to exchange simulations" ON public.exchange_simulations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
