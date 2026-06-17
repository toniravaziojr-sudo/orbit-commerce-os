// =============================================================================
// ads-ai-initial-analysis — Onda E (correção: escopo global mínimo)
// Executa a "análise inicial" do Gestor de Tráfego IA (Modo Piloto Inicial
// ou execução manual). Reaproveita o Strategist como motor de contexto/IA e
// persiste o resultado em ads_ai_analysis_runs para auditoria.
//
// Escopos suportados:
//  - account: roda para uma única conta Meta.
//  - global : roda para todas as contas Meta operacionais/ativas do tenant.
//             Google/TikTok ainda não são operacionais — são listados como
//             limitação amigável e ignorados na execução.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveAccountDefaults } from "../_shared/ads-autopilot/accountDefaults.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "ads-ai-initial-analysis@1.3.0";
const RECENT_HOURS = 24;
// Onda H — Frescor da espelhagem Meta. Se o último sync de campanhas dessa conta
// for mais antigo que esse intervalo, dispara um sync leve antes da análise para
// evitar que a IA proponha pausa/ajuste em campanha já alterada manualmente.
const META_MIRROR_FRESHNESS_MS = 10 * 60 * 1000;

/**
 * Garante que o espelho local de campanhas Meta está fresco para a conta.
 * Lê o MAX(synced_at) em meta_ad_campaigns; se estiver ausente ou >10 min,
 * dispara meta-ads-campaigns action=sync apenas para essa conta. Falha silenciosa
 * (registra limitação amigável) para nunca derrubar a análise.
 */
async function ensureMetaCampaignMirrorFresh(
  supabase: any,
  tenantId: string,
  platform: string,
  adAccountId: string,
  limitations: string[],
): Promise<{ synced: boolean; reason: string }> {
  if (platform !== "meta") return { synced: false, reason: "not_meta" };
  try {
    const { data: row } = await supabase
      .from("meta_ad_campaigns")
      .select("synced_at")
      .eq("tenant_id", tenantId)
      .eq("ad_account_id", adAccountId)
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastSync = row?.synced_at ? new Date(row.synced_at).getTime() : 0;
    const ageMs = Date.now() - lastSync;
    if (lastSync && ageMs < META_MIRROR_FRESHNESS_MS) {
      return { synced: false, reason: "fresh" };
    }
    const { data: syncResp, error: syncErr } = await supabase.functions.invoke(
      "meta-ads-campaigns",
      { body: { action: "sync", tenant_id: tenantId, ad_account_id: adAccountId } },
    );
    if (syncErr || syncResp?.success === false) {
      limitations.push("Não foi possível atualizar o status das campanhas com a Meta agora — análise usou o último estado conhecido.");
      return { synced: false, reason: "sync_failed" };
    }
    return { synced: true, reason: "synced" };
  } catch (_e) {
    limitations.push("Não foi possível atualizar o status das campanhas com a Meta agora — análise usou o último estado conhecido.");
    return { synced: false, reason: "exception" };
  }
}

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

// Vigia preguiçoso: marca como falha qualquer execução "running" deste tenant
// parada há mais de STUCK_RUN_MS. Evita travamento eterno quando a função morre
// por tempo limite sem conseguir atualizar o status.
const STUCK_RUN_MS = 8 * 60 * 1000;
async function expireStuckRuns(supabase: any, tenantId: string) {
  try {
    const cutoff = new Date(Date.now() - STUCK_RUN_MS).toISOString();
    await supabase
      .from("ads_ai_analysis_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: "Execução interrompida por tempo limite — vigia automático",
      })
      .eq("tenant_id", tenantId)
      .eq("status", "running")
      .lt("started_at", cutoff);
  } catch (e) {
    console.warn(`[${VERSION}] expireStuckRuns failed`, (e as any)?.message || e);
  }
}

// EdgeRuntime.waitUntil tipagem
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;
function runInBackground(p: Promise<unknown>) {
  try {
    // @ts-ignore — EdgeRuntime existe no runtime Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p);
      return;
    }
  } catch (_e) { /* fallback abaixo */ }
  // Fallback (sem EdgeRuntime): apenas detacha; engole erro pra não derrubar.
  p.catch((e) => console.error(`[${VERSION}] background error`, e?.message || e));
}

interface RunAccountInput {
  supabase: any;
  tenantId: string;
  platform: string;
  adAccountId: string;
  trigger: "activation_initial" | "manual";
  createdBy: string | null;
  force: boolean;
  parentRunId?: string | null;
}

