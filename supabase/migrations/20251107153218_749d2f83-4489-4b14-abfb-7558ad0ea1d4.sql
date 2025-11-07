-- Criar tabela de perfis públicos de traders
CREATE TABLE IF NOT EXISTS public.trader_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  profit_factor NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  sharpe_ratio NUMERIC,
  followers_count INTEGER NOT NULL DEFAULT 0,
  avg_trade_duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar tabela de seguidores/copiers
CREATE TABLE IF NOT EXISTS public.copy_trading_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capital_allocation_percent NUMERIC NOT NULL DEFAULT 10 CHECK (capital_allocation_percent > 0 AND capital_allocation_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_confidence NUMERIC NOT NULL DEFAULT 70,
  max_leverage INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_user_id, trader_user_id)
);

-- Criar tabela de configuração de copy trading
CREATE TABLE IF NOT EXISTS public.copy_trading_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  total_capital_for_copy NUMERIC NOT NULL DEFAULT 100,
  min_trader_win_rate NUMERIC NOT NULL DEFAULT 60,
  max_trader_drawdown NUMERIC NOT NULL DEFAULT 20,
  min_trader_trades INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_trader_profiles_win_rate ON public.trader_profiles(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_trader_profiles_total_pnl ON public.trader_profiles(total_pnl DESC);
CREATE INDEX IF NOT EXISTS idx_trader_profiles_public ON public.trader_profiles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_copy_followers_trader ON public.copy_trading_followers(trader_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_copy_followers_follower ON public.copy_trading_followers(follower_user_id) WHERE is_active = true;

-- RLS Policies para trader_profiles
ALTER TABLE public.trader_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public traders are viewable by everyone"
  ON public.trader_profiles FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can manage their own trader profile"
  ON public.trader_profiles FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies para copy_trading_followers
ALTER TABLE public.copy_trading_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own follows"
  ON public.copy_trading_followers FOR ALL
  USING (auth.uid() = follower_user_id);

CREATE POLICY "Traders can view their followers"
  ON public.copy_trading_followers FOR SELECT
  USING (auth.uid() = trader_user_id);

-- RLS Policies para copy_trading_config
ALTER TABLE public.copy_trading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own copy config"
  ON public.copy_trading_config FOR ALL
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_trader_profiles_updated_at
  BEFORE UPDATE ON public.trader_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_copy_followers_updated_at
  BEFORE UPDATE ON public.copy_trading_followers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_copy_config_updated_at
  BEFORE UPDATE ON public.copy_trading_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar estatísticas do trader
CREATE OR REPLACE FUNCTION public.update_trader_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar stats do trader
CREATE TRIGGER trigger_update_trader_stats
  AFTER UPDATE ON public.auto_trader_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trader_stats();