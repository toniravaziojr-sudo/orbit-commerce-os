import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.1.0"; // Fix tool calling flow - inject results as context
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TOOL DEFINITIONS ============

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_campaign_performance",
      description: "Busca performance real das campanhas (métricas dos últimos 7 dias). Use para responder sobre performance, ROAS, CPA, etc.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta de anúncios (opcional, busca todas se omitido)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_creative_assets",
      description: "Lista os criativos existentes (imagens/copy gerados). Use para verificar status de criativos.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "ready", "active", "rejected"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_creative_generation",
      description: "Dispara a geração REAL de briefs criativos (headlines + copy) para os top produtos por receita. NÃO gera imagens diretamente — gera os briefs que depois podem ter imagens geradas. Só use quando o usuário explicitamente pedir para gerar criativos.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_autopilot_analysis",
      description: "Dispara uma análise completa do Autopilot (Motor Guardião). Só use quando o usuário pedir para rodar uma análise ou auditoria.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "google", "tiktok"], description: "Canal para análise" },
        },
        required: ["channel"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_actions",
      description: "Lista as ações executadas ou agendadas pelo Autopilot. Use para mostrar o que a IA de tráfego está fazendo de verdade.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["scheduled", "executed", "failed", "pending_approval"], description: "Filtrar por status" },
          limit: { type: "number", description: "Quantidade de ações (default 15)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_insights",
      description: "Lista os insights e diagnósticos gerados pelo Autopilot.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "resolved"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ============ TOOL EXECUTORS ============

async function executeTool(
  supabase: any,
  tenantId: string,
  toolName: string,
  args: any
): Promise<string> {
  try {
    switch (toolName) {
      case "get_campaign_performance":
        return await getCampaignPerformance(supabase, tenantId, args.ad_account_id);
      case "get_creative_assets":
        return await getCreativeAssets(supabase, tenantId, args.status);
      case "trigger_creative_generation":
        return await triggerCreativeGeneration(supabase, tenantId);
      case "trigger_autopilot_analysis":
        return await triggerAutopilotAnalysis(supabase, tenantId, args.channel);
      case "get_autopilot_actions":
        return await getAutopilotActions(supabase, tenantId, args.status, args.limit);
      case "get_autopilot_insights":
        return await getAutopilotInsights(supabase, tenantId, args.status);
      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`[ads-chat][${VERSION}] Tool error (${toolName}):`, err);
    return JSON.stringify({ error: err.message || "Erro ao executar ferramenta" });
  }
}

async function getCampaignPerformance(supabase: any, tenantId: string, adAccountId?: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  // Get campaigns
  const campQuery = supabase
    .from("meta_ad_campaigns")
    .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
    .eq("tenant_id", tenantId);
  if (adAccountId) campQuery.eq("ad_account_id", adAccountId);
  const { data: campaigns } = await campQuery.limit(30);

  // Get insights
  const insightQuery = supabase
    .from("meta_ad_insights")
    .select("meta_campaign_id, spend_cents, impressions, clicks, conversions, roas, ctr, cpc_cents, cpm_cents, date_start")
    .eq("tenant_id", tenantId)
    .gte("date_start", sevenDaysAgo);
  const { data: insights } = await insightQuery.limit(500);

  // Aggregate per campaign
  const campMap: Record<string, any> = {};
  for (const c of (campaigns || [])) {
    campMap[c.meta_campaign_id] = {
      name: c.name,
      status: c.status,
      objective: c.objective,
      daily_budget: `R$ ${((c.daily_budget_cents || 0) / 100).toFixed(2)}`,
      spend_7d: 0,
      impressions_7d: 0,
      clicks_7d: 0,
      conversions_7d: 0,
      roas_avg: 0,
      days_with_data: 0,
    };
  }

  for (const i of (insights || [])) {
    const c = campMap[i.meta_campaign_id];
    if (!c) continue;
    c.spend_7d += (i.spend_cents || 0) / 100;
    c.impressions_7d += i.impressions || 0;
    c.clicks_7d += i.clicks || 0;
    c.conversions_7d += i.conversions || 0;
    c.days_with_data += 1;
    if (i.roas) c.roas_avg = i.roas; // simplification, last value
  }

  const result = Object.values(campMap).map((c: any) => ({
    ...c,
    spend_7d: `R$ ${c.spend_7d.toFixed(2)}`,
    cpa: c.conversions_7d > 0 ? `R$ ${(c.spend_7d / c.conversions_7d).toFixed(2)}` : "N/A",
  }));

  return JSON.stringify({
    total_campaigns: campaigns?.length || 0,
    active: (campaigns || []).filter((c: any) => c.status === "ACTIVE").length,
    paused: (campaigns || []).filter((c: any) => c.status === "PAUSED").length,
    campaigns: result,
  });
}

async function getCreativeAssets(supabase: any, tenantId: string, status?: string) {
  const query = supabase
    .from("ads_creative_assets")
    .select("id, headline, copy_text, format, status, angle, channel, asset_url, storage_path, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (status) query.eq("status", status);
  const { data, error } = await query;

  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({
    total: data?.length || 0,
    assets: (data || []).map((a: any) => ({
      id: a.id,
      headline: a.headline,
      copy: a.copy_text?.substring(0, 100),
      format: a.format,
      status: a.status,
      angle: a.angle,
      channel: a.channel,
      has_image: !!(a.asset_url || a.storage_path),
      created_at: a.created_at,
    })),
  });
}

async function triggerCreativeGeneration(supabase: any, tenantId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-creative-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });

    const result = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { raw: result };
    }

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: `Falha ao gerar criativos (HTTP ${response.status})`,
        details: parsed,
      });
    }

    return JSON.stringify({
      success: true,
      message: "Geração de briefs criativos disparada com sucesso. Os resultados aparecerão na aba de criativos.",
      details: parsed,
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

async function triggerAutopilotAnalysis(supabase: any, tenantId: string, channel: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ tenant_id: tenantId, channel, trigger_type: "manual" }),
    });

    const result = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { raw: result };
    }

    return JSON.stringify({
      success: response.ok,
      message: response.ok
        ? `Análise do Autopilot (${channel}) disparada. Verifique as ações e insights em instantes.`
        : `Falha ao disparar análise (HTTP ${response.status})`,
      details: parsed,
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

async function getAutopilotActions(supabase: any, tenantId: string, status?: string, limit?: number) {
  const query = supabase
    .from("ads_autopilot_actions")
    .select("id, action_type, channel, status, reasoning, confidence, error_message, executed_at, created_at, action_data")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit || 15);
  if (status) query.eq("status", status);
  const { data, error } = await query;

  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({
    total: data?.length || 0,
    actions: (data || []).map((a: any) => ({
      action_type: a.action_type,
      channel: a.channel,
      status: a.status,
      reasoning: a.reasoning?.substring(0, 200),
      confidence: a.confidence,
      error: a.error_message,
      campaign_name: a.action_data?.campaign_name,
      daily_budget: a.action_data?.daily_budget_cents ? `R$ ${(a.action_data.daily_budget_cents / 100).toFixed(2)}` : null,
      executed_at: a.executed_at,
      created_at: a.created_at,
    })),
  });
}

async function getAutopilotInsights(supabase: any, tenantId: string, status?: string) {
  const query = supabase
    .from("ads_autopilot_insights")
    .select("id, title, body, category, priority, sentiment, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (status) query.eq("status", status);
  const { data, error } = await query;

  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({ total: data?.length || 0, insights: data || [] });
}

// ============ CONTEXT COLLECTOR ============

async function collectBaseContext(supabase: any, tenantId: string, scope: string, adAccountId?: string, channel?: string) {
  const context: any = {};

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .single();
  context.storeName = tenant?.name || "Loja";

  // Account configs summary
  const configQuery = supabase
    .from("ads_autopilot_account_configs")
    .select("channel, ad_account_id, is_ai_enabled, budget_cents, target_roi, strategy_mode, funnel_splits")
    .eq("tenant_id", tenantId);
  if (scope === "account" && adAccountId) configQuery.eq("ad_account_id", adAccountId);
  const { data: configs } = await configQuery;
  context.accountConfigs = configs || [];

  // Quick order stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("total, payment_status")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo);
  const paid = (orders || []).filter((o: any) => o.payment_status === "paid");
  context.orderStats = {
    paid: paid.length,
    revenue_brl: (paid.reduce((s: number, o: any) => s + (o.total || 0), 0) / 100).toFixed(2),
    avg_ticket_brl: paid.length ? (paid.reduce((s: number, o: any) => s + (o.total || 0), 0) / paid.length / 100).toFixed(2) : "0",
  };

  return context;
}

// ============ SYSTEM PROMPT ============

function buildSystemPrompt(scope: string, adAccountId?: string, channel?: string, context?: any) {
  const scopeDesc = scope === "account"
    ? `Focado na conta ${adAccountId} (${channel || "multi-channel"}).`
    : "Visão global de todas as contas.";

  const configs = context?.accountConfigs || [];
  const configSummary = configs.map((c: any) =>
    `- ${c.channel} / ${c.ad_account_id}: IA ${c.is_ai_enabled ? "ON" : "OFF"}, Budget R$ ${((c.budget_cents || 0) / 100).toFixed(2)}/dia, ROI alvo ${c.target_roi || "N/D"}, Splits: ${JSON.stringify(c.funnel_splits || {})}`
  ).join("\n");

  return `Você é o assistente de tráfego pago da loja "${context?.storeName}". ${scopeDesc}

## REGRA SUPREMA: HONESTIDADE ABSOLUTA
- Você NUNCA mente, inventa ou alucina.
- Se você NÃO SABE algo, diga "Não tenho essa informação agora."
- Se você NÃO PODE fazer algo, diga "Não consigo fazer isso diretamente."
- NUNCA finja que está gerando imagens, renderizando artes, fazendo upload ou qualquer processo que você não está executando de fato.
- NUNCA diga frases como "estou finalizando", "estou renderizando", "estou processando" se não estiver de fato executando uma ferramenta.
- Suas únicas capacidades de execução são as FERRAMENTAS listadas abaixo. Tudo que não está nas ferramentas, você NÃO PODE FAZER.

## SUAS FERRAMENTAS (o que você PODE fazer de verdade)
1. **get_campaign_performance** → Buscar métricas reais de campanhas (spend, ROAS, CPA, impressões, cliques, conversões)
2. **get_creative_assets** → Listar criativos existentes e seus status
3. **trigger_creative_generation** → Disparar geração de BRIEFS criativos (headlines + copy) para top produtos. Isso NÃO gera imagens — gera textos para anúncios.
4. **trigger_autopilot_analysis** → Disparar uma análise do Autopilot para um canal
5. **get_autopilot_actions** → Ver ações reais executadas/agendadas pela IA
6. **get_autopilot_insights** → Ver insights e diagnósticos reais

## O QUE VOCÊ NÃO PODE FAZER
- Não pode gerar imagens diretamente
- Não pode fazer upload de mídia para a Meta/Google/TikTok
- Não pode criar campanhas diretamente (quem faz é o Autopilot via trigger_autopilot_analysis)
- Não pode alterar orçamentos diretamente
- Não pode acessar a API da Meta/Google/TikTok diretamente

## CONTEXTO ATUAL
### Configurações
${configSummary || "Nenhuma conta configurada."}

### Vendas (30d)
- Pedidos pagos: ${context?.orderStats?.paid || 0}
- Receita: R$ ${context?.orderStats?.revenue_brl || "0.00"}
- Ticket médio: R$ ${context?.orderStats?.avg_ticket_brl || "0.00"}

## ESTILO
- Respostas diretas, objetivas e em Português BR
- Use Markdown para formatação
- Sempre baseie suas respostas nos dados REAIS das ferramentas
- Quando o usuário perguntar sobre performance, USE a ferramenta get_campaign_performance
- Quando pedir criativos, USE trigger_creative_generation e informe que são BRIEFS (textos), não imagens
- Quando pedir análise, USE trigger_autopilot_analysis`;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-chat][${VERSION}] Request received`);

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

    // Load conversation history (only text messages, not tool calls for simplicity)
    const { data: history } = await supabase
      .from("ads_chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .not("content", "is", null)
      .order("created_at", { ascending: true })
      .limit(30);

    // Collect base context
    const context = await collectBaseContext(supabase, tenant_id, scope, ad_account_id, channel);

    const systemPrompt = buildSystemPrompt(scope, ad_account_id, channel, context);

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // === STEP 1: Non-streaming call WITH tools to get tool calls or direct response ===
    const initialResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!initialResponse.ok) {
      const errText = await initialResponse.text();
      console.error(`[ads-chat][${VERSION}] AI error: ${initialResponse.status} ${errText}`);
      if (initialResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (initialResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${initialResponse.status}`);
    }

    const initialResult = await initialResponse.json();
    const firstChoice = initialResult.choices?.[0];

    if (!firstChoice) throw new Error("Empty AI response");

    // Check if there are tool calls
    const toolCalls = firstChoice.message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      console.log(`[ads-chat][${VERSION}] Tool calls: ${toolCalls.map((t: any) => t.function.name).join(", ")}`);

      // Execute all tool calls and collect results
      const toolResults: string[] = [];
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch { /* empty args */ }

        const result = await executeTool(supabase, tenant_id, tc.function.name, args);
        toolResults.push(`[Resultado de ${tc.function.name}]:\n${result}`);

        // Save tool call to DB
        await supabase.from("ads_chat_messages").insert({
          conversation_id: convId,
          tenant_id,
          role: "assistant",
          content: null,
          tool_calls: [{ id: tc.id, function: { name: tc.function.name, arguments: tc.function.arguments } }],
        });
      }

      // Build follow-up with tool results as context (avoids tool_call format issues)
      const followUpMessages = [
        ...aiMessages,
        {
          role: "assistant",
          content: "Vou consultar os dados reais do sistema para responder com precisão.",
        },
        {
          role: "user",
          content: `[DADOS REAIS DO SISTEMA — baseie sua resposta EXCLUSIVAMENTE nestes dados]\n\n${toolResults.join("\n\n")}`,
        },
      ];

      const finalAiResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!finalAiResponse.ok) {
        const errText = await finalAiResponse.text();
        throw new Error(`AI final response error: ${finalAiResponse.status} - ${errText}`);
      }

      return streamAndSave(finalAiResponse, supabase, convId, tenant_id, message, history);
    }

    // No tool calls — check if there's a direct text response we can use
    const directContent = firstChoice.message?.content;
    if (directContent) {
      // Save directly and return as SSE
      await supabase.from("ads_chat_messages").insert({
        conversation_id: convId,
        tenant_id,
        role: "assistant",
        content: directContent,
      });

      // Format as SSE for consistent client handling
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: directContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "X-Conversation-Id": convId,
        },
      });
    }

    // Fallback: stream a new call
    const streamResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      throw new Error(`Stream error: ${streamResponse.status}`);
    }

    return streamAndSave(streamResponse, supabase, convId, tenant_id, message, history);
  } catch (e: any) {
    console.error(`[ads-chat][${VERSION}] Error:`, e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============ STREAM & SAVE ============

function streamAndSave(
  aiResponse: Response,
  supabase: any,
  convId: string,
  tenantId: string,
  userMessage: string,
  history: any[] | null
) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();
  let fullContent = "";

  (async () => {
    try {
      const reader = aiResponse.body!.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writer.write(value);

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
          } catch { /* partial */ }
        }
      }

      if (fullContent) {
        await supabase.from("ads_chat_messages").insert({
          conversation_id: convId,
          tenant_id: tenantId,
          role: "assistant",
          content: fullContent,
        });

        if ((history || []).length <= 1) {
          await supabase
            .from("ads_chat_conversations")
            .update({ title: userMessage.substring(0, 60), updated_at: new Date().toISOString() })
            .eq("id", convId);
        }
      }
    } catch (e) {
      console.error(`[ads-chat][${VERSION}] Stream error:`, e);
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
}
