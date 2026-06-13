// =============================================
// ADS AUTOPILOT — APPROVE STRATEGY (Frente 4, Etapa 1 → Etapa 2)
// =============================================
// Recebe a aprovação humana da ESTRATÉGIA (não publica a campanha).
// Fluxo:
//   1. Valida que a action é two-step e está em pending_approval.
//   2. Revalida Quality Gate + exclusão de Clientes (cold).
//   3. Move status → creative_pending.
//   4. Invoca `ads-autopilot-creative` com o brief salvo (DEBITA crédito aqui).
//   5. Anexa job_id ao action_data.
//   6. Status final fica `creative_pending`; o front polla o creative_job
//      e marca como `final_pending_approval` quando o asset estiver pronto.
//
// NUNCA publica campanha. NUNCA chama Meta/Google/TikTok.
// =============================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  TWO_STEP_FLOW_VERSION,
  TWO_STEP_STATUSES,
  isTwoStepAction,
  runTwoStepCreativeGate,
  type CreativeBrief,
} from "../_shared/ads-autopilot/twoStep.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "v1.0.0";

function ok(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ success: true, version: VERSION, ...data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string, details?: unknown, status = 200) {
  return new Response(JSON.stringify({ success: false, version: VERSION, error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json");
  }

  const actionId = body?.action_id;
  const tenantId = body?.tenant_id;
  if (!actionId || !tenantId) return fail("missing_required_fields");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Identidade do usuário aprovador (auditoria)
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userSupabase.auth.getUser();
      userId = u?.user?.id ?? null;
    } catch { /* anônimo, segue */ }
  }

  // 1. Carrega a action
  const { data: action, error: fetchErr } = await supabase
    .from("ads_autopilot_actions")
    .select("*")
    .eq("id", actionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (fetchErr || !action) return fail("action_not_found");
  if (!isTwoStepAction(action)) return fail("not_two_step_flow", { hint: "Proposta legacy — use o botão Aprovar padrão." });
  if (action.status !== TWO_STEP_STATUSES.PENDING_STRATEGY) {
    return fail("invalid_status", { current_status: action.status });
  }
  if (action.action_type !== "create_campaign") {
    return fail("invalid_action_type", { action_type: action.action_type });
  }

  const data = (action.action_data || {}) as Record<string, any>;
  const brief: CreativeBrief = data.creative_brief || {};
  const funnelStage = brief.funnel_stage || data.funnel_stage || null;

  // 2. Quality Gate da Etapa 2
  const exclusionApplied =
    !!data.customer_audience_exclusion?.enabled ||
    !!data.customer_audience_exclusion?.customer_audience_exclusion_enabled ||
    !!data.audience_exclusions?.customers ||
    Array.isArray(data.excluded_audience_ids) && data.excluded_audience_ids.length > 0 ||
    Array.isArray(data.preview?.excluded_audience_ids) && data.preview.excluded_audience_ids.length > 0;
  const gate = runTwoStepCreativeGate({
    action,
    qualityGatePassed: action.policy_check_result?.ok !== false,
    customerExclusionApplied: exclusionApplied,
    funnelStage,
  });
  if (!gate.ok) {
    return fail("quality_gate_failed", { reason_codes: gate.reason_codes });
  }

  // 3. Status → creative_pending + auditoria
  const nowIso = new Date().toISOString();
  const audit = {
    ...(action.policy_check_result || {}),
    two_step_audit: {
      ...(action.policy_check_result?.two_step_audit || {}),
      strategy_approved_at: nowIso,
      strategy_approved_by: userId,
      gate_passed_at: nowIso,
    },
  };

  const { error: updErr } = await supabase
    .from("ads_autopilot_actions")
    .update({
      status: TWO_STEP_STATUSES.CREATIVE_PENDING,
      policy_check_result: audit,
    })
    .eq("id", actionId);
  if (updErr) return fail("status_update_failed", { error: updErr.message });

  // 4. Invoca geração de criativo (DEBITA crédito agora)
  let creativeJobId: string | null = null;
  let creativeError: string | null = null;
  try {
    const { data: creativeResp, error: cErr } = await supabase.functions.invoke("ads-autopilot-creative", {
      body: {
        tenant_id: tenantId,
        session_id: action.session_id,
        channel: action.channel,
        product_id: brief.product_id,
        product_name: brief.product_name,
        product_image_url: brief.product_image_url,
        campaign_objective: brief.campaign_objective,
        target_audience: brief.target_audience,
        style_preference: brief.style_preference || "promotional",
        format: brief.format || "1:1",
        variations: brief.variations || 3,
        funnel_stage: brief.funnel_stage || "tof",
        creative_prompt: brief.prompt || null,
        triggered_by: "ads-autopilot-approve-strategy",
        action_id: actionId,
      },
    });
    if (cErr) throw cErr;
    creativeJobId = (creativeResp as any)?.data?.job_id || (creativeResp as any)?.job_id || null;
  } catch (e: any) {
    creativeError = e?.message || String(e);
    console.error(`[ads-autopilot-approve-strategy][${VERSION}] creative invoke failed:`, creativeError);
  }

  // 5. Anexa job_id ao action_data
  const patchedData = {
    ...data,
    creative_brief: brief,
    creative_generation: {
      job_id: creativeJobId,
      requested_at: nowIso,
      error: creativeError,
    },
  };
  await supabase
    .from("ads_autopilot_actions")
    .update({ action_data: patchedData })
    .eq("id", actionId);

  if (creativeError) {
    return fail("creative_generation_failed", { error: creativeError });
  }

  return ok({
    action_id: actionId,
    status: TWO_STEP_STATUSES.CREATIVE_PENDING,
    creative_job_id: creativeJobId,
    flow_version: TWO_STEP_FLOW_VERSION,
  });
});
