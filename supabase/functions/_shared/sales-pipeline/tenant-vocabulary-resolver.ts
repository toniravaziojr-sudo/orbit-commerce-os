// ============================================================
// Tenant Vocabulary Resolver — Onda 1 (Reg #2.18)
//
// Fonte universal do "que o tenant vende e como fala": famílias,
// sinônimos/aliases, dores e termos de marca. Lê fontes que JÁ existem:
//   - public.categories (raízes/árvore) → famílias do catálogo
//   - public.products.product_type      → famílias declaradas no cadastro
//   - public.ai_language_dictionary     → niche_vocabulary, product_aliases,
//                                          preferred_phrases, forbidden_terms
//   - business-context-loader (snapshot/contexto comercial) → segmento,
//                                          audiência, dores inferidas
//
// Princípios:
//  - ZERO listas fechadas por segmento.
//  - Tolerante a falha: erro silencioso → vocabulário vazio (caller decide
//    fallback regex).
//  - Cache em memória por 5 min, invalidável.
//  - Sincrono "peek" para detectores que não podem await.
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface TenantFamily {
  /** chave normalizada (lower, sem acento, sem plural óbvio) */
  key: string;
  /** rótulo legível para prompts/logs */
  label: string;
  /** sinônimos/aliases do tenant para esta família */
  synonyms: string[];
  /** quantos produtos do tenant pertencem a essa família (para priorização) */
  productCount: number;
  /** origem do dado, para auditoria */
  source: "categories" | "product_type" | "language_dictionary" | "business_context";
}

export interface TenantPainPoint {
  name: string;
  synonyms: string[];
  source: "business_context" | "language_dictionary";
}

export interface TenantVocabulary {
  tenantId: string;
  segment: string | null;
  audience: string | null;
  families: TenantFamily[];
  painPoints: TenantPainPoint[];
  /** termos proibidos pela marca (ex.: jargões fora do tom) */
  forbiddenTerms: string[];
  /** frases preferidas pela marca (ex.: assinatura, vocativos) */
  preferredPhrases: Record<string, string>;
  /** alias livre: produto -> apelido comercial usado pelo tenant */
  productAliases: Record<string, string>;
  /** verdade do snapshot — segundos desde epoch */
  loadedAt: number;
}

const CACHE = new Map<string, TenantVocabulary>();
const TTL_MS = 5 * 60 * 1000;

function normalizeKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function makeClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function invalidateTenantVocabularyCache(tenantId?: string) {
  if (tenantId) CACHE.delete(tenantId);
  else CACHE.clear();
}

/** Versão síncrona: devolve o que estiver em cache OU null. Para detectores
 *  determinísticos que não podem await. */
export function peekTenantVocabularyFromCache(tenantId: string): TenantVocabulary | null {
  const cached = CACHE.get(tenantId);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt > TTL_MS) {
    CACHE.delete(tenantId);
    return null;
  }
  return cached;
}

/** Carrega/atualiza o vocabulário do tenant com cache 5min.
 *  Tolerante a falha: nunca lança — devolve estrutura vazia se algo der errado. */
