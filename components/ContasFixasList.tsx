"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import MonthNav, { currentMonth, shiftMonth } from "@/components/MonthNav";
import { CATEGORIAS_CONTAS } from "@/lib/categorias";
import { dueStatusByDayOfMonth } from "@/lib/dueStatus";
import DueStatusBadge, { DueStatusLegend } from "@/components/DueStatusBadge";
import type { ContaFixa, ContaFixaHistorico, ContaFixaPagamento } from "@/lib/types";

function emptyForm() {
  return {
    nome: "",
    valor: "",
    dia_vencimento: "",
    categoria: "",
    total_parcelas: "",
    parcela_inicial: "1",
    data_primeira_parcela: "",
  };
}

function emptyPaymentForm() {
  return { valor_pago: "", valor_juros: "0" };
}

export default function ContasFixasList() {
  const supabase = createClient();

  const [items, setItems] = useState<ContaFixa[]>([]);
  const [allPagamentos, setAllPagamentos] = useState<ContaFixaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState(emptyForm());
  const [temParcelas, setTemParcelas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterVencimento, setFilterVencimento] = useState("");
  const [historicoFor, setHistoricoFor] = useState<ContaFixa | null>(null);
  const [historico, setHistorico] = useState<ContaFixaHistorico[]>([]);
  const [paymentFor, setPaymentFor] = useState<ContaFixa | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm());
  const [savingPayment, setSavingPayment] = useState(false);

  const isCurrentMonth = selectedMonth === currentMonth();

  async function load() {
    setLoading(true);
    const [contasRes, pagamentosRes] = await Promise.all([
      supabase.from("contas_fixas").select("*").order("nome", { ascending: true }),
      supabase.from("contas_fixas_pagamentos").select("*"),
    ]);
    setItems((contasRes.data ?? []) as ContaFixa[]);
    setAllPagamentos((pagamentosRes.data ?? []) as ContaFixaPagamento[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paymentOf(item: ContaFixa, mes: string) {
    return allPagamentos.find((p) => p.conta_fixa_id === item.id && p.mes === mes);
  }

  function isPaid(item: ContaFixa, mes: string) {
    return Boolean(paymentOf(item, mes)?.pago);
  }

  function monthsBetween(from: string, to: string): number {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  // A parcela é definida pelo calendário (mês a mês desde data_primeira_parcela),
  // não por quantos meses já foram pagos — se setembro ainda não foi pago, ele
  // continua sendo "a parcela 20", só que em aberto (não some/regride).
  function parcelaAtual(item: ContaFixa, uptoMonth: string): number | null {
    if (!item.tem_parcelas || !item.data_primeira_parcela) return null;
    const startMonth = item.data_primeira_parcela.slice(0, 7);
    const elapsed = monthsBetween(startMonth, uptoMonth);
    if (elapsed < 0) return null;
    return item.parcela_inicial + elapsed;
  }

  function overdueSinceMonth(item: ContaFixa): string | null {
    if (!isCurrentMonth) return null;
    const createdMonth = item.created_at.slice(0, 7);
    let cursor = shiftMonth(currentMonth(), -1);
    let earliest: string | null = null;
    for (let i = 0; i < 12; i++) {
      if (cursor < createdMonth) break;
      if (isPaid(item, cursor)) break;
      earliest = cursor;
      cursor = shiftMonth(cursor, -1);
    }
    return earliest;
  }

  function openNewForm() {
    setEditingId(null);
    setFormValues(emptyForm());
    setTemParcelas(false);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(item: ContaFixa) {
    setEditingId(item.id);
    setFormValues({
      nome: item.nome,
      valor: String(item.valor),
      dia_vencimento: item.dia_vencimento ? String(item.dia_vencimento) : "",
      categoria: item.categoria ?? "",
      total_parcelas: item.total_parcelas ? String(item.total_parcelas) : "",
      parcela_inicial: String(item.parcela_inicial ?? 1),
      data_primeira_parcela: item.data_primeira_parcela ?? "",
    });
    setTemParcelas(item.tem_parcelas);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome: formValues.nome,
      valor: Number(formValues.valor),
      dia_vencimento: formValues.dia_vencimento ? Number(formValues.dia_vencimento) : null,
      categoria: formValues.categoria || null,
      tem_parcelas: temParcelas,
      total_parcelas: temParcelas && formValues.total_parcelas ? Number(formValues.total_parcelas) : null,
      parcela_inicial: temParcelas && formValues.parcela_inicial ? Number(formValues.parcela_inicial) : 1,
      data_primeira_parcela: temParcelas && formValues.data_primeira_parcela ? formValues.data_primeira_parcela : null,
    };

    if (editingId) {
      const { error } = await supabase.from("contas_fixas").update(payload).eq("id", editingId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("contas_fixas")
        .insert({ ...payload, created_by: user?.id });
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este item?")) return;
    await supabase.from("contas_fixas").delete().eq("id", id);
    load();
  }

  async function handleStatusChange(id: string, ativo: boolean) {
    await supabase.from("contas_fixas").update({ ativo }).eq("id", id);
    load();
  }

  async function handleTogglePaid(item: ContaFixa) {
    if (!isCurrentMonth) return;
    if (isPaid(item, selectedMonth)) {
      await supabase
        .from("contas_fixas_pagamentos")
        .delete()
        .eq("conta_fixa_id", item.id)
        .eq("mes", selectedMonth);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("contas_fixas_pagamentos").insert({
        conta_fixa_id: item.id,
        mes: selectedMonth,
        pago: true,
        valor_pago: item.valor,
        valor_juros: 0,
        created_by: user?.id,
      });
    }
    load();
  }

  function openPaymentEdit(item: ContaFixa) {
    const payment = paymentOf(item, selectedMonth);
    setPaymentForm({
      valor_pago: payment?.valor_pago != null ? String(payment.valor_pago) : String(item.valor),
      valor_juros: payment?.valor_juros != null ? String(payment.valor_juros) : "0",
    });
    setPaymentFor(item);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentFor) return;
    setSavingPayment(true);
    await supabase
      .from("contas_fixas_pagamentos")
      .update({
        valor_pago: Number(paymentForm.valor_pago),
        valor_juros: Number(paymentForm.valor_juros) || 0,
      })
      .eq("conta_fixa_id", paymentFor.id)
      .eq("mes", selectedMonth);
    setSavingPayment(false);
    setPaymentFor(null);
    load();
  }

  async function openHistorico(item: ContaFixa) {
    setHistoricoFor(item);
    const { data } = await supabase
      .from("contas_fixas_historico")
      .select("*")
      .eq("conta_fixa_id", item.id)
      .order("vigente_desde", { ascending: false });
    setHistorico((data ?? []) as ContaFixaHistorico[]);
  }

  const statusFiltered = items.filter((item) => item.ativo === !showInactive);

  const filtered = statusFiltered.filter((item) => {
    if (filterCategoria && item.categoria !== filterCategoria) return false;
    if (filterVencimento && String(item.dia_vencimento ?? "") !== filterVencimento) return false;
    return true;
  });

  const sorted = sortDir
    ? [...filtered].sort((a, b) =>
        sortDir === "asc" ? Number(a.valor) - Number(b.valor) : Number(b.valor) - Number(a.valor)
      )
    : filtered;

  // Itens já pagos na competência selecionada entram pelo valor realmente pago
  // (incluindo juros/multa); os ainda não pagos entram pelo valor programado.
  const total = filtered.reduce((acc, item) => {
    const payment = paymentOf(item, selectedMonth);
    const value = payment?.pago
      ? Number(payment.valor_pago ?? item.valor) + Number(payment.valor_juros ?? 0)
      : Number(item.valor);
    return acc + value;
  }, 0);

  const categoriasDisponiveis = Array.from(
    new Set(statusFiltered.map((i) => i.categoria).filter((c): c is string => Boolean(c)))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const vencimentosDisponiveis = Array.from(
    new Set(statusFiltered.map((i) => i.dia_vencimento).filter((d): d is number => d !== null))
  ).sort((a, b) => a - b);

  const hasActiveFilters = Boolean(filterCategoria || filterVencimento);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-neutral-500">Total mensal em contas fixas</p>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency(total)}</p>
          </div>
          <MonthNav month={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
          >
            {showInactive ? "Ver ativas" : "Ver quitadas"}
          </button>
          <button
            onClick={openNewForm}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Adicionar
          </button>
        </div>
      </div>

      {!isCurrentMonth && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Vendo um mês passado/futuro — o pagamento fica só como consulta aqui. Marcar
          &quot;Paguei&quot; só funciona no mês atual.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Categoria: todas</option>
          {categoriasDisponiveis.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterVencimento}
          onChange={(e) => setFilterVencimento(e.target.value)}
          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Vencimento: todos</option>
          {vencimentosDisponiveis.map((d) => (
            <option key={d} value={d}>
              Dia {d}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilterCategoria("");
              setFilterVencimento("");
            }}
            className="text-xs font-medium text-neutral-500 hover:underline"
          >
            Limpar filtros
          </button>
        )}
        {!showInactive && isCurrentMonth && (
          <span className="ml-auto">
            <DueStatusLegend />
          </span>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4 py-8">
          <form
            onSubmit={handleSave}
            className="flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white shadow-lg"
          >
            <h3 className="shrink-0 px-6 pt-6 text-sm font-semibold text-neutral-900">
              {editingId ? "Editar item" : "Novo item"}
            </h3>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto px-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Nome</label>
                <input
                  type="text"
                  required
                  value={formValues.nome}
                  onChange={(e) => setFormValues((v) => ({ ...v, nome: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formValues.valor}
                  onChange={(e) => setFormValues((v) => ({ ...v, valor: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Dia do vencimento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formValues.dia_vencimento}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, dia_vencimento: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Categoria</label>
                <select
                  value={formValues.categoria}
                  onChange={(e) => setFormValues((v) => ({ ...v, categoria: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Selecione...</option>
                  {CATEGORIAS_CONTAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={temParcelas}
                  onChange={(e) => setTemParcelas(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                Essa conta tem parcelas (financiamento, etc)?
              </label>

              {temParcelas && (
                <div className="space-y-3 rounded-lg bg-neutral-50 p-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Total de parcelas
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formValues.total_parcelas}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, total_parcelas: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Parcela inicial (se já vinha pagando antes de usar o app)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formValues.parcela_inicial}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, parcela_inicial: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Mês da parcela inicial
                    </label>
                    <input
                      type="date"
                      value={formValues.data_primeira_parcela}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, data_primeira_parcela: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex shrink-0 justify-end gap-2 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3">Paguei</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))
                  }
                  className="flex items-center gap-1 hover:text-neutral-700"
                >
                  Valor
                  <span className="text-[10px]">
                    {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "↕"}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Parcela</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={7}>
                  Carregando...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={7}>
                  {showInactive ? "Nenhuma conta quitada ainda." : "Nenhum item cadastrado ainda."}
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const paid = isPaid(item, selectedMonth);
                const status = dueStatusByDayOfMonth(item.dia_vencimento, paid);
                const parcela = parcelaAtual(item, selectedMonth);
                const ultimaParcela =
                  isCurrentMonth &&
                  parcela !== null &&
                  item.total_parcelas !== null &&
                  parcela >= item.total_parcelas &&
                  paid;
                const overdueSince = overdueSinceMonth(item);
                return (
                  <tr key={item.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={paid}
                        disabled={!isCurrentMonth}
                        onChange={() => handleTogglePaid(item)}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{item.nome}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatCurrency(Number(item.valor))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {item.dia_vencimento ? (
                          isCurrentMonth ? (
                            <DueStatusBadge status={status} prefix={`Dia ${item.dia_vencimento}`} />
                          ) : (
                            <span className="text-xs text-neutral-500">
                              Dia {item.dia_vencimento} · {paid ? "Pago" : "Não pago"}
                            </span>
                          )
                        ) : (
                          "-"
                        )}
                        {overdueSince && (
                          <span className="w-fit rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Atrasado desde {formatDate(overdueSince + "-01")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {parcela !== null ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-neutral-600">
                            Parcela {parcela} de {item.total_parcelas ?? "?"}
                          </span>
                          {ultimaParcela && (
                            <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Última parcela — considere Quitar
                            </span>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{item.categoria ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {isCurrentMonth && paid && (
                        <button
                          onClick={() => openPaymentEdit(item)}
                          className="mr-3 text-xs font-medium text-neutral-600 hover:underline"
                        >
                          Editar pagamento
                        </button>
                      )}
                      <button
                        onClick={() => openHistorico(item)}
                        className="mr-3 text-xs font-medium text-neutral-600 hover:underline"
                      >
                        Histórico
                      </button>
                      {showInactive ? (
                        <button
                          onClick={() => handleStatusChange(item.id, true)}
                          className="mr-3 text-xs font-medium text-brand-700 hover:underline"
                        >
                          Reativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(item.id, false)}
                          className="mr-3 text-xs font-medium text-brand-700 hover:underline"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        onClick={() => openEditForm(item)}
                        className="mr-3 text-xs font-medium text-neutral-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {paymentFor && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setPaymentFor(null)}
        >
          <form
            onSubmit={handleSavePayment}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              Pagamento — {paymentFor.nome}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Valor pago (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.valor_pago}
                  onChange={(e) =>
                    setPaymentForm((v) => ({ ...v, valor_pago: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Juros/Multa (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.valor_juros}
                  onChange={(e) =>
                    setPaymentForm((v) => ({ ...v, valor_juros: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentFor(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPayment}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {savingPayment ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {historicoFor && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setHistoricoFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              Histórico — {historicoFor.nome}
            </h3>

            <p className="mt-4 text-xs font-semibold uppercase text-neutral-400">Valores</p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {historico.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">desde {formatDate(h.vigente_desde)}</span>
                  <span className="font-medium text-neutral-900">
                    {formatCurrency(Number(h.valor))}
                  </span>
                </li>
              ))}
              {historico.length === 0 && (
                <li className="text-sm text-neutral-400">Sem histórico ainda.</li>
              )}
            </ul>

            <p className="mt-4 text-xs font-semibold uppercase text-neutral-400">Pagamentos</p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {allPagamentos
                .filter((p) => p.conta_fixa_id === historicoFor.id && p.pago)
                .sort((a, b) => (a.mes < b.mes ? 1 : -1))
                .map((p) => {
                  const parcela = historicoFor.tem_parcelas
                    ? parcelaAtual(historicoFor, p.mes)
                    : null;
                  return (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">
                        {parcela !== null ? `Parcela ${parcela}` : p.mes} — {formatDate(p.pago_em)}
                      </span>
                      <span className="font-medium text-neutral-900">
                        {formatCurrency(Number(p.valor_pago ?? 0) + Number(p.valor_juros ?? 0))}
                      </span>
                    </li>
                  );
                })}
              {allPagamentos.filter((p) => p.conta_fixa_id === historicoFor.id && p.pago).length ===
                0 && <li className="text-sm text-neutral-400">Sem pagamentos ainda.</li>}
            </ul>

            <button
              onClick={() => setHistoricoFor(null)}
              className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
