"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import { formatCurrency } from "@/components/SummaryCard";
import type { Investimento } from "@/lib/types";

const fields: FieldConfig[] = [
  {
    name: "categoria",
    label: "Categoria",
    type: "select",
    required: true,
    options: ["Bolsa de Valores", "Renda Fixa", "Cripto", "Fundos", "Outro"],
  },
  { name: "ativo", label: "Ativo (ex: PETR4, Tesouro Selic)", type: "text", required: true },
  { name: "valor_investido", label: "Valor investido (R$)", type: "number", required: true },
  { name: "data_aplicacao", label: "Data da aplicação", type: "date", required: true },
  { name: "corretora", label: "Corretora", type: "text" },
  { name: "observacoes", label: "Observações", type: "textarea" },
];

const columns: ColumnConfig<Investimento>[] = [
  { key: "categoria", label: "Categoria" },
  { key: "ativo", label: "Ativo" },
  {
    key: "valor_investido",
    label: "Valor investido",
    render: (item) => formatCurrency(Number(item.valor_investido)),
  },
  { key: "data_aplicacao", label: "Data" },
  { key: "corretora", label: "Corretora" },
];

export default function InvestimentosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Investimentos</h1>
        <p className="text-sm text-neutral-500">
          Onde está investido, o ativo específico e o valor aplicado.
        </p>
      </div>
      <EntityTable<Investimento>
        table="investimentos"
        fields={fields}
        columns={columns}
        sumField="valor_investido"
        sumLabel="Total investido"
        orderBy="data_aplicacao"
        ascending={false}
      />
    </div>
  );
}