export async function loadTenantVocabulary(
  tenantId: string,
  opts?: { force?: boolean; client?: SupabaseClient },
): Promise<TenantVocabulary> {
  if (!opts?.force) {
    const cached = peekTenantVocabularyFromCache(tenantId);
    if (cached) return cached;
  }

  const empty: TenantVocabulary = {
    tenantId,
    segment: null,
    audience: null,
    families: [],
    painPoints: [],
    forbiddenTerms: [],
    preferredPhrases: {},
    productAliases: {},
    loadedAt: Date.now(),
  };

  if (!tenantId) return empty;

  let client: SupabaseClient;
  try {
    client = opts?.client ?? makeClient();
  } catch (_e) {
    return empty;
  }

  // Roda as fontes em paralelo. Cada uma é tolerante a erro local.
  const [categoriesRes, productTypesRes, dictRes, snapshotRes] = await Promise.allSettled([
    client
      .from("categories")
      .select("name, parent_id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .limit(200),
    client
      .from("products")
      .select("product_type")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .neq("status", "archived")
      .not("product_type", "is", null)
      .limit(2000),
    client
      .from("ai_language_dictionary")
      .select("niche_vocabulary, product_aliases, preferred_phrases, forbidden_terms")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    client
      .from("ai_business_snapshot")
      .select("inferred_tree, segment_label, audience_label")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const familyMap = new Map<string, TenantFamily>();

  function upsertFamily(rawLabel: string, source: TenantFamily["source"], increment = 1) {
    const label = rawLabel?.trim();
    if (!label || label.length < 2) return;
    const key = normalizeKey(label);
    if (!key) return;
    const existing = familyMap.get(key);
    if (existing) {
      existing.productCount += increment;
      if (!existing.synonyms.includes(label) && existing.label !== label) {
        existing.synonyms.push(label);
      }
    } else {
      familyMap.set(key, {
        key,
        label,
        synonyms: [],
        productCount: increment,
        source,
      });
    }
  }

  // 1) categorias raiz/imediatas como famílias candidatas
  if (categoriesRes.status === "fulfilled" && categoriesRes.value.data) {
    const cats = categoriesRes.value.data as Array<{ name: string; parent_id: string | null }>;
    const roots = cats.filter((c) => !c.parent_id);
    const useList = roots.length > 0 ? roots : cats;
    for (const c of useList) upsertFamily(c.name, "categories", 1);
  }

  // 2) product_type — contagem real por tipo
  if (productTypesRes.status === "fulfilled" && productTypesRes.value.data) {
    const rows = productTypesRes.value.data as Array<{ product_type: string | null }>;
    for (const r of rows) {
      if (r.product_type) upsertFamily(r.product_type, "product_type", 1);
    }
  }

  // 3) dicionário de linguagem do tenant
  let forbiddenTerms: string[] = [];
  let preferredPhrases: Record<string, string> = {};
  let productAliases: Record<string, string> = {};
  if (dictRes.status === "fulfilled" && dictRes.value.data) {
    const d = dictRes.value.data as {
      niche_vocabulary?: Record<string, string> | null;
      product_aliases?: Record<string, string> | null;
      preferred_phrases?: Record<string, string> | null;
      forbidden_terms?: string[] | null;
    };
    forbiddenTerms = Array.isArray(d.forbidden_terms) ? d.forbidden_terms.filter(Boolean) : [];
    preferredPhrases = (d.preferred_phrases as Record<string, string>) ?? {};
    productAliases = (d.product_aliases as Record<string, string>) ?? {};
    // niche_vocabulary: se contiver chaves que pareçam famílias, registramos.
    const niche = (d.niche_vocabulary as Record<string, string>) ?? {};
    for (const [term, _meaning] of Object.entries(niche)) {
      // só promove a "família" se aparecer de forma simples (1-2 palavras curtas).
      if (term && term.length < 32 && term.split(" ").length <= 2) {
        upsertFamily(term, "language_dictionary", 0);
      }
    }
  }

  // 4) snapshot do contexto comercial — segmento/audiência/dores
  let segment: string | null = null;
  let audience: string | null = null;
  const painPoints: TenantPainPoint[] = [];
  if (snapshotRes.status === "fulfilled" && snapshotRes.value.data) {
    const s = snapshotRes.value.data as {
      inferred_tree?: {
        segment?: { value?: string | null };
        audience?: { value?: string | null };
        macro_categories?: Array<{ name: string; product_count?: number }>;
        pain_points?: Array<{ name: string; synonyms?: string[] }>;
      } | null;
      segment_label?: string | null;
      audience_label?: string | null;
    };
    segment = s.segment_label ?? s.inferred_tree?.segment?.value ?? null;
    audience = s.audience_label ?? s.inferred_tree?.audience?.value ?? null;
    const macros = s.inferred_tree?.macro_categories ?? [];
    for (const m of macros) {
      if (m?.name) upsertFamily(m.name, "business_context", m.product_count ?? 0);
    }
    const pains = s.inferred_tree?.pain_points ?? [];
    for (const p of pains) {
      if (p?.name) {
        painPoints.push({
          name: p.name,
          synonyms: Array.isArray(p.synonyms) ? p.synonyms.filter(Boolean) : [],
          source: "business_context",
        });
      }
    }
  }

  // Ordena famílias por quem tem mais produtos (mais relevante primeiro)
  const families = [...familyMap.values()].sort((a, b) => b.productCount - a.productCount);

  const vocab: TenantVocabulary = {
    tenantId,
    segment,
    audience,
    families,
    painPoints,
    forbiddenTerms,
    preferredPhrases,
    productAliases,
    loadedAt: Date.now(),
  };

  CACHE.set(tenantId, vocab);
  return vocab;
}

/** Helper: devolve um Set normalizado de tokens (família + sinônimos + aliases)
 *  útil para detectores universais. */
export function buildFamilyTokenSet(vocab: TenantVocabulary | null): Map<string, string> {
  const map = new Map<string, string>(); // tokenNormalized -> familyKey
  if (!vocab) return map;
  for (const fam of vocab.families) {
    map.set(normalizeKey(fam.label), fam.key);
    for (const syn of fam.synonyms) {
      const k = normalizeKey(syn);
      if (k) map.set(k, fam.key);
    }
  }
  return map;
}

export { normalizeKey as normalizeVocabularyKey };
