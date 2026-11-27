-- Anonymous Sign-Ins falhavam com "Database error creating anonymous user".
-- handle_new_user() e create_demo_account_for_user() sao ambas disparadas apos
-- INSERT em auth.users e as duas inserem em demo_accounts. Sem ON CONFLICT a
-- segunda trigger estourava demo_accounts_user_id_unique (23505) e abortava a
-- transacao do Auth.
CREATE OR REPLACE FUNCTION public.create_demo_account_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.demo_accounts (user_id, initial_balance, current_balance)
  VALUES (NEW.id, 10000, 10000)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
