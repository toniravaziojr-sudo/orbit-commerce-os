import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Actionable business insights (pricing, budget, product decisions)
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 ? Math.round((a / b) * 100) / 100 : fallback;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

// ============ CONTEXT COLLECTOR (reuses analyze patterns) ============

async function collectWeeklyContext(supabase: any, tenantId: string) {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Products top 20
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, cost_price, status, stock_quantity, product_type, brand")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Orders 30d
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, payment_status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  const paidOrders = orders?.filter((o: any) => o.payment_status === "paid" || o.status === "delivered") || [];
  const cancelledOrders = orders?.filter((o: any) => o.status === "cancelled" || o.status === "returned") || [];

  const orderStats = {
    total_orders: orders?.length || 0,
    paid_orders: paidOrders.length,
    cancelled_orders: cancelledOrders.length,
    cancellation_rate_pct: orders?.length ? Math.round((cancelledOrders.length / orders.length) * 100 * 10) / 10 : 0,
    total_revenue_cents: paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
    avg_ticket_cents: paidOrders.length
      ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length)
      : 0,
  };

  const lowStockProducts = (products || []).filter((p: any) => p.stock_quantity !== null && p.stock_quantity <= 5);

  // Unit economics per product
  const unitEconomics = (products || []).map((p: any) => {
    const margin = p.cost_price ? Math.round(((p.price - p.cost_price) / p.price) * 100 * 10) / 10 : null;
    const maxCpaCents = p.cost_price ? Math.round((p.price - p.cost_price) * 0.85) : null; // 85% of margin (15% for fees)
    return {
      id: p.id,
      name: p.name,
      price_cents: p.price,
      cost_cents: p.cost_price,
      margin_pct: margin,
      max_cpa_cents: maxCpaCents,
      stock: p.stock_quantity,
    };
  });

  // Channel data
  const channels: Record<string, any> = {};

  // Meta
  const { data: metaCampaigns } = await supabase
    .from("meta_ad_campaigns")
    .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
    .eq("tenant_id", tenantId)
    .limit(50);

  if (metaCampaigns && metaCampaigns.length > 0) {
    const { data: metaCurrent } = await supabase
      .from("meta_ad_insights")
      .select("meta_campaign_id, impressions, clicks, spend_cents, conversions, conversion_value_cents, roas, ctr, frequency, date_start, ad_account_id")
      .eq("tenant_id", tenantId)
      .gte("date_start", sevenDaysAgo)
      .limit(500);

    const { data: metaPrevious } = await supabase
      .from("meta_ad_insights")
      .select("meta_campaign_id, impressions, clicks, spend_cents, conversions, conversion_value_cents, roas, ctr, frequency, date_start")
      .eq("tenant_id", tenantId)
      .gte("date_start", fourteenDaysAgo)
      .lt("date_start", sevenDaysAgo)
      .limit(500);

    // Per-campaign stats
    const campaignPerf: Record<string, any> = {};
    for (const ins of metaCurrent || []) {
      const cid = ins.meta_campaign_id;
      if (!campaignPerf[cid]) {
        const camp = metaCampaigns.find((c: any) => c.meta_campaign_id === cid);
        campaignPerf[cid] = { name: camp?.name || cid, objective: camp?.objective, status: camp?.status, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, frequency_sum: 0, count: 0 };
      }
      campaignPerf[cid].spend += ins.spend_cents || 0;
      campaignPerf[cid].impressions += ins.impressions || 0;
      campaignPerf[cid].clicks += ins.clicks || 0;
      campaignPerf[cid].conversions += ins.conversions || 0;
      campaignPerf[cid].revenue += ins.conversion_value_cents || 0;
      campaignPerf[cid].frequency_sum += ins.frequency || 0;
      campaignPerf[cid].count++;
    }
    for (const cid of Object.keys(campaignPerf)) {
      const p = campaignPerf[cid];
      p.roas = safeDivide(p.revenue, p.spend);
      p.cpa_cents = safeDivide(p.spend, p.conversions);
      p.ctr_pct = safeDivide(p.clicks * 100, p.impressions);
      p.avg_frequency = p.count > 0 ? Math.round((p.frequency_sum / p.count) * 10) / 10 : 0;
    }

    const totalSpendCurrent = (metaCurrent || []).reduce((s: number, i: any) => s + (i.spend_cents || 0), 0);
    const totalSpendPrevious = (metaPrevious || []).reduce((s: number, i: any) => s + (i.spend_cents || 0), 0);
    const totalConvCurrent = (metaCurrent || []).reduce((s: number, i: any) => s + (i.conversions || 0), 0);
    const totalConvPrevious = (metaPrevious || []).reduce((s: number, i: any) => s + (i.conversions || 0), 0);
    const totalRevCurrent = (metaCurrent || []).reduce((s: number, i: any) => s + (i.conversion_value_cents || 0), 0);

    channels.meta = {
      campaigns_total: metaCampaigns.length,
      active: metaCampaigns.filter((c: any) => c.status === "ACTIVE").length,
      spend_7d_cents: totalSpendCurrent,
      spend_7d_prev_cents: totalSpendPrevious,
      spend_delta_pct: pctChange(totalSpendCurrent, totalSpendPrevious),
      conversions_7d: totalConvCurrent,
      conversions_delta_pct: pctChange(totalConvCurrent, totalConvPrevious),
      revenue_7d_cents: totalRevCurrent,
      roas_7d: safeDivide(totalRevCurrent, totalSpendCurrent),
      campaign_details: campaignPerf,
    };
  }

  // Google
  const { data: googleCampaigns } = await supabase
    .from("google_ad_campaigns")
    .select("google_campaign_id, name, status, advertising_channel_type, budget_amount_micros")
    .eq("tenant_id", tenantId)
    .limit(50);

  if (googleCampaigns && googleCampaigns.length > 0) {
    const { data: googleCurrent } = await supabase
      .from("google_ad_insights")
      .select("google_campaign_id, impressions, clicks, cost_micros, conversions, conversions_value_micros, ctr, date_range_start")
      .eq("tenant_id", tenantId)
      .gte("date_range_start", sevenDaysAgo)
      .limit(500);

    const totalSpend = (googleCurrent || []).reduce((s: number, i: any) => s + (i.cost_micros || 0), 0);
    const totalConv = (googleCurrent || []).reduce((s: number, i: any) => s + (i.conversions || 0), 0);
    const totalRev = (googleCurrent || []).reduce((s: number, i: any) => s + (i.conversions_value_micros || 0), 0);

    channels.google = {
      campaigns_total: googleCampaigns.length,
      active: googleCampaigns.filter((c: any) => c.status === "ENABLED").length,
      spend_7d_micros: totalSpend,
      conversions_7d: totalConv,
      revenue_7d_micros: totalRev,
      roas_7d: safeDivide(totalRev, totalSpend),
    };
  }

  // TikTok
  const { data: tiktokCampaigns } = await supabase
    .from("tiktok_ad_campaigns")
    .select("tiktok_campaign_id, name, status, objective_type, budget_cents")
    .eq("tenant_id", tenantId)
    .limit(50);

  if (tiktokCampaigns && tiktokCampaigns.length > 0) {
    const { data: tiktokCurrent } = await supabase
      .from("tiktok_ad_insights")
      .select("tiktok_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, date_start")
      .eq("tenant_id", tenantId)
      .gte("date_start", sevenDaysAgo)
      .limit(500);

    const totalSpend = (tiktokCurrent || []).reduce((s: number, i: any) => s + (i.spend_cents || 0), 0);
    const totalConv = (tiktokCurrent || []).reduce((s: number, i: any) => s + (i.conversions || 0), 0);

    channels.tiktok = {
      campaigns_total: tiktokCampaigns.length,
      active: tiktokCampaigns.filter((c: any) => c.status === "ENABLE" || c.status === "ACTIVE").length,
      spend_7d_cents: totalSpend,
      conversions_7d: totalConv,
    };
  }

  // Account configs
  const { data: accountConfigs } = await supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId);

  // Recent autopilot actions
  const { data: recentActions } = await supabase
    .from("ads_autopilot_actions")
    .select("action_type, channel, status, reasoning, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    products: (products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price, cost_price: p.cost_price, stock: p.stock_quantity, type: p.product_type })),
    unitEconomics,
    orderStats,
    lowStockProducts: lowStockProducts.map((p: any) => ({ name: p.name, stock: p.stock_quantity })),
    channels,
    accountConfigs: accountConfigs || [],
    recentActions: recentActions || [],
  };
}

