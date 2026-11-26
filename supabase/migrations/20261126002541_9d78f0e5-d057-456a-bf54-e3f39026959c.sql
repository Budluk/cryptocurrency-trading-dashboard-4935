DROP POLICY IF EXISTS "Authenticated users can view sentiment signals" ON public.sentiment_signals;
DROP POLICY IF EXISTS "Everyone can view odds movements" ON public.odds_movements;
DROP POLICY IF EXISTS "Anyone can view funding opportunities" ON public.complementary_bot_funding_opportunities;
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['odds_movements','bybit_market_data','candle_data','team_statistics','bybit_pairs','market_sentiment_cache','complementary_bot_funding_opportunities','sentiment_signals'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd IN ('SELECT','ALL') AND (qual='true' OR qual ILIKE '%auth.uid() IS NOT NULL%') LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Admins read %s" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;