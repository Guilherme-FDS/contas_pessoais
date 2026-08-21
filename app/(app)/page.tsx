"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SummaryCard, { formatCurrency } from "@/components/SummaryCard";
import MonthNav, { currentMonth, labelForMonth, monthRange } from "@/components/MonthNav";
import type { ContaFixa, ContaFutura, ContaVariavel, Investimento } from "@/lib/types";

function firstName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
} | null | undefined) {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const metaName = (meta.full_name as string) || (meta.name as string);
  if (metaName) return metaName.split(" ")[0];
  if (user.email) {
    const local = user.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "";
}

export default function DashboardPage() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [userName, setUserName] = useState("");
  const [fixas, setFixas] = useState<ContaFixa[]>([]);
  const [variaveis, setVariaveis] = useState<ContaVariavel[]>([]);
  const [futuras, setFuturas] = useState<ContaFutura[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserName(firstName(data.user)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { start, end } = monthRange(selectedMonth);
      const [fixasRes, variaveisRes, futurasRes, investimentosRes] = await Promise.all([
        supabase.from("contas_fixas").select("*").eq("ativo", true),
        supabase.from("contas_variaveis").select("*").gte("data", start).lt("data", end),
        supabase.from("contas_futuras").select("*").order("data_prevista", { ascending: true }),
        supabase.from("investimentos").select("*"),
      ]);
      setFixas((fixasRes.data ?? []) as ContaFixa[]);
      setVariaveis((variaveisRes.data ?? []) as ContaVariavel[]);
      setFuturas((futurasRes.data ?? []) as ContaFutura[]);
      setInvestimentos((investimentosRes.data ?? []) as Investimento[]);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

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
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {userName ? `Bem-vindo, ${userName}!` : "Resumo"}
          </h1>
          <p className="text-sm text-neutral-500">
            Visão geral das finanças da família em {labelForMonth(selectedMonth).toLowerCase()}.
          </p>
        </div>
        <MonthNav month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Contas Fixas (mensal)" value={totalFixas} />
        <SummaryCard label="Contas Variáveis do mês" value={totalVariaveis} />
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
          Total a pagar em {labelForMonth(selectedMonth).toLowerCase()} (fixas + variáveis do mês + futuras marcadas)
        </h2>
        <p className="mt-2 text-2xl font-semibold text-brand-700">
          {formatCurrency(totalFixas + totalVariaveis + totalFuturasMarcadas)}
        </p>
      </div>
    </div>
  );
}
