create table if not exists public.ambassador_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ambassador_accounts_email_lower_key
  on public.ambassador_accounts (lower(email));

alter table public.ambassador_accounts enable row level security;
revoke all on table public.ambassador_accounts from anon, authenticated;
grant all on table public.ambassador_accounts to service_role;
