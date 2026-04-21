// =============================================================
// Edge function: tenant-context-build
// =============================================================
// Constrói o snapshot tenant-aware usado para grounding da IA de atendimento.
// - Inferência de nicho via Lovable AI (Gemini Flash) sobre dados reais
// - Top categorias e top produtos do catálogo ativo
// - Resumo de políticas e sinais comerciais derivados de store_settings
// - Persiste em tenant_ai_context_snapshot e marca is_stale=false
//
// Pode ser disparada:
//  - sob demanda pelo helper getOrBuildTenantContext quando snapshot ausente/stale
//  - manualmente para um tenant específico ({ tenant_id })
//  - em modo varredura ({ all_stale: true }) para refresh em lote
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const NICHE_MODEL = "google/gemini-3-flash-preview";

interface BuildResult {
  tenant_id: string;
  ok: boolean;
  niche_label?: string | null;
  niche_confidence?: number | null;
  product_count?: number;
  category_count?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { tenant_id, all_stale } = body as {
      tenant_id?: string;
      all_stale?: boolean;
    };

    if (!tenant_id && !all_stale) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Provide tenant_id or all_stale=true",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let tenantsToProcess: string[] = [];
    if (tenant_id) {
      tenantsToProcess = [tenant_id];
    } else {
      const { data } = await supabase
        .from("tenant_ai_context_snapshot")
        .select("tenant_id")
        .eq("is_stale", true)
        .limit(50);
      tenantsToProcess = (data ?? []).map((r: any) => r.tenant_id);
    }

    const results: BuildResult[] = [];
    for (const tid of tenantsToProcess) {
      try {
        const r = await buildForTenant(supabase, tid, lovableKey);
        results.push(r);
      } catch (err: any) {
        results.push({ tenant_id: tid, ok: false, error: String(err?.message ?? err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[tenant-context-build] fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error?.message ?? error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function buildForTenant(
  supabase: any,
  tenantId: string,
  lovableKey: string | undefined
): Promise<BuildResult> {
  console.log(`[tenant-context-build] building for ${tenantId}`);

  // Tenant base
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return { tenant_id: tenantId, ok: false, error: "Tenant not found" };
  }

  // Store settings
  const { data: storeSettings } = await supabase
    .from("store_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Categorias ativas
  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name, parent_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  const categories = categoriesRaw ?? [];

  // Produtos ativos (top 30 por recência — proxy simples)
  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, name, slug, description, price, tags, category_id, status, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const products = productsRaw ?? [];

  // Mapa de categorias por id
  const catById = new Map<string, string>();
  for (const c of categories) catById.set(c.id, c.name);

  // Top produtos enriquecidos com nome de categoria
  const topProducts = products.map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price ? Number(p.price) : undefined,
    category: p.category_id ? catById.get(p.category_id) : undefined,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));

  // Top categorias (até 8)
  const topCategories = categories.slice(0, 8).map((c: any) => ({ name: c.name }));

  // Sinais comerciais
  const prices = products.map((p: any) => Number(p.price)).filter((n) => n > 0);
  const priceRange =
    prices.length > 0
      ? `R$ ${Math.min(...prices).toFixed(2)} – R$ ${Math.max(...prices).toFixed(2)}`
      : null;

  const commercialSignals: Record<string, any> = {
    product_count: products.length,
    category_count: categories.length,
    price_range: priceRange,
  };

  if (storeSettings?.free_shipping_min_cents) {
    commercialSignals.free_shipping_threshold = (
      storeSettings.free_shipping_min_cents / 100
    ).toFixed(2);
  }

  // Políticas (tudo opcional — só emite o que existe)
  const policiesSummary: Record<string, any> = {};
  if (storeSettings?.shipping_policy) policiesSummary.frete = truncate(storeSettings.shipping_policy, 280);
  if (storeSettings?.return_policy) policiesSummary.troca = truncate(storeSettings.return_policy, 280);
  if (storeSettings?.privacy_policy) policiesSummary.privacidade = "Disponível na loja";

  // Inferência de nicho via Lovable AI
  let nicheLabel: string | null = null;
  let nicheConfidence: number | null = null;
  let businessSummary: Record<string, any> = {};

  if (lovableKey && (products.length > 0 || categories.length > 0)) {
    try {
      const inferred = await inferNicheAndSummary(lovableKey, {
        store_name: storeSettings?.store_name || tenant.name,
        categories: topCategories.map((c) => c.name),
        products: topProducts.slice(0, 20).map((p) => ({
          name: p.name,
          price: p.price,
          category: p.category,
        })),
      });
      nicheLabel = inferred.niche_label ?? null;
      nicheConfidence = inferred.confidence ?? null;
      businessSummary = {
        short_description: inferred.short_description,
        value_proposition: inferred.value_proposition,
        target_audience: inferred.target_audience,
      };
    } catch (err) {
      console.error("[tenant-context-build] niche inference failed:", err);
    }
  }

  // Persistir
  const sourceHash = `${products.length}:${categories.length}:${storeSettings?.updated_at ?? ""}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: upsertError } = await supabase
    .from("tenant_ai_context_snapshot")
    .upsert(
      {
        tenant_id: tenantId,
        niche_label: nicheLabel,
        niche_confidence: nicheConfidence,
        business_summary: businessSummary,
        top_categories: topCategories,
        top_products: topProducts,
        policies_summary: policiesSummary,
        commercial_signals: commercialSignals,
        source_hash: sourceHash,
        is_stale: false,
        build_error: null,
        generated_at: now,
        expires_at: expiresAt,
      },
      { onConflict: "tenant_id" }
    );

  if (upsertError) {
    return { tenant_id: tenantId, ok: false, error: upsertError.message };
  }

  console.log(
    `[tenant-context-build] ${tenantId} OK — niche="${nicheLabel}" products=${products.length} cats=${categories.length}`
  );

  return {
    tenant_id: tenantId,
    ok: true,
    niche_label: nicheLabel,
    niche_confidence: nicheConfidence,
    product_count: products.length,
    category_count: categories.length,
  };
}

interface NicheInference {
  niche_label?: string;
  confidence?: number;
  short_description?: string;
  value_proposition?: string;
  target_audience?: string[];
}

async function inferNicheAndSummary(
  apiKey: string,
  data: {
    store_name: string;
    categories: string[];
    products: Array<{ name: string; price?: number; category?: string }>;
  }
): Promise<NicheInference> {
  const productLines = data.products
    .map((p) => `- ${p.name}${p.price ? ` (R$ ${p.price.toFixed(2)})` : ""}${p.category ? ` [${p.category}]` : ""}`)
    .join("\n");

  const prompt = `Analise os dados reais desta loja e infira o nicho de mercado.
Loja: ${data.store_name}

Categorias ativas:
${data.categories.map((c) => `- ${c}`).join("\n") || "(nenhuma)"}

Produtos do catálogo:
${productLines || "(nenhum)"}

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com:
{
  "niche_label": "rótulo livre e específico em português, ex: 'cosméticos masculinos para tratamento de calvície'",
  "confidence": número entre 0 e 1,
  "short_description": "uma frase curta descrevendo o que a loja vende",
  "value_proposition": "uma frase sobre o diferencial percebido (se inferível, senão omita)",
  "target_audience": ["público 1", "público 2"]
}`;

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NICHE_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Você é um analista de e-commerce. Retorna SEMPRE JSON válido conforme solicitado, sem texto adicional, sem blocos de código.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lovable AI ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback: tenta extrair entre primeiro { e último }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Failed to parse niche JSON");
  }
}

function truncate(s: string, max: number): string {
  if (!s) return s;
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
