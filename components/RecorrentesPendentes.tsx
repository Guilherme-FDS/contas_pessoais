"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/components/SummaryCard";
import { labelForMonth, monthRange } from "@/components/MonthNav";
import type { ContaVariavel } from "@/lib/types";

// Contas marcadas como "repete todo mês" que ainda não foram lançadas no mês
// aberto. O lançamento é um clique só — não geramos nada sozinhos pra você não
// encontrar linhas que nunca pediu.
export default function RecorrentesPendentes({
  month,
  onLancado,
}: {
  month: string;
  onLancado: () => void;
}) {
  const supabase = createClient();
  const [pendentes, setPendentes] = useState<ContaVariavel[]>([]);
  const [lancando, setLancando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setErro(null);
      const { end } = monthRange(month);
      const { data } = await supabase
        .from("contas_variaveis")
        .select("*")
        .not("recorrencia_id", "is", null)
        .lt("data", end)
        .order("data", { ascending: false });

      const todas = (data ?? []) as ContaVariavel[];

      // Última ocorrência de cada corrente, e quais já têm lançamento no mês.
      const ultimaPorCorrente = new Map<string, ContaVariavel>();
      const jaNoMes = new Set<string>();
      for (const c of todas) {
        const chave = c.recorrencia_id as string;
        if (c.data.slice(0, 7) === month) jaNoMes.add(chave);
        if (!ultimaPorCorrente.has(chave)) ultimaPorCorrente.set(chave, c);
      }

      setPendentes(
        Array.from(ultimaPorCorrente.values()).filter(
          (c) => c.recorrente && !jaNoMes.has(c.recorrencia_id as string)
        )
      );
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function lancarTodas() {
    setLancando(true);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [ano, mesNum] = month.split("-").map(Number);
    const ultimoDiaDoMes = new Date(ano, mesNum, 0).getDate();

    const novas = pendentes.map((c) => {
      // Conta que vence dia 31 em mês de 30 dias vira dia 30 — sem isso o
      // Postgres recusa a data e o lançamento inteiro falha.
      const diaOriginal = Number(c.data.slice(8, 10));
      const dia = String(Math.min(diaOriginal, ultimoDiaDoMes)).padStart(2, "0");
      return {
        nome: c.nome,
        valor: c.valor,
        data: `${month}-${dia}`,
        categoria: c.categoria,
        pago: false,
        valor_juros: 0,
        recorrente: true,
        recorrencia_id: c.recorrencia_id,
        created_by: user?.id,
      };
    });

    const { error } = await supabase.from("contas_variaveis").insert(novas);
    setLancando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setPendentes([]);
    onLancado();
  }

  if (pendentes.length === 0 && !erro) return null;

  const total = pendentes.reduce((acc, c) => acc + Number(c.valor), 0);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      {erro && <p className="mb-2 text-sm text-red-700">{erro}</p>}
      {pendentes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-800">
              {pendentes.length} conta(s) recorrente(s) ainda não lançada(s) em{" "}
              {labelForMonth(month).toLowerCase()}
            </p>
            <p className="truncate text-xs text-neutral-600">
              {pendentes.map((c) => c.nome).join(", ")} · {formatCurrency(total)} no último mês
            </p>
          </div>
          <button
            type="button"
            onClick={lancarTodas}
            disabled={lancando}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {lancando ? "Lançando..." : "Lançar agora"}
          </button>
        </div>
      )}
    </div>
  );
}
