-- Aba de Consórcios
-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create table if not exists public.consorcios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  administradora text,
  numero_cota text,
  valor_carta numeric(12,2) not null,
  valor_parcela numeric(12,2) not null,
  parcela_atual int,
  total_parcelas int,
  status text not null default 'ativo' check (status in ('ativo', 'contemplado', 'quitado', 'cancelado')),
  data_adesao date,
  data_contemplacao date,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consorcios enable row level security;

create policy "authenticated_full_access" on public.consorcios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop trigger if exists set_updated_at on public.consorcios;
create trigger set_updated_at before update on public.consorcios
  for each row execute function public.set_updated_at();
