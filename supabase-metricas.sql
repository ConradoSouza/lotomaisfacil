-- Métricas simples e privadas (sem dados pessoais): contadores por dia e por tipo de evento.
-- Rode no SQL Editor do Supabase (uma vez).
create table if not exists metricas (
  dia  date not null,
  tipo text not null,
  n    int  not null default 0,
  primary key (dia, tipo)
);
alter table metricas enable row level security; -- sem policies: só as funções abaixo e o service_role

-- Registra um evento (soma 1 no contador do dia). Não guarda quem foi — só a contagem.
create or replace function registrar_evento(p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo is null or length(p_tipo) > 40 then return; end if;
  insert into metricas (dia, tipo, n) values (current_date, p_tipo, 1)
  on conflict (dia, tipo) do update set n = metricas.n + 1;
end; $$;
grant execute on function registrar_evento(text) to anon, authenticated;

-- Lê as métricas dos últimos 30 dias — SÓ para admins (tabela admins).
create or replace function ler_metricas()
returns table (tipo text, total int, hoje int)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then return; end if;
  return query
    select m.tipo, sum(m.n)::int as total,
           coalesce(sum(m.n) filter (where m.dia = current_date), 0)::int as hoje
    from metricas m
    where m.dia >= current_date - 30
    group by m.tipo order by total desc;
end; $$;
grant execute on function ler_metricas() to authenticated;
