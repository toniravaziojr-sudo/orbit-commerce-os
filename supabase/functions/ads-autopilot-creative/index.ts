import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial: Autopilot creative generation bridge
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
    } = body;

    if (!tenant_id) return fail("tenant_id é obrigatório");
    if (!product_id && !product_image_url) return fail("Produto ou imagem é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build prompt based on channel + objective
    const channelName = channel === "meta" ? "Meta (Facebook/Instagram)" : channel === "google" ? "Google Ads" : "TikTok Ads";
    
    const promptParts = [
      `Criativo publicitário para ${channelName}`,
      campaign_objective ? `Objetivo: ${campaign_objective}` : null,
      product_name ? `Produto: ${product_name}` : null,
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

    // Call creative-image-generate edge function
    const { data: result, error: invokeError } = await supabase.functions.invoke("creative-image-generate", {
      body: {
        tenant_id,
        product_id,
        product_name: product_name || "Produto",
        product_image_url,
        prompt: promptParts,
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

    if (invokeError) {
      console.error(`[ads-autopilot-creative][${VERSION}] creative-image-generate error:`, invokeError);
      
      // Update action status to failed if action_id provided
      if (action_id) {
        await supabase.from("ads_autopilot_actions").update({
          status: "failed",
          error_message: invokeError.message || "Erro na geração de criativos",
        }).eq("id", action_id);
      }
      
      return fail(invokeError.message || "Erro ao gerar criativos");
    }

    // Update action status to executed if action_id provided
    if (action_id) {
      await supabase.from("ads_autopilot_actions").update({
        status: "executed",
        executed_at: new Date().toISOString(),
        action_data: {
          job_id: result?.data?.job_id,
          channel,
          format,
          variations,
          generation_style: generationStyle,
        },
      }).eq("id", action_id);
    }

    console.log(`[ads-autopilot-creative][${VERSION}] Job created:`, result?.data?.job_id);

    return ok({
      job_id: result?.data?.job_id,
      status: result?.data?.status || "running",
      message: "Criativos sendo gerados. Acompanhe o progresso na lista de jobs.",
      channel,
      session_id,
    });
  } catch (err: any) {
    console.error(`[ads-autopilot-creative][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
