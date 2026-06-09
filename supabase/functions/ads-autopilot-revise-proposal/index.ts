// =====================================================================
// ads-autopilot-revise-proposal — Frente 4.3
//
// Recebe um patch estruturado feito pelo usuário no editor de proposta,
// marca a proposta original como "superseded", chama o Strategist (1x)
// com o feedback estruturado e linka a nova versão na cadeia (parent/superseded_by).
//
// REGRAS INVIOLÁVEIS:
// - 1 chamada IA por execução (apenas o Strategist).
// - NÃO gera criativo, NÃO consome crédito, NÃO publica campanha,
//   NÃO chama Meta/Google/TikTok.
// - Mantém Quality Gate e Fit Gate (Strategist já aplica).
// - Resposta sempre 200 OK com envelope { success, ... }.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface RevisePayload {
  proposal_id: string;
  tenant_id: string;
  changed_fields: string[];
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  user_feedback?: {
    adjustment_reason?: string | null;
    note?: string | null;
    chips?: string[];
  } | null;
}

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildHumanFeedback(p: RevisePayload, currentVersion: number): string {
  const lines: string[] = [];
  lines.push(`### REVISÃO ESTRUTURADA — v${currentVersion} → v${currentVersion + 1}`);
  if (p.changed_fields.length > 0) {
    lines.push("\nCampos alterados pelo usuário:");
    for (const f of p.changed_fields) {
      const prev = (p.previous_values as any)[f];
      const next = (p.new_values as any)[f];
      lines.push(`- ${f}: "${prev ?? ""}" → "${next ?? ""}"`);
    }
  }
  if (p.user_feedback?.adjustment_reason) {
    lines.push(`\nMotivo do ajuste: ${p.user_feedback.adjustment_reason}`);
  }
  if (p.user_feedback?.chips && p.user_feedback.chips.length > 0) {
    lines.push(`Categorias de feedback: ${p.user_feedback.chips.join(", ")}`);
  }
  if (p.user_feedback?.note) {
    lines.push(`\nObservação: ${p.user_feedback.note}`);
  }
  lines.push(
    "\nRespeite obrigatoriamente: Quality Gate, Product/Funnel Fit Gate, exclusão de Clientes em Frio. NÃO gere criativos reais; mantenha fluxo two_step_v1 Etapa 1 (estratégia + brief).",
  );
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: RevisePayload;
  try {
    payload = await req.json();
  } catch {
    return ok({ success: false, error: "invalid_json" });
  }

  if (!payload?.proposal_id || !payload?.tenant_id) {
    return ok({ success: false, error: "missing_required_fields" });
  }
  if (!Array.isArray(payload.changed_fields)) {
    payload.changed_fields = [];
  }

  // 1) Read original proposal
  const { data: original, error: readErr } = await supabase
    .from("ads_autopilot_actions")
    .select("id, tenant_id, session_id, channel, action_type, action_data, status, created_at, parent_action_id")
    .eq("id", payload.proposal_id)
    .maybeSingle();

  if (readErr || !original) {
    return ok({ success: false, error: "proposal_not_found" });
  }
  if (original.tenant_id !== payload.tenant_id) {
    return ok({ success: false, error: "tenant_mismatch" });
  }
  if (original.status === "superseded") {
    return ok({ success: false, error: "already_superseded" });
  }

  const data: any = original.action_data || {};
  const currentVersion = Number(data.version || 1);
  const adjustmentHistory = Array.isArray(data.adjustment_history) ? data.adjustment_history : [];

  // 2) Mark original as superseded + write history entry
  const updatedData = {
    ...data,
    adjustment_history: [
      ...adjustmentHistory,
      {
        from_version: currentVersion,
        changed_fields: payload.changed_fields,
        previous_values: payload.previous_values,
        new_values: payload.new_values,
        user_feedback: payload.user_feedback || null,
        at: new Date().toISOString(),
      },
    ],
  };
  // Clear draft after submitting
  delete (updatedData as any).draft_patch;

  await supabase
    .from("ads_autopilot_actions")
    .update({
      status: "superseded",
      action_data: updatedData,
    })
    .eq("id", payload.proposal_id);

  // 3) Capture watermark for new actions
  const watermark = new Date().toISOString();

  // 4) Call Strategist with structured revision context
  const humanFeedback = buildHumanFeedback(payload, currentVersion);

  const { data: stratResp, error: stratErr } = await supabase.functions.invoke(
    "ads-autopilot-strategist",
    {
      body: {
        tenant_id: payload.tenant_id,
        trigger: "revision",
        revision_feedback: humanFeedback,
        revision_action_id: payload.proposal_id,
        revision_action_type: original.action_type,
        revision_action_data: {
          campaign_name:
            (payload.new_values as any).campaign_name ||
            data?.campaign_name ||
            data?.preview?.campaign_name,
          product_name: data?.product_name || data?.preview?.product_name,
          funnel_stage:
            (payload.new_values as any).funnel_stage ||
            data?.funnel_stage ||
            data?.preview?.funnel_stage,
        },
        revision_structured_patch: {
          version_from: currentVersion,
          changed_fields: payload.changed_fields,
          previous_values: payload.previous_values,
          new_values: payload.new_values,
          user_feedback: payload.user_feedback || null,
        },
        other_pending_campaigns: [],
      },
    },
  );

  if (stratErr) {
    return ok({ success: false, error: "strategist_call_failed", detail: String(stratErr.message || stratErr) });
  }
  if (stratResp && stratResp.success === false) {
    return ok({ success: false, error: "strategist_revision_failed", detail: stratResp.error || null });
  }

  // 5) Find the new child proposal and link it (best effort, last action created after watermark)
  const { data: newActions } = await supabase
    .from("ads_autopilot_actions")
    .select("id, action_data, created_at, action_type, status")
    .eq("tenant_id", payload.tenant_id)
    .gte("created_at", watermark)
    .in("status", ["pending_approval", "pending"])
    .order("created_at", { ascending: false })
    .limit(5);

  const newChild =
    (newActions || []).find((a) => a.action_type === original.action_type) ||
    (newActions || [])[0] ||
    null;

  if (newChild) {
    const childData: any = newChild.action_data || {};
    await supabase
      .from("ads_autopilot_actions")
      .update({
        parent_action_id: payload.proposal_id,
        action_data: {
          ...childData,
          version: currentVersion + 1,
          revision_source: {
            parent_action_id: payload.proposal_id,
            version_from: currentVersion,
            changed_fields: payload.changed_fields,
            user_feedback: payload.user_feedback || null,
          },
        },
      })
      .eq("id", newChild.id);

    await supabase
      .from("ads_autopilot_actions")
      .update({ superseded_by_action_id: newChild.id })
      .eq("id", payload.proposal_id);
  }

  return ok({
    success: true,
    superseded_id: payload.proposal_id,
    new_proposal_id: newChild?.id || null,
    new_version: currentVersion + 1,
  });
});
