export type StatusContaFutura = "pendente" | "negociando" | "pago";

export interface ContaFixa {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number | null;
  categoria: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContaFixaHistorico {
  id: string;
  conta_fixa_id: string;
  valor: number;
  vigente_desde: string;
  created_at: string;
}

export interface ContaFixaPagamento {
  id: string;
  conta_fixa_id: string;
  mes: string;
  pago_em: string;
  created_by: string | null;
  created_at: string;
}

export interface ContaVariavel {
  id: string;
  nome: string;
  valor: number;
  data: string;
  categoria: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContaFutura {
  id: string;
  nome: string;
  valor: number;
  categoria: string | null;
  data_prevista: string | null;
  status: StatusContaFutura;
  incluir_soma: boolean;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Investimento {
  id: string;
  categoria: string;
  ativo: string;
  valor_investido: number;
  data_aplicacao: string;
  corretora: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
