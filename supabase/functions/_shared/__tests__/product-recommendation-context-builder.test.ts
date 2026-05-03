// Onda 1C — Testes A–J do ProductRecommendationContextBuilder.
// Cobertura: regras de base/pack/kit/complement, NULL legacy,
// pedido explícito, performance, snapshot dry_run.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildRecommendationContext,
  detectKitIntent,
} from "../product-recommendation-context-builder.ts";
import type {
  ProductAIVisionBundle,
  AIVisionPayloadRow,
  AIVisionRelationRow,
  AIVisionComponentRow,
} from "../product-ai-vision-reader.ts";
import { loadProductAIVision } from "../product-ai-vision-reader.ts";

// -------- helpers --------
function payload(over: Partial<AIVisionPayloadRow> & { product_id: string }): AIVisionPayloadRow {
  return {
    product_id: over.product_id,
    commercial_role: over.commercial_role ?? null,
    product_kind: over.product_kind ?? null,
    base_product_id: over.base_product_id ?? null,
    is_base_candidate: over.is_base_candidate ?? null,
    when_to_recommend: over.when_to_recommend ?? null,
    when_not_to_indicate: over.when_not_to_indicate ?? null,
    recommendation_notes: over.recommendation_notes ?? null,
  };
}

function makeVision(opts: {
  payloads?: AIVisionPayloadRow[];
  relations?: AIVisionRelationRow[];
  components?: AIVisionComponentRow[];
  unclassified?: string[];
}): ProductAIVisionBundle {
  const v: ProductAIVisionBundle = {
    payloadByProductId: new Map(),
    relationsBySourceId: new Map(),
    componentsByParentId: new Map(),
    unclassifiedProductIds: opts.unclassified ?? [],
  };
  for (const p of opts.payloads ?? []) v.payloadByProductId.set(p.product_id, p);
  for (const r of opts.relations ?? []) {
    const arr = v.relationsBySourceId.get(r.source_product_id) ?? [];
    arr.push(r);
    v.relationsBySourceId.set(r.source_product_id, arr);
  }
  for (const c of opts.components ?? []) {
    const arr = v.componentsByParentId.get(c.parent_product_id) ?? [];
    arr.push(c);
    v.componentsByParentId.set(c.parent_product_id, arr);
  }
  return v;
}

// -------- fixtures Respeite o Homem (mock) --------
const SHAMPOO = { id: "shampoo-1", name: "Shampoo Calvície Zero", price: 79, is_kit: false, match_reason: "pain_match" };
const BALM    = { id: "balm-1",    name: "Balm Pós-Banho Calvície Zero", price: 99, is_kit: false, match_reason: "pain_match" };
const BALM_2X = { id: "balm-2x",   name: "Balm Calvície Zero (2x)", price: 180, is_kit: true,  match_reason: "name_match" };
const BALM_3X = { id: "balm-3x",   name: "Balm Calvície Zero (3x)", price: 250, is_kit: true,  match_reason: "name_match" };
const BALM_6X = { id: "balm-6x",   name: "Balm Calvície Zero (6x)", price: 480, is_kit: true,  match_reason: "name_match" };
const LOCAO   = { id: "locao-1",   name: "Loção Noite Calvície Zero", price: 120, is_kit: false, match_reason: "pain_match" };
const KIT     = { id: "kit-banho", name: "Kit Banho Calvície Zero", price: 280, is_kit: true,  match_reason: "pain_match" };

