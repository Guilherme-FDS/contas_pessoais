"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import { currentMonth, labelForMonth, monthRange } from "@/components/MonthNav";
import { fetchPagamentos, type PagamentoRegistro } from "@/lib/pagamentos";

function ExtratoConteudo() {
  const supabase = createClient();
  const params = useSearchParams();
  const de = params.get("de") || currentMonth();
  const ate = params.get("ate") || de;

  const [pagamentos, setPagamentos] = useState<PagamentoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const registros = await fetchPagamentos(supabase, {
        start: monthRange(de).start,
        end: monthRange(ate).end,
      });
      setPagamentos(registros);
      setCarregando(false);
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);

  // Só abre a caixa de impressão depois que os dados estão na tela, senão o
  // PDF sai vazio.
  useEffect(() => {
    if (!carregando) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [carregando]);

  const totalValor = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const totalJuros = pagamentos.reduce((acc, p) => acc + p.valor_juros, 0);
  const totalGeral = totalValor + totalJuros;

  const periodo =
    de === ate ? labelForMonth(de) : `${labelForMonth(de)} a ${labelForMonth(ate)}`;

  const emitidoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (carregando) {
    return <p className="p-8 text-sm text-neutral-500">Gerando extrato...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-neutral-900">
      <style>{`
        @page { margin: 14mm; }
        @media print {
          .nao-imprimir { display: none !important; }
          body { background: #fff; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="nao-imprimir mb-6 flex justify-end gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      <header className="border-b-2 border-neutral-800 pb-4">
        <h1 className="text-xl font-bold">Extrato de Pagamentos</h1>
        <p className="mt-1 text-sm text-neutral-600">Finanças da Família Silva</p>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          <span>
            <strong>Período:</strong> {periodo}
          </span>
          <span className="text-neutral-600">Emitido em {emitidoEm}</span>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-4 border-b border-neutral-300 pb-4 text-sm">
        <div>
          <p className="text-neutral-600">Contas pagas</p>
          <p className="mt-0.5 text-lg font-semibold">{pagamentos.length}</p>
        </div>
        <div>
          <p className="text-neutral-600">Juros/multa</p>
          <p className="mt-0.5 text-lg font-semibold">{formatCurrency(totalJuros)}</p>
        </div>
        <div>
          <p className="text-neutral-600">Total pago</p>
          <p className="mt-0.5 text-lg font-semibold">{formatCurrency(totalGeral)}</p>
        </div>
      </section>

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-2 pr-2 font-semibold">Pgto.</th>
            <th className="py-2 pr-2 font-semibold">Descrição</th>
            <th className="py-2 pr-2 font-semibold">Tipo</th>
            <th className="py-2 pr-2 font-semibold">Vencim.</th>
            <th className="py-2 pr-2 text-right font-semibold">Valor</th>
            <th className="py-2 text-right font-semibold">Juros</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-neutral-500">
                Nenhum pagamento registrado nesse período.
              </td>
            </tr>
          ) : (
            pagamentos.map((p) => (
              <tr key={p.id} className="border-b border-neutral-200">
                <td className="whitespace-nowrap py-2 pr-2">{formatDate(p.data_pagamento)}</td>
                <td className="py-2 pr-2">{p.nome}</td>
                <td className="py-2 pr-2 text-neutral-600">{p.origem}</td>
                <td className="whitespace-nowrap py-2 pr-2 text-neutral-600">
                  {formatDate(p.data_vencimento)}
                </td>
                <td className="whitespace-nowrap py-2 pr-2 text-right">
                  {formatCurrency(p.valor)}
                </td>
                <td className="whitespace-nowrap py-2 text-right text-neutral-600">
                  {p.valor_juros > 0 ? formatCurrency(p.valor_juros) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {pagamentos.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-neutral-800 font-semibold">
              <td colSpan={4} className="py-2">
                Total do período
              </td>
              <td className="whitespace-nowrap py-2 pr-2 text-right">
                {formatCurrency(totalValor)}
              </td>
              <td className="whitespace-nowrap py-2 text-right">
                {formatCurrency(totalJuros)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
        Documento gerado pelo app de controle financeiro da família. Os valores refletem os
        pagamentos registrados até a data de emissão.
      </footer>
    </div>
  );
}

export default function ExtratoPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-neutral-500">Carregando...</p>}>
      <ExtratoConteudo />
    </Suspense>
  );
}
