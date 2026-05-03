// ============================================================
// Onda 1C — Product Recommendation Context Builder
//
// Aplica regras DETERMINÍSTICAS sobre um pool de produtos já enriquecido,
// usando a "Visão da IA" carregada pelo ProductAIVisionReader.
//
// Esta função NÃO consulta banco e NÃO altera nenhum payload externo.
// Apenas devolve um objeto descritivo que o caller pode:
//   - logar em dry_run (Onda 1C — entrega atual);
//   - aplicar de fato em onda futura (active).
//
// REGRAS (alinhadas com o plano aprovado da Onda 1C):
//
//   A) Recomendação genérica/dor:
//      - bases: apenas produtos com is_base_candidate === true.
//      - packs: agrupados sob seu base_product_id, NUNCA substituem a base.
//      - kits:  classificados como "complementary" via product_components
//               (≥2 components distintos). Kits só viram primários quando a
//               intenção é kit/completo/combo (kitIntent === true).
//      - complements: ai_product_relations (complement|cross_sell|upsell).
//
//   B) is_base_candidate === null: comportamento LEGADO. NÃO rebaixa
//      agressivamente — produto entra como "candidate" com warning
//      `unclassified_product`. Em tenants sem Visão da IA completa, o
//      builder não quebra a recomendação (devolve `applied=false`).
//
//   C) Pedido explícito (explicitRequestProductIds): produto pedido
//      nominalmente entra no topo como `explicit_request` e NÃO é
//      escondido por ser pack/kit.
//
// Limites de payload proposto (proteção de contexto LLM):
//   - até 3 bases
//   - até 2 packs por base (o mais barato + o de maior pack_size)
//   - até 1 kit
//   - até 3 complementares
// ============================================================

import type {
  ProductAIVisionBundle,
  AIVisionPayloadRow,
} from "./product-ai-vision-reader.ts";

export interface BuilderProductInput {
  id: string;
  name: string;
  price?: number | null;
  is_kit?: boolean;
  match_reason?: string;
  /** Quando o caller já souber pack_size por nome ou product_components, repassa. */
  pack_size?: number | null;
}

export interface ProposedBase {
  product_id: string;
  reason: "base_candidate" | "explicit_request" | "unclassified_legacy";
  notes: string[];
}

export interface ProposedPack {
  product_id: string;
  base_product_id: string;
  pack_size: number | null;
  reason: "quantity_economy" | "explicit_request";
}

export interface ProposedKit {
  product_id: string;
  component_product_ids: string[];
  reason: "kit_intent" | "explicit_request" | "secondary_option";
}

export interface ProposedComplement {
  source_product_id: string;
  target_product_id: string;
  relation_type: "complement" | "cross_sell" | "upsell";
}

export interface RecommendationContext {
  /** true quando o builder aplicou alguma reordenação útil. */
  applied: boolean;
  /** Razão sumarizada (para trace). */
  reason: string;
  /** Se kitIntent foi detectado. */
  kit_intent: boolean;
  /** IDs preservados por pedido explícito do cliente. */
  explicit_request_ids: string[];
  bases: ProposedBase[];
  /** Indexado por base_product_id → packs sob aquela base. */
  packs_by_base: Record<string, ProposedPack[]>;
  kits: ProposedKit[];
  complements: ProposedComplement[];
  /** Itens que seriam escondidos/depriorizados na vitrine inicial. */
  hidden: Array<{ product_id: string; reason: string }>;
  warnings: Array<{ product_id: string; warning: string }>;
  /** Total de produtos no payload proposto (para gate de performance). */
  proposed_payload_count: number;
}

const MAX_BASES = 3;
const MAX_PACKS_PER_BASE = 2;
const MAX_KITS = 1;
const MAX_COMPLEMENTS = 3;

const KIT_INTENT_RE = /\b(kit|combo|completo|tratamento\s+completo|economia)\b/i;

export function detectKitIntent(text: string | null | undefined): boolean {
  if (!text) return false;
  return KIT_INTENT_RE.test(String(text));
}

export interface BuilderInput {
  /** Pool já enriquecido vindo do search_products. */
  enriched: BuilderProductInput[];
  /** Visão IA carregada pelo Reader (tenant-scoped). */
  vision: ProductAIVisionBundle;
  /** Texto livre do turno (para detectar kitIntent). */
  userText?: string | null;
  /** Família detectada (informativo, builder não filtra por família — quem filtra é o Catalog Probe). */
  familyDetected?: string | null;
  /** IDs explicitamente pedidos pelo cliente (resolvidos por nome/SKU/slug pelo caller). */
  explicitRequestProductIds?: string[];
}

