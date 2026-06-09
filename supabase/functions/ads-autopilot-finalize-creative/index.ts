// =============================================
// ADS AUTOPILOT — FINALIZE CREATIVE (Frente 4, Etapa 2 → aguardando aprovação final)
// =============================================
// Chamado pelo front quando o creative_job termina.
// Move status de creative_pending → final_pending_approval e anexa as URLs
// dos criativos prontos ao action_data.
// NUNCA publica campanha.
// =============================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { TWO_STEP_STATUSES, isTwoStepAction } from "../_shared/ads-autopilot/twoStep.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "v1.0.0";

const ok = (d: Record<string, unknown>) =>
  new Response(JSON.stringify({ success: true, version: VERSION, ...d }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (error: string, details?: unknown) =>
  new Response(JSON.stringify({ success: false, version: VERSION, error, details }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { return fail("invalid_json"); }

  const actionId = body?.action_id;
  const tenantId = body?.tenant_id;
  if (!actionId || !tenantId) return fail("missing_required_fields");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: action, error } = await supabase
    .from("ads_autopilot_actions")
    .select("*")
    .eq("id", actionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !action) return fail("action_not_found");
  if (!isTwoStepAction(action)) return fail("not_two_step_flow");
  if (action.status !== TWO_STEP_STATUSES.CREATIVE_PENDING) {
    return fail("invalid_status", { current_status: action.status });
  }

  const data = (action.action_data || {}) as Record<string, any>;
  const jobId = data.creative_generation?.job_id;
  if (!jobId) return fail("creative_job_missing");

  // Busca o job e os assets prontos
  const { data: job } = await supabase
    .from("creative_jobs")
    .select("id, status, output_urls")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return fail("creative_job_not_found");
  const hasOutputs = Array.isArray(job.output_urls) && (job.output_urls as any[]).length > 0;
  if (job.status !== "succeeded" && job.status !== "completed" && job.status !== "ready" && !hasOutputs) {
    return fail("creative_job_not_ready", { job_status: job.status });
  }

  const urls: string[] = Array.isArray(job.output_urls) ? job.output_urls : [];

  // Também busca em ads_creative_assets pela session+product
  let assetUrls = urls;
  if (assetUrls.length === 0 && data.creative_brief?.product_id) {
    const { data: assets } = await supabase
      .from("ads_creative_assets")
      .select("asset_url")
      .eq("tenant_id", tenantId)
      .eq("product_id", data.creative_brief.product_id)
      .eq("status", "ready")
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);
    assetUrls = (assets || []).map((a: any) => a.asset_url).filter(Boolean);
  }

  const nowIso = new Date().toISOString();
  const patched = {
    ...data,
    creative_urls: assetUrls,
    creative_url: assetUrls[0] || data.creative_url || null,
    creative_generation: {
      ...(data.creative_generation || {}),
      completed_at: nowIso,
      job_status: job.status,
    },
  };

  const { error: updErr } = await supabase
    .from("ads_autopilot_actions")
    .update({
      status: TWO_STEP_STATUSES.FINAL_PENDING,
      action_data: patched,
    })
    .eq("id", actionId);
  if (updErr) return fail("status_update_failed", { error: updErr.message });

  return ok({
    action_id: actionId,
    status: TWO_STEP_STATUSES.FINAL_PENDING,
    creative_urls: assetUrls,
  });
});
