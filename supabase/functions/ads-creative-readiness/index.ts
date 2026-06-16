// =============================================================================
// ads-creative-readiness — Onda H.4.1
// Calcula prontidão de geração de criativos para uma proposta aprovada.
// Read-only: nunca insere creative_jobs. Retorna 200 OK com envelope success.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateCreativeReadiness } from "../_shared/ads-autopilot/creativeReadinessGate.ts";
import { loadCreativeReadiness } from "../_shared/ads-autopilot/readinessLoader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
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
    if (!tenantId || !actionId) {
      return ok({ success: false, error_pt: "Parâmetros obrigatórios ausentes." });
    }

    // Tenant access guard
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!role) return ok({ success: false, error_pt: "Sem permissão para esta loja." });

    const loaded = await loadCreativeReadiness(supabase, tenantId, actionId);
    if (loaded.fatal) return ok({ success: false, error_pt: loaded.fatal });

    const result = evaluateCreativeReadiness(loaded.input);

    // Idempotência informativa: já existem jobs ligados a esta proposta?
    const { data: existingJobs } = await supabase
      .from("creative_jobs")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .filter("settings->>proposal_action_id", "eq", actionId);

    return ok({
      success: true,
      readiness: result,
      existing_jobs_count: (existingJobs || []).length,
      product_resolved: !!loaded.resolved.product_id,
    });
  } catch (e) {
    console.error("[ads-creative-readiness] error", e);
    return ok({ success: false, error_pt: "Falha ao calcular prontidão de criativos." });
  }
});