export function buildRecommendationContext(input: BuilderInput): RecommendationContext {
  const {
    enriched,
    vision,
    userText,
    explicitRequestProductIds = [],
  } = input;

  const ctx: RecommendationContext = {
    applied: false,
    reason: "no_pool",
    kit_intent: detectKitIntent(userText),
    explicit_request_ids: [],
    bases: [],
    packs_by_base: {},
    kits: [],
    complements: [],
    hidden: [],
    warnings: [],
    proposed_payload_count: 0,
  };

  if (!enriched || enriched.length === 0) return ctx;

  const explicitSet = new Set(
    (explicitRequestProductIds || []).filter(Boolean)
  );

  // Index payloads
  const payload = (id: string): AIVisionPayloadRow | undefined =>
    vision.payloadByProductId.get(id);

  // Marca unclassified
  for (const id of vision.unclassifiedProductIds || []) {
    ctx.warnings.push({ product_id: id, warning: "unclassified_product" });
  }

  // ---------- Particiona ----------
  // bases reais (is_base_candidate === true)
  // packs (kind=pack OU is_base_candidate === false COM base_product_id)
  // kits (componentes em product_components)
  // legacy (is_base_candidate === null e não pack/kit)
  const baseCandidates: BuilderProductInput[] = [];
  const packsByBase = new Map<string, BuilderProductInput[]>();
  const kitItems: BuilderProductInput[] = [];
  const legacyCandidates: BuilderProductInput[] = [];
  const explicitItems: BuilderProductInput[] = [];

  for (const item of enriched) {
    if (explicitSet.has(item.id)) {
      explicitItems.push(item);
      // explicit não exclui das demais classificações
    }

    const p = payload(item.id);
    const components = vision.componentsByParentId.get(item.id) ?? [];
    const distinctComponents = new Set(components.map(c => c.component_product_id));
    const isKitByComponents = distinctComponents.size >= 2;

    // Kit "complementar" (composição multi-component) tem prioridade na classificação.
    if (isKitByComponents || p?.product_kind === "kit" || p?.product_kind === "combo") {
      kitItems.push(item);
      continue;
    }

    // Pack: explicitamente pack/bundle ou base_product_id apontando p/ outro produto
    const isPack =
      p?.product_kind === "pack" ||
      p?.product_kind === "bundle" ||
      (p?.is_base_candidate === false && !!p?.base_product_id);
    if (isPack && p?.base_product_id) {
      const arr = packsByBase.get(p.base_product_id) ?? [];
      arr.push(item);
      packsByBase.set(p.base_product_id, arr);
      continue;
    }

    // Base candidate explícita
    if (p?.is_base_candidate === true) {
      baseCandidates.push(item);
      continue;
    }

    // Legado / não classificado: NULL ou sem payload.
    if (!p || p.is_base_candidate === null || p.is_base_candidate === undefined) {
      // Não rebaixa agressivamente. Vai pra legacy.
      if (!p) {
        // Já marcado como warning lá em cima via unclassifiedProductIds.
      } else {
        ctx.warnings.push({ product_id: item.id, warning: "unclassified_product" });
      }
      legacyCandidates.push(item);
      continue;
    }

    // is_base_candidate === false e SEM base_product_id: pack órfão.
    // Não vira base, fica escondido com motivo claro.
    ctx.hidden.push({ product_id: item.id, reason: "non_base_without_parent" });
  }

  // ---------- Decide bases ----------
  // Pedido explícito SEMPRE no topo, deduplicado, mantendo ordem do pool.
  const baseOrdered: ProposedBase[] = [];
  const usedAsBase = new Set<string>();

  for (const it of explicitItems) {
    // Explicit request: pode ser base, pack ou kit. Aqui só registramos os que
    // o caller deve tratar como "topo da vitrine"; classificamos abaixo nas
    // listas específicas também.
    if (!usedAsBase.has(it.id)) {
      baseOrdered.push({
        product_id: it.id,
        reason: "explicit_request",
        notes: collectNotes(payload(it.id)),
      });
      usedAsBase.add(it.id);
    }
  }
  ctx.explicit_request_ids = Array.from(explicitSet);

  for (const it of baseCandidates) {
    if (usedAsBase.has(it.id)) continue;
    if (baseOrdered.length >= MAX_BASES) break;
    baseOrdered.push({
      product_id: it.id,
      reason: "base_candidate",
      notes: collectNotes(payload(it.id)),
    });
    usedAsBase.add(it.id);
  }

  // Se ainda há espaço e existem itens legados, oferecer com reason legacy
  // (não rebaixar agressivamente quando tenant não tem Visão IA completa).
  if (baseOrdered.length < MAX_BASES) {
    for (const it of legacyCandidates) {
      if (usedAsBase.has(it.id)) continue;
      if (baseOrdered.length >= MAX_BASES) break;
      baseOrdered.push({
        product_id: it.id,
        reason: "unclassified_legacy",
        notes: [],
      });
      usedAsBase.add(it.id);
    }
  }

  // ---------- Decide packs (sob base) ----------
  const packsOut: Record<string, ProposedPack[]> = {};
  for (const [baseId, packs] of packsByBase.entries()) {
    // Ordena: explicit primeiro, depois maior pack_size, depois menor preço.
    const sorted = [...packs].sort((a, b) => {
      const aExp = explicitSet.has(a.id) ? 1 : 0;
      const bExp = explicitSet.has(b.id) ? 1 : 0;
      if (aExp !== bExp) return bExp - aExp;
      const aSize = a.pack_size ?? inferPackSize(a.name);
      const bSize = b.pack_size ?? inferPackSize(b.name);
      if ((bSize ?? 0) !== (aSize ?? 0)) return (bSize ?? 0) - (aSize ?? 0);
      const aP = a.price ?? Number.POSITIVE_INFINITY;
      const bP = b.price ?? Number.POSITIVE_INFINITY;
      return aP - bP;
    });
    const out: ProposedPack[] = [];
    for (const it of sorted) {
      if (out.length >= MAX_PACKS_PER_BASE) break;
      out.push({
        product_id: it.id,
        base_product_id: baseId,
        pack_size: it.pack_size ?? inferPackSize(it.name),
        reason: explicitSet.has(it.id) ? "explicit_request" : "quantity_economy",
      });
    }
    if (out.length > 0) packsOut[baseId] = out;
    // Packs cortados além do limite vão p/ hidden.
    for (const it of sorted.slice(MAX_PACKS_PER_BASE)) {
      ctx.hidden.push({ product_id: it.id, reason: "pack_capped" });
    }
  }

  // Packs cuja base NÃO está na lista final de bases:
  // se cliente pediu explicit, mantém como explicit_request no topo (já está em baseOrdered).
  // se não, deixa hidden com reason `pack_orphan_in_pool`.
  for (const [baseId, packs] of packsByBase.entries()) {
    if (!baseOrdered.some(b => b.product_id === baseId)) {
      for (const it of packs) {
        if (explicitSet.has(it.id)) continue; // já tratado
        if (!ctx.hidden.some(h => h.product_id === it.id)) {
          ctx.hidden.push({ product_id: it.id, reason: "pack_orphan_in_pool" });
        }
      }
      // Remove packs órfãos do output (já entraram em hidden)
      delete packsOut[baseId];
    }
  }

  // ---------- Decide kits ----------
  const kitsOut: ProposedKit[] = [];
  // Ordena: explicit > kit_intent > resto
  const sortedKits = [...kitItems].sort((a, b) => {
    const aExp = explicitSet.has(a.id) ? 1 : 0;
    const bExp = explicitSet.has(b.id) ? 1 : 0;
    if (aExp !== bExp) return bExp - aExp;
    return 0;
  });
  for (const it of sortedKits) {
    if (kitsOut.length >= MAX_KITS) {
      ctx.hidden.push({ product_id: it.id, reason: "kit_capped" });
      continue;
    }
    const components = vision.componentsByParentId.get(it.id) ?? [];
    const componentIds = components.map(c => c.component_product_id);
    const reason: ProposedKit["reason"] = explicitSet.has(it.id)
      ? "explicit_request"
      : (ctx.kit_intent ? "kit_intent" : "secondary_option");
    kitsOut.push({
      product_id: it.id,
      component_product_ids: componentIds,
      reason,
    });
  }

  // ---------- Decide complementares ----------
  const complementsOut: ProposedComplement[] = [];
  const seenRelTarget = new Set<string>();
  // Itera apenas pelas bases finais — complementares de produtos não-recomendados
  // não fazem sentido no contexto inicial.
  for (const base of baseOrdered) {
    const rels = vision.relationsBySourceId.get(base.product_id) ?? [];
    for (const r of rels) {
      if (r.relation_type === "related_base") continue; // related_base é informativo, não vai pro contexto
      if (complementsOut.length >= MAX_COMPLEMENTS) break;
      if (seenRelTarget.has(r.target_product_id)) continue;
      seenRelTarget.add(r.target_product_id);
      complementsOut.push({
        source_product_id: r.source_product_id,
        target_product_id: r.target_product_id,
        relation_type: r.relation_type as ProposedComplement["relation_type"],
      });
    }
    if (complementsOut.length >= MAX_COMPLEMENTS) break;
  }

  // ---------- Resultado ----------
  ctx.bases = baseOrdered;
  ctx.packs_by_base = packsOut;
  ctx.kits = kitsOut;
  ctx.complements = complementsOut;

  const packCount = Object.values(packsOut).reduce((s, arr) => s + arr.length, 0);
  ctx.proposed_payload_count =
    baseOrdered.length + packCount + kitsOut.length + complementsOut.length;

  ctx.applied = baseOrdered.length > 0 || kitsOut.length > 0 || packCount > 0;
  ctx.reason = ctx.applied
    ? `built bases=${baseOrdered.length} packs=${packCount} kits=${kitsOut.length} complements=${complementsOut.length}${ctx.kit_intent ? " kit_intent" : ""}`
    : "no_classifiable_products";

  return ctx;
}

function collectNotes(p: AIVisionPayloadRow | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.when_to_recommend) out.push(`when_to_recommend: ${truncate(p.when_to_recommend, 200)}`);
  if (p.when_not_to_indicate) out.push(`when_not_to_indicate: ${truncate(p.when_not_to_indicate, 200)}`);
  if (p.recommendation_notes) out.push(`notes: ${truncate(p.recommendation_notes, 200)}`);
  return out.slice(0, 3);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function inferPackSize(name: string | null | undefined): number | null {
  const m = String(name || "").match(/\(?\s*(\d+)\s*x\s*\)?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 2 ? n : null;
}
