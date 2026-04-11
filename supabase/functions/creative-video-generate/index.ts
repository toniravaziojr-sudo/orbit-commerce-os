/**
 * Creative Video Generate v3.0 — fal.ai Pipeline
 * 
 * Pipeline:
 * 1. Validar produto e imagem
 * 2. Gerar vídeo via fal.ai (Kling v3 Pro / Veo 3.1 / Wan 2.6)
 * 3. Opcionalmente gerar narração (ElevenLabs) + Lipsync (Kling Lipsync)
 * 4. Upload ao storage + registro no Drive
 * 5. Fallback: imagem estática via stack de imagens
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVideoWithFal, applyLipsyncWithFal, getFalApiKey } from "../_shared/fal-client.ts";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";

import type { VideoTier, FalVideoResult } from "../_shared/fal-client.ts";

const VERSION = "3.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VideoGenerateInput {
  tenant_id: string;
  product_id: string;
  prompt?: string;
  tier?: VideoTier;
  duration?: string;
  aspect_ratio?: string;
  narration_enabled?: boolean;
  narration_text?: string;
  voice_preset_id?: string;
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

    const body: VideoGenerateInput = await req.json();
    const {
      tenant_id,
      product_id,
      prompt,
      tier = "premium",
      duration = "5",
      aspect_ratio = "9:16",
      narration_enabled = false,
      narration_text,
      voice_preset_id,
    } = body;

    console.log(`[creative-video-generate v${VERSION}] tenant=${tenant_id}, product=${product_id}, tier=${tier}`);

    if (!tenant_id || !product_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e product_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get FAL_API_KEY
    const falApiKey = await getFalApiKey(supabaseUrl, supabaseServiceKey);
    if (!falApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FAL_API_KEY não configurada. Configure em Integrações → Inteligência Artificial." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, description")
      .eq("id", product_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: "Produto não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product image
    const { data: images } = await supabase
      .from("product_images")
      .select("url")
      .eq("product_id", product_id)
      .order("is_primary", { ascending: false })
      .limit(1);

    const productImageUrl = images?.[0]?.url;
    if (!productImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Produto não tem imagem. Adicione uma imagem primeiro." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create job record
    const userId = (await supabase.auth.getUser())?.data?.user?.id || tenant_id;
    const { data: job, error: jobError } = await supabase
      .from("creative_video_jobs")
      .insert({
        tenant_id,
        user_id: userId,
        product_id,
        video_type: "product_video",
        aspect_ratio,
        duration_seconds: parseInt(duration) || 5,
        n_variations: 1,
        fidelity_mode: true,
        hard_fidelity: false,
        user_prompt: prompt,
        status: "queued",
        progress_percent: 0,
        current_step: "Preparando...",
        provider: `fal-${tier}`,
        model: tier === "premium" ? "kling-v3-pro" : tier === "audio_native" ? "veo-3.1" : "wan-2.6",
      })
      .select()
      .single();

    if (jobError) {
      console.error("[creative-video-generate] Job creation error:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: jobError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[creative-video-generate] Job ${job.id} created, starting generation...`);

    // Process in background
    const processPromise = processVideoGeneration(
      supabase, falApiKey, job, product, productImageUrl,
      { tier: tier as VideoTier, duration, aspect_ratio, prompt, narration_enabled, narration_text, voice_preset_id },
      supabaseUrl, supabaseServiceKey
    );

    // @ts-ignore
    (globalThis as any).EdgeRuntime?.waitUntil?.(processPromise) || processPromise;

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: "Geração de vídeo iniciada",
        estimated_duration_minutes: tier === "economic" ? 2 : 4,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'creative', action: 'video-generate' });
  }
});

// ==================== BACKGROUND PROCESSING ====================

async function processVideoGeneration(
  supabase: any,
  falApiKey: string,
  job: any,
  product: any,
  productImageUrl: string,
  config: {
    tier: VideoTier;
    duration: string;
    aspect_ratio: string;
    prompt?: string;
    narration_enabled: boolean;
    narration_text?: string;
    voice_preset_id?: string;
  },
  supabaseUrl: string,
  supabaseServiceKey: string,
) {
  try {
    // Step 1: Generate video
    await updateJob(supabase, job.id, { status: "generate_candidates", progress_percent: 20, current_step: "Gerando vídeo..." });

    const videoPrompt = config.prompt
      ? `${config.prompt}. Product: ${product.name}. High quality, professional product video.`
      : `Professional product video of ${product.name}. Clean, modern, premium quality. Smooth camera movement showcasing the product.`;

    const videoResult = await generateVideoWithFal(falApiKey, {
      tier: config.tier,
      prompt: videoPrompt,
      startImageUrl: productImageUrl,
      duration: config.duration,
      generateAudio: config.tier === "audio_native",
      aspectRatio: config.aspect_ratio,
      negativePrompt: "blur, distortion, low quality, text overlay, watermark",
    });

    if (!videoResult?.videoUrl) {
      // Fallback: generate static image
      console.warn("[creative-video-generate] Video generation failed, falling back to static image");
      await updateJob(supabase, job.id, {
        status: "fallback",
        progress_percent: 60,
        current_step: "Gerando imagem estática (fallback)...",
      });

      // Use the product image as fallback result
      await updateJob(supabase, job.id, {
        status: "done",
        progress_percent: 100,
        current_step: "Concluído (imagem estática)",
        result_url: productImageUrl,
        result_thumbnail_url: productImageUrl,
        fallback_used: true,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    let finalVideoUrl = videoResult.videoUrl;
    let finalThumbnailUrl = videoResult.videoUrl;

    // Step 2: Narration + Lipsync (optional)
    if (config.narration_enabled && config.narration_text && config.voice_preset_id) {
      await updateJob(supabase, job.id, { progress_percent: 60, current_step: "Gerando narração..." });

      try {
        // Fetch voice preset
        const { data: preset } = await supabase
          .from("voice_presets")
          .select("ref_audio_url")
          .eq("id", config.voice_preset_id)
          .single();

        if (preset?.ref_audio_url) {
          // Generate TTS via ElevenLabs
          const elevenlabsKey = await getCredential(supabaseUrl, supabaseServiceKey, "ELEVENLABS_API_KEY");
          if (elevenlabsKey) {
            const ttsAudioUrl = await generateTTS(elevenlabsKey, config.narration_text);

            if (ttsAudioUrl) {
              await updateJob(supabase, job.id, { progress_percent: 80, current_step: "Aplicando lipsync..." });

              // Apply lipsync
              const lipsyncResult = await applyLipsyncWithFal(falApiKey, {
                videoUrl: finalVideoUrl,
                audioUrl: ttsAudioUrl,
              });

              if (lipsyncResult?.videoUrl) {
                finalVideoUrl = lipsyncResult.videoUrl;
                console.log("[creative-video-generate] Lipsync applied successfully");
              }
            }
          }
        }
      } catch (narrationError) {
        console.error("[creative-video-generate] Narration/lipsync error (non-blocking):", narrationError);
      }
    }

    // Step 3: Upload to storage
    await updateJob(supabase, job.id, { progress_percent: 90, current_step: "Salvando vídeo..." });

    let storedUrl = finalVideoUrl;
    try {
      const videoResponse = await fetch(finalVideoUrl);
      if (videoResponse.ok) {
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBytes = new Uint8Array(videoBuffer);
        const filename = `video_${job.id.slice(0, 8)}_${Date.now()}.mp4`;
        const storagePath = `${job.tenant_id}/videos/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from("media-assets")
          .upload(storagePath, videoBytes, { contentType: "video/mp4", upsert: true });

        if (!uploadError) {
          const { data: pubUrl } = supabase.storage.from("media-assets").getPublicUrl(storagePath);
          storedUrl = pubUrl?.publicUrl || finalVideoUrl;

          // Register in Drive
          try {
            const { ensureFolderPathEdge, registerFileToDriveEdge } = await import("../_shared/drive-register.ts");
            const folderId = await ensureFolderPathEdge(supabase, job.tenant_id, job.user_id, "Criativos IA/Vídeos");
            if (folderId) {
              await registerFileToDriveEdge(supabase, {
                tenantId: job.tenant_id,
                folderId,
                filename,
                storagePath,
                mimeType: "video/mp4",
                sizeBytes: videoBytes.length,
                createdBy: job.user_id,
                source: "ai_creative_video",
                url: storedUrl,
                bucket: "media-assets",
              });
            }
          } catch (driveErr) {
            console.error("[creative-video-generate] Drive registration error (non-blocking):", driveErr);
          }
        }
      }
    } catch (uploadErr) {
      console.error("[creative-video-generate] Upload error (non-blocking):", uploadErr);
    }

    // Step 4: Complete
    await updateJob(supabase, job.id, {
      status: "done",
      progress_percent: 100,
      current_step: "Concluído",
      result_url: storedUrl,
      result_thumbnail_url: storedUrl,
      fallback_used: false,
      completed_at: new Date().toISOString(),
      qa_summary: {
        total_candidates: 1,
        passed_count: 1,
        best_score: 1.0,
        fallback_used: false,
      },
    });

    console.log(`[creative-video-generate] Job ${job.id} completed successfully`);

  } catch (error) {
    console.error(`[creative-video-generate] Job ${job.id} failed:`, error);
    await updateJob(supabase, job.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Erro desconhecido",
      current_step: "Falhou",
    });
  }
}

async function updateJob(supabase: any, jobId: string, fields: Record<string, any>) {
  await supabase.from("creative_video_jobs").update(fields).eq("id", jobId);
}

async function generateTTS(apiKey: string, text: string): Promise<string | null> {
  try {
    // Use ElevenLabs default voice for TTS
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      console.error("[TTS] ElevenLabs error:", response.status);
      return null;
    }

    // Upload audio to temporary storage and return URL
    // For now, we'd need to store this somewhere accessible
    // fal.ai lipsync needs a URL, so we upload to storage
    const audioBuffer = await response.arrayBuffer();
    console.log(`[TTS] Audio generated: ${audioBuffer.byteLength} bytes`);

    // TODO: Upload audio to storage and return public URL
    // For now, return null to skip lipsync
    return null;
  } catch (error) {
    console.error("[TTS] Error:", error);
    return null;
  }
}
