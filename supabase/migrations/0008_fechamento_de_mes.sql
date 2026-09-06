-- Fechamento de mês: depois de conferido, o caixa do mês vira número fechado.
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create table if not exists public.meses_fechados (
  mes text primary key,
  fechado_em timestamptz not null default now(),
  fechado_por uuid references auth.users(id),
  total_pago numeric(12,2),
  observacoes text
);

alter table public.meses_fechados enable row level security;

drop policy if exists "authenticated_full_access" on public.meses_fechados;
create policy "authenticated_full_access" on public.meses_fechados
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- A trava precisa viver no banco: bloquear só na tela seria sugestão, não regra.
-- O mês de um lançamento é decidido pela coluna passada como argumento no
-- trigger (a data real de pagamento, ou o próprio mês no caso do saldo).
-- Lançamento ainda não pago tem essa coluna nula e continua livre pra editar —
-- o que está fechado é o caixa daquele mês, não o cadastro da conta.
create or replace function public.bloqueia_mes_fechado()
returns trigger as $$
declare
  campo text := tg_argv[0];
  mes_novo text;
  mes_antigo text;
begin
  if tg_op <> 'DELETE' then
    mes_novo := left(to_json(new) ->> campo, 7);
  end if;
  if tg_op <> 'INSERT' then
    mes_antigo := left(to_json(old) ->> campo, 7);
  end if;

  -- Barra tanto entrar quanto sair de um mês fechado.
  if mes_novo is not null
     and exists (select 1 from public.meses_fechados where mes = mes_novo) then
    raise exception 'O mês % está fechado. Reabra o mês para alterar lançamentos dele.', mes_novo
      using errcode = 'check_violation';
  end if;

  if mes_antigo is not null
     and mes_antigo is distinct from mes_novo
     and exists (select 1 from public.meses_fechados where mes = mes_antigo) then
    raise exception 'O mês % está fechado. Reabra o mês para alterar lançamentos dele.', mes_antigo
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists bloqueia_mes_fechado on public.contas_fixas_pagamentos;
create trigger bloqueia_mes_fechado
  before insert or update or delete on public.contas_fixas_pagamentos
  for each row execute function public.bloqueia_mes_fechado('pago_em');

drop trigger if exists bloqueia_mes_fechado on public.contas_variaveis;
create trigger bloqueia_mes_fechado
  before insert or update or delete on public.contas_variaveis
  for each row execute function public.bloqueia_mes_fechado('pago_em');

drop trigger if exists bloqueia_mes_fechado on public.contas_futuras;
create trigger bloqueia_mes_fechado
  before insert or update or delete on public.contas_futuras
  for each row execute function public.bloqueia_mes_fechado('pago_em');

drop trigger if exists bloqueia_mes_fechado on public.saldo_mensal;
create trigger bloqueia_mes_fechado
  before insert or update or delete on public.saldo_mensal
  for each row execute function public.bloqueia_mes_fechado('mes');
