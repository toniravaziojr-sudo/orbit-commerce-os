// =============================================================================
// ads-autopilot-publish-proposal — Onda H.4.2
// Publica de fato a Proposta de Campanha aprovada na Meta (campanha → conjunto →
// ad creative → anúncio), em modo ACTIVE com agendamento na próxima janela
// 00:01 BRT (ou imediato se já dentro da janela 00:01-04:00 BRT).
//
// Pré-condição:
//   - action.action_type === "campaign_proposal"
//   - action.status === "approved"
//   - action.action_data.lifecycle.status === "campaign_creatives_ready"
//
// Pós-condição (sucesso):
//   - action.status = "executed"
//   - action.action_data.lifecycle.status = "campaign_implemented"
//   - rollback_data preenchido com meta_campaign_id/adset_id/ad_ids
//
// Falha parcial → lifecycle.status = "campaign_implementation_failed" + erro.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import {
  mapGender,
  mapGeoLocations,
  applyPlacements,
  mapAttributionSpec,
  fetchAccountAudiences,
  findAudienceByName,
  extractIncludedAudienceRefs,
  type MetaAudience,
} from "../_shared/meta-publish-mappers.ts";

const VERSION = "v1.6.0-utm-paid-social-and-lifecycle-spec-with-audience";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- UTM helpers ---------------------------------------------------------
function utmSlug(s: any, max = 60): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
}

function buildAdUtms(opts: {
  base?: Record<string, any> | null;
  campaignName: string;
  adsetName?: string | null;
  creativeIndex: number;
  audienceLabel?: string | null;
}): Record<string, string> {
  // utm_medium=paid_social é o padrão GA4/setor e é o ÚNICO valor reconhecido
  // pelo motor de "ROAS Real (Ads)" do gestor de tráfego. Não trocar por
  // social_paid/social/paid — quebra a atribuição de venda paga.
  const out: Record<string, string> = {
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: utmSlug(opts.campaignName) || "campanha",
    utm_content: `ad_${opts.creativeIndex + 1}`,
  };
  if (opts.adsetName) out.utm_term = utmSlug(opts.adsetName);
  if (opts.audienceLabel) out.utm_audience = utmSlug(opts.audienceLabel);
  if (opts.base && typeof opts.base === "object") {
    for (const [k, v] of Object.entries(opts.base)) {
      if (v && !(k in out)) out[k] = String(v);
    }
  }
  return out;
}

function applyUtmsToUrl(url: string, utms: Record<string, string>): string {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(utms)) {
      if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function utmsToUrlTags(utms: Record<string, string>): string {
  return Object.entries(utms)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}


function getSchedulingParams(): { status: string; start_time?: string } {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const brtMinute = now.getUTCMinutes();
  if ((brtHour === 0 && brtMinute >= 1) || (brtHour >= 1 && brtHour < 4)) {
    return { status: "ACTIVE" };
  }
  const nextPublish = new Date(now);
  if (brtHour >= 4) nextPublish.setUTCDate(nextPublish.getUTCDate() + 1);
  nextPublish.setUTCHours(3, 1, 0, 0);
  return { status: "ACTIVE", start_time: nextPublish.toISOString() };
}

async function pauseMetaObjects(accessToken: string, metaCampaignId?: string | null, metaAdsetIds: string[] = []) {
  const ids = [...metaAdsetIds, ...(metaCampaignId ? [metaCampaignId] : [])];
  for (const id of ids) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
      }).then(r => r.json()).catch(() => null);
    } catch (e: any) {
      console.warn(`[publish] Falha ao pausar objeto Meta ${id}: ${e?.message}`);
    }
  }
}

const OBJECTIVE_MAP: Record<string, string> = {
  conversions: "OUTCOME_SALES",
  sales: "OUTCOME_SALES",
  outcome_sales: "OUTCOME_SALES",
  traffic: "OUTCOME_TRAFFIC",
  outcome_traffic: "OUTCOME_TRAFFIC",
  awareness: "OUTCOME_AWARENESS",
  outcome_awareness: "OUTCOME_AWARENESS",
  leads: "OUTCOME_LEADS",
  outcome_leads: "OUTCOME_LEADS",
  engagement: "OUTCOME_ENGAGEMENT",
};

