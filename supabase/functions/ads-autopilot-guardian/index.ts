import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v1.1.0"; // Use ai-router for native AI priority
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============ TYPES ============

interface AccountConfig {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string;
  is_ai_enabled: boolean;
  budget_cents: number | null;
  budget_mode: string | null;
  target_roi: number | null;
  min_roi_cold: number | null;
  min_roi_warm: number | null;
  roas_scaling_threshold: number | null;
  user_instructions: string | null;
  strategy_mode: string | null;
  kill_switch: boolean | null;
  human_approval_mode: string | null;
  last_budget_adjusted_at: string | null;
}

// ============ GUARDIAN CYCLES (BRT) ============
// 12:00 → 1st analysis, pause bad performers
// 13:00 → Reactivate paused-at-12h for retest
// 16:00 → Re-evaluate reactivated; pause until 00:01 if still bad
// 00:01 → Execute scheduled budget changes + reactivate overnight pauses

type GuardianCycle = "12h" | "13h" | "16h" | "00h";

function getCurrentBRTHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const brt = utcHour - 3;
  return brt < 0 ? brt + 24 : brt;
}

function detectCycle(): GuardianCycle | null {
  const hour = getCurrentBRTHour();
  if (hour === 12) return "12h";
  if (hour === 13) return "13h";
  if (hour === 16) return "16h";
  if (hour === 0) return "00h";
  return null;
}

// ============ HELPERS ============

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

function getNextSchedulingTime(): string {
  const now = new Date();
  const scheduleDate = new Date(now);
  const brtHour = getCurrentBRTHour();
  
  if (brtHour >= 0 && brtHour < 4) {
    // Inside window — schedule for NOW + 5min
    scheduleDate.setMinutes(scheduleDate.getMinutes() + 5);
  } else {
    // Schedule for next 00:01 BRT (03:01 UTC)
    if (brtHour >= 4) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }
    const randomMinute = 1 + Math.floor(Math.random() * 59);
    scheduleDate.setUTCHours(3, randomMinute, 0, 0);
  }
  
  return scheduleDate.toISOString();
}

// ============ PLATFORM BUDGET LIMITS ============

const PLATFORM_LIMITS: Record<string, { max_change_pct: number; min_interval_hours: number }> = {
  meta: { max_change_pct: 20, min_interval_hours: 48 },
  google: { max_change_pct: 20, min_interval_hours: 168 }, // 7 days
  tiktok: { max_change_pct: 15, min_interval_hours: 48 },
};

function canAdjustBudget(config: AccountConfig): boolean {
  if (!config.last_budget_adjusted_at) return true;
  const limit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const lastAdj = new Date(config.last_budget_adjusted_at).getTime();
  const hoursSince = (Date.now() - lastAdj) / (1000 * 60 * 60);
  return hoursSince >= limit.min_interval_hours;
}

// ============ GUARDIAN TOOLS (restricted) ============

const GUARDIAN_TOOLS = [
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "Pausa campanha com baixo desempenho. Execução IMEDIATA.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          reason: { type: "string" },
          metric_trigger: { type: "string", enum: ["pause_3d_critical", "pause_7d_normal", "pause_indefinite", "guardian_daily"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "reason", "metric_trigger", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_budget",
      description: "Ajusta orçamento. Será AGENDADO para 00:01 BRT. Respeite limites da plataforma.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          current_budget_cents: { type: "number" },
          new_budget_cents: { type: "number" },
          change_pct: { type: "number" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          metric_trigger: { type: "string" },
        },
        required: ["campaign_id", "new_budget_cents", "change_pct", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_insight",
      description: "Reporta insight ou alerta sem executar ação.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } },
          overall_trend: { type: "string", enum: ["improving", "declining", "stable"] },
        },
        required: ["summary", "recommendations"],
        additionalProperties: false,
      },
    },
  },
];

// ============ COLLECT GUARDIAN CONTEXT ============

