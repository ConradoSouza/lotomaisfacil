-- Trial de 7 dias grátis do Pro — rode no SQL Editor do Supabase (uma vez).
-- 1) coluna que marca quando o teste foi ativado (fica com a DATA DE FIM do teste)
alter table perfis add column if not exists trial_ate timestamptz;

-- 2) função segura: ativa o teste UMA vez, mexendo só no próprio registro.
--    (security definer: o usuário não pode alterar plano/pro_ate direto — só chamar esta função)
create or replace function ativar_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v timestamptz;
begin
  update perfis
     set trial_ate = now() + interval '7 days'
   where id = auth.uid() and trial_ate is null
   returning trial_ate into v;
  if v is null then
    select trial_ate into v from perfis where id = auth.uid();
  end if;
  return v;
end; $$;

grant execute on function ativar_trial() to authenticated;
