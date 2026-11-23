create table public.bybit_rsa_keys (
  id smallint primary key default 1 check (id = 1),
  private_pem text not null,
  public_pem text not null,
  created_at timestamptz not null default now()
);
alter table public.bybit_rsa_keys enable row level security;
revoke all on public.bybit_rsa_keys from anon, authenticated;
grant all on public.bybit_rsa_keys to service_role;