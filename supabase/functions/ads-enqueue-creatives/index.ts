// =============================================================================
// ads-enqueue-creatives — Onda H.4.1
// Re-valida prontidão (gate puro) e enfileira creative_jobs para a proposta.
// Idempotente por proposal_action_id. Atualiza lifecycle para
// 'campaign_creatives_generating'. Não publica e não fala com Meta.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateCreativeReadiness } from "../_shared/ads-autopilot/creativeReadinessGate.ts";
import { loadCreativeReadiness } from "../_shared/ads-autopilot/readinessLoader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return ok({ success: false, error_pt: "Sessão não identificada." });
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return ok({ success: false, error_pt: "Sessão inválida." });

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || "");
    const actionId = String(body.action_id || "");
    if (!tenantId || !actionId) return ok({ success: false, error_pt: "Parâmetros obrigatórios ausentes." });

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!role) return ok({ success: false, error_pt: "Sem permissão para esta loja." });

    // ---- Idempotência: já existem jobs para esta proposta? ----
    const { data: existingJobs } = await supabase
      .from("creative_jobs")
      .select("id, status, settings")
      .eq("tenant_id", tenantId)
      .filter("settings->>proposal_action_id", "eq", actionId);

    if ((existingJobs || []).length > 0) {
      return ok({
        success: true,
        already_enqueued: true,
        jobs: existingJobs,
      });
    }

    // ---- Re-validação no servidor (gate puro) ----
    const loaded = await loadCreativeReadiness(supabase, tenantId, actionId);
    if (loaded.fatal) return ok({ success: false, error_pt: loaded.fatal });

    const readiness = evaluateCreativeReadiness(loaded.input);
    if (readiness.status !== "ready") {
      return ok({
        success: false,
        error_pt: "Ainda existem configurações pendentes. Atualize a tela e tente novamente.",
        readiness,
      });
    }

    if (!loaded.resolved.product_id || !loaded.resolved.product_image_url) {
      return ok({ success: false, error_pt: "Produto da campanha não foi identificado completamente." });
    }

    // ---- Disparo: 1 chamada à creative-image-generate por variação real ----
    const realCreatives = loaded.input.proposal.planned_creatives.filter(
      (pc) => pc.format !== "test_pending",
    );

    const createdJobs: Array<{ id: string; planned_creative_index: number }> = [];
    const failures: Array<{ index: number; error: string }> = [];

    for (const pc of realCreatives) {
      try {
        const resp = await supabase.functions.invoke("creative-image-generate", {
          body: {
            tenant_id: tenantId,
            product_id: loaded.resolved.product_id,
            product_name: loaded.resolved.product_name,
            product_description: loaded.resolved.product_description,
            product_image_url: loaded.resolved.product_image_url,
            prompt: "",
            settings: {
              providers: ["openai", "gemini"],
              generation_style: "product_natural",
              format: "square",
              quality: "medium",
              variations: 1,
              enable_qa: true,
              enable_fallback: true,
            },
            // Vínculo estrutural — gravado direto no INSERT do job, sem corrida
            proposal_link: {
              proposal_action_id: actionId,
              planned_creative_index: pc.index,
            },
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const jobId = (resp.data as any)?.data?.job_id || (resp.data as any)?.job_id;
        if (!jobId) {
          failures.push({ index: pc.index, error: "Geração não retornou job_id." });
          continue;
        }
        createdJobs.push({ id: jobId, planned_creative_index: pc.index });
      } catch (err) {
        failures.push({ index: pc.index, error: String(err) });
      }
    }

    if (createdJobs.length === 0) {
      return ok({
        success: false,
        error_pt: "Não foi possível iniciar nenhuma geração de criativo.",
        failures,
      });
    }

    // ---- Atualiza lifecycle da ação ----
    const { data: action } = await supabase
      .from("ads_autopilot_actions")
      .select("action_data")
      .eq("id", actionId)
      .maybeSingle();

    const ad = action?.action_data || {};
    const lifecycle = ad.lifecycle || {};
    const newAd = {
      ...ad,
      lifecycle: {
        ...lifecycle,
        status: "campaign_creatives_generating",
        creative_jobs: createdJobs,
        creative_jobs_enqueued_at: new Date().toISOString(),
        cost_estimate: readiness.cost_estimate,
      },
    };
    await supabase.from("ads_autopilot_actions").update({ action_data: newAd }).eq("id", actionId);

    return ok({
      success: true,
      already_enqueued: false,
      jobs: createdJobs,
      failures,
      cost_estimate: readiness.cost_estimate,
    });
  } catch (e) {
    console.error("[ads-enqueue-creatives] error", e);
    return ok({ success: false, error_pt: "Falha ao iniciar geração de criativos." });
  }
});
