import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.2.0"; // Fix: add LOVABLE_API_KEY auth header
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-creative-generate][${VERSION}] Request received`);

  try {
    const body = await req.json();
    const { tenant_id, trigger_type = "scheduled" } = body;

    if (!tenant_id) return fail("tenant_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get all AI-enabled accounts
    const { data: accountConfigs } = await supabase
      .from("ads_autopilot_account_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_ai_enabled", true)
      .eq("kill_switch", false);

    if (!accountConfigs?.length) {
      console.log(`[ads-autopilot-creative-generate][${VERSION}] No active accounts`);
      return ok({ message: "Nenhuma conta ativa para geração de criativos" });
    }

    // 2. Get top products by revenue (last 30 days) — with fallback to catalog
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: orders } = await supabase
      .from("orders")
      .select("items, total, created_at")
      .eq("tenant_id", tenant_id)
      .gte("created_at", thirtyDaysAgo)
      .eq("payment_status", "paid");

    // Aggregate product sales
    const productSales: Record<string, { revenue: number; units: number; name: string }> = {};
    for (const order of orders || []) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const pid = (item as any)?.product_id;
        if (!pid) continue;
        if (!productSales[pid]) productSales[pid] = { revenue: 0, units: 0, name: (item as any)?.name || "" };
        productSales[pid].revenue += ((item as any)?.price || 0) * ((item as any)?.quantity || 1);
        productSales[pid].units += (item as any)?.quantity || 1;
      }
    }

    // Top 5 products by revenue
    let topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    let usedFallback = false;
    let productIds: string[];

    if (topProducts.length === 0) {
      // FALLBACK: No sales data — use newest active products from catalog
      console.log(`[ads-autopilot-creative-generate][${VERSION}] No sales data, falling back to catalog products`);
      const { data: catalogProducts } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!catalogProducts?.length) {
        return ok({ message: "Nenhum produto ativo no catálogo para gerar criativos" });
      }

      productIds = catalogProducts.map((p: any) => p.id);
      // Populate productSales with catalog info (no revenue data)
      for (const p of catalogProducts) {
        productSales[p.id] = { revenue: 0, units: 0, name: p.name };
      }
      usedFallback = true;
    } else {
      productIds = topProducts.map(([id]) => id);
    }

    // 3. Get product details + images
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, images, description")
      .in("id", productIds);

    // 4. Check existing creative assets to avoid duplicates
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentAssets } = await supabase
      .from("ads_creative_assets")
      .select("product_id, format, angle")
      .eq("tenant_id", tenant_id)
      .gte("created_at", sevenDaysAgo);

    const recentSet = new Set(
      (recentAssets || []).map(a => `${a.product_id}-${a.format}-${a.angle}`)
    );

    // 5. Use AI to plan creative briefs
    const productContext = (products || []).map(p => {
      const sales = productSales[p.id];
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description?.substring(0, 200),
        image_url: Array.isArray(p.images) ? (p.images[0] as any)?.url || p.images[0] : null,
        revenue_30d: sales?.revenue || 0,
        units_30d: sales?.units || 0,
      };
    });

    const systemPrompt = `Você é um diretor criativo de anúncios para e-commerce.
Sua tarefa é planejar criativos publicitários para os produtos vencedores.

Para cada produto, sugira até 3 variações de criativos com:
- format: "feed" (1:1), "story" (9:16), ou "carousel"
- angle: "benefit" (destaque benefício), "proof" (prova social), "offer" (oferta/desconto), "ugc" (estilo user-generated)
- headline: Título curto e impactante (max 40 chars)
- copy_text: Texto do anúncio (max 125 chars)
- cta_type: "SHOP_NOW", "LEARN_MORE", "GET_OFFER"

Evite combinações que já existem: ${JSON.stringify([...recentSet])}

Responda APENAS com JSON válido:
{
  "creatives": [
    {
      "product_id": "uuid",
      "product_name": "nome",
      "format": "feed",
      "aspect_ratio": "1:1",
      "angle": "benefit",
      "headline": "...",
      "copy_text": "...",
      "cta_type": "SHOP_NOW",
      "generation_prompt": "Prompt detalhado para gerar a imagem publicitária"
    }
  ]
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error(`[ads-autopilot-creative-generate][${VERSION}] LOVABLE_API_KEY not configured`);
      return fail("LOVABLE_API_KEY não configurada");
    }

    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Produtos vencedores:\n${JSON.stringify(productContext, null, 2)}` },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const aiText = await aiResponse.text();
    let aiData: any;
    try {
      const parsed = JSON.parse(aiText);
      const content = parsed.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : { creatives: [] };
    } catch (e) {
      console.error(`[ads-autopilot-creative-generate][${VERSION}] AI parse error:`, e);
      return fail("Erro ao interpretar resposta da IA");
    }

    const creatives = aiData.creatives || [];
    if (creatives.length === 0) {
      return ok({ message: "IA não sugeriu novos criativos", trigger_type });
    }

    // 6. Insert creative assets as drafts
    const assetsToInsert = creatives.map((c: any) => ({
      tenant_id,
      product_id: c.product_id,
      channel: "meta", // Default channel
      format: c.format,
      aspect_ratio: c.aspect_ratio || "1:1",
      angle: c.angle,
      headline: c.headline,
      copy_text: c.copy_text,
      cta_type: c.cta_type,
      status: "draft",
      compliance_status: "pending",
      meta: {
        generation_prompt: c.generation_prompt,
        product_name: c.product_name,
        trigger_type,
        generated_by: "autopilot",
      },
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("ads_creative_assets")
      .insert(assetsToInsert)
      .select("id");

    if (insertError) {
      console.error(`[ads-autopilot-creative-generate][${VERSION}] Insert error:`, insertError);
      return fail(insertError.message);
    }

    console.log(`[ads-autopilot-creative-generate][${VERSION}] Created ${inserted?.length || 0} creative briefs`);

    return ok({
      created: inserted?.length || 0,
      trigger_type,
      products_analyzed: topProducts.length,
    });
  } catch (err: any) {
    console.error(`[ads-autopilot-creative-generate][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
