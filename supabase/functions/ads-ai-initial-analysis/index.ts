// =============================================================================
// ads-ai-initial-analysis — Onda E
// Executa a "análise inicial" do Gestor de Tráfego IA (Modo Piloto Inicial
// ou execução manual). Reaproveita o Strategist como motor de contexto/IA e
// persiste o resultado em ads_ai_analysis_runs para auditoria.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "ads-ai-initial-analysis@1.0.0";

// Janela em horas para considerar uma análise concluída "recente"
const RECENT_HOURS = 24;

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}
function fail(error: string, status = 200) {
  return new Response(JSON.stringify({ success: false, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({} as any));
    const tenantId: string | undefined = body.tenant_id;
    const platform: string = (body.platform || "meta").toLowerCase();
    const scope: "account" | "global" = body.scope === "global" ? "global" : "account";
    const adAccountId: string | null = scope === "account" ? (body.ad_account_id || null) : null;
    const trigger: "activation_initial" | "manual" =
      body.trigger === "manual" ? "manual" : "activation_initial";
    const force = body.force === true;
    const createdBy: string | null = body.created_by || null;

    if (!tenantId) return fail("tenant_id_required");
    if (scope === "account" && !adAccountId) return fail("ad_account_id_required_for_account_scope");

    // Hoje só Meta é operacional para análise inicial
    if (platform !== "meta") {
      return fail("platform_not_operational_for_initial_analysis");
    }

    // 1) Bloqueia se já existe execução running para o mesmo escopo
    const { data: runningRows } = await supabase
      .from("ads_ai_analysis_runs")
      .select("id, status, created_at")
      .eq("tenant_id", tenantId)
      .eq("platform", platform)
      .eq("scope", scope)
      .in("status", ["queued", "running"]);

    const sameAccount = (runningRows || []).filter((r: any) => true); // unique index garante exclusividade
    if (sameAccount.length > 0) {
      return ok({
        skipped: true,
        reason: "already_running",
        run_id: sameAccount[0].id,
      });
    }

    // 2) Avisa se há análise recente concluída e não veio force
    if (!force) {
      const sinceIso = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();
      let recentQ = supabase
        .from("ads_ai_analysis_runs")
        .select("id, finished_at")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("scope", scope)
        .eq("status", "completed")
        .gte("finished_at", sinceIso)
        .order("finished_at", { ascending: false })
        .limit(1);
      if (adAccountId) recentQ = recentQ.eq("ad_account_id", adAccountId);
      const { data: recent } = await recentQ;
      if (recent && recent.length > 0) {
        return ok({
          skipped: true,
          reason: "recent_completed_requires_force",
          recent_run_id: recent[0].id,
          recent_finished_at: recent[0].finished_at,
        });
      }
    }

    // 3) Cria a run (status=running). O unique index garante 1 ativa por escopo.
    const { data: inserted, error: insErr } = await supabase
      .from("ads_ai_analysis_runs")
      .insert({
        tenant_id: tenantId,
        platform,
        ad_account_id: adAccountId,
        scope,
        trigger,
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        input_config_snapshot: {
          platform,
          scope,
          ad_account_id: adAccountId,
          trigger,
          version: VERSION,
        },
      })
      .select("id")
      .single();
    if (insErr) {
      // Provavelmente conflito do unique index (race) — devolve já existente.
      const { data: existing } = await supabase
        .from("ads_ai_analysis_runs")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("scope", scope)
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
      if (existing?.id) return ok({ skipped: true, reason: "already_running", run_id: existing.id });
      return fail(insErr.message);
    }
    const runId = inserted!.id;

    // 4) Carrega configs ativas usadas como contexto (snapshot amigável)
    let cfgQ = supabase
      .from("ads_autopilot_account_configs")
      .select("ad_account_id, channel, budget_cents, budget_mode, target_roi, min_roi_cold, min_roi_warm, strategy_mode, user_instructions, autonomy_mode, kill_switch, is_ai_enabled")
      .eq("tenant_id", tenantId)
      .eq("channel", platform)
      .eq("is_ai_enabled", true);
    if (adAccountId) cfgQ = cfgQ.eq("ad_account_id", adAccountId);
    const { data: cfgs } = await cfgQ;

    let metaProdQ = supabase
      .from("ads_meta_production_config")
      .select("ad_account_id, facebook_page_id, instagram_actor_id, pixel_id, default_conversion_event, default_objective, default_buying_type, default_budget_type, default_daily_budget_cents, default_country, default_language, default_age_min, default_age_max, default_placements, default_cta, default_creative_format")
      .eq("tenant_id", tenantId);
    if (adAccountId) metaProdQ = metaProdQ.eq("ad_account_id", adAccountId);
    const { data: prodCfgs } = await metaProdQ;

    const accountSnapshot = {
      platform,
      scope,
      accounts: (cfgs || []).map((c: any) => ({
        ad_account_id: c.ad_account_id,
        budget_cents: c.budget_cents,
        budget_mode: c.budget_mode,
        target_roi: c.target_roi,
        strategy_mode: c.strategy_mode,
        has_user_instructions: !!(c.user_instructions && c.user_instructions.length),
        autonomy_mode: c.autonomy_mode,
      })),
      production_config: (prodCfgs || []).map((p: any) => ({
        ad_account_id: p.ad_account_id,
        has_facebook_page: !!p.facebook_page_id,
        has_instagram: !!p.instagram_actor_id,
        has_pixel: !!p.pixel_id,
        has_conversion_event: !!p.default_conversion_event,
        default_objective: p.default_objective,
        default_daily_budget_cents: p.default_daily_budget_cents,
        default_country: p.default_country,
        default_cta: p.default_cta,
        default_creative_format: p.default_creative_format,
      })),
    };

    const limitations: string[] = [];
    if ((cfgs || []).length === 0) limitations.push("Nenhuma conta de anúncios ativa para esta análise.");
    if ((prodCfgs || []).some((p: any) => !p.facebook_page_id)) limitations.push("Página do Facebook não configurada em ao menos uma conta.");
    if ((prodCfgs || []).some((p: any) => !p.pixel_id)) limitations.push("Pixel não configurado em ao menos uma conta.");
    if ((prodCfgs || []).some((p: any) => !p.default_conversion_event)) limitations.push("Evento de conversão padrão não configurado em ao menos uma conta.");

    // Atualiza snapshot na run antes de chamar a IA (para auditoria mesmo em falha)
    await supabase
      .from("ads_ai_analysis_runs")
      .update({
        account_snapshot_summary: accountSnapshot,
        limitations,
      })
      .eq("id", runId);

    // 5) Invoca o Strategist (motor real de produção). trigger="start" replica o
    // comportamento de "primeira ativação" — gera diagnóstico + plano + propostas.
    let strategistResult: any = null;
    let strategistError: string | null = null;
    try {
      const { data: stratData, error: stratErr } = await supabase.functions.invoke(
        "ads-autopilot-strategist",
        {
          body: {
            tenant_id: tenantId,
            trigger: "start",
            target_account_id: adAccountId,
            target_channel: platform,
            // Marcador de auditoria — não altera lógica do strategist
            initiated_by: "ads-ai-initial-analysis",
            analysis_run_id: runId,
          },
        },
      );
      if (stratErr) strategistError = stratErr.message || String(stratErr);
      else strategistResult = stratData;
    } catch (e: any) {
      strategistError = e?.message || String(e);
    }

    // 6) Coleta ações criadas pelo strategist nesta janela
    const { data: createdActions } = await supabase
      .from("ads_autopilot_actions")
      .select("id, action_type")
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    const createdActionIds = (createdActions || []).map((a: any) => a.id);

    // 7) Atualiza a run (completed/failed)
    const succeeded = !strategistError;
    const diagnosis =
      strategistResult?.data?.diagnosis ||
      strategistResult?.diagnosis ||
      (succeeded
        ? "Análise inicial concluída. Veja as propostas na fila Aguardando Ação."
        : "Não foi possível concluir a análise inicial.");

    const strategy =
      strategistResult?.data?.strategy_summary ||
      strategistResult?.strategy_summary ||
      (succeeded ? "Estratégia inicial registrada como propostas pendentes de aprovação." : "");

    await supabase
      .from("ads_ai_analysis_runs")
      .update({
        status: succeeded ? "completed" : "failed",
        finished_at: new Date().toISOString(),
        diagnosis_summary: diagnosis,
        strategy_summary: strategy,
        created_action_ids: createdActionIds,
        error_message: strategistError,
      })
      .eq("id", runId);

    return ok({
      run_id: runId,
      status: succeeded ? "completed" : "failed",
      created_action_ids: createdActionIds,
      limitations,
      error: strategistError,
    });
  } catch (err: any) {
    console.error(`[${VERSION}] fatal`, err?.message || err);
    return fail(err?.message || "internal_error");
  }
});
