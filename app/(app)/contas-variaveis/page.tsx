"use client";

import EntityTable, { ColumnConfig, FieldConfig } from "@/components/EntityTable";
import RecorrentesPendentes from "@/components/RecorrentesPendentes";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import { CATEGORIAS_CONTAS } from "@/lib/categorias";
import type { ContaVariavel } from "@/lib/types";

const fields: FieldConfig[] = [
  { name: "nome", label: "Nome", type: "text", required: true },
  { name: "valor", label: "Valor (R$)", type: "number", required: true },
  { name: "data", label: "Data", type: "date", required: true },
  { name: "categoria", label: "Categoria", type: "select", options: CATEGORIAS_CONTAS },
  { name: "valor_juros", label: "Juros/Multa (R$)", type: "number", default: "0" },
  {
    name: "pago_em",
    label: "Data do pagamento (define o mês do gasto no Saldo/Relatórios)",
    type: "date",
  },
  { name: "recorrente", label: "Repete todo mês (luz, água, internet...)", type: "checkbox" },
];

const columns: ColumnConfig<ContaVariavel>[] = [
  { key: "nome", label: "Nome" },
  { key: "valor", label: "Valor", render: (item) => formatCurrency(Number(item.valor)) },
  { key: "data", label: "Data", render: (item) => formatDate(item.data) },
  { key: "categoria", label: "Categoria", hideOnMobile: true },
];

export default function ContasVariaveisPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Contas Variáveis</h1>
        <p className="text-sm text-neutral-500">
          Contas mensais com valor que muda (luz, água, cartão, etc). Lance um registro novo
          a cada mês — use as setas abaixo pra navegar entre os meses e ver o total de cada um.
          Marque &quot;Pago&quot; quando quitar — sem isso, o status fica vermelho depois da data.
        </p>
      </div>
      <EntityTable<ContaVariavel>
        table="contas_variaveis"
        fields={fields}
        columns={columns}
        sumField="valor"
        sumLabel="Total do mês"
        orderBy="data"
        ascending={false}
        monthFilter={{ field: "data" }}
        renderAboveTable={(month, reload) => (
          <RecorrentesPendentes month={month} onLancado={reload} />
        )}
        sortableFields={["valor", "data"]}
        filterFields={[
          { field: "categoria", label: "Categoria" },
          { field: "data", label: "Data", format: formatDate },
        ]}
        dueStatus={{ dateField: "data", paidField: "pago", amountField: "valor" }}
      />
    </div>
  );
}
