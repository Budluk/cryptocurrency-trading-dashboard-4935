INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email IN ('budniaklucas90@gmail.com','lucasbudniak0013@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
GRANT SELECT ON public.large_orders, public.sentiment_analysis TO authenticated;
GRANT SELECT, INSERT ON public.whale_activity TO authenticated;