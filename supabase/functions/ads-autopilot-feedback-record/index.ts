// =====================================================================
// ads-autopilot-feedback-record
// Etapa 7.mem — Subfase A.1: ponto único de gravação de feedback humano
// sobre sugestões do Ads Autopilot.
//
// Esta função NÃO altera a sugestão original, NÃO dispara execução,
// NÃO chama a Meta, NÃO toca em kill_switch/human_approval_mode/
// autonomy_mode/is_ai_enabled e NÃO influencia a IA de tráfego.
// =====================================================================

// @ts-nocheck — runtime Deno (Edge Function), não compilado pelo tsc do app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  validateFeedbackInput,
  type FeedbackInput,
} from "../../../src/lib/adsAutopilot/feedbackContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 200);
  }

  let body: Partial<FeedbackInput> | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 200);
  }

  const validation = validateFeedbackInput(body);
  if (!validation.ok) {
    return json(
      { success: false, error: validation.error, details: validation.details },
      200,
    );
  }
  const input = body as FeedbackInput;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Identifica o usuário (decided_by) — opcional, mas registramos quando há sessão
  let decidedBy: string | null = null;
  try {
    const { data: u } = await userClient.auth.getUser();
    decidedBy = u?.user?.id ?? null;
  } catch {
    decidedBy = null;
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Pré-validação dos reason_codes contra o catálogo (defesa em profundidade —
  // trigger no banco também valida).
  const { data: catalog, error: catErr } = await service
    .from("ads_autopilot_feedback_reason_codes")
    .select("code")
    .eq("active", true)
    .in("code", input.reason_codes);

  if (catErr) {
    return json({ success: false, error: "catalog_lookup_failed" }, 200);
  }
  const validCodes = new Set((catalog ?? []).map((r: any) => r.code as string));
  const invalid = input.reason_codes.filter((c) => !validCodes.has(c));
  if (invalid.length > 0) {
    return json(
      { success: false, error: "invalid_reason_codes", details: { invalid } },
      200,
    );
  }

  // Gravação respeita RLS do tenant (userClient, não service_role).
  // Outro tenant não consegue gravar feedback no tenant alvo.
  const { data: inserted, error: insErr } = await userClient
    .from("ads_autopilot_feedback")
    .insert({
      tenant_id: input.tenant_id,
      recommendation_id: input.recommendation_id ?? null,
      suggestion_group_id: input.suggestion_group_id ?? null,
      action_id: input.action_id ?? null,
      sales_platform: input.sales_platform ?? null,
      ads_platform: input.ads_platform,
      ad_account_id: input.ad_account_id ?? null,
      campaign_id: input.campaign_id ?? null,
      campaign_name: input.campaign_name ?? null,
      objective: input.objective ?? null,
      functional_state: input.functional_state ?? null,
      proposed_verdict: input.proposed_verdict ?? null,
      action_type: input.action_type ?? null,
      action_class: input.action_class ?? null,
      metrics_snapshot: input.metrics_snapshot,
      policy_check_result: input.policy_check_result ?? null,
      observation: input.observation ?? null,
      decision: input.decision,
      reason_codes: input.reason_codes,
      reason_text: input.reason_text ?? null,
      tags: input.tags ?? [],
      user_confidence: input.user_confidence ?? null,
      would_do_manually: input.would_do_manually ?? null,
      should_become_preference: input.should_become_preference ?? null,
      ignored_context: input.ignored_context ?? null,
      ignored_context_text: input.ignored_context_text ?? null,
      diff: input.diff ?? null,
      decided_by: decidedBy,
    })
    .select("id, decided_at")
    .single();

  if (insErr) {
    const msg = String(insErr.message ?? "");
    if (
      msg.includes("invalid_reason_codes") ||
      msg.includes("reason_codes_required") ||
      msg.includes("diff_only_allowed_for_edited_then_approved")
    ) {
      return json({ success: false, error: msg }, 200);
    }
    if (insErr.code === "42501" || msg.toLowerCase().includes("row-level")) {
      return json({ success: false, error: "tenant_access_denied" }, 200);
    }
    return json(
      { success: false, error: "insert_failed", details: msg },
      200,
    );
  }

  return json(
    {
      success: true,
      feedback_id: inserted.id,
      decided_at: inserted.decided_at,
      // Observabilidade: deixa explícito que nada foi executado.
      side_effects: {
        suggestion_status_changed: false,
        meta_api_called: false,
        autoexec_triggered: false,
      },
    },
    200,
  );
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
