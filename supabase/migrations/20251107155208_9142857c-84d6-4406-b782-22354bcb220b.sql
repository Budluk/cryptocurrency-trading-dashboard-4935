-- Create sentiment analysis table
CREATE TABLE IF NOT EXISTS public.sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  source TEXT NOT NULL, -- 'news', 'twitter', 'reddit', 'telegram'
  sentiment_score NUMERIC NOT NULL, -- -1 a 1
  confidence NUMERIC NOT NULL, -- 0 a 100
  content TEXT,
  url TEXT,
  keywords TEXT[],
  impact_prediction JSONB,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create portfolio rebalancing config table
CREATE TABLE IF NOT EXISTS public.portfolio_rebalance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rebalance_frequency TEXT NOT NULL DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  max_position_drift_pct NUMERIC NOT NULL DEFAULT 20, -- Máximo de desvio antes de rebalancear
  min_correlation_threshold NUMERIC NOT NULL DEFAULT 0.7, -- Correlação mínima para ajustar
  target_allocations JSONB NOT NULL DEFAULT '{}', -- {symbol: percentage}
  auto_execute BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create rebalancing history table
CREATE TABLE IF NOT EXISTS public.portfolio_rebalance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rebalance_type TEXT NOT NULL, -- 'correlation', 'performance', 'drift', 'manual'
  recommendations JSONB NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT false,
  executed_at TIMESTAMP WITH TIME ZONE,
  performance_before JSONB,
  performance_after JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_rebalance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_rebalance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sentiment_analysis (público para leitura)
CREATE POLICY "Everyone can view sentiment analysis"
  ON public.sentiment_analysis
  FOR SELECT
  USING (true);

-- RLS Policies for portfolio_rebalance_config
CREATE POLICY "Users can manage their own rebalance config"
  ON public.portfolio_rebalance_config
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for portfolio_rebalance_history
CREATE POLICY "Users can view their own rebalance history"
  ON public.portfolio_rebalance_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rebalance history"
  ON public.portfolio_rebalance_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_sentiment_analysis_symbol ON public.sentiment_analysis(symbol);
CREATE INDEX idx_sentiment_analysis_analyzed_at ON public.sentiment_analysis(analyzed_at DESC);
CREATE INDEX idx_portfolio_rebalance_config_user_id ON public.portfolio_rebalance_config(user_id);
CREATE INDEX idx_portfolio_rebalance_history_user_id ON public.portfolio_rebalance_history(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_portfolio_rebalance_config_updated_at
  BEFORE UPDATE ON public.portfolio_rebalance_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();