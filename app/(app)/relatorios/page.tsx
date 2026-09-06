"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import { currentMonth, labelForMonth, monthRange, shiftMonth } from "@/components/MonthNav";
import { fetchPagamentos, type PagamentoRegistro } from "@/lib/pagamentos";

function firstMonthOfYear(month: string) {
  const [year] = month.split("-");
  return `${year}-01`;
}

function lastMonthOfYear(month: string) {
  const [year] = month.split("-");
  return `${year}-12`;
}

export default function RelatoriosPage() {
  const supabase = createClient();
  const [deMes, setDeMes] = useState(currentMonth());
  const [ateMes, setAteMes] = useState(currentMonth());
  const [pagamentos, setPagamentos] = useState<PagamentoRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(de: string, ate: string) {
    setLoading(true);
    const start = monthRange(de).start;
    const end = monthRange(ate).end;
    const registros = await fetchPagamentos(supabase, { start, end });
    setPagamentos(registros);
    setLoading(false);
  }

  useEffect(() => {
    load(deMes, ateMes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deMes, ateMes]);

  function applyPreset(preset: "mes" | "mes-passado" | "ano" | "ano-passado") {
    const now = currentMonth();
    if (preset === "mes") {
      setDeMes(now);
      setAteMes(now);
    } else if (preset === "mes-passado") {
      const prev = shiftMonth(now, -1);
      setDeMes(prev);
      setAteMes(prev);
    } else if (preset === "ano") {
      setDeMes(firstMonthOfYear(now));
      setAteMes(now);
    } else if (preset === "ano-passado") {
      const prevYear = shiftMonth(firstMonthOfYear(now), -1);
      setDeMes(firstMonthOfYear(prevYear));
      setAteMes(lastMonthOfYear(prevYear));
    }
  }

  const totalGeral = pagamentos.reduce((acc, p) => acc + p.valor + p.valor_juros, 0);
  const totalJuros = pagamentos.reduce((acc, p) => acc + p.valor_juros, 0);

  const porCategoria = Object.entries(
    pagamentos.reduce<Record<string, number>>((acc, p) => {
      const cat = p.categoria ?? "Outros";
      acc[cat] = (acc[cat] ?? 0) + p.valor + p.valor_juros;
      return acc;
    }, {})
  )
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const porOrigem = Object.entries(
    pagamentos.reduce<Record<string, number>>((acc, p) => {
      acc[p.origem] = (acc[p.origem] ?? 0) + p.valor + p.valor_juros;
      return acc;
    }, {})
  )
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const periodoComVariosMeses = deMes !== ateMes;

  const porMes = periodoComVariosMeses
    ? Object.entries(
        pagamentos.reduce<Record<string, number>>((acc, p) => {
          const mes = p.data_pagamento.slice(0, 7);
          acc[mes] = (acc[mes] ?? 0) + p.valor + p.valor_juros;
          return acc;
        }, {})
      )
        .map(([mes, valor]) => ({ mes, valor }))
        .sort((a, b) => (a.mes < b.mes ? -1 : 1))
    : [];

  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Relatórios</h1>
        <p className="text-sm text-neutral-500">
          Tudo que foi efetivamente pago no período — Contas Fixas, Variáveis e Futuras juntas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-neutral-600">De</label>
          <input
            type="month"
            value={deMes}
            onChange={(e) => setDeMes(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <label className="text-neutral-600">até</label>
          <input
            type="month"
            value={ateMes}
            onChange={(e) => setAteMes(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "mes" as const, label: "Este mês" },
            { key: "mes-passado" as const, label: "Mês passado" },
            { key: "ano" as const, label: "Este ano" },
            { key: "ano-passado" as const, label: "Ano passado" },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Total pago no período</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatCurrency(totalGeral)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Juros/multa pagos</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatCurrency(totalJuros)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Contas pagas</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{pagamentos.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Por categoria</h2>
          {porCategoria.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">Nada pago nesse período.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {porCategoria.map((c) => (
                <li key={c.nome} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{c.nome}</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Por tipo de conta</h2>
          {porOrigem.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">Nada pago nesse período.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {porOrigem.map((o) => (
                <li key={o.nome} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{o.nome}</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(o.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {periodoComVariosMeses && porMes.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Por mês</h2>
          <ul className="mt-3 space-y-2">
            {porMes.map((m) => (
              <li key={m.mes} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{labelForMonth(m.mes)}</span>
                <span className="font-medium text-neutral-900">{formatCurrency(m.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Extrato do período</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-neutral-400">
                <th className="px-4 py-3">Data pgto.</th>
                <th className="px-4 py-3">Nome</th>
                <th className="hidden px-4 py-3 sm:table-cell">Origem</th>
                <th className="hidden px-4 py-3 sm:table-cell">Categoria</th>
                <th className="px-4 py-3">Valor</th>
                <th className="hidden px-4 py-3 sm:table-cell">Juros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-400" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : pagamentos.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-400" colSpan={6}>
                    Nenhum pagamento registrado nesse período.
                  </td>
                </tr>
              ) : (
                pagamentos.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                      {formatDate(p.data_pagamento)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{p.nome}</td>
                    <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">
                      {p.origem}
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">
                      {p.categoria ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                      {formatCurrency(p.valor)}
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">
                      {p.valor_juros > 0 ? formatCurrency(p.valor_juros) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
