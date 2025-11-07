-- Create ML adaptive config table
CREATE TABLE IF NOT EXISTS public.ml_adaptive_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  recommended_stop_loss_pct NUMERIC DEFAULT 2.0,
  recommended_take_profit_pct NUMERIC DEFAULT 4.0,
  recommended_leverage INTEGER DEFAULT 10,
  confidence_score NUMERIC DEFAULT 0,
  trades_analyzed INTEGER DEFAULT 0,
  win_rate_by_leverage JSONB DEFAULT '{}',
  optimal_patterns JSONB DEFAULT '{}',
  last_analysis_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ml_adaptive_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own ML config"
  ON public.ml_adaptive_config
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_ml_adaptive_config_user_id ON public.ml_adaptive_config(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_ml_adaptive_config_updated_at
  BEFORE UPDATE ON public.ml_adaptive_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();