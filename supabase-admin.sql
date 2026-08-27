-- Health-check do robô: quem recebe o alerta de falha (push) quando a atualização falha.
-- Rode no SQL Editor do Supabase (uma vez). Troque o e-mail pelo seu, se for outro.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security; -- sem policies: só o service_role (robô) lê

-- Adiciona você como admin. Você precisa já ter criado sua conta no app com esse e-mail.
insert into admins (user_id)
  select id from auth.users where email = 'kalebsolucoes@gmail.com'
  on conflict do nothing;
