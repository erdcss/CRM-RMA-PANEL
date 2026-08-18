alter table public.tickets
  add column if not exists owner_user_id text;

create index if not exists tickets_owner_user_id_idx on public.tickets(owner_user_id);
