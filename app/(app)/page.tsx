import { createClient } from "@/lib/supabase/server";
import SummaryCard, { formatCurrency } from "@/components/SummaryCard";
import type { ContaFixa, ContaFutura, ContaVariavel, Investimento } from "@/lib/types";

export const dynamic = "force-dynamic";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { start, end } = monthRange();

  const [fixasRes, variaveisRes, futurasRes, investimentosRes] = await Promise.all([
    supabase.from("contas_fixas").select("*").eq("ativo", true),
    supabase.from("contas_variaveis").select("*").gte("data", start).lt("data", end),
    supabase.from("contas_futuras").select("*").order("data_prevista", { ascending: true }),
    supabase.from("investimentos").select("*"),
  ]);

  const fixas = (fixasRes.data ?? []) as ContaFixa[];
  const variaveis = (variaveisRes.data ?? []) as ContaVariavel[];
  const futuras = (futurasRes.data ?? []) as ContaFutura[];
  const investimentos = (investimentosRes.data ?? []) as Investimento[];

  const totalFixas = fixas.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalVariaveis = variaveis.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalFuturasMarcadas = futuras
    .filter((c) => c.incluir_soma)
    .reduce((acc, c) => acc + Number(c.valor), 0);
  const totalInvestido = investimentos.reduce((acc, i) => acc + Number(i.valor_investido), 0);

  const porCategoria = investimentos.reduce<Record<string, number>>((acc, i) => {
    acc[i.categoria] = (acc[i.categoria] ?? 0) + Number(i.valor_investido);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Resumo</h1>
        <p className="text-sm text-neutral-500">
          Visão geral das finanças da família neste mês.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Contas Fixas (mensal)" value={totalFixas} />
        <SummaryCard label="Contas Variáveis (mês atual)" value={totalVariaveis} />
        <SummaryCard
          label="Contas Futuras marcadas"
          value={totalFuturasMarcadas}
          hint="Soma apenas dos itens com o flag ativado"
        />
        <SummaryCard label="Total Investido" value={totalInvestido} />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">
          Investimentos por categoria
        </h2>
        {Object.keys(porCategoria).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nenhum investimento cadastrado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {Object.entries(porCategoria).map(([categoria, valor]) => (
              <li key={categoria} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{categoria}</span>
                <span className="font-medium text-neutral-900">{formatCurrency(valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">
          Total a pagar somando tudo (mês atual + futuras marcadas)
        </h2>
        <p className="mt-2 text-2xl font-semibold text-brand-700">
          {formatCurrency(totalFixas + totalVariaveis + totalFuturasMarcadas)}
        </p>
      </div>
    </div>
  );
}
