-- Loto+Facil — tabela de pagamentos (rode no Supabase: SQL Editor → Run)
-- Guarda cada pagamento aprovado (evita processar duas vezes e serve de registro).
create table if not exists public.pagamentos (
  mp_id text primary key,                 -- id do pagamento no Mercado Pago
  user_id uuid references auth.users on delete set null,
  valor numeric,
  status text,
  criado_em timestamptz default now()
);

alter table public.pagamentos enable row level security;
-- sem policies: só o servidor (service_role, no webhook) acessa esta tabela.
