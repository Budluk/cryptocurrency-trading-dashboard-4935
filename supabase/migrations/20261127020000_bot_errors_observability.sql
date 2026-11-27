-- =============================================
-- OBSERVABILIDADE: bot_errors
-- A tabela era consultada pelo ObservabilityPanel e existia apenas no schema
-- gerado, sem DDL reproduzível no repositório.
-- =============================================

CREATE TABLE IF NOT EXISTS public.bot_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT auth.uid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_errors_user_created
  ON public.bot_errors(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_errors_resolved
  ON public.bot_errors(resolved, created_at DESC);

ALTER TABLE public.bot_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bot errors" ON public.bot_errors;
DROP POLICY IF EXISTS "Users can update own bot errors" ON public.bot_errors;
DROP POLICY IF EXISTS "Service role can manage bot errors" ON public.bot_errors;

-- Erros sem usuário são do sistema e ficam visíveis para o dashboard.
CREATE POLICY "Users can view bot errors" ON public.bot_errors
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can update own bot errors" ON public.bot_errors
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage bot errors" ON public.bot_errors
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.bot_errors TO authenticated;
GRANT ALL ON public.bot_errors TO service_role;
