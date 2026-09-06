-- Recorrência automática de Contas Variáveis (luz, água, internet...)
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

-- `recorrente` marca a conta como "se repete todo mês".
-- `recorrencia_id` amarra todas as ocorrências da mesma conta ao longo dos meses:
-- a primeira ocorrência recebe o próprio id, e as geradas depois herdam esse valor.
alter table public.contas_variaveis
  add column if not exists recorrente boolean not null default false,
  add column if not exists recorrencia_id uuid;

-- Garante no banco que a mesma conta recorrente não seja lançada duas vezes no
-- mesmo mês, mesmo que duas pessoas cliquem em "lançar" ao mesmo tempo.
-- O ::timestamp é obrigatório: sem ele o Postgres pode escolher a versão de
-- date_trunc que depende do fuso (STABLE) e recusar o índice, derrubando o
-- script inteiro junto — inclusive o alter table acima.
create unique index if not exists contas_variaveis_recorrencia_mes_uidx
  on public.contas_variaveis (recorrencia_id, (date_trunc('month', data::timestamp)))
  where recorrencia_id is not null;

-- A primeira ocorrência de uma conta recorrente vira a "cabeça" da corrente:
-- recebe o próprio id como recorrencia_id. As ocorrências geradas nos meses
-- seguintes copiam esse mesmo valor, então o app sabe que são a mesma conta.
create or replace function public.set_recorrencia_id()
returns trigger as $$
begin
  if new.recorrente and new.recorrencia_id is null then
    new.recorrencia_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_recorrencia_id on public.contas_variaveis;
create trigger set_recorrencia_id before insert or update on public.contas_variaveis
  for each row execute function public.set_recorrencia_id();
