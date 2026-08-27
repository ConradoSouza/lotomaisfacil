-- Inscrições de Web Push (avisos de resultado). Rode no SQL Editor do Supabase (uma vez).
create table if not exists push_subs (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table push_subs enable row level security;

-- Qualquer visitante pode inscrever / atualizar / remover a PRÓPRIA inscrição.
-- (o endpoint é uma URL secreta e opaca do navegador; sem SELECT, ninguém lê as inscrições dos outros)
drop policy if exists push_insert on push_subs;
drop policy if exists push_update on push_subs;
drop policy if exists push_delete on push_subs;
create policy push_insert on push_subs for insert to anon, authenticated with check (true);
create policy push_update on push_subs for update to anon, authenticated using (true) with check (true);
create policy push_delete on push_subs for delete to anon, authenticated using (true);
-- Sem policy de SELECT: apenas o service_role (usado pelo robô de envio) consegue ler.