const visionRespeite = makeVision({
  payloads: [
    payload({ product_id: SHAMPOO.id, is_base_candidate: true,  product_kind: "single", when_to_recommend: "Cliente fala de calvície/queda/falhas." }),
    payload({ product_id: BALM.id,    is_base_candidate: true,  product_kind: "single" }),
    payload({ product_id: LOCAO.id,   is_base_candidate: true,  product_kind: "single" }),
    payload({ product_id: BALM_2X.id, is_base_candidate: false, product_kind: "pack", base_product_id: BALM.id }),
    payload({ product_id: BALM_3X.id, is_base_candidate: false, product_kind: "pack", base_product_id: BALM.id }),
    payload({ product_id: BALM_6X.id, is_base_candidate: false, product_kind: "pack", base_product_id: BALM.id }),
    payload({ product_id: KIT.id,     is_base_candidate: false, product_kind: "kit" }),
  ],
  relations: [
    { source_product_id: SHAMPOO.id, target_product_id: BALM.id,    relation_type: "complement", position: 1 },
    { source_product_id: SHAMPOO.id, target_product_id: LOCAO.id,   relation_type: "complement", position: 2 },
    { source_product_id: BALM.id,    target_product_id: SHAMPOO.id, relation_type: "complement", position: 1 },
    { source_product_id: BALM.id,    target_product_id: LOCAO.id,   relation_type: "complement", position: 2 },
  ],
  components: [
    { parent_product_id: KIT.id, component_product_id: SHAMPOO.id, quantity: 1 },
    { parent_product_id: KIT.id, component_product_id: BALM.id,    quantity: 1 },
    { parent_product_id: KIT.id, component_product_id: LOCAO.id,   quantity: 1 },
    // Packs Nx do mesmo Balm — 1 component (qty>1)
    { parent_product_id: BALM_2X.id, component_product_id: BALM.id, quantity: 2 },
    { parent_product_id: BALM_3X.id, component_product_id: BALM.id, quantity: 3 },
    { parent_product_id: BALM_6X.id, component_product_id: BALM.id, quantity: 6 },
  ],
});

// =================================================================
// Teste A — shampoo/calvície: bases primeiro, packs agrupados, kit secundário
// =================================================================
Deno.test("A — shampoo/calvície: bases primeiro, packs agrupados sob base, kit secundário", () => {
  const out = buildRecommendationContext({
    enriched: [BALM_2X, SHAMPOO, KIT, BALM_6X, BALM, LOCAO, BALM_3X],
    vision: visionRespeite,
    userText: "tenho entradas e falhas na coroa, esse shampoo serve?",
  });
  assertEquals(out.applied, true);
  assertEquals(out.kit_intent, false);
  // Bases: shampoo, balm, locao (até MAX 3)
  assertEquals(out.bases.map(b => b.product_id), [SHAMPOO.id, BALM.id, LOCAO.id]);
  // Packs: agrupados sob balm-1; 6x e 3x (top 2 por pack_size desc)
  assertEquals(Object.keys(out.packs_by_base), [BALM.id]);
  assertEquals(out.packs_by_base[BALM.id].map(p => p.product_id), [BALM_6X.id, BALM_3X.id]);
  // BALM_2X cortado
  assert(out.hidden.some(h => h.product_id === BALM_2X.id && h.reason === "pack_capped"));
  // Kit como secondary_option
  assertEquals(out.kits.length, 1);
  assertEquals(out.kits[0].product_id, KIT.id);
  assertEquals(out.kits[0].reason, "secondary_option");
  // Complementares vindos das relações da base shampoo
  assert(out.complements.length >= 1);
});

// =================================================================
// Teste B — "tem kit completo?": kit como primário, composição via product_components
// =================================================================
Deno.test("B — 'tem kit completo?' marca kit_intent e expõe composição via product_components", () => {
  const out = buildRecommendationContext({
    enriched: [SHAMPOO, KIT, BALM, LOCAO],
    vision: visionRespeite,
    userText: "tem kit completo pra calvície?",
  });
  assertEquals(out.kit_intent, true);
  assertEquals(out.kits.length, 1);
  assertEquals(out.kits[0].reason, "kit_intent");
  // Composição vem de product_components
  assertEquals(
    [...out.kits[0].component_product_ids].sort(),
    [SHAMPOO.id, BALM.id, LOCAO.id].sort()
  );
});

// =================================================================
// Teste C — "tem 2 unidades?": packs aparecem agrupados como quantidade/economia
// =================================================================
Deno.test("C — packs aparecem agrupados sob a base como quantity_economy", () => {
  const out = buildRecommendationContext({
    enriched: [BALM, BALM_2X, BALM_3X],
    vision: visionRespeite,
    userText: "tem 2 unidades do balm?",
  });
  assert(out.bases.some(b => b.product_id === BALM.id));
  assertEquals(out.packs_by_base[BALM.id].length, 2);
  for (const p of out.packs_by_base[BALM.id]) {
    assertEquals(p.base_product_id, BALM.id);
    // Sem explicit_request, são quantity_economy
    assertEquals(p.reason, "quantity_economy");
  }
});

