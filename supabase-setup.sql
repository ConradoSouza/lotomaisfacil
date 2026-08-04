-- ============================================================
-- Loto+Facil — configuração do banco (rode no Supabase:
-- SQL Editor → New query → cole tudo → Run)
-- ============================================================

-- ---------- PERFIS (1 por usuário) ----------
create table if not exists public.perfis (
  id uuid references auth.users on delete cascade primary key,
  nome text,
  plano text not null default 'free',   -- 'free' | 'pro'
  pro_ate timestamptz,                   -- vencimento do Pro (null = sem Pro)
  criado_em timestamptz default now()
);

alter table public.perfis enable row level security;

-- cada um vê e edita só o próprio perfil
drop policy if exists "ver o próprio perfil" on public.perfis;
create policy "ver o próprio perfil" on public.perfis
  for select using (auth.uid() = id);

drop policy if exists "editar o próprio perfil" on public.perfis;
create policy "editar o próprio perfil" on public.perfis
  for update using (auth.uid() = id);

-- IMPORTANTE p/ monetização: o usuário só pode mudar o "nome".
-- Quem muda "plano"/"pro_ate" é o painel (service_role) ou o webhook do pagamento.
revoke update on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------- JOGOS SALVOS (sincronizados na nuvem) ----------
create table if not exists public.jogos (
  id text primary key,               -- mesmo id usado no app
  user_id uuid references auth.users on delete cascade not null,
  loteria text not null,
  nums int[] not null,
  nome text default '',
  cart text,
  alvo int,
  created bigint,
  atualizado_em timestamptz default now()
);

create index if not exists jogos_user_idx on public.jogos (user_id);

alter table public.jogos enable row level security;

drop policy if exists "gerenciar os próprios jogos" on public.jogos;
create policy "gerenciar os próprios jogos" on public.jogos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
