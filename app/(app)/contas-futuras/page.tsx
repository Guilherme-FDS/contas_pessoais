"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import { formatCurrency } from "@/components/SummaryCard";
import type { ContaFutura } from "@/lib/types";

const fields: FieldConfig[] = [
  { name: "nome", label: "Nome", type: "text", required: true },
  { name: "valor", label: "Valor (R$)", type: "number", required: true },
  { name: "categoria", label: "Categoria", type: "text" },
  { name: "data_prevista", label: "Data prevista", type: "date" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: ["pendente", "negociando", "pago"],
  },
  { name: "observacoes", label: "Observações", type: "textarea" },
];

const columns: ColumnConfig<ContaFutura>[] = [
  { key: "nome", label: "Nome" },
  { key: "valor", label: "Valor", render: (item) => formatCurrency(Number(item.valor)) },
  { key: "categoria", label: "Categoria" },
  { key: "data_prevista", label: "Data prevista", render: (item) => item.data_prevista ?? "-" },
  { key: "status", label: "Status" },
];

export default function ContasFuturasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Contas Futuras</h1>
        <p className="text-sm text-neutral-500">
          Contas que você vai precisar pagar no futuro (IPVA, cartões vencidos a negociar, etc).
          Marque &quot;Incluir&quot; nas que você já decidiu contar na soma do total a pagar.
        </p>
      </div>
      <EntityTable<ContaFutura>
        table="contas_futuras"
        fields={fields}
        columns={columns}
        sumField="valor"
        sumFilter={(item) => item.incluir_soma}
        sumLabel="Total marcado para pagar"
        toggleField="incluir_soma"
        orderBy="data_prevista"
        ascending={true}
      />
    </div>
  );
}
