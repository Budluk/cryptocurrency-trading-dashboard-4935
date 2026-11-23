DROP POLICY IF EXISTS "Anyone can view AI signals" ON public.ai_football_signals;
DROP POLICY IF EXISTS "Authenticated users can view AI football signals" ON public.ai_football_signals;
DROP POLICY IF EXISTS "Authenticated users can view order flow" ON public.order_flow_analysis;
DROP POLICY IF EXISTS "Authenticated users can view image analysis" ON public.image_analysis;
DROP POLICY IF EXISTS "Authenticated users can view large orders" ON public.large_orders;
DROP POLICY IF EXISTS "Authenticated users can view market events" ON public.market_events;
DROP POLICY IF EXISTS "Authenticated users can view AI market signals" ON public.ai_market_signals;
DROP POLICY IF EXISTS "Authenticated users can view sentiment analysis" ON public.sentiment_analysis;
DROP POLICY IF EXISTS "Authenticated users can view market data" ON public.market_data;
DROP POLICY IF EXISTS "Authenticated users can view sentiment" ON public.sentiment_signals;
DROP POLICY IF EXISTS "Authenticated users can view news analysis" ON public.news_analysis;
DROP POLICY IF EXISTS "Everyone can view odds comparison" ON public.odds_comparison;
DROP POLICY IF EXISTS "Anyone can view odds history" ON public.odds_history;
DROP POLICY IF EXISTS "Anyone can view fixtures" ON public.football_fixtures;
DROP POLICY IF EXISTS "Anyone can view odds" ON public.football_odds;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_football_signals','order_flow_analysis','image_analysis','large_orders','market_events','ai_market_signals','sentiment_analysis','market_data','sentiment_signals','news_analysis','odds_comparison','odds_history','football_fixtures','football_odds','asset_correlations','market_anomalies','market_data_cache']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_predictions TO authenticated;
GRANT ALL ON public.ml_predictions TO service_role;
CREATE POLICY "Users manage own ml predictions" ON public.ml_predictions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own performance" ON public.strategy_performance;
CREATE POLICY "Users can view their own performance" ON public.strategy_performance FOR SELECT USING (auth.uid() = user_id);