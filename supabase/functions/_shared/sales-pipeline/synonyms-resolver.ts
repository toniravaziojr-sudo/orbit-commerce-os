// ============================================================
// Frente 3 — Resolver determinístico de sinônimos por tenant.
//
// Consulta `tenant_ai_synonyms` para mapear termos do cliente
// (ex.: "minoxidil", "ácido hialurônico") a um produto específico
// do catálogo do tenant. Usado pelo search_products / âncora ANTES
// do roteador estatístico, garantindo resposta determinística para
// termos ambíguos ou paralelos a marca/ingrediente.
//
// Função pura sob a perspectiva da edge: recebe `supabase` client
// já autenticado (service role) e devolve o produto-alvo se houver
// match, ou null.
// ============================================================

export interface SynonymHit {
  id: string;
  term: string;
  kind: "synonym" | "brand" | "ingredient" | "alias";
  target_product_id: string | null;
  response_template: string | null;
}

function normalize(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResolveSynonymInput {
  tenantId: string;
  text: string;
  // deno-lint-ignore no-explicit-any
  supabase: any;
}

/**
 * Procura um sinônimo cadastrado dentro do texto do turno.
 * Estratégia: busca o conjunto de sinônimos ativos do tenant
 * (cap 200) e procura longest-match no texto normalizado.
 * Retorna o primeiro hit ou null.
 */
export async function resolveTenantSynonym(
  input: ResolveSynonymInput,
): Promise<SynonymHit | null> {
  const { tenantId, text, supabase } = input;
  if (!tenantId || !text) return null;
  const normalized = normalize(text);
  if (!normalized) return null;

  try {
    const { data, error } = await supabase
      .from("tenant_ai_synonyms")
      .select("id, term, term_normalized, kind, target_product_id, response_template, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(200);
    if (error) {
      console.warn(`[synonyms-resolver] erro ao buscar:`, error.message);
      return null;
    }
    const rows = (data || []) as Array<SynonymHit & { term_normalized: string; is_active: boolean }>;
    if (!rows.length) return null;

    // Longest-match com boundary simples
    const sorted = rows
      .filter((r) => r.term_normalized && r.term_normalized.length >= 2)
      .sort((a, b) => b.term_normalized.length - a.term_normalized.length);

    for (const row of sorted) {
      const tok = row.term_normalized;
      const idx = normalized.indexOf(tok);
      if (idx < 0) continue;
      const before = idx === 0 ? " " : normalized[idx - 1];
      const after = idx + tok.length >= normalized.length ? " " : normalized[idx + tok.length];
      if (/[\s\-.,;:!?]/.test(before) && /[\s\-.,;:!?]/.test(after)) {
        return {
          id: row.id,
          term: row.term,
          kind: row.kind,
          target_product_id: row.target_product_id,
          response_template: row.response_template,
        };
      }
    }
    return null;
  } catch (e) {
    console.warn(`[synonyms-resolver] exceção:`, (e as Error).message);
    return null;
  }
}
