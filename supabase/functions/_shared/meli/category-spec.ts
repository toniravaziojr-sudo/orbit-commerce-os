// =============================================================
// _shared/meli/category-spec.ts — Onda B (Marketplace Adapter)
//
// Espelho persistente da ficha técnica da categoria do Mercado Livre.
// Substitui chamadas diretas a /categories/{id}/attributes em
// meli-resolve-attributes e meli-publish-listing.
//
// Estratégia:
//   1) Lê marketplace_category_specs (cache global, multi-tenant).
//   2) Se hit válido (expires_at > now), devolve sem chamar o ML.
//   3) Se miss/expirado, busca no ML, faz upsert (UNIQUE
//      marketplace+category_id) e devolve.
//
// IMPORTANTE:
//   - Cache é global por categoria (não por tenant). Token do tenant
//     é usado só para autenticar a chamada ao ML em caso de miss.
//   - TTL padrão = 7 dias (categorias do ML mudam raramente).
//   - Falhas de rede NÃO derrubam o fluxo: se existir cache vencido,
//     devolvemos o vencido com "stale=true" para o chamador decidir.
// =============================================================

const TTL_DAYS = 7;
const CACHE_VERSION = "v1";

export interface MeliAttrSpec {
  id: string;
  name: string;
  tags?: Record<string, boolean> | null;
  value_type?: string | null;
  values?: Array<{ id?: string | null; name?: string | null }> | null;
  allowed_units?: Array<{ id?: string | null; name?: string | null }> | null;
  [k: string]: unknown;
}

export interface CategorySpecResult {
  categoryId: string;
  attributes: MeliAttrSpec[];
  source: "cache" | "fresh" | "stale";
  fetchedAt: string;
}

interface SupabaseLike {
  from: (table: string) => any;
}

export async function getMeliCategorySpec(
  supabase: SupabaseLike,
  categoryId: string,
  accessToken: string,
): Promise<CategorySpecResult> {
  // 1) Tentar cache
  const { data: cached } = await supabase
    .from("marketplace_category_specs")
    .select("attributes, fetched_at, expires_at")
    .eq("marketplace", "mercado_livre")
    .eq("category_id", categoryId)
    .maybeSingle();

  const now = Date.now();
  if (cached && cached.expires_at && new Date(cached.expires_at).getTime() > now) {
    return {
      categoryId,
      attributes: (cached.attributes as MeliAttrSpec[]) ?? [],
      source: "cache",
      fetchedAt: cached.fetched_at,
    };
  }

  // 2) Buscar fresh do ML
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/categories/${categoryId}/attributes`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`ML ${res.status}`);
    const attributes = (await res.json()) as MeliAttrSpec[];

    const expires = new Date(now + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("marketplace_category_specs")
      .upsert(
        {
          marketplace: "mercado_livre",
          category_id: categoryId,
          attributes,
          source_version: CACHE_VERSION,
          fetched_at: new Date(now).toISOString(),
          expires_at: expires,
        },
        { onConflict: "marketplace,category_id" },
      );

    return {
      categoryId,
      attributes,
      source: "fresh",
      fetchedAt: new Date(now).toISOString(),
    };
  } catch (err) {
    // 3) Fallback: devolve cache vencido se existir
    if (cached?.attributes) {
      console.warn(`[category-spec] ML offline; servindo cache vencido de ${categoryId}: ${err}`);
      return {
        categoryId,
        attributes: cached.attributes as MeliAttrSpec[],
        source: "stale",
        fetchedAt: cached.fetched_at,
      };
    }
    throw err;
  }
}

/**
 * Atualiza category_name e category_path_text no espelho.
 * Chamado pelo bulk-operations quando hidrata o caminho da categoria.
 */
export async function updateMeliCategoryMeta(
  supabase: SupabaseLike,
  categoryId: string,
  meta: { category_name?: string | null; category_path_text?: string | null },
): Promise<void> {
  await supabase
    .from("marketplace_category_specs")
    .update({
      category_name: meta.category_name ?? null,
      category_path_text: meta.category_path_text ?? null,
    })
    .eq("marketplace", "mercado_livre")
    .eq("category_id", categoryId);
}