async function collectGuardianContext(supabase: any, tenantId: string, configs: AccountConfig[]) {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const channels = [...new Set(configs.map(c => c.channel))];
  const channelData: Record<string, any> = {};

  for (const ch of channels) {
    if (ch === "meta") {
      const { data: campaigns } = await supabase
        .from("meta_ad_campaigns")
        .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
        .eq("tenant_id", tenantId)
        .limit(100);

      const { data: insights7d } = await supabase
        .from("meta_ad_insights")
        .select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", sevenDaysAgo)
        .limit(500);

      const { data: insights3d } = await supabase
        .from("meta_ad_insights")
        .select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", threeDaysAgo)
        .limit(300);

      // Build per-campaign perf (7d and 3d)
      const campaignPerf7d: Record<string, any> = {};
      const campaignPerf3d: Record<string, any> = {};
      
      for (const ins of insights7d || []) {
        const cid = ins.meta_campaign_id;
        if (!campaignPerf7d[cid]) campaignPerf7d[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set() };
        campaignPerf7d[cid].spend += ins.spend_cents || 0;
        campaignPerf7d[cid].impressions += ins.impressions || 0;
        campaignPerf7d[cid].clicks += ins.clicks || 0;
        campaignPerf7d[cid].conversions += ins.conversions || 0;
        campaignPerf7d[cid].revenue += (ins.roas || 0) * (ins.spend_cents || 0);
        campaignPerf7d[cid].days.add(ins.date_start);
      }
      for (const ins of insights3d || []) {
        const cid = ins.meta_campaign_id;
        if (!campaignPerf3d[cid]) campaignPerf3d[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set() };
        campaignPerf3d[cid].spend += ins.spend_cents || 0;
        campaignPerf3d[cid].impressions += ins.impressions || 0;
        campaignPerf3d[cid].clicks += ins.clicks || 0;
        campaignPerf3d[cid].conversions += ins.conversions || 0;
        campaignPerf3d[cid].revenue += (ins.roas || 0) * (ins.spend_cents || 0);
        campaignPerf3d[cid].days.add(ins.date_start);
      }

      // Finalize metrics
      for (const perf of [campaignPerf7d, campaignPerf3d]) {
        for (const cid of Object.keys(perf)) {
          const p = perf[cid];
          perf[cid] = {
            ...p,
            days: p.days.size,
            roas: safeDivide(p.revenue, p.spend),
            cpa_cents: safeDivide(p.spend, p.conversions),
            ctr_pct: safeDivide(p.clicks * 100, p.impressions),
          };
        }
      }

      // Campaign → account mapping
      const campaignAccountMap: Record<string, string> = {};
      for (const c of campaigns || []) {
        if (c.ad_account_id) campaignAccountMap[c.meta_campaign_id] = c.ad_account_id;
      }

      channelData.meta = { campaigns: campaigns || [], campaignPerf7d, campaignPerf3d, campaignAccountMap };
    }
    // Google and TikTok follow same pattern — add when needed
  }

  // Get today's guardian actions (to avoid duplicate pauses/reactivations)
  const todayStart = new Date();
  todayStart.setUTCHours(todayStart.getUTCHours() - 3); // Approximate BRT start of day
  todayStart.setHours(0, 0, 0, 0);
  
  const { data: todayActions } = await supabase
    .from("ads_autopilot_actions")
    .select("action_type, action_data, status, channel, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", todayStart.toISOString())
    .in("action_type", ["pause_campaign", "activate_campaign", "adjust_budget"])
    .limit(100);

  return { channels: channelData, todayActions: todayActions || [] };
}

// ============ BUILD GUARDIAN PROMPT ============

