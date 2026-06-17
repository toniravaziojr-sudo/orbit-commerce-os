import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import {
  decide,
  POLICY_ENGINE_VERSION,
  buildIdempotencyKey,
  getApprovalTtlHours,
  resolveEffectiveAutonomy,
  canAutoExecuteC4,
  classifyAction,
  isStrategicPauseAction,
  type ActionInput,
} from "../_shared/ads-policy.ts";
import {
  resolveCustomerAudienceForMetaAccount,
  isColdFunnelStage,
} from "../_shared/ads-autopilot/customerAudience.ts";
import {
  normalizeAndValidateStrategicPlanForApproval,
  getAllowedActionsForCampaignStatus,
  type StrategicPlanGuardOptions,
} from "../_shared/ads-autopilot/strategicPlanContract.ts";
import { buildStrategicPlanPreflightContext, type StrategicPlanPreflight } from "../_shared/ads-autopilot/strategicPlanPreflight.ts";
import { buildCampaignProposalsFromApprovedPlan } from "../_shared/ads-autopilot/campaignProposals.ts";
import { resolveAccountDefaults } from "../_shared/ads-autopilot/accountDefaults.ts";
import { classifyH3Approval } from "../_shared/ads-autopilot/h3StructureGate.ts";

// ===== VERSION =====
const VERSION = "v4.5.1-h3.1"; // Onda H.3.1: rastreabilidade (approved_by_user_id via JWT + insight idempotente em evidence)

