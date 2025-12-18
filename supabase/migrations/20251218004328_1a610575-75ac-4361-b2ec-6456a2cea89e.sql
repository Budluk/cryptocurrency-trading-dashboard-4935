-- Remove foreign key constraint on ml_adaptive_config that references auth.users
-- The app uses anonymous user IDs that don't exist in auth.users

ALTER TABLE public.ml_adaptive_config 
DROP CONSTRAINT IF EXISTS ml_adaptive_config_user_id_fkey;