function buildGuardianPrompt(cycle: GuardianCycle, config: AccountConfig, context: any) {
  const channelData = context.channels[config.channel];
  if (!channelData) return null;

  // Filter campaigns for this account
  const accountCampaignIds = Object.entries(channelData.campaignAccountMap || {})
    .filter(([_, acctId]) => acctId === config.ad_account_id)
    .map(([campId]) => campId);

  const accountCampaigns = channelData.campaigns.filter((c: any) =>
    accountCampaignIds.includes(c.meta_campaign_id) || c.ad_account_id === config.ad_account_id
  );

  if (accountCampaigns.length === 0) return null;

  const activeCampaigns = accountCampaigns.filter((c: any) => c.status === "ACTIVE");
  const pausedCampaigns = accountCampaigns.filter((c: any) => c.status === "PAUSED");

  const perf7d = channelData.campaignPerf7d || {};
  const perf3d = channelData.campaignPerf3d || {};

  // Today's actions for this account
  const todayAccountActions = context.todayActions.filter((a: any) => 
    a.action_data?.ad_account_id === config.ad_account_id
  );
  const pausedToday = todayAccountActions.filter((a: any) => a.action_type === "pause_campaign" && a.status === "executed");
  const reactivatedToday = todayAccountActions.filter((a: any) => a.action_type === "activate_campaign" && a.status === "executed");

  const minRoiCold = config.min_roi_cold || 0.8;
  const minRoiWarm = config.min_roi_warm || 1.5;
  const roasThreshold = config.roas_scaling_threshold;
  const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const budgetAdjustable = canAdjustBudget(config);

  let cycleInstruction = "";
  switch (cycle) {
    case "12h":
      cycleInstruction = `## CICLO 12:00 — PRIMEIRA ANÁLISE DO DIA
Avalie TODAS as campanhas ativas desta conta.
- Se uma campanha tem ROI < 50% do mínimo (3 dias) → PAUSE IMEDIATA (metric_trigger: "pause_3d_critical")
- Se uma campanha tem ROI < mínimo (7 dias) → PAUSE (metric_trigger: "pause_7d_normal")
- Se uma campanha está OK → Não faça nada, apenas report_insight
- NÃO reative campanhas neste ciclo
- NÃO ajuste budgets neste ciclo (apenas pausas e insights)`;
      break;
    case "13h":
      cycleInstruction = `## CICLO 13:00 — REATIVAÇÃO PARA RETESTE
Campanhas pausadas às 12h devem ser REATIVADAS para reteste.
${pausedToday.length > 0 
  ? `Campanhas pausadas hoje:\n${pausedToday.map((a: any) => `- ${a.action_data?.campaign_id}: ${a.action_data?.reason || "sem motivo"}`).join("\n")}
\nREATIVE estas campanhas usando pause_campaign com status ACTIVE (use adjust_budget com change_pct=0 como sinal de reativação, ou report_insight indicando reativação).`
  : "Nenhuma campanha foi pausada às 12h. Apenas gere um insight de status."}
- NÃO pause novas campanhas neste ciclo
- NÃO ajuste budgets neste ciclo`;
      break;
    case "16h":
      cycleInstruction = `## CICLO 16:00 — REAVALIAÇÃO
Campanhas que foram reativadas às 13h devem ser reavaliadas.
${reactivatedToday.length > 0
  ? `Campanhas reativadas hoje:\n${reactivatedToday.map((a: any) => `- ${a.action_data?.campaign_id}`).join("\n")}
\nSe ainda estão com performance ruim → PAUSE até 00:01 (metric_trigger: "guardian_daily")
Se melhoraram → Mantenha ativas e report_insight`
  : "Nenhuma campanha foi reativada hoje. Faça análise geral e report_insight."}
- Pode pausar campanhas que continuam ruins
- NÃO ajuste budgets neste ciclo (exceto se underspend crítico)`;
      break;
    case "00h":
      cycleInstruction = `## CICLO 00:01 — EXECUÇÃO NOTURNA
1. Campanhas pausadas durante o dia devem ser REAVALIADAS para possível reativação
2. Ajustes de budget agendados serão executados automaticamente pelo sistema
3. Analise se algum ROAS scaling deve ser proposto${budgetAdjustable ? "" : " (⚠️ Intervalo mínimo de ajuste NÃO atingido — NÃO proponha adjust_budget)"}
4. Se ROAS ≥ ${roasThreshold || "threshold"} → Proponha AUMENTO (máx +${platformLimit.max_change_pct}%)
5. Se ROAS < ${roasThreshold || "threshold"} (mas acima de min_roi) → Proponha REDUÇÃO
6. Gere insight resumo do dia`;
      break;
  }

  const campaignsData = accountCampaigns.map((c: any) => {
    const p7 = perf7d[c.meta_campaign_id] || {};
    const p3 = perf3d[c.meta_campaign_id] || {};
    return {
      id: c.meta_campaign_id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budget_cents: c.daily_budget_cents,
      perf_7d: p7.days ? { roas: p7.roas, cpa: p7.cpa_cents, spend: p7.spend, conversions: p7.conversions, ctr: p7.ctr_pct } : null,
      perf_3d: p3.days ? { roas: p3.roas, cpa: p3.cpa_cents, spend: p3.spend, conversions: p3.conversions, ctr: p3.ctr_pct } : null,
    };
  });

  return {
    system: `Você é o Motor Guardião do Autopilot de Tráfego — focado em PROTEÇÃO DE ORÇAMENTO.

## CONTA: ${config.ad_account_id} (${config.channel})
- Orçamento: R$ ${((config.budget_cents || 0) / 100).toFixed(2)} / ${config.budget_mode || "monthly"}
- ROI Mín Frio: ${minRoiCold}x | ROI Mín Quente: ${minRoiWarm}x | ROI Alvo: ${config.target_roi || "N/D"}x
- ROAS Scaling: ${roasThreshold ? roasThreshold + "x" : "Não definido"}
- Estratégia: ${config.strategy_mode || "balanced"}
- Limite de ajuste: ±${platformLimit.max_change_pct}% a cada ${platformLimit.min_interval_hours}h
- Último ajuste de budget: ${config.last_budget_adjusted_at || "Nunca"}
- Pode ajustar budget agora: ${budgetAdjustable ? "SIM" : "NÃO (intervalo não atingido)"}

## REGRAS DO GUARDIÃO
- NUNCA crie campanhas, criativos ou públicos — isso é trabalho do Motor Estrategista
- Foco: pausar ruins, reativar para teste, ajustar budgets (agendados para 00:01)
- Toda ação com justificativa numérica
- Responda SEMPRE em Português do Brasil
- Diferencie público frio de quente

## REGRAS DE PAUSA
- PAUSA CRÍTICA (3d): ROI 3d < 50% do mínimo → IMEDIATO
- PAUSA NORMAL (7d): ROI 7d < mínimo → IMEDIATO
- CICLO DE RECUPERAÇÃO: Após 7d pausada → reativar para teste
- SEGUNDA FALHA: Se falhar novamente → PAUSA INDEFINIDA

${cycleInstruction}

## CAMPANHAS ATIVAS: ${activeCampaigns.length} | PAUSADAS: ${pausedCampaigns.length}`,

    user: `## CAMPANHAS E PERFORMANCE
${JSON.stringify(campaignsData, null, 2)}

## AÇÕES DE HOJE
Pausas: ${pausedToday.length} | Reativações: ${reactivatedToday.length}
${todayAccountActions.length > 0 ? JSON.stringify(todayAccountActions.map((a: any) => ({ type: a.action_type, campaign: a.action_data?.campaign_id, status: a.status })), null, 2) : "Nenhuma ação hoje."}

Analise e execute as ações necessárias para este ciclo.`,
  };
}

