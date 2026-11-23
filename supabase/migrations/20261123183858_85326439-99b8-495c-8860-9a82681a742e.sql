CREATE TABLE public.trading_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  proposal jsonb,
  proposal_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trading_chat_messages TO authenticated;
GRANT ALL ON public.trading_chat_messages TO service_role;
ALTER TABLE public.trading_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own chat" ON public.trading_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX trading_chat_messages_user_created ON public.trading_chat_messages (user_id, created_at);