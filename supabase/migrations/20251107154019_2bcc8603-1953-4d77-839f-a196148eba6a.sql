-- Adicionar controle de estado ativo do trader
ALTER TABLE public.auto_trader_config
ADD COLUMN IF NOT EXISTS trader_is_running BOOLEAN NOT NULL DEFAULT false;

-- Adicionar timestamp de última atividade
ALTER TABLE public.auto_trader_config
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();