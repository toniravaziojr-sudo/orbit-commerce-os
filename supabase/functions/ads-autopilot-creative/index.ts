import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.4.0"; // Accept copy/headline/creative_prompt as input, persist on asset
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-creative][${VERSION}] Request received`);

  try {
    const body = await req.json();
    const {
      tenant_id,
      session_id,
      action_id,
      channel,
      product_id,
      product_name,
      product_image_url,
      campaign_objective,
      target_audience,
      style_preference,
      format = "1:1",
      variations = 2,
      funnel_stage,
      strategy_run_id,
      // v1.4.0: Accept copy and creative prompt as input
      copy_text,
      headline,
      description,
      cta,
      creative_prompt,
    } = body;

    if (!tenant_id) return fail("tenant_id é obrigatório");
    if (!product_id && !product_image_url) return fail("Produto ou imagem é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auto-fetch product image if not provided
    let resolvedImageUrl = product_image_url;
    let resolvedProductName = product_name;
    if (!resolvedImageUrl && product_id) {
      const { data: productImages } = await supabase
        .from("product_images")
        .select("url")
        .eq("product_id", product_id)
        .order("sort_order", { ascending: true })
        .limit(1);
      
      if (productImages?.[0]?.url) {
        resolvedImageUrl = productImages[0].url;
        console.log(`[ads-autopilot-creative][${VERSION}] Auto-fetched product image: ${resolvedImageUrl.substring(0, 60)}...`);
      } else {
        // Try from products.images JSONB
        const { data: product } = await supabase
          .from("products")
          .select("images, name")
          .eq("id", product_id)
          .maybeSingle();
        
        if (product?.images) {
          const images = Array.isArray(product.images) ? product.images : [];
          const firstImg = images[0];
          resolvedImageUrl = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || null;
        }
        if (!resolvedProductName && product?.name) resolvedProductName = product.name;
      }
    }

    if (!resolvedImageUrl) return fail("Imagem do produto não encontrada");

    // Ensure Drive folder exists for traffic creatives
    const ADS_FOLDER_NAME = "Gestor de Tráfego IA";
    const { data: existingFolder } = await supabase
      .from("files")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("filename", ADS_FOLDER_NAME)
      .eq("is_folder", true)
      .maybeSingle();

    let folderId = existingFolder?.id || null;

    if (!folderId) {
      const { data: newFolder } = await supabase
        .from("files")
        .insert({
          tenant_id,
          folder_id: null,
          filename: ADS_FOLDER_NAME,
          original_name: ADS_FOLDER_NAME,
          storage_path: `${tenant_id}/gestor-trafego-ia/`,
          is_folder: true,
          is_system_folder: false,
          metadata: { source: "ads_autopilot", system_managed: true },
        })
        .select("id")
        .single();
      folderId = newFolder?.id || null;
      console.log(`[ads-autopilot-creative][${VERSION}] Created Drive folder: ${folderId}`);
    }

    // Build prompt based on channel + objective
    const channelName = channel === "meta" ? "Meta (Facebook/Instagram)" : channel === "google" ? "Google Ads" : "TikTok Ads";
    
    const promptParts = [
      `Criativo publicitário para ${channelName}`,
      campaign_objective ? `Objetivo: ${campaign_objective}` : null,
      resolvedProductName ? `Produto: ${resolvedProductName}` : null,
      target_audience ? `Público-alvo: ${target_audience}` : null,
      style_preference ? `Estilo: ${style_preference}` : null,
      "Visual impactante para anúncios pagos, cores vibrantes, contraste alto",
    ].filter(Boolean).join(". ");

    // Determine generation style based on channel
    const generationStyle = style_preference === "person_interacting" 
      ? "person_interacting" 
      : style_preference === "product_natural" 
        ? "product_natural" 
        : "promotional";

    // ===== v1.3.0: INSERT asset in ads_creative_assets BEFORE generation =====
    const assetMeta: Record<string, any> = {
      generation_style: generationStyle,
      source: "ads-autopilot-creative",
      version: VERSION,
      image_job_id: null, // Will be updated after invoke
      channel: channel || "meta",
      campaign_objective: campaign_objective || null,
      strategy_run_id: strategy_run_id || null,
    };

    const { data: newAsset, error: assetInsertErr } = await supabase
      .from("ads_creative_assets")
      .insert({
        tenant_id,
        channel: channel || "meta",
        product_id: product_id || null,
        funnel_stage: funnel_stage || null,
        session_id: session_id || null,
        status: "generating",
        format,
        aspect_ratio: format,
        // v1.4.0: Persist copy and headline on asset
        copy_text: copy_text || null,
        headline: headline || null,
        cta_type: cta || null,
        meta: {
          ...assetMeta,
          creative_prompt_ref: creative_prompt || null,
          copy_ref: copy_text ? "inline" : null,
          description: description || null,
        },
      })
      .select("id")
      .single();

    if (assetInsertErr) {
      console.error(`[ads-autopilot-creative][${VERSION}] Failed to insert asset record:`, assetInsertErr.message);
      // Non-blocking: continue with generation even if asset insert fails
    } else {
      console.log(`[ads-autopilot-creative][${VERSION}] Pre-created asset: ${newAsset.id} status=generating funnel=${funnel_stage || 'unset'}`);
    }

    // Call creative-image-generate edge function
    const { data: result, error: invokeError } = await supabase.functions.invoke("creative-image-generate", {
      body: {
        tenant_id,
        product_id,
        product_name: resolvedProductName || "Produto",
        product_image_url: resolvedImageUrl,
        prompt: promptParts,
        output_folder_id: folderId,
        asset_id: newAsset?.id || null, // Pass asset_id for direct update if supported
        settings: {
          providers: ["openai", "gemini"],
          generation_style: generationStyle,
          format,
          variations,
          enable_qa: true,
          enable_fallback: true,
          label_lock: true,
          style_config: {
            tone: campaign_objective === "sales" ? "premium" : "lifestyle",
            channel,
          },
        },
      },
    });

    // ===== v1.3.0: Handle invoke result — update asset with image_job_id or mark failed =====
    if (invokeError) {
      console.error(`[ads-autopilot-creative][${VERSION}] creative-image-generate error:`, invokeError);
      
      // Mark asset as failed
      if (newAsset?.id) {
        await supabase.from("ads_creative_assets").update({
          status: "failed",
          meta: { ...assetMeta, error: invokeError.message || "invoke_error" },
          updated_at: new Date().toISOString(),
        }).eq("id", newAsset.id);
      }

      // Update action status to failed if action_id provided
      if (action_id) {
        await supabase.from("ads_autopilot_actions").update({
          status: "failed",
          error_message: invokeError.message || "Erro na geração de criativos",
        }).eq("id", action_id);
      }
      
      return fail(invokeError.message || "Erro ao gerar criativos");
    }

    // v5.11.1 + v1.3.0: Check logical success (HTTP 200 but success=false)
    if (result?.success === false) {
      console.error(`[ads-autopilot-creative][${VERSION}] creative-image-generate logical failure: ${result?.error}`);
      
      if (newAsset?.id) {
        await supabase.from("ads_creative_assets").update({
          status: "failed",
          meta: { ...assetMeta, error: result?.error || "logical_failure" },
          updated_at: new Date().toISOString(),
        }).eq("id", newAsset.id);
      }

      if (action_id) {
        await supabase.from("ads_autopilot_actions").update({
          status: "failed",
          error_message: result?.error || "Creative generation failed (success=false)",
        }).eq("id", action_id);
      }

      return fail(result?.error || "Creative generation failed");
    }

    // ===== v1.3.0: Update asset with the CORRECT key: image_job_id =====
    const jobId = result?.data?.job_id;
    if (newAsset?.id && jobId) {
      await supabase.from("ads_creative_assets").update({
        meta: { ...assetMeta, image_job_id: jobId },
        updated_at: new Date().toISOString(),
      }).eq("id", newAsset.id);
      console.log(`[ads-autopilot-creative][${VERSION}] Asset ${newAsset.id} updated with image_job_id=${jobId}`);
    }

    // Update action status to executed if action_id provided
    if (action_id) {
      await supabase.from("ads_autopilot_actions").update({
        status: "executed",
        executed_at: new Date().toISOString(),
        action_data: {
          job_id: jobId,
          creative_job_id: jobId,
          asset_id: newAsset?.id || null,
          channel,
          format,
          variations,
          generation_style: generationStyle,
          product_name: resolvedProductName || "Produto",
          product_id,
          folder_name: ADS_FOLDER_NAME,
          campaign_objective,
          target_audience,
          funnel_stage: funnel_stage || null,
          strategy_run_id: strategy_run_id || null,
        },
      }).eq("id", action_id);
    }

    console.log(`[ads-autopilot-creative][${VERSION}] Job created: ${jobId}, asset_id=${newAsset?.id || 'none'}`);

    return ok({
      job_id: jobId,
      asset_id: newAsset?.id || null,
      status: result?.data?.status || "running",
      message: "Criativos sendo gerados. Acompanhe o progresso na lista de jobs.",
      channel,
      session_id,
      funnel_stage: funnel_stage || null,
    });
  } catch (err: any) {
    console.error(`[ads-autopilot-creative][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
