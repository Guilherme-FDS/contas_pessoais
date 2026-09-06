"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/components/SummaryCard";
import MonthNav, { currentMonth, monthRange } from "@/components/MonthNav";
import { dueStatusByDate, DUE_STATUS_LABELS, type DueStatus } from "@/lib/dueStatus";
import DueStatusBadge, { DueStatusLegend } from "@/components/DueStatusBadge";

export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "checkbox";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  default?: string;
}

export interface ColumnConfig<T> {
  key: keyof T & string;
  label: string;
  render?: (item: T) => React.ReactNode;
  hideOnMobile?: boolean;
}

export interface FilterFieldConfig<T> {
  field: keyof T & string;
  label: string;
  format?: (value: string) => string;
}

interface EntityTableProps<T extends { id: string }> {
  table: string;
  fields: FieldConfig[];
  columns: ColumnConfig<T>[];
  sumField?: keyof T & string;
  sumFilter?: (item: T) => boolean;
  sumLabel?: string;
  toggleField?: keyof T & string;
  statusField?: keyof T & string;
  statusDoneLabel?: string;
  statusReactivateLabel?: string;
  monthFilter?: { field: keyof T & string };
  dueStatus?: {
    dateField: keyof T & string;
    paidField: keyof T & string;
    amountField?: keyof T & string;
  };
  paidStatusConfig?: { field: keyof T & string; value: string };
  // Slot pra conteúdo que depende do mês selecionado (que é estado interno daqui).
  renderAboveTable?: (month: string, reload: () => void) => React.ReactNode;
  sortableFields?: (keyof T & string)[];
  filterFields?: FilterFieldConfig<T>[];
  emptyLabel?: string;
  orderBy?: keyof T & string;
  ascending?: boolean;
}

