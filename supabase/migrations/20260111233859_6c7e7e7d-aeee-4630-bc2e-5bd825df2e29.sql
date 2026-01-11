-- 1. CORRIGIR: Profiles - apenas o próprio usuário pode ver seu perfil
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. CORRIGIR: user_exchange_keys - garantir que APENAS o dono pode acessar
DROP POLICY IF EXISTS "Users can view own exchange keys" ON public.user_exchange_keys;
DROP POLICY IF EXISTS "Users can insert own exchange keys" ON public.user_exchange_keys;
DROP POLICY IF EXISTS "Users can update own exchange keys" ON public.user_exchange_keys;
DROP POLICY IF EXISTS "Users can delete own exchange keys" ON public.user_exchange_keys;

CREATE POLICY "Users can view own exchange keys" 
ON public.user_exchange_keys 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exchange keys" 
ON public.user_exchange_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exchange keys" 
ON public.user_exchange_keys 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exchange keys" 
ON public.user_exchange_keys 
FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Marcar football_fixtures como público intencionalmente (já é cache público)
-- Não precisa mudar, mas podemos adicionar comentário
COMMENT ON TABLE public.football_fixtures IS 'Cache público de partidas de futebol - acessível sem autenticação por design';