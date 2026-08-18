create table if not exists public.catalog_products (
  id serial primary key,
  stock_code text not null,
  stock_name text not null,
  owner_user_id text not null,
  created_at timestamp not null default now(),
  unique (stock_code, owner_user_id)
);

create index if not exists catalog_products_owner_user_id_idx on public.catalog_products(owner_user_id);
create index if not exists catalog_products_stock_code_idx on public.catalog_products(stock_code);
