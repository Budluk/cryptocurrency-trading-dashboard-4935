-- Fix 1: Add search_path to SECURITY DEFINER functions for protection against search path manipulation attacks

-- Update clean_old_football_cache function
CREATE OR REPLACE FUNCTION public.clean_old_football_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.football_fixtures WHERE cached_at < now() - interval '2 hours';
  DELETE FROM public.football_odds WHERE cached_at < now() - interval '30 minutes';
  DELETE FROM public.ai_football_signals WHERE expires_at < now();
END;
$function$;

-- Update update_trader_stats function
CREATE OR REPLACE FUNCTION public.update_trader_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Atualizar estatísticas quando uma posição é fechada
  IF NEW.status = 'CLOSED' AND OLD.status = 'OPEN' THEN
    INSERT INTO public.trader_profiles (
      user_id,
      display_name,
      total_trades,
      winning_trades,
      total_pnl,
      win_rate,
      profit_factor
    )
    VALUES (
      NEW.user_id,
      'Trader',
      1,
      CASE WHEN NEW.realized_pnl > 0 THEN 1 ELSE 0 END,
      NEW.realized_pnl,
      CASE WHEN NEW.realized_pnl > 0 THEN 100 ELSE 0 END,
      CASE WHEN NEW.realized_pnl > 0 THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_trades = trader_profiles.total_trades + 1,
      winning_trades = trader_profiles.winning_trades + CASE WHEN NEW.realized_pnl > 0 THEN 1 ELSE 0 END,
      total_pnl = trader_profiles.total_pnl + NEW.realized_pnl,
      win_rate = CASE 
        WHEN (trader_profiles.total_trades + 1) > 0 
        THEN ((trader_profiles.winning_trades + CASE WHEN NEW.realized_pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / (trader_profiles.total_trades + 1)::NUMERIC) * 100
        ELSE 0 
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update invoke_auto_trader_webhook function
CREATE OR REPLACE FUNCTION public.invoke_auto_trader_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  headers JSON;
  body JSON;
  request_id BIGINT;
BEGIN
  -- Ensure the user_id from the signal is passed to the webhook
  IF NEW.user_id IS NULL THEN
    -- Optionally, log an error or handle cases where user_id is missing
    RETURN NEW;
  END IF;

  headers := json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true));
  body := json_build_object('record', NEW);

  -- Asynchronously invoke the Edge Function using pg_net
  SELECT net.http_post(
    url:= current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-trader-webhook',
    headers:=headers,
    body:=body
  ) INTO request_id;

  RETURN NEW;
END;
$function$;

-- Fix 2: Make user_id NOT NULL on tables with RLS policies
-- First, ensure all existing rows have valid user_id values (set to a system user if needed)

-- Update bet_alerts
UPDATE public.bet_alerts SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.bet_alerts ALTER COLUMN user_id SET NOT NULL;

-- Update logs  
UPDATE public.logs SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.logs ALTER COLUMN user_id SET NOT NULL;

-- Update open_positions
UPDATE public.open_positions SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.open_positions ALTER COLUMN user_id SET NOT NULL;

-- Update signal_history
UPDATE public.signal_history SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.signal_history ALTER COLUMN user_id SET NOT NULL;

-- Update strategies
UPDATE public.strategies SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.strategies ALTER COLUMN user_id SET NOT NULL;

-- Update strategy_performance
UPDATE public.strategy_performance SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.strategy_performance ALTER COLUMN user_id SET NOT NULL;

-- Update trading_signals
UPDATE public.trading_signals SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.trading_signals ALTER COLUMN user_id SET NOT NULL;

-- Update trading_strategies
UPDATE public.trading_strategies SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.trading_strategies ALTER COLUMN user_id SET NOT NULL;

-- Update user_preferences
UPDATE public.user_preferences SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE public.user_preferences ALTER COLUMN user_id SET NOT NULL;