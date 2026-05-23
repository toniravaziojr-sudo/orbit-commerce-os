// ============================================================
// Pain → Category Resolver — Onda 3 (Reg #2.18)
//
// Substitui o léxico hardcoded de cosmético/cabelo (calv/caspa/queda)
// por uma derivação UNIVERSAL de padrões ILIKE a partir do que o
// próprio cliente disse + sinônimos do dicionário do tenant.
//
// Princípios:
//  - Zero lista fechada. Zero termo de segmento no código.
//  - Tokens vêm do `painSource` (texto que o cliente declarou) com
//    stopwords PT removidas e mínimo de 4 caracteres.
//  - Sinônimos do tenant (TenantVocabulary.painPoints[].synonyms)
//    são adicionados quando o token bate com o nome de uma dor
//    declarada pelo lojista.
//  - Saída: array de padrões `%token%` para `categories.name ILIKE`.
//  - Função pura (não consulta banco).
// ============================================================

import type { TenantVocabulary } from "./tenant-vocabulary-resolver.ts";

// Stopwords PT-BR mínimas. Não cobrem vocabulário de segmento.
const STOPWORDS = new Set([
  "para", "pelo", "pela", "como", "isso", "esse", "essa", "este", "esta",
  "tenho", "estou", "sofro", "minha", "meu", "muito", "muita", "pouco",
  "pouca", "ainda", "tambem", "também", "mais", "menos", "que", "qual",
  "quais", "porque", "tem", "ter", "uma", "uns", "umas", "dos", "das",
  "nos", "nas", "sem", "com", "por", "uma", "qualquer", "alguma", "algum",
  "preciso", "quero", "queria", "gostaria", "vou", "vamos", "ser", "sera",
  "será", "estar", "estamos", "produto", "produtos", "tipo", "tipos",
  "certo", "certa", "todo", "toda", "todos", "todas", "muito", "boa",
  "bom", "bem", "muito", "mais", "ola", "olá", "oi", "ajuda", "ajudar",
  "voce", "você", "vocês", "voces",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text: string): string[] {
  const flat = stripAccents(String(text || "")).toLowerCase();
  const raw = flat.split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of raw) {
    if (tok.length < 4) continue;
    if (STOPWORDS.has(tok)) continue;
    if (!out.includes(tok)) out.push(tok);
  }
  return out;
}

export interface DerivePainPatternsInput {
  /** Texto bruto do que o cliente disse (pain_hint + query + última msg). */
  painSource: string;
  /** Vocabulário do tenant — pode ser null/vazio se ainda não cadastrado. */
  vocabulary: TenantVocabulary | null;
  /** Limite de padrões devolvidos (default 8) para evitar query ILIKE explodir. */
  maxPatterns?: number;
}

export interface DerivePainPatternsResult {
  /** Padrões `%token%` prontos para `categories.name ILIKE`. */
  patterns: string[];
  /** Tokens que originaram cada padrão (auditoria/log). */
  tokens: string[];
  /** Sinônimos de dor do tenant que casaram. */
  matchedPainPoints: string[];
}

/**
 * Deriva padrões ILIKE a partir do texto do cliente + vocabulário do tenant.
 * Universal: funciona em qualquer segmento (cosmético, pet, moda, etc.).
 */
export function derivePainCategoryPatternsUniversal(
  input: DerivePainPatternsInput
): DerivePainPatternsResult {
  const { painSource, vocabulary, maxPatterns = 8 } = input;
  const tokens = tokenize(painSource);
  const matchedPainPoints: string[] = [];
  const finalTokens: string[] = [...tokens];

  // Para cada dor declarada pelo tenant, se algum sinônimo aparecer no texto,
  // adicionamos o nome da dor + seus demais sinônimos como tokens extras.
  if (vocabulary?.painPoints?.length) {
    const flatSource = stripAccents(painSource.toLowerCase());
    for (const pp of vocabulary.painPoints) {
      const candidates = [pp.name, ...(pp.synonyms || [])]
        .map((s) => stripAccents(String(s || "").toLowerCase()).trim())
        .filter((s) => s.length >= 3);
      const hit = candidates.some((c) => c && flatSource.includes(c));
      if (!hit) continue;
      matchedPainPoints.push(pp.name);
      for (const c of candidates) {
        const head = c.split(/\s+/)[0];
        if (head && head.length >= 3 && !finalTokens.includes(head)) {
          finalTokens.push(head);
        }
      }
    }
  }

  const patterns = finalTokens
    .slice(0, maxPatterns)
    .map((t) => `%${t}%`);

  return { patterns, tokens: finalTokens, matchedPainPoints };
}
