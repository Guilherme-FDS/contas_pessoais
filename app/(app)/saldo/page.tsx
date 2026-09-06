"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import MonthNav, { currentMonth, monthRange } from "@/components/MonthNav";
import { fetchPagamentos, type PagamentoRegistro } from "@/lib/pagamentos";
import type { SaldoMensal } from "@/lib/types";

export default function SaldoPage() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [saldoMensal, setSaldoMensal] = useState<SaldoMensal | null>(null);
  const [valorInicial, setValorInicial] = useState("");
  const [pagamentos, setPagamentos] = useState<PagamentoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingValor, setEditingValor] = useState(false);

  async function load() {
    setLoading(true);
    const { start, end } = monthRange(selectedMonth);
    const [saldoRes, registros] = await Promise.all([
      supabase.from("saldo_mensal").select("*").eq("mes", selectedMonth).maybeSingle(),
      fetchPagamentos(supabase, { start, end }),
    ]);
    const saldo = (saldoRes.data ?? null) as SaldoMensal | null;
    setSaldoMensal(saldo);
    setValorInicial(saldo ? String(saldo.valor_inicial) : "");
    setPagamentos(registros);
    setEditingValor(!saldo);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  async function handleSaveValorInicial(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("saldo_mensal")
      .upsert(
        {
          mes: selectedMonth,
          valor_inicial: Number(valorInicial) || 0,
          created_by: user?.id,
        },
        { onConflict: "mes" }
      );
    setSaving(false);
    load();
  }

  const totalSaida = pagamentos.reduce((acc, p) => acc + p.valor + p.valor_juros, 0);
  const totalJuros = pagamentos.reduce((acc, p) => acc + p.valor_juros, 0);
  const valorDisponivel = saldoMensal ? Number(saldoMensal.valor_inicial) : 0;
  const saldoAtual = valorDisponivel - totalSaida;

  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Saldo</h1>
          <p className="text-sm text-neutral-500">
            Lance quanto você tem disponível no mês. Cada pagamento marcado como &quot;Paguei&quot;
            nas outras abas entra aqui automaticamente e desconta do saldo.
          </p>
        </div>
        <MonthNav month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Valor disponível no mês</p>
          {editingValor ? (
            <form onSubmit={handleSaveValorInicial} className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                autoFocus
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "..." : "Salvar"}
              </button>
            </form>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold text-neutral-900">
                {formatCurrency(valorDisponivel)}
              </p>
              <button
                type="button"
                onClick={() => setEditingValor(true)}
                className="text-xs font-medium text-neutral-500 hover:underline"
              >
                Editar
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Já saiu no mês</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatCurrency(totalSaida)}
          </p>
          {totalJuros > 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              Inclui {formatCurrency(totalJuros)} de juros/multa
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Saldo atual</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              saldoAtual < 0 ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {formatCurrency(saldoAtual)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Pagamentos do mês</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-neutral-400">
                <th className="px-4 py-3">Data pgto.</th>
                <th className="px-4 py-3">Nome</th>
                <th className="hidden px-4 py-3 sm:table-cell">Origem</th>
                <th className="px-4 py-3">Vencimento</th>
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
                    Nenhum pagamento registrado nesse mês ainda.
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
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {formatDate(p.data_vencimento)}
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
