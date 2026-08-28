"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import type { Consorcio } from "@/lib/types";

const STATUS_OPTIONS = ["ativo", "contemplado", "quitado", "cancelado"];

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  contemplado: "Contemplado",
  quitado: "Quitado",
  cancelado: "Cancelado",
};

const fields: FieldConfig[] = [
  { name: "nome", label: "Nome (ex: Consórcio Carro)", type: "text", required: true },
  { name: "administradora", label: "Administradora", type: "text" },
  { name: "numero_cota", label: "Número da cota/grupo", type: "text" },
  { name: "valor_carta", label: "Valor da carta de crédito (R$)", type: "number", required: true },
  { name: "valor_parcela", label: "Valor da parcela mensal (R$)", type: "number", required: true },
  { name: "parcela_atual", label: "Parcela atual", type: "number" },
  { name: "total_parcelas", label: "Total de parcelas", type: "number" },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "data_adesao", label: "Data de adesão", type: "date" },
  { name: "data_contemplacao", label: "Data de contemplação", type: "date" },
  { name: "observacoes", label: "Observações", type: "textarea" },
];

const columns: ColumnConfig<Consorcio>[] = [
  { key: "nome", label: "Nome" },
  {
    key: "administradora",
    label: "Administradora",
    render: (item) => item.administradora ?? "-",
    hideOnMobile: true,
  },
  {
    key: "valor_carta",
    label: "Valor da carta",
    render: (item) => formatCurrency(Number(item.valor_carta)),
    hideOnMobile: true,
  },
  {
    key: "valor_parcela",
    label: "Parcela mensal",
    render: (item) => formatCurrency(Number(item.valor_parcela)),
  },
  {
    key: "parcela_atual",
    label: "Parcela",
    render: (item) =>
      item.parcela_atual && item.total_parcelas
        ? `${item.parcela_atual} de ${item.total_parcelas}`
        : "-",
  },
  {
    key: "status",
    label: "Status",
    render: (item) => STATUS_LABELS[item.status] ?? item.status,
  },
  {
    key: "data_contemplacao",
    label: "Contemplação",
    render: (item) => formatDate(item.data_contemplacao),
    hideOnMobile: true,
  },
];

export default function ConsorciosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Consórcios</h1>
        <p className="text-sm text-neutral-500">
          Controle das cartas de consórcio: administradora, valor da carta, parcela mensal e
          status (ativo, contemplado, quitado ou cancelado).
        </p>
      </div>
      <EntityTable<Consorcio>
        table="consorcios"
        fields={fields}
        columns={columns}
        sumField="valor_parcela"
        sumLabel="Total mensal em consórcios"
        orderBy="created_at"
        ascending={false}
        sortableFields={["valor_carta", "valor_parcela"]}
        filterFields={[
          { field: "administradora", label: "Administradora" },
          { field: "status", label: "Status", format: (v) => STATUS_LABELS[v] ?? v },
        ]}
      />
    </div>
  );
}
