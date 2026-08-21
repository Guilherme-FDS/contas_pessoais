"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import { currentMonth } from "@/components/MonthNav";
import { CATEGORIAS_CONTAS } from "@/lib/categorias";
import type { ContaFixa, ContaFixaHistorico, ContaFixaPagamento } from "@/lib/types";

type DueStatus = "pago" | "verde" | "laranja" | "vermelho" | "neutro";

function dueStatus(diaVencimento: number | null, paid: boolean): DueStatus {
  if (paid) return "pago";
  if (!diaVencimento) return "neutro";
  const today = new Date().getDate();
  const daysUntil = diaVencimento - today;
  if (daysUntil < 0) return "vermelho";
  if (daysUntil === 0) return "laranja";
  return "verde";
}

const STATUS_STYLES: Record<DueStatus, string> = {
  pago: "bg-neutral-100 text-neutral-500",
  verde: "bg-emerald-100 text-emerald-700",
  laranja: "bg-amber-100 text-amber-700",
  vermelho: "bg-red-100 text-red-700",
  neutro: "bg-neutral-100 text-neutral-500",
};

const STATUS_LABELS: Record<DueStatus, string> = {
  pago: "Pago",
  verde: "Em dia",
  laranja: "Vence hoje",
  vermelho: "Atrasado",
  neutro: "",
};

function emptyForm() {
  return { nome: "", valor: "", dia_vencimento: "", categoria: "" };
}

export default function ContasFixasList() {
  const supabase = createClient();
  const mes = currentMonth();

  const [items, setItems] = useState<ContaFixa[]>([]);
  const [pagamentos, setPagamentos] = useState<ContaFixaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterVencimento, setFilterVencimento] = useState("");
  const [historicoFor, setHistoricoFor] = useState<ContaFixa | null>(null);
  const [historico, setHistorico] = useState<ContaFixaHistorico[]>([]);

  async function load() {
    setLoading(true);
    const [contasRes, pagamentosRes] = await Promise.all([
      supabase.from("contas_fixas").select("*").order("nome", { ascending: true }),
      supabase.from("contas_fixas_pagamentos").select("*").eq("mes", mes),
    ]);
    setItems((contasRes.data ?? []) as ContaFixa[]);
    setPagamentos((pagamentosRes.data ?? []) as ContaFixaPagamento[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paidIds = useMemo(() => new Set(pagamentos.map((p) => p.conta_fixa_id)), [pagamentos]);

  function openNewForm() {
    setEditingId(null);
    setFormValues(emptyForm());
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
    });
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
    if (paidIds.has(item.id)) {
      await supabase
        .from("contas_fixas_pagamentos")
        .delete()
        .eq("conta_fixa_id", item.id)
        .eq("mes", mes);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from("contas_fixas_pagamentos")
        .insert({ conta_fixa_id: item.id, mes, created_by: user?.id });
    }
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

  const total = filtered.reduce((acc, item) => acc + Number(item.valor), 0);

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
        <div>
          <p className="text-xs text-neutral-500">Total mensal em contas fixas</p>
          <p className="text-xl font-semibold text-neutral-900">{formatCurrency(total)}</p>
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
        {!showInactive && (
          <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Em dia
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Vence hoje
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Atrasado (não marcado como pago)
            </span>
          </span>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              {editingId ? "Editar item" : "Novo item"}
            </h3>

            <div className="mt-4 space-y-3">
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
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
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
              {!showInactive && <th className="px-4 py-3">Paguei</th>}
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
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={6}>
                  Carregando...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={6}>
                  {showInactive ? "Nenhuma conta quitada ainda." : "Nenhum item cadastrado ainda."}
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const paid = paidIds.has(item.id);
                const status = dueStatus(item.dia_vencimento, paid);
                return (
                  <tr key={item.id} className="hover:bg-neutral-50">
                    {!showInactive && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={() => handleTogglePaid(item)}
                          className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-neutral-700">{item.nome}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatCurrency(Number(item.valor))}
                    </td>
                    <td className="px-4 py-3">
                      {item.dia_vencimento ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                        >
                          Dia {item.dia_vencimento}
                          {STATUS_LABELS[status] ? ` · ${STATUS_LABELS[status]}` : ""}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{item.categoria ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
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
              Histórico de valores — {historicoFor.nome}
            </h3>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
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
