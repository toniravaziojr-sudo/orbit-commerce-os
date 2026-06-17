// =============================================================================
// ads-autopilot-request-adjustment
// Caminho oficial de "Ajustar proposta" para o Gestor de Tráfego IA.
//
// Diferente de Recusar:
//  - NÃO marca a proposta como `rejected`.
//  - Marca como `superseded` com lifecycle = `<tipo>_needs_adjustment` e
//    grava o pedido no `adjustment_history`.
//  - Grava feedback estruturado com decision = `needs_revision`
//    (a edge ads-autopilot-feedback-record já cria aprendizado sugerido).
//  - Aciona o Strategist com trigger = `revision` para gerar uma nova versão
//    em "Aguardando Ação".
//  - Vincula a nova proposta como filha (parent_action_id +
//    superseded_by_action_id).
//
// Resposta sempre 200 OK com envelope { success, ... } (padrão do projeto).
// =============================================================================
// @ts-nocheck — Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ACTIVE_PENDING_STATUSES = new Set([
  "pending_approval",
  "incomplete",
  "creative_pending",
  "final_pending_approval",
]);

// Janela para considerar uma revisão em curso (anti dupla chamada).
const IN_PROGRESS_WINDOW_MS = 10 * 60 * 1000;

function lifecycleForAction(actionType: string): string {
  if (actionType === "strategic_plan") return "plan_needs_adjustment";
  if (actionType === "campaign_proposal") return "campaign_proposal_needs_adjustment";
  return "proposal_needs_adjustment";
}

