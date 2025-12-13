-- Adicionar constraint UNIQUE no user_id para permitir upsert
ALTER TABLE public.ml_adaptive_config 
ADD CONSTRAINT ml_adaptive_config_user_id_key UNIQUE (user_id);