-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.

create table if not exists public.records (
  user_id           uuid        not null default auth.uid() references auth.users on delete cascade,
  collection        text        not null,
  id                text        not null,
  data              jsonb,
  deleted           boolean     not null default false,
  updated_at        timestamptz not null,           -- horário da edição no aparelho
  server_updated_at timestamptz not null default now(), -- usado como cursor da sincronização
  primary key (user_id, collection, id)
);

create index if not exists records_sync_idx on public.records (user_id, server_updated_at);

alter table public.records enable row level security;

drop policy if exists "dono le e escreve" on public.records;
create policy "dono le e escreve" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Marca o horário do servidor e mantém a edição mais recente quando dois aparelhos conflitam.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch();