// =================================================================
// Teste D — "tratamento completo": Shampoo + Balm + Loção + Kit com papéis corretos
// =================================================================
Deno.test("D — 'tratamento completo': bases + kit como kit_intent, sem ocultar Balm/Loção", () => {
  const out = buildRecommendationContext({
    enriched: [SHAMPOO, BALM, LOCAO, KIT],
    vision: visionRespeite,
    userText: "qual tratamento completo pra calvície?",
  });
  assertEquals(out.bases.map(b => b.product_id), [SHAMPOO.id, BALM.id, LOCAO.id]);
  assertEquals(out.kits[0].product_id, KIT.id);
  assertEquals(out.kits[0].reason, "kit_intent");
  // Nenhum produto-base deve estar em hidden.
  for (const id of [SHAMPOO.id, BALM.id, LOCAO.id]) {
    assert(!out.hidden.some(h => h.product_id === id));
  }
});

// =================================================================
// Teste E — performance: ≤8 produtos no payload, builder rápido, sem LLM
// =================================================================
Deno.test("E — performance: payload proposto ≤ 8 e builder síncrono <50ms", () => {
  const t0 = performance.now();
  const out = buildRecommendationContext({
    enriched: [BALM_2X, SHAMPOO, KIT, BALM_6X, BALM, LOCAO, BALM_3X],
    vision: visionRespeite,
    userText: "shampoo pra calvície",
  });
  const dt = performance.now() - t0;
  assert(dt < 50, `builder demorou ${dt.toFixed(2)}ms (>50ms)`);
  assert(out.proposed_payload_count <= 8, `payload ${out.proposed_payload_count} > 8`);
});

