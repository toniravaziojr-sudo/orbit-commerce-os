import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Full pipeline with allocator + planner + policy layer
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TYPES ============

interface SafetyRules {
  gross_margin_pct: number;
  max_cpa_cents: number | null;
  min_roas: number;
  max_budget_change_pct_day: number;
  max_actions_per_session: number;
  allowed_actions: string[];
}

interface AutopilotConfig {
  id: string;
  tenant_id: string;
  channel: string;
  is_enabled: boolean;
  budget_mode: string;
  budget_cents: number;
  allocation_mode: string;
  max_share_pct: number;
  min_share_pct: number;
  objective: string;
  user_instructions: string | null;
  ai_model: string;
  safety_rules: SafetyRules;
  lock_session_id: string | null;
  lock_expires_at: string | null;
}

// ============ HELPER FUNCTIONS ============

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string, code?: string) {
  return new Response(JSON.stringify({ success: false, error, code }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ PRE-CHECK INTEGRATIONS ============

async function preCheckIntegrations(supabase: any, tenantId: string, enabledChannels: string[]) {
  const status: Record<string, { connected: boolean; reason?: string }> = {};

  for (const channel of enabledChannels) {
    if (channel === "meta") {
      const { data } = await supabase
        .from("marketplace_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("platform", "meta")
        .eq("status", "active")
        .maybeSingle();
      status.meta = data ? { connected: true } : { connected: false, reason: "Meta não conectada. Vá em Integrações para conectar." };
    }

    if (channel === "google") {
      const { data } = await supabase
        .from("google_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) {
        status.google = { connected: false, reason: "Google não conectado. Vá em Integrações para conectar." };
      } else {
        // Check developer token
        const { data: cred } = await supabase
          .from("platform_credentials")
          .select("credential_value")
          .eq("credential_key", "GOOGLE_ADS_DEVELOPER_TOKEN")
          .maybeSingle();
        status.google = cred?.credential_value
          ? { connected: true }
          : { connected: false, reason: "Developer Token do Google Ads não configurado." };
      }
    }

    if (channel === "tiktok") {
      const { data } = await supabase
        .from("tiktok_ads_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      status.tiktok = data ? { connected: true } : { connected: false, reason: "TikTok Ads não conectado." };
    }
  }

  return status;
}

// ============ CONTEXT COLLECTOR ============

async function collectContext(supabase: any, tenantId: string, enabledChannels: string[]) {
  // Products - top 20 by sales
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, cost_price, status, stock_quantity, product_type, brand")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Orders - last 30 days summary
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  const orderStats = {
    total_orders: orders?.length || 0,
    total_revenue_cents: orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0,
    avg_ticket_cents: orders?.length ? Math.round(orders.reduce((s: number, o: any) => s + (o.total || 0), 0) / orders.length) : 0,
    paid_orders: orders?.filter((o: any) => o.status === "paid" || o.status === "delivered")?.length || 0,
  };

  // Meta campaigns + insights (if enabled)
  let metaCampaigns: any[] = [];
  let metaInsights: any[] = [];
  if (enabledChannels.includes("meta")) {
    const { data: mc } = await supabase
      .from("meta_ad_campaigns")
      .select("meta_campaign_id, name, status, objective, daily_budget_cents")
      .eq("tenant_id", tenantId)
      .limit(50);
    metaCampaigns = mc || [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: mi } = await supabase
      .from("meta_ad_insights")
      .select("meta_campaign_id, impressions, clicks, spend_cents, reach, ctr, conversions, roas, date_start")
      .eq("tenant_id", tenantId)
      .gte("date_start", sevenDaysAgo)
      .limit(200);
    metaInsights = mi || [];
  }

  // Google campaigns + insights (if enabled)
  let googleCampaigns: any[] = [];
  let googleInsights: any[] = [];
  if (enabledChannels.includes("google")) {
    const { data: gc } = await supabase
      .from("google_ad_campaigns")
      .select("google_campaign_id, name, status, advertising_channel_type, budget_amount_micros")
      .eq("tenant_id", tenantId)
      .limit(50);
    googleCampaigns = gc || [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: gi } = await supabase
      .from("google_ad_insights")
      .select("google_campaign_id, impressions, clicks, cost_micros, conversions, conversions_value_micros, ctr, date_range_start")
      .eq("tenant_id", tenantId)
      .gte("date_range_start", sevenDaysAgo)
      .limit(200);
    googleInsights = gi || [];
  }

  // TikTok campaigns + insights (if enabled)
  let tiktokCampaigns: any[] = [];
  let tiktokInsights: any[] = [];
  if (enabledChannels.includes("tiktok")) {
    const { data: tc } = await supabase
      .from("tiktok_ad_campaigns")
      .select("tiktok_campaign_id, name, status, objective_type, budget_cents")
      .eq("tenant_id", tenantId)
      .limit(50);
    tiktokCampaigns = tc || [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: ti } = await supabase
      .from("tiktok_ad_insights")
      .select("tiktok_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, date_start")
      .eq("tenant_id", tenantId)
      .gte("date_start", sevenDaysAgo)
      .limit(200);
    tiktokInsights = ti || [];
  }

  return {
    products: products || [],
    orderStats,
    meta: { campaigns: metaCampaigns, insights: metaInsights },
    google: { campaigns: googleCampaigns, insights: googleInsights },
    tiktok: { campaigns: tiktokCampaigns, insights: tiktokInsights },
  };
}

// ============ POLICY VALIDATION ============

function validateAction(action: any, globalConfig: AutopilotConfig, channelConfig: AutopilotConfig | null): { valid: boolean; reason?: string } {
  const rules = globalConfig.safety_rules;

  // Check if action type is allowed
  if (!rules.allowed_actions.includes(action.name)) {
    return { valid: false, reason: `Ação '${action.name}' não está habilitada na fase atual do rollout.` };
  }

  // Budget change limits
  if (action.name === "adjust_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    if (args.change_pct && Math.abs(args.change_pct) > rules.max_budget_change_pct_day) {
      return { valid: false, reason: `Alteração de ${args.change_pct}% excede o limite de ±${rules.max_budget_change_pct_day}%/dia.` };
    }
  }

  // Allocate budget - validate shares
  if (action.name === "allocate_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    const total = (args.meta_pct || 0) + (args.google_pct || 0) + (args.tiktok_pct || 0);
    if (total > 100) {
      return { valid: false, reason: `Alocação total de ${total}% excede 100%.` };
    }
  }

  return { valid: true };
}

// ============ AI CALL ============

async function callAI(messages: any[], tools: any[], model: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ads-autopilot][${VERSION}] AI error: ${response.status} ${text}`);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  return response.json();
}

// ============ TOOLS DEFINITIONS ============

const ALLOCATOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "allocate_budget",
      description: "Distribui o orçamento total entre os canais de anúncio baseado em performance.",
      parameters: {
        type: "object",
        properties: {
          meta_pct: { type: "number", description: "Percentual do orçamento para Meta Ads (0-100)" },
          google_pct: { type: "number", description: "Percentual do orçamento para Google Ads (0-100)" },
          tiktok_pct: { type: "number", description: "Percentual do orçamento para TikTok Ads (0-100)" },
          reasoning: { type: "string", description: "Explicação da decisão de alocação" },
        },
        required: ["meta_pct", "google_pct", "tiktok_pct", "reasoning"],
        additionalProperties: false,
      },
    },
  },
];

const PLANNER_TOOLS = [
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "Pausa uma campanha com baixo desempenho.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha na plataforma" },
          reason: { type: "string", description: "Motivo para pausar" },
          expected_impact: { type: "string", description: "Impacto esperado" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          metric_trigger: { type: "string", description: "Métrica que motivou" },
        },
        required: ["campaign_id", "reason", "expected_impact", "confidence", "metric_trigger"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_budget",
      description: "Ajusta o orçamento de uma campanha.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha" },
          new_budget_cents: { type: "number", description: "Novo orçamento em centavos" },
          change_pct: { type: "number", description: "Percentual de mudança" },
          reason: { type: "string", description: "Motivo do ajuste" },
          expected_impact: { type: "string", description: "Impacto esperado" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          metric_trigger: { type: "string", description: "Métrica que motivou" },
        },
        required: ["campaign_id", "new_budget_cents", "reason", "expected_impact", "confidence", "metric_trigger"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_insight",
      description: "Reporta um insight ou recomendação sem executar ação.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resumo do insight" },
          recommendations: { type: "array", items: { type: "string" }, description: "Lista de recomendações" },
          risk_alerts: { type: "array", items: { type: "string" }, description: "Alertas de risco" },
        },
        required: ["summary", "recommendations"],
        additionalProperties: false,
      },
    },
  },
];

// ============ SYSTEM PROMPTS ============

function buildAllocatorPrompt(globalConfig: AutopilotConfig) {
  return `Você é um media buyer profissional especializado em alocação de orçamento cross-channel.

ORÇAMENTO TOTAL: R$ ${(globalConfig.budget_cents / 100).toFixed(2)} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"}
OBJETIVO: ${globalConfig.objective}
MARGEM BRUTA: ${globalConfig.safety_rules.gross_margin_pct}%
ROAS MÍNIMO: ${globalConfig.safety_rules.min_roas}

${globalConfig.user_instructions ? `INSTRUÇÕES DO LOJISTA:\n${globalConfig.user_instructions}` : ""}

REGRAS:
- Aloque 0% para canais sem dados ou sem conexão
- Priorize canais com melhor ROAS marginal
- Considere escala: canais com mais espaço para crescimento
- A soma DEVE ser exatamente 100% (ou menos se canais bloqueados)
- Cada canal tem limites min/max configurados

Use a tool 'allocate_budget' para retornar a alocação.`;
}

function buildPlannerPrompt(channel: string, globalConfig: AutopilotConfig, channelBudgetCents: number) {
  return `Você é um media buyer profissional especializado em ${channel === "meta" ? "Meta (Facebook/Instagram)" : channel === "google" ? "Google Ads" : "TikTok"} Ads.

ORÇAMENTO PARA ESTE CANAL: R$ ${(channelBudgetCents / 100).toFixed(2)} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"}
OBJETIVO: ${globalConfig.objective}
MARGEM BRUTA: ${globalConfig.safety_rules.gross_margin_pct}%
ROAS MÍNIMO: ${globalConfig.safety_rules.min_roas}
${globalConfig.safety_rules.max_cpa_cents ? `CPA MÁXIMO: R$ ${(globalConfig.safety_rules.max_cpa_cents / 100).toFixed(2)}` : ""}

${globalConfig.user_instructions ? `INSTRUÇÕES DO LOJISTA:\n${globalConfig.user_instructions}` : ""}

REGRAS OBRIGATÓRIAS:
- NUNCA deletar campanhas, apenas pausar
- Alterações de budget limitadas a ±${globalConfig.safety_rules.max_budget_change_pct_day}% por dia
- Máximo ${globalConfig.safety_rules.max_actions_per_session} ações por sessão
- Toda ação deve ter justificativa baseada em métricas
- Se não houver dados suficientes, use report_insight para recomendar

Analise as campanhas e métricas e execute as ações necessárias.`;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-analyze][${VERSION}] Request received`);

  try {
    const { tenant_id, trigger_type = "manual" } = await req.json();
    if (!tenant_id) return fail("tenant_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // ---- Load configs ----
    const { data: configs } = await supabase
      .from("ads_autopilot_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    const globalConfig = configs?.find((c: any) => c.channel === "global") as AutopilotConfig | undefined;
    if (!globalConfig || !globalConfig.is_enabled) {
      return fail("Piloto Automático não está ativo. Configure e ative primeiro.");
    }

    const channelConfigs = (configs || []).filter((c: any) => c.channel !== "global" && c.is_enabled) as AutopilotConfig[];
    const enabledChannels = channelConfigs.map((c) => c.channel);

    if (enabledChannels.length === 0) {
      return fail("Nenhum canal habilitado. Ative pelo menos um canal.");
    }

    // ---- ETAPA 0: Pre-check ----
    const integrationStatus = await preCheckIntegrations(supabase, tenant_id, enabledChannels);
    const connectedChannels = enabledChannels.filter((ch) => integrationStatus[ch]?.connected);

    if (connectedChannels.length === 0) {
      // Create session with BLOCKED status
      const { data: session } = await supabase.from("ads_autopilot_sessions").insert({
        tenant_id,
        channel: "global",
        trigger_type,
        integration_status: integrationStatus,
        insights_generated: { blocked: true, reasons: Object.entries(integrationStatus).map(([ch, s]) => `${ch}: ${s.reason}`) },
      }).select("id").single();

      return ok({
        status: "BLOCKED",
        integration_status: integrationStatus,
        session_id: session?.id,
        message: "Nenhum canal conectado. Verifique as integrações.",
      });
    }

    // ---- ETAPA 1: Lock ----
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    const { data: lockResult, error: lockError } = await supabase
      .from("ads_autopilot_configs")
      .update({ lock_session_id: crypto.randomUUID(), lock_expires_at: lockExpiry })
      .eq("id", globalConfig.id)
      .or(`lock_session_id.is.null,lock_expires_at.lt.${new Date().toISOString()}`)
      .select("lock_session_id")
      .single();

    if (lockError || !lockResult) {
      return fail("Já existe uma análise em andamento. Aguarde a conclusão.");
    }

    const sessionLockId = lockResult.lock_session_id;

    try {
      // ---- ETAPA 2: Context Collector ----
      const context = await collectContext(supabase, tenant_id, connectedChannels);

      // ---- Create session ----
      const { data: session } = await supabase.from("ads_autopilot_sessions").insert({
        tenant_id,
        channel: "global",
        trigger_type,
        context_snapshot: context,
        integration_status: integrationStatus,
      }).select("id").single();

      const sessionId = session!.id;
      let totalActionsPlanned = 0;
      let totalActionsExecuted = 0;
      let totalActionsRejected = 0;
      const allInsights: any[] = [];

      // ---- ETAPA 3: Allocator ----
      let allocation: Record<string, number> = {};

      if (connectedChannels.length > 1 && globalConfig.allocation_mode === "auto") {
        const allocatorMessages = [
          { role: "system", content: buildAllocatorPrompt(globalConfig) },
          {
            role: "user",
            content: `Dados de performance dos canais:\n\n${JSON.stringify({
              meta: context.meta.insights.length > 0 ? { campaigns: context.meta.campaigns.length, insights_7d: context.meta.insights.length } : "Sem dados",
              google: context.google.insights.length > 0 ? { campaigns: context.google.campaigns.length, insights_7d: context.google.insights.length } : "Sem dados",
              tiktok: context.tiktok.insights.length > 0 ? { campaigns: context.tiktok.campaigns.length, insights_7d: context.tiktok.insights.length } : "Sem dados",
              order_stats: context.orderStats,
            }, null, 2)}`,
          },
        ];

        const allocatorResponse = await callAI(allocatorMessages, ALLOCATOR_TOOLS, globalConfig.ai_model);
        const toolCalls = allocatorResponse.choices?.[0]?.message?.tool_calls || [];

        for (const tc of toolCalls) {
          if (tc.function.name === "allocate_budget") {
            const args = JSON.parse(tc.function.arguments);
            const validation = validateAction(tc.function, globalConfig, null);

            allocation = {
              meta: args.meta_pct || 0,
              google: args.google_pct || 0,
              tiktok: args.tiktok_pct || 0,
            };

            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel: "global",
              action_type: "allocate_budget",
              action_data: args,
              reasoning: args.reasoning,
              expected_impact: "Redistribuição de orçamento cross-channel",
              confidence: "high",
              metric_trigger: "performance_analysis",
              status: validation.valid ? "executed" : "rejected",
              rejection_reason: validation.reason || null,
              action_hash: `${sessionId}_allocate_budget_global`,
            });

            totalActionsPlanned++;
            if (validation.valid) totalActionsExecuted++;
            else totalActionsRejected++;
          }
        }
      } else {
        // Single channel or manual allocation — give 100% to the single connected channel
        for (const ch of connectedChannels) {
          allocation[ch] = connectedChannels.length === 1 ? 100 : (100 / connectedChannels.length);
        }
      }

      // ---- ETAPA 4: Planner per channel ----
      for (const channel of connectedChannels) {
        const channelBudgetCents = Math.round(globalConfig.budget_cents * (allocation[channel] || 0) / 100);
        if (channelBudgetCents === 0) continue;

        const channelData = channel === "meta" ? context.meta : channel === "google" ? context.google : context.tiktok;

        const plannerMessages = [
          { role: "system", content: buildPlannerPrompt(channel, globalConfig, channelBudgetCents) },
          {
            role: "user",
            content: `Dados do canal ${channel}:\n\nCampanhas: ${JSON.stringify(channelData.campaigns, null, 2)}\n\nInsights 7 dias: ${JSON.stringify(channelData.insights.slice(0, 30), null, 2)}\n\nProdutos top: ${JSON.stringify(context.products.slice(0, 10).map((p: any) => ({ name: p.name, price: p.price, stock: p.stock_quantity })), null, 2)}\n\nEstatísticas de vendas: ${JSON.stringify(context.orderStats)}`,
          },
        ];

        const plannerResponse = await callAI(plannerMessages, PLANNER_TOOLS, globalConfig.ai_model);
        const toolCalls = plannerResponse.choices?.[0]?.message?.tool_calls || [];

        // Also save raw AI response
        const aiText = plannerResponse.choices?.[0]?.message?.content || "";

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const validation = validateAction(tc.function, globalConfig, channelConfigs.find((c) => c.channel === channel) || null);

          totalActionsPlanned++;

          if (tc.function.name === "report_insight") {
            allInsights.push(args);
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel,
              action_type: "report_insight",
              action_data: args,
              reasoning: args.summary,
              status: "executed",
              action_hash: `${sessionId}_report_insight_${channel}_${totalActionsPlanned}`,
            });
            totalActionsExecuted++;
            continue;
          }

          const actionRecord: any = {
            tenant_id,
            session_id: sessionId,
            channel,
            action_type: tc.function.name,
            action_data: args,
            reasoning: args.reason || args.reasoning || "",
            expected_impact: args.expected_impact || "",
            confidence: args.confidence || "medium",
            metric_trigger: args.metric_trigger || "",
            status: validation.valid ? "validated" : "rejected",
            rejection_reason: validation.reason || null,
            action_hash: `${sessionId}_${tc.function.name}_${channel}_${args.campaign_id || totalActionsPlanned}`,
          };

          // ETAPA 5: Execute validated actions
          if (validation.valid) {
            try {
              if (tc.function.name === "pause_campaign") {
                const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
                const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";
                
                // Store rollback data
                actionRecord.rollback_data = { previous_status: "ACTIVE" };

                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { tenant_id, action: "update", [idField]: args.campaign_id, status: "PAUSED" },
                });
                
                if (error) throw error;
                actionRecord.status = "executed";
                actionRecord.executed_at = new Date().toISOString();
                totalActionsExecuted++;
              } else if (tc.function.name === "adjust_budget") {
                const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
                const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";
                const budgetField = channel === "meta" ? "daily_budget_cents" : "budget_cents";

                actionRecord.rollback_data = { previous_budget_cents: args.previous_budget_cents };

                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { tenant_id, action: "update", [idField]: args.campaign_id, [budgetField]: args.new_budget_cents },
                });

                if (error) throw error;
                actionRecord.status = "executed";
                actionRecord.executed_at = new Date().toISOString();
                totalActionsExecuted++;
              } else {
                // Unknown action type, mark as validated but not executed
                actionRecord.status = "validated";
              }
            } catch (execErr: any) {
              actionRecord.status = "failed";
              actionRecord.error_message = execErr.message || "Erro ao executar ação";
            }
          } else {
            totalActionsRejected++;
          }

          await supabase.from("ads_autopilot_actions").insert(actionRecord);
        }

        // Save planner AI response text to session
        if (aiText) {
          await supabase.from("ads_autopilot_sessions").insert({
            tenant_id,
            channel,
            trigger_type,
            context_snapshot: channelData,
            ai_response_raw: aiText,
            actions_planned: toolCalls.length,
          });
        }
      }

      // ---- Update global session ----
      const durationMs = Date.now() - startTime;
      await supabase.from("ads_autopilot_sessions").update({
        actions_planned: totalActionsPlanned,
        actions_executed: totalActionsExecuted,
        actions_rejected: totalActionsRejected,
        insights_generated: allInsights.length > 0 ? allInsights : null,
        duration_ms: durationMs,
      }).eq("id", sessionId);

      // Update config stats
      await supabase.from("ads_autopilot_configs").update({
        last_analysis_at: new Date().toISOString(),
        total_actions_executed: (globalConfig.total_actions_executed || 0) + totalActionsExecuted,
      }).eq("id", globalConfig.id);

      return ok({
        session_id: sessionId,
        status: "completed",
        allocation,
        integration_status: integrationStatus,
        actions: { planned: totalActionsPlanned, executed: totalActionsExecuted, rejected: totalActionsRejected },
        insights: allInsights,
        duration_ms: durationMs,
      });
    } finally {
      // ---- Release lock ----
      await supabase.from("ads_autopilot_configs").update({
        lock_session_id: null,
        lock_expires_at: null,
      }).eq("id", globalConfig.id).eq("lock_session_id", sessionLockId);
    }
  } catch (err: any) {
    console.error(`[ads-autopilot-analyze][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
