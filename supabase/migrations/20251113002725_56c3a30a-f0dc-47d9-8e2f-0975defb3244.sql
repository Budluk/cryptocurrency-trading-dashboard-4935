-- Fix security warning for reset_daily_loss function
DROP FUNCTION IF EXISTS reset_daily_loss();

CREATE OR REPLACE FUNCTION reset_daily_loss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE risk_management_settings
  SET current_daily_loss = 0,
      trading_paused = false,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$;