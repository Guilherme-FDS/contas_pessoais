-- Item 7: estrutura do Cartão de Crédito (fica INATIVA — sem link no menu,
-- sem conexão com o total de Contas Variáveis/Resumo).
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create table if not exists public.fatura_cartao (
  id uuid primary key default gen_random_uuid(),
  mes_referencia text not null,
  arquivo_origem text,
  data_importacao timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.fatura_cartao enable row level security;

create policy "authenticated_full_access" on public.fatura_cartao
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.transacao_cartao (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references public.fatura_cartao(id) on delete cascade,
  data date,
  descricao text not null,
  valor numeric(12,2) not null,
  categoria text,
  parcela_atual int,
  total_parcelas int,
  created_at timestamptz not null default now()
);

alter table public.transacao_cartao enable row level security;

create policy "authenticated_full_access" on public.transacao_cartao
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
