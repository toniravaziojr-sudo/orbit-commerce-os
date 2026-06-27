// =============================================
// MELI SEARCH TERM BUILDER v1.0.0
// Cascata determinística para o termo enviado ao domain_discovery do Mercado Livre:
//   1) nome sanitizado + tipo do produto (cadastro)               → sem IA
//   2) nome sanitizado + resumo funcional gerado por IA (cacheado) → IA só na 1ª vez ou
//      quando o cadastro mudar (invalidação por assinatura SHA-256)
//   3) nome sanitizado + marca (responsabilidade do chamador)
// =============================================

import { aiChatCompletionJSON } from "../ai-router.ts";

export const SEARCH_TERM_BUILDER_VERSION = "v1.0.0";
const SUMMARY_MAX_LEN = 80;
const PRIMARY_MAX_LEN = 200;
const FALLBACK_MAX_LEN = 200;

export interface ProductCadastro {
  id: string;
  name: string | null;
  brand?: string | null;
  product_type?: string | null;
  ai_product_type?: string | null;
  ai_main_function?: string | null;
  product_format?: string | null;
  line?: string | null;
  short_description?: string | null;
  description?: string | null;
  net_content_value?: number | string | null;
  net_content_unit?: string | null;
  ml_search_summary?: string | null;
  ml_search_summary_signature?: string | null;
}

/** Remove sufixos de pack/quantidade que confundem o classificador do ML. */
export function sanitizeCategorySearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\(\s*\d+\s*x\s*\)/gi, " ")
    .replace(/\b\d+\s*x\s+(?=\w)/gi, " ")
    .replace(/\bkit\s+com\s+\d+\b/gi, "kit")
    .replace(/\b\d+\s*unidades?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Tipo efetivo: prioriza o cadastro humano; usa ai_product_type só como auxiliar. */
export function resolveProductType(p: ProductCadastro): string {
  const manual = (p.product_type || "").trim();
  if (manual) return manual;
  const ai = (p.ai_product_type || "").trim();
  return ai;
}

/** Termo primário: nome + tipo (sem IA, sem custo). */
export function buildPrimarySearchTerm(p: ProductCadastro): string {
  const name = sanitizeCategorySearchTerm(p.name || "");
  const type = sanitizeCategorySearchTerm(resolveProductType(p));
  if (!name) return "";
  if (!type) return name;
  // Evita duplicar tipo quando ele já aparece no nome.
  if (name.toLowerCase().includes(type.toLowerCase())) return name.slice(0, PRIMARY_MAX_LEN);
  return `${type} ${name}`.slice(0, PRIMARY_MAX_LEN);
}

/** Termo de fallback IA: nome sanitizado + resumo funcional cacheado. */
export function buildAiFallbackSearchTerm(p: ProductCadastro, summary: string): string {
  const name = sanitizeCategorySearchTerm(p.name || "");
  const clean = sanitizeCategorySearchTerm(summary || "");
  if (!clean) return name;
  if (!name) return clean.slice(0, FALLBACK_MAX_LEN);
  if (clean.toLowerCase().includes(name.toLowerCase())) return clean.slice(0, FALLBACK_MAX_LEN);
  return `${clean} ${name}`.slice(0, FALLBACK_MAX_LEN);
}

/**
 * Assinatura SHA-256 dos campos do cadastro que alimentam o resumo.
 * Qualquer mudança em um dos campos invalida o cache na próxima consulta.
 */
export async function computeProductSignature(p: ProductCadastro): Promise<string> {
  const parts = [
    (p.name || "").trim().toLowerCase(),
    (p.brand || "").trim().toLowerCase(),
    (p.product_type || "").trim().toLowerCase(),
    (p.ai_product_type || "").trim().toLowerCase(),
    (p.product_format || "").trim().toLowerCase(),
    (p.line || "").trim().toLowerCase(),
    stripHtml(p.short_description).toLowerCase(),
    stripHtml(p.description).toLowerCase(),
    String(p.net_content_value ?? "").trim(),
    (p.net_content_unit || "").trim().toLowerCase(),
    SEARCH_TERM_BUILDER_VERSION,
  ];
  const payload = parts.join("|");
  const buf = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SUMMARY_PROMPT = `Você recebe o cadastro completo de um produto físico e devolve um RESUMO FUNCIONAL ULTRA CURTO usado para classificar a categoria no Mercado Livre.

Regras obrigatórias:
- Máximo 80 caracteres.
- Formato: TIPO + atributo essencial + volume/quantidade (ex.: "Shampoo anticaspa masculino 250ml").
- Use a palavra funcional concreta do produto (Shampoo, Balm, Loção, Creme, Sérum, Pomada, Máscara capilar, Suplemento, etc.).
- NÃO inclua nome da marca, slogan, benefício, adjetivo comercial, emoji, aspas ou pontuação final.
- Se o cadastro indicar kit/combo, comece por "Kit" e nomeie o tipo dos itens (ex.: "Kit shampoo e balm capilar 250ml").
- Responda apenas em português, em uma única linha.

Devolva JSON estrito: {"summary": "..."}.`;

interface SupabaseLike {
  from: (t: string) => any;
}

/**
 * Lê o resumo cacheado; se a assinatura do cadastro mudou ou não existe, gera via IA,
 * persiste em products.ml_search_summary + ml_search_summary_signature e devolve.
 * Em qualquer falha de IA, devolve string vazia (o chamador degrada para o fallback de marca).
 */
export async function getOrGenerateSearchSummary(
  supabase: SupabaseLike,
  product: ProductCadastro,
): Promise<string> {
  if (!product?.id) return "";
  const signature = await computeProductSignature(product);
  const cached = (product.ml_search_summary || "").trim();
  const cachedSig = (product.ml_search_summary_signature || "").trim();
  if (cached && cachedSig === signature) {
    return cached;
  }

  // Monta payload enxuto para a IA — corte agressivo na descrição evita gasto desnecessário.
  const payload = {
    nome: product.name || "",
    marca: product.brand || "",
    tipo_cadastro: product.product_type || "",
    tipo_ai: product.ai_product_type || "",
    formato: product.product_format || "",
    linha: product.line || "",
    funcao_principal: product.ai_main_function || "",
    volume: product.net_content_value ? `${product.net_content_value} ${product.net_content_unit || ""}`.trim() : "",
    descricao_curta: stripHtml(product.short_description).slice(0, 400),
    descricao: stripHtml(product.description).slice(0, 1200),
  };

  let summary = "";
  try {
    const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash-lite", {
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 120,
    }, { logPrefix: "[meli-search-summary]" });

    const raw = data?.choices?.[0]?.message?.content || "";
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      summary = String(parsed?.summary || "").trim();
    } catch {
      summary = String(raw || "").trim();
    }
  } catch (err) {
    console.warn(`[meli-search-summary] AI summary failed for product ${product.id}:`, err);
    return "";
  }

  // Sanitização defensiva (limite duro mesmo se a IA exceder).
  summary = summary.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (summary.length > SUMMARY_MAX_LEN) summary = summary.slice(0, SUMMARY_MAX_LEN).trim();
  if (!summary) return "";

  try {
    await supabase
      .from("products")
      .update({ ml_search_summary: summary, ml_search_summary_signature: signature })
      .eq("id", product.id);
  } catch (err) {
    console.warn(`[meli-search-summary] failed to persist summary for ${product.id}:`, err);
  }

  return summary;
}