function distinctValues<T extends Record<string, any>>(items: T[], field: keyof T & string) {
  const set = new Set<string>();
  for (const item of items) {
    const v = item[field];
    if (v !== null && v !== undefined && v !== "") set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function emptyForm(fields: FieldConfig[]) {
  const obj: Record<string, string> = {};
  for (const f of fields) obj[f.name] = f.default ?? "";
  return obj;
}

export default function EntityTable<T extends { id: string; [key: string]: any }>({
  table,
  fields,
  columns,
  sumField,
  sumFilter,
  sumLabel = "Total",
  toggleField,
  statusField,
  statusDoneLabel = "Quitar",
  statusReactivateLabel = "Reativar",
  monthFilter,
  dueStatus,
  paidStatusConfig,
  renderAboveTable,
  sortableFields,
  filterFields,
  emptyLabel = "Nenhum item cadastrado ainda.",
  orderBy = "created_at" as keyof T & string,
  ascending = false,
}: EntityTableProps<T>) {
  const supabase = createClient();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>(emptyForm(fields));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [showInactive, setShowInactive] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [dueStatusFilter, setDueStatusFilter] = useState<string>("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [baixando, setBaixando] = useState(false);
  const [erroBaixa, setErroBaixa] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase.from(table).select("*").order(orderBy, { ascending });
    if (monthFilter) {
      const { start, end } = monthRange(selectedMonth);
      query = query.gte(monthFilter.field, start).lt(monthFilter.field, end);
    }
    const { data, error } = await query;
    if (!error && data) setItems(data as T[]);
    setSelecionados([]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, selectedMonth]);

  function openNewForm() {
    setEditingId(null);
    setFormValues(emptyForm(fields));
    setError(null);
    setShowForm(true);
  }

  function openEditForm(item: T) {
    const values: Record<string, string> = {};
    for (const f of fields) {
      const raw = item[f.name];
      if (f.type === "checkbox") {
        values[f.name] = raw ? "true" : "";
      } else if (raw === null || raw === undefined) {
        values[f.name] = "";
      } else if (f.type === "date") {
        // colunas timestamptz chegam como "2026-09-06T14:32:00+00:00" e o input
        // type=date só entende "2026-09-06" — sem o corte ele renderiza vazio e
        // o save apagaria a data.
        values[f.name] = String(raw).slice(0, 10);
      } else {
        values[f.name] = String(raw);
      }
    }
    setEditingId(item.id);
    setFormValues(values);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = formValues[f.name] || f.default || "";
      if (f.type === "checkbox") {
        payload[f.name] = raw === "true";
      } else if (f.type === "number") {
        payload[f.name] = raw === "" ? null : Number(raw);
      } else {
        payload[f.name] = raw === "" ? null : raw;
      }
    }

    if (paidStatusConfig) {
      const key = paidStatusConfig.field;
      const isPaidNow = payload[key] === paidStatusConfig.value;
      const prevItem = editingId ? items.find((i) => i.id === editingId) : null;
      const wasPaid = prevItem ? prevItem[key] === paidStatusConfig.value : false;
      if (isPaidNow && !wasPaid) payload.pago_em = new Date().toISOString();
      if (!isPaidNow && wasPaid) payload.pago_em = null;
    }

    if (editingId) {
      const { error } = await supabase.from(table).update(payload).eq("id", editingId);
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
        .from(table)
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
    await supabase.from(table).delete().eq("id", id);
    load();
  }

  async function handleToggle(item: T) {
    if (!toggleField) return;
    await supabase
      .from(table)
      .update({ [toggleField]: !item[toggleField] })
      .eq("id", item.id);
    load();
  }

  async function handlePaidToggle(item: T) {
    if (!dueStatus) return;
    setErroBaixa(null);
    const isPaid = Boolean(item[dueStatus.paidField]);

    const payload: Record<string, unknown> = isPaid
      ? { [dueStatus.paidField]: false, pago_em: null }
      : { [dueStatus.paidField]: true, pago_em: new Date().toISOString() };

    if (!isPaid && dueStatus.amountField) {
      payload.valor_pago = item[dueStatus.amountField];
      payload.valor_juros = 0;
    }

    const { error } = await supabase.from(table).update(payload).eq("id", item.id);
    if (error) {
      setErroBaixa(error.message);
      return;
    }
    load();
  }

  // Baixa em lote: marca de uma vez todas as selecionadas que ainda não foram pagas.
  async function handleBaixaEmLote() {
    if (!dueStatus || selecionados.length === 0) return;
    setBaixando(true);
    setErroBaixa(null);

    const agora = new Date().toISOString();
    const alvos = items.filter(
      (i) => selecionados.includes(i.id) && !Boolean(i[dueStatus.paidField])
    );

    for (const item of alvos) {
      const payload: Record<string, unknown> = {
        [dueStatus.paidField]: true,
        pago_em: agora,
      };
      if (dueStatus.amountField) {
        payload.valor_pago = item[dueStatus.amountField];
        payload.valor_juros = 0;
      }
      const { error } = await supabase.from(table).update(payload).eq("id", item.id);
      if (error) {
        setErroBaixa(`Falhou em "${String(item.nome ?? item.id)}": ${error.message}`);
        setBaixando(false);
        load();
        return;
      }
    }

    setBaixando(false);
    load();
  }

  async function handleStatusChange(item: T, value: boolean) {
    if (!statusField) return;
    await supabase
      .from(table)
      .update({ [statusField]: value })
      .eq("id", item.id);
    load();
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const statusFiltered = statusField
    ? items.filter((item) => Boolean(item[statusField]) === !showInactive)
    : items;

  const activeFilterEntries = Object.entries(activeFilters).filter(([, v]) => v);
  const fieldFilteredItems = activeFilterEntries.length
    ? statusFiltered.filter((item) =>
        activeFilterEntries.every(([field, value]) => String(item[field] ?? "") === value)
      )
    : statusFiltered;

  const filteredItems =
    dueStatus && dueStatusFilter
      ? fieldFilteredItems.filter(
          (item) =>
            dueStatusByDate(
              String(item[dueStatus.dateField] ?? ""),
              Boolean(item[dueStatus.paidField])
            ) === dueStatusFilter
        )
      : fieldFilteredItems;

  const visibleItems = sortField
    ? [...filteredItems].sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR", { numeric: true });
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filteredItems;

  // Itens já pagos entram pelo valor realmente pago (valor_pago), se houver;
  // em qualquer caso, soma valor_juros quando a tabela tiver essa coluna —
  // assim juros/multa lançados no item atualizam o total na hora.
  function itemTotalValue(item: T): number {
    const juros = Number((item as any).valor_juros) || 0;
    const paid = dueStatus ? Boolean(item[dueStatus.paidField]) : false;
    const valorPago = (item as any).valor_pago;
    const base =
      paid && valorPago !== null && valorPago !== undefined
        ? Number(valorPago) || 0
        : Number(item[sumField as keyof T & string]) || 0;
    return base + juros;
  }

  const total = sumField
    ? visibleItems
        .filter((item) => (sumFilter ? sumFilter(item) : true))
        .reduce((acc, item) => acc + itemTotalValue(item), 0)
    : null;

  const hasActiveFilters = activeFilterEntries.length > 0 || Boolean(dueStatusFilter);

  // Só faz sentido selecionar em lote o que ainda não foi pago.
  const selecionaveis = dueStatus
    ? visibleItems.filter((i) => !Boolean(i[dueStatus.paidField]))
    : [];
  const todosSelecionados =
    selecionaveis.length > 0 && selecionaveis.every((i) => selecionados.includes(i.id));

  function toggleSelecionarTodos() {
    setSelecionados(todosSelecionados ? [] : selecionaveis.map((i) => i.id));
  }

  function toggleSelecionado(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  const totalSelecionado = dueStatus
    ? items
        .filter((i) => selecionados.includes(i.id))
        .reduce((acc, i) => acc + (Number(i[sumField as keyof T & string]) || 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {total !== null && (
            <div>
              <p className="text-xs text-neutral-500">{sumLabel}</p>
              <p className="text-xl font-semibold text-neutral-900">{formatCurrency(total)}</p>
            </div>
          )}
          {monthFilter && <MonthNav month={selectedMonth} onChange={setSelectedMonth} />}
        </div>
        <div className="flex items-center gap-3">
          {statusField && (
            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
            >
              {showInactive ? "Ver ativas" : "Ver quitadas"}
            </button>
          )}
          <button
            onClick={openNewForm}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Adicionar
          </button>
        </div>
      </div>

      {((filterFields && filterFields.length > 0) || dueStatus) && (
        <div className="flex flex-wrap items-center gap-3">
          {filterFields?.map((f) => (
            <select
              key={f.field}
              value={activeFilters[f.field] ?? ""}
              onChange={(e) =>
                setActiveFilters((v) => ({ ...v, [f.field]: e.target.value }))
              }
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">{f.label}: todas</option>
              {distinctValues(statusFiltered, f.field).map((v) => (
                <option key={v} value={v}>
                  {f.format ? f.format(v) : v}
                </option>
              ))}
            </select>
          ))}
          {dueStatus && (
            <select
              value={dueStatusFilter}
              onChange={(e) => setDueStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Status: todos</option>
              {(["verde", "laranja", "vermelho", "pago"] as DueStatus[]).map((s) => (
                <option key={s} value={s}>
                  {DUE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setActiveFilters({});
                setDueStatusFilter("");
              }}
              className="text-xs font-medium text-neutral-500 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {dueStatus && (
        <div className="flex justify-end">
          <DueStatusLegend />
        </div>
      )}

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
              {fields.map((f) => (
                <div key={f.name}>
                  {f.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={formValues[f.name] === "true"}
                        onChange={(e) =>
                          setFormValues((v) => ({
                            ...v,
                            [f.name]: e.target.checked ? "true" : "",
                          }))
                        }
                        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                      />
                      {f.label}
                    </label>
                  ) : (
                    <>
                  <label className="block text-sm font-medium text-neutral-700">
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      required={f.required}
                      value={formValues[f.name]}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, [f.name]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Selecione...</option>
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={formValues[f.name]}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, [f.name]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      rows={2}
                    />
                  ) : (
                    <input
                      type={f.type}
                      step={f.type === "number" ? "0.01" : undefined}
                      required={f.required}
                      value={formValues[f.name]}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, [f.name]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  )}
                    </>
                  )}
                </div>
              ))}
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

      {renderAboveTable?.(selectedMonth, load)}

      {erroBaixa && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroBaixa}</p>
      )}

      {dueStatus && selecionados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-neutral-700">
            <span className="font-semibold">{selecionados.length}</span> selecionada(s) ·{" "}
            {formatCurrency(totalSelecionado)}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelecionados([])}
              className="text-xs font-medium text-neutral-600 hover:underline"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={handleBaixaEmLote}
              disabled={baixando}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {baixando ? "Baixando..." : "Marcar como pagas"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              {dueStatus && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleSelecionarTodos}
                    disabled={selecionaveis.length === 0}
                    aria-label="Selecionar todas"
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                  />
                </th>
              )}
              {toggleField && <th className="px-4 py-3">Incluir</th>}
              {dueStatus && (
                <>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Status</th>
                </>
              )}
              {columns.map((col) => {
                const sortable = sortableFields?.includes(col.key);
                return (
                  <th
                    key={String(col.key)}
                    className={`px-3 py-3 sm:px-4 ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-neutral-700"
                      >
                        {col.label}
                        <span className="text-[10px]">
                          {sortField === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={columns.length + 2 + (dueStatus ? 3 : 0)}>
                  Carregando...
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={columns.length + 2 + (dueStatus ? 3 : 0)}>
                  {showInactive ? "Nenhuma conta quitada ainda." : emptyLabel}
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  {dueStatus && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(item.id)}
                        disabled={Boolean(item[dueStatus.paidField])}
                        onChange={() => toggleSelecionado(item.id)}
                        aria-label={`Selecionar ${String(item.nome ?? "")}`}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                      />
                    </td>
                  )}
                  {toggleField && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(item[toggleField])}
                        onChange={() => handleToggle(item)}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  {dueStatus && (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(item[dueStatus.paidField])}
                          onChange={() => handlePaidToggle(item)}
                          className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <DueStatusBadge
                          status={dueStatusByDate(
                            String(item[dueStatus.dateField] ?? ""),
                            Boolean(item[dueStatus.paidField])
                          )}
                        />
                      </td>
                    </>
                  )}
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`px-3 py-3 text-neutral-700 sm:px-4 ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                    >
                      {col.render ? col.render(item) : String(item[col.key] ?? "-")}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right sm:px-4">
                    {statusField &&
                      (showInactive ? (
                        <button
                          onClick={() => handleStatusChange(item, true)}
                          className="mr-3 text-xs font-medium text-brand-700 hover:underline"
                        >
                          {statusReactivateLabel}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(item, false)}
                          className="mr-3 text-xs font-medium text-brand-700 hover:underline"
                        >
                          {statusDoneLabel}
                        </button>
                      ))}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
