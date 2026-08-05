-- Loto+Facil — adiciona o Mês da Sorte às apostas sincronizadas (Dia de Sorte).
-- Rode no Supabase: SQL Editor -> Run
alter table public.jogos add column if not exists mes text;
