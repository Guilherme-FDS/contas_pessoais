-- Item 1/2: "Paguei" + juros em Contas Variáveis
-- Item 5: juros em Contas Futuras
-- Item 3/4: parcelas + pagamento detalhado (valor pago, juros) em Contas Fixas
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

-- ========== CONTAS VARIÁVEIS ==========
alter table public.contas_variaveis
  add column if not exists pago boolean not null default false,
  add column if not exists valor_juros numeric(12,2) not null default 0,
  add column if not exists valor_pago numeric(12,2);

-- ========== CONTAS FUTURAS ==========
alter table public.contas_futuras
  add column if not exists valor_juros numeric(12,2) not null default 0,
  add column if not exists valor_pago numeric(12,2);

-- ========== CONTAS FIXAS: controle de parcelas (opt-in por conta) ==========
alter table public.contas_fixas
  add column if not exists tem_parcelas boolean not null default false,
  add column if not exists total_parcelas int,
  add column if not exists parcela_inicial int not null default 1,
  add column if not exists data_primeira_parcela date;

-- ========== CONTAS FIXAS PAGAMENTOS: evolui de "existe linha = pago" ==========
-- para registrar valor pago e juros por competência.
alter table public.contas_fixas_pagamentos
  add column if not exists pago boolean not null default true,
  add column if not exists valor_pago numeric(12,2),
  add column if not exists valor_juros numeric(12,2) not null default 0;

-- Backfill: linhas que já existiam representavam "paguei esse mês" sem
-- guardar o valor — preenche com o valor atual da conta fixa correspondente.
update public.contas_fixas_pagamentos p
set valor_pago = cf.valor
from public.contas_fixas cf
where p.conta_fixa_id = cf.id
  and p.valor_pago is null;