interface RunAccountOutput {
  ad_account_id: string;
  run_id: string | null;
  status: "completed" | "failed" | "skipped";
  skip_reason?: string;
  created_action_ids: string[];
  diagnosis_summary?: string;
  strategy_summary?: string;
  error?: string | null;
  context_summary?: string;
}

/**
 * Monta um resumo amigável (humano) do contexto usado na análise.
 * Não expõe payload técnico bruto. O snapshot completo continua em
 * input_config_snapshot para auditoria.
 */
function buildHumanContextSummary(
  adAccountId: string,
  cfg: any | null,
  prod: any | null,
): string {
  const parts: string[] = [];
  parts.push(`conta Meta ${adAccountId}`);
  if (cfg?.budget_cents != null) {
    const v = (Number(cfg.budget_cents) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    parts.push(`orçamento ${v}`);
  }
  if (cfg?.target_roi) parts.push(`ROI/ROAS alvo ${cfg.target_roi}`);
  if (prod?.default_country) parts.push(`país ${prod.default_country}`);
  if (prod?.default_age_min != null && prod?.default_age_max != null) {
    parts.push(`idade ${prod.default_age_min}-${prod.default_age_max}`);
  }
  if (Array.isArray(prod?.default_placements) && prod.default_placements.length) {
    parts.push(`posicionamentos ${prod.default_placements.join(", ")}`);
  }
  if (prod?.default_cta) parts.push(`CTA ${prod.default_cta}`);
  if (prod?.default_creative_format) parts.push(`formato ${prod.default_creative_format}`);
  if (cfg?.user_instructions) parts.push("diretrizes configuradas");
  return `Esta análise considerou: ${parts.join(", ")}.`;
}

/**
 * Executa a análise para UMA conta. Reutilizado pelos modos account e global.
 * Cria a run (scope=account), invoca o strategist, atualiza a run.
 */
async function runForAccount(input: RunAccountInput): Promise<RunAccountOutput> {
  const { supabase, tenantId, platform, adAccountId, trigger, createdBy, force, parentRunId } = input;

  // 1) Skip se já existe execução running para esta conta
  const { data: runningRows } = await supabase
    .from("ads_ai_analysis_runs")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("scope", "account")
    .eq("ad_account_id", adAccountId)
    .in("status", ["queued", "running"]);
  if (runningRows && runningRows.length > 0) {
    return {
      ad_account_id: adAccountId,
      run_id: runningRows[0].id,
      status: "skipped",
      skip_reason: "already_running",
      created_action_ids: [],
    };
  }

  // 2) Se não veio force, pula análise concluída <24h
  if (!force) {
    const sinceIso = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("ads_ai_analysis_runs")
      .select("id, finished_at")
      .eq("tenant_id", tenantId)
      .eq("platform", platform)
      .eq("scope", "account")
      .eq("ad_account_id", adAccountId)
      .eq("status", "completed")
      .gte("finished_at", sinceIso)
      .order("finished_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      return {
        ad_account_id: adAccountId,
        run_id: recent[0].id,
        status: "skipped",
        skip_reason: "recent_completed_requires_force",
        created_action_ids: [],
      };
    }
  }

  // 3) Carrega configs para snapshot e resumo humano
  const { data: cfgs } = await supabase
    .from("ads_autopilot_account_configs")
    .select("ad_account_id, channel, budget_cents, budget_mode, target_roi, min_roi_cold, min_roi_warm, strategy_mode, user_instructions, autonomy_mode, kill_switch, is_ai_enabled")
    .eq("tenant_id", tenantId)
    .eq("channel", platform)
    .eq("ad_account_id", adAccountId)
    .maybeSingle();

  const { data: prodCfgRaw } = await supabase
    .from("ads_meta_production_config")
    .select("ad_account_id, facebook_page_id, instagram_actor_id, pixel_id, default_conversion_event, default_objective, default_buying_type, default_budget_type, default_daily_budget_cents, default_country, default_language, default_age_min, default_age_max, default_placements, default_cta, default_creative_format")
    .eq("tenant_id", tenantId)
    .eq("ad_account_id", adAccountId)
    .maybeSingle();

  const accountDefaults = await resolveAccountDefaults(supabase, {
    tenant_id: tenantId,
    ad_account_id: adAccountId,
  });
  const prodCfg = {
    ...(prodCfgRaw || {}),
    facebook_page_id: prodCfgRaw?.facebook_page_id || accountDefaults.facebook_page_id,
    instagram_actor_id: prodCfgRaw?.instagram_actor_id || accountDefaults.instagram_actor_id,
    pixel_id: prodCfgRaw?.pixel_id || accountDefaults.pixel_id,
    default_conversion_event: prodCfgRaw?.default_conversion_event || accountDefaults.conversion_event_default,
    default_objective: prodCfgRaw?.default_objective || accountDefaults.default_objective,
    default_buying_type: prodCfgRaw?.default_buying_type || accountDefaults.default_buying_type,
    default_budget_type: prodCfgRaw?.default_budget_type || accountDefaults.default_budget_type,
    default_daily_budget_cents: prodCfgRaw?.default_daily_budget_cents ?? accountDefaults.default_daily_budget_cents,
    default_country: prodCfgRaw?.default_country || accountDefaults.default_country,
    default_age_min: prodCfgRaw?.default_age_min ?? accountDefaults.default_age_min,
    default_age_max: prodCfgRaw?.default_age_max ?? accountDefaults.default_age_max,
    default_placements: prodCfgRaw?.default_placements || accountDefaults.default_placements,
    default_cta: prodCfgRaw?.default_cta || accountDefaults.default_cta,
    default_creative_format: prodCfgRaw?.default_creative_format || accountDefaults.default_creative_format,
    source: accountDefaults.source,
  };

  const contextSummary = buildHumanContextSummary(adAccountId, cfgs, prodCfg);

  const limitations: string[] = [];
  if (!cfgs?.is_ai_enabled) limitations.push("Conta sem IA ativada — análise rodou em modo simulado.");
  if (!prodCfg?.facebook_page_id) limitations.push("Página do Facebook não configurada.");
  if (!prodCfg?.pixel_id) limitations.push("Pixel não configurado.");
  if (!prodCfg?.default_conversion_event) limitations.push("Evento de conversão padrão não configurado.");

  // 4) Cria a run
  const { data: inserted, error: insErr } = await supabase
    .from("ads_ai_analysis_runs")
    .insert({
      tenant_id: tenantId,
      platform,
      ad_account_id: adAccountId,
      scope: "account",
      trigger,
      status: "running",
      started_at: new Date().toISOString(),
      created_by: createdBy,
      input_config_snapshot: {
        platform,
        scope: "account",
        ad_account_id: adAccountId,
        trigger,
        version: VERSION,
        parent_run_id: parentRunId || null,
        account_config: cfgs || null,
        production_config: prodCfg || null,
      },
      account_snapshot_summary: {
        ad_account_id: adAccountId,
        human_summary: contextSummary,
        has_facebook_page: !!prodCfg?.facebook_page_id,
        has_instagram: !!prodCfg?.instagram_actor_id,
        has_pixel: !!prodCfg?.pixel_id,
        has_conversion_event: !!prodCfg?.default_conversion_event,
        default_objective: prodCfg?.default_objective || null,
        default_country: prodCfg?.default_country || null,
        target_roi: cfgs?.target_roi || null,
      },
      limitations,
    })
    .select("id")
    .single();

  if (insErr) {
    // Race: já criada por outra execução
    const { data: existing } = await supabase
      .from("ads_ai_analysis_runs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform", platform)
      .eq("scope", "account")
      .eq("ad_account_id", adAccountId)
      .in("status", ["queued", "running"])
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return {
        ad_account_id: adAccountId,
        run_id: existing.id,
        status: "skipped",
        skip_reason: "already_running",
        created_action_ids: [],
      };
    }
    return {
      ad_account_id: adAccountId,
      run_id: null,
      status: "failed",
      error: insErr.message,
      created_action_ids: [],
      context_summary: contextSummary,
    };
  }
  const runId = inserted!.id;

  // 4.5) Onda H — força frescor da espelhagem de campanhas Meta antes do strategist.
  // Evita propostas redundantes (pausar campanha já pausada / ajustar verba de
  // campanha já parada) quando o usuário muda algo na Meta entre crons.
  await ensureMetaCampaignMirrorFresh(supabase, tenantId, platform, adAccountId, limitations);

  // 5) Invoca o Strategist
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
          initiated_by: "ads-ai-initial-analysis",
          analysis_run_id: runId,
          parent_run_id: parentRunId || null,
        },
      },
    );
    if (stratErr) strategistError = stratErr.message || String(stratErr);
    else strategistResult = stratData;
  } catch (e: any) {
    strategistError = e?.message || String(e);
  }

  // 6) Coleta ações criadas nesta janela para esta conta
  const { data: createdActions } = await supabase
    .from("ads_autopilot_actions")
    .select("id, action_type, ad_account_id")
    .eq("tenant_id", tenantId)
    .eq("channel", platform)
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  const createdActionIds = (createdActions || [])
    .filter((a: any) => !a.ad_account_id || a.ad_account_id === adAccountId)
    .map((a: any) => a.id);

  // 7) Atualiza a run
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

  return {
    ad_account_id: adAccountId,
    run_id: runId,
    status: succeeded ? "completed" : "failed",
    created_action_ids: createdActionIds,
    diagnosis_summary: diagnosis,
    strategy_summary: strategy,
    error: strategistError,
    context_summary: contextSummary,
  };
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
    if (scope === "account" && !adAccountId)
      return fail("ad_account_id_required_for_account_scope");
    if (platform !== "meta")
      return fail("platform_not_operational_for_initial_analysis");

    // Vigia preguiçoso: destrava execuções "running" mortas por timeout
    await expireStuckRuns(supabase, tenantId);

    // ===== Escopo ACCOUNT =====
    if (scope === "account") {
      // Pré-checagem síncrona de skips (rápido) — execução pesada vai pra background
      const { data: runningRows } = await supabase
        .from("ads_ai_analysis_runs")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("scope", "account")
        .eq("ad_account_id", adAccountId)
        .in("status", ["queued", "running"])
        .limit(1);
      if (runningRows && runningRows.length > 0) {
        return ok({ skipped: true, reason: "already_running", run_id: runningRows[0].id });
      }
      if (!force) {
        const sinceIso = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("ads_ai_analysis_runs")
          .select("id, finished_at")
          .eq("tenant_id", tenantId)
          .eq("platform", platform)
          .eq("scope", "account")
          .eq("ad_account_id", adAccountId)
          .eq("status", "completed")
          .gte("finished_at", sinceIso)
          .order("finished_at", { ascending: false })
          .limit(1);
        if (recent && recent.length > 0) {
          return ok({
            skipped: true,
            reason: "recent_completed_requires_force",
            recent_run_id: recent[0].id,
            recent_finished_at: recent[0].finished_at,
          });
        }
      }

      // Despacha em segundo plano: a função responde imediatamente e o
      // estrategista termina sem o teto de tempo da resposta HTTP.
      runInBackground(
        runForAccount({
          supabase, tenantId, platform, adAccountId: adAccountId!,
          trigger, createdBy, force,
        }).then((out) => {
          console.log(`[${VERSION}] account bg done`, { adAccountId, status: out.status, run_id: out.run_id });
        }).catch(async (e: any) => {
          console.error(`[${VERSION}] account bg crash`, e?.message || e);
          // Vigia preguiçoso vai fechar como falha em até 8 min se ficar pendurada.
        })
      );

      return ok({
        accepted: true,
        status: "queued",
        scope: "account",
        message: "Análise iniciada em segundo plano. Acompanhe na tela.",
      });
    }


    // ===== Escopo GLOBAL =====
    // 1) Bloqueia se já existe run global ativa
    const { data: existingGlobal } = await supabase
      .from("ads_ai_analysis_runs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform", platform)
      .eq("scope", "global")
      .in("status", ["queued", "running"])
      .limit(1)
      .maybeSingle();
    if (existingGlobal?.id) {
      return ok({
        skipped: true,
        reason: "already_running",
        run_id: existingGlobal.id,
      });
    }

    // 2) Se não veio force, pula global concluído <24h
    if (!force) {
      const sinceIso = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("ads_ai_analysis_runs")
        .select("id, finished_at")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("scope", "global")
        .eq("status", "completed")
        .gte("finished_at", sinceIso)
        .order("finished_at", { ascending: false })
        .limit(1);
      if (recent && recent.length > 0) {
        return ok({
          skipped: true,
          reason: "recent_completed_requires_force",
          recent_run_id: recent[0].id,
          recent_finished_at: recent[0].finished_at,
        });
      }
    }

    // 3) Busca todas as contas Meta com IA ativada
    const { data: metaAccounts } = await supabase
      .from("ads_autopilot_account_configs")
      .select("ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("channel", "meta")
      .eq("is_ai_enabled", true);

    const accountIds = Array.from(
      new Set((metaAccounts || []).map((a: any) => a.ad_account_id).filter(Boolean)),
    );

    // 4) Detecta presença de Google/TikTok configurado, para limitação amigável
    const { data: otherChannels } = await supabase
      .from("ads_autopilot_account_configs")
      .select("channel")
      .eq("tenant_id", tenantId)
      .in("channel", ["google", "tiktok"]);
    const hasOther = (otherChannels || []).length > 0;

    const limitations: string[] = [];
    if (hasOther) {
      limitations.push(
        "Google Ads e TikTok Ads ainda não estão operacionais nesta etapa. Foram ignorados nesta análise.",
      );
    }
    if (accountIds.length === 0) {
      limitations.push("Nenhuma conta Meta com IA ativada — análise global sem alvos operacionais.");
    }

    // 5) Cria a run parent (scope=global)
    const { data: parentInserted, error: parentErr } = await supabase
      .from("ads_ai_analysis_runs")
      .insert({
        tenant_id: tenantId,
        platform,
        ad_account_id: null,
        scope: "global",
        trigger,
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        input_config_snapshot: {
          platform,
          scope: "global",
          trigger,
          version: VERSION,
          target_account_ids: accountIds,
          has_non_operational_channels: hasOther,
        },
        limitations,
      })
      .select("id")
      .single();
    if (parentErr) {
      const { data: existing } = await supabase
        .from("ads_ai_analysis_runs")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("scope", "global")
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
      if (existing?.id) return ok({ skipped: true, reason: "already_running", run_id: existing.id });
      return fail(parentErr.message);
    }
    const parentRunId = parentInserted!.id;

    // 6+7) Executa por conta e consolida — em SEGUNDO PLANO.
    // A resposta HTTP volta agora; o trabalho pesado continua sem o teto de tempo.
    runInBackground((async () => {
      const childResults: RunAccountOutput[] = [];
      for (const accId of accountIds) {
        try {
          const out = await runForAccount({
            supabase, tenantId, platform, adAccountId: accId,
            trigger, createdBy, force, parentRunId,
          });
          childResults.push(out);
        } catch (e: any) {
          childResults.push({
            ad_account_id: accId,
            run_id: null,
            status: "failed",
            error: e?.message || String(e),
            created_action_ids: [],
          });
        }
      }

      const completed = childResults.filter((c) => c.status === "completed");
      const failed = childResults.filter((c) => c.status === "failed");
      const skipped = childResults.filter((c) => c.status === "skipped");
      const allActionIds = childResults.flatMap((c) => c.created_action_ids || []);
      const finalStatus = failed.length > 0 && completed.length === 0 ? "failed" : "completed";

      const contextSummaries = childResults
        .filter((c) => c.context_summary)
        .map((c) => `- ${c.context_summary}`)
        .join("\n");

      const globalDiagnosis = [
        `Análise global concluída para ${completed.length} conta(s) Meta.`,
        skipped.length ? `${skipped.length} pulada(s) (em andamento ou recente).` : "",
        failed.length ? `${failed.length} falhou(aram).` : "",
        hasOther ? "Google Ads e TikTok Ads ignorados (ainda não operacionais)." : "",
      ].filter(Boolean).join(" ");

      const globalStrategy = contextSummaries
        ? `Contas analisadas:\n${contextSummaries}`
        : "Sem contas Meta operacionais para esta análise.";

      try {
        await supabase
          .from("ads_ai_analysis_runs")
          .update({
            status: finalStatus,
            finished_at: new Date().toISOString(),
            diagnosis_summary: globalDiagnosis,
            strategy_summary: globalStrategy,
            created_action_ids: allActionIds,
            account_snapshot_summary: {
              scope: "global",
              accounts_total: accountIds.length,
              accounts_completed: completed.length,
              accounts_failed: failed.length,
              accounts_skipped: skipped.length,
              ignored_channels: hasOther ? ["google", "tiktok"] : [],
              per_account: childResults.map((c) => ({
                ad_account_id: c.ad_account_id,
                status: c.status,
                skip_reason: c.skip_reason || null,
                run_id: c.run_id,
                context_summary: c.context_summary || null,
              })),
            },
            error_message: failed.length
              ? failed.map((f) => `${f.ad_account_id}: ${f.error}`).join("; ")
              : null,
          })
          .eq("id", parentRunId);
        console.log(`[${VERSION}] global bg done`, { parentRunId, finalStatus });
      } catch (e: any) {
        console.error(`[${VERSION}] global bg close failed`, e?.message || e);
      }
    })());

    return ok({
      accepted: true,
      status: "queued",
      scope: "global",
      run_id: parentRunId,
      accounts_total: accountIds.length,
      limitations,
      message: "Análise global iniciada em segundo plano. Acompanhe na tela.",
    });

  } catch (err: any) {
    console.error(`[${VERSION}] fatal`, err?.message || err);
    return fail(err?.message || "internal_error");
  }
});
