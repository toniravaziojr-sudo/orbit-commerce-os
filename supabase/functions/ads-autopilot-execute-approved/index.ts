import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v3.0.0"; // Propagate full campaign/adset params from action_data (placements, optimization, billing, bid_strategy, destination_url, conversion_event, geo_locations, excluded_audiences)

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-execute-approved][${VERSION}] Request received`);

  try {
    const { tenant_id, action_id } = await req.json();

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

    // Fetch the pending action (accept both pending_approval and approved statuses)
    const { data: action, error: fetchErr } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .in("status", ["pending_approval", "approved"])
      .maybeSingle();

    if (fetchErr || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Action not found or already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ads-autopilot-execute-approved][${VERSION}] Executing action ${action_id} type=${action.action_type}`);

    const data = action.action_data || {};
    const preview = data.preview || {};

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
      console.log(`[ads-autopilot-execute-approved][${VERSION}] Strategic plan approved, triggering implementation`);

      const planBody = data.diagnosis + "\n\n**Ações Planejadas:**\n" + (data.planned_actions || []).map((a: string) => `• ${a}`).join("\n");

      await supabase.from("ads_autopilot_insights").insert({
        tenant_id,
        channel: action.channel || "global",
        ad_account_id: data.ad_account_id || null,
        title: "✅ Plano Estratégico Aprovado",
        body: planBody,
        category: "strategy",
        priority: "high",
        sentiment: "positive",
        status: "open",
      });

      await supabase.from("ads_autopilot_actions")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", action_id);

      const { error: stratErr } = await supabase.functions.invoke("ads-autopilot-strategist", {
        body: { tenant_id, trigger: "implement_approved_plan" },
      });

      if (stratErr) console.error(`[ads-autopilot-execute-approved][${VERSION}] Strategist trigger error:`, stratErr.message);

      return new Response(
        JSON.stringify({ success: true, data: { type: "strategic_plan_approved" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== CREATE CAMPAIGN — Direct Meta API execution ======
    if (action.action_type === "create_campaign" && action.channel === "meta") {
      const adAccountId = data.ad_account_id;
      const campaignName = data.campaign_name || preview.campaign_name || "Nova Campanha IA";
      const dailyBudgetCents = data.daily_budget_cents || preview.daily_budget_cents || 0;
      const objective = data.objective || "conversions";

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
          // Get Meta connection for API calls
          const { data: metaConn } = await supabase
            .from("marketplace_connections")
            .select("access_token, metadata")
            .eq("tenant_id", tenant_id)
            .eq("marketplace", "meta")
            .eq("is_active", true)
            .maybeSingle();

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
