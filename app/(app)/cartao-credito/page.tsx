"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/components/SummaryCard";
import { CATEGORIAS_CONTAS } from "@/lib/categorias";
import type { FaturaCartao, TransacaoCartao } from "@/lib/types";

// Estrutura completa pro item 7 do prompt-claude-code.md — fica FORA do menu
// (components/Nav.tsx não referencia esta rota) e não conecta ao total de
// Contas Variáveis/Resumo ainda. Só parser de CSV por enquanto (PDF/OFX
// dependem do formato exato do banco/cartão, fora de escopo por agora).

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignora
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c");
}

function parseValor(raw: string): number {
  let s = raw.replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,(?=\d{3}(\D|$))/g, "");
  }
  return Number(s) || 0;
}

function parseDataFlexivel(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const KEYWORD_CATEGORIA: [RegExp, string][] = [
  [/uber|99app|taxi|combust|posto/i, "Transporte"],
  [/ifood|restaurante|lanchonete|mercado|supermercado|padaria/i, "Alimentação"],
  [/netflix|spotify|amazon prime|disney|hbo|assinatura|youtube premium/i, "Assinaturas"],
  [/farmacia|drogaria|hospital|clinica|plano de saude|laboratorio/i, "Saúde"],
  [/escola|faculdade|curso|udemy|colegio/i, "Educação"],
  [/cinema|show|ingresso|steam|playstation/i, "Lazer"],
  [/aluguel|condominio|imobiliaria/i, "Moradia"],
];

function suggestCategoria(descricao: string): string {
  for (const [re, cat] of KEYWORD_CATEGORIA) {
    if (re.test(descricao)) return cat;
  }
  return "Outros";
}

function detectParcela(descricao: string): { atual: number; total: number } | null {
  const m = descricao.match(/(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (!m) return null;
  const atual = Number(m[1]);
  const total = Number(m[2]);
  if (total > 0 && total <= 60 && atual > 0 && atual <= total) return { atual, total };
  return null;
}

interface ParsedRow {
  data: string | null;
  descricao: string;
  valor: number;
  categoria: string;
  parcela_atual: number | null;
  total_parcelas: number | null;
}

function parseFatura(text: string): ParsedRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map(normalize);
  const idxData = header.findIndex((h) => h.includes("data") || h.includes("date"));
  const idxDescricao = header.findIndex(
    (h) => h.includes("descri") || h.includes("historico") || h.includes("estabelecimento")
  );
  const idxValor = header.findIndex(
    (h) => h.includes("valor") || h.includes("amount") || h.includes("value")
  );

  const hasHeader = idxData !== -1 || idxDescricao !== -1 || idxValor !== -1;
  const dataCol = idxData !== -1 ? idxData : 0;
  const descricaoCol = idxDescricao !== -1 ? idxDescricao : 1;
  const valorCol = idxValor !== -1 ? idxValor : 2;

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .filter((r) => r.length > Math.max(dataCol, descricaoCol, valorCol))
    .map((r) => {
      const descricao = (r[descricaoCol] ?? "").trim();
      const parcela = detectParcela(descricao);
      return {
        data: parseDataFlexivel(r[dataCol] ?? ""),
        descricao,
        valor: parseValor(r[valorCol] ?? "0"),
        categoria: suggestCategoria(descricao),
        parcela_atual: parcela?.atual ?? null,
        total_parcelas: parcela?.total ?? null,
      };
    })
    .filter((r) => r.descricao && r.valor !== 0);
}

export default function CartaoCreditoPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [faturas, setFaturas] = useState<FaturaCartao[]>([]);
  const [transacoes, setTransacoes] = useState<TransacaoCartao[]>([]);
  const [selectedFaturaId, setSelectedFaturaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("fatura_cartao")
      .select("*")
      .order("data_importacao", { ascending: false });
    const list = (data ?? []) as FaturaCartao[];
    setFaturas(list);
    if (!selectedFaturaId && list.length > 0) setSelectedFaturaId(list[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadTransacoes() {
      if (!selectedFaturaId) {
        setTransacoes([]);
        return;
      }
      const { data } = await supabase
        .from("transacao_cartao")
        .select("*")
        .eq("fatura_id", selectedFaturaId)
        .order("data", { ascending: true });
      setTransacoes((data ?? []) as TransacaoCartao[]);
    }
    loadTransacoes();
  }, [selectedFaturaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File) {
    setError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseFatura(text);
      if (parsed.length === 0) {
        setError("Não consegui reconhecer nenhuma transação nesse arquivo.");
        setImporting(false);
        return;
      }

      const mesReferencia =
        parsed.find((p) => p.data)?.data?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: fatura, error: faturaError } = await supabase
        .from("fatura_cartao")
        .insert({ mes_referencia: mesReferencia, arquivo_origem: file.name, created_by: user?.id })
        .select()
        .single();

      if (faturaError || !fatura) {
        setError(faturaError?.message ?? "Erro ao criar a fatura.");
        setImporting(false);
        return;
      }

      const { error: transacoesError } = await supabase.from("transacao_cartao").insert(
        parsed.map((p) => ({
          fatura_id: fatura.id,
          data: p.data,
          descricao: p.descricao,
          valor: p.valor,
          categoria: p.categoria,
          parcela_atual: p.parcela_atual,
          total_parcelas: p.total_parcelas,
        }))
      );

      if (transacoesError) {
        setError(transacoesError.message);
      } else {
        setSelectedFaturaId(fatura.id);
        await load();
      }
    } catch {
      setError("Não consegui ler esse arquivo. Confirma que é um CSV.");
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteFatura(id: string) {
    if (!confirm("Excluir esta fatura e todas as transações importadas?")) return;
    await supabase.from("fatura_cartao").delete().eq("id", id);
    if (selectedFaturaId === id) setSelectedFaturaId(null);
    load();
  }

  async function handleCategoriaChange(transacaoId: string, categoria: string) {
    await supabase.from("transacao_cartao").update({ categoria }).eq("id", transacaoId);
    setTransacoes((prev) =>
      prev.map((t) => (t.id === transacaoId ? { ...t, categoria } : t))
    );
  }

  const totalFatura = transacoes.reduce((acc, t) => acc + Number(t.valor), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Cartão de Crédito</h1>
        <p className="text-sm text-neutral-500">
          Área em construção (não aparece no menu principal ainda). Importa a fatura em CSV,
          classifica por categoria, e mostra parcelas quando a descrição indicar (ex: 3/12).
          Ainda não soma no total de Contas Variáveis nem no Resumo.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-neutral-700">
          Importar fatura (.csv)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={importing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mt-2 text-sm"
        />
        {importing && <p className="mt-2 text-sm text-neutral-500">Importando...</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-neutral-400">
          Espera colunas de data, descrição e valor (com ou sem cabeçalho). PDF e OFX ainda não
          são suportados.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedFaturaId ?? ""}
          onChange={(e) => setSelectedFaturaId(e.target.value || null)}
          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Selecione uma fatura importada...</option>
          {faturas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.mes_referencia} — {f.arquivo_origem ?? "sem nome"}
            </option>
          ))}
        </select>
        {selectedFaturaId && (
          <button
            type="button"
            onClick={() => handleDeleteFatura(selectedFaturaId)}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Excluir esta fatura
          </button>
        )}
      </div>

      {selectedFaturaId && (
        <>
          <div>
            <p className="text-xs text-neutral-500">Total da fatura</p>
            <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalFatura)}</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-400">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Parcela</th>
                  <th className="px-4 py-3">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-neutral-400" colSpan={5}>
                      Carregando...
                    </td>
                  </tr>
                ) : transacoes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-neutral-400" colSpan={5}>
                      Nenhuma transação nessa fatura.
                    </td>
                  </tr>
                ) : (
                  transacoes.map((t) => (
                    <tr key={t.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-neutral-700">{formatDate(t.data)}</td>
                      <td className="px-4 py-3 text-neutral-700">{t.descricao}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatCurrency(Number(t.valor))}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {t.parcela_atual && t.total_parcelas
                          ? `${t.parcela_atual}/${t.total_parcelas}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.categoria ?? ""}
                          onChange={(e) => handleCategoriaChange(t.id, e.target.value)}
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">Sem categoria</option>
                          {CATEGORIAS_CONTAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
