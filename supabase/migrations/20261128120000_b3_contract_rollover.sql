-- =============================================
-- ROLLOVER DOS CONTRATOS B3 (28/11/2026)
-- WDOZ26 -> WDOF27 em 02/12/2026; WINZ26 -> WINF27 em 17/12/2026.
-- A whitelist antiga é substituída por uma tabela de contratos com vigência.
-- Nenhuma ordem real é criada: B3 continua somente sinais/simulação.
-- =============================================

CREATE TABLE IF NOT EXISTS public.b3_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  valid_from DATE NOT NULL,
  expires_at DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT b3_contracts_valid_window CHECK (expires_at >= valid_from)
);

-- Contratos legados do plano antigo nunca podem voltar a ser vigentes.
DELETE FROM public.b3_contracts WHERE upper(symbol) IN ('WINZ25', 'WDOF26');
ALTER TABLE public.b3_contracts DROP CONSTRAINT IF EXISTS b3_contracts_no_legacy_symbols;
ALTER TABLE public.b3_contracts ADD CONSTRAINT b3_contracts_no_legacy_symbols
  CHECK (upper(symbol) NOT IN ('WINZ25', 'WDOF26'));

INSERT INTO public.b3_contracts (symbol, valid_from, expires_at, ativo) VALUES
  ('WINZ26', DATE '2026-01-01', DATE '2026-12-16', true),
  ('WDOZ26', DATE '2026-01-01', DATE '2026-12-01', true),
  ('WINF27', DATE '2026-12-17', DATE '2027-01-31', true),
  ('WDOF27', DATE '2026-12-02', DATE '2027-01-31', true)
ON CONFLICT (symbol) DO UPDATE
  SET valid_from = EXCLUDED.valid_from,
      expires_at = EXCLUDED.expires_at,
      ativo = EXCLUDED.ativo;

ALTER TABLE public.b3_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read b3 contracts" ON public.b3_contracts;
CREATE POLICY "Authenticated users can read b3 contracts" ON public.b3_contracts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access to b3 contracts" ON public.b3_contracts;
CREATE POLICY "Service role full access to b3 contracts" ON public.b3_contracts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Remove os CHECKs antigos que fixavam a whitelist WINZ26/WDOZ26 (ou que
-- proibiam apenas WINZ25/WDOF26), consultando nome e definição no catálogo.
DO $$
DECLARE
  tbl TEXT;
  constraint_names TEXT[];
  constraint_name TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['b3_ticks', 'b3_signals', 'b3_analysis'] LOOP
    -- Nomes gerados automaticamente pelo Postgres e nome histórico explícito.
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_symbol_check');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_no_expired_symbol');

    SELECT array_agg(c.conname) INTO constraint_names
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name = c.conname
     AND tc.table_schema = n.nspname
     AND tc.table_name = t.relname
     AND tc.constraint_type = 'CHECK'
    WHERE n.nspname = 'public'
      AND t.relname = tbl
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* 'symbol'
      AND (
        pg_get_constraintdef(c.oid) ~* 'WINZ25|WDOF26|WINZ26|WDOZ26'
        OR c.conname ~* 'symbol|expired'
      );

    IF constraint_names IS NOT NULL THEN
      FOREACH constraint_name IN ARRAY constraint_names LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, constraint_name);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Validação dinâmica: o símbolo precisa existir, estar ativo e vigente hoje.
CREATE OR REPLACE FUNCTION public.b3_assert_valid_contract_symbol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.b3_contracts c
    WHERE upper(c.symbol) = upper(btrim(NEW.symbol))
      AND c.ativo
      AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN c.valid_from AND c.expires_at
  ) THEN
    RAISE EXCEPTION 'Símbolo B3 inválido ou contrato não vigente: %', NEW.symbol
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS b3_ticks_valid_contract ON public.b3_ticks;
CREATE TRIGGER b3_ticks_valid_contract
  BEFORE INSERT OR UPDATE ON public.b3_ticks
  FOR EACH ROW EXECUTE FUNCTION public.b3_assert_valid_contract_symbol();

DROP TRIGGER IF EXISTS b3_signals_valid_contract ON public.b3_signals;
CREATE TRIGGER b3_signals_valid_contract
  BEFORE INSERT OR UPDATE ON public.b3_signals
  FOR EACH ROW EXECUTE FUNCTION public.b3_assert_valid_contract_symbol();

DROP TRIGGER IF EXISTS b3_analysis_valid_contract ON public.b3_analysis;
CREATE TRIGGER b3_analysis_valid_contract
  BEFORE INSERT OR UPDATE ON public.b3_analysis
  FOR EACH ROW EXECUTE FUNCTION public.b3_assert_valid_contract_symbol();