async function extractUserId(req: Request, anonClient: any): Promise<string | null> {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const { data } = await anonClient.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return ok({ success: false, error: "method_not_allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return ok({ success: false, error: "invalid_json" });
  }

  const tenantId = String(body?.tenant_id || "").trim();
  const actionId = String(body?.action_id || "").trim();
  const feedback = String(body?.feedback || "").trim();

  if (!tenantId) return ok({ success: false, error: "tenant_id_required" });
  if (!actionId) return ok({ success: false, error: "action_id_required" });
  if (feedback.length < 8) return ok({ success: false, error: "feedback_too_short" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userId = await extractUserId(req, anon);

  // 1) Carrega a proposta original
  const { data: original, error: readErr } = await service
    .from("ads_autopilot_actions")
    .select(
      "id, tenant_id, session_id, channel, action_type, action_data, status, parent_action_id, created_at",
    )
    .eq("id", actionId)
    .maybeSingle();

  if (readErr) return ok({ success: false, error: "read_failed", detail: readErr.message });
  if (!original) return ok({ success: false, error: "proposal_not_found" });
  if (original.tenant_id !== tenantId) return ok({ success: false, error: "tenant_mismatch" });

  if (original.status === "rejected" || original.status === "approved" || original.status === "executed") {
    return ok({ success: false, error: "proposal_not_adjustable", current_status: original.status });
  }
  if (original.status === "superseded") {
    return ok({ success: false, error: "proposal_already_superseded" });
  }

  const data: any = (original.action_data as any) || {};
  const lifecycle = data.lifecycle || {};
  const history: any[] = Array.isArray(data.adjustment_history) ? data.adjustment_history : [];

  // 1.5) Anti dupla chamada: se já há revisão em curso há menos de 10 min, retorna idempotente
  const lastInProgress = history
    .filter((h: any) => h && h.status === "in_progress" && h.at)
    .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  if (lastInProgress && Date.now() - new Date(lastInProgress.at).getTime() < IN_PROGRESS_WINDOW_MS) {
    return ok({
      success: true,
      already_in_progress: true,
      original_action_id: original.id,
      message: "Já existe um ajuste em processamento para esta proposta.",
    });
  }

  const watermark = new Date().toISOString();
  const currentVersion = Number(data.version || 1);

  // 2) Marca a proposta original como `superseded` + lifecycle de ajuste
  //    NÃO usa `rejected` — preserva a semântica de "pediu revisão".
  const lifecycleStatus = lifecycleForAction(original.action_type);
  const updatedData = {
    ...data,
    lifecycle: {
      ...lifecycle,
      status: lifecycleStatus,
      adjustment_requested_at: watermark,
      adjustment_requested_by: userId,
    },
    adjustment_history: [
      ...history,
      {
        at: watermark,
        by: userId,
        feedback,
        from_version: currentVersion,
        status: "in_progress",
      },
    ],
  };
  delete (updatedData as any).draft_patch;

  const { error: updErr } = await service
    .from("ads_autopilot_actions")
    .update({
      status: "superseded",
      action_data: updatedData,
      // IMPORTANTE: NUNCA preenche rejection_reason aqui — não é recusa.
    })
    .eq("id", original.id);

  if (updErr) return ok({ success: false, error: "update_failed", detail: updErr.message });

  // 3) Grava feedback estruturado como `needs_revision`
  //    (a função registra e dispara ads-ai-learnings-write automaticamente).
  let feedbackId: string | null = null;
  let feedbackError: string | null = null;
  try {
    const adAccountId =
      data?.ad_account_id || data?.preview?.ad_account_id || null;
    const campaignName =
      data?.campaign_name || data?.preview?.campaign_name || null;
    const objective =
      data?.objective || data?.preview?.objective || null;

    const fbPayload = {
      tenant_id: tenantId,
      action_id: original.id,
      ads_platform: (original.channel || "meta").toString(),
      ad_account_id: adAccountId,
      campaign_name: campaignName,
      objective,
      action_type: original.action_type,
      metrics_snapshot: data?.metrics_snapshot || data?.preview?.metrics_snapshot || {},
      observation: null,
      decision: "needs_revision",
      reason_codes: ["user_explained_rejection"], // catálogo controlado; tratamos como pedido de ajuste
      reason_text: feedback,
      tags: ["adjustment_request"],
    };

    // Encaminha o JWT do usuário para respeitar RLS (mesma origem)
    const headers: Record<string, string> = {};
    const auth = req.headers.get("Authorization") || req.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const { data: fbResp, error: fbErr } = await service.functions.invoke(
      "ads-autopilot-feedback-record",
      { body: fbPayload, headers },
    );
    if (fbErr) feedbackError = fbErr.message || String(fbErr);
    else if (fbResp && (fbResp as any).success === false) {
      feedbackError = String((fbResp as any).error || "feedback_record_failed");
    } else if (fbResp && (fbResp as any).feedback_id) {
      feedbackId = String((fbResp as any).feedback_id);
    }
  } catch (e: any) {
    feedbackError = e?.message || String(e);
  }

  // 4) Aciona o Strategist em modo revisão.
  //    Outras campanhas pendentes ficam protegidas (não recriar).
  const { data: otherPendingRaw } = await service
    .from("ads_autopilot_actions")
    .select("action_data")
    .eq("tenant_id", tenantId)
    .eq("action_type", "create_campaign")
    .eq("status", "pending_approval");
  const otherPendingCampaigns = (otherPendingRaw || [])
    .map((p: any) => p?.action_data?.campaign_name || p?.action_data?.preview?.campaign_name)
    .filter(Boolean);

  const { data: stratResp, error: stratErr } = await service.functions.invoke(
    "ads-autopilot-strategist",
    {
      body: {
        tenant_id: tenantId,
        trigger: "revision",
        revision_feedback: feedback,
        revision_action_id: original.id,
        revision_action_type: original.action_type,
        revision_action_data: {
          campaign_name: data?.campaign_name || data?.preview?.campaign_name,
          product_name: data?.product_name,
          funnel_stage: data?.funnel_stage || data?.preview?.funnel_stage,
        },
        other_pending_campaigns: otherPendingCampaigns,
        adjustment_source_action_id: original.id,
        adjustment_feedback_id: feedbackId,
      },
    },
  );

  const stratFailed =
    !!stratErr || (stratResp && (stratResp as any).success === false);

  if (stratFailed) {
    // Reverte o lifecycle para "needs_adjustment_failed" mas mantém superseded
    // para auditoria. Não silenciar o erro.
    const failedEntry = (updatedData.adjustment_history || []).map((h: any, i: number, arr: any[]) =>
      i === arr.length - 1
        ? { ...h, status: "failed", error: stratErr?.message || (stratResp as any)?.error || "strategist_failed" }
        : h,
    );
    await service
      .from("ads_autopilot_actions")
      .update({
        action_data: {
          ...updatedData,
          lifecycle: {
            ...updatedData.lifecycle,
            status: `${lifecycleStatus}_failed`,
            adjustment_error: stratErr?.message || (stratResp as any)?.error || null,
          },
          adjustment_history: failedEntry,
        },
      })
      .eq("id", original.id);

    return ok({
      success: false,
      error: "strategist_revision_failed",
      detail: stratErr?.message || (stratResp as any)?.error || null,
      feedback_id: feedbackId,
      feedback_error: feedbackError,
      original_action_id: original.id,
    });
  }

  // 5) Procura a nova proposta filha criada após o watermark e vincula
  const { data: newActions } = await service
    .from("ads_autopilot_actions")
    .select("id, action_type, action_data, status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", watermark)
    .in("status", ["pending_approval", "incomplete"])
    .order("created_at", { ascending: false })
    .limit(10);

  const newChild =
    (newActions || []).find((a: any) => a.action_type === original.action_type) ||
    (newActions || [])[0] ||
    null;

  if (newChild) {
    const childData: any = newChild.action_data || {};
    await service
      .from("ads_autopilot_actions")
      .update({
        parent_action_id: original.id,
        action_data: {
          ...childData,
          version: currentVersion + 1,
          revision_source: {
            parent_action_id: original.id,
            version_from: currentVersion,
            user_feedback: feedback,
            feedback_id: feedbackId,
          },
          lifecycle: {
            ...(childData.lifecycle || {}),
            status: childData.action_type === "strategic_plan" || original.action_type === "strategic_plan"
              ? "plan_pending_review"
              : "campaign_proposal_pending_review",
            adjustment_of_action_id: original.id,
          },
        },
      })
      .eq("id", newChild.id);

    await service
      .from("ads_autopilot_actions")
      .update({ superseded_by_action_id: newChild.id })
      .eq("id", original.id);

    // Marca histórico do original como concluído com sucesso
    const okHistory = (updatedData.adjustment_history || []).map((h: any, i: number, arr: any[]) =>
      i === arr.length - 1
        ? { ...h, status: "completed", new_action_id: newChild.id, completed_at: new Date().toISOString() }
        : h,
    );
    await service
      .from("ads_autopilot_actions")
      .update({
        action_data: {
          ...updatedData,
          adjustment_history: okHistory,
          lifecycle: {
            ...updatedData.lifecycle,
            status: `${lifecycleStatus}_revised`,
            superseded_by_action_id: newChild.id,
          },
        },
      })
      .eq("id", original.id);
  }

  return ok({
    success: true,
    original_action_id: original.id,
    new_action_id: newChild?.id || null,
    new_version: currentVersion + 1,
    feedback_id: feedbackId,
    feedback_error: feedbackError,
    message: newChild
      ? "Nova versão gerada em Aguardando Ação."
      : "Pedido de ajuste registrado, mas a IA não devolveu nova versão. Verifique saldo de IA e tente novamente.",
  });
});
