create table if not exists public.catalog_customers (
  id serial primary key,
  account_code text not null,
  account_name text not null,
  owner_user_id text not null,
  created_at timestamp not null default now(),
  unique (account_code, owner_user_id)
);

create index if not exists catalog_customers_owner_user_id_idx on public.catalog_customers(owner_user_id);
create index if not exists catalog_customers_account_code_idx on public.catalog_customers(account_code);
