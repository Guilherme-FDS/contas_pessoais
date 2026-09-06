"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SummaryCard, { formatCurrency, formatDate } from "@/components/SummaryCard";
import MonthNav, { currentMonth, labelForMonth, monthRange, shiftMonth } from "@/components/MonthNav";
import { dueStatusByDate, dueStatusByDayOfMonth, DUE_STATUS_STYLES } from "@/lib/dueStatus";
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
  onPagar: () => void;
}

export default function DashboardPage() {
  const supabase = createClient();
  const realCurrentMonth = currentMonth();
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserName(firstName(data.user)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      supabase.from("contas_fixas_pagamentos").select("*"),
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

  function isPaidFixa(fixaId: string, mes: string) {
    return fixasPagamentos.some((p) => p.conta_fixa_id === fixaId && p.mes === mes && p.pago);
  }

  async function handlePagarFixa(fixa: ContaFixa, mes: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("contas_fixas_pagamentos").insert({
      conta_fixa_id: fixa.id,
      mes,
      pago: true,
      valor_pago: fixa.valor,
      valor_juros: 0,
      created_by: user?.id,
    });
    load();
  }

  async function handlePagarVariavel(v: ContaVariavel) {
    await supabase
      .from("contas_variaveis")
      .update({
        pago: true,
        valor_pago: v.valor,
        valor_juros: 0,
        pago_em: new Date().toISOString(),
      })
      .eq("id", v.id);
    load();
  }

  async function handlePagarFutura(f: ContaFutura) {
    await supabase
      .from("contas_futuras")
      .update({
        status: "pago",
        valor_pago: f.valor,
        pago_em: new Date().toISOString(),
      })
      .eq("id", f.id);
    load();
  }

  // ===== Notificações: sempre relativas a hoje, independente do mês navegado =====
  // Uma conta fixa/variável não paga nunca "desaparece" — ela continua aparecendo
  // como atrasada até alguém marcar como paga (ou pagar aqui mesmo).
  const notificacoes: Notificacao[] = [];

  for (const fixa of fixasAtivas) {
    const startMonth = (fixa.data_primeira_parcela ?? fixa.created_at).slice(0, 7);
    if (startMonth > realCurrentMonth) continue;
    const total = Math.min(monthsBetween(startMonth, realCurrentMonth), 60);
    for (let i = 0; i <= total; i++) {
      const mes = shiftMonth(startMonth, i);
      if (isPaidFixa(fixa.id, mes)) continue;
      if (mes < realCurrentMonth) {
        notificacoes.push({
          key: `fixa-${fixa.id}-${mes}`,
          origem: "Fixa",
          nome: fixa.nome,
          valor: Number(fixa.valor),
          detalhe: `Competência ${labelForMonth(mes)}`,
          status: "vermelho",
          ordemData: mes,
          onPagar: () => handlePagarFixa(fixa, mes),
        });
      } else if (fixa.dia_vencimento) {
        const st = dueStatusByDayOfMonth(fixa.dia_vencimento, false);
        if (st === "vermelho" || st === "laranja") {
          notificacoes.push({
            key: `fixa-${fixa.id}-${mes}`,
            origem: "Fixa",
            nome: fixa.nome,
            valor: Number(fixa.valor),
            detalhe: `Vence dia ${fixa.dia_vencimento}`,
            status: st,
            ordemData: mes,
            onPagar: () => handlePagarFixa(fixa, mes),
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
        onPagar: () => handlePagarVariavel(v),
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
        onPagar: () => handlePagarFutura(f),
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
  let totalFixasPago = 0;
  let totalFixasFalta = 0;
  for (const f of fixasAtivas) {
    const payment = fixasPagamentos.find(
      (p) => p.conta_fixa_id === f.id && p.mes === selectedMonth && p.pago
    );
    if (payment) {
      totalFixasPago += Number(payment.valor_pago ?? f.valor) + Number(payment.valor_juros ?? 0);
    } else {
      totalFixasFalta += Number(f.valor);
    }
  }

  let totalVariaveisPago = 0;
  let totalVariaveisFalta = 0;
  for (const v of variaveisMes) {
    if (v.pago) {
      totalVariaveisPago += Number(v.valor_pago ?? v.valor) + Number(v.valor_juros ?? 0);
    } else {
      totalVariaveisFalta += Number(v.valor);
    }
  }

  const futurasMarcadas = futuras.filter((f) => f.incluir_soma);
  let totalFuturasPago = 0;
  let totalFuturasFalta = 0;
  for (const f of futurasMarcadas) {
    if (f.status === "pago") {
      totalFuturasPago += Number(f.valor_pago ?? f.valor) + Number(f.valor_juros ?? 0);
    } else {
      totalFuturasFalta += Number(f.valor);
    }
  }

  const totalPago = totalFixasPago + totalVariaveisPago + totalFuturasPago;
  const totalFalta = totalFixasFalta + totalVariaveisFalta + totalFuturasFalta;
  const totalInvestido = investimentos.reduce((acc, i) => acc + Number(i.valor_investido), 0);

  const porCategoriaInvestimentos = investimentos.reduce<Record<string, number>>((acc, i) => {
    acc[i.categoria] = (acc[i.categoria] ?? 0) + Number(i.valor_investido);
    return acc;
  }, {});

  const porCategoriaPago: Record<string, number> = {};
  for (const f of fixasAtivas) {
    const payment = fixasPagamentos.find(
      (p) => p.conta_fixa_id === f.id && p.mes === selectedMonth && p.pago
    );
    if (payment) {
      const cat = f.categoria ?? "Outros";
      porCategoriaPago[cat] =
        (porCategoriaPago[cat] ?? 0) + Number(payment.valor_pago ?? f.valor) + Number(payment.valor_juros ?? 0);
    }
  }
  for (const v of variaveisMes) {
    if (v.pago) {
      const cat = v.categoria ?? "Outros";
      porCategoriaPago[cat] =
        (porCategoriaPago[cat] ?? 0) + Number(v.valor_pago ?? v.valor) + Number(v.valor_juros ?? 0);
    }
  }
  for (const f of futurasMarcadas) {
    if (f.status === "pago") {
      const cat = f.categoria ?? "Outros";
      porCategoriaPago[cat] =
        (porCategoriaPago[cat] ?? 0) + Number(f.valor_pago ?? f.valor) + Number(f.valor_juros ?? 0);
    }
  }
  const categoryData = Object.entries(porCategoriaPago)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const saldoDisponivel = saldoMensal ? Number(saldoMensal.valor_inicial) : null;
  const saidaMes = pagamentosMes.reduce((acc, p) => acc + p.valor + p.valor_juros, 0);
  const saldoAtual = saldoDisponivel !== null ? saldoDisponivel - saidaMes : null;

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
                    onClick={n.onPagar}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Marcar pago
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Indicadores de {labelForMonth(selectedMonth).toLowerCase()}
        </h2>
        <MonthNav month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Falta pagar no mês" value={totalFalta} />
        <SummaryCard label="Já pago no mês" value={totalPago} />
        <SummaryCard
          label="Atrasado (meses anteriores)"
          value={totalAtrasado}
          hint="Some tudo que passou do vencimento e nunca foi pago"
        />
        <SummaryCard label="Total Investido" value={totalInvestido} />
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
          <div className="mt-2 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-neutral-500">Disponível</p>
              <p className="text-lg font-semibold text-neutral-900">
                {formatCurrency(saldoDisponivel)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Já saiu</p>
              <p className="text-lg font-semibold text-neutral-900">{formatCurrency(saidaMes)}</p>
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
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Pago por categoria no mês</h2>
          {categoryData.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">
              Nada pago ainda em {labelForMonth(selectedMonth).toLowerCase()}.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {categoryData.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{c.name}</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Investimentos por categoria</h2>
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
    </div>
  );
}
