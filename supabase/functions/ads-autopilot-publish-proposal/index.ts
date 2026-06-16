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

const VERSION = "v1.0.0-h42";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (lifecycle.status !== "campaign_creatives_ready") {
      return new Response(JSON.stringify({
        success: false,
        error_pt: "Esta proposta ainda não está pronta para publicação. Aguarde a geração de todos os criativos.",
        current_lifecycle: lifecycle.status || null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const campaign = propData.campaign || {};
    const identity = propData.identity || {};
    const adsetsList = Array.isArray(propData.adsets) ? propData.adsets : [];
    const plannedCreatives = Array.isArray(propData.planned_creatives) ? propData.planned_creatives : [];
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

    // Carrega creative_jobs do banco para obter output_urls
    // Aceita tanto { job_id, creative_index } quanto { id, planned_creative_index }
    const jobIds = creativeJobsMeta.map((j: any) => j.job_id || j.id).filter(Boolean);
    const { data: jobs } = await supabase
      .from("creative_jobs")
      .select("id, status, output_urls, product_id, prompt")
      .in("id", jobIds.length > 0 ? jobIds : ["00000000-0000-0000-0000-000000000000"]);

    const readyCreatives: Array<{ creative_index: number; image_url: string; product_id: string | null; planned: any }> = [];
    for (const meta of creativeJobsMeta) {
      const jobId = meta.job_id || meta.id;
      const creativeIndex = (typeof meta.creative_index === "number") ? meta.creative_index : (meta.planned_creative_index ?? 0);
      const job = (jobs || []).find((j: any) => j.id === jobId);
      if (!job || job.status !== "succeeded") continue;
      const url = Array.isArray(job.output_urls) && job.output_urls.length > 0 ? job.output_urls[0] : null;
      if (!url) continue;
      const planned = plannedCreatives[creativeIndex] || {};
      readyCreatives.push({
        creative_index: creativeIndex,
        image_url: url,
        product_id: job.product_id || planned.product_id || null,
        planned,
      });
    }

    if (readyCreatives.length === 0) {
      return new Response(JSON.stringify({ success: false, error_pt: "Nenhum criativo gerado com sucesso para publicar." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    };
    if (scheduling.start_time) campaignBody.start_time = scheduling.start_time;

    const campaignRes = await supabase.functions.invoke("meta-ads-campaigns", { body: campaignBody });
    if (campaignRes.error || !campaignRes.data?.success) {
      const errMsg = campaignRes.error?.message || campaignRes.data?.error || "Falha ao criar campanha na Meta.";
      await markFailed(supabase, action_id, propData, lifecycle, "campaign_create_failed", errMsg);
      return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "campaign" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const metaCampaignId = campaignRes.data?.data?.meta_campaign_id;

    // ===== Step 2: Adset (primeiro adset da proposta) =====
    const adset0 = adsetsList[0] || {};
    const targeting: any = {
      geo_locations: adset0.geo_locations || { countries: ["BR"] },
      age_min: adset0.age_min || 18,
      age_max: adset0.age_max || 65,
    };
    if (Array.isArray(adset0.genders) && adset0.genders.length > 0) targeting.genders = adset0.genders;
    if (Array.isArray(adset0.publisher_platforms) && adset0.publisher_platforms.length > 0) {
      targeting.publisher_platforms = adset0.publisher_platforms;
    }
    if (Array.isArray(adset0.excluded_audience_ids) && adset0.excluded_audience_ids.length > 0) {
      targeting.excluded_custom_audiences = adset0.excluded_audience_ids.map((a: any) => ({ id: a.id || a }));
    }

    const optimizationGoal = adset0.optimization_goal || "OFFSITE_CONVERSIONS";
    const billingEvent = adset0.billing_event || "IMPRESSIONS";
    const conversionEvent = adset0.conversion_event || identity.conversion_event || "PURCHASE";

    const adsetBody: any = {
      tenant_id,
      action: "create",
      ad_account_id: adAccountId,
      meta_campaign_id: metaCampaignId,
      name: adset0.name || `${campaignName} - CJ 1`,
      optimization_goal: optimizationGoal,
      billing_event: billingEvent,
      targeting,
      status: scheduling.status,
    };
    if (scheduling.start_time) adsetBody.start_time = scheduling.start_time;
    if (identity.pixel_id) {
      adsetBody.promoted_object = { pixel_id: identity.pixel_id, custom_event_type: conversionEvent };
    }

    const adsetRes = await supabase.functions.invoke("meta-ads-adsets", { body: adsetBody });
    if (adsetRes.error || !adsetRes.data?.success) {
      const errMsg = adsetRes.error?.message || adsetRes.data?.error || "Falha ao criar conjunto na Meta.";
      await markFailed(supabase, action_id, propData, lifecycle, "adset_create_failed", errMsg, { meta_campaign_id: metaCampaignId });
      return new Response(JSON.stringify({ success: false, error_pt: errMsg, stage: "adset", meta_campaign_id: metaCampaignId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const metaAdsetId = adsetRes.data?.data?.meta_adset_id;

    // ===== Step 3: Para cada criativo pronto → upload imagem + adcreative + ad =====
    const accountIdClean = String(adAccountId).replace("act_", "");
    const createdAdIds: Array<{ creative_index: number; meta_ad_id: string | null; error?: string }> = [];

    // Resolve storeHost para destination_url quando não vier no planned
    const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenant_id).maybeSingle();
    const { data: primaryDomain } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenant_id).eq("is_primary", true).eq("status", "verified").maybeSingle();
    const storeHost = primaryDomain?.domain || `${tenantInfo?.slug}.shops.comandocentral.com.br`;

    for (const creative of readyCreatives) {
      try {
        // Upload imagem — estratégia binária (multipart) para não depender da
        // capability "image scraper" do app Meta. Fallback para URL caso o
        // download falhe por algum motivo transitório.
        let imageHash: string | null = null;
        let uploadMode: "binary" | "url" = "binary";
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
          console.warn(`[publish] Upload binário falhou, tentando URL: ${binErr?.message || binErr}`);
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
        console.log(`[publish] Imagem ${creative.creative_index + 1} enviada via ${uploadMode}, hash=${imageHash}`);

        // Destination URL com UTM
        let destinationUrl = creative.planned.destination_url || null;
        if (!destinationUrl) {
          let productSlug = "";
          if (creative.product_id) {
            const { data: prod } = await supabase.from("products").select("slug").eq("id", creative.product_id).maybeSingle();
            productSlug = prod?.slug || creative.product_id;
          }
          destinationUrl = productSlug ? `https://${storeHost}/produto/${productSlug}` : `https://${storeHost}`;
        }
        const utmBase = identity.utm_base || {};
        try {
          const u = new URL(destinationUrl);
          for (const [k, v] of Object.entries(utmBase)) {
            if (v && !u.searchParams.has(k)) u.searchParams.set(k, String(v));
          }
          destinationUrl = u.toString();
        } catch { /* ignore */ }

        const copyText = creative.planned.copy || creative.planned.primary_text || "Conheça nosso produto.";
        const headline = creative.planned.headline || campaign.name || "Confira";
        const ctaType = creative.planned.cta || identity.default_cta || "SHOP_NOW";

        const creativeBody = {
          name: `[AI] Creative ${creative.creative_index + 1} - ${new Date().toISOString().split("T")[0]}`,
          access_token: metaConn.access_token,
          object_story_spec: {
            page_id: identity.facebook_page_id,
            link_data: {
              message: copyText,
              name: headline,
              link: destinationUrl,
              image_hash: imageHash,
              call_to_action: { type: ctaType, value: { link: destinationUrl } },
            },
          },
        };

        const adCreativeRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creativeBody),
        });
        const adCreativeData = await adCreativeRes.json();
        if (!adCreativeData.id) throw new Error(`AdCreative: ${adCreativeData.error?.message || "id não retornado"}`);

        // Ad
        const adRes = await supabase.functions.invoke("meta-ads-ads", {
          body: {
            tenant_id,
            action: "create",
            ad_account_id: adAccountId,
            meta_adset_id: metaAdsetId,
            meta_campaign_id: metaCampaignId,
            name: `[AI] Ad ${creative.creative_index + 1} - ${campaignName.replace(/^\[AI\]\s*/, "")}`,
            creative_id: adCreativeData.id,
            status: scheduling.status,
          },
        });
        if (adRes.error || !adRes.data?.success) {
          throw new Error(adRes.error?.message || adRes.data?.error || "Falha ao criar anúncio.");
        }
        createdAdIds.push({ creative_index: creative.creative_index, meta_ad_id: adRes.data?.data?.meta_ad_id || null });
      } catch (e: any) {
        console.error(`[publish-proposal][${VERSION}] creative ${creative.creative_index} failed:`, e?.message);
        createdAdIds.push({ creative_index: creative.creative_index, meta_ad_id: null, error: String(e?.message || e) });
      }
    }

    const successAds = createdAdIds.filter(a => a.meta_ad_id).length;
    const finalStatus = successAds > 0 ? "campaign_implemented" : "campaign_implementation_failed";
    const nowIso = new Date().toISOString();

    await supabase.from("ads_autopilot_actions").update({
      status: successAds > 0 ? "executed" : "approved",
      executed_at: successAds > 0 ? nowIso : null,
      action_data: {
        ...propData,
        lifecycle: {
          ...lifecycle,
          status: finalStatus,
          version: "h42_v1",
          published_at: successAds > 0 ? nowIso : null,
          meta_campaign_id: metaCampaignId,
          meta_adset_id: metaAdsetId,
          ads_created: createdAdIds,
          scheduled_start_time: scheduling.start_time || null,
          scheduling_mode: scheduling.start_time ? "scheduled_next_window" : "immediate",
        },
      },
      rollback_data: {
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdsetId,
        meta_ad_ids: createdAdIds.filter(a => a.meta_ad_id).map(a => a.meta_ad_id),
      },
    }).eq("id", action_id);

    // Insight visível
    await supabase.from("ads_autopilot_insights").insert({
      tenant_id,
      channel: action.channel || "meta",
      ad_account_id: adAccountId,
      title: successAds > 0 ? "🚀 Campanha publicada na Meta" : "⚠️ Falha ao publicar campanha",
      body: successAds > 0
        ? `"${campaignName}" foi publicada com ${successAds} anúncio(s)${scheduling.start_time ? ` e iniciará às 00:01 (horário de Brasília) do próximo dia` : " (ativa imediatamente)"}.`
        : `Não foi possível publicar "${campaignName}". Tente novamente ou ajuste os criativos.`,
      category: "strategy",
      priority: successAds > 0 ? "medium" : "high",
      sentiment: successAds > 0 ? "positive" : "negative",
      status: "open",
    });

    return new Response(JSON.stringify({
      success: successAds > 0,
      data: {
        lifecycle_status: finalStatus,
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdsetId,
        ads: createdAdIds,
        scheduled_start_time: scheduling.start_time || null,
        success_count: successAds,
        total_creatives: readyCreatives.length,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[publish-proposal][${VERSION}] fatal:`, err?.message);
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
  await supabase.from("ads_autopilot_actions").update({
    action_data: {
      ...propData,
      lifecycle: {
        ...lifecycle,
        status: "campaign_implementation_failed",
        version: "h42_v1",
        failed_at: new Date().toISOString(),
        failure_code: code,
        failure_message_pt: message,
        ...extra,
      },
    },
  }).eq("id", action_id);
}
