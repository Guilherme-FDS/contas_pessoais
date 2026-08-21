"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import { formatCurrency } from "@/components/SummaryCard";
import type { ContaVariavel } from "@/lib/types";

const fields: FieldConfig[] = [
  { name: "nome", label: "Nome", type: "text", required: true },
  { name: "valor", label: "Valor (R$)", type: "number", required: true },
  { name: "data", label: "Data", type: "date", required: true },
  { name: "categoria", label: "Categoria", type: "text" },
];

const columns: ColumnConfig<ContaVariavel>[] = [
  { key: "nome", label: "Nome" },
  { key: "valor", label: "Valor", render: (item) => formatCurrency(Number(item.valor)) },
  { key: "data", label: "Data" },
  { key: "categoria", label: "Categoria" },
];

export default function ContasVariaveisPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Contas Variáveis</h1>
        <p className="text-sm text-neutral-500">
          Contas mensais com valor que muda (luz, água, cartão, etc).
        </p>
      </div>
      <EntityTable<ContaVariavel>
        table="contas_variaveis"
        fields={fields}
        columns={columns}
        sumField="valor"
        sumLabel="Total lançado"
        orderBy="data"
        ascending={false}
      />
    </div>
  );
}