// ============ EXECUTE SCHEDULED ACTIONS ============

async function executeScheduledActions(supabase: any, tenantId: string): Promise<number> {
  const now = new Date().toISOString();
  
  const { data: scheduledActions } = await supabase
    .from("ads_autopilot_actions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .in("action_type", ["adjust_budget", "activate_campaign"]);

  if (!scheduledActions || scheduledActions.length === 0) return 0;

  let executed = 0;
  for (const action of scheduledActions) {
    const scheduledFor = action.action_data?.scheduled_for;
    if (!scheduledFor || new Date(scheduledFor) > new Date(now)) continue;

    const channel = action.channel;
    const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";

    try {
      if (action.action_type === "adjust_budget") {
        const { error } = await supabase.functions.invoke(edgeFn, {
          body: {
            tenant_id: tenantId,
            action: "update",
            meta_campaign_id: action.action_data?.campaign_id,
            daily_budget_cents: action.action_data?.new_budget_cents,
          },
        });
        if (error) throw error;

        // Update last_budget_adjusted_at
        const adAccountId = action.action_data?.ad_account_id;
        if (adAccountId) {
          await supabase
            .from("ads_autopilot_account_configs")
            .update({ last_budget_adjusted_at: new Date().toISOString() })
            .eq("tenant_id", tenantId)
            .eq("ad_account_id", adAccountId);
        }
      } else if (action.action_type === "activate_campaign") {
        const { error } = await supabase.functions.invoke(edgeFn, {
          body: {
            tenant_id: tenantId,
            action: "update",
            meta_campaign_id: action.action_data?.campaign_id,
            status: "ACTIVE",
          },
        });
        if (error) throw error;
      }

      await supabase
        .from("ads_autopilot_actions")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", action.id);

      executed++;
      console.log(`[ads-autopilot-guardian][${VERSION}] Executed scheduled ${action.action_type}: ${action.action_data?.campaign_id}`);
    } catch (err: any) {
      await supabase
        .from("ads_autopilot_actions")
        .update({ status: "failed", error_message: err.message })
        .eq("id", action.id);
      console.error(`[ads-autopilot-guardian][${VERSION}] Scheduled execution failed:`, err.message);
    }
  }

  return executed;
}

// ============ MAIN ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const forceCycle = body.cycle as GuardianCycle | undefined;
    const cycle = forceCycle || detectCycle();

    // If called via cron without tenant_id, run for all tenants with active accounts
    if (!tenantId) {
      if (!cycle) {
        return ok({ skipped: true, reason: "Not a guardian cycle hour", brt_hour: getCurrentBRTHour() });
      }

      const { data: activeConfigs } = await supabase
        .from("ads_autopilot_account_configs")
        .select("tenant_id")
        .eq("is_ai_enabled", true)
        .is("kill_switch", false);

      const tenantIds = [...new Set((activeConfigs || []).map((c: any) => c.tenant_id))];
      console.log(`[ads-autopilot-guardian][${VERSION}] Cron ${cycle}: ${tenantIds.length} tenants`);

      const results: any[] = [];
      for (const tid of tenantIds) {
        try {
          const result = await runGuardianForTenant(supabase, tid, cycle);
          results.push({ tenant_id: tid, ...result });
        } catch (err: any) {
          results.push({ tenant_id: tid, error: err.message });
          console.error(`[ads-autopilot-guardian][${VERSION}] Error for tenant ${tid}:`, err.message);
        }
      }

      return ok({ cycle, tenants_processed: results.length, results });
    }

    // Manual invocation for a specific tenant
    if (!cycle) {
      return fail("Cycle required. Use: 12h, 13h, 16h, 00h");
    }

    const result = await runGuardianForTenant(supabase, tenantId, cycle);
    return ok(result);
  } catch (err: any) {
    console.error(`[ads-autopilot-guardian][${VERSION}] Fatal:`, err.message);
    return fail(err.message);
  }
});

