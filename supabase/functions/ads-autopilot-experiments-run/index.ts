import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.1.0"; // Use ai-router for native AI priority
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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

// ============ EXPERIMENT EVALUATION ============

interface ExperimentWithMetrics {
  experiment: any;
  metrics: {
    spend_cents: number;
    conversions: number;
    clicks: number;
    impressions: number;
    cpa_cents: number;
    roas: number;
    ctr_pct: number;
    days_running: number;
  };
}

async function collectExperimentMetrics(
  supabase: any,
  tenantId: string,
  experiment: any
): Promise<ExperimentWithMetrics | null> {
  const channel = experiment.channel;
  const startDate = experiment.start_at?.split("T")[0];
  if (!startDate) return null;

  let metrics = { spend_cents: 0, conversions: 0, clicks: 0, impressions: 0, cpa_cents: 0, roas: 0, ctr_pct: 0, days_running: 0 };

  const daysRunning = Math.floor((Date.now() - new Date(experiment.start_at).getTime()) / (24 * 60 * 60 * 1000));
  metrics.days_running = daysRunning;

  // Get campaign IDs from experiment plan
  const campaignIds = experiment.plan?.campaign_ids || [];
  if (campaignIds.length === 0) {
    return { experiment, metrics };
  }

  if (channel === "meta") {
    const { data: insights } = await supabase
      .from("meta_ad_insights")
      .select("impressions, clicks, spend_cents, conversions, roas")
      .eq("tenant_id", tenantId)
      .in("meta_campaign_id", campaignIds)
      .gte("date_start", startDate)
      .limit(500);

    if (insights?.length) {
      metrics.spend_cents = insights.reduce((s: number, i: any) => s + (i.spend_cents || 0), 0);
      metrics.conversions = insights.reduce((s: number, i: any) => s + (i.conversions || 0), 0);
      metrics.clicks = insights.reduce((s: number, i: any) => s + (i.clicks || 0), 0);
      metrics.impressions = insights.reduce((s: number, i: any) => s + (i.impressions || 0), 0);
    }
  } else if (channel === "google") {
    const { data: insights } = await supabase
      .from("google_ad_insights")
      .select("impressions, clicks, cost_micros, conversions, conversions_value_micros")
      .eq("tenant_id", tenantId)
      .in("google_campaign_id", campaignIds)
      .gte("date_range_start", startDate)
      .limit(500);

    if (insights?.length) {
      metrics.spend_cents = insights.reduce((s: number, i: any) => s + (i.cost_micros || 0), 0);
      metrics.conversions = insights.reduce((s: number, i: any) => s + (i.conversions || 0), 0);
      metrics.clicks = insights.reduce((s: number, i: any) => s + (i.clicks || 0), 0);
      metrics.impressions = insights.reduce((s: number, i: any) => s + (i.impressions || 0), 0);
    }
  } else if (channel === "tiktok") {
    const { data: insights } = await supabase
      .from("tiktok_ad_insights")
      .select("impressions, clicks, spend_cents, conversions, roas")
      .eq("tenant_id", tenantId)
      .in("tiktok_campaign_id", campaignIds)
      .gte("date_start", startDate)
      .limit(500);

    if (insights?.length) {
      metrics.spend_cents = insights.reduce((s: number, i: any) => s + (i.spend_cents || 0), 0);
      metrics.conversions = insights.reduce((s: number, i: any) => s + (i.conversions || 0), 0);
      metrics.clicks = insights.reduce((s: number, i: any) => s + (i.clicks || 0), 0);
      metrics.impressions = insights.reduce((s: number, i: any) => s + (i.impressions || 0), 0);
    }
  }

  metrics.cpa_cents = safeDivide(metrics.spend_cents, metrics.conversions);
  metrics.roas = safeDivide(metrics.conversions * 100, metrics.spend_cents); // simplified
  metrics.ctr_pct = safeDivide(metrics.clicks * 100, metrics.impressions);

  return { experiment, metrics };
}

// ============ AI EVALUATION ============

const EXPERIMENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "promote_winner",
      description: "Promove a variante vencedora do experimento. Escala budget e marca como promovida.",
      parameters: {
        type: "object",
        properties: {
          experiment_id: { type: "string" },
          winner_variant_id: { type: "string" },
          reasoning: { type: "string" },
          recommended_budget_increase_pct: { type: "number" },
        },
        required: ["experiment_id", "winner_variant_id", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_experiment",
      description: "Cancela experimento por performance ruim ou dados insuficientes.",
      parameters: {
        type: "object",
        properties: {
          experiment_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["experiment_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extend_experiment",
      description: "Estende duração do experimento para coletar mais dados.",
      parameters: {
        type: "object",
        properties: {
          experiment_id: { type: "string" },
          additional_days: { type: "number" },
          reason: { type: "string" },
        },
        required: ["experiment_id", "additional_days", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_new_experiment",
      description: "Sugere um novo experimento baseado nos dados atuais.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string" },
          ad_account_id: { type: "string" },
          hypothesis: { type: "string" },
          variable_type: { type: "string", enum: ["creative", "audience", "structure", "landing"] },
          plan_description: { type: "string" },
          suggested_budget_cents: { type: "number" },
          suggested_duration_days: { type: "number" },
        },
        required: ["channel", "hypothesis", "variable_type", "plan_description"],
        additionalProperties: false,
      },
    },
  },
];

async function callAI(messages: any[], tools: any[], model: string): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await aiChatCompletion(model, {
    messages,
    tools,
    tool_choice: "auto",
  }, {
    supabaseUrl,
    supabaseServiceKey,
    logPrefix: `[experiments-run][${VERSION}]`,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[experiments-run][${VERSION}] AI error: ${response.status} ${text}`);
    throw new Error(`AI error: ${response.status}`);
  }

  return response.json();
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-experiments-run][${VERSION}] Request received`);

  try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Support single tenant (manual) or all tenants (cron)
    const tenantIds: string[] = [];
    if (body.tenant_id) {
      tenantIds.push(body.tenant_id);
    } else {
      // Cron: get all tenants with active autopilot
      const { data: configs } = await supabase
        .from("ads_autopilot_configs")
        .select("tenant_id")
        .eq("channel", "global")
        .eq("is_enabled", true);
      for (const c of configs || []) {
        if (!tenantIds.includes(c.tenant_id)) tenantIds.push(c.tenant_id);
      }
    }

    const results: any[] = [];

    for (const tenantId of tenantIds) {
      try {
        console.log(`[experiments-run][${VERSION}] Processing tenant ${tenantId}`);

        // Get AI model from global config
        const { data: globalConfig } = await supabase
          .from("ads_autopilot_configs")
          .select("ai_model")
          .eq("tenant_id", tenantId)
          .eq("channel", "global")
          .single();

        const aiModel = globalConfig?.ai_model || "openai/gpt-5.2";

        // 1. Get running experiments
        const { data: runningExperiments } = await supabase
          .from("ads_autopilot_experiments")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("status", ["running", "planned"]);

        // 2. Get account configs for context
        const { data: accountConfigs } = await supabase
          .from("ads_autopilot_account_configs")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_ai_enabled", true);

        // 3. Collect metrics for running experiments
        const experimentsWithMetrics: ExperimentWithMetrics[] = [];
        for (const exp of runningExperiments || []) {
          if (exp.status === "running") {
            const ewm = await collectExperimentMetrics(supabase, tenantId, exp);
            if (ewm) experimentsWithMetrics.push(ewm);
          }
        }

        // 4. Get recent order stats
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: orders } = await supabase
          .from("orders")
          .select("total, status, payment_status")
          .eq("tenant_id", tenantId)
          .gte("created_at", thirtyDaysAgo)
          .limit(500);

        const paidOrders = orders?.filter((o: any) => o.payment_status === "paid" || o.status === "delivered") || [];
        const avgTicket = paidOrders.length
          ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length)
          : 0;

        // 5. Build AI prompt
        const systemPrompt = `Você é um especialista em testes A/B e experimentação de anúncios.

## CONTEXTO
- Ticket médio: R$ ${(avgTicket / 100).toFixed(2)}
- Contas com IA ativa: ${(accountConfigs || []).map((ac: any) => `${ac.channel}/${ac.ad_account_id} (ROI alvo: ${ac.target_roi}x)`).join(", ") || "nenhuma"}

## REGRAS DE AVALIAÇÃO
- Gasto mínimo por variante: 3x CPA alvo antes de concluir
- Duração mínima: 5 dias após learning phase
- Mínimo 20 cliques OU 5 conversões por variante para conclusão estatística
- Máximo 3 experimentos simultâneos por conta
- Promoção: variante com CPA < 80% do controle OU ROAS > 120% do controle por 3+ dias
- Se dados insuficientes, estender por 3-5 dias
- Se performance claramente ruim (CPA > 2x alvo, 0 conversões com gasto > R$100), cancelar

## AÇÕES DISPONÍVEIS
- promote_winner: Escalar variante vencedora
- cancel_experiment: Cancelar por performance ruim
- extend_experiment: Estender para mais dados
- suggest_new_experiment: Propor novo teste

Analise cada experimento e tome decisões.`;

        const userContent = experimentsWithMetrics.length > 0
          ? `## EXPERIMENTOS EM EXECUÇÃO\n${JSON.stringify(experimentsWithMetrics.map(ewm => ({
              id: ewm.experiment.id,
              hypothesis: ewm.experiment.hypothesis,
              variable_type: ewm.experiment.variable_type,
              channel: ewm.experiment.channel,
              account: ewm.experiment.ad_account_id,
              status: ewm.experiment.status,
              days_running: ewm.metrics.days_running,
              spend: `R$ ${(ewm.metrics.spend_cents / 100).toFixed(2)}`,
              conversions: ewm.metrics.conversions,
              clicks: ewm.metrics.clicks,
              cpa: `R$ ${(ewm.metrics.cpa_cents / 100).toFixed(2)}`,
              ctr: `${ewm.metrics.ctr_pct}%`,
              success_criteria: ewm.experiment.success_criteria,
              plan: ewm.experiment.plan,
            })), null, 2)}`
          : "Nenhum experimento em execução. Analise as contas ativas e sugira novos experimentos se apropriado.";

        const aiResponse = await callAI(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          EXPERIMENT_TOOLS,
          aiModel
        );

        const toolCalls = aiResponse.choices?.[0]?.message?.tool_calls || [];
        let promoted = 0, cancelled = 0, extended = 0, suggested = 0;

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;

          if (tc.function.name === "promote_winner") {
            await supabase
              .from("ads_autopilot_experiments")
              .update({
                status: "promoted",
                winner_variant_id: args.winner_variant_id,
                results: { reasoning: args.reasoning, recommended_budget_increase_pct: args.recommended_budget_increase_pct },
                end_at: new Date().toISOString(),
              })
              .eq("id", args.experiment_id);
            promoted++;
          } else if (tc.function.name === "cancel_experiment") {
            await supabase
              .from("ads_autopilot_experiments")
              .update({
                status: "cancelled",
                results: { cancellation_reason: args.reason },
                end_at: new Date().toISOString(),
              })
              .eq("id", args.experiment_id);
            cancelled++;
          } else if (tc.function.name === "extend_experiment") {
            const exp = runningExperiments?.find((e: any) => e.id === args.experiment_id);
            if (exp) {
              const currentEnd = exp.end_at ? new Date(exp.end_at) : new Date();
              const newEnd = new Date(currentEnd.getTime() + (args.additional_days || 3) * 24 * 60 * 60 * 1000);
              await supabase
                .from("ads_autopilot_experiments")
                .update({
                  end_at: newEnd.toISOString(),
                  duration_days: (exp.duration_days || 7) + (args.additional_days || 3),
                })
                .eq("id", args.experiment_id);
              extended++;
            }
          } else if (tc.function.name === "suggest_new_experiment") {
            // Check max 3 per account
            const activeCount = (runningExperiments || []).filter(
              (e: any) => e.ad_account_id === args.ad_account_id && (e.status === "running" || e.status === "planned")
            ).length;

            if (activeCount < 3) {
              await supabase
                .from("ads_autopilot_experiments")
                .insert({
                  tenant_id: tenantId,
                  channel: args.channel,
                  ad_account_id: args.ad_account_id || null,
                  hypothesis: args.hypothesis,
                  variable_type: args.variable_type,
                  plan: { description: args.plan_description },
                  budget_cents: args.suggested_budget_cents || 0,
                  duration_days: args.suggested_duration_days || 7,
                  status: "planned",
                });
              suggested++;
            }
          }
        }

        results.push({
          tenant_id: tenantId,
          experiments_evaluated: experimentsWithMetrics.length,
          promoted, cancelled, extended, suggested,
        });

        console.log(`[experiments-run][${VERSION}] Tenant ${tenantId}: ${promoted} promoted, ${cancelled} cancelled, ${extended} extended, ${suggested} suggested`);
      } catch (tenantErr: any) {
        console.error(`[experiments-run][${VERSION}] Error for tenant ${tenantId}:`, tenantErr.message);
        results.push({ tenant_id: tenantId, error: tenantErr.message });
      }
    }

    return ok({ tenants_processed: results.length, results });
  } catch (err: any) {
    console.error(`[ads-autopilot-experiments-run][${VERSION}] Fatal error:`, err.message);
    return fail(err.message || "Erro interno");
  }
});