// Helper: extrai user_id do header Authorization (Bearer JWT) quando disponível.
// Retorna null silenciosamente para chamadas internas/runner que não enviam JWT.
async function extractUserIdFromAuthHeader(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch (_e) {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: determine if we should use native scheduling (ACTIVE + future start_time)
// Publishing window is 00:01-04:00 BRT. Outside this window → schedule for next 00:01 BRT
function getSchedulingParams(): { status: string; start_time?: string } {
  const now = new Date();
  // BRT = UTC-3
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const brtMinute = now.getUTCMinutes();

  // Inside window: 00:01 to 04:00 BRT → create as ACTIVE immediately
  if ((brtHour === 0 && brtMinute >= 1) || (brtHour >= 1 && brtHour < 4)) {
    return { status: "ACTIVE" };
  }

  // Outside window → schedule for next 00:01 BRT
  const nextPublish = new Date(now);
  // Set to next day 03:01 UTC (= 00:01 BRT)
  if (brtHour >= 4) {
    // Already past 04:00 BRT today → schedule for tomorrow 00:01 BRT
    nextPublish.setUTCDate(nextPublish.getUTCDate() + 1);
  }
  nextPublish.setUTCHours(3, 1, 0, 0); // 03:01 UTC = 00:01 BRT

  return {
    status: "ACTIVE",
    start_time: nextPublish.toISOString(),
  };
}

async function buildStrategicPlanApprovalContext(
  supabase: any,
  tenantId: string,
  adAccountId: string,
  options?: { analysisRunId?: string | null; sourceFlow?: string | null },
): Promise<{ preflight: StrategicPlanPreflight; guardOptions: StrategicPlanGuardOptions }> {
  const [campaignsRes, adsetsRes, audienceRes, mappingsRes] = await Promise.all([
    supabase
      .from("meta_ad_campaigns")
      .select("meta_campaign_id, name, status, effective_status, objective, daily_budget_cents, ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("ad_account_id", adAccountId),
    supabase
      .from("meta_ad_adsets")
      .select("meta_campaign_id, name, ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("ad_account_id", adAccountId),
    supabase
      .from("meta_ad_audiences")
      .select("meta_audience_id, name, ad_account_id, synced_at")
      .eq("tenant_id", tenantId)
      .eq("ad_account_id", adAccountId),
    supabase
      .from("audience_sync_mappings")
      .select("platform_audience_id, audience_name, last_synced_at, ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("platform", "meta")
      .eq("ad_account_id", adAccountId)
      .eq("status", "active"),
  ]);

  const campaigns = (campaignsRes.data || []).map((c: any) => ({
    id: c.meta_campaign_id,
    name: c.name,
    status: String(c.status || c.effective_status || "").toUpperCase(),
    daily_budget_cents: Number(c.daily_budget_cents || 0),
    objective: c.objective || null,
  }));
  const adsetsByCampaign: Record<string, any[]> = {};
  for (const row of adsetsRes.data || []) {
    const campaignId = row.meta_campaign_id;
    if (!campaignId) continue;
    (adsetsByCampaign[campaignId] ||= []).push({ name: row.name || null });
  }

  const customerAudienceResolution = await resolveCustomerAudienceForMetaAccount(supabase, tenantId, adAccountId);
  const preflight = buildStrategicPlanPreflightContext({
    ad_account_id: adAccountId,
    total_daily_cents: campaigns.reduce((sum: number, c: any) => sum + Number(c.daily_budget_cents || 0), 0),
    funnel_splits: null,
    campaigns,
    adsets_by_campaign: adsetsByCampaign,
    ads_by_campaign: {},
    customer_audience: {
      found: customerAudienceResolution.found,
      meta_audience_id: customerAudienceResolution.meta_audience_id,
      audience_name: customerAudienceResolution.audience_name,
      source_table: customerAudienceResolution.source_table,
      last_synced_at: customerAudienceResolution.last_synced_at,
      reason_if_missing: customerAudienceResolution.reason_if_missing,
    },
  });

  const campaignAccountSnapshot = (campaignsRes.data || []).map((c: any) => ({
    campaign_id: c.meta_campaign_id,
    campaign_name: c.name || null,
    status: c.status || null,
    effective_status: c.effective_status || null,
    configured_status: c.status || null,
    is_active_for_planning: String(c.status || c.effective_status || "").toUpperCase() === "ACTIVE",
    is_paused: String(c.status || c.effective_status || "").toUpperCase() === "PAUSED",
    current_daily_budget_brl: Number(c.daily_budget_cents || 0) / 100,
    metrics_7d: null,
    metrics_30d: null,
    funnel_stage: null,
    allowed_actions: getAllowedActionsForCampaignStatus(c.status, c.effective_status),
  }));

  return {
    preflight,
    guardOptions: {
      source_flow: options?.sourceFlow || "approval_endpoint",
      analysis_run_id: options?.analysisRunId || null,
      campaign_account_snapshot: campaignAccountSnapshot,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-execute-approved][${VERSION}] Request received`);

  try {
    const body = await req.json();
    const { tenant_id, action_id } = body;
    const fromRunner: boolean = !!body.from_runner;

    if (!tenant_id || !action_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenant_id or action_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // H.3.1: captura o usuário aprovador a partir do JWT quando disponível.
    // Chamadas do runner/cron não enviam JWT — nesse caso fica null sem inventar usuário.
    const approverUserId: string | null = fromRunner ? null : await extractUserIdFromAuthHeader(req);

    // Aceita 'scheduled' apenas quando vindo do runner (re-execução agendada).
    const allowedStatuses = fromRunner
      ? ["pending_approval", "approved", "scheduled", "processing_runner"]
      : ["pending_approval", "approved"];

    const { data: action, error: fetchErr } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .in("status", allowedStatuses)
      .maybeSingle();

    if (fetchErr || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Action not found or already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== FRENTE 4 — Guard de fluxo two-step =========================
    // Propostas two-step em pending_approval NÃO podem publicar — precisam
    // passar pela aprovação da estratégia (ads-autopilot-approve-strategy)
    // e depois pela aprovação final do criativo (status=approved).
    const isTwoStep = (action.action_data || {})?.flow_version === "two_step_v1";
    if (isTwoStep && action.status === "pending_approval") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "two_step_requires_strategy_approval",
          hint: "Use o botão 'Aprovar e gerar criativos' (Etapa 1) antes de publicar.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ads-autopilot-execute-approved][${VERSION}] Executing action ${action_id} type=${action.action_type}`);

    // ====== Onda H.3 — Aprovação ESTRUTURAL da Proposta de Campanha ======
    // Regra inviolável: aprovar APENAS a estrutura. NÃO chama IA, NÃO chama Meta,
    // NÃO cria creative_jobs, NÃO publica, NÃO abre revisão final, NÃO avança
    // automaticamente para H.4/H.4.1/H.4.2/H.5. A geração de criativos será um
    // segundo gesto explícito do usuário (próxima onda H.4.1).
    if (action.action_type === "campaign_proposal") {
      const propData = (action.action_data || {}) as Record<string, any>;
      const currentLifecycle = (propData.lifecycle || {}) as Record<string, any>;
      const H3_LIFECYCLE_STATUS = "structure_approved_awaiting_creatives";

      // ---- Idempotência ----------------------------------------------------
      if (action.status === "approved" && currentLifecycle.status === H3_LIFECYCLE_STATUS) {
        console.log(`[ads-autopilot-execute-approved][${VERSION}] H.3 idempotent: action ${action_id} already structure-approved`);
        return new Response(JSON.stringify({
          success: true,
          data: {
            type: "campaign_proposal_structure_approved",
            proposal_id: action_id,
            lifecycle_status: H3_LIFECYCLE_STATUS,
            already_approved: true,
            approved_at: action.approved_at || currentLifecycle.proposal_approved_at || null,
            pending_account_config: Array.isArray(currentLifecycle.pending_account_config) ? currentLifecycle.pending_account_config : [],
            next_step_pt: "Estrutura já aprovada. A geração de criativos será iniciada manualmente na próxima etapa.",
            executed: false,
            meta_mutations: 0,
            creatives_generated: 0,
            creatives_enqueued: 0,
            audiences_created: 0,
          },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action.status === "rejected") {
        return new Response(JSON.stringify({
          success: false,
          error: "proposal_already_rejected",
          error_pt: "Esta proposta foi recusada. Para aprová-la será preciso reabrir o fluxo (não disponível nesta onda).",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action.status !== "pending_approval") {
        return new Response(JSON.stringify({
          success: false,
          error: "proposal_status_not_approvable",
          error_pt: `Esta proposta está em um estado (${action.status}) que não permite aprovação estrutural agora.`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Classificação H.3 (h2_structural × account_config × h4_future) ---
      const gate = classifyH3Approval({ action_data: propData });
      const allBlockers = [...gate.blockers, ...gate.ambiguous];
      if (allBlockers.length > 0) {
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] H.3 blocked: ${allBlockers.length} structural blocker(s)`);
        return new Response(JSON.stringify({
          success: false,
          error: "campaign_proposal_has_structural_blockers",
          error_pt: `Não foi possível aprovar a estrutura: ${allBlockers.length} pendência(s) bloqueante(s). ${allBlockers.map((b) => "• " + b.message_pt).join(" ")}`,
          blockers: allBlockers,
          account_config_pending: gate.account_config_pending,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Aprovação efetiva (sem efeitos colaterais externos) -------------
      const nowIso = new Date().toISOString();
      const updatedLifecycle = {
        ...currentLifecycle,
        version: "h3_v1",
        status: H3_LIFECYCLE_STATUS,
        proposal_approved_at: nowIso,
        pending_account_config: gate.account_config_pending,
        // Garante que nenhum estado de geração herdado erroneamente fique no payload:
        creative_jobs: Array.isArray(currentLifecycle.creative_jobs) ? currentLifecycle.creative_jobs : [],
        creative_jobs_enqueued_at: currentLifecycle.creative_jobs_enqueued_at || null,
      };

      const updatePayload: Record<string, any> = {
        status: "approved",
        approved_at: nowIso,
        action_data: { ...propData, lifecycle: updatedLifecycle },
      };
      // H.3.1: grava aprovador real quando JWT do usuário está disponível.
      // Nunca inventa usuário; chamadas sem JWT (runner/cron) ficam com null.
      if (approverUserId) {
        updatePayload.approved_by_user_id = approverUserId;
      }

      const { error: updErr } = await supabase
        .from("ads_autopilot_actions")
        .update(updatePayload)
        .eq("id", action_id);

      if (updErr) {
        console.error(`[ads-autopilot-execute-approved][${VERSION}] H.3 update failed:`, updErr.message);
        return new Response(JSON.stringify({
          success: false,
          error: "h3_update_failed",
          error_pt: "Não foi possível registrar a aprovação estrutural. Tente novamente.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Insight (idempotente por proposta) ------------------------------
      // H.3.1: a tabela ads_autopilot_insights NÃO tem coluna `metadata`.
      // A chave de idempotência e os atributos estruturados ficam em `evidence` (jsonb).
      const insightKey = `h3_structure_approved:${action_id}`;
      const { data: existingInsight, error: existingErr } = await supabase
        .from("ads_autopilot_insights")
        .select("id")
        .eq("tenant_id", tenant_id)
        .contains("evidence", { idempotency_key: insightKey })
        .maybeSingle();

      if (existingErr) {
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] H.3 insight lookup failed (non-blocking):`, existingErr.message);
      }

      if (!existingInsight) {
        const campaign = propData.campaign || {};
        const adAccountIdProp = propData.ad_account_id || campaign.ad_account_id || null;
        const pendingNote = gate.account_config_pending.length > 0
          ? ` Existem ${gate.account_config_pending.length} pendência(s) de configuração da conta Meta que só serão exigidas na revisão final/publicação.`
          : "";
        const { error: insErr } = await supabase.from("ads_autopilot_insights").insert({
          tenant_id,
          channel: action.channel || "meta",
          ad_account_id: adAccountIdProp,
          title: "✅ Estrutura da campanha aprovada",
          body: `Estrutura da campanha aprovada — aguardando geração manual de criativos. Campanha: "${campaign.name || "(sem nome)"}".${pendingNote}`,
          category: "strategy",
          priority: "low",
          sentiment: "positive",
          status: "open",
          evidence: {
            idempotency_key: insightKey,
            event_type: "h3_structure_approved",
            proposal_id: action_id,
            lifecycle_status: H3_LIFECYCLE_STATUS,
            approved_by_user_id: approverUserId,
          },
        });
        if (insErr) {
          console.error(`[ads-autopilot-execute-approved][${VERSION}] H.3 insight insert failed (non-blocking):`, insErr.message);
        }
      }

      console.log(`[ads-autopilot-execute-approved][${VERSION}] H.3 structure approved: ${action_id} (pending_account_config=${gate.account_config_pending.length})`);

      return new Response(JSON.stringify({
        success: true,
        data: {
          type: "campaign_proposal_structure_approved",
          proposal_id: action_id,
          lifecycle_status: H3_LIFECYCLE_STATUS,
          approved_at: nowIso,
          pending_account_config: gate.account_config_pending,
          next_step_pt: "Estrutura aprovada. Nenhum criativo foi gerado e nada foi publicado. A geração de criativos será iniciada manualmente na próxima etapa.",
          executed: false,
          meta_mutations: 0,
          creatives_generated: 0,
          creatives_enqueued: 0,
          audiences_created: 0,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }




    // ====== POLICY GATE (Fase B / B.1) ================================
    // Stamp aprovação retroativa para fluxo legado APENAS se ação for recente (<24h).
    // Aprovação parada há >24h é tratada como expirada (sem chamada externa).
    if ((action.status === "approved" || action.status === "scheduled") && !action.approved_at) {
      const referenceTs = action.created_at;
      const ageMs = referenceTs ? (Date.now() - new Date(referenceTs).getTime()) : Number.POSITIVE_INFINITY;
      const LEGACY_STAMP_MAX_AGE_MS = 24 * 3600 * 1000;
      if (ageMs <= LEGACY_STAMP_MAX_AGE_MS) {
        const ttl = getApprovalTtlHours(action.action_type);
        const approvedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();
        await supabase.from("ads_autopilot_actions").update({
          approved_at: approvedAt,
          approval_expires_at: expiresAt,
        }).eq("id", action_id);
        action.approved_at = approvedAt;
        action.approval_expires_at = expiresAt;
      } else {
        // Aprovação legada antiga — expirar sem chamada externa
        await supabase.from("ads_autopilot_actions").update({
          status: "expired_approval",
          policy_check_result: {
            engine_version: POLICY_ENGINE_VERSION,
            decision_kind: "expired_approval",
            reason: "legacy_approval_too_old",
            meta: { age_ms: ageMs, reference_ts: referenceTs },
            decided_at: new Date().toISOString(),
            from_runner: fromRunner,
          },
          policy_engine_version: POLICY_ENGINE_VERSION,
        }).eq("id", action_id);
        return new Response(JSON.stringify({
          success: false,
          policy: { decision_kind: "expired_approval", reason: "legacy_approval_too_old" },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Carregar snapshot mínimo para ações de orçamento (usado também pelo gate C.4)
    let campaignSnapshot: any = null;
    const entityIdGuess = action.action_data?.entity_id || action.action_data?.campaign_id ||
                          action.action_data?.meta_campaign_id || null;
    if (entityIdGuess && action.channel === "meta") {
      const { data: snap } = await supabase
        .from("meta_ad_campaigns")
        .select("daily_budget_cents, created_at, status")
        .eq("tenant_id", tenant_id)
        .or(`id.eq.${entityIdGuess},meta_campaign_id.eq.${entityIdGuess}`)
        .maybeSingle();
      campaignSnapshot = snap;
    }

    // ====== HARDENING C.4 — Revalidação de gates antes de chamada externa ====
    // Quando a ação chega marcada como `auto_executed=true` (vinda do runner),
    // o executor REVALIDA todos os gates da Fase C.4 antes de qualquer chamada
    // externa. Se algum gate falhar, devolve a ação para `pending_approval`,
    // registra `gate_failed` em `autoexec_audit` e NÃO chama API externa.
    if (action.auto_executed === true) {
      if (isStrategicPauseAction(action.action_type)) {
        await supabase.from("ads_autopilot_actions").update({
          status: "pending_approval",
          auto_executed: false,
          approved_at: null,
          approval_expires_at: null,
          policy_check_result: {
            ...(action.policy_check_result || {}),
            autoexec_audit: {
              approval_source: "blocked_by_policy",
              human_approved: false,
              auto_executed: false,
              auto_execution_phase: "c4_enabled",
              policy_gate_result: { ok: false, reason: "strategic_pause_always_human" },
              at: new Date().toISOString(),
            },
          },
        }).eq("id", action_id);
        return new Response(JSON.stringify({
          success: false,
          policy: { decision_kind: "autoexec_gate_failed", reason: "strategic_pause_always_human" },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const adAccountIdGate = action.action_data?.ad_account_id ||
        action.action_data?.preview?.ad_account_id || null;

      const { data: acctCfg } = adAccountIdGate ? await supabase
        .from("ads_autopilot_account_configs")
        .select("autonomy_mode, is_ai_enabled, kill_switch, budget_cents")
        .eq("tenant_id", tenant_id)
        .eq("channel", action.channel)
        .eq("ad_account_id", adAccountIdGate)
        .maybeSingle() : { data: null };

      const { data: globalCfg } = await supabase
        .from("ads_autopilot_configs")
        .select("autonomy_mode, kill_switch")
        .eq("tenant_id", tenant_id)
        .eq("channel", "global")
        .maybeSingle();

      const eff = resolveEffectiveAutonomy(acctCfg, globalCfg);
      const actClass = classifyAction({ action_type: action.action_type, channel: action.channel });

      const nowGate = new Date();
      const brtH = (nowGate.getUTCHours() - 3 + 24) % 24;
      const brtM = nowGate.getUTCMinutes();
      const insideWindow = (brtH === 0 && brtM >= 1) || (brtH >= 1 && brtH < 4);

      const preDecision = decide({
        action: {
          id: action.id, tenant_id: action.tenant_id, channel: action.channel,
          action_type: action.action_type, action_data: action.action_data,
          status: action.status, approved_at: action.approved_at,
          approval_expires_at: action.approval_expires_at, created_at: action.created_at,
        },
        campaignSnapshot,
        now: nowGate,
      });

      const gate = canAutoExecuteC4({
        effective_mode: eff.mode,
        effective_source: eff.source,
        is_ai_enabled: acctCfg?.is_ai_enabled === true,
        account_kill_switch: acctCfg?.kill_switch === true,
        global_kill_switch: globalCfg?.kill_switch === true,
        action_type: action.action_type,
        action_class: actClass,
        policy_decision_kind: preDecision.kind,
        campaign_age_days: campaignSnapshot?.created_at
          ? (Date.now() - new Date(campaignSnapshot.created_at).getTime()) / 86400000
          : null,
        in_learning_phase: null,
        inside_safe_window: insideWindow,
        budget_within_limit: null,
      });

      if (!gate.ok) {
        await supabase.from("ads_autopilot_actions").update({
          status: "pending_approval",
          auto_executed: false,
          approved_at: null,
          approval_expires_at: null,
          policy_check_result: {
            ...(action.policy_check_result || {}),
            autoexec_audit: {
              approval_source: "blocked_by_policy",
              human_approved: false,
              auto_executed: false,
              auto_execution_phase: "c4_enabled",
              effective_autonomy_mode: eff.mode,
              effective_autonomy_source: eff.source,
              policy_gate_result: { ok: false, reason: gate.reason, revalidated_at_executor: true },
              at: nowGate.toISOString(),
            },
          },
        }).eq("id", action_id);
        return new Response(JSON.stringify({
          success: false,
          policy: { decision_kind: "autoexec_gate_failed", reason: gate.reason },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // ====== Onda H.1 — strategic_plan NÃO passa pelo policy gate ======
    // Aprovar plano estratégico não executa nada externo e não consome idempotência.
    // O tratamento real ocorre no branch dedicado mais abaixo.
    if (action.action_type !== "strategic_plan") {

    const actionForPolicy: ActionInput = {
      id: action.id,
      tenant_id: action.tenant_id,
      channel: action.channel,
      action_type: action.action_type,
      action_data: action.action_data,
      status: action.status,
      approved_at: action.approved_at,
      approval_expires_at: action.approval_expires_at,
      created_at: action.created_at,
    };

    const decision = decide({ action: actionForPolicy, campaignSnapshot, now: new Date() });
    const policyResult = {
      engine_version: POLICY_ENGINE_VERSION,
      decision_kind: decision.kind,
      reason: decision.reason,
      meta: (decision as any).meta || null,
      decided_at: new Date().toISOString(),
      from_runner: fromRunner,
    };
    const idempotencyKey = buildIdempotencyKey(actionForPolicy);

    if (decision.kind !== "execute_now") {
      // Nenhuma chamada externa. Atualiza status conforme decisão.
      const statusMap: Record<string, string> = {
        schedule: "scheduled",
        reject_policy_limit_exceeded: "rejected_policy_limit_exceeded",
        reject_policy_missing_context: "rejected_policy_missing_context",
        reject_duplicate: "rejected_duplicate",
        expired_approval: "expired_approval",
      };
      const newStatus = statusMap[decision.kind] || "rejected";
      const upd: any = {
        status: newStatus,
        policy_check_result: policyResult,
        policy_engine_version: POLICY_ENGINE_VERSION,
        idempotency_key: idempotencyKey,
      };
      if (decision.kind === "schedule") {
        upd.scheduled_for = (decision as any).scheduled_for;
      }
      const { error: updErr } = await supabase.from("ads_autopilot_actions").update(upd).eq("id", action_id);
      if (updErr && /duplicate key|unique/i.test(updErr.message)) {
        await supabase.from("ads_autopilot_actions").update({
          status: "rejected_duplicate",
          policy_check_result: { ...policyResult, duplicate_error: updErr.message },
          policy_engine_version: POLICY_ENGINE_VERSION,
        }).eq("id", action_id);
        return new Response(JSON.stringify({ success: false, policy: { ...policyResult, decision_kind: "reject_duplicate" } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, policy: policyResult }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decisão = execute_now → marca policy passada e segue caminho de execução existente.
    {
      const updExec: any = {
        policy_check_result: policyResult,
        policy_engine_version: POLICY_ENGINE_VERSION,
        idempotency_key: idempotencyKey,
      };
      const { error: stampErr } = await supabase.from("ads_autopilot_actions").update(updExec).eq("id", action_id);
      if (stampErr && /duplicate key|unique/i.test(stampErr.message)) {
        await supabase.from("ads_autopilot_actions").update({
          status: "rejected_duplicate",
          policy_check_result: { ...policyResult, duplicate_error: stampErr.message },
          policy_engine_version: POLICY_ENGINE_VERSION,
        }).eq("id", action_id);
        return new Response(JSON.stringify({ success: false, policy: { ...policyResult, decision_kind: "reject_duplicate" } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    } // /if (action.action_type !== "strategic_plan")
    // ====== /POLICY GATE ===============================================


    const data = action.action_data || {};
    const preview = data.preview || {};

    if ((action.action_type === "pause_campaign" || action.action_type === "pause") && action.channel === "meta") {
      const campaignId = data.campaign_id || data.meta_campaign_id || data.existing_campaign_id || null;
      if (campaignId) {
        const { data: currentCampaign } = await supabase
          .from("meta_ad_campaigns")
          .select("status, effective_status, name")
          .eq("tenant_id", tenant_id)
          .or(`meta_campaign_id.eq.${campaignId},id.eq.${campaignId}`)
          .maybeSingle();

        const statusNow = String(currentCampaign?.effective_status || currentCampaign?.status || "").toUpperCase();
        if (statusNow === "PAUSED") {
          await supabase.from("ads_autopilot_actions").update({
            status: "failed",
            error_message: "Campanha já está pausada. Plano precisa ser refeito com ação compatível ao estado atual.",
          }).eq("id", action_id);

          return new Response(JSON.stringify({
            success: false,
            error: "campaign_already_paused",
            error_pt: "Campanha já está pausada. O plano precisa ser refeito com uma ação compatível ao estado atual.",
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }


    // ====== BUDGET REVALIDATION (create_campaign only) ======
    if (action.action_type === "create_campaign" && action.channel === "meta") {
      const adAccountId = data.ad_account_id;
      const proposedBudgetCents = data.daily_budget_cents || preview.daily_budget_cents || 0;

      if (adAccountId && proposedBudgetCents > 0) {
        const { data: acctConfig } = await supabase
          .from("ads_autopilot_account_configs")
          .select("budget_cents")
          .eq("tenant_id", tenant_id)
          .eq("ad_account_id", adAccountId)
          .maybeSingle();

        const limitCents = acctConfig?.budget_cents || 0;

        if (limitCents > 0) {
          // v2.1.0: Only count ACTIVE campaigns (already running on Meta) against the budget
          // Do NOT count other pending_approval proposals — those haven't been approved yet
          // and blocking the first approval because of other pending proposals is a deadlock
          const { data: aiCampaigns } = await supabase
            .from("meta_ad_campaigns")
            .select("daily_budget_cents")
            .eq("tenant_id", tenant_id)
            .eq("ad_account_id", adAccountId)
            .eq("status", "ACTIVE")
            .ilike("name", "[AI]%");

          const activeCents = (aiCampaigns || []).reduce((sum: number, c: any) => sum + (c.daily_budget_cents || 0), 0);

          // Also count campaigns that were ALREADY approved in this session (executed but not yet synced to meta_ad_campaigns)
          const ttlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: executedActions } = await supabase
            .from("ads_autopilot_actions")
            .select("id, action_data")
            .eq("tenant_id", tenant_id)
            .eq("status", "executed")
            .eq("action_type", "create_campaign")
            .eq("channel", "meta")
            .neq("id", action_id)
            .gte("executed_at", ttlCutoff);

          let recentlyExecutedCents = 0;
          for (const ea of (executedActions || [])) {
            recentlyExecutedCents += Number(ea.action_data?.daily_budget_cents || ea.action_data?.preview?.daily_budget_cents || 0);
          }

          const totalAfter = activeCents + recentlyExecutedCents + proposedBudgetCents;
          console.log(`[ads-autopilot-execute-approved][${VERSION}] Budget revalidation: active=${activeCents} recently_executed=${recentlyExecutedCents} proposed=${proposedBudgetCents} total=${totalAfter} limit=${limitCents}`);

          if (totalAfter > limitCents) {
            // v2.1.0: Do NOT auto-reject the action — just return error so the user can retry
            // or adjust the budget limit. Previously this set status='rejected' which made the campaign disappear.
            console.warn(`[ads-autopilot-execute-approved][${VERSION}] Budget exceeded: total=${totalAfter} limit=${limitCents}. NOT rejecting action.`);

            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Orçamento excedido. Campanhas ativas: R$ ${(activeCents / 100).toFixed(2)}/dia + esta proposta: R$ ${(proposedBudgetCents / 100).toFixed(2)}/dia = R$ ${(totalAfter / 100).toFixed(2)}/dia. Limite: R$ ${(limitCents / 100).toFixed(2)}/dia. Aumente o limite ou rejeite outras campanhas antes.` 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // ====== STRATEGIC PLAN APPROVAL ======
    if (action.action_type === "strategic_plan") {
      const adAccountId = data.ad_account_id || data?.metadata?.campaign_account_snapshot?.[0]?.ad_account_id || null;
      if (!adAccountId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "strategic_plan_missing_account_context",
            error_pt: "Plano incompleto — contexto da conta de anúncios não foi encontrado para revalidação.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { preflight, guardOptions } = await buildStrategicPlanApprovalContext(supabase, tenant_id, adAccountId, {
        analysisRunId: action.analysis_run_id || data?.metadata?.analysis_run_id || data?.analysis_run_id || null,
        sourceFlow: "approval_endpoint",
      });
      const revalidated = normalizeAndValidateStrategicPlanForApproval(data, preflight, guardOptions);
      const revalidatedPlan = revalidated.normalizedPlan;
      const contract = revalidated.contract;

      await supabase.from("ads_autopilot_actions").update({
        action_data: revalidatedPlan,
        status: revalidated.approvalStatus,
      }).eq("id", action_id);

      if (revalidated.approvalStatus === "incomplete" || revalidatedPlan?.metadata?.validation_status !== "valid" || revalidatedPlan?.metadata?.is_approvable !== true) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "strategic_plan_incomplete",
            error_pt: "Plano incompleto — Campanha de público frio/prospecção precisa excluir clientes/compradores atuais ou declarar pendência técnica do público de clientes.",
            blockers: contract?.errors || [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (contract && contract.ok === false) {
        const codes = (contract.errors || []).map((e: any) => e.code).slice(0, 8).join(",");
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] BLOCKED: strategic_plan contract invalid (${codes})`);
        return new Response(
          JSON.stringify({
            success: false,
            error: "strategic_plan_contract_invalid",
            error_pt: "Plano incompleto — precisa ser regenerado ou ajustado antes de aprovar.",
            blockers: contract.errors || [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.log(`[ads-autopilot-execute-approved][${VERSION}] Strategic plan approved — generating campaign proposals only (no execution).`);

      const planBody = revalidatedPlan.diagnosis + "\n\n**Ações Planejadas:**\n" + (revalidatedPlan.planned_actions || []).map((a: any) => `• ${typeof a === "string" ? a : a.rationale || a.action_type || "ação"}`).join("\n");

      await supabase.from("ads_autopilot_insights").insert({
        tenant_id,
        channel: action.channel || "global",
        ad_account_id: adAccountId,
        title: "✅ Plano Estratégico Aprovado",
        body: planBody,
        category: "strategy",
        priority: "high",
        sentiment: "positive",
        status: "open",
      });

      // ====== Onda H.1 — Lifecycle canônico do plano ======
      // O plano APROVADO não executa nada. Marca-se status legado "approved"
      // (NUNCA "executed") e adiciona-se action_data.lifecycle.status="plan_approved".
      // "executed" fica reservado para implementação final (Revisão Final — Onda H.4).
      const planLifecycle = {
        version: "h1_v1",
        status: "plan_approved",
        approved_at: new Date().toISOString(),
      };
      const planActionData = {
        ...revalidatedPlan,
        lifecycle: planLifecycle,
      };
      await supabase.from("ads_autopilot_actions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          action_data: planActionData,
        })
        .eq("id", action_id);

      // ====== Onda H.2 — Geração de propostas filhas detalhadas ======
      // 1 registro por ação planejada, em pending_approval, sem qualquer mutação.
      // Não chama Meta. Não gera criativo. Não cria público/lookalike/catálogo.
      const planAnalysisRunId = action.analysis_run_id || revalidatedPlan?.metadata?.analysis_run_id || revalidatedPlan?.analysis_run_id || null;

      // H.2.1: resolve defaults da conta (página, IG, pixel, evento, UTM, CTA…)
      // ANTES de construir as propostas, para que cada filha nasça preenchida.
      let accountDefaults: any = null;
      try {
        accountDefaults = await resolveAccountDefaults(supabase, {
          tenant_id,
          ad_account_id: adAccountId || null,
        });
      } catch (e) {
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] account defaults resolution failed (non-blocking):`, e);
      }

      // H.2.4: domínio público primário verificado da loja (sem inventar URL).
      let tenantPrimaryVerifiedDomain: string | null = null;
      try {
        const { data: domRow } = await supabase
          .from("tenant_domains")
          .select("domain")
          .eq("tenant_id", tenant_id)
          .eq("is_primary", true)
          .eq("status", "verified")
          .eq("ssl_status", "active")
          .maybeSingle();
        tenantPrimaryVerifiedDomain = domRow?.domain || null;
      } catch (e) {
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] primary verified domain lookup failed (non-blocking):`, e);
      }

      // H.2.4 — Resolução canônica de produto por ação planejada.
      // Contrato: cada proposta filha = 1 produto principal canônico do catálogo.
      // O Estrategista pode (indevidamente) devolver nomes compostos, com espaços
      // sobrando, variação singular/plural ("Kit/Kits") ou acentos. Aqui
      // normalizamos, suportamos separadores comuns e elegemos o primeiro
      // produto reconhecido como principal; demais ficam como secundários.
      const plannedActionsRaw = Array.isArray(revalidatedPlan?.planned_actions) ? revalidatedPlan.planned_actions : [];

      const normalizeName = (s: string): string =>
        String(s || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[\s\u00a0]+/g, " ")
          .trim();

      const splitComposite = (s: string): string[] => {
        const raw = String(s || "");
        if (!raw.trim()) return [];
        const parts = raw
          .split(/\s*[,;+/&]\s*|\s+e\s+/i)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        return parts.length > 0 ? parts : [raw.trim()];
      };

      type CatalogEntry = { name: string; slug: string; norm: string };
      const catalog: CatalogEntry[] = [];
      try {
        const { data: prodRows } = await supabase
          .from("products")
          .select("name, slug, status, deleted_at")
          .eq("tenant_id", tenant_id)
          .is("deleted_at", null)
          .eq("status", "active");
        for (const r of prodRows || []) {
          const name = String(r?.name || "").trim();
          const slug = String(r?.slug || "").trim();
          if (!name || !slug) continue;
          catalog.push({ name, slug, norm: normalizeName(name) });
        }
      } catch (e) {
        console.warn(`[ads-autopilot-execute-approved][${VERSION}] catalog lookup failed (non-blocking):`, e);
      }

      const findCatalogMatch = (raw: string): CatalogEntry | null => {
        const n = normalizeName(raw);
        if (!n) return null;
        const exact = catalog.find((c) => c.norm === n);
        if (exact) return exact;
        const containsCatalog = catalog
          .filter((c) => c.norm.length >= 4 && n.includes(c.norm))
          .sort((a, b) => b.norm.length - a.norm.length)[0];
        if (containsCatalog) return containsCatalog;
        const termInCatalog = catalog
          .filter((c) => n.length >= 4 && c.norm.includes(n))
          .sort((a, b) => a.norm.length - b.norm.length)[0];
        if (termInCatalog) return termInCatalog;
        return null;
      };

      const resolveAction = (a: any): { canonical_name: string | null; slug: string | null; secondaries: Array<{ name: string; slug: string }> } => {
        const original = String(a?.product_name || "");
        if (a?.product_slug && typeof a.product_slug === "string" && a.product_slug.trim()) {
          const direct = catalog.find((c) => c.slug === a.product_slug.trim());
          return { canonical_name: direct?.name || original.trim() || null, slug: a.product_slug.trim(), secondaries: [] };
        }
        const parts = splitComposite(original);
        const matched: CatalogEntry[] = [];
        const seen = new Set<string>();
        for (const part of parts) {
          const m = findCatalogMatch(part);
          if (m && !seen.has(m.slug)) {
            matched.push(m);
            seen.add(m.slug);
          }
        }
        if (matched.length === 0) {
          const whole = findCatalogMatch(original);
          if (whole) matched.push(whole);
        }
        if (matched.length === 0) {
          return { canonical_name: original.trim() || null, slug: null, secondaries: [] };
        }
        const [primary, ...rest] = matched;
        return {
          canonical_name: primary.name,
          slug: primary.slug,
          secondaries: rest.map((r) => ({ name: r.name, slug: r.slug })),
        };
      };

      const enrichedPlan = {
        ...revalidatedPlan,
        planned_actions: plannedActionsRaw.map((a: any) => {
          if (!a || typeof a !== "object") return a;
          const r = resolveAction(a);
          return {
            ...a,
            product_name: r.canonical_name ?? a.product_name ?? null,
            product_name_original: a?.product_name ?? null,
            product_slug: r.slug,
            secondary_products: r.secondaries,
          };
        }),
      };


      const { records: proposalRecords, skipped_reasons } = buildCampaignProposalsFromApprovedPlan(enrichedPlan, {
        id: action_id,
        tenant_id,
        channel: action.channel || "meta",
        session_id: action.session_id,
        analysis_run_id: planAnalysisRunId,
        ad_account_id: adAccountId,
        account_defaults: accountDefaults,
        tenant_primary_verified_domain: tenantPrimaryVerifiedDomain,
      });

      let proposalsCreated = 0;
      let proposalsAlreadyExisted = 0;
      const proposalErrors: Array<{ index: number; code?: string; message?: string }> = [];
      for (const record of proposalRecords) {
        const { error: insertErr } = await supabase.from("ads_autopilot_actions").insert(record);
        if (insertErr) {
          // 23505 = unique violation no índice idx_aaa_child_dedup_plan_action.
          // É comportamento esperado em segundo clique / retry. Idempotente.
          if (String((insertErr as any).code) === "23505") {
            proposalsAlreadyExisted += 1;
          } else {
            console.error(`[ads-autopilot-execute-approved][${VERSION}] proposal insert error index=${record.planned_action_index}:`, insertErr);
            proposalErrors.push({
              index: record.planned_action_index,
              code: (insertErr as any).code,
              message: (insertErr as any).message,
            });
          }
        } else {
          proposalsCreated += 1;
        }
      }

      console.log(`[ads-autopilot-execute-approved][${VERSION}] Plan ${action_id}: ${proposalsCreated} proposals created, ${proposalsAlreadyExisted} already existed, ${proposalErrors.length} errors, ${skipped_reasons.length} skipped.`);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            type: "strategic_plan_approved",
            source_plan_id: action_id,
            lifecycle_status: "plan_approved",
            proposals_created: proposalsCreated,
            proposals_already_existed: proposalsAlreadyExisted,
            proposals_total: proposalRecords.length,
            proposal_errors: proposalErrors,
            skipped_reasons,
            executed: false,
            children_executed: false,
            meta_mutations: 0,
            creatives_generated: 0,
            audiences_created: 0,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // ====== CREATE CAMPAIGN — Direct Meta API execution ======
    if (action.action_type === "create_campaign" && action.channel === "meta") {
      const adAccountId = data.ad_account_id;
      const campaignName = data.campaign_name || preview.campaign_name || "Nova Campanha IA";
      const dailyBudgetCents = data.daily_budget_cents || preview.daily_budget_cents || 0;
      const objective = data.objective || "conversions";

      // ====== Exclusão de Clientes em Públicos Frios (revisada 2026-06-17) ======
      // Nunca bloqueia. Apenas auto-injeta a exclusão SE o público de Clientes
      // existir na conta E a proposta aprovada ainda contiver a exclusão (sinal
      // de que o usuário NÃO removeu). Se o usuário removeu durante a revisão,
      // respeitamos a decisão e apenas logamos como override para aprendizado.
      const stageForCheck = data.funnel_stage || preview.funnel_stage || null;
      if (adAccountId && isColdFunnelStage(stageForCheck)) {
        try {
          const ca = await resolveCustomerAudienceForMetaAccount(
            supabase,
            tenant_id,
            adAccountId,
          );
          if (ca.found && ca.meta_audience_id) {
            const excluded = (data.excluded_audience_ids || preview.excluded_audience_ids || []) as Array<any>;
            const excludedIds = excluded.map((e: any) => String(e?.id ?? e));
            const exclusionStillProposed =
              !!data?.audience_exclusions?.customers ||
              !!preview?.audience_exclusions?.customers;
            if (!excludedIds.includes(String(ca.meta_audience_id))) {
              if (exclusionStillProposed) {
                // Auto-injeta — usuário não removeu, apenas faltou ID resolvido.
                const merged = [
                  ...excluded,
                  { id: ca.meta_audience_id, name: ca.audience_name },
                ];
                data.excluded_audience_ids = merged;
                if (preview) preview.excluded_audience_ids = merged;
                console.log(
                  `[ads-autopilot-execute-approved][${VERSION}] Cold campaign auto-injected customer exclusion ${ca.meta_audience_id}`,
                );
              } else {
                // Usuário removeu deliberadamente — respeitar e registrar override.
                console.log(
                  `[ads-autopilot-execute-approved][${VERSION}] Cold campaign user-override: customer exclusion REMOVED by user tenant=${tenant_id} action=${action_id}`,
                );
              }
            }
          } else {
            console.log(
              `[ads-autopilot-execute-approved][${VERSION}] Cold campaign advisory: customer audience not synced in account ${adAccountId} — proceeding without exclusion`,
            );
          }
        } catch (caErr: any) {
          // Falha na revalidação não bloqueia mais. Apenas registra.
          console.warn(
            `[ads-autopilot-execute-approved][${VERSION}] Customer audience revalidation failed (non-blocking):`,
            caErr?.message,
          );
        }
      }

      const objectiveMap: Record<string, string> = {
        conversions: "OUTCOME_SALES",
        traffic: "OUTCOME_TRAFFIC",
        awareness: "OUTCOME_AWARENESS",
        leads: "OUTCOME_LEADS",
      };

      // Determine scheduling: inside 00:01-04:00 BRT → ACTIVE immediately, outside → ACTIVE + future start_time (Scheduled)
      const scheduling = getSchedulingParams();
      console.log(`[ads-autopilot-execute-approved][${VERSION}] Creating campaign on Meta: ${campaignName} budget=${dailyBudgetCents}c scheduling=${JSON.stringify(scheduling)}`);

      // Step 1: Create campaign with native scheduling
      const campaignBody: any = {
        tenant_id,
        action: "create",
        ad_account_id: adAccountId,
        name: campaignName,
        objective: objectiveMap[objective] || objective || "OUTCOME_SALES",
        destination_type: "WEBSITE",
        status: scheduling.status,
        daily_budget_cents: dailyBudgetCents,
        special_ad_categories: data.special_ad_categories || preview.special_ad_categories || [],
        bid_strategy: data.bid_strategy || preview.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      };
      if (data.lifetime_budget_cents || preview.lifetime_budget_cents) {
        campaignBody.lifetime_budget_cents = data.lifetime_budget_cents || preview.lifetime_budget_cents;
      }
      if (scheduling.start_time) {
        campaignBody.start_time = scheduling.start_time;
      }
      if (data.end_time || preview.end_time) {
        campaignBody.stop_time = data.end_time || preview.end_time;
      }

      const { data: campaignResult, error: campaignErr } = await supabase.functions.invoke("meta-ads-campaigns", {
        body: campaignBody,
      });

      if (campaignErr) throw new Error(`Erro ao criar campanha: ${campaignErr.message}`);
      if (campaignResult && !campaignResult.success) throw new Error(`Erro ao criar campanha: ${campaignResult.error}`);

      const metaCampaignId = campaignResult?.data?.meta_campaign_id;
      console.log(`[ads-autopilot-execute-approved][${VERSION}] Campaign created: ${metaCampaignId}`);

      // Step 2: Create adset with full targeting from action_data
      let metaAdsetId: string | null = null;
      const funnelStage = data.funnel_stage || preview.funnel_stage || "tof";

      // Get pixel for promoted_object
      const { data: mktConfig } = await supabase
        .from("marketing_integrations")
        .select("meta_pixel_id")
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      const pixelId = mktConfig?.meta_pixel_id || null;

      if (metaCampaignId) {
        // Build targeting from action_data — NO more hardcoding
        const geoLocations = data.geo_locations || preview.geo_locations || { countries: ["BR"] };
        const targeting: any = {
          geo_locations: geoLocations,
          age_min: data.age_min || preview.age_min || 18,
          age_max: data.age_max || preview.age_max || 65,
        };
        
        // Genders
        const genders = data.genders || preview.genders;
        if (genders?.length > 0 && !(genders.length === 1 && genders[0] === 0)) {
          targeting.genders = genders;
        }

        // Custom audiences (include)
        const customAudienceIds = data.custom_audience_ids || preview.custom_audience_ids || data.custom_audiences;
        if (customAudienceIds?.length > 0) {
          targeting.custom_audiences = customAudienceIds.map((a: any) => ({ id: a.id || a }));
        }
        
        // Excluded audiences
        const excludedAudienceIds = data.excluded_audience_ids || preview.excluded_audience_ids;
        if (excludedAudienceIds?.length > 0) {
          targeting.excluded_custom_audiences = excludedAudienceIds.map((a: any) => ({ id: a.id || a }));
        }

        // Interests
        const interests = data.interests || preview.interests;
        if (interests?.length > 0) {
          targeting.flexible_spec = [{ interests }];
        }
        
        // Behaviors
        const behaviors = data.behaviors || preview.behaviors;
        if (behaviors?.length > 0) {
          if (targeting.flexible_spec) {
            targeting.flexible_spec[0].behaviors = behaviors;
          } else {
            targeting.flexible_spec = [{ behaviors }];
          }
        }

        // Placements (publisher_platforms + position_types)
        const publisherPlatforms = data.publisher_platforms || preview.publisher_platforms;
        if (publisherPlatforms?.length > 0) {
          targeting.publisher_platforms = publisherPlatforms;
        }
        const positionTypes = data.position_types || preview.position_types;
        if (positionTypes?.length > 0) {
          // Meta API uses specific platform position keys
          targeting.facebook_positions = positionTypes.filter((p: string) => ["feed", "right_hand_column", "marketplace", "video_feeds", "instant_article", "instream_video", "search", "facebook_stories", "facebook_reels"].includes(p));
          targeting.instagram_positions = positionTypes.filter((p: string) => ["feed", "story", "reels", "explore", "profile_feed", "instagram_stories", "instagram_reels", "reels_overlay"].includes(p));
        }
        const devicePlatforms = data.device_platforms || preview.device_platforms;
        if (devicePlatforms?.length > 0) {
          targeting.device_platforms = devicePlatforms;
        }

        // Lookalike
        const lookalikeSpec = data.lookalike_spec || preview.lookalike_spec;
        if (lookalikeSpec) {
          targeting.lookalike_spec = lookalikeSpec;
        }

        const adsetName = data.adset_name || preview.adset_name || campaignName.replace("[AI]", "[AI] CJ -");
        const inlineScheduling = getSchedulingParams();
        
        // Optimization & billing from action_data — NO more hardcoding
        const optimizationGoal = data.optimization_goal || preview.optimization_goal || (objective === "traffic" ? "LINK_CLICKS" : "OFFSITE_CONVERSIONS");
        const billingEvent = data.billing_event || preview.billing_event || "IMPRESSIONS";
        
        const adsetBody: any = {
          tenant_id,
          action: "create",
          ad_account_id: adAccountId,
          meta_campaign_id: metaCampaignId,
          name: adsetName,
          optimization_goal: optimizationGoal,
          billing_event: billingEvent,
          targeting,
          status: inlineScheduling.status,
        };
        
        // Adset-level budget (ABO)
        if (data.adset_daily_budget_cents) adsetBody.daily_budget_cents = data.adset_daily_budget_cents;
        if (data.adset_lifetime_budget_cents) adsetBody.lifetime_budget_cents = data.adset_lifetime_budget_cents;
        
        // Bid amount
        const bidAmountCents = data.bid_amount_cents || preview.bid_amount_cents;
        if (bidAmountCents) adsetBody.bid_amount_cents = bidAmountCents;
        
        if (inlineScheduling.start_time) adsetBody.start_time = inlineScheduling.start_time;
        if (data.end_time || preview.end_time) adsetBody.end_time = data.end_time || preview.end_time;

        // Promoted object with conversion event from action_data
        const conversionEvent = data.conversion_event || preview.conversion_event;
        if (pixelId && conversionEvent) {
          adsetBody.promoted_object = {
            pixel_id: pixelId,
            custom_event_type: conversionEvent,
          };
        } else if (pixelId && (objective === "conversions" || objective === "leads" || objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS")) {
          adsetBody.promoted_object = {
            pixel_id: pixelId,
            custom_event_type: objective === "leads" || objective === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
          };
        }

        const { data: adsetResult, error: adsetErr } = await supabase.functions.invoke("meta-ads-adsets", {
          body: adsetBody,
        });

        if (adsetErr) {
          console.error(`[ads-autopilot-execute-approved][${VERSION}] Adset creation failed:`, adsetErr.message);
        } else if (adsetResult && !adsetResult.success) {
          console.error(`[ads-autopilot-execute-approved][${VERSION}] Adset creation failed:`, adsetResult.error);
        } else {
          metaAdsetId = adsetResult?.data?.meta_adset_id;
          console.log(`[ads-autopilot-execute-approved][${VERSION}] Adset created: ${metaAdsetId}`);
        }
      }

      // Step 3: Create ad with creative (if asset available)
      let metaAdId: string | null = null;
      if (metaAdsetId) {
        // Find ready creative asset for this product
        const productId = data.product_id || null;
        const { data: readyAssets } = await supabase
          .from("ads_creative_assets")
          .select("id, asset_url, headline, copy_text, platform_adcreative_id, product_id")
          .eq("tenant_id", tenant_id)
          .in("status", ["ready", "published"])
          .not("asset_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(10);

        // Find best matching asset
        let bestAsset = productId
          ? (readyAssets || []).find((a: any) => a.product_id === productId)
          : null;
        if (!bestAsset) bestAsset = (readyAssets || [])[0];

        if (bestAsset) {
          const metaConn = await getMetaConnectionForTenant(supabase, tenant_id);

          if (metaConn?.access_token) {
            const accountIdClean = adAccountId.replace("act_", "");
            let bestCreativeId = bestAsset.platform_adcreative_id;

            // If no platform creative yet, create one
            if (!bestCreativeId && bestAsset.asset_url) {
              // Get store URL
              const { data: tenantDomain } = await supabase
                .from("tenant_domains")
                .select("domain")
                .eq("tenant_id", tenant_id)
                .eq("type", "custom")
                .eq("is_primary", true)
                .maybeSingle();

              const { data: tenantInfo } = await supabase
                .from("tenants")
                .select("slug")
                .eq("id", tenant_id)
                .single();

              const storeHost = tenantDomain?.domain || `${tenantInfo?.slug}.shops.comandocentral.com.br`;

              // v3.0.0: Use destination_url from action_data if provided, otherwise resolve from product
              let destinationUrl = data.destination_url || preview.destination_url || null;
              if (!destinationUrl) {
                let productSlug = "";
                if (productId) {
                  const { data: prodData } = await supabase
                    .from("products")
                    .select("slug, name")
                    .eq("id", productId)
                    .single();
                  productSlug = prodData?.slug || productId;
                }
                destinationUrl = productSlug ? `https://${storeHost}/produto/${productSlug}` : `https://${storeHost}`;
              }
              
              // Append UTM params if provided
              const utmParams = data.utm_params || preview.utm_params;
              if (utmParams && typeof utmParams === "object") {
                const url = new URL(destinationUrl);
                for (const [key, val] of Object.entries(utmParams)) {
                  if (val) url.searchParams.set(`utm_${key}`, String(val));
                }
                destinationUrl = url.toString();
              }

              const pages = metaConn.metadata?.assets?.pages || [];
              const pageId = pages[0]?.id || null;

              // Upload image
              let imageHash: string | null = null;
              try {
                const imgRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: bestAsset.asset_url, access_token: metaConn.access_token }),
                });
                const imgData = await imgRes.json();
                if (!imgData.error) {
                  imageHash = imgData?.images?.[Object.keys(imgData?.images || {})[0]]?.hash || null;
                }
              } catch (e: any) {
                console.warn(`[ads-autopilot-execute-approved][${VERSION}] Image upload warning:`, e.message);
              }

              // Create ad creative
              const copyText = bestAsset.copy_text || data.primary_texts?.[0] || preview.copy_text || `Conheça o melhor para você!`;
              const headline = bestAsset.headline || data.headlines?.[0] || preview.headline || campaignName;

              const creativeBody: any = {
                name: `[AI] Creative - ${new Date().toISOString().split("T")[0]}`,
                access_token: metaConn.access_token,
              };

              if (pageId) {
                const linkData: any = {
                  message: copyText,
                  name: headline,
                  link: destinationUrl,
                  call_to_action: { type: data.cta || "SHOP_NOW", value: { link: destinationUrl } },
                };
                if (imageHash) {
                  linkData.image_hash = imageHash;
                } else {
                  linkData.picture = bestAsset.asset_url;
                }
                creativeBody.object_story_spec = { page_id: pageId, link_data: linkData };
              }

              const creativeRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(creativeBody),
              });
              const creativeData = await creativeRes.json();

              if (creativeData.id) {
                bestCreativeId = creativeData.id;
                console.log(`[ads-autopilot-execute-approved][${VERSION}] AdCreative created: ${bestCreativeId}`);

                // Update asset status
                await supabase.from("ads_creative_assets").update({
                  status: "published",
                  platform_adcreative_id: creativeData.id,
                  updated_at: new Date().toISOString(),
                }).eq("id", bestAsset.id);
              } else {
                console.error(`[ads-autopilot-execute-approved][${VERSION}] AdCreative failed:`, creativeData.error?.message);
              }
            }

            // Create ad
            if (bestCreativeId) {
              const adName = campaignName.replace("[AI]", "[AI] Ad -");
              const { data: adResult, error: adErr } = await supabase.functions.invoke("meta-ads-ads", {
                body: {
                  tenant_id,
                  action: "create",
                  ad_account_id: adAccountId,
                  meta_adset_id: metaAdsetId,
                  meta_campaign_id: metaCampaignId,
                  name: adName,
                  creative_id: bestCreativeId,
                  status: "PAUSED",
                },
              });

              if (adErr) {
                console.error(`[ads-autopilot-execute-approved][${VERSION}] Ad creation failed:`, adErr.message);
              } else if (adResult && !adResult.success) {
                console.error(`[ads-autopilot-execute-approved][${VERSION}] Ad creation failed:`, adResult.error);
              } else {
                metaAdId = adResult?.data?.meta_ad_id;
                console.log(`[ads-autopilot-execute-approved][${VERSION}] Ad created: ${metaAdId}`);
              }
            }
          }
        } else {
          console.warn(`[ads-autopilot-execute-approved][${VERSION}] No creative asset found for ad creation`);
        }
      }

      // Mark as executed with result data
      await supabase.from("ads_autopilot_actions")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
          rollback_data: {
            meta_campaign_id: metaCampaignId,
            meta_adset_id: metaAdsetId,
            meta_ad_id: metaAdId,
          },
        })
        .eq("id", action_id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            meta_campaign_id: metaCampaignId,
            meta_adset_id: metaAdsetId,
            meta_ad_id: metaAdId,
            campaign_name: campaignName,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== CREATE ADSET — Direct Meta API execution ======
    if (action.action_type === "create_adset" && action.channel === "meta") {
      const adAccountId = data.ad_account_id;
      const adsetName = data.adset_name || data.name || "Conjunto IA";

      const isColdAdset = isColdFunnelStage(data.funnel_stage || preview.funnel_stage)
        || ["broad", "lookalike"].includes(String(data.audience_type || preview.audience_type || "").toLowerCase())
        || /broad|amplo|lal|tof|aquisi|prospect/i.test(`${data.adset_name || ""} ${data.audience_description || ""}`);
      if (isColdAdset) {
        // 2026-06-17: nunca bloqueia. Auto-injeta exclusão SE público existir
        // E a proposta ainda contiver `audience_exclusions.customers=true`.
        // Se o usuário removeu durante a revisão, respeita e publica.
        const customerAudience = await resolveCustomerAudienceForMetaAccount(supabase, tenant_id, adAccountId);
        if (customerAudience.found && customerAudience.meta_audience_id) {
          const exclusionStillProposed = !!(data?.audience_exclusions?.customers);
          const existingExcluded = Array.isArray(data.excluded_audience_ids)
            ? data.excluded_audience_ids.map((entry: any) => String(entry?.id || entry))
            : [];
          if (exclusionStillProposed && !existingExcluded.includes(String(customerAudience.meta_audience_id))) {
            data.excluded_audience_ids = [...existingExcluded, customerAudience.meta_audience_id];
            data.audience_exclusions = {
              ...(data.audience_exclusions || {}),
              customers: true,
              customer_audience_detected: true,
              customer_audience_id: customerAudience.meta_audience_id,
              customer_audience_name: customerAudience.audience_name,
              reason: (data.audience_exclusions?.reason || "Conjunto de aquisição/prospecção deve excluir clientes/compradores atuais."),
            };
          } else if (!exclusionStillProposed) {
            console.log(`[ads-autopilot-execute-approved][${VERSION}] Cold adset user-override: customer exclusion REMOVED tenant=${tenant_id} action=${action_id}`);
          }
        } else {
          console.log(`[ads-autopilot-execute-approved][${VERSION}] Cold adset advisory: customer audience not synced — proceeding without exclusion`);
        }
      }

      // v2.2.0: Primary lookup by campaign_id (Meta campaign ID) from action_data
      // Fallback to name-based lookup for backward compatibility
      let metaCampaignId: string | null = data.campaign_id || null;
      
      if (!metaCampaignId) {
        // Legacy fallback: lookup by name
        const parentCampaignName = data.campaign_name || data.parent_campaign_name;
        if (parentCampaignName) {
          const { data: parentCampaign } = await supabase
            .from("meta_ad_campaigns")
            .select("meta_campaign_id")
            .eq("tenant_id", tenant_id)
            .eq("ad_account_id", adAccountId)
            .ilike("name", `%${parentCampaignName}%`)
            .limit(1)
            .maybeSingle();
          metaCampaignId = parentCampaign?.meta_campaign_id || null;
        }
      }

      // v2.2.0: Also try matching campaign_id directly against meta_ad_campaigns
      // (in case it's already a valid meta_campaign_id string like "120246559700000004")
      if (metaCampaignId && !metaCampaignId.startsWith("120")) {
        // If it doesn't look like a Meta ID, look it up
        const { data: lookupCampaign } = await supabase
          .from("meta_ad_campaigns")
          .select("meta_campaign_id")
          .eq("tenant_id", tenant_id)
          .eq("id", metaCampaignId)
          .maybeSingle();
        if (lookupCampaign) metaCampaignId = lookupCampaign.meta_campaign_id;
      }

      if (!metaCampaignId) {
        const fallbackInfo = `campaign_id=${data.campaign_id}, campaign_name=${data.campaign_name}`;
        console.error(`[ads-autopilot-execute-approved][${VERSION}] Parent campaign not found for adset. ${fallbackInfo}`);
        await supabase.from("ads_autopilot_actions")
          .update({ status: "failed", error_message: `Campanha pai não encontrada. Dados: ${fallbackInfo}` })
          .eq("id", action_id);

        return new Response(
          JSON.stringify({ success: false, error: `Campanha pai não encontrada. Aprove a campanha antes dos conjuntos.` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[ads-autopilot-execute-approved][${VERSION}] Creating adset "${adsetName}" for campaign ${metaCampaignId}`);

      // Get pixel
      const { data: mktConfig } = await supabase
        .from("marketing_integrations")
        .select("meta_pixel_id")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      const preview = data.preview || {};
      const geoLocations = data.geo_locations || preview.geo_locations || { countries: ["BR"] };
      const targeting: any = {
        geo_locations: geoLocations,
        age_min: data.age_min || preview.age_min || 18,
        age_max: data.age_max || preview.age_max || 65,
      };
      
      const genders = data.genders || preview.genders;
      if (genders?.length > 0 && !(genders.length === 1 && genders[0] === 0)) targeting.genders = genders;

      const customAudienceIds = data.custom_audience_ids || preview.custom_audience_ids || data.custom_audiences;
      if (customAudienceIds?.length > 0) {
        targeting.custom_audiences = customAudienceIds.map((a: any) => ({ id: a.id || a }));
      } else if (data.custom_audience_id) {
        targeting.custom_audiences = [{ id: data.custom_audience_id }];
      }
      
      const excludedAudienceIds = data.excluded_audience_ids || preview.excluded_audience_ids;
      if (excludedAudienceIds?.length > 0) {
        targeting.excluded_custom_audiences = excludedAudienceIds.map((a: any) => ({ id: a.id || a }));
      }

      const interests = data.interests || preview.interests;
      if (interests?.length > 0) targeting.flexible_spec = [{ interests }];
      
      const behaviors = data.behaviors || preview.behaviors;
      if (behaviors?.length > 0) {
        if (targeting.flexible_spec) targeting.flexible_spec[0].behaviors = behaviors;
        else targeting.flexible_spec = [{ behaviors }];
      }

      const publisherPlatforms = data.publisher_platforms || preview.publisher_platforms;
      if (publisherPlatforms?.length > 0) targeting.publisher_platforms = publisherPlatforms;
      const devicePlatforms = data.device_platforms || preview.device_platforms;
      if (devicePlatforms?.length > 0) targeting.device_platforms = devicePlatforms;

      const adsetScheduling = getSchedulingParams();
      const optimizationGoal = data.optimization_goal || preview.optimization_goal || "OFFSITE_CONVERSIONS";
      const billingEvent = data.billing_event || preview.billing_event || "IMPRESSIONS";
      
      const adsetBody: any = {
        tenant_id,
        action: "create",
        ad_account_id: adAccountId,
        meta_campaign_id: metaCampaignId,
        name: adsetName,
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        targeting,
        status: adsetScheduling.status,
      };
      if (data.daily_budget_cents) adsetBody.daily_budget_cents = data.daily_budget_cents;
      if (data.lifetime_budget_cents) adsetBody.lifetime_budget_cents = data.lifetime_budget_cents;
      if (data.bid_amount_cents || preview.bid_amount_cents) adsetBody.bid_amount_cents = data.bid_amount_cents || preview.bid_amount_cents;
      if (adsetScheduling.start_time) adsetBody.start_time = adsetScheduling.start_time;
      if (data.end_time || preview.end_time) adsetBody.end_time = data.end_time || preview.end_time;

      const conversionEvent = data.conversion_event || preview.conversion_event;
      if (mktConfig?.meta_pixel_id && conversionEvent) {
        adsetBody.promoted_object = { pixel_id: mktConfig.meta_pixel_id, custom_event_type: conversionEvent };
      } else if (mktConfig?.meta_pixel_id) {
        adsetBody.promoted_object = { pixel_id: mktConfig.meta_pixel_id, custom_event_type: data.custom_event_type || "PURCHASE" };
      }


      console.log(`[ads-autopilot-execute-approved][${VERSION}] Creating adset: ${adsetName} for campaign ${metaCampaignId}`);

      const { data: adsetResult, error: adsetErr } = await supabase.functions.invoke("meta-ads-adsets", {
        body: adsetBody,
      });

      if (adsetErr) throw new Error(`Erro ao criar conjunto: ${adsetErr.message}`);
      if (adsetResult && !adsetResult.success) throw new Error(`Erro ao criar conjunto: ${adsetResult.error}`);

      const metaAdsetId = adsetResult?.data?.meta_adset_id;
      console.log(`[ads-autopilot-execute-approved][${VERSION}] Adset created: ${metaAdsetId}`);

      await supabase.from("ads_autopilot_actions")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
          rollback_data: { meta_campaign_id: metaCampaignId, meta_adset_id: metaAdsetId },
        })
        .eq("id", action_id);

      return new Response(
        JSON.stringify({ success: true, data: { meta_adset_id: metaAdsetId } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== CREATE CAMPAIGN — Google Ads execution ======
    if (action.action_type === "create_campaign" && action.channel === "google") {
      const adAccountId = data.ad_account_id;
      const campaignName = data.campaign_name || preview.campaign_name || "[AI] Nova Campanha Google";
      const budgetAmountMicros = data.budget_amount_micros || (data.daily_budget_cents ? data.daily_budget_cents * 10000 : 1000000);
      const advertisingChannelType = data.advertising_channel_type || "SEARCH";

      console.log(`[ads-autopilot-execute-approved][${VERSION}] Creating Google campaign: ${campaignName} type=${advertisingChannelType}`);

      const campaignBody: any = {
        tenant_id, action: "create", customer_id: adAccountId,
        name: campaignName, status: "PAUSED",
        advertising_channel_type: advertisingChannelType,
        budget_amount_micros: budgetAmountMicros,
        budget_type: data.budget_type || "DAILY",
        bidding_strategy_type: data.bidding_strategy_type || "MAXIMIZE_CONVERSIONS",
        target_cpa_micros: data.target_cpa_micros || null,
        target_roas: data.target_roas || null,
        network_settings: data.network_settings || null,
        geo_targets: data.geo_targets || ["2076"], // 2076 = Brazil
        language_targets: data.language_targets || ["1014"], // 1014 = Portuguese
      };

      const { data: campaignResult, error: campaignErr } = await supabase.functions.invoke("google-ads-campaigns", { body: campaignBody });
      if (campaignErr || !campaignResult?.success) {
        const errMsg = campaignErr?.message || campaignResult?.error || "Erro ao criar campanha Google";
        console.error(`[ads-autopilot-execute-approved][${VERSION}] Google campaign error:`, errMsg);
        await supabase.from("ads_autopilot_actions").update({ status: "failed", error_message: errMsg }).eq("id", action_id);
        return new Response(JSON.stringify({ success: false, error: errMsg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const googleCampaignId = campaignResult.data?.google_campaign_id;

      // Create ad group if search campaign
      let googleAdGroupId: string | null = null;
      if (googleCampaignId && (advertisingChannelType === "SEARCH" || advertisingChannelType === "DISPLAY")) {
        const adGroupName = data.ad_group_name || campaignName.replace("[AI]", "[AI] AG -");
        const { data: agResult } = await supabase.functions.invoke("google-ads-adgroups", {
          body: { tenant_id, action: "create", customer_id: adAccountId, campaign_id: googleCampaignId, name: adGroupName, status: "ENABLED",
                  ad_group_type: advertisingChannelType === "SEARCH" ? "SEARCH_STANDARD" : "DISPLAY_STANDARD",
                  cpc_bid_micros: data.cpc_bid_micros || null, target_cpa_micros: data.target_cpa_micros || null }
        });
        googleAdGroupId = agResult?.data?.google_ad_group_id || null;
        if (googleAdGroupId) console.log(`[ads-autopilot-execute-approved][${VERSION}] Google ad group created: ${googleAdGroupId}`);
      }

      // Create keywords for Search campaigns
      if (googleAdGroupId && advertisingChannelType === "SEARCH" && data.keywords?.length > 0) {
        const { data: kwResult } = await supabase.functions.invoke("google-ads-keywords", {
          body: { tenant_id, action: "create", customer_id: adAccountId, ad_group_id: googleAdGroupId, keywords: data.keywords }
        });
        console.log(`[ads-autopilot-execute-approved][${VERSION}] Keywords created: ${kwResult?.data?.created || 0}`);
      }

      // Create RSA for Search campaigns
      let googleAdId: string | null = null;
      if (googleAdGroupId && advertisingChannelType === "SEARCH" && data.headlines?.length && data.descriptions?.length) {
        const destinationUrl = data.destination_url || data.final_urls?.[0] || null;
        if (destinationUrl) {
          const { data: adResult } = await supabase.functions.invoke("google-ads-ads", {
            body: { tenant_id, action: "create", customer_id: adAccountId, ad_group_id: googleAdGroupId, ad_type: "RESPONSIVE_SEARCH_AD",
                    final_urls: [destinationUrl], headlines: data.headlines, descriptions: data.descriptions,
                    path1: data.path1 || null, path2: data.path2 || null, status: "ENABLED" }
          });
          googleAdId = adResult?.data?.google_ad_id || null;
          if (googleAdId) console.log(`[ads-autopilot-execute-approved][${VERSION}] Google ad created: ${googleAdId}`);
        }
      }

      await supabase.from("ads_autopilot_actions").update({
        status: "executed", executed_at: new Date().toISOString(),
        rollback_data: { google_campaign_id: googleCampaignId, google_ad_group_id: googleAdGroupId, google_ad_id: googleAdId },
      }).eq("id", action_id);

      return new Response(JSON.stringify({ success: true, data: { google_campaign_id: googleCampaignId, google_ad_group_id: googleAdGroupId, google_ad_id: googleAdId } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== PAUSE/ACTIVATE — Google Ads ======
    if ((action.action_type === "pause_campaign" || action.action_type === "activate_campaign") && action.channel === "google") {
      const campaignId = data.campaign_id || data.google_campaign_id;
      const googleAction = action.action_type === "pause_campaign" ? "pause" : "activate";
      const { data: result, error: err } = await supabase.functions.invoke("google-ads-campaigns", {
        body: { tenant_id, action: googleAction, customer_id: data.ad_account_id, campaign_id: campaignId }
      });
      if (err || !result?.success) {
        await supabase.from("ads_autopilot_actions").update({ status: "failed", error_message: err?.message || result?.error }).eq("id", action_id);
        return new Response(JSON.stringify({ success: false, error: err?.message || result?.error }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("ads_autopilot_actions").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", action_id);
      return new Response(JSON.stringify({ success: true, data: result.data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== OTHER ACTIONS — Mark as executed ======
    console.log(`[ads-autopilot-execute-approved][${VERSION}] Action type ${action.action_type} — marking as executed`);

    await supabase.from("ads_autopilot_actions")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", action_id);

    return new Response(
      JSON.stringify({ success: true, data: { action_type: action.action_type } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[ads-autopilot-execute-approved][${VERSION}] Error:`, err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
