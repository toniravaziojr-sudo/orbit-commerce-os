import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { conversation_id, message, tenant_id, scope, ad_account_id, channel } = body;

    if (!tenant_id || !message) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or get conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from("ads_chat_conversations")
        .insert({
          tenant_id,
          scope: scope || "global",
          ad_account_id: ad_account_id || null,
          channel: channel || null,
          title: message.substring(0, 60),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message
    await supabase.from("ads_chat_messages").insert({
      conversation_id: convId,
      tenant_id,
      role: "user",
      content: message,
    });

    // Load conversation history
    const { data: history } = await supabase
      .from("ads_chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(50);

    // Collect context for the AI
    const context = await collectAdsContext(supabase, tenant_id, scope, ad_account_id, channel);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(scope, ad_account_id, channel, context);

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Stream response from AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[ads-chat][${VERSION}] AI error: ${aiResponse.status} ${errText}`);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    // We need to collect the full response to save to DB, while streaming to client
    // Use TransformStream to intercept and collect content
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let fullContent = "";

    // Process in background
    (async () => {
      try {
        const reader = aiResponse.body!.getReader();
        let buffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Forward raw bytes to client
          await writer.write(value);
          
          // Parse to collect content
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullContent += delta;
            } catch { /* partial JSON */ }
          }
        }
        
        // Save assistant message to DB
        if (fullContent) {
          await supabase.from("ads_chat_messages").insert({
            conversation_id: convId,
            tenant_id,
            role: "assistant",
            content: fullContent,
          });
          
          // Update conversation title if first exchange
          if ((history || []).length <= 1) {
            await supabase
              .from("ads_chat_conversations")
              .update({ title: message.substring(0, 60) })
              .eq("id", convId);
          }
        }
      } catch (e) {
        console.error(`[ads-chat][${VERSION}] Stream processing error:`, e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Conversation-Id": convId,
      },
    });
  } catch (e: any) {
    console.error(`[ads-chat][${VERSION}] Error:`, e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============ CONTEXT COLLECTOR ============

async function collectAdsContext(
  supabase: any,
  tenantId: string,
  scope: string,
  adAccountId?: string,
  channel?: string
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const context: any = {};

  // Get store info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .single();
  context.storeName = tenant?.name || "Loja";

  // Get account configs
  const configQuery = supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId);
  
  if (scope === "account" && adAccountId) {
    configQuery.eq("ad_account_id", adAccountId);
  }
  
  const { data: configs } = await configQuery;
  context.accountConfigs = configs || [];

  // Get recent actions
  const actionsQuery = supabase
    .from("ads_autopilot_actions")
    .select("action_type, channel, status, reasoning, created_at, action_data")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  
  const { data: actions } = await actionsQuery;
  context.recentActions = actions || [];

  // Get recent insights
  const { data: insights } = await supabase
    .from("ads_autopilot_insights")
    .select("title, body, category, priority, sentiment, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);
  context.openInsights = insights || [];

  // Get campaign data based on scope
  if (channel === "meta" || !channel) {
    const campQuery = supabase
      .from("meta_ad_campaigns")
      .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
      .eq("tenant_id", tenantId)
      .limit(30);
    if (adAccountId) campQuery.eq("ad_account_id", adAccountId);
    const { data: campaigns } = await campQuery;
    context.metaCampaigns = campaigns || [];

    const { data: metaInsights } = await supabase
      .from("meta_ad_insights")
      .select("meta_campaign_id, spend_cents, impressions, clicks, conversions, roas, date_start")
      .eq("tenant_id", tenantId)
      .gte("date_start", sevenDaysAgo)
      .limit(200);
    context.metaInsights = metaInsights || [];
  }

  // Get products summary
  const { data: products } = await supabase
    .from("products")
    .select("name, price, cost_price, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(10);
  context.topProducts = products || [];

  // Get order stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("total, payment_status")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo);
  
  const paidOrders = (orders || []).filter((o: any) => o.payment_status === "paid");
  context.orderStats = {
    total: orders?.length || 0,
    paid: paidOrders.length,
    revenue: paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
    avgTicket: paidOrders.length ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length) : 0,
  };

  return context;
}

// ============ SYSTEM PROMPT ============

function buildSystemPrompt(scope: string, adAccountId?: string, channel?: string, context?: any) {
  const scopeDesc = scope === "account"
    ? `Você está focado na conta de anúncios ${adAccountId} (${channel || "multi-channel"}).`
    : "Você tem visão global de todas as contas de anúncios do tenant.";

  const configs = context?.accountConfigs || [];
  const configSummary = configs.map((c: any) => 
    `- ${c.channel} / ${c.ad_account_id}: IA ${c.is_ai_enabled ? "✅" : "❌"}, Budget R$ ${((c.budget_cents || 0) / 100).toFixed(2)}, ROI alvo ${c.target_roi || "N/D"}, Estratégia: ${c.strategy_mode || "balanced"}`
  ).join("\n");

  const campaigns = context?.metaCampaigns || [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === "ACTIVE");
  const pausedCampaigns = campaigns.filter((c: any) => c.status === "PAUSED");

  const recentActions = (context?.recentActions || []).slice(0, 10).map((a: any) =>
    `- [${a.created_at?.split("T")[0]}] ${a.action_type} (${a.channel}) → ${a.status}: ${a.reasoning?.substring(0, 80) || ""}`
  ).join("\n");

  const openInsights = (context?.openInsights || []).map((i: any) =>
    `- [${i.priority}] ${i.title}: ${i.body?.substring(0, 100)}`
  ).join("\n");

  return `Você é um consultor sênior de tráfego pago e gestor de anúncios da loja "${context?.storeName || "Loja"}".
${scopeDesc}

## SEU PAPEL
- Responder perguntas sobre performance de campanhas
- Sugerir estratégias e otimizações
- Gerar relatórios e análises quando solicitado
- Aconselhar sobre orçamento, público-alvo e criativos
- Explicar decisões da IA de tráfego (Motor Guardião e Estrategista)
- Realizar auditorias completas quando solicitado

## CONTEXTO ATUAL

### Configurações das Contas
${configSummary || "Nenhuma configuração encontrada."}

### Campanhas
- Ativas: ${activeCampaigns.length}
- Pausadas: ${pausedCampaigns.length}
- Total: ${campaigns.length}

### Vendas (30d)
- Pedidos pagos: ${context?.orderStats?.paid || 0}
- Receita: R$ ${((context?.orderStats?.revenue || 0) / 100).toFixed(2)}
- Ticket médio: R$ ${((context?.orderStats?.avgTicket || 0) / 100).toFixed(2)}

### Ações Recentes da IA
${recentActions || "Nenhuma ação recente."}

### Insights Abertos
${openInsights || "Nenhum insight aberto."}

## REGRAS
- Use dados reais do contexto acima para fundamentar respostas
- Formate respostas em Markdown para boa legibilidade
- Ao sugerir alterações de budget, respeite os limites: Meta ±20%/48h, Google ±20%/7d, TikTok ±15%/48h
- Todas as alterações de budget devem ser agendadas para 00:01 BRT
- NUNCA sugira deletar campanhas — apenas pausar
- Diferencie público frio de quente nas análises
- Ao ser perguntado sobre auditoria, analise TODAS as campanhas em profundidade
- Responda SEMPRE em Português do Brasil`;
}
