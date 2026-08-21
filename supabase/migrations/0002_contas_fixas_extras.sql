-- Histórico de valores + controle de pagamento mensal das Contas Fixas
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

-- ========== HISTÓRICO DE VALORES ==========
create table if not exists public.contas_fixas_historico (
  id uuid primary key default gen_random_uuid(),
  conta_fixa_id uuid not null references public.contas_fixas(id) on delete cascade,
  valor numeric(12,2) not null,
  vigente_desde date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.contas_fixas_historico enable row level security;

create policy "authenticated_full_access" on public.contas_fixas_historico
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Registra automaticamente no histórico sempre que uma conta fixa for criada
-- ou tiver o valor alterado.
create or replace function public.log_contas_fixas_valor()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.contas_fixas_historico (conta_fixa_id, valor)
    values (new.id, new.valor);
  elsif tg_op = 'UPDATE' and new.valor is distinct from old.valor then
    insert into public.contas_fixas_historico (conta_fixa_id, valor)
    values (new.id, new.valor);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists log_valor_insert on public.contas_fixas;
create trigger log_valor_insert after insert on public.contas_fixas
  for each row execute function public.log_contas_fixas_valor();

drop trigger if exists log_valor_update on public.contas_fixas;
create trigger log_valor_update after update on public.contas_fixas
  for each row execute function public.log_contas_fixas_valor();

-- Semeia o histórico com o valor atual das contas que já existiam antes desta migração
insert into public.contas_fixas_historico (conta_fixa_id, valor, vigente_desde, created_at)
select id, valor, created_at::date, created_at
from public.contas_fixas cf
where not exists (
  select 1 from public.contas_fixas_historico h where h.conta_fixa_id = cf.id
);

-- ========== CONTROLE DE PAGAMENTO MENSAL ==========
-- A existência de uma linha aqui = "paguei essa conta fixa nesse mês".
-- Some automaticamente sempre que vira o mês (fica sem registro pro novo mês).
create table if not exists public.contas_fixas_pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_fixa_id uuid not null references public.contas_fixas(id) on delete cascade,
  mes text not null,
  pago_em date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (conta_fixa_id, mes)
);

alter table public.contas_fixas_pagamentos enable row level security;

create policy "authenticated_full_access" on public.contas_fixas_pagamentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