// ============ RUN GUARDIAN FOR TENANT ============

async function runGuardianForTenant(supabase: any, tenantId: string, cycle: GuardianCycle) {
  const startTime = Date.now();
  console.log(`[ads-autopilot-guardian][${VERSION}] Starting ${cycle} for tenant ${tenantId}`);

  // Step 0: Execute scheduled actions (always, but especially at 00h)
  const scheduledExecuted = await executeScheduledActions(supabase, tenantId);
  if (scheduledExecuted > 0) {
    console.log(`[ads-autopilot-guardian][${VERSION}] Executed ${scheduledExecuted} scheduled actions`);
  }

  // Get account configs
  const { data: configs } = await supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_ai_enabled", true);

  const activeConfigs = (configs || []).filter((c: any) => !c.kill_switch) as AccountConfig[];
  if (activeConfigs.length === 0) {
    return { cycle, accounts: 0, scheduled_executed: scheduledExecuted, message: "No active accounts" };
  }

  // Collect context
  const context = await collectGuardianContext(supabase, tenantId, activeConfigs);

  // Create guardian session
  const { data: session } = await supabase
    .from("ads_autopilot_sessions")
    .insert({
      tenant_id: tenantId,
      channel: "global",
      trigger_type: `guardian_${cycle}`,
      motor_type: "guardian",
      context_snapshot: { cycle, accounts: activeConfigs.map(a => a.ad_account_id) },
    })
    .select("id")
    .single();

  const sessionId = session!.id;
  let totalPlanned = 0;
  let totalExecuted = 0;
  let totalRejected = 0;

  // Analyze each account
  for (const config of activeConfigs) {
    const prompt = buildGuardianPrompt(cycle, config, context);
    if (!prompt) continue;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      resetAIRouterCache();

      const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        tools: GUARDIAN_TOOLS,
        tool_choice: "auto",
      }, {
        supabaseUrl,
        supabaseServiceKey,
        logPrefix: `[ads-autopilot-guardian][${VERSION}]`,
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`[ads-autopilot-guardian][${VERSION}] AI error: ${aiResponse.status} ${errText}`);
        continue;
      }

      const aiResult = await aiResponse.json();
      const toolCalls = aiResult.choices?.[0]?.message?.tool_calls || [];
      const aiText = aiResult.choices?.[0]?.message?.content || "";

      for (const tc of toolCalls) {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        totalPlanned++;

        // Get campaign name
        const channelData = context.channels[config.channel];
        const campaignName = channelData?.campaigns?.find((c: any) => c.meta_campaign_id === args.campaign_id)?.name || null;

        if (tc.function.name === "report_insight") {
          await supabase.from("ads_autopilot_actions").insert({
            tenant_id: tenantId,
            session_id: sessionId,
            channel: config.channel,
            action_type: "report_insight",
            action_data: { ...args, ad_account_id: config.ad_account_id },
            reasoning: args.summary,
            status: "executed",
            action_hash: `${sessionId}_insight_${config.ad_account_id}_${totalPlanned}`,
          });
          totalExecuted++;
          continue;
        }

        if (tc.function.name === "pause_campaign") {
          try {
            const edgeFn = config.channel === "meta" ? "meta-ads-campaigns" : `${config.channel}-ads-campaigns`;
            const { error } = await supabase.functions.invoke(edgeFn, {
              body: { tenant_id: tenantId, action: "update", meta_campaign_id: args.campaign_id, status: "PAUSED" },
            });
            if (error) throw error;

            await supabase.from("ads_autopilot_actions").insert({
              tenant_id: tenantId,
              session_id: sessionId,
              channel: config.channel,
              action_type: "pause_campaign",
              action_data: { ...args, ad_account_id: config.ad_account_id, campaign_name: campaignName },
              reasoning: args.reason,
              confidence: String(args.confidence || "0.8"),
              metric_trigger: args.metric_trigger,
              status: "executed",
              executed_at: new Date().toISOString(),
              rollback_data: { previous_status: "ACTIVE" },
              action_hash: `${sessionId}_pause_${args.campaign_id}`,
            });
            totalExecuted++;
          } catch (err: any) {
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id: tenantId,
              session_id: sessionId,
              channel: config.channel,
              action_type: "pause_campaign",
              action_data: { ...args, ad_account_id: config.ad_account_id },
              reasoning: args.reason,
              status: "failed",
              error_message: err.message,
              action_hash: `${sessionId}_pause_${args.campaign_id}`,
            });
            console.error(`[ads-autopilot-guardian][${VERSION}] Pause failed:`, err.message);
          }
        }

        if (tc.function.name === "adjust_budget") {
          // Validate budget change limits
          const changePct = Math.abs(args.change_pct || 0);
          const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;

          if (changePct > platformLimit.max_change_pct) {
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id: tenantId,
              session_id: sessionId,
              channel: config.channel,
              action_type: "adjust_budget",
              action_data: { ...args, ad_account_id: config.ad_account_id },
              reasoning: args.reason,
              status: "rejected",
              rejection_reason: `Ajuste de ${args.change_pct}% excede limite de ±${platformLimit.max_change_pct}%`,
              action_hash: `${sessionId}_budget_${args.campaign_id}`,
            });
            totalRejected++;
            continue;
          }

          if (!canAdjustBudget(config)) {
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id: tenantId,
              session_id: sessionId,
              channel: config.channel,
              action_type: "adjust_budget",
              action_data: { ...args, ad_account_id: config.ad_account_id },
              reasoning: args.reason,
              status: "rejected",
              rejection_reason: `Intervalo mínimo de ${platformLimit.min_interval_hours}h entre ajustes não atingido`,
              action_hash: `${sessionId}_budget_${args.campaign_id}`,
            });
            totalRejected++;
            continue;
          }

          // Schedule for 00:01
          const scheduledFor = getNextSchedulingTime();
          await supabase.from("ads_autopilot_actions").insert({
            tenant_id: tenantId,
            session_id: sessionId,
            channel: config.channel,
            action_type: "adjust_budget",
            action_data: { ...args, ad_account_id: config.ad_account_id, campaign_name: campaignName, scheduled_for: scheduledFor, new_budget_cents: args.new_budget_cents },
            reasoning: args.reason,
            confidence: String(args.confidence || "0.7"),
            metric_trigger: args.metric_trigger,
            status: "scheduled",
            rollback_data: { previous_budget_cents: args.current_budget_cents },
            action_hash: `${sessionId}_budget_${args.campaign_id}`,
          });
          totalExecuted++;
          console.log(`[ads-autopilot-guardian][${VERSION}] Budget adjustment scheduled for ${scheduledFor}`);
        }
      }

      // Save per-account session detail
      if (aiText || toolCalls.length > 0) {
        await supabase.from("ads_autopilot_sessions").insert({
          tenant_id: tenantId,
          channel: config.channel,
          trigger_type: `guardian_${cycle}`,
          motor_type: "guardian",
          ai_response_raw: aiText,
          actions_planned: toolCalls.length,
          actions_executed: toolCalls.filter((tc: any) => tc.function.name !== "report_insight").length,
          context_snapshot: { ad_account_id: config.ad_account_id, cycle },
        });
      }
    } catch (err: any) {
      console.error(`[ads-autopilot-guardian][${VERSION}] Account ${config.ad_account_id} error:`, err.message);
    }
  }

  // Update main session
  const durationMs = Date.now() - startTime;
  await supabase
    .from("ads_autopilot_sessions")
    .update({
      actions_planned: totalPlanned,
      actions_executed: totalExecuted,
      actions_rejected: totalRejected,
      duration_ms: durationMs,
    })
    .eq("id", sessionId);

  console.log(`[ads-autopilot-guardian][${VERSION}] ${cycle} completed: ${activeConfigs.length} accounts, ${totalPlanned} planned, ${totalExecuted} executed, ${totalRejected} rejected in ${durationMs}ms`);

  return {
    cycle,
    session_id: sessionId,
    accounts: activeConfigs.length,
    actions: { planned: totalPlanned, executed: totalExecuted, rejected: totalRejected },
    scheduled_executed: scheduledExecuted,
    duration_ms: durationMs,
  };
}
