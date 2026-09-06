-- Aba de Saldo ("quanto eu tenho") + data de pagamento em Contas Variáveis/Futuras
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

-- ========== DATA DE PAGAMENTO ==========
-- Contas Fixas já registra isso em contas_fixas_pagamentos.pago_em.
-- Contas Variáveis e Futuras só tinham o flag "pago" — agora guardam quando
-- o pagamento aconteceu de fato, pra alimentar o extrato da aba Saldo.
alter table public.contas_variaveis
  add column if not exists pago_em timestamptz;

alter table public.contas_futuras
  add column if not exists pago_em timestamptz;

-- Backfill: quem já estava marcado como pago recebe a data de atualização
-- como aproximação da data de pagamento.
update public.contas_variaveis set pago_em = updated_at where pago = true and pago_em is null;
update public.contas_futuras set pago_em = updated_at where status = 'pago' and pago_em is null;

-- ========== SALDO MENSAL ==========
-- Guarda quanto a família tem disponível em cada mês (lançado manualmente,
-- sem herdar saldo do mês anterior). O saldo atual é esse valor menos a soma
-- de tudo que foi pago no mês (contas_fixas_pagamentos + contas_variaveis +
-- contas_futuras, agrupado pela data real de pagamento).
create table if not exists public.saldo_mensal (
  id uuid primary key default gen_random_uuid(),
  mes text not null unique,
  valor_inicial numeric(12,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saldo_mensal enable row level security;

create policy "authenticated_full_access" on public.saldo_mensal
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create trigger set_updated_at before update on public.saldo_mensal
  for each row execute function public.set_updated_at();
