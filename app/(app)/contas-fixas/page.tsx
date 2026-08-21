"use client";

import ContasFixasList from "@/components/ContasFixasList";

export default function ContasFixasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Contas Fixas</h1>
        <p className="text-sm text-neutral-500">
          Contas que se repetem todo mês com o mesmo valor (aluguel, assinaturas, etc). Marque
          &quot;Paguei&quot; quando quitar o mês — sem isso, o vencimento fica vermelho depois do
          dia. Quando terminar de pagar de vez uma conta (ex: financiamento quitado), use
          &quot;Quitar&quot; em vez de excluir — ela sai da lista mas fica guardada em
          &quot;Ver quitadas&quot;.
        </p>
      </div>
      <ContasFixasList />
    </div>
  );
}
