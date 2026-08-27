export type StatusContaFutura = "pendente" | "negociando" | "pago";

export interface ContaFixa {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number | null;
  categoria: string | null;
  ativo: boolean;
  tem_parcelas: boolean;
  total_parcelas: number | null;
  parcela_inicial: number;
  data_primeira_parcela: string | null;
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
  pago: boolean;
  pago_em: string;
  valor_pago: number | null;
  valor_juros: number;
  created_by: string | null;
  created_at: string;
}

export interface ContaVariavel {
  id: string;
  nome: string;
  valor: number;
  data: string;
  categoria: string | null;
  pago: boolean;
  valor_pago: number | null;
  valor_juros: number;
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
  valor_pago: number | null;
  valor_juros: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaturaCartao {
  id: string;
  mes_referencia: string;
  arquivo_origem: string | null;
  data_importacao: string;
  created_by: string | null;
  created_at: string;
}

export interface TransacaoCartao {
  id: string;
  fatura_id: string;
  data: string | null;
  descricao: string;
  valor: number;
  categoria: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
  created_at: string;
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
