import type { SupabaseClient } from "@supabase/supabase-js";

export type OrigemPagamento = "Fixa" | "Variável" | "Futura";

export interface PagamentoRegistro {
  id: string;
  origem: OrigemPagamento;
  nome: string;
  categoria: string | null;
  valor: number;
  valor_juros: number;
  data_pagamento: string;
  data_vencimento: string | null;
}

// Junta tudo que foi efetivamente pago (Fixas + Variáveis + Futuras) num período,
// usando a data real de pagamento (pago_em) — não a competência/data prevista.
// Usado pela aba Saldo (extrato do mês) e por Relatórios (período arbitrário).
export async function fetchPagamentos(
  supabase: SupabaseClient,
  range: { start: string; end: string }
): Promise<PagamentoRegistro[]> {
  const { start, end } = range;

  const [fixasRes, variaveisRes, futurasRes] = await Promise.all([
    supabase
      .from("contas_fixas_pagamentos")
      .select(
        "id, mes, valor_pago, valor_juros, pago_em, contas_fixas(nome, categoria, dia_vencimento)"
      )
      .eq("pago", true)
      .gte("pago_em", start)
      .lt("pago_em", end),
    supabase
      .from("contas_variaveis")
      .select("id, nome, categoria, valor, valor_pago, valor_juros, data, pago_em")
      .eq("pago", true)
      .gte("pago_em", start)
      .lt("pago_em", end),
    supabase
      .from("contas_futuras")
      .select("id, nome, categoria, valor, valor_pago, valor_juros, data_prevista, pago_em")
      .eq("status", "pago")
      .gte("pago_em", start)
      .lt("pago_em", end),
  ]);

  const registros: PagamentoRegistro[] = [];

  for (const p of (fixasRes.data ?? []) as any[]) {
    const conta = p.contas_fixas;
    registros.push({
      id: `fixa-${p.id}`,
      origem: "Fixa",
      nome: conta?.nome ?? "Conta fixa",
      categoria: conta?.categoria ?? null,
      valor: Number(p.valor_pago ?? 0),
      valor_juros: Number(p.valor_juros ?? 0),
      data_pagamento: p.pago_em,
      data_vencimento:
        conta?.dia_vencimento && p.mes
          ? `${p.mes}-${String(conta.dia_vencimento).padStart(2, "0")}`
          : null,
    });
  }

  for (const v of (variaveisRes.data ?? []) as any[]) {
    registros.push({
      id: `variavel-${v.id}`,
      origem: "Variável",
      nome: v.nome,
      categoria: v.categoria ?? null,
      valor: Number(v.valor_pago ?? v.valor ?? 0),
      valor_juros: Number(v.valor_juros ?? 0),
      data_pagamento: v.pago_em,
      data_vencimento: v.data ?? null,
    });
  }

  for (const f of (futurasRes.data ?? []) as any[]) {
    registros.push({
      id: `futura-${f.id}`,
      origem: "Futura",
      nome: f.nome,
      categoria: f.categoria ?? null,
      valor: Number(f.valor_pago ?? f.valor ?? 0),
      valor_juros: Number(f.valor_juros ?? 0),
      data_pagamento: f.pago_em,
      data_vencimento: f.data_prevista ?? null,
    });
  }

  return registros.sort((a, b) => (a.data_pagamento < b.data_pagamento ? 1 : -1));
}
