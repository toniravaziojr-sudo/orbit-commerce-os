// ============================================================
// Onda 1C — Product AI Vision Reader
//
// Lê, de forma tenant-scoped e sem N+1, os 3 datasets que compõem
// a "Visão da IA" do produto (entregue na Onda 1B):
//
//   1. ai_product_commercial_payload  (papel comercial, base, when_to_*)
//   2. ai_product_relations           (complement / upsell / cross_sell / related_base)
//   3. product_components             (composição REAL de kits/combos)
//
// Contrato:
//   - SEMPRE filtra por tenant_id recebido do pipeline (defesa em profundidade
//     mesmo com RLS habilitada). NUNCA confia em IDs vindos do cliente.
//   - Funções puras de leitura. Não escreve.
//   - Não chama LLM, não chama RAG.
//   - Pode ser usada em dry_run sem efeito colateral.
//
// Esta camada é consumida pelo Product Recommendation Context Builder.
// ============================================================

export type CommercialRole =
  | "primary" | "complement" | "upgrade" | "kit_component"
  | "accessory" | "consumable";

export type ProductKind =
  | "single" | "kit" | "combo" | "pack" | "bundle"
  | "upgrade" | "complement" | "replacement";

export type RelationType = "complement" | "related_base" | "upsell" | "cross_sell";

export interface AIVisionPayloadRow {
  product_id: string;
  commercial_role: CommercialRole | null;
  product_kind: ProductKind | null;
  base_product_id: string | null;
  is_base_candidate: boolean | null; // NULL = não classificado
  when_to_recommend: string | null;
  when_not_to_indicate: string | null;
  recommendation_notes: string | null;
}

export interface AIVisionRelationRow {
  source_product_id: string;
  target_product_id: string;
  relation_type: RelationType;
  position: number;
}

export interface AIVisionComponentRow {
  parent_product_id: string;
  component_product_id: string;
  quantity: number | null;
}

export interface ProductAIVisionBundle {
  payloadByProductId: Map<string, AIVisionPayloadRow>;
  relationsBySourceId: Map<string, AIVisionRelationRow[]>;
  componentsByParentId: Map<string, AIVisionComponentRow[]>;
  /** IDs sem linha em ai_product_commercial_payload (para warning "unclassified_product"). */
  unclassifiedProductIds: string[];
}

export interface ReaderOptions {
  /** Cliente Supabase (service_role). Tipado como any p/ não acoplar. */
  supabase: any;
  /** Tenant atual — nunca vem do cliente. */
  tenantId: string;
  /** Conjunto de produtos a inspecionar (do pool já enriquecido). */
  productIds: string[];
}

/**
 * Carrega payloads + relations + components em até 3 SELECTs batched
 * (sem N+1). Tudo tenant-scoped. Resiliente: erro em um dataset não
 * derruba os outros — devolve mapas vazios e segue o jogo.
 */
export async function loadProductAIVision(
  opts: ReaderOptions
): Promise<ProductAIVisionBundle> {
  const { supabase, tenantId, productIds } = opts;
  const ids = Array.from(new Set((productIds || []).filter(Boolean)));

  const empty: ProductAIVisionBundle = {
    payloadByProductId: new Map(),
    relationsBySourceId: new Map(),
    componentsByParentId: new Map(),
    unclassifiedProductIds: [],
  };
  if (!tenantId || ids.length === 0) return empty;

  const [payloadRes, relationsRes, componentsRes] = await Promise.all([
    supabase
      .from("ai_product_commercial_payload")
      .select(
        "product_id, commercial_role, product_kind, base_product_id, is_base_candidate, when_to_recommend, when_not_to_indicate, recommendation_notes, tenant_id"
      )
      .eq("tenant_id", tenantId)
      .in("product_id", ids),
    supabase
      .from("ai_product_relations")
      .select("source_product_id, target_product_id, relation_type, position, tenant_id")
      .eq("tenant_id", tenantId)
      .in("source_product_id", ids),
    supabase
      .from("product_components")
      .select("parent_product_id, component_product_id, quantity")
      .in("parent_product_id", ids),
  ]);

  const payloadByProductId = new Map<string, AIVisionPayloadRow>();
  const seen = new Set<string>();
  for (const r of (payloadRes?.data ?? []) as any[]) {
    // Defesa em profundidade contra cross-tenant.
    if (r.tenant_id && r.tenant_id !== tenantId) continue;
    const row: AIVisionPayloadRow = {
      product_id: r.product_id,
      commercial_role: r.commercial_role ?? null,
      product_kind: r.product_kind ?? null,
      base_product_id: r.base_product_id ?? null,
      is_base_candidate: r.is_base_candidate, // pode ser null
      when_to_recommend: r.when_to_recommend ?? null,
      when_not_to_indicate: r.when_not_to_indicate ?? null,
      recommendation_notes: r.recommendation_notes ?? null,
    };
    payloadByProductId.set(row.product_id, row);
    seen.add(row.product_id);
  }

  const relationsBySourceId = new Map<string, AIVisionRelationRow[]>();
  for (const r of (relationsRes?.data ?? []) as any[]) {
    if (r.tenant_id && r.tenant_id !== tenantId) continue;
    const arr = relationsBySourceId.get(r.source_product_id) ?? [];
    arr.push({
      source_product_id: r.source_product_id,
      target_product_id: r.target_product_id,
      relation_type: r.relation_type,
      position: typeof r.position === "number" ? r.position : 0,
    });
    relationsBySourceId.set(r.source_product_id, arr);
  }
  // Ordena por position dentro de cada source.
  for (const [k, v] of relationsBySourceId) {
    v.sort((a, b) => a.position - b.position);
    relationsBySourceId.set(k, v);
  }

  const componentsByParentId = new Map<string, AIVisionComponentRow[]>();
  for (const r of (componentsRes?.data ?? []) as any[]) {
    const arr = componentsByParentId.get(r.parent_product_id) ?? [];
    arr.push({
      parent_product_id: r.parent_product_id,
      component_product_id: r.component_product_id,
      quantity: r.quantity ?? null,
    });
    componentsByParentId.set(r.parent_product_id, arr);
  }

  const unclassifiedProductIds = ids.filter(id => !seen.has(id));

  return {
    payloadByProductId,
    relationsBySourceId,
    componentsByParentId,
    unclassifiedProductIds,
  };
}
