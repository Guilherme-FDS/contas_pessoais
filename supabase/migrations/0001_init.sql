-- Gestão Financeira Familiar - schema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- ========== CONTAS FIXAS ==========
create table if not exists public.contas_fixas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12,2) not null,
  dia_vencimento int check (dia_vencimento between 1 and 31),
  categoria text,
  ativo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== CONTAS VARIÁVEIS ==========
create table if not exists public.contas_variaveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12,2) not null,
  data date not null default current_date,
  categoria text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== CONTAS FUTURAS (a negociar / pagar no futuro) ==========
create table if not exists public.contas_futuras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12,2) not null,
  categoria text,
  data_prevista date,
  status text not null default 'pendente' check (status in ('pendente', 'negociando', 'pago')),
  incluir_soma boolean not null default false,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== INVESTIMENTOS ==========
create table if not exists public.investimentos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  ativo text not null,
  valor_investido numeric(12,2) not null,
  data_aplicacao date not null default current_date,
  corretora text,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== RLS: qualquer usuário autenticado do projeto pode ler/escrever tudo ==========
-- (app privado e compartilhado para 2 pessoas, sem separação por usuário)

alter table public.contas_fixas enable row level security;
alter table public.contas_variaveis enable row level security;
alter table public.contas_futuras enable row level security;
alter table public.investimentos enable row level security;

create policy "authenticated_full_access" on public.contas_fixas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on public.contas_variaveis
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on public.contas_futuras
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on public.investimentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ========== updated_at automático ==========
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.contas_fixas
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.contas_variaveis
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.contas_futuras
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.investimentos
  for each row execute function public.set_updated_at();
