-- Run through the Supabase migration tool as a privileged database test.
-- No records or grants are created; session identity is restored after testing.
DO $test$
DECLARE
  target_table text;
  admin_id uuid;
  baseline bigint;
  visible bigint;
  original_role text := current_setting('role');
  original_claims text := coalesce(current_setting('request.jwt.claims', true), '{}');
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'An existing admin is required'; END IF;

  FOREACH target_table IN ARRAY ARRAY['b3_contracts','b3_signals','prompt_versions','b3_ticks','b3_analysis'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', target_table) INTO baseline;
    IF target_table = 'b3_contracts' AND baseline = 0 THEN
      RAISE EXCEPTION 'Contract fixtures must be nonempty to validate access';
    END IF;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text, true);
    PERFORM set_config('role','authenticated',true);
    EXECUTE format('SELECT count(*) FROM public.%I',target_table) INTO visible;
    PERFORM set_config('role',original_role,true);
    IF visible <> baseline THEN RAISE EXCEPTION 'Admin read failed: %',target_table; END IF;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub','00000000-0000-4000-8000-000000000099','role','authenticated','is_anonymous',false)::text,true);
    PERFORM set_config('role','authenticated',true);
    EXECUTE format('SELECT count(*) FROM public.%I',target_table) INTO visible;
    PERFORM set_config('role',original_role,true);
    IF visible <> 0 THEN RAISE EXCEPTION 'Unassigned account can read: %',target_table; END IF;

    -- Even a guest with a matching admin identifier must be denied.
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',true)::text,true);
    PERFORM set_config('role','authenticated',true);
    EXECUTE format('SELECT count(*) FROM public.%I',target_table) INTO visible;
    PERFORM set_config('role',original_role,true);
    IF visible <> 0 THEN RAISE EXCEPTION 'Guest can read: %',target_table; END IF;

    PERFORM set_config('role','service_role',true);
    EXECUTE format('SELECT count(*) FROM public.%I',target_table) INTO visible;
    PERFORM set_config('role',original_role,true);
    IF visible <> baseline THEN RAISE EXCEPTION 'Internal service read failed: %',target_table; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims',original_claims,true);
  PERFORM set_config('role',original_role,true);
END
$test$;