CREATE TABLE public.strategy_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  titulo TEXT NOT NULL,
  ficha JSONB NOT NULL,
  fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','em_analise','descartada','aprovada_para_backtest')),
  notas TEXT
);
GRANT SELECT, UPDATE ON public.strategy_leads TO authenticated;
GRANT ALL ON public.strategy_leads TO service_role;
ALTER TABLE public.strategy_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view strategy leads" ON public.strategy_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update lead status and notes" ON public.strategy_leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actor UUID,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_log_actor_at ON public.audit_log (actor, at DESC);
CREATE INDEX idx_strategy_leads_created_by ON public.strategy_leads (created_by, created_at DESC);