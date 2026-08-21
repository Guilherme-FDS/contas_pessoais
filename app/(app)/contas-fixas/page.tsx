"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import { formatCurrency } from "@/components/SummaryCard";
import type { ContaFixa } from "@/lib/types";

const fields: FieldConfig[] = [
  { name: "nome", label: "Nome", type: "text", required: true },
  { name: "valor", label: "Valor (R$)", type: "number", required: true },
  { name: "dia_vencimento", label: "Dia do vencimento", type: "number" },
  { name: "categoria", label: "Categoria", type: "text" },
];

const columns: ColumnConfig<ContaFixa>[] = [
  { key: "nome", label: "Nome" },
  { key: "valor", label: "Valor", render: (item) => formatCurrency(Number(item.valor)) },
  { key: "dia_vencimento", label: "Vencimento", render: (item) => item.dia_vencimento ? `Dia ${item.dia_vencimento}` : "-" },
  { key: "categoria", label: "Categoria" },
];

export default function ContasFixasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Contas Fixas</h1>
        <p className="text-sm text-neutral-500">
          Contas que se repetem todo mês com o mesmo valor (aluguel, assinaturas, etc).
        </p>
      </div>
      <EntityTable<ContaFixa>
        table="contas_fixas"
        fields={fields}
        columns={columns}
        sumField="valor"
        sumLabel="Total mensal em contas fixas"
      />
    </div>
  );
}
