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
} from "../_shared/ads-autopilot/feedbackContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normLearningTitle(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function writeLearningDirect(service: any, params: {
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  source_type: string;
  source_action_id: string | null;
  source_feedback_id: string;
  metadata: Record<string, unknown>;
}) {
  const title = String(params.title || "").trim().slice(0, 200);
  if (title.length < 6) return { success: false, error: "empty_or_too_short_title" };

  const normalized = normLearningTitle(title);
  const { data: same, error: sameErr } = await service
    .from("ads_ai_learnings")
    .select("id, title, evidence_count, confidence, status")
    .eq("tenant_id", params.tenant_id)
    .eq("category", params.category)
    .neq("status", "archived");

  if (sameErr) return { success: false, error: "learning_lookup_failed", details: sameErr.message };

  const hit = (same || []).find((r: any) => normLearningTitle(r.title) === normalized);
  if (hit) {
    const newEvidence = Math.min(999, Number(hit.evidence_count || 0) + 1);
    const newConfidence = Math.min(1, Number(hit.confidence || 0.5) + 0.05);
    const { error: updErr } = await service
      .from("ads_ai_learnings")
      .update({ evidence_count: newEvidence, confidence: newConfidence })
      .eq("id", hit.id);
    if (updErr) return { success: false, error: "learning_reinforce_failed", details: updErr.message };
    return { success: true, action: "reinforced", learning_id: hit.id, evidence_count: newEvidence };
  }

  const { data: inserted, error: insErr } = await service
    .from("ads_ai_learnings")
    .insert({
      tenant_id: params.tenant_id,
      title,
      description: params.description,
      category: params.category,
      // Onda 3.3 — Aprendizados nascem ATIVOS por padrão.
      status: "active",
      source_type: params.source_type,
      source_action_id: params.source_action_id,
      source_feedback_id: params.source_feedback_id,
      metadata: params.metadata,
    })
    .select("id, status")
    .single();

  if (insErr) return { success: false, error: "learning_insert_failed", details: insErr.message };
  return { success: true, action: "created", learning_id: inserted.id, status: inserted.status };
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

  // Onda F — Cria aprendizado sugerido a partir do feedback quando há conteúdo útil.
  // Não bloqueia o fluxo se falhar. NÃO ativa sozinho.
  let learning_action: string | null = null;
  try {
    const observation = (input.observation || "").trim();
    const reasonText = (input.reason_text || "").trim();
    const candidate = [reasonText, observation].filter(Boolean).join(" — ").slice(0, 200);
    const meaningful = input.decision === "needs_revision"
      ? candidate.length >= 8
      : candidate.length >= 12 || input.should_become_preference === true;
    if (meaningful) {
      const decisionToSource: Record<string, string> = {
        approved: "approval",
        edited_then_approved: "adjustment",
        rejected: "rejection",
        needs_revision: "adjustment",
      };
      const sourceType = decisionToSource[input.decision] || "system";
      const categoryGuess = (() => {
        const t = candidate.toLowerCase();
        if (/(p[uú]blico|cold|frio|quente|interesses?|lookalike)/.test(t)) return "publico";
        if (/(or[cç]amento|budget|cents?)/.test(t)) return "orcamento";
        if (/(criativo|copy|texto|imagem|v[ií]deo)/.test(t)) return "criativo";
        if (/(produto|kit|sku)/.test(t)) return "produto";
        if (/(funil|tof|bof|mof|prospec)/.test(t)) return "funil";
        if (/(roas|cpa|ctr|performance)/.test(t)) return "performance";
        if (/(utm|tracking|pixel)/.test(t)) return "tracking";
        if (/(oferta|desconto|promo)/.test(t)) return "oferta";
        return "outro";
      })();
      const titleFromContext = candidate || `Preferência registrada pelo usuário (${input.decision})`;
      // IMPORTANTE: await obrigatório. Fire-and-forget era morto pelo runtime
      // antes do learnings-write gravar — resultado: feedback existia mas
      // aprendizado não era criado.
      try {
        const { data: lr, error: le } = await service.functions.invoke(
          "ads-ai-learnings-write",
          {
            body: {
              tenant_id: input.tenant_id,
              title: titleFromContext,
              description: observation || reasonText || null,
              category: categoryGuess,
              source_type: sourceType,
              source_action_id: input.action_id || null,
              source_feedback_id: inserted.id,
              metadata: {
                decision: input.decision,
                reason_codes: input.reason_codes,
                ads_platform: input.ads_platform,
              },
            },
          },
        );
        if (le) {
          console.warn("[ads-autopilot-feedback-record] learnings write failed:", le?.message);
          const direct = await writeLearningDirect(service, {
            tenant_id: input.tenant_id,
            title: titleFromContext,
            description: observation || reasonText || null,
            category: categoryGuess,
            source_type: sourceType,
            source_action_id: input.action_id || null,
            source_feedback_id: inserted.id,
            metadata: {
              decision: input.decision,
              reason_codes: input.reason_codes,
              ads_platform: input.ads_platform,
              fallback: "feedback_record_direct_write_after_invoke_error",
            },
          });
          learning_action = (direct as any)?.action || null;
        } else {
          learning_action = (lr as any)?.action || null;
          if (!learning_action || (lr as any)?.success === false) {
            const direct = await writeLearningDirect(service, {
              tenant_id: input.tenant_id,
              title: titleFromContext,
              description: observation || reasonText || null,
              category: categoryGuess,
              source_type: sourceType,
              source_action_id: input.action_id || null,
              source_feedback_id: inserted.id,
              metadata: {
                decision: input.decision,
                reason_codes: input.reason_codes,
                ads_platform: input.ads_platform,
                fallback: "feedback_record_direct_write_after_empty_response",
                original_response: lr || null,
              },
            });
            learning_action = (direct as any)?.action || learning_action;
          }
        }
      } catch (e: any) {
        console.warn("[ads-autopilot-feedback-record] learnings write threw:", e?.message);
        const direct = await writeLearningDirect(service, {
          tenant_id: input.tenant_id,
          title: titleFromContext,
          description: observation || reasonText || null,
          category: categoryGuess,
          source_type: sourceType,
          source_action_id: input.action_id || null,
          source_feedback_id: inserted.id,
          metadata: {
            decision: input.decision,
            reason_codes: input.reason_codes,
            ads_platform: input.ads_platform,
            fallback: "feedback_record_direct_write_after_throw",
            original_error: e?.message || String(e),
          },
        });
        learning_action = (direct as any)?.action || null;
      }
    }
  } catch (lerr: any) {
    console.warn("[ads-autopilot-feedback-record] learnings hook threw:", lerr?.message);
  }

  return json(
    {
      success: true,
      feedback_id: inserted.id,
      decided_at: inserted.decided_at,
      learning_action,
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
