-- Inscrições de Web Push (avisos de resultado). Rode no SQL Editor do Supabase.
-- Pode rodar de novo com segurança (idempotente) — inclusive se você já tinha rodado a versão antiga.
create table if not exists push_subs (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table push_subs enable row level security;

-- Remove as políticas da versão antiga (o INSERT direto pelo app dava erro de RLS).
drop policy if exists push_insert on push_subs;
drop policy if exists push_update on push_subs;
drop policy if exists push_delete on push_subs;
-- Sem policies: ninguém acessa a tabela direto. Quem escreve são as funções abaixo
-- (security definer) e o service_role (robô de envio, que lê as inscrições).

-- Salvar/atualizar a própria inscrição (funciona logado ou não).
create or replace function salvar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into push_subs (endpoint, p256dh, auth, user_id)
    values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth   = excluded.auth,
        user_id = coalesce(excluded.user_id, push_subs.user_id);
end; $$;
grant execute on function salvar_push(text, text, text) to anon, authenticated;

-- Remover a própria inscrição.
create or replace function remover_push(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from push_subs where endpoint = p_endpoint;
end; $$;
grant execute on function remover_push(text) to anon, authenticated;
