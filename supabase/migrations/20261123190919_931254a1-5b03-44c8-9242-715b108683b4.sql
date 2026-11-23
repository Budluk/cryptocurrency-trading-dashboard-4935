DROP TRIGGER IF EXISTS on_new_signal_invoke_webhook ON public.trading_signals;
DROP FUNCTION IF EXISTS public.invoke_auto_trader_webhook();