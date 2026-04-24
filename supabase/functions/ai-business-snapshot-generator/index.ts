/**
 * ai-business-snapshot-generator
 *
 * Sub-fase 1.2 do Plano Mestre v4 — Motor de inferência inicial.
 *
 * Lê o catálogo de um tenant, decide entre modo `active` ou `neutral` (Pacote G),
 * chama Gemini 2.5 Pro via Lovable AI Gateway e popula:
 *   - ai_business_snapshot      (Pacote A)
 *   - ai_context_tree           (Pacote B — árvore de contexto, suporta tenant híbrido)
 *   - ai_product_pain_map       (Pacote C — mapa N:N produto ↔ dor com peso)
 *   - ai_product_commercial_payload (Pacote J + H — payload comercial pronto + variantes)
 *
 * Respeita a regra dos overrides manuais do tenant: nada em `manual_overrides`
 * é sobrescrito pela regeneração automática.
 *
 * Universal: serve qualquer tenant, qualquer nicho. Validação piloto: Respeite o Homem.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

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

// Catálogo mínimo viável para sair do modo neutro (Pacote G)
const MIN_PRODUCTS_FOR_ACTIVE_MODE = 3;
const MIN_PRODUCTS_WITH_DESCRIPTION = 2;

interface RequestBody {
  tenant_id: string;
  scope?: "full_snapshot" | "single_product" | "tree_only";
  product_id?: string;
  reason?: "manual" | "catalog_changed" | "daily_cron" | "initial";
  dry_run?: boolean;
}

interface InferredSnapshot {
  niche_primary: string;
  niche_secondary: string[];
  business_summary: string;
  audience_summary: string;
  suggested_tone: string;
  confidence_score: number; // 0..1
  context_tree: Array<{
    level: "business" | "audience" | "macro_category" | "subcategory" | "product_type" | "pain";
    label: string;
    slug: string;
    parent_slug: string | null;
    weight: number;
    description?: string;
  }>;
  products: Array<{
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
  }>;
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

    // 1. Carregar catálogo do tenant
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select(
        "id, name, sku, description, short_description, price, brand, product_type, tags, has_variants, stock_quantity, status",
      )
      .eq("tenant_id", tenant_id)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);

    if (prodErr) throw prodErr;

    // 2. Carregar variantes para os produtos
    const productIds = (products ?? []).map((p) => p.id);
    const { data: variants } = productIds.length > 0
      ? await supabase
          .from("product_variants")
          .select("id, product_id, variant_name, sku, price, stock_quantity, attributes")
          .in("product_id", productIds)
      : { data: [] as any[] };

    // 3. Carregar categorias
    const { data: productCategories } = productIds.length > 0
      ? await supabase
          .from("product_categories")
          .select("product_id, category_id, categories(name, slug)")
          .in("product_id", productIds)
      : { data: [] as any[] };

    // 4. Decidir modo (Pacote G — robustez)
    const totalProducts = products?.length ?? 0;
    const productsWithDesc = (products ?? []).filter(
      (p) => (p.description?.length ?? 0) > 30 || (p.short_description?.length ?? 0) > 20,
    ).length;

    const goNeutral =
      totalProducts < MIN_PRODUCTS_FOR_ACTIVE_MODE ||
      productsWithDesc < MIN_PRODUCTS_WITH_DESCRIPTION;

    if (goNeutral) {
      console.log(
        `[snapshot-gen] tenant=${tenant_id} → modo NEUTRO (products=${totalProducts}, with_desc=${productsWithDesc})`,
      );
      const reasonText =
        totalProducts < MIN_PRODUCTS_FOR_ACTIVE_MODE
          ? `Catálogo insuficiente: apenas ${totalProducts} produto(s) ativo(s). Mínimo: ${MIN_PRODUCTS_FOR_ACTIVE_MODE}.`
          : `Apenas ${productsWithDesc} produto(s) com descrição mínima. Mínimo: ${MIN_PRODUCTS_WITH_DESCRIPTION}.`;

      if (!dry_run) {
        await persistNeutralSnapshot(supabase, tenant_id, reasonText, MODEL, Date.now() - startedAt);
      }

      return jsonResponse({
        success: true,
        mode: "neutral",
        reason: reasonText,
        stats: { totalProducts, productsWithDesc },
      });
    }

    // 5. Modo ativo — preparar contexto compacto para o modelo
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

    const compactCatalog = (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: (p.description ?? p.short_description ?? "").slice(0, 800),
      brand: p.brand,
      product_type: p.product_type,
      tags: p.tags,
      categories: categoriesByProduct.get(p.id) ?? [],
      price: p.price,
      stock: p.stock_quantity,
      variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
        name: v.variant_name,
        attributes: v.attributes,
        stock: v.stock_quantity,
      })),
    }));

    // 6. Chamar Gemini 2.5 Pro
    const inferred = await inferWithGemini(compactCatalog);

    if (dry_run) {
      return jsonResponse({
        success: true,
        mode: "active",
        dry_run: true,
        inferred,
        duration_ms: Date.now() - startedAt,
      });
    }

    // 7. Persistir tudo (preservando manual_overrides)
    await persistActiveSnapshot(supabase, tenant_id, inferred, MODEL, Date.now() - startedAt);

    return jsonResponse({
      success: true,
      mode: "active",
      stats: {
        totalProducts,
        contextNodes: inferred.context_tree.length,
        productsClassified: inferred.products.length,
      },
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[snapshot-gen] erro:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      200,
    );
  }
});

async function inferWithGemini(catalog: any[]): Promise<InferredSnapshot> {
  const systemPrompt = `Você é um analista comercial sênior especializado em e-commerce brasileiro. Sua tarefa é analisar um catálogo de produtos e inferir:

1. **Negócio**: nicho principal, nichos secundários (se for tenant híbrido), resumo executivo, público-alvo, tom de voz sugerido.

2. **Árvore de contexto** (Pacote B): hierarquia negócio → público → macro_categoria → subcategoria → tipo_produto → dor/objetivo. Suporta múltiplos ramos paralelos para tenant híbrido. Cada nó tem slug único, label legível, parent_slug (null para raiz), peso 1-100, descrição curta opcional.

3. **Mapeamento produto → dores** (Pacote C, N:N): para cada produto, identifique a dor principal e dores secundárias resolvidas, usando os slugs criados na árvore.

4. **Payload comercial por produto** (Pacote J): para cada produto identifique:
   - commercial_role: primary (carro-chefe), complement (acessório), upgrade (versão melhor), kit_component (compõe kit)
   - product_kind: single | kit | combo | pack | upgrade | complement | replacement
   - main_pain_slug + secondary_pain_slugs (referenciando árvore)
   - target_audience (público específico)
   - short_pitch (≤140 chars, para recomendação)
   - medium_pitch (≤400 chars, para detalhamento)
   - differentials (array)
   - when_not_to_indicate (quando NÃO recomendar)
   - comparison_arguments (vs alternativas)
   - has_mandatory_variants + variants_summary (se há variante obrigatória — tamanho, cor, voltagem, etc — e como perguntar)
   - confidence_score (0-1, sua confiança nessa classificação)

REGRAS CRÍTICAS:
- Use exclusivamente PT-BR.
- Nunca invente prova social ou claim clínico.
- Se um produto não se encaixa no nicho principal, marque como ramo secundário da árvore (tenant híbrido).
- Se incerto sobre uma classificação, baixe o confidence_score — não invente certeza.
- Slugs em kebab-case sem acento.
- Responda APENAS JSON válido conforme o schema.`;

  const userPrompt = `Catálogo do tenant (${catalog.length} produtos):\n\n${JSON.stringify(catalog, null, 2)}\n\nGere o snapshot completo conforme schema.`;

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
    required: [
      "niche_primary",
      "business_summary",
      "audience_summary",
      "confidence_score",
      "context_tree",
      "products",
    ],
  };

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_business_snapshot",
            description: "Submete o snapshot completo do negócio inferido a partir do catálogo.",
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
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("Gateway IA não retornou tool_call esperado");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as InferredSnapshot;

  // Defaults seguros
  parsed.niche_secondary = parsed.niche_secondary ?? [];
  parsed.products = parsed.products ?? [];
  parsed.context_tree = parsed.context_tree ?? [];

  // Normalização: parent_slug vazio/undefined → null (banco usa NULL para raiz)
  parsed.context_tree = parsed.context_tree.map((n) => ({
    ...n,
    parent_slug:
      n.parent_slug && String(n.parent_slug).trim().length > 0 ? n.parent_slug : null,
  }));

  return parsed;
}

async function persistNeutralSnapshot(
  supabase: any,
  tenantId: string,
  reasonText: string,
  modelUsed: string,
  durationMs: number,
) {
  // Carregar overrides existentes para preservar
  const { data: existing } = await supabase
    .from("ai_business_snapshot")
    .select("manual_overrides, has_manual_overrides, version")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  await supabase.from("ai_business_snapshot").upsert(
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
}

async function persistActiveSnapshot(
  supabase: any,
  tenantId: string,
  inferred: InferredSnapshot,
  modelUsed: string,
  durationMs: number,
) {
  // ---- 1. Snapshot principal (preserva manual_overrides) ----
  const { data: existing } = await supabase
    .from("ai_business_snapshot")
    .select("manual_overrides, has_manual_overrides, version")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  await supabase.from("ai_business_snapshot").upsert(
    {
      tenant_id: tenantId,
      mode: "active",
      neutral_mode_reason: null,
      niche_primary: inferred.niche_primary,
      niche_secondary: inferred.niche_secondary,
      business_summary: inferred.business_summary,
      audience_summary: inferred.audience_summary,
      suggested_tone: inferred.suggested_tone,
      confidence_score: inferred.confidence_score,
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

  // ---- 2. Árvore de contexto (substitui inferidos, preserva manuais) ----
  await supabase
    .from("ai_context_tree")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source", "inferred");

  const slugToId = new Map<string, string>();

  // Inserir em ordem topológica (raízes primeiro)
  const sorted = [...inferred.context_tree].sort((a, b) => {
    if (a.parent_slug === null && b.parent_slug !== null) return -1;
    if (a.parent_slug !== null && b.parent_slug === null) return 1;
    return 0;
  });

  for (const node of sorted) {
    const parentId = node.parent_slug ? slugToId.get(node.parent_slug) ?? null : null;
    const { data: inserted } = await supabase
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
        confidence_score: inferred.confidence_score,
        confidence_level: confidenceLevel(inferred.confidence_score),
        is_active: true,
      })
      .select("id")
      .single();

    if (inserted?.id) slugToId.set(node.slug, inserted.id);
  }

  // ---- 3. Mapa produto ↔ dor (substitui inferidos) ----
  await supabase
    .from("ai_product_pain_map")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source", "inferred");

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
        confidence_score: p.confidence_score,
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
          confidence_score: p.confidence_score,
          confidence_level: confidenceLevel(p.confidence_score),
        });
      }
    }
  }

  if (painMapInserts.length > 0) {
    // Em chunks de 100 para não estourar limite
    for (let i = 0; i < painMapInserts.length; i += 100) {
      await supabase.from("ai_product_pain_map").insert(painMapInserts.slice(i, i + 100));
    }
  }

  // ---- 4. Payload comercial por produto (preserva manual_overrides) ----
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

    await supabase.from("ai_product_commercial_payload").upsert(
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
        social_proof_snippet: null, // política: nunca inventar
        source: "inferred",
        confidence_score: p.confidence_score,
        confidence_level: confidenceLevel(p.confidence_score),
        manual_overrides: existingPayload?.manual_overrides ?? {},
        has_manual_overrides: existingPayload?.has_manual_overrides ?? false,
        model_used: modelUsed,
        generated_at: new Date().toISOString(),
        needs_regeneration: false,
      },
      { onConflict: "tenant_id,product_id" },
    );
  }
}
