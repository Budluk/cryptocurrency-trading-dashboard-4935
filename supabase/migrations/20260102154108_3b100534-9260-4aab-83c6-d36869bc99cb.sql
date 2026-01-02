-- Adicionar política RLS para ai_learning_data permitir inserções anônimas
DROP POLICY IF EXISTS "Users can insert their own learning data" ON public.ai_learning_data;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.ai_learning_data;
DROP POLICY IF EXISTS "Allow all inserts" ON public.ai_learning_data;

-- Permitir inserções para todos (usuários autenticados e anônimos)
CREATE POLICY "Allow all inserts on ai_learning_data"
ON public.ai_learning_data
FOR INSERT
WITH CHECK (true);

-- Permitir leitura para todos
DROP POLICY IF EXISTS "Allow all selects" ON public.ai_learning_data;
CREATE POLICY "Allow all selects on ai_learning_data"
ON public.ai_learning_data
FOR SELECT
USING (true);

-- Permitir updates
DROP POLICY IF EXISTS "Allow all updates" ON public.ai_learning_data;
CREATE POLICY "Allow all updates on ai_learning_data"
ON public.ai_learning_data
FOR UPDATE
USING (true);