// =================================================================
// Teste F — multi-tenant: reader nunca devolve produto/relação de outro tenant
// =================================================================
Deno.test("F — reader filtra tenant_id e ignora linhas de outro tenant", async () => {
  const supabaseStub = {
    from(table: string) {
      const data: Record<string, any[]> = {
        ai_product_commercial_payload: [
          { product_id: "p1", tenant_id: "T_OK", commercial_role: "primary", product_kind: "single", base_product_id: null, is_base_candidate: true, when_to_recommend: null, when_not_to_indicate: null, recommendation_notes: null },
          // Defesa em profundidade: simula linha indevida
          { product_id: "p2", tenant_id: "T_BAD", commercial_role: "primary", product_kind: "single", base_product_id: null, is_base_candidate: true, when_to_recommend: null, when_not_to_indicate: null, recommendation_notes: null },
        ],
        ai_product_relations: [
          { source_product_id: "p1", target_product_id: "p3", relation_type: "complement", position: 1, tenant_id: "T_OK" },
          { source_product_id: "p1", target_product_id: "p4", relation_type: "complement", position: 2, tenant_id: "T_BAD" },
        ],
        product_components: [],
      };
      const builder: any = {
        _table: table,
        _filters: { tenant: null as string | null, ids: null as string[] | null },
        select() { return builder; },
        eq(col: string, val: any) { if (col === "tenant_id") builder._filters.tenant = val; return builder; },
        in(_col: string, vals: any[]) { builder._filters.ids = vals; return builder; },
        then(resolve: any) {
          let rows = data[table] || [];
          if (builder._filters.tenant && rows[0] && "tenant_id" in rows[0]) {
            rows = rows.filter(r => r.tenant_id === builder._filters.tenant);
          }
          if (builder._filters.ids) {
            const idCol = table === "ai_product_relations" ? "source_product_id"
              : table === "product_components" ? "parent_product_id"
              : "product_id";
            rows = rows.filter(r => builder._filters.ids!.includes(r[idCol]));
          }
          resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
  };
  const v = await loadProductAIVision({ supabase: supabaseStub, tenantId: "T_OK", productIds: ["p1", "p2"] });
  // Reader já filtra via .eq tenant; defesa em profundidade interna também valida
  assertEquals(v.payloadByProductId.has("p1"), true);
  assertEquals(v.payloadByProductId.has("p2"), false);
  assertEquals((v.relationsBySourceId.get("p1") || []).length, 1);
});

// =================================================================
// Teste G — flag false: caller não chama builder; output efetivo do Catalog Probe permanece igual
// (este teste documenta o contrato; a integração no ai-support-chat fica sob `if (arch1cOn)`)
// =================================================================
Deno.test("G — contrato dry_run: builder não muta input, é função pura", () => {
  const enriched = [SHAMPOO, BALM_2X, KIT];
  const before = JSON.stringify(enriched);
  buildRecommendationContext({ enriched, vision: visionRespeite, userText: "shampoo" });
  assertEquals(JSON.stringify(enriched), before, "builder não pode mutar o pool");
});

// =================================================================
// Teste H — dry_run: snapshot do output (apenas trace, caller não aplica)
// =================================================================
Deno.test("H — dry_run snapshot: output do builder é determinístico p/ trace", () => {
  const out = buildRecommendationContext({
    enriched: [SHAMPOO, BALM, LOCAO, BALM_2X, BALM_3X, BALM_6X, KIT],
    vision: visionRespeite,
    userText: "tenho entradas, esse shampoo serve?",
  });
  assertEquals(out.applied, true);
  assertEquals(out.bases.map(b => b.reason), ["base_candidate", "base_candidate", "base_candidate"]);
  assertEquals(out.packs_by_base[BALM.id].map(p => p.product_id), [BALM_6X.id, BALM_3X.id]);
  assertEquals(out.kits[0].product_id, KIT.id);
});

// =================================================================
// Teste I — is_base_candidate NULL: produto não é rebaixado, warning é registrado
// =================================================================
Deno.test("I — NULL legacy entra como unclassified_legacy com warning", () => {
  const visionPartial = makeVision({
    payloads: [
      payload({ product_id: "p1", is_base_candidate: null }), // NULL explícito
    ],
    unclassified: ["p2"], // sem linha em payload
  });
  const out = buildRecommendationContext({
    enriched: [
      { id: "p1", name: "Produto sem classificação 1" },
      { id: "p2", name: "Produto sem classificação 2" },
    ],
    vision: visionPartial,
    userText: "qual produto vocês têm?",
  });
  // Ambos devem aparecer como bases legacy (não rebaixados)
  assertEquals(out.bases.length, 2);
  assertEquals(out.bases.every(b => b.reason === "unclassified_legacy"), true);
  // Warnings registrados
  const warnIds = out.warnings.map(w => w.product_id).sort();
  assertEquals(warnIds, ["p1", "p2"]);
  for (const w of out.warnings) assertEquals(w.warning, "unclassified_product");
});

// =================================================================
// Teste J — pedido explícito: pack/kit pedido nominalmente NÃO é ocultado
// =================================================================
Deno.test("J — pedido explícito de pack/kit não é ocultado e vai p/ topo", () => {
  const out = buildRecommendationContext({
    enriched: [BALM_2X, SHAMPOO, BALM, LOCAO, KIT],
    vision: visionRespeite,
    userText: "tem balm 2x?",
    explicitRequestProductIds: [BALM_2X.id],
  });
  // Pack pedido nominalmente entra como base no topo (explicit_request)
  assertEquals(out.bases[0].product_id, BALM_2X.id);
  assertEquals(out.bases[0].reason, "explicit_request");
  // E também aparece com reason explicit_request na lista de packs sob a base
  const balmPacks = out.packs_by_base[BALM.id] || [];
  assert(balmPacks.some(p => p.product_id === BALM_2X.id && p.reason === "explicit_request"));
  // Não está em hidden
  assert(!out.hidden.some(h => h.product_id === BALM_2X.id));
});

// =================================================================
// Bônus — detectKitIntent
// =================================================================
Deno.test("detectKitIntent — detecta 'kit', 'combo', 'completo', 'economia'", () => {
  assertEquals(detectKitIntent("quero o kit"), true);
  assertEquals(detectKitIntent("tem combo?"), true);
  assertEquals(detectKitIntent("qual o tratamento completo"), true);
  assertEquals(detectKitIntent("alguma opção de economia?"), true);
  assertEquals(detectKitIntent("tem shampoo?"), false);
});
