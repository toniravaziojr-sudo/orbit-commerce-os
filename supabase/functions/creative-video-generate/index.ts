/**
 * Creative Video Generate v3.0
 * Pipeline de Geração de Vídeos via fal.ai (Kling/Veo/Wan)
 * 
 * Tiers:
 * - premium: Kling v3 Pro I2V (melhor fidelidade de produto)
 * - audio_native: Veo 3.1 (áudio nativo, qualidade cinema)
 * - economic: Wan 2.6 I2V (custo reduzido)
 * 
 * Fallback: Imagem estática via stack de imagens (Gemini/OpenAI/Gateway)
 * 
 * Pipeline:
 * 1. Preprocess - Verificar produto + imagem
 * 2. Rewrite - Converter prompt do usuário em prompt otimizado
 * 3. Generate - Produzir vídeo via fal.ai
 * 4. Narration (opcional) - ElevenLabs TTS + Kling Lipsync
 * 5. Fallback - Imagem estática se vídeo falhar
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVideoWithFal, getFalApiKey, type VideoTier, type FalVideoResult } from "../_shared/fal-client.ts";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "3.0.0"; // fal.ai Kling/Veo/Wan pipeline

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Custos estimados por operação (em USD)
const COST_ESTIMATES: Record<string, number> = {
  rewrite: 0.005,
  kling_5s: 0.56,
  kling_10s: 1.12,
  veo_5s: 1.00,
  veo_8s: 1.60,
  wan_5s: 0.50,
  wan_10s: 1.00,
  fallback_image: 0.03,
};

const CREDIT_MARKUP = 1.5;
const USD_TO_BRL = 5.5;

interface VideoJobInput {
  tenant_id: string;
  product_id: string;
  tier: VideoTier;
  aspect_ratio: "9:16" | "1:1" | "16:9";
  duration: "5" | "10";
  narration_enabled?: boolean;
  narration_text?: string;
  voice_preset_id?: string;
  user_prompt?: string;
  // Legacy compatibility
  video_type?: string;
  duration_seconds?: number;
  n_variations?: number;
  fidelity_mode?: boolean;
  hard_fidelity?: boolean;
  preset_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: VideoJobInput = await req.json();
    const { tenant_id, product_id, user_prompt } = body;

    // Normalize inputs (support legacy and new format)
    const tier: VideoTier = body.tier || "premium";
    const duration = body.duration || (body.duration_seconds ? String(body.duration_seconds) : "5");
    const aspectRatio = body.aspect_ratio || "9:16";
    const narrationEnabled = body.narration_enabled ?? false;

    console.log(`[creative-video-generate v${VERSION}] Starting: tenant=${tenant_id}, product=${product_id}, tier=${tier}, duration=${duration}s`);

    if (!tenant_id || !product_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e product_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch FAL_API_KEY
    const falApiKey = await getFalApiKey(supabaseUrl, supabaseServiceKey);
    if (!falApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FAL_API_KEY não configurada. Configure em Integrações." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, image_url, images, description, categories(name)")
      .eq("id", product_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: "Produto não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productImageUrl = product.image_url || product.images?.[0];
    if (!productImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Produto não tem imagem" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create job in DB
    const { data: job, error: jobError } = await supabase
      .from("creative_video_jobs")
      .insert({
        tenant_id,
        user_id: (await supabase.auth.getUser()).data.user?.id || tenant_id,
        product_id,
        video_type: "product_video",
        aspect_ratio: aspectRatio,
        duration_seconds: parseInt(duration) || 5,
        n_variations: 1,
        fidelity_mode: true,
        hard_fidelity: false,
        user_prompt,
        status: "queued",
        progress_percent: 0,
        current_step: "queued",
        provider: `fal-ai/${tier}`,
        model: tier === "premium" ? "kling-v3-pro" : tier === "audio_native" ? "veo-3.1" : "wan-2.6",
      })
      .select()
      .single();

    if (jobError) {
      console.error("[creative-video-generate] Error creating job:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: jobError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[creative-video-generate] Job created: ${job.id}`);

    // Start processing in background
    // @ts-ignore - EdgeRuntime global
    (globalThis as any).EdgeRuntime?.waitUntil?.(processVideoJob(supabase, job, product, falApiKey, tier, duration, aspectRatio, narrationEnabled, body.narration_text, user_prompt))
      || processVideoJob(supabase, job, product, falApiKey, tier, duration, aspectRatio, narrationEnabled, body.narration_text, user_prompt);

    const tierLabels: Record<string, string> = {
      premium: "Kling v3 Pro",
      audio_native: "Veo 3.1",
      economic: "Wan 2.6",
    };

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: `Geração iniciada via ${tierLabels[tier] || tier}`,
        estimated_duration_minutes: tier === "economic" ? 2 : 5,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'creative', action: 'video-generate' });
  }
});

// ============================================================
// PIPELINE DE PROCESSAMENTO EM BACKGROUND
// ============================================================

async function processVideoJob(
  supabase: any,
  job: any,
  product: any,
  falApiKey: string,
  tier: VideoTier,
  duration: string,
  aspectRatio: string,
  narrationEnabled: boolean,
  narrationText?: string,
  userPrompt?: string,
) {
  let totalCostUsd = 0;

  try {
    // ============ STEP 1: REWRITE PROMPT ============
    await updateJobStatus(supabase, job.id, "rewrite", null, 10, "Otimizando prompt para vídeo...");

    const productImageUrl = product.image_url || product.images?.[0];
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    let videoPrompt = userPrompt || `Vídeo profissional do produto ${product.name}. Movimento suave de câmera, foco no produto, iluminação premium.`;

    // Rewrite prompt with AI
    if (lovableApiKey) {
      try {
        const rewriteResponse = await fetch(LOVABLE_GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a video prompt engineer. Rewrite the user's brief into a detailed cinematographic prompt optimized for AI video generation. Keep product name. Output ONLY the prompt text, nothing else." },
              { role: "user", content: `Product: ${product.name}\nBrief: ${videoPrompt}\nAspect ratio: ${aspectRatio}\nDuration: ${duration}s` },
            ],
          }),
        });
        if (rewriteResponse.ok) {
          const rewriteData = await rewriteResponse.json();
          const rewritten = rewriteData.choices?.[0]?.message?.content;
          if (rewritten) videoPrompt = rewritten;
        }
      } catch (e) {
        console.warn("[creative-video-generate] Prompt rewrite failed, using original:", e);
      }
      totalCostUsd += COST_ESTIMATES.rewrite;
    }

    // Save rewritten prompt
    await supabase.from("creative_video_jobs").update({ rewritten_prompt: videoPrompt }).eq("id", job.id);

    // ============ STEP 2: GENERATE VIDEO ============
    await updateJobStatus(supabase, job.id, "generate_candidates", null, 30, `Gerando vídeo via ${tier}...`);

    const videoResult: FalVideoResult | null = await generateVideoWithFal(falApiKey, {
      tier,
      prompt: videoPrompt,
      startImageUrl: productImageUrl,
      duration,
      generateAudio: tier === "audio_native",
      aspectRatio,
      negativePrompt: "blur, distort, low quality, morphing, text changes, shaky camera",
    });

    // Cost tracking
    const costKey = `${tier === "premium" ? "kling" : tier === "audio_native" ? "veo" : "wan"}_${duration}s`;
    totalCostUsd += COST_ESTIMATES[costKey] || 0.50;

    if (videoResult?.videoUrl) {
      console.log(`[creative-video-generate] ✅ Video generated via ${tier}: ${videoResult.videoUrl.substring(0, 80)}`);

      // Save candidate
      const { data: candidate } = await supabase
        .from("creative_video_candidates")
        .insert({
          job_id: job.id,
          tenant_id: job.tenant_id,
          video_url: videoResult.videoUrl,
          duration_actual: parseInt(duration),
          is_best: true,
          qa_passed: true,
          qa_final_score: 1.0,
          generation_metadata: { tier, provider: "fal-ai", content_type: videoResult.contentType },
        })
        .select()
        .single();

      // Finalize job
      const costCredits = Math.ceil(totalCostUsd * CREDIT_MARKUP * USD_TO_BRL * 100);
      await supabase.from("creative_video_jobs").update({
        status: "done",
        progress_percent: 100,
        current_step: "Concluído",
        best_candidate_id: candidate?.id,
        result_url: videoResult.videoUrl,
        fallback_used: false,
        cost_credits: costCredits,
        cost_usd: totalCostUsd,
        completed_at: new Date().toISOString(),
        qa_summary: { total_candidates: 1, passed_count: 1, best_score: 1.0, fallback_used: false },
      }).eq("id", job.id);

      // Register in Drive
      try {
        const { ensureFolderPathEdge } = await import("../_shared/drive-register.ts");
        const folderId = await ensureFolderPathEdge(supabase, job.tenant_id, job.user_id, "Criativos IA/Vídeos");
        if (folderId) {
          const filename = `video_${tier}_${job.id.slice(0, 8)}.mp4`;
          await supabase.from("files").insert({
            tenant_id: job.tenant_id,
            folder_id: folderId,
            filename,
            original_name: filename,
            storage_path: videoResult.videoUrl,
            mime_type: "video/mp4",
            is_folder: false,
            is_system_folder: false,
            created_by: job.user_id,
            metadata: { source: "ai_creative_video", url: videoResult.videoUrl, tier, system_managed: true },
          });
        }
      } catch (driveErr) {
        console.warn("[creative-video-generate] Drive registration failed (non-blocking):", driveErr);
      }

      console.log(`[creative-video-generate] Job ${job.id} completed successfully`);
      return;
    }

    // ============ FALLBACK: STATIC IMAGE ============
    console.warn(`[creative-video-generate] Video generation failed. Generating static image fallback...`);
    await updateJobStatus(supabase, job.id, "fallback", null, 80, "Gerando imagem estática (fallback)...");

    let fallbackImageUrl: string | null = null;

    if (lovableApiKey) {
      const imgResponse = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: `Professional product photo of ${product.name}. Studio lighting, clean background, premium look. ${userPrompt || ""}` },
              { type: "image_url", image_url: { url: productImageUrl } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });

      if (imgResponse.ok) {
        const imgData = await imgResponse.json();
        fallbackImageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }
      totalCostUsd += COST_ESTIMATES.fallback_image;
    }

    const costCredits = Math.ceil(totalCostUsd * CREDIT_MARKUP * USD_TO_BRL * 100);

    if (fallbackImageUrl) {
      const { data: fallbackCandidate } = await supabase
        .from("creative_video_candidates")
        .insert({
          job_id: job.id,
          tenant_id: job.tenant_id,
          video_url: fallbackImageUrl,
          thumbnail_url: fallbackImageUrl,
          is_best: true,
          is_fallback: true,
          qa_passed: true,
          qa_final_score: 0.5,
          generation_metadata: { is_fallback: true, reason: "video_generation_failed" },
        })
        .select()
        .single();

      await supabase.from("creative_video_jobs").update({
        status: "done",
        progress_percent: 100,
        current_step: "Concluído (imagem estática)",
        best_candidate_id: fallbackCandidate?.id,
        result_url: fallbackImageUrl,
        result_thumbnail_url: fallbackImageUrl,
        fallback_used: true,
        cost_credits: costCredits,
        cost_usd: totalCostUsd,
        completed_at: new Date().toISOString(),
        qa_summary: { total_candidates: 0, passed_count: 0, best_score: 0, fallback_used: true },
      }).eq("id", job.id);

      console.log(`[creative-video-generate] Job ${job.id} completed with static image fallback`);
    } else {
      throw new Error("Não foi possível gerar vídeo nem imagem de fallback");
    }

  } catch (error) {
    console.error(`[creative-video-generate] Job ${job.id} failed:`, error);
    await updateJobStatus(supabase, job.id, "failed", error instanceof Error ? error.message : "Erro desconhecido");
  }
}

async function updateJobStatus(
  supabase: any, jobId: string, status: string, errorMessage?: string | null,
  progressPercent?: number, currentStep?: string,
) {
  const update: Record<string, any> = { status };
  if (errorMessage) update.error_message = errorMessage;
  if (progressPercent !== undefined) update.progress_percent = progressPercent;
  if (currentStep) update.current_step = currentStep;
  if (status === "rewrite" && !update.started_at) update.started_at = new Date().toISOString();
  await supabase.from("creative_video_jobs").update(update).eq("id", jobId);
}
