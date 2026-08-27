-- Indique e ganhe — rode no SQL Editor do Supabase (uma vez).
-- Recompensa: quando o INDICADO assina o Pro (pagamento), o INDICADOR ganha 15 dias de Pro.
-- Só premia em pagamento real (não em cadastro/teste), então não dá pra burlar com contas fake.

alter table perfis add column if not exists ref_by uuid references auth.users(id);
alter table perfis add column if not exists ref_reward_done boolean default false;

-- Registra quem indicou (1x só; não pode ser você mesmo; o indicador precisa existir).
create or replace function set_referral(ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if ref is null or ref = auth.uid() then return; end if;
  if not exists (select 1 from perfis where id = ref) then return; end if;
  update perfis set ref_by = ref where id = auth.uid() and ref_by is null;
end; $$;
grant execute on function set_referral(uuid) to authenticated;

-- Premia o indicador quando o indicado vira Pro. Roda no banco (disparado pelo update do webhook),
-- sem precisar alterar a Edge Function de pagamento.
create or replace function premiar_indicacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.plano = 'pro' and (OLD.plano is distinct from 'pro')
     and NEW.ref_by is not null and NEW.ref_reward_done is not true then
    update perfis
       set plano = 'pro',
           pro_ate = greatest(coalesce(pro_ate, now()), now()) + interval '15 days'
     where id = NEW.ref_by;
    NEW.ref_reward_done := true;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_premiar_indicacao on perfis;
create trigger trg_premiar_indicacao before update on perfis
  for each row execute function premiar_indicacao();
