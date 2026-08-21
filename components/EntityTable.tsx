"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/components/SummaryCard";
import MonthNav, { currentMonth, monthRange } from "@/components/MonthNav";

export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
}

export interface ColumnConfig<T> {
  key: keyof T & string;
  label: string;
  render?: (item: T) => React.ReactNode;
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
  emptyLabel?: string;
  orderBy?: keyof T & string;
  ascending?: boolean;
}

function emptyForm(fields: FieldConfig[]) {
  const obj: Record<string, string> = {};
  for (const f of fields) obj[f.name] = "";
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

  async function load() {
    setLoading(true);
    let query = supabase.from(table).select("*").order(orderBy, { ascending });
    if (monthFilter) {
      const { start, end } = monthRange(selectedMonth);
      query = query.gte(monthFilter.field, start).lt(monthFilter.field, end);
    }
    const { data, error } = await query;
    if (!error && data) setItems(data as T[]);
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
      values[f.name] = raw === null || raw === undefined ? "" : String(raw);
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
      const raw = formValues[f.name];
      if (f.type === "number") {
        payload[f.name] = raw === "" ? null : Number(raw);
      } else {
        payload[f.name] = raw === "" ? null : raw;
      }
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

  async function handleStatusChange(item: T, value: boolean) {
    if (!statusField) return;
    await supabase
      .from(table)
      .update({ [statusField]: value })
      .eq("id", item.id);
    load();
  }

  const visibleItems = statusField
    ? items.filter((item) => Boolean(item[statusField]) === !showInactive)
    : items;

  const total = sumField
    ? visibleItems
        .filter((item) => (sumFilter ? sumFilter(item) : true))
        .reduce((acc, item) => acc + Number(item[sumField] ?? 0), 0)
    : null;

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
              {fields.map((f) => (
                <div key={f.name}>
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
                </div>
              ))}
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
              {toggleField && <th className="px-4 py-3">Incluir</th>}
              {columns.map((col) => (
                <th key={String(col.key)} className="px-4 py-3">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={columns.length + 2}>
                  Carregando...
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-400" colSpan={columns.length + 2}>
                  {showInactive ? "Nenhuma conta quitada ainda." : emptyLabel}
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
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
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-neutral-700">
                      {col.render ? col.render(item) : String(item[col.key] ?? "-")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
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
