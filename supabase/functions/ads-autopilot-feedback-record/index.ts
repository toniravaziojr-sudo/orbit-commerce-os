// =====================================================================
// ads-autopilot-feedback-record
// Etapa 7.mem — Subfase A.1: ponto único de gravação de feedback humano
// sobre sugestões do Ads Autopilot.
//
// Esta função NÃO altera a sugestão original, NÃO dispara execução,
// NÃO chama a Meta, NÃO toca em kill_switch/human_approval_mode/
// autonomy_mode/is_ai_enabled e NÃO influencia a IA de tráfego.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_DECISIONS = new Set([
  "approved",
  "rejected",
  "needs_revision",
  "edited_then_approved",
]);

const ALLOWED_CONFIDENCE = new Set(["low", "medium", "high"]);

export interface FeedbackInput {
  tenant_id: string;
  recommendation_id?: string | null;
  suggestion_group_id?: string | null;
  action_id?: string | null;

  sales_platform?: string | null;
  ads_platform: string; // 'meta' | 'google' | 'tiktok' | ...
  ad_account_id?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  objective?: string | null;
  functional_state?: string | null;
  proposed_verdict?: string | null;
  action_type?: string | null;
  action_class?: string | null;

  metrics_snapshot: Record<string, unknown>;
  policy_check_result?: Record<string, unknown> | null;
  observation?: string | null;

  decision: string;
  reason_codes: string[];
  reason_text?: string | null;
  tags?: string[] | null;

  user_confidence?: string | null;
  would_do_manually?: boolean | null;
  should_become_preference?: boolean | null;
  ignored_context?: boolean | null;
  ignored_context_text?: string | null;

  diff?: Record<string, unknown> | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validação pura (sem I/O). Reutilizada nos testes.
 * Regra de obrigatoriedade do reason_code é aplicada AQUI e também por trigger no banco.
 */
export function validateFeedbackInput(
  input: Partial<FeedbackInput> | null | undefined,
): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  if (!input.tenant_id || !UUID_RE.test(String(input.tenant_id))) {
    return { ok: false, error: "tenant_id_required" };
  }

  if (!input.ads_platform || typeof input.ads_platform !== "string") {
    return { ok: false, error: "ads_platform_required" };
  }

  if (!input.decision || !ALLOWED_DECISIONS.has(String(input.decision))) {
    return {
      ok: false,
      error: "invalid_decision",
      details: { allowed: Array.from(ALLOWED_DECISIONS) },
    };
  }

  if (
    !Array.isArray(input.reason_codes) ||
    input.reason_codes.length === 0 ||
    input.reason_codes.some((c) => typeof c !== "string" || !c.trim())
  ) {
    return { ok: false, error: "reason_codes_required" };
  }

  // Snapshot mínimo: precisa ser objeto (pode estar vazio para evitar bloqueio
  // operacional, mas precisa estar presente e ser objeto plano).
  if (
    input.metrics_snapshot === undefined ||
    input.metrics_snapshot === null ||
    typeof input.metrics_snapshot !== "object" ||
    Array.isArray(input.metrics_snapshot)
  ) {
    return { ok: false, error: "metrics_snapshot_required" };
  }

  if (
    input.user_confidence !== undefined &&
    input.user_confidence !== null &&
    !ALLOWED_CONFIDENCE.has(String(input.user_confidence))
  ) {
    return { ok: false, error: "invalid_user_confidence" };
  }

  // diff só faz sentido em edited_then_approved
  if (input.diff !== undefined && input.diff !== null) {
    if (input.decision !== "edited_then_approved") {
      return { ok: false, error: "diff_only_allowed_for_edited_then_approved" };
    }
    if (typeof input.diff !== "object" || Array.isArray(input.diff)) {
      return { ok: false, error: "invalid_diff" };
    }
  }

  // UUIDs opcionais — se informados, precisam ser válidos
  for (
    const f of [
      "recommendation_id",
      "suggestion_group_id",
      "action_id",
    ] as const
  ) {
    const v = (input as Record<string, unknown>)[f];
    if (v !== undefined && v !== null && !UUID_RE.test(String(v))) {
      return { ok: false, error: `invalid_${f}` };
    }
  }

  return { ok: true };
}

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

  // Confirma acesso ao tenant pelo USER CLIENT (RLS valida o INSERT).
  // service_role é usado apenas para a gravação final, ainda com filtro explícito
  // de tenant_id no payload.
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

  // Para gravação respeitando RLS do tenant, usamos o userClient (não service_role).
  // Isso garante que outro tenant não consiga gravar feedback no Respeite o Homem.
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
    // Mensagens de trigger viram error code do PostgREST. Mapeia as conhecidas.
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
