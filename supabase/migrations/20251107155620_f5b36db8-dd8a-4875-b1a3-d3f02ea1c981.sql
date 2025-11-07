-- Create order flow analysis table
CREATE TABLE IF NOT EXISTS public.order_flow_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '1m', '5m', '15m'
  buy_volume NUMERIC NOT NULL,
  sell_volume NUMERIC NOT NULL,
  net_volume NUMERIC NOT NULL, -- buy - sell
  volume_delta_pct NUMERIC NOT NULL,
  large_orders_count INTEGER NOT NULL DEFAULT 0,
  institutional_flow TEXT, -- 'accumulation', 'distribution', 'neutral'
  price NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create large orders detection table
CREATE TABLE IF NOT EXISTS public.large_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'BUY', 'SELL'
  size NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  value_usd NUMERIC NOT NULL,
  is_institutional BOOLEAN NOT NULL DEFAULT false,
  impact_score NUMERIC, -- 0-100
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.order_flow_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.large_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies (público para leitura)
CREATE POLICY "Everyone can view order flow"
  ON public.order_flow_analysis
  FOR SELECT
  USING (true);

CREATE POLICY "Everyone can view large orders"
  ON public.large_orders
  FOR SELECT
  USING (true);

-- Create indexes
CREATE INDEX idx_order_flow_symbol_timestamp ON public.order_flow_analysis(symbol, timestamp DESC);
CREATE INDEX idx_large_orders_symbol_detected ON public.large_orders(symbol, detected_at DESC);
CREATE INDEX idx_large_orders_institutional ON public.large_orders(is_institutional, detected_at DESC);