// ============ AI PROMPT ============

function buildInsightsPrompt(context: any): string {
  return `Você é um consultor sênior de e-commerce e tráfego pago. Seu trabalho é gerar RECOMENDAÇÕES ACIONÁVEIS de negócio para o lojista.

NÃO gere "análises da conta" ou dumps de contexto. Cada insight deve ser uma DECISÃO CONCRETA que o lojista pode tomar AGORA.

## DADOS DO NEGÓCIO

### Produtos e Unit Economics
${JSON.stringify(context.unitEconomics, null, 2)}

### Vendas (30 dias)
${JSON.stringify(context.orderStats)}

### Estoque Baixo (≤ 5 un)
${JSON.stringify(context.lowStockProducts)}

### Performance de Anúncios (7 dias)
${JSON.stringify(context.channels, null, 2)}

### Configs das Contas
${JSON.stringify(context.accountConfigs.map((c: any) => ({ channel: c.channel, account: c.ad_account_id, ai_enabled: c.is_ai_enabled, budget_cents: c.budget_cents, target_roi: c.target_roi, strategy: c.strategy_mode })), null, 2)}

## TIPOS DE INSIGHTS ESPERADOS (exemplos)

1. **Ajuste de Preço**: "Aumente o preço do [Produto X] de R$Y para R$Z — sua margem atual é apenas W%, e o CPA está em R$A. Com o novo preço, você terá margem para escalar."
2. **Realocação de Orçamento**: "Aumente o orçamento diário de R$X para R$Y — seu ROAS está em Z e há espaço para escalar mantendo lucratividade."
3. **Pausar Produto/Campanha**: "Pause anúncios do [Produto X] — ele tem ROAS de Y mas margem de apenas Z%, resultando em prejuízo de R$W por venda."
4. **Escalar Vencedor**: "O [Produto X] tem ROAS de Y e margem de Z%. Aumente investimento em +W% gradualmente."
5. **Alerta de Estoque**: "O [Produto X] tem apenas N unidades. Reduza o orçamento ou reponha estoque para não perder vendas."
6. **Oportunidade de Preço**: "O [Produto X] tem compare_at_price de R$Y mas está vendendo a R$Z sem desconto ativo. Considere criar uma oferta de tempo limitado."
7. **Meta de ROAS**: "Seu target ROI está em X, mas o ROAS real dos últimos 7 dias é Y. Ajuste a meta para Z baseado na margem real dos produtos."
8. **Diversificação**: "80% do investimento está no [Produto X]. Teste o [Produto Y] que tem margem de Z% e pode ser um novo vencedor."
9. **Ticket Médio**: "O ticket médio atual é R$X. Crie um kit/combo do [Produto X] + [Produto Y] para aumentar para ~R$Z."
10. **Resultado Positivo**: "[Produto X] vendeu N unidades nos últimos 7 dias com ROAS de Y. Continue escalando com incrementos de 20%."

## REGRAS

- Gere entre 3 e 7 insights
- CADA insight deve ter uma AÇÃO ESPECÍFICA com números concretos (R$, %, unidades)
- Use os nomes reais dos produtos
- NÃO repita dados brutos (ex: "analisei 6 campanhas...")
- NÃO use IDs técnicos de campanhas
- Valores sempre em R$ (BRL), NÃO em centavos
- Priorize insights que impactam diretamente o lucro
- Inclua pelo menos 1 insight positivo se houver bons resultados
- Máximo 3 frases por insight no body

Responda APENAS com JSON válido:
{ "insights": [ { "title": "string (max 60 chars, ex: 'Aumentar preço do Shampoo X')", "body": "string (2-3 frases com números)", "category": "budget|funnel|creative|audience|product|tracking|positive", "priority": "low|medium|high|critical", "sentiment": "positive|negative|neutral", "channel": "meta|google|tiktok|cross-channel", "recommended_action": { "type": "increase_price|decrease_price|increase_budget|decrease_budget|pause|scale|restock|create_offer|create_kit|adjust_target|diversify|other", "description": "Ação concreta em 1 frase" } } ] }`;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req: Request) => {
  console.log(`[ads-autopilot-weekly-insights][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { tenant_id, trigger_type = "scheduled" } = body;

    if (!tenant_id) {
      // Scheduled mode: run for all tenants with active configs
      const { data: configs } = await supabase
        .from("ads_autopilot_configs")
        .select("tenant_id")
        .eq("is_enabled", true)
        .eq("channel", "global");

      const tenantIds = [...new Set((configs || []).map((c: any) => c.tenant_id))];
      console.log(`[weekly-insights] Processing ${tenantIds.length} tenants`);

      let totalInsights = 0;
      for (const tid of tenantIds) {
        try {
          const count = await processOneTenant(supabase, tid, "scheduled");
          totalInsights += count;
        } catch (err: any) {
          console.error(`[weekly-insights] Error for tenant ${tid}:`, err.message);
        }
      }

      return ok({ tenants_processed: tenantIds.length, total_insights: totalInsights });
    }

    // Manual mode: single tenant
    const count = await processOneTenant(supabase, tenant_id, trigger_type);
    return ok({ insights_generated: count });

  } catch (err: any) {
    console.error(`[weekly-insights] Fatal error:`, err.message);
    return fail(err.message);
  }
});

async function processOneTenant(supabase: any, tenantId: string, triggerType: string): Promise<number> {
  console.log(`[weekly-insights] Processing tenant ${tenantId} (trigger: ${triggerType})`);

  // Archive old open insights (>7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("ads_autopilot_insights")
    .update({ status: "archived", resolved_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .lt("created_at", weekAgo);

  // Collect context
  const context = await collectWeeklyContext(supabase, tenantId);

  // Check if there's any data to analyze
  const hasData = Object.keys(context.channels).length > 0;
  if (!hasData) {
    console.log(`[weekly-insights] No channel data for tenant ${tenantId}, skipping`);
    return 0;
  }

  // Call AI
  const prompt = buildInsightsPrompt(context);
  const aiResponse = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um consultor de e-commerce focado em decisões de negócio. Responda APENAS em JSON válido. NUNCA gere dumps de contexto ou análises genéricas. Cada insight deve ser uma recomendação concreta com valores em R$." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_completion_tokens: 4000,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error(`[weekly-insights] AI API error (${aiResponse.status}):`, errorText.substring(0, 500));
    throw new Error(`AI API returned ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const content = aiData?.choices?.[0]?.message?.content || "";
  
  if (!content || content.trim().length === 0) {
    console.error(`[weekly-insights] AI returned empty content. Full response:`, JSON.stringify(aiData).substring(0, 500));
    throw new Error("AI returned empty content");
  }

  let insights: any[];
  try {
    // Handle potential markdown code blocks and various formats
    let cleaned = content.trim();
    // Remove markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    
    const parsed = JSON.parse(cleaned);
    insights = parsed.insights || (Array.isArray(parsed) ? parsed : []);
  } catch (parseErr: any) {
    console.error(`[weekly-insights] Failed to parse insights JSON. Content preview:`, content.substring(0, 800));
    
    // Try to extract JSON from mixed content
    const jsonMatch = content.match(/\{[\s\S]*"insights"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (jsonMatch) {
      try {
        const fallbackParsed = JSON.parse(jsonMatch[0]);
        insights = fallbackParsed.insights || [];
        console.log(`[weekly-insights] Fallback JSON extraction succeeded: ${insights.length} insights`);
      } catch {
        throw new Error("Failed to parse insights from AI");
      }
    } else {
      throw new Error("Failed to parse insights from AI");
    }
  }

  // Persist insights
  const insightsToInsert = insights.map((ins: any) => ({
    tenant_id: tenantId,
    channel: ins.channel || "cross-channel",
    title: (ins.title || "").substring(0, 200),
    body: ins.body || "",
    evidence: { context_summary: { channels: Object.keys(context.channels), products_count: context.products.length, orders_30d: context.orderStats.total_orders } },
    recommended_action: ins.recommended_action || null,
    priority: ["low", "medium", "high", "critical"].includes(ins.priority) ? ins.priority : "medium",
    category: ["budget", "funnel", "creative", "audience", "product", "tracking", "positive"].includes(ins.category) ? ins.category : "general",
    sentiment: ["positive", "negative", "neutral"].includes(ins.sentiment) ? ins.sentiment : "neutral",
    status: "open",
  }));

  if (insightsToInsert.length > 0) {
    const { error } = await supabase
      .from("ads_autopilot_insights")
      .insert(insightsToInsert);
    if (error) {
      console.error(`[weekly-insights] Insert error:`, error);
      throw error;
    }
  }

  console.log(`[weekly-insights] Generated ${insightsToInsert.length} insights for tenant ${tenantId}`);
  return insightsToInsert.length;
}
