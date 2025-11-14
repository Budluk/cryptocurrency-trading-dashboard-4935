-- Add RLS policies for auto_trader_logs table
-- This allows users to view and insert their own trading logs

-- Policy for users to view their own logs
CREATE POLICY "Users can view their own logs"
ON public.auto_trader_logs FOR SELECT
USING (auth.uid() = user_id);

-- Policy for users to insert their own logs
CREATE POLICY "Users can insert their own logs"
ON public.auto_trader_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for service role to insert logs without user_id (for webhooks)
CREATE POLICY "Service role can insert any logs"
ON public.auto_trader_logs FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');