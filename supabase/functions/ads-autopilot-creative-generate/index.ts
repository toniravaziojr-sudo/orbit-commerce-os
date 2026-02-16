import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Weekly creative asset generation for winning products
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

    // 2. Get top products by revenue (last 30 days)
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
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    if (topProducts.length === 0) {
      console.log(`[ads-autopilot-creative-generate][${VERSION}] No product sales data`);
      return ok({ message: "Sem dados de vendas para gerar criativos" });
    }

    // 3. Get product details + images
    const productIds = topProducts.map(([id]) => id);
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

    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
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