Deno.serve(async (req) => {
  console.log(`[publish-proposal][${VERSION}] ${req.method}`);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenant_id, action_id, overrides } = await req.json();
    if (!tenant_id || !action_id) {
      return new Response(JSON.stringify({ success: false, error_pt: "Parâmetros faltando." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: action } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!action) {
      return new Response(JSON.stringify({ success: false, error_pt: "Proposta não encontrada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action.action_type !== "campaign_proposal") {
      return new Response(JSON.stringify({ success: false, error_pt: "Esta ação não é uma proposta de campanha." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const propData = action.action_data || {};
    const lifecycle = propData.lifecycle || {};

    // Lifecycles aceitáveis para tentar publicar:
    // - estrutura aprovada (fluxo manual: usuário anexa/gera criativo no próprio assistente)
    // - criativos prontos (fluxo antigo em lote via creative_jobs)
    // - falhas anteriores (retry)
    const PUBLISH_ALLOWED_LIFECYCLES = new Set([
      "structure_approved_awaiting_creatives",
      "campaign_creatives_generating",
      "campaign_creatives_ready",
      "campaign_creatives_failed",
      "campaign_implementation_failed",
    ]);
    const currentLifecycleStatus = lifecycle.status || null;
    if (currentLifecycleStatus && !PUBLISH_ALLOWED_LIFECYCLES.has(currentLifecycleStatus)) {
      return new Response(JSON.stringify({
        success: false,
        error_pt: "Esta proposta não está em um estado que permita publicação agora.",
        current_lifecycle: currentLifecycleStatus,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const campaign = propData.campaign || {};
    const identity = propData.identity || {};
    const adsetsList = Array.isArray(propData.adsets) ? propData.adsets : [];
    const plannedCreatives = Array.isArray(propData.planned_creatives) ? propData.planned_creatives : [];
    const adsList = Array.isArray(propData.ads) ? propData.ads : [];
    const creativeJobsMeta = Array.isArray(lifecycle.creative_jobs) ? lifecycle.creative_jobs : [];

    const adAccountId = propData.ad_account_id || campaign.ad_account_id;
    if (!adAccountId) {
      return new Response(JSON.stringify({ success: false, error_pt: "Conta de anúncios não definida na proposta." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!identity.facebook_page_id) {
      return new Response(JSON.stringify({ success: false, error_pt: "Página do Facebook não configurada na conta." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (adsetsList.length === 0) {
      return new Response(JSON.stringify({ success: false, error_pt: "Nenhum conjunto de anúncios na proposta." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- Coleta de criativos prontos ----------
    // Fonte 1 (preferencial): planned_creatives[i] / ads[i] com URL final
    //   (anexo do PC, Drive ou IA inline gravam aqui via StructuredProposalModal).
    // Fonte 2 (legado): creative_jobs em lote do fluxo H.4.1.
    const readyCreatives: Array<{ creative_index: number; image_url: string; product_id: string | null; planned: any }> = [];
    const seenIndexes = new Set<number>();

    const pickStr = (...vals: any[]): string | null => {
      for (const v of vals) {
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    const totalSlots = Math.max(plannedCreatives.length, adsList.length);
    for (let i = 0; i < totalSlots; i++) {
      const planned = plannedCreatives[i] || {};
      const adNode = adsList[i] || {};
      const url = pickStr(
        adNode.creative_final_url, adNode.creative_url, adNode.asset_url, adNode.image_url,
        planned.creative_final_url, planned.image_url, planned.creative_url, planned.asset_url,
      );
      if (!url) continue;
      // Mescla copy/headline/cta/destination do ads[i] dentro do planned (ads[i] é o que o usuário editou).
      const mergedPlanned = {
        ...planned,
        copy: pickStr(adNode.primary_text, adNode.copy, planned.copy, planned.primary_text) || planned.copy,
        primary_text: pickStr(adNode.primary_text, planned.primary_text, planned.copy) || planned.primary_text,
        headline: pickStr(adNode.headline, planned.headline) || planned.headline,
        cta: pickStr(adNode.cta, planned.cta) || planned.cta,
        destination_url: pickStr(adNode.destination_url, planned.destination_url, planned.final_url_with_utm) || planned.destination_url,
      };
      readyCreatives.push({
        creative_index: i,
        image_url: url,
        product_id: adNode.product_id || planned.product_id || null,
        planned: mergedPlanned,
      });
      seenIndexes.add(i);
    }

    // Fonte 2 — creative_jobs (fluxo legado em lote). Só usa se ainda não temos
    // criativo para aquele índice via fonte 1.
    if (creativeJobsMeta.length > 0) {
      const jobIds = creativeJobsMeta.map((j: any) => j.job_id || j.id).filter(Boolean);
      const { data: jobs } = await supabase
        .from("creative_jobs")
        .select("id, status, output_urls, product_id, prompt")
        .in("id", jobIds.length > 0 ? jobIds : ["00000000-0000-0000-0000-000000000000"]);

      for (const meta of creativeJobsMeta) {
        const jobId = meta.job_id || meta.id;
        const creativeIndex = (typeof meta.creative_index === "number") ? meta.creative_index : (meta.planned_creative_index ?? 0);
        if (seenIndexes.has(creativeIndex)) continue;
        const job = (jobs || []).find((j: any) => j.id === jobId);
        if (!job || (job.status !== "succeeded" && job.status !== "completed")) continue;
        const url = Array.isArray(job.output_urls) && job.output_urls.length > 0 ? job.output_urls[0] : null;
        if (!url) continue;
        const planned = plannedCreatives[creativeIndex] || {};
        readyCreatives.push({
          creative_index: creativeIndex,
          image_url: url,
          product_id: job.product_id || planned.product_id || null,
          planned,
        });
        seenIndexes.add(creativeIndex);
      }
    }

    if (readyCreatives.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error_pt: "Nenhum criativo anexado ou gerado. Anexe ou gere ao menos um criativo antes de publicar.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metaConn = await getMetaConnectionForTenant(supabase, tenant_id);
    if (!metaConn?.access_token) {
      return new Response(JSON.stringify({ success: false, error_pt: "Conta Meta desconectada. Reconecte e tente novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scheduling = (overrides?.scheduling === "now") ? { status: "ACTIVE" } : getSchedulingParams();
    const objectiveRaw = String(campaign.objective || "conversions").toLowerCase();
    const objective = OBJECTIVE_MAP[objectiveRaw] || campaign.objective || "OUTCOME_SALES";
    const campaignName = (campaign.name || "Nova Campanha").startsWith("[AI]") ? campaign.name : `[AI] ${campaign.name || "Nova Campanha"}`;
    const dailyBudgetCents = Number(campaign.daily_budget_cents || 0);

    if (["OUTCOME_SALES", "OUTCOME_LEADS"].includes(String(objective).toUpperCase()) && !identity.pixel_id) {
      await markFailed(supabase, action_id, propData, lifecycle, "pixel_missing", "Pixel da Meta não configurado para campanhas de vendas/leads.");
      return new Response(JSON.stringify({ success: false, error_pt: "Pixel da Meta não configurado para campanhas de vendas/leads." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (String(campaign.budget_mode || "CBO").toUpperCase() === "CBO" && dailyBudgetCents <= 0) {
      await markFailed(supabase, action_id, propData, lifecycle, "budget_missing", "Orçamento diário da campanha não definido.");
      return new Response(JSON.stringify({ success: false, error_pt: "Orçamento diário da campanha não definido." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    for (let i = 0; i < adsetsList.length; i++) {
      const a = adsetsList[i] || {};
      if (a.use_advantage_audience === true && Number(a.age_min || 18) > 25) {
        const errMsg = `Conjunto ${i + 1}: a Meta não permite público Advantage+ com idade mínima acima de 25 anos.`;
        await markFailed(supabase, action_id, propData, lifecycle, "advantage_audience_age_blocked", errMsg);
        return new Response(JSON.stringify({ success: false, error_pt: errMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const canInferOneToOneAdset = adsetsList.length > 1 && readyCreatives.length === adsetsList.length;
      if (adsetsList.length > 1 && !canInferOneToOneAdset && readyCreatives.some(c => c.planned && typeof c.planned.adset_index !== "number")) {
        await markFailed(supabase, action_id, propData, lifecycle, "creative_adset_index_missing", "Há criativos sem vínculo com conjunto de anúncios. Revise os anúncios antes de publicar.");
        return new Response(JSON.stringify({ success: false, error_pt: "Há criativos sem vínculo com conjunto de anúncios. Revise os anúncios antes de publicar." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ===== Step 1: Campaign =====
    const campaignBody: any = {
      tenant_id,
      action: "create",
      ad_account_id: adAccountId,
      name: campaignName,
      objective,
      destination_type: "WEBSITE",
      status: scheduling.status,
      daily_budget_cents: dailyBudgetCents,
      special_ad_categories: campaign.special_ad_categories || [],
      bid_strategy: campaign.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      buying_type: campaign.buying_type || "AUCTION",
    };
    // Estratégia de ciclo de vida do cliente (Meta: "is_new_customer_acquisition").
    // "new_customers" → Conquistar novos clientes. Segurança em camada extra:
    // campanha fria (TOF) de vendas/leads sem escolha do lojista → força "new_customers".
    // Pré-requisito Meta: a flag só "engata" se a campanha tiver
    // customer_acquisition_spec apontando para uma audiência de "clientes atuais"
    // (Customer File ou Website Purchase). Sem essa audiência, a Meta aceita o POST
    // mas exibe o seletor vazio. Por isso buscamos no catálogo da conta uma
    // audiência cujo nome sugira compradores; se não houver, publicamos sem a
    // flag e registramos aviso técnico claro na proposta.
    const customerAcq = String(campaign.customer_acquisition || "").toLowerCase();
    const objUpper = String(objective).toUpperCase();
    const supportsAcq = objUpper === "OUTCOME_SALES" || objUpper === "OUTCOME_LEADS";
    let effectiveAcq = customerAcq;
    if (!effectiveAcq && supportsAcq) {
      const stages = [
        String(campaign.funnel_stage || ""),
        String(campaign.affected_funnel || ""),
        ...adsetsList.map((a: any) => String(a?.funnel_stage || "")),
      ].map((s) => s.toLowerCase());
      const isCold = stages.some((s) =>
        s.includes("tof") || s.includes("cold") || s.includes("frio") ||
        s.includes("prosp") || s.includes("broad") || s.includes("topo"),
      );
      const isWarm = stages.some((s) =>
        s.includes("mof") || s.includes("bof") || s.includes("remark") ||
        s.includes("warm") || s.includes("quente") || s.includes("fundo") || s.includes("meio"),
      );
      if (isCold && !isWarm) effectiveAcq = "new_customers";
    }

    let lifecycleNotice: string | null = null;
    let lifecycleAudienceUsed: { id: string; name: string } | null = null;
    if (effectiveAcq === "new_customers" && supportsAcq) {
      // Procura audiência de compradores existente na conta (não cria nova).
      try {
        const cat = await fetchAccountAudiences(adAccountId, metaConn.access_token);
        const buyerRegex = /(compradores?|clientes?|customers?|buyers?|purchas|compra|comprou)/i;
        const buyerAud = cat.find((a) => a?.name && buyerRegex.test(a.name));
        if (buyerAud) {
          campaignBody.is_new_customer_acquisition = true;
          campaignBody.customer_acquisition_spec = { custom_audiences: [{ id: buyerAud.id }] };
          lifecycleAudienceUsed = { id: buyerAud.id, name: buyerAud.name };
        } else {
          lifecycleNotice =
            "Estratégia de ciclo de vida do cliente não aplicada: a conta da Meta ainda não tem uma audiência de compradores (ex.: \"Compradores 180d\" via evento Purchase do pixel). Crie em Gerenciador de Anúncios → Públicos e republique para ativar \"Conquistar novos clientes\".";
        }
      } catch (e: any) {
        lifecycleNotice = `Estratégia de ciclo de vida do cliente não aplicada: falha ao consultar audiências da conta (${e?.message || e}).`;
      }
    }

    if (scheduling.start_time) campaignBody.start_time = scheduling.start_time;

    const campaignRes = await supabase.functions.invoke("meta-ads-campaigns", { body: campaignBody });
    if (campaignRes.error || !campaignRes.data?.success) {
      const errMsg = campaignRes.error?.message || campaignRes.data?.error || "Falha ao criar campanha na Meta.";
      const metaErr = campaignRes.data?.meta_error || null;
      await markFailed(supabase, action_id, propData, lifecycle, "campaign_create_failed", errMsg, { meta_error_detail: metaErr });
      return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "campaign", meta_error: metaErr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const metaCampaignId = campaignRes.data?.data?.meta_campaign_id;
    if (!metaCampaignId) {
      const errMsg = "A Meta não retornou o ID da campanha criada.";
      await markFailed(supabase, action_id, propData, lifecycle, "campaign_id_missing", errMsg);
      return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "campaign" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Step 2: Criar TODOS os conjuntos da proposta =====
    const accountIdClean = String(adAccountId).replace("act_", "");
    const adsetIdByIndex = new Map<number, string>();
    const createdAdsetIds: string[] = [];

    // Catálogo de públicos da conta (1 fetch por publicação)
    let audienceCatalog: MetaAudience[] | null = null;
    const audienceResolutionLog: any[] = [];
    const ensureCatalog = async (): Promise<MetaAudience[]> => {
      if (audienceCatalog) return audienceCatalog;
      try {
        audienceCatalog = await fetchAccountAudiences(adAccountId, metaConn.access_token);
      } catch (e: any) {
        console.error(`[publish] fetch audiences falhou: ${e?.message}`);
        audienceCatalog = [];
      }
      return audienceCatalog;
    };

    for (let aIdx = 0; aIdx < adsetsList.length; aIdx++) {
      const adset = adsetsList[aIdx] || {};
      const targeting: any = {
        geo_locations: mapGeoLocations(adset),
        age_min: adset.age_min || 18,
        age_max: adset.age_max || 65,
      };

      // Gênero (mapeia "Masculino"/"Feminino"/"Todos" para [1]/[2]/omitir)
      const g = mapGender(adset.genders ?? adset.gender);
      if (g) targeting.genders = g;

      // Posicionamentos (Advantage+ ou lista manual)
      applyPlacements(targeting, adset);

      // Exclusões de público (formato moderno + legado)
      const exclArrRaw = adset?.targeting?.excluded_custom_audiences
        || (Array.isArray(adset.excluded_audience_ids)
          ? adset.excluded_audience_ids.map((a: any) => (typeof a === "object" ? a : { id: a }))
          : []);
      if (Array.isArray(exclArrRaw) && exclArrRaw.length > 0) {
        targeting.excluded_custom_audiences = exclArrRaw.map((a: any) => ({ id: a.id || a }));
      }

      // Inclusão de público / Lookalikes — resolve nomes para IDs reais na conta
      const includeRefs = extractIncludedAudienceRefs(adset);
      if (includeRefs.length > 0) {
        const catalog = await ensureCatalog();
        const resolved: Array<{ id: string }> = [];
        const missing: string[] = [];
        for (const ref of includeRefs) {
          if (ref.id) {
            resolved.push({ id: ref.id });
            audienceResolutionLog.push({ adset_index: aIdx, ref, resolved_id: ref.id, source: "id" });
            continue;
          }
          if (ref.name) {
            const hit = findAudienceByName(catalog, ref.name);
            if (hit) {
              resolved.push({ id: hit.id });
              audienceResolutionLog.push({ adset_index: aIdx, ref, resolved_id: hit.id, matched_name: hit.name, source: "name" });
            } else {
              missing.push(ref.name);
              audienceResolutionLog.push({ adset_index: aIdx, ref, resolved_id: null, source: "name", error: "not_found" });
            }
          }
        }
        if (missing.length > 0) {
          const errMsg = `Conjunto ${aIdx + 1}: público(s) não encontrado(s) na conta: ${missing.join(", ")}.`;
          await pauseMetaObjects(metaConn.access_token, metaCampaignId, createdAdsetIds);
          await markFailed(supabase, action_id, propData, lifecycle, "audience_not_found", errMsg, {
            meta_campaign_id: metaCampaignId,
            meta_adset_ids_created: createdAdsetIds,
            failed_adset_index: aIdx,
            audience_resolution: audienceResolutionLog,
            rollback_paused: true,
          });
          return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "audience_resolve", adset_index: aIdx }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (resolved.length > 0) targeting.custom_audiences = resolved;
      }

      const optimizationGoal = adset.optimization_goal || "OFFSITE_CONVERSIONS";
      const billingEvent = adset.billing_event || "IMPRESSIONS";
      const conversionEvent = adset.conversion_event || identity.conversion_event_default || identity.conversion_event || "PURCHASE";

      const adsetBody: any = {
        tenant_id,
        action: "create",
        ad_account_id: adAccountId,
        meta_campaign_id: metaCampaignId,
        name: adset.name || `${campaignName} - CJ ${aIdx + 1}`,
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        targeting,
        status: scheduling.status,
        use_advantage_audience: adset.use_advantage_audience === true,
      };
      if (scheduling.start_time) adsetBody.start_time = scheduling.start_time;
      if (adset.end_time) adsetBody.end_time = adset.end_time;
      if (identity.pixel_id) {
        adsetBody.promoted_object = { pixel_id: identity.pixel_id, custom_event_type: conversionEvent };
      }
      // ABO: orçamento no conjunto. CBO: orçamento na campanha.
      if (adset.daily_budget_cents && String(campaign.budget_mode || "").toUpperCase() !== "CBO") {
        adsetBody.daily_budget_cents = Number(adset.daily_budget_cents);
      }
      // Janela de atribuição
      const attribSpec = mapAttributionSpec(adset.attribution_window || campaign.attribution_window || identity.attribution_window);
      if (attribSpec) adsetBody.attribution_spec = attribSpec;

      const adsetRes = await supabase.functions.invoke("meta-ads-adsets", { body: adsetBody });
      if (adsetRes.error || !adsetRes.data?.success) {
        const errMsg = adsetRes.error?.message || adsetRes.data?.error || `Falha ao criar conjunto ${aIdx + 1} na Meta.`;
        const metaErr = adsetRes.data?.meta_error || null;

        // Anti-órfã: se ainda não criamos NENHUM conjunto, a campanha recém-criada
        // ficaria sozinha na Meta (sem conjunto, sem anúncio). Pausamos para evitar
        // que o lojista veja "campanha vazia" e tenha que limpar manualmente.
        if (createdAdsetIds.length === 0 && metaCampaignId) {
          await pauseMetaObjects(metaConn.access_token, metaCampaignId, []);
          console.log(`[publish] Campanha órfã ${metaCampaignId} pausada após falha no 1º conjunto.`);
        }

        await markFailed(supabase, action_id, propData, lifecycle, "adset_create_failed", errMsg, {
          meta_campaign_id: metaCampaignId,
          meta_adset_ids_created: createdAdsetIds,
          failed_adset_index: aIdx,
          audience_resolution: audienceResolutionLog,
          meta_error_detail: metaErr,
          orphan_campaign_paused: createdAdsetIds.length === 0,
        });
        return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "adset", adset_index: aIdx, meta_campaign_id: metaCampaignId, meta_error: metaErr }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const metaAdsetId = adsetRes.data?.data?.meta_adset_id;
      if (metaAdsetId) {
        adsetIdByIndex.set(aIdx, metaAdsetId);
        createdAdsetIds.push(metaAdsetId);
      }
    }

    // ===== Step 3: Para cada criativo pronto → upload imagem + adcreative + ad =====
    const createdAdIds: Array<{ creative_index: number; meta_ad_id: string | null; meta_adset_id: string | null; error?: string }> = [];

    // Resolve storeHost para destination_url quando não vier no planned
    const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenant_id).maybeSingle();
    const { data: primaryDomain } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenant_id).eq("is_primary", true).eq("status", "verified").maybeSingle();
    const storeHost = primaryDomain?.domain || `${tenantInfo?.slug}.shops.comandocentral.com.br`;
    const uploadEvents: Array<{ ts: string; creative_index: number; mode: "binary" | "url"; fallback_reason?: string; image_hash?: string | null }> = [];

    const overridesMap: Record<string, any> = (propData.creative_overrides && typeof propData.creative_overrides === "object") ? propData.creative_overrides : {};
    for (const creative of readyCreatives) {
      const ov = overridesMap[String(creative.creative_index)] || {};
      if (ov.image_url) creative.image_url = ov.image_url;

      // Conjunto-alvo do anúncio: usa adset_index do planned/ad; cai para 0 se não existir.
      const targetAdsetIdx = (typeof creative.planned?.adset_index === "number")
        ? creative.planned.adset_index
        : ((adsetsList.length > 1 && readyCreatives.length === adsetsList.length) ? creative.creative_index : 0);
      const metaAdsetIdForAd = adsetIdByIndex.get(targetAdsetIdx) ?? adsetIdByIndex.get(0) ?? null;
      if (!metaAdsetIdForAd) {
        createdAdIds.push({ creative_index: creative.creative_index, meta_ad_id: null, meta_adset_id: null, error: "Conjunto-alvo não encontrado." });
        continue;
      }

      try {
        // Upload imagem — estratégia binária (multipart) para não depender da
        // capability "image scraper" do app Meta. Fallback para URL apenas se
        // o download falhar — registrado em lifecycle.events para auditoria.
        let imageHash: string | null = null;
        let uploadMode: "binary" | "url" = "binary";
        let fallbackReason: string | undefined;
        try {
          const dl = await fetch(creative.image_url);
          if (!dl.ok) throw new Error(`download ${dl.status}`);
          const blob = await dl.blob();
          const contentType = blob.type || "image/png";
          const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
          const filename = `creative_${creative.creative_index + 1}.${ext}`;
          const form = new FormData();
          form.append("access_token", metaConn.access_token);
          form.append(filename, new File([blob], filename, { type: contentType }));
          const imgRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`, {
            method: "POST",
            body: form,
          });
          const imgData = await imgRes.json();
          if (imgData.error) throw new Error(`Upload binário: ${imgData.error.message}`);
          imageHash = imgData?.images?.[filename]?.hash
            || imgData?.images?.[Object.keys(imgData?.images || {})[0]]?.hash
            || null;
        } catch (binErr: any) {
          fallbackReason = binErr?.message || String(binErr);
          console.warn(`[publish] Upload binário falhou, tentando URL: ${fallbackReason}`);
          uploadMode = "url";
          const imgRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: creative.image_url, access_token: metaConn.access_token }),
          });
          const imgData = await imgRes.json();
          if (imgData.error) throw new Error(`Upload imagem: ${imgData.error.message}`);
          imageHash = imgData?.images?.[Object.keys(imgData?.images || {})[0]]?.hash || null;
        }
        if (!imageHash) throw new Error("Hash da imagem não retornado pela Meta.");
        uploadEvents.push({
          ts: new Date().toISOString(),
          creative_index: creative.creative_index,
          mode: uploadMode,
          fallback_reason: fallbackReason,
          image_hash: imageHash,
        });
        console.log(`[publish] Imagem ${creative.creative_index + 1} enviada via ${uploadMode}, hash=${imageHash}`);


        // Destination URL com UTMs obrigatórias.
        // Regra: todo anúncio sobe com UTMs padronizadas (source=meta, medium=paid_social,
        // campaign=<nome>, content=ad_N, term=<conjunto>). Quando o tenant tiver utm_base
        // configurada, ela complementa (não sobrescreve) os valores acima.
        let destinationUrl = creative.planned.destination_url || null;
        if (!destinationUrl) {
          let productSlug = "";
          if (creative.product_id) {
            const { data: prod } = await supabase.from("products").select("slug").eq("id", creative.product_id).maybeSingle();
            productSlug = prod?.slug || creative.product_id;
          }
          destinationUrl = productSlug ? `https://${storeHost}/produto/${productSlug}` : `https://${storeHost}`;
        }
        const adsetForUtm = adsetsList[targetAdsetIdx] || {};
        const audienceLabelForUtm =
          (Array.isArray(adsetForUtm?.required_audiences) && adsetForUtm.required_audiences[0]) ||
          (Array.isArray(adsetForUtm?.required_lookalikes) && adsetForUtm.required_lookalikes[0]) ||
          adsetForUtm?.audience_type || null;
        const adUtms = buildAdUtms({
          base: identity.utm_base || null,
          campaignName: campaignName,
          adsetName: adsetForUtm?.name || null,
          creativeIndex: creative.creative_index,
          audienceLabel: typeof audienceLabelForUtm === "string" ? audienceLabelForUtm : null,
        });
        destinationUrl = applyUtmsToUrl(destinationUrl, adUtms);
        const urlTagsString = utmsToUrlTags(adUtms);


        const ov2 = overridesMap[String(creative.creative_index)] || {};
        const copyText = ov2.copy || creative.planned.copy || creative.planned.primary_text || "Conheça nosso produto.";
        const headline = ov2.headline || creative.planned.headline || campaign.name || "Confira";
        const descriptionText = ov2.description || creative.planned.description || null;
        const ctaType = ov2.cta || creative.planned.cta || identity.cta_default || identity.default_cta || "SHOP_NOW";

        const linkData: any = {
          message: copyText,
          name: headline,
          link: destinationUrl,
          image_hash: imageHash,
          call_to_action: { type: ctaType, value: { link: destinationUrl } },
        };
        if (descriptionText) linkData.description = descriptionText;

        const objectStorySpec: any = {
          page_id: identity.facebook_page_id,
          link_data: linkData,
        };
        // Meta v21: campo legado `instagram_actor_id` rejeita IGBA (17841…) com
        // "must be a valid Instagram account id". O campo aceito hoje é
        // `instagram_user_id`, que recebe diretamente o ID da Conta Instagram
        // Business vinculada à Página. Mantemos `instagram_actor_id` como
        // fallback apenas quando a proposta explicitamente fornecer um valor
        // diferente (compatibilidade com integrações antigas).
        if (identity.instagram_user_id || identity.instagram_actor_id) {
          objectStorySpec.instagram_user_id = identity.instagram_user_id || identity.instagram_actor_id;
        }

        const creativeBody: any = {
          name: `[AI] Creative ${creative.creative_index + 1} - ${new Date().toISOString().split("T")[0]}`,
          access_token: metaConn.access_token,
          object_story_spec: objectStorySpec,
        };
        // Camada nativa de UTM da Meta: garante atribuição mesmo se a URL
        // for reescrita por algum middleware/encurtador.
        if (urlTagsString) creativeBody.url_tags = urlTagsString;


        const adCreativeRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creativeBody),
        });
        const adCreativeData = await adCreativeRes.json();
        if (!adCreativeData.id) throw new Error(`AdCreative: ${adCreativeData.error?.message || "id não retornado"}`);

        // Ad — vinculado ao conjunto correto
        const adRes = await supabase.functions.invoke("meta-ads-ads", {
          body: {
            tenant_id,
            action: "create",
            ad_account_id: adAccountId,
            meta_adset_id: metaAdsetIdForAd,
            meta_campaign_id: metaCampaignId,
            name: `[AI] Ad ${creative.creative_index + 1} - ${campaignName.replace(/^\[AI\]\s*/, "")}`,
            creative_id: adCreativeData.id,
            status: scheduling.status,
          },
        });
        if (adRes.error || !adRes.data?.success) {
          throw new Error(adRes.error?.message || adRes.data?.error || "Falha ao criar anúncio.");
        }
        createdAdIds.push({
          creative_index: creative.creative_index,
          meta_ad_id: adRes.data?.data?.meta_ad_id || null,
          meta_adset_id: metaAdsetIdForAd,
        });
      } catch (e: any) {
        console.error(`[publish-proposal][${VERSION}] creative ${creative.creative_index} failed:`, e?.message);
        createdAdIds.push({
          creative_index: creative.creative_index,
          meta_ad_id: null,
          meta_adset_id: metaAdsetIdForAd,
          error: String(e?.message || e),
        });
      }
    }

    // Paridade total: só consideramos "publicada" se TODOS os criativos prontos
    // viraram anúncio na Meta. Qualquer falha (parcial ou total) reabre a proposta
    // na fila "Aguardando Ação" — sem limbo invisível.
    const successAds = createdAdIds.filter(a => a.meta_ad_id).length;
    const expectedAds = readyCreatives.length;
    let allOk = successAds > 0 && successAds === expectedAds;

    // Frente 4 — Conferência pós-publicação contra a Meta.
    // Antes de declarar "publicada", consulta a Meta e confere quantos anúncios
    // ATIVOS existem em cada conjunto. Se divergir do esperado, marca paridade
    // como falha e devolve a proposta para a fila com mensagem clara.
    const parityCheck: any = { ran: false, adsets: [], lifecycle: null };
    let parityMismatch: string | null = null;
    if (allOk) {
      parityCheck.ran = true;
      const expectedByAdset = new Map<string, number>();
      for (const ad of createdAdIds) {
        if (ad.meta_ad_id && ad.meta_adset_id) {
          expectedByAdset.set(ad.meta_adset_id, (expectedByAdset.get(ad.meta_adset_id) || 0) + 1);
        }
      }
      for (const [adsetId, expected] of expectedByAdset.entries()) {
        try {
          const r = await fetch(
            `https://graph.facebook.com/v21.0/${adsetId}/ads?fields=id,effective_status&limit=200&access_token=${encodeURIComponent(metaConn.access_token)}`,
          );
          const j = await r.json();
          const ids = Array.isArray(j?.data) ? j.data.map((x: any) => x.id).filter(Boolean) : [];
          parityCheck.adsets.push({ meta_adset_id: adsetId, expected, found: ids.length, ad_ids: ids });
          if (ids.length < expected) {
            parityMismatch = `Conjunto ${adsetId}: esperado ${expected} anúncio(s), Meta confirmou ${ids.length}.`;
          }
        } catch (e: any) {
          parityCheck.adsets.push({ meta_adset_id: adsetId, expected, error: e?.message || String(e) });
          parityMismatch = `Não foi possível confirmar com a Meta os anúncios do conjunto ${adsetId}.`;
        }
      }
      // Conferência do ciclo de vida do cliente: lê o campo de volta na Meta.
      // Se a flag foi enviada mas a Meta retornou false (sem audiência base válida,
      // por exemplo), registramos como aviso — sem reabrir a proposta, porque a
      // campanha em si está válida; só essa otimização específica não engatou.
      if (effectiveAcq === "new_customers" && supportsAcq) {
        try {
          const cr = await fetch(
            `https://graph.facebook.com/v21.0/${metaCampaignId}?fields=is_new_customer_acquisition&access_token=${encodeURIComponent(metaConn.access_token)}`,
          );
          const cj = await cr.json();
          const applied = cj?.is_new_customer_acquisition === true;
          parityCheck.lifecycle = {
            requested: "new_customers",
            applied,
            audience_used: lifecycleAudienceUsed,
          };
          if (!applied && !lifecycleNotice) {
            lifecycleNotice =
              "A Meta aceitou a campanha mas não ativou \"Conquistar novos clientes\". Verifique se há uma audiência de compradores na conta e se a campanha tem objetivo Vendas.";
          }
        } catch (e: any) {
          parityCheck.lifecycle = { requested: "new_customers", error: e?.message || String(e) };
        }
      }
      if (parityMismatch) {
        allOk = false;
      }
    }

    const finalStatus = allOk ? "campaign_implemented" : "campaign_implementation_failed";
    const nowIso = new Date().toISOString();
    const failureDetail = !allOk
      ? (parityMismatch
          ? `Conferência com a Meta falhou: ${parityMismatch}`
          : createdAdIds.filter(a => !a.meta_ad_id).map(a => `Anúncio ${a.creative_index + 1}: ${a.error || "falhou"}`).join(" | "))
      : null;

    if (!allOk) {
      await pauseMetaObjects(metaConn.access_token, metaCampaignId, createdAdsetIds);
      console.log(`[publish] Campanha ${metaCampaignId} e ${createdAdsetIds.length} conjunto(s) pausados após falha em anúncios.`);
    }


    await supabase.from("ads_autopilot_actions").update({
      // Sucesso total → executed e sai da fila.
      // Qualquer falha → volta para pending_approval para o lojista tentar de novo.
      status: allOk ? "executed" : "pending_approval",
      executed_at: allOk ? nowIso : null,
      approved_at: allOk ? action.approved_at : null,
      action_data: {
        ...propData,
        lifecycle: {
          ...lifecycle,
          status: finalStatus,
          version: "h5_v1",
          published_at: allOk ? nowIso : null,
          failed_at: allOk ? null : nowIso,
          failure_code: allOk ? null : (parityMismatch ? "meta_parity_mismatch" : (successAds === 0 ? "all_ads_failed" : "partial_ads_failed")),
          parity_check: parityCheck,

          failure_message_pt: allOk ? null : (failureDetail || "Falha ao publicar todos os anúncios na Meta."),
          meta_campaign_id: metaCampaignId,
          meta_adset_ids: createdAdsetIds,
          ads_created: createdAdIds,
          rollback_paused: allOk ? false : true,
          scheduled_start_time: scheduling.start_time || null,
          scheduling_mode: scheduling.start_time ? "scheduled_next_window" : "immediate",
          events: [
            ...(Array.isArray(lifecycle.events) ? lifecycle.events : []),
            ...uploadEvents.map(ev => ({
              kind: ev.mode === "url" ? "adimage_upload_fallback_url" : "adimage_upload_binary",
              ts: ev.ts,
              creative_index: ev.creative_index,
              image_hash: ev.image_hash,
              ...(ev.fallback_reason ? { fallback_reason: ev.fallback_reason } : {}),
            })),
          ],
        },
      },
      rollback_data: {
        meta_campaign_id: metaCampaignId,
        meta_adset_ids: createdAdsetIds,
        meta_ad_ids: createdAdIds.filter(a => a.meta_ad_id).map(a => a.meta_ad_id),
      },
    }).eq("id", action_id);

    // Insight visível
    await supabase.from("ads_autopilot_insights").insert({
      tenant_id,
      channel: action.channel || "meta",
      ad_account_id: adAccountId,
      title: allOk ? "🚀 Campanha publicada na Meta" : "⚠️ Falha ao publicar campanha",
      body: allOk
        ? `"${campaignName}" foi publicada com ${successAds} anúncio(s) em ${createdAdsetIds.length} conjunto(s)${scheduling.start_time ? ` e iniciará às 00:01 (horário de Brasília) do próximo dia` : " (ativa imediatamente)"}.`
        : `Não foi possível publicar "${campaignName}" (${successAds}/${expectedAds} anúncios). ${failureDetail || ""} A proposta voltou para a fila para nova tentativa.`,
      category: "strategy",
      priority: allOk ? "medium" : "high",
      sentiment: allOk ? "positive" : "negative",
      status: "open",
    });

    return new Response(JSON.stringify({
      success: allOk,
      error_pt: allOk ? undefined : (failureDetail || "Falha ao publicar todos os anúncios."),
      data: {
        lifecycle_status: finalStatus,
        meta_campaign_id: metaCampaignId,
        meta_adset_ids: createdAdsetIds,
        ads: createdAdIds,
        scheduled_start_time: scheduling.start_time || null,
        success_count: successAds,
        total_creatives: expectedAds,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[publish-proposal][${VERSION}] fatal:`, err?.message);
    // Anti-limbo: garante que erro inesperado também devolve a proposta para a fila.
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { action_id } = await req.clone().json().catch(() => ({}));
      if (action_id) {
        await sb.from("ads_autopilot_actions").update({
          status: "pending_approval",
          approved_at: null,
        }).eq("id", action_id).eq("status", "approved");
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error_pt: `Erro inesperado: ${err?.message || err}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function markFailed(
  supabase: any,
  action_id: string,
  propData: any,
  lifecycle: any,
  code: string,
  message: string,
  extra: any = {},
) {
  // Anti-limbo: reabre a proposta na fila com lifecycle de falha.
  await supabase.from("ads_autopilot_actions").update({
    status: "pending_approval",
    approved_at: null,
    action_data: {
      ...propData,
      lifecycle: {
        ...lifecycle,
        status: "campaign_implementation_failed",
        version: "h5_v1",
        failed_at: new Date().toISOString(),
        failure_code: code,
        failure_message_pt: message,
        ...extra,
      },
    },
  }).eq("id", action_id);
}

