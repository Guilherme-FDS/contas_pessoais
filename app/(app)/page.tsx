"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SummaryCard, { formatCurrency, formatDate } from "@/components/SummaryCard";
import MonthNav, { currentMonth, labelForMonth, monthRange, shiftMonth } from "@/components/MonthNav";
import {
  dueStatusByDate,
  dueStatusByDayOfMonth,
  todayLocalISO,
  DUE_STATUS_STYLES,
} from "@/lib/dueStatus";
import { fetchPagamentos, type PagamentoRegistro } from "@/lib/pagamentos";
import type {
  ContaFixa,
  ContaFixaPagamento,
  ContaFutura,
  ContaVariavel,
  Investimento,
  SaldoMensal,
} from "@/lib/types";

function firstName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
} | null | undefined) {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const metaName = (meta.full_name as string) || (meta.name as string);
  if (metaName) return metaName.split(" ")[0];
  if (user.email) {
    const local = user.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "";
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

interface Notificacao {
  key: string;
  origem: "Fixa" | "Variável" | "Futura";
  nome: string;
  valor: number;
  detalhe: string;
  status: "vermelho" | "laranja";
  ordemData: string;
  // Competência de mês passado quase sempre é regularização de algo pago fora
  // do app — nesses casos perguntamos a data em vez de assumir hoje, senão o
  // gasto antigo entra no relatório do mês atual.
  perguntarData: boolean;
  pagarCom: (dataPagamento: string) => Promise<void>;
}

export default function DashboardPage() {
  const supabase = createClient();
  const realCurrentMonth = currentMonth();
  const LIMITE_ATRASO = shiftMonth(realCurrentMonth, -24);
  const [selectedMonth, setSelectedMonth] = useState(realCurrentMonth);
  const [userName, setUserName] = useState("");
  const [fixas, setFixas] = useState<ContaFixa[]>([]);
  const [fixasPagamentos, setFixasPagamentos] = useState<ContaFixaPagamento[]>([]);
  const [variaveisMes, setVariaveisMes] = useState<ContaVariavel[]>([]);
  const [variaveisNaoPagas, setVariaveisNaoPagas] = useState<ContaVariavel[]>([]);
  const [futuras, setFuturas] = useState<ContaFutura[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [saldoMensal, setSaldoMensal] = useState<SaldoMensal | null>(null);
  const [pagamentosMes, setPagamentosMes] = useState<PagamentoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagandoKey, setPagandoKey] = useState<string | null>(null);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);
  const [perguntandoData, setPerguntandoData] = useState<Notificacao | null>(null);
  const [dataPagamento, setDataPagamento] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserName(firstName(data.user)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atrasos são procurados até 24 meses atrás. A busca e o laço de notificações
  // usam a mesma janela: se buscássemos menos do que percorremos, mês sem
  // pagamento carregado viraria "atrasado" falso.
  const janelaInicio =
    selectedMonth < LIMITE_ATRASO ? selectedMonth : LIMITE_ATRASO;

  async function load() {
    setLoading(true);
    const { start, end } = monthRange(selectedMonth);
    const [
      fixasRes,
      fixasPagRes,
      variaveisMesRes,
      variaveisNaoPagasRes,
      futurasRes,
      investimentosRes,
      saldoRes,
      registrosMes,
    ] = await Promise.all([
      supabase.from("contas_fixas").select("*"),
      // Só o histórico dentro da janela que a tela realmente usa — sem isso a
      // consulta cresce pra sempre e o Resumo fica mais lento a cada mês.
      supabase.from("contas_fixas_pagamentos").select("*").gte("mes", janelaInicio),
      supabase.from("contas_variaveis").select("*").gte("data", start).lt("data", end),
      supabase.from("contas_variaveis").select("*").eq("pago", false),
      supabase.from("contas_futuras").select("*").order("data_prevista", { ascending: true }),
      supabase.from("investimentos").select("*"),
      supabase.from("saldo_mensal").select("*").eq("mes", selectedMonth).maybeSingle(),
      fetchPagamentos(supabase, { start, end }),
    ]);
    setFixas((fixasRes.data ?? []) as ContaFixa[]);
    setFixasPagamentos((fixasPagRes.data ?? []) as ContaFixaPagamento[]);
    setVariaveisMes((variaveisMesRes.data ?? []) as ContaVariavel[]);
    setVariaveisNaoPagas((variaveisNaoPagasRes.data ?? []) as ContaVariavel[]);
    setFuturas((futurasRes.data ?? []) as ContaFutura[]);
    setInvestimentos((investimentosRes.data ?? []) as Investimento[]);
    setSaldoMensal((saldoRes.data ?? null) as SaldoMensal | null);
    setPagamentosMes(registrosMes);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const fixasAtivas = fixas.filter((f) => f.ativo);

  // Índice (conta|mês) pra consulta O(1): o laço de notificações chega a
  // milhares de checagens e varrer o array inteiro em cada uma custa caro.
  const pagamentosIndex = useMemo(
    () =>
      new Set(
        fixasPagamentos.filter((p) => p.pago).map((p) => `${p.conta_fixa_id}|${p.mes}`)
      ),
    [fixasPagamentos]
  );

  function isPaidFixa(fixaId: string, mes: string) {
    return pagamentosIndex.has(`${fixaId}|${mes}`);
  }

  // Todo pagamento passa por aqui pra que uma falha (rede, RLS, constraint)
  // apareça na tela em vez de o clique simplesmente não fazer nada.
  async function executarPagamento(
    key: string,
    acao: () => PromiseLike<{ error: unknown }>
  ) {
    setPagandoKey(key);
    setErroPagamento(null);
    const { error } = await acao();
    setPagandoKey(null);
    if (error) {
      const mensagem = (error as { message?: string }).message;
      setErroPagamento(mensagem ?? "Não consegui registrar esse pagamento. Tente de novo.");
      return;
    }
    load();
  }

  async function handlePagarFixa(
    key: string,
    fixa: ContaFixa,
    mes: string,
    pagoEm: string
  ) {
    await executarPagamento(key, async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // upsert: se já existe linha pra (conta, mês) — clique duplo, por exemplo —
      // atualiza em vez de estourar a unique constraint.
      return supabase.from("contas_fixas_pagamentos").upsert(
        {
          conta_fixa_id: fixa.id,
          mes,
          pago: true,
          valor_pago: fixa.valor,
          valor_juros: 0,
          pago_em: pagoEm,
          created_by: user?.id,
        },
        { onConflict: "conta_fixa_id,mes" }
      );
    });
  }

  async function handlePagarVariavel(key: string, v: ContaVariavel, pagoEm: string) {
    await executarPagamento(key, () =>
      supabase
        .from("contas_variaveis")
        .update({
          pago: true,
          valor_pago: v.valor,
          valor_juros: 0,
          pago_em: pagoEm,
        })
        .eq("id", v.id)
    );
  }

  async function handlePagarFutura(key: string, f: ContaFutura, pagoEm: string) {
    await executarPagamento(key, () =>
      supabase
        .from("contas_futuras")
        .update({
          status: "pago",
          valor_pago: f.valor,
          pago_em: pagoEm,
        })
        .eq("id", f.id)
    );
  }

  function acionarPagamento(n: Notificacao) {
    if (n.perguntarData) {
      setDataPagamento(todayLocalISO());
      setPerguntandoData(n);
      return;
    }
    n.pagarCom(todayLocalISO());
  }

  async function confirmarPagamentoComData(e: React.FormEvent) {
    e.preventDefault();
    if (!perguntandoData) return;
    const alvo = perguntandoData;
    setPerguntandoData(null);
    await alvo.pagarCom(dataPagamento);
  }

  // ===== Notificações: sempre relativas a hoje, independente do mês navegado =====
  // Uma conta fixa/variável não paga nunca "desaparece" — ela continua aparecendo
  // como atrasada até alguém marcar como paga (ou pagar aqui mesmo).
  const notificacoes: Notificacao[] = [];

  for (const fixa of fixasAtivas) {
    // Nunca cobrar competência anterior ao cadastro da conta no app: um
    // financiamento que começou em 2020 e foi cadastrado hoje não tem 60
    // parcelas "atrasadas" — essas foram pagas fora daqui.
    const cadastro = fixa.created_at.slice(0, 7);
    const primeira = fixa.data_primeira_parcela?.slice(0, 7);
    const inicio = primeira && primeira > cadastro ? primeira : cadastro;
    const startMonth = inicio < LIMITE_ATRASO ? LIMITE_ATRASO : inicio;
    if (startMonth > realCurrentMonth) continue;
    const total = Math.min(monthsBetween(startMonth, realCurrentMonth), 60);
    for (let i = 0; i <= total; i++) {
      const mes = shiftMonth(startMonth, i);
      if (isPaidFixa(fixa.id, mes)) continue;
      const key = `fixa-${fixa.id}-${mes}`;
      if (mes < realCurrentMonth) {
        notificacoes.push({
          key,
          origem: "Fixa",
          nome: fixa.nome,
          valor: Number(fixa.valor),
          detalhe: `Competência ${labelForMonth(mes)}`,
          status: "vermelho",
          ordemData: mes,
          perguntarData: true,
          pagarCom: (pagoEm) => handlePagarFixa(key, fixa, mes, pagoEm),
        });
      } else if (fixa.dia_vencimento) {
        const st = dueStatusByDayOfMonth(fixa.dia_vencimento, false);
        if (st === "vermelho" || st === "laranja") {
          notificacoes.push({
            key,
            origem: "Fixa",
            nome: fixa.nome,
            valor: Number(fixa.valor),
            detalhe: `Vence dia ${fixa.dia_vencimento}`,
            status: st,
            ordemData: mes,
            perguntarData: false,
            pagarCom: (pagoEm) => handlePagarFixa(key, fixa, mes, pagoEm),
          });
        }
      }
    }
  }

  for (const v of variaveisNaoPagas) {
    const st = dueStatusByDate(v.data, false);
    if (st === "vermelho" || st === "laranja") {
      notificacoes.push({
        key: `variavel-${v.id}`,
        origem: "Variável",
        nome: v.nome,
        valor: Number(v.valor),
        detalhe: `Venceu em ${formatDate(v.data)}`,
        status: st,
        ordemData: v.data,
        perguntarData: v.data.slice(0, 7) < realCurrentMonth,
        pagarCom: (pagoEm) => handlePagarVariavel(`variavel-${v.id}`, v, pagoEm),
      });
    }
  }

  for (const f of futuras) {
    if (f.status === "pago" || !f.data_prevista) continue;
    const st = dueStatusByDate(f.data_prevista, false);
    if (st === "vermelho" || st === "laranja") {
      notificacoes.push({
        key: `futura-${f.id}`,
        origem: "Futura",
        nome: f.nome,
        valor: Number(f.valor),
        detalhe: `Previsto para ${formatDate(f.data_prevista)}`,
        status: st,
        ordemData: f.data_prevista,
        perguntarData: f.data_prevista.slice(0, 7) < realCurrentMonth,
        pagarCom: (pagoEm) => handlePagarFutura(`futura-${f.id}`, f, pagoEm),
      });
    }
  }

  notificacoes.sort((a, b) => {
    if (a.status !== b.status) return a.status === "vermelho" ? -1 : 1;
    return a.ordemData < b.ordemData ? -1 : 1;
  });

  const totalAtrasado = notificacoes
    .filter((n) => n.status === "vermelho")
    .reduce((acc, n) => acc + n.valor, 0);

  // ===== Indicadores do mês navegado (falta pagar x já pago) =====
  // "Falta pagar" olha a competência: o que vence neste mês e ainda está aberto.
  let totalFixasFalta = 0;
  for (const f of fixasAtivas) {
    if (!isPaidFixa(f.id, selectedMonth)) totalFixasFalta += Number(f.valor);
  }

  let totalVariaveisFalta = 0;
  for (const v of variaveisMes) {
    if (!v.pago) totalVariaveisFalta += Number(v.valor);
  }

  const futurasMarcadas = futuras.filter((f) => f.incluir_soma);
  let totalFuturasFalta = 0;
  for (const f of futurasMarcadas) {
    if (f.status !== "pago") totalFuturasFalta += Number(f.valor);
  }

  const totalFalta = totalFixasFalta + totalVariaveisFalta + totalFuturasFalta;

  // "Já pago" olha o caixa: o que saiu do bolso neste mês, pela data real do
  // pagamento — mesma base do Saldo, então os dois números sempre batem.
  // Somar por competência aqui contava futuras pagas em qualquer época, todo
  // mês, pra sempre.
  const saidaMes = pagamentosMes.reduce((acc, p) => acc + p.valor + p.valor_juros, 0);
  const totalPago = saidaMes;
  const totalInvestido = investimentos.reduce((acc, i) => acc + Number(i.valor_investido), 0);

  const porCategoriaInvestimentos = investimentos.reduce<Record<string, number>>((acc, i) => {
    acc[i.categoria] = (acc[i.categoria] ?? 0) + Number(i.valor_investido);
    return acc;
  }, {});

  const saldoDisponivel = saldoMensal ? Number(saldoMensal.valor_inicial) : null;
  const saldoAtual = saldoDisponivel !== null ? saldoDisponivel - saidaMes : null;
  // O que sobra (ou falta) se ele quitar hoje tudo que ainda está em aberto.
  const sobraProjetada = (saldoAtual ?? 0) - totalFalta;

  return (
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {userName ? `Bem-vindo, ${userName}!` : "Resumo"}
          </h1>
          <p className="text-sm text-neutral-500">Visão geral das finanças da família.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Notificações {notificacoes.length > 0 && `(${notificacoes.length})`}
          </h2>
          <p className="text-xs text-neutral-400">
            Sempre em relação a hoje — independe do mês que você está navegando
          </p>
        </div>
        {erroPagamento && (
          <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {erroPagamento}
          </p>
        )}
        {notificacoes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400">
            Nada vencido nem vencendo hoje. Tudo em dia!
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {notificacoes.map((n) => (
              <li key={n.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DUE_STATUS_STYLES[n.status]}`}
                  >
                    {n.status === "vermelho" ? "Atrasado" : "Vence hoje"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {n.nome} <span className="text-neutral-400">· {n.origem}</span>
                    </p>
                    <p className="text-xs text-neutral-500">{n.detalhe}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatCurrency(n.valor)}
                  </span>
                  <button
                    onClick={() => acionarPagamento(n)}
                    disabled={pagandoKey === n.key}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {pagandoKey === n.key ? "Salvando..." : "Marcar pago"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {perguntandoData && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setPerguntandoData(null)}
        >
          <form
            onSubmit={confirmarPagamentoComData}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              Quando você pagou {perguntandoData.nome}?
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {perguntandoData.detalhe}. Essa data define em qual mês o gasto aparece no
              Saldo e nos Relatórios — se a conta já tinha sido paga antes, coloque a data
              real do pagamento.
            </p>
            <input
              type="date"
              required
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPerguntandoData(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Indicadores de {labelForMonth(selectedMonth).toLowerCase()}
        </h2>
        <MonthNav month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total de contas do mês"
          value={totalPago + totalFalta}
          hint="Fixas, variáveis e as futuras que você marcou para contar"
        />
        <SummaryCard
          label="Já paguei"
          value={totalPago}
          hint="Saiu do bolso neste mês, incluindo atrasados de outros meses"
        />
        <SummaryCard
          label="Falta pagar"
          value={totalFalta}
          hint="Contas que vencem neste mês e ainda estão em aberto"
        />
        <SummaryCard
          label="Atrasado (meses anteriores)"
          value={totalAtrasado}
          hint="Passou do vencimento e nunca foi pago"
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Saldo de {labelForMonth(selectedMonth).toLowerCase()}
          </h2>
          <Link href="/saldo" className="text-xs font-medium text-brand-700 hover:underline">
            Abrir Saldo
          </Link>
        </div>
        {saldoDisponivel === null ? (
          <p className="mt-2 text-sm text-neutral-400">
            Você ainda não lançou quanto tem disponível esse mês.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-neutral-500">Disponível</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatCurrency(saldoDisponivel)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Já saiu</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatCurrency(saidaMes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Saldo atual</p>
                <p
                  className={`text-lg font-semibold ${
                    (saldoAtual ?? 0) < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(saldoAtual ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Falta pagar</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatCurrency(totalFalta)}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="text-xs text-neutral-500">
                Se pagar tudo que está em aberto neste mês
              </p>
              <p
                className={`text-lg font-semibold ${
                  sobraProjetada < 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {formatCurrency(sobraProjetada)}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {sobraProjetada < 0
                    ? "— o saldo não cobre o que falta"
                    : "— sobra depois de quitar tudo"}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Investimentos</h2>
          <p className="text-xl font-semibold text-neutral-900">
            {formatCurrency(totalInvestido)}
          </p>
        </div>
        {Object.keys(porCategoriaInvestimentos).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Nenhum investimento cadastrado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {Object.entries(porCategoriaInvestimentos).map(([categoria, valor]) => (
              <li key={categoria} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{categoria}</span>
                <span className="font-medium text-neutral-900">{formatCurrency(valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
