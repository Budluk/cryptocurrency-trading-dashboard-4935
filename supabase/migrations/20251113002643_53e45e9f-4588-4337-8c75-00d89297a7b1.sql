-- Add columns for advanced trading features
ALTER TABLE auto_trader_positions 
ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS partial_tp_executed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS daily_pnl NUMERIC DEFAULT 0;

-- Create table for risk management settings
CREATE TABLE IF NOT EXISTS risk_management_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  max_positions INTEGER DEFAULT 5,
  max_daily_loss NUMERIC DEFAULT 100,
  current_daily_loss NUMERIC DEFAULT 0,
  trading_paused BOOLEAN DEFAULT false,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE risk_management_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own risk settings"
ON risk_management_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk settings"
ON risk_management_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own risk settings"
ON risk_management_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_risk_management_settings_updated_at
BEFORE UPDATE ON risk_management_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily loss at midnight
CREATE OR REPLACE FUNCTION reset_daily_loss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE risk_management_settings
  SET current_daily_loss = 0,
      trading_paused = false,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$;