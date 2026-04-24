/**
 * ai-business-snapshot-generator
 *
 * Sub-fase 1.2 do Plano Mestre v4 — Motor de inferência inicial.
 *
 * v2 (revisão pós-truncamento):
 *  - Payload enxuto enviado ao modelo (descrição curta, price_bucket em vez
 *    de preço bruto, sem stock, sem campos operacionais).
 *  - Lotes (chunking) por categoria/linha quando possível, com fallback por
 *    quantidade. Tamanho alvo: 10–15 produtos por lote.
 *  - max_tokens elevado como margem de segurança (não como solução principal).
 *  - Retry em modo reduzido se o JSON do tool_call vier inválido/truncado.
 *  - Nunca devolve success:true sem persistência real (snapshot upsert ok
 *    e ao menos um payload comercial persistido).
 *
 * Lê o catálogo de um tenant, decide entre modo `active` ou `neutral` e popula:
 *   - ai_business_snapshot      (Pacote A)
 *   - ai_context_tree           (Pacote B)
 *   - ai_product_pain_map       (Pacote C)
 *   - ai_product_commercial_payload (Pacote J + H)
 *
 * Universal: serve qualquer tenant, qualquer nicho.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

// Limites de inferência
const MIN_PRODUCTS_FOR_ACTIVE_MODE = 3;
const MIN_PRODUCTS_WITH_DESCRIPTION = 2;

// Lotes
const TARGET_BATCH_SIZE = 12;       // alvo 10–15
const MAX_BATCH_SIZE = 15;
const MIN_BATCH_SIZE = 8;

// Limites de payload
const DESC_MAX_CHARS = 280;          // descrição enxuta
const DESC_MAX_CHARS_REDUCED = 120;  // retry ainda mais enxuto

// Geração
const MAX_TOKENS_DEFAULT = 16000;
const MAX_TOKENS_REDUCED = 12000;

interface RequestBody {
  tenant_id: string;
  scope?: "full_snapshot" | "single_product" | "tree_only";
  product_id?: string;
  reason?: "manual" | "catalog_changed" | "daily_cron" | "initial";
  dry_run?: boolean;
}

interface InferredProduct {
  product_id: string;
  commercial_name: string;
  commercial_role: "primary" | "complement" | "upgrade" | "kit_component";
  product_kind:
    | "single"
    | "kit"
    | "combo"
    | "pack"
    | "upgrade"
    | "complement"
    | "replacement";
  main_pain_slug: string | null;
  secondary_pain_slugs: string[];
  target_audience: string;
  short_pitch: string;
  medium_pitch: string;
  differentials: string[];
  when_not_to_indicate: string;
  comparison_arguments: string;
  has_mandatory_variants: boolean;
  variants_summary: Record<string, unknown>;
  confidence_score: number;
}

interface InferredSnapshot {
  niche_primary: string;
  niche_secondary: string[];
  business_summary: string;
  audience_summary: string;
  suggested_tone: string;
  confidence_score: number;
  context_tree: Array<{
    level: "business" | "audience" | "macro_category" | "subcategory" | "product_type" | "pain";
    label: string;
    slug: string;
    parent_slug: string | null;
    weight: number;
    description?: string;
  }>;
  products: InferredProduct[];
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/** Converte score 0..1 (ou já 0..100) em inteiro 0..100 — schema da tabela usa integer. */
function toScoreInt(score: number | null | undefined): number {
  if (score === null || score === undefined || isNaN(Number(score))) return 0;
  const n = Number(score);
  const scaled = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/**
 * Faixa de preço (bucket) — preserva sinal de posicionamento sem expor valores
 * detalhados, reduzindo tokens.
 */
function priceBucket(price: number | null | undefined): string | null {
  if (price === null || price === undefined || isNaN(Number(price))) return null;
  const p = Number(price);
  if (p <= 0) return null;
  if (p < 30) return "ate_30";
  if (p < 80) return "30_80";
  if (p < 150) return "80_150";
  if (p < 300) return "150_300";
  if (p < 600) return "300_600";
  if (p < 1500) return "600_1500";
  return "acima_1500";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    if (!LOVABLE_API_KEY) {
      return jsonResponse(
        { success: false, error: "LOVABLE_API_KEY não configurada" },
        200,
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { tenant_id, scope = "full_snapshot", product_id, reason = "manual", dry_run = false } = body;

    if (!tenant_id) {
      return jsonResponse({ success: false, error: "tenant_id é obrigatório" }, 200);
    }

    console.log(`[snapshot-gen] tenant=${tenant_id} scope=${scope} reason=${reason} dry_run=${dry_run}`);

    // 1. Catálogo do tenant
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select(
        "id, name, sku, description, short_description, price, brand, product_type, tags, has_variants, status",
      )
      .eq("tenant_id", tenant_id)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);

    if (prodErr) throw prodErr;

    const productIds = (products ?? []).map((p) => p.id);

    // 2. Variantes (apenas nome + atributos — sem stock e sem preço)
    const { data: variants } = productIds.length > 0
      ? await supabase
          .from("product_variants")
          .select("product_id, variant_name, attributes")
          .in("product_id", productIds)
      : { data: [] as any[] };

    // 3. Categorias
    const { data: productCategories } = productIds.length > 0
      ? await supabase
          .from("product_categories")
          .select("product_id, category_id, categories(name, slug)")
          .in("product_id", productIds)
      : { data: [] as any[] };

    // 4. Modo (Pacote G)
    const totalProducts = products?.length ?? 0;
    const productsWithDesc = (products ?? []).filter(
      (p) => (p.description?.length ?? 0) > 30 || (p.short_description?.length ?? 0) > 20,
    ).length;

    const goNeutral =
      totalProducts < MIN_PRODUCTS_FOR_ACTIVE_MODE ||
      productsWithDesc < MIN_PRODUCTS_WITH_DESCRIPTION;

    if (goNeutral) {
      const reasonText =
        totalProducts < MIN_PRODUCTS_FOR_ACTIVE_MODE
          ? `Catálogo insuficiente: apenas ${totalProducts} produto(s) ativo(s). Mínimo: ${MIN_PRODUCTS_FOR_ACTIVE_MODE}.`
          : `Apenas ${productsWithDesc} produto(s) com descrição mínima. Mínimo: ${MIN_PRODUCTS_WITH_DESCRIPTION}.`;

      console.log(`[snapshot-gen] tenant=${tenant_id} → modo NEUTRO: ${reasonText}`);

      if (!dry_run) {
        const persisted = await persistNeutralSnapshot(
          supabase,
          tenant_id,
          reasonText,
          MODEL,
          Date.now() - startedAt,
        );
        if (!persisted.ok) {
          return jsonResponse({
            success: false,
            mode: "neutral",
            error: `Falha ao persistir snapshot neutro: ${persisted.error}`,
          });
        }
      }

      return jsonResponse({
        success: true,
        mode: "neutral",
        reason: reasonText,
        stats: { totalProducts, productsWithDesc },
      });
    }

    // 5. Modo ativo — preparar índices
    const variantsByProduct = new Map<string, any[]>();
    (variants ?? []).forEach((v) => {
      if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
      variantsByProduct.get(v.product_id)!.push(v);
    });

    const categoriesByProduct = new Map<string, string[]>();
    (productCategories ?? []).forEach((pc: any) => {
      const name = pc.categories?.name;
      if (!name) return;
      if (!categoriesByProduct.has(pc.product_id)) categoriesByProduct.set(pc.product_id, []);
      categoriesByProduct.get(pc.product_id)!.push(name);
    });

    // 6. Construir catálogo enxuto
    const compactCatalog = buildCompactCatalog(
      products ?? [],
      categoriesByProduct,
      variantsByProduct,
      DESC_MAX_CHARS,
    );

    // Métricas de payload
    const fullPayloadSize = JSON.stringify(compactCatalog).length;

    // 7. Lotear (preferência por categoria, fallback por quantidade)
    const batches = batchProducts(compactCatalog, categoriesByProduct);
    const batchSizes = batches.map((b) => b.length);

    console.log(
      `[snapshot-gen] payload_size=${fullPayloadSize} chars, batches=${batches.length}, batch_sizes=${JSON.stringify(batchSizes)}`,
    );

    // 8. Inferência por lote.
    //    Lote 1 (sequencial): gera snapshot global + árvore de contexto.
    //    Lotes 2..N (paralelo): só geram products referenciando a árvore.
    const inferenceLog: any[] = [];
    let masterSnapshot: InferredSnapshot | null = null;
    const allProducts: InferredProduct[] = [];

    // Lote 1 — sequencial (define a árvore)
    try {
      const r1 = await inferBatchWithRetry(batches[0], true, null, DESC_MAX_CHARS);
      masterSnapshot = r1;
      allProducts.push(...r1.products);
      inferenceLog.push({
        batch: 1,
        size: batches[0].length,
        products_inferred: r1.products.length,
        context_nodes: r1.context_tree.length,
        retried: r1.retried,
        payload_chars: r1.payload_chars,
      });
    } catch (e) {
      console.error(`[snapshot-gen] lote 1 falhou definitivamente:`, e);
      inferenceLog.push({
        batch: 1,
        size: batches[0].length,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Lotes 2..N — paralelos (independentes entre si, todos referenciam mesma árvore)
    if (masterSnapshot && batches.length > 1) {
      const slugUniverse = masterSnapshot.context_tree.map((n) => n.slug);
      const restBatches = batches.slice(1);
      const settled = await Promise.allSettled(
        restBatches.map((b) => inferBatchWithRetry(b, false, slugUniverse, DESC_MAX_CHARS)),
      );

      settled.forEach((s, idx) => {
        const batchNum = idx + 2;
        if (s.status === "fulfilled") {
          allProducts.push(...s.value.products);
          inferenceLog.push({
            batch: batchNum,
            size: restBatches[idx].length,
            products_inferred: s.value.products.length,
            retried: s.value.retried,
            payload_chars: s.value.payload_chars,
          });
        } else {
          console.error(`[snapshot-gen] lote ${batchNum} falhou:`, s.reason);
          inferenceLog.push({
            batch: batchNum,
            size: restBatches[idx].length,
            error: s.reason instanceof Error ? s.reason.message : String(s.reason),
          });
        }
      });
    }

    if (!masterSnapshot) {
      return jsonResponse({
        success: false,
        mode: "active",
        error: "Inferência do primeiro lote falhou — sem snapshot mestre",
        batches: inferenceLog,
      });
    }

    // Merge final dos produtos
    const merged: InferredSnapshot = {
      ...masterSnapshot,
      products: dedupeProducts(allProducts),
    };

    if (dry_run) {
      return jsonResponse({
        success: true,
        mode: "active",
        dry_run: true,
        inferred: merged,
        payload_metrics: {
          full_payload_chars: fullPayloadSize,
          batches: inferenceLog,
        },
        duration_ms: Date.now() - startedAt,
      });
    }

    // 9. Persistir
    console.log(
      `[snapshot-gen] persist start tenant=${tenant_id} nodes=${merged.context_tree.length} products=${merged.products.length}`,
    );
    const persistStats = await persistActiveSnapshot(
      supabase,
      tenant_id,
      merged,
      MODEL,
      Date.now() - startedAt,
    );
    console.log(`[snapshot-gen] persist concluído:`, JSON.stringify(persistStats));

    // GARANTIA #5: nunca devolver success:true sem persistência real
    const persistOk =
      persistStats.snapshot_upsert === "ok" &&
      persistStats.payload_inserted > 0;

    if (!persistOk) {
      return jsonResponse({
        success: false,
        mode: "active",
        error: "Inferência ok porém persistência falhou (snapshot ou payloads).",
        stats: {
          totalProducts,
          contextNodes: merged.context_tree.length,
          productsClassified: merged.products.length,
          persisted: persistStats,
        },
        batches: inferenceLog,
      });
    }

    return jsonResponse({
      success: true,
      mode: "active",
      stats: {
        totalProducts,
        contextNodes: merged.context_tree.length,
        productsClassified: merged.products.length,
        persisted: persistStats,
      },
      payload_metrics: {
        full_payload_chars: fullPayloadSize,
        batches: inferenceLog,
      },
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[snapshot-gen] erro fatal:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      200,
    );
  }
});

// ============================================================
// Helpers — payload, lotes, inferência, retry, merge
// ============================================================

function buildCompactCatalog(
  products: any[],
  categoriesByProduct: Map<string, string[]>,
  variantsByProduct: Map<string, any[]>,
  descMax: number,
) {
  return products.map((p) => {
    const cats = categoriesByProduct.get(p.id) ?? [];
    const desc = (p.description ?? p.short_description ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, descMax);
    const vars = (variantsByProduct.get(p.id) ?? []).slice(0, 6).map((v) => ({
      n: v.variant_name,
      a: v.attributes,
    }));
    const obj: Record<string, unknown> = {
      id: p.id,
      name: p.name,
      brand: p.brand ?? null,
      type: p.product_type ?? null,
      cats,
      tags: Array.isArray(p.tags) ? p.tags.slice(0, 8) : [],
      desc,
      price_bucket: priceBucket(p.price),
    };
    if (p.has_variants && vars.length > 0) {
      obj.has_variants = true;
      obj.variants = vars;
    }
    return obj;
  });
}

function batchProducts(
  catalog: any[],
  categoriesByProduct: Map<string, string[]>,
): any[][] {
  if (catalog.length <= MAX_BATCH_SIZE) return [catalog];

  // Tentar agrupar por primeira categoria
  const byCat = new Map<string, any[]>();
  for (const p of catalog) {
    const cats = categoriesByProduct.get(p.id) ?? [];
    const key = cats[0]?.toLowerCase().trim() || "_sem_categoria";
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(p);
  }

  const useCategoryGrouping =
    byCat.size >= 2 && Array.from(byCat.values()).every((g) => g.length <= MAX_BATCH_SIZE * 2);

  const batches: any[][] = [];

  if (useCategoryGrouping) {
    for (const group of byCat.values()) {
      // Quebrar grupos grandes em pedaços de TARGET_BATCH_SIZE
      for (let i = 0; i < group.length; i += TARGET_BATCH_SIZE) {
        batches.push(group.slice(i, i + TARGET_BATCH_SIZE));
      }
    }
  } else {
    // Fallback: corte por quantidade
    for (let i = 0; i < catalog.length; i += TARGET_BATCH_SIZE) {
      batches.push(catalog.slice(i, i + TARGET_BATCH_SIZE));
    }
  }

  // Consolidar lotes muito pequenos no final
  if (batches.length >= 2) {
    const last = batches[batches.length - 1];
    const prev = batches[batches.length - 2];
    if (last.length < MIN_BATCH_SIZE && prev.length + last.length <= MAX_BATCH_SIZE) {
      batches[batches.length - 2] = [...prev, ...last];
      batches.pop();
    }
  }

  return batches;
}

async function inferBatchWithRetry(
  batch: any[],
  isFirst: boolean,
  slugUniverse: string[] | null,
  descMaxOriginal: number,
): Promise<InferredSnapshot & { retried: boolean; payload_chars: number }> {
  // Tentativa 1 — payload normal
  try {
    const r = await inferBatch(batch, isFirst, slugUniverse, MAX_TOKENS_DEFAULT);
    return { ...r, retried: false, payload_chars: JSON.stringify(batch).length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isJsonIssue =
      msg.includes("JSON") ||
      msg.includes("truncado") ||
      msg.includes("Unexpected end") ||
      msg.includes("tool_call");

    if (!isJsonIssue) throw e;

    console.warn(`[snapshot-gen] retry em modo reduzido após erro: ${msg.slice(0, 200)}`);

    // Tentativa 2 — payload ainda mais enxuto
    const reducedBatch = batch.map((p) => ({
      ...p,
      desc: (p.desc ?? "").slice(0, DESC_MAX_CHARS_REDUCED),
      variants: undefined, // remover variantes detalhadas
      tags: (p.tags ?? []).slice(0, 4),
    }));
    const r = await inferBatch(reducedBatch, isFirst, slugUniverse, MAX_TOKENS_REDUCED);
    return { ...r, retried: true, payload_chars: JSON.stringify(reducedBatch).length };
  }
}

async function inferBatch(
  batch: any[],
  isFirst: boolean,
  slugUniverse: string[] | null,
  maxTokens: number,
): Promise<InferredSnapshot> {
  const systemPrompt = isFirst
    ? `Você é um analista comercial sênior de e-commerce brasileiro. Analise o catálogo (parcial — primeiro lote) e infira:

1. **Negócio**: nicho principal, secundários (tenant híbrido), resumo, público-alvo, tom.
2. **Árvore de contexto**: hierarquia negócio → público → macro_categoria → subcategoria → tipo_produto → dor. Slugs únicos kebab-case sem acento. parent_slug=null para raiz.
3. **Mapa produto → dores**: principal + secundárias por slug.
4. **Payload comercial por produto**: commercial_role, product_kind (single/kit/combo/pack/upgrade/complement/replacement), main_pain_slug, secondary_pain_slugs, target_audience, short_pitch (≤140), medium_pitch (≤400), differentials, when_not_to_indicate, comparison_arguments, has_mandatory_variants, variants_summary, confidence_score.

REGRAS:
- PT-BR.
- Não inventar prova social/claim clínico.
- Slugs kebab-case sem acento.
- Confiança honesta — se incerto, baixe o score.
- Responda APENAS via tool_call submit_business_snapshot.`
    : `Você é um analista comercial sênior. Este é um lote ADICIONAL de produtos do mesmo tenant. A árvore de contexto JÁ FOI DEFINIDA. Para cada produto, gere apenas o payload comercial referenciando OBRIGATORIAMENTE slugs já existentes da árvore: ${slugUniverse?.join(", ") ?? "(vazio)"}.

Devolva snapshot com:
- niche_primary/business_summary/audience_summary/suggested_tone/confidence_score = strings vazias ou 0 (serão ignorados)
- context_tree = []
- products = lista completa do lote

REGRAS: PT-BR, sem invenção, slugs já existentes. Responda APENAS via tool_call.`;

  const userPrompt = `Lote de ${batch.length} produto(s):\n\n${JSON.stringify(batch)}\n\nGere o snapshot conforme schema.`;

  const schema = {
    type: "object",
    properties: {
      niche_primary: { type: "string" },
      niche_secondary: { type: "array", items: { type: "string" } },
      business_summary: { type: "string" },
      audience_summary: { type: "string" },
      suggested_tone: { type: "string" },
      confidence_score: { type: "number" },
      context_tree: {
        type: "array",
        items: {
          type: "object",
          properties: {
            level: {
              type: "string",
              enum: ["business", "audience", "macro_category", "subcategory", "product_type", "pain"],
            },
            label: { type: "string" },
            slug: { type: "string" },
            parent_slug: { type: ["string", "null"] },
            weight: { type: "number" },
            description: { type: "string" },
          },
          required: ["level", "label", "slug", "parent_slug", "weight"],
        },
      },
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            product_id: { type: "string" },
            commercial_name: { type: "string" },
            commercial_role: { type: "string", enum: ["primary", "complement", "upgrade", "kit_component"] },
            product_kind: {
              type: "string",
              enum: ["single", "kit", "combo", "pack", "upgrade", "complement", "replacement"],
            },
            main_pain_slug: { type: ["string", "null"] },
            secondary_pain_slugs: { type: "array", items: { type: "string" } },
            target_audience: { type: "string" },
            short_pitch: { type: "string" },
            medium_pitch: { type: "string" },
            differentials: { type: "array", items: { type: "string" } },
            when_not_to_indicate: { type: "string" },
            comparison_arguments: { type: "string" },
            has_mandatory_variants: { type: "boolean" },
            variants_summary: { type: "object" },
            confidence_score: { type: "number" },
          },
          required: [
            "product_id",
            "commercial_name",
            "commercial_role",
            "product_kind",
            "main_pain_slug",
            "secondary_pain_slugs",
            "short_pitch",
            "has_mandatory_variants",
            "confidence_score",
          ],
        },
      },
    },
    required: ["context_tree", "products"],
  };

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_business_snapshot",
            description: "Submete o snapshot comercial inferido a partir do lote.",
            parameters: schema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_business_snapshot" } },
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Gateway IA falhou (${response.status}): ${txt.slice(0, 500)}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  const finishReason = choice?.finish_reason;
  const toolCall = choice?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    throw new Error(`Gateway IA não retornou tool_call (finish_reason=${finishReason})`);
  }

  const rawArgs = toolCall.function.arguments as string;

  if (finishReason && finishReason !== "tool_calls" && finishReason !== "stop") {
    throw new Error(
      `tool_call possivelmente truncado (finish_reason=${finishReason}, args_len=${rawArgs.length})`,
    );
  }

  let parsed: InferredSnapshot;
  try {
    parsed = JSON.parse(rawArgs) as InferredSnapshot;
  } catch (e) {
    throw new Error(
      `JSON do tool_call inválido (provavelmente truncado, args_len=${rawArgs.length}): ${
        e instanceof Error ? e.message : e
      }`,
    );
  }

  // Defaults
  parsed.niche_secondary = parsed.niche_secondary ?? [];
  parsed.products = parsed.products ?? [];
  parsed.context_tree = parsed.context_tree ?? [];

  parsed.context_tree = parsed.context_tree.map((n) => ({
    ...n,
    parent_slug:
      n.parent_slug && String(n.parent_slug).trim().length > 0 ? n.parent_slug : null,
  }));

  return parsed;
}

/**
 * Deduplica produtos vindos de lotes diferentes (por product_id), mantendo
 * a primeira ocorrência (que tem maior contexto da árvore se foi do 1º lote).
 */
function dedupeProducts(products: InferredProduct[]): InferredProduct[] {
  const seen = new Set<string>();
  const out: InferredProduct[] = [];
  for (const p of products) {
    if (!p.product_id || seen.has(p.product_id)) continue;
    seen.add(p.product_id);
    out.push(p);
  }
  return out;
}

// ============================================================
// Persistência
// ============================================================

async function persistNeutralSnapshot(
  supabase: any,
  tenantId: string,
  reasonText: string,
  modelUsed: string,
  durationMs: number,
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from("ai_business_snapshot")
    .select("manual_overrides, has_manual_overrides, version")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  const { error } = await supabase.from("ai_business_snapshot").upsert(
    {
      tenant_id: tenantId,
      mode: "neutral",
      neutral_mode_reason: reasonText,
      niche_primary: null,
      niche_secondary: null,
      business_summary: null,
      audience_summary: null,
      suggested_tone: null,
      confidence_score: 0,
      confidence_level: "low",
      inferred_data: {},
      manual_overrides: existing?.manual_overrides ?? {},
      has_manual_overrides: existing?.has_manual_overrides ?? false,
      model_used: modelUsed,
      generated_at: new Date().toISOString(),
      generation_duration_ms: durationMs,
      needs_regeneration: false,
      version: nextVersion,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    console.error("[persist-neutral] erro:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function persistActiveSnapshot(
  supabase: any,
  tenantId: string,
  inferred: InferredSnapshot,
  modelUsed: string,
  durationMs: number,
) {
  const stats = {
    snapshot_upsert: "pending" as string,
    context_nodes_inserted: 0,
    context_nodes_failed: 0,
    pain_map_inserted: 0,
    pain_map_failed: 0,
    payload_inserted: 0,
    payload_failed: 0,
    errors: [] as string[],
  };

  // 1. Snapshot principal
  const { data: existing, error: existingErr } = await supabase
    .from("ai_business_snapshot")
    .select("manual_overrides, has_manual_overrides, version")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingErr) {
    console.error("[persist] erro lendo snapshot existente:", existingErr);
    stats.errors.push(`read_existing: ${existingErr.message}`);
  }

  const nextVersion = (existing?.version ?? 0) + 1;

  const { error: snapErr } = await supabase.from("ai_business_snapshot").upsert(
    {
      tenant_id: tenantId,
      mode: "active",
      neutral_mode_reason: null,
      niche_primary: inferred.niche_primary,
      niche_secondary: inferred.niche_secondary,
      business_summary: inferred.business_summary,
      audience_summary: inferred.audience_summary,
      suggested_tone: inferred.suggested_tone,
      confidence_score: toScoreInt(inferred.confidence_score),
      confidence_level: confidenceLevel(inferred.confidence_score),
      inferred_data: {
        niche_primary: inferred.niche_primary,
        niche_secondary: inferred.niche_secondary,
        business_summary: inferred.business_summary,
        audience_summary: inferred.audience_summary,
        suggested_tone: inferred.suggested_tone,
      },
      manual_overrides: existing?.manual_overrides ?? {},
      has_manual_overrides: existing?.has_manual_overrides ?? false,
      model_used: modelUsed,
      generated_at: new Date().toISOString(),
      generation_duration_ms: durationMs,
      needs_regeneration: false,
      version: nextVersion,
    },
    { onConflict: "tenant_id" },
  );

  if (snapErr) {
    console.error("[persist] erro upsert snapshot:", snapErr);
    stats.snapshot_upsert = `error: ${snapErr.message}`;
    stats.errors.push(`snapshot_upsert: ${snapErr.message}`);
  } else {
    stats.snapshot_upsert = "ok";
  }

  // 2. Árvore de contexto
  const { error: delTreeErr } = await supabase
    .from("ai_context_tree")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source", "inferred");

  if (delTreeErr) {
    console.error("[persist] erro delete tree:", delTreeErr);
    stats.errors.push(`delete_tree: ${delTreeErr.message}`);
  }

  const slugToId = new Map<string, string>();
  const sorted = [...inferred.context_tree].sort((a, b) => {
    if (a.parent_slug === null && b.parent_slug !== null) return -1;
    if (a.parent_slug !== null && b.parent_slug === null) return 1;
    return 0;
  });

  for (const node of sorted) {
    const parentId = node.parent_slug ? slugToId.get(node.parent_slug) ?? null : null;
    const { data: inserted, error: nodeErr } = await supabase
      .from("ai_context_tree")
      .insert({
        tenant_id: tenantId,
        parent_id: parentId,
        level: node.level,
        label: node.label,
        slug: node.slug,
        weight: node.weight ?? 50,
        description: node.description ?? null,
        source: "inferred",
        confidence_score: toScoreInt(inferred.confidence_score),
        confidence_level: confidenceLevel(inferred.confidence_score),
        is_active: true,
      })
      .select("id")
      .single();

    if (nodeErr) {
      console.error(`[persist] erro insert node slug=${node.slug}:`, nodeErr);
      stats.context_nodes_failed++;
      stats.errors.push(`node[${node.slug}]: ${nodeErr.message}`);
    } else if (inserted?.id) {
      slugToId.set(node.slug, inserted.id);
      stats.context_nodes_inserted++;
    }
  }

  // 3. Mapa produto ↔ dor
  const { error: delPainErr } = await supabase
    .from("ai_product_pain_map")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source", "inferred");

  if (delPainErr) {
    console.error("[persist] erro delete pain_map:", delPainErr);
    stats.errors.push(`delete_pain_map: ${delPainErr.message}`);
  }

  const painMapInserts: any[] = [];
  for (const p of inferred.products) {
    if (p.main_pain_slug && slugToId.has(p.main_pain_slug)) {
      painMapInserts.push({
        tenant_id: tenantId,
        product_id: p.product_id,
        pain_node_id: slugToId.get(p.main_pain_slug)!,
        is_primary: true,
        weight: 80,
        source: "inferred",
        confidence_score: toScoreInt(p.confidence_score),
        confidence_level: confidenceLevel(p.confidence_score),
      });
    }
    for (const slug of p.secondary_pain_slugs ?? []) {
      if (slugToId.has(slug)) {
        painMapInserts.push({
          tenant_id: tenantId,
          product_id: p.product_id,
          pain_node_id: slugToId.get(slug)!,
          is_primary: false,
          weight: 40,
          source: "inferred",
          confidence_score: toScoreInt(p.confidence_score),
          confidence_level: confidenceLevel(p.confidence_score),
        });
      }
    }
  }

  if (painMapInserts.length > 0) {
    for (let i = 0; i < painMapInserts.length; i += 100) {
      const chunk = painMapInserts.slice(i, i + 100);
      const { error: pmErr } = await supabase.from("ai_product_pain_map").insert(chunk);
      if (pmErr) {
        console.error(`[persist] erro insert pain_map chunk ${i}:`, pmErr);
        stats.pain_map_failed += chunk.length;
        stats.errors.push(`pain_map[${i}]: ${pmErr.message}`);
      } else {
        stats.pain_map_inserted += chunk.length;
      }
    }
  }

  // 4. Payload comercial
  for (const p of inferred.products) {
    const { data: existingPayload } = await supabase
      .from("ai_product_commercial_payload")
      .select("manual_overrides, has_manual_overrides")
      .eq("tenant_id", tenantId)
      .eq("product_id", p.product_id)
      .maybeSingle();

    const mainPainId = p.main_pain_slug ? slugToId.get(p.main_pain_slug) ?? null : null;
    const secondaryPainIds = (p.secondary_pain_slugs ?? [])
      .map((s) => slugToId.get(s))
      .filter(Boolean) as string[];

    const { error: payErr } = await supabase.from("ai_product_commercial_payload").upsert(
      {
        tenant_id: tenantId,
        product_id: p.product_id,
        commercial_name: p.commercial_name,
        commercial_role: p.commercial_role,
        product_kind: p.product_kind,
        main_pain_id: mainPainId,
        secondary_pain_ids: secondaryPainIds,
        target_audience: p.target_audience ?? null,
        short_pitch: p.short_pitch?.slice(0, 140) ?? null,
        medium_pitch: p.medium_pitch?.slice(0, 400) ?? null,
        differentials: p.differentials ?? [],
        when_not_to_indicate: p.when_not_to_indicate ?? null,
        comparison_arguments: p.comparison_arguments ?? null,
        has_mandatory_variants: p.has_mandatory_variants ?? false,
        variants_summary: p.variants_summary ?? {},
        social_proof_snippet: null,
        source: "inferred",
        confidence_score: toScoreInt(p.confidence_score),
        confidence_level: confidenceLevel(p.confidence_score),
        manual_overrides: existingPayload?.manual_overrides ?? {},
        has_manual_overrides: existingPayload?.has_manual_overrides ?? false,
        model_used: modelUsed,
        generated_at: new Date().toISOString(),
        needs_regeneration: false,
      },
      { onConflict: "tenant_id,product_id" },
    );

    if (payErr) {
      console.error(`[persist] erro upsert payload product=${p.product_id}:`, payErr);
      stats.payload_failed++;
      stats.errors.push(`payload[${p.product_id}]: ${payErr.message}`);
    } else {
      stats.payload_inserted++;
    }
  }

  return stats;
}
