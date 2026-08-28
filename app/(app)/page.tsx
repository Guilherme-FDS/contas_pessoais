"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import SummaryCard, { formatCurrency } from "@/components/SummaryCard";
import MonthNav, { currentMonth, labelForMonth, monthRange } from "@/components/MonthNav";
import type {
  ContaFixa,
  ContaFixaPagamento,
  ContaFutura,
  ContaVariavel,
  Investimento,
} from "@/lib/types";

const BUCKET_COLORS = ["#14915d", "#f59e0b", "#ef4444"];
const CATEGORY_COLOR = "#1fb473";

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
  const [fixasPagamentos, setFixasPagamentos] = useState<ContaFixaPagamento[]>([]);
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
      const [fixasRes, fixasPagRes, variaveisRes, futurasRes, investimentosRes] =
        await Promise.all([
          supabase.from("contas_fixas").select("*"),
          supabase.from("contas_fixas_pagamentos").select("*").eq("mes", selectedMonth),
          supabase.from("contas_variaveis").select("*").gte("data", start).lt("data", end),
          supabase.from("contas_futuras").select("*").order("data_prevista", { ascending: true }),
          supabase.from("investimentos").select("*"),
        ]);
      setFixas((fixasRes.data ?? []) as ContaFixa[]);
      setFixasPagamentos((fixasPagRes.data ?? []) as ContaFixaPagamento[]);
      setVariaveis((variaveisRes.data ?? []) as ContaVariavel[]);
      setFuturas((futurasRes.data ?? []) as ContaFutura[]);
      setInvestimentos((investimentosRes.data ?? []) as Investimento[]);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const fixasAtivas = fixas.filter((f) => f.ativo);
  // Contas já pagas na competência entram pelo valor realmente pago (com
  // juros/multa); as ainda não pagas entram pelo valor programado.
  const totalFixas = fixasAtivas.reduce((acc, c) => {
    const payment = fixasPagamentos.find((p) => p.conta_fixa_id === c.id && p.pago);
    const value = payment
      ? Number(payment.valor_pago ?? c.valor) + Number(payment.valor_juros ?? 0)
      : Number(c.valor);
    return acc + value;
  }, 0);
  const totalVariaveis = variaveis.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalFuturasMarcadas = futuras
    .filter((c) => c.incluir_soma)
    .reduce((acc, c) => acc + Number(c.valor), 0);
  const totalInvestido = investimentos.reduce((acc, i) => acc + Number(i.valor_investido), 0);

  const fixasPagas = fixasPagamentos.filter((p) => p.pago);
  const totalFixasPago = fixasPagas.reduce(
    (acc, p) => acc + Number(p.valor_pago ?? 0) + Number(p.valor_juros ?? 0),
    0
  );
  const variaveisPagas = variaveis.filter((v) => v.pago);
  const totalVariaveisPago = variaveisPagas.reduce(
    (acc, v) => acc + Number(v.valor_pago ?? v.valor) + Number(v.valor_juros ?? 0),
    0
  );
  const futurasPagas = futuras.filter((f) => f.status === "pago");
  const totalFuturasPago = futurasPagas.reduce(
    (acc, f) => acc + Number(f.valor) + Number(f.valor_juros ?? 0),
    0
  );
  const totalPago = totalFixasPago + totalVariaveisPago + totalFuturasPago;

  const porCategoriaInvestimentos = investimentos.reduce<Record<string, number>>((acc, i) => {
    acc[i.categoria] = (acc[i.categoria] ?? 0) + Number(i.valor_investido);
    return acc;
  }, {});

  const bucketData = [
    { name: "Fixas", value: totalFixasPago },
    { name: "Variáveis", value: totalVariaveisPago },
    { name: "Futuras", value: totalFuturasPago },
  ].filter((b) => b.value > 0);

  const porCategoriaPago: Record<string, number> = {};
  for (const p of fixasPagas) {
    const conta = fixas.find((f) => f.id === p.conta_fixa_id);
    const cat = conta?.categoria ?? "Outros";
    porCategoriaPago[cat] =
      (porCategoriaPago[cat] ?? 0) + Number(p.valor_pago ?? 0) + Number(p.valor_juros ?? 0);
  }
  for (const v of variaveisPagas) {
    const cat = v.categoria ?? "Outros";
    porCategoriaPago[cat] =
      (porCategoriaPago[cat] ?? 0) + Number(v.valor_pago ?? v.valor) + Number(v.valor_juros ?? 0);
  }
  for (const f of futurasPagas) {
    const cat = f.categoria ?? "Outros";
    porCategoriaPago[cat] =
      (porCategoriaPago[cat] ?? 0) + Number(f.valor) + Number(f.valor_juros ?? 0);
  }
  const categoryData = Object.entries(porCategoriaPago)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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
        {Object.keys(porCategoriaInvestimentos).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nenhum investimento cadastrado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {Object.entries(porCategoriaInvestimentos).map(([categoria, valor]) => (
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
        <p className="mt-3 text-sm text-neutral-500">
          Já pago (com juros/multa quando houver):{" "}
          <span className="font-semibold text-neutral-900">{formatCurrency(totalPago)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">
            Proporção paga — Fixas / Variáveis / Futuras
          </h2>
          {bucketData.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">
              Nada pago ainda em {labelForMonth(selectedMonth).toLowerCase()}.
            </p>
          ) : (
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bucketData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={(entry) => entry.name}
                  >
                    {bucketData.map((entry, index) => (
                      <Cell key={entry.name} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Pago por categoria no mês</h2>
          {categoryData.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">
              Nada pago ainda em {labelForMonth(selectedMonth).toLowerCase()}.
            </p>
          ) : (
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill={CATEGORY_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
