/**
 * fal-client.ts — Módulo centralizado para chamadas à fal.ai
 * 
 * STACK VISUAL v7.0:
 * IMAGENS: fal.ai FLUX 2 Pro → FLUX 2 Turbo → Gemini Nativa → OpenAI → Lovable Gateway
 * VÍDEOS:  Kling v3 Pro I2V | Veo 3.1 | Wan 2.6 I2V → fallback imagem estática
 * 
 * Endpoints fal.ai usam REST direto com polling (queue → status → result).
 * Autenticação: Header "Authorization: Key {FAL_API_KEY}"
 */

import { getCredential } from "./platform-credentials.ts";

// ==================== CONSTANTS ====================

const FAL_API_BASE = "https://queue.fal.run";
const FAL_RESULT_BASE = "https://queue.fal.run";
const FAL_STATUS_BASE = "https://queue.fal.run";

// Model IDs
export const FAL_MODELS = {
  // Imagens
  FLUX_2_PRO: "fal-ai/flux-2-pro",
  FLUX_2_TURBO: "fal-ai/flux-2",
  GPT_IMAGE_1_EDIT: "fal-ai/gpt-image-1/edit-image",

  // Vídeos
  KLING_V3_PRO_I2V: "fal-ai/kling-video/v3/pro/image-to-video",
  VEO_31: "fal-ai/veo3.1",
  VEO_31_REF_TO_VIDEO: "fal-ai/veo3.1/reference-to-video",
  WAN_26_I2V: "wan/v2.6/image-to-video",

  // Lipsync
  KLING_LIPSYNC: "fal-ai/kling-video/v1/pro/lip-sync",
} as const;

// Pricing reference (USD)
export const FAL_PRICING = {
  FLUX_2_PRO_PER_MPIXEL: 0.03,
  FLUX_2_TURBO_PER_MPIXEL: 0.012,
  KLING_V3_PRO_PER_SEC_AUDIO_OFF: 0.112,
  KLING_V3_PRO_PER_SEC_AUDIO_ON: 0.168,
  VEO_31_PER_SEC_NO_AUDIO_1080P: 0.20,
  VEO_31_PER_SEC_AUDIO_1080P: 0.40,
  WAN_26_PER_SEC_720P: 0.10,
  WAN_26_PER_SEC_1080P: 0.15,
};

// ==================== TYPES ====================

export interface FalImageRequest {
  prompt: string;
  imageSize?: { width: number; height: number } | string;
  seed?: number;
  outputFormat?: "jpeg" | "png";
  safetyTolerance?: number;
}

export interface FalImageResult {
  imageUrl: string;
  seed: number;
  width?: number;
  height?: number;
  contentType?: string;
}

export type VideoTier = "premium" | "audio_native" | "economic";

export interface FalVideoRequest {
  tier: VideoTier;
  prompt: string;
  startImageUrl: string;
  duration?: string;
  generateAudio?: boolean;
  aspectRatio?: string;
  resolution?: string;
  negativePrompt?: string;
  cfgScale?: number;
}

export interface FalVideoResult {
  videoUrl: string;
  contentType?: string;
  fileSize?: number;
  duration?: number;
}

export interface FalLipsyncRequest {
  videoUrl: string;
  audioUrl: string;
}

interface FalQueueResponse {
  request_id: string;
  status?: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  logs?: Array<{ message: string }>;
}

// ==================== CORE: QUEUE + POLL ====================

async function falApiKey(supabaseUrl: string, supabaseServiceKey: string): Promise<string | null> {
  return getCredential(supabaseUrl, supabaseServiceKey, "FAL_API_KEY");
}

function falHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Submete um request à fal.ai queue e retorna o request_id.
 */
async function submitToQueue(
  apiKey: string,
  modelId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const url = `${FAL_API_BASE}/${modelId}`;
  console.log(`[fal-client] Submitting to queue: ${modelId}`);

  const response = await fetch(url, {
    method: "POST",
    headers: falHeaders(apiKey),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fal-client] Queue submit error ${response.status}:`, errorText.substring(0, 500));
    throw new Error(`fal.ai queue submit failed (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data: FalQueueResponse = await response.json();
  if (!data.request_id) {
    throw new Error("fal.ai queue response missing request_id");
  }

  console.log(`[fal-client] Queued: ${data.request_id}`);
  return data.request_id;
}

/**
 * Poll status até COMPLETED ou FAILED.
 */
async function pollStatus(
  apiKey: string,
  modelId: string,
  requestId: string,
  timeoutMs: number = 300_000, // 5 min default
  pollIntervalMs: number = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = `${FAL_STATUS_BASE}/${modelId}/requests/${requestId}/status`;
    const response = await fetch(url, {
      method: "GET",
      headers: falHeaders(apiKey),
    });

    if (!response.ok) {
      console.warn(`[fal-client] Status poll error ${response.status}`);
      await sleep(pollIntervalMs);
      continue;
    }

    const status: FalStatusResponse = await response.json();
    console.log(`[fal-client] Status: ${status.status}`);

    if (status.status === "COMPLETED") return;
    if (status.status === "FAILED") {
      throw new Error("fal.ai generation failed");
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`fal.ai timeout after ${timeoutMs}ms`);
}

/**
 * Busca o resultado após COMPLETED.
 */
async function fetchResult<T>(
  apiKey: string,
  modelId: string,
  requestId: string,
): Promise<T> {
  const url = `${FAL_RESULT_BASE}/${modelId}/requests/${requestId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: falHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fal.ai result fetch failed (${response.status}): ${errorText.substring(0, 200)}`);
  }

  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== IMAGE GENERATION ====================

/**
 * Gera imagem com FLUX 2 Pro via fal.ai.
 * Retorna URL da imagem (hospedada na fal.ai, válida por tempo limitado).
 */
export async function generateImageWithFalPro(
  apiKey: string,
  request: FalImageRequest,
): Promise<FalImageResult | null> {
  try {
    console.log(`[fal-client] Generating image with FLUX 2 Pro...`);
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      image_size: request.imageSize || { width: 1024, height: 1024 },
      output_format: request.outputFormat || "jpeg",
      safety_tolerance: request.safetyTolerance ?? 2,
    };
    if (request.seed) input.seed = request.seed;

    const requestId = await submitToQueue(apiKey, FAL_MODELS.FLUX_2_PRO, input);
    await pollStatus(apiKey, FAL_MODELS.FLUX_2_PRO, requestId, 120_000);

    const result = await fetchResult<{
      images: Array<{ url: string; width?: number; height?: number; content_type?: string }>;
      seed: number;
    }>(apiKey, FAL_MODELS.FLUX_2_PRO, requestId);

    if (!result.images?.[0]?.url) {
      console.warn("[fal-client] FLUX 2 Pro returned no image");
      return null;
    }

    const img = result.images[0];
    console.log(`[fal-client] ✅ FLUX 2 Pro image generated: ${img.url.substring(0, 80)}...`);
    return {
      imageUrl: img.url,
      seed: result.seed,
      width: img.width,
      height: img.height,
      contentType: img.content_type,
    };
  } catch (error) {
    console.error("[fal-client] FLUX 2 Pro error:", error);
    return null;
  }
}

/**
 * Gera imagem com FLUX 2 Turbo (Dev) via fal.ai — fallback rápido.
 */
export async function generateImageWithFalTurbo(
  apiKey: string,
  request: FalImageRequest,
): Promise<FalImageResult | null> {
  try {
    console.log(`[fal-client] Generating image with FLUX 2 Turbo...`);
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      image_size: request.imageSize || { width: 1024, height: 1024 },
      output_format: request.outputFormat || "jpeg",
    };
    if (request.seed) input.seed = request.seed;

    const requestId = await submitToQueue(apiKey, FAL_MODELS.FLUX_2_TURBO, input);
    await pollStatus(apiKey, FAL_MODELS.FLUX_2_TURBO, requestId, 60_000);

    const result = await fetchResult<{
      images: Array<{ url: string; width?: number; height?: number; content_type?: string }>;
      seed: number;
    }>(apiKey, FAL_MODELS.FLUX_2_TURBO, requestId);

    if (!result.images?.[0]?.url) {
      console.warn("[fal-client] FLUX 2 Turbo returned no image");
      return null;
    }

    const img = result.images[0];
    console.log(`[fal-client] ✅ FLUX 2 Turbo image generated: ${img.url.substring(0, 80)}...`);
    return {
      imageUrl: img.url,
      seed: result.seed,
      width: img.width,
      height: img.height,
      contentType: img.content_type,
    };
  } catch (error) {
    console.error("[fal-client] FLUX 2 Turbo error:", error);
    return null;
  }
}

/**
 * Gera imagem com GPT Image 1 (edit-image) via fal.ai — image-to-image com referência.
 * PRIORIDADE MÁXIMA para cenários com imagem de referência (produto, criativo, etc.)
 * Aceita imagem(ns) de referência e gera variação fiel.
 */
export async function generateImageWithGptImage1(
  apiKey: string,
  prompt: string,
  referenceImageUrls: string[],
  size: 'auto' | '1024x1024' | '1536x1024' | '1024x1536' = '1024x1024',
): Promise<FalImageResult | null> {
  try {
    console.log(`[fal-client] Generating image with GPT Image 1 (edit-image)...`);
    const input: Record<string, unknown> = {
      prompt,
      image_urls: referenceImageUrls,
      size,
    };

    const requestId = await submitToQueue(apiKey, FAL_MODELS.GPT_IMAGE_1_EDIT, input);
    await pollStatus(apiKey, FAL_MODELS.GPT_IMAGE_1_EDIT, requestId, 120_000);

    const result = await fetchResult<{
      images: Array<{ url: string; width?: number; height?: number; content_type?: string }>;
    }>(apiKey, FAL_MODELS.GPT_IMAGE_1_EDIT, requestId);

    if (!result.images?.[0]?.url) {
      console.warn("[fal-client] GPT Image 1 returned no image");
      return null;
    }

    const img = result.images[0];
    console.log(`[fal-client] ✅ GPT Image 1 image generated: ${img.url.substring(0, 80)}...`);
    return {
      imageUrl: img.url,
      seed: 0,
      width: img.width,
      height: img.height,
      contentType: img.content_type,
    };
  } catch (error) {
    console.error("[fal-client] GPT Image 1 error:", error);
    return null;
  }
}

// ==================== VIDEO GENERATION ====================

/**
 * Gera vídeo com o tier especificado via fal.ai.
 * 
 * Tiers:
 * - premium: Kling v3 Pro I2V (melhor fidelidade de produto)
 * - audio_native: Veo 3.1 (áudio nativo, text-to-video ou reference-to-video)
 * - economic: Wan 2.6 I2V (custo reduzido)
 */
export async function generateVideoWithFal(
  apiKey: string,
  request: FalVideoRequest,
): Promise<FalVideoResult | null> {
  try {
    const tier = request.tier;
    let modelId: string;
    let input: Record<string, unknown>;
    let timeoutMs: number;

    switch (tier) {
      case "premium": {
        // Kling v3 Pro I2V
        modelId = FAL_MODELS.KLING_V3_PRO_I2V;
        input = {
          prompt: request.prompt,
          start_image_url: request.startImageUrl,
          duration: request.duration || "5",
          generate_audio: request.generateAudio ?? false,
          negative_prompt: request.negativePrompt || "blur, distort, and low quality",
          cfg_scale: request.cfgScale ?? 0.5,
        };
        timeoutMs = 600_000; // 10 min
        console.log(`[fal-client] Video tier: Premium (Kling v3 Pro I2V), duration: ${input.duration}s`);
        break;
      }
      case "audio_native": {
        // Veo 3.1 — text-to-video (não aceita start_image nativamente como I2V)
        // Se tiver imagem de referência, usa reference-to-video endpoint
        const hasImage = !!request.startImageUrl;
        modelId = hasImage ? FAL_MODELS.VEO_31_REF_TO_VIDEO : FAL_MODELS.VEO_31;

        if (hasImage) {
          input = {
            prompt: request.prompt,
            image_url: request.startImageUrl,
            duration: request.duration || "8s",
            resolution: request.resolution || "1080p",
            generate_audio: request.generateAudio ?? true,
            negative_prompt: request.negativePrompt || "",
            enable_prompt_expansion: true,
          };
        } else {
          input = {
            prompt: request.prompt,
            aspect_ratio: request.aspectRatio || "16:9",
            duration: request.duration || "8s",
            resolution: request.resolution || "1080p",
            generate_audio: request.generateAudio ?? true,
            negative_prompt: request.negativePrompt || "",
            auto_fix: true,
            safety_tolerance: "4",
          };
        }
        timeoutMs = 600_000; // 10 min
        console.log(`[fal-client] Video tier: Audio Native (Veo 3.1${hasImage ? " ref-to-video" : ""}), duration: ${input.duration}`);
        break;
      }
      case "economic": {
        // Wan 2.6 I2V
        modelId = FAL_MODELS.WAN_26_I2V;
        input = {
          prompt: request.prompt,
          image_url: request.startImageUrl,
          duration: request.duration || "5",
          resolution: request.resolution || "1080p",
          negative_prompt: request.negativePrompt || "low resolution, error, worst quality, low quality, defects",
          enable_prompt_expansion: true,
        };
        timeoutMs = 300_000; // 5 min
        console.log(`[fal-client] Video tier: Economic (Wan 2.6 I2V), duration: ${input.duration}s`);
        break;
      }
      default:
        throw new Error(`Unknown video tier: ${tier}`);
    }

    const requestId = await submitToQueue(apiKey, modelId, input);
    // Video generation is slower — use longer polling intervals
    await pollStatus(apiKey, modelId, requestId, timeoutMs, 5_000);

    const result = await fetchResult<{
      video?: { url: string; content_type?: string; file_size?: number };
    }>(apiKey, modelId, requestId);

    if (!result.video?.url) {
      console.warn(`[fal-client] ${modelId} returned no video`);
      return null;
    }

    console.log(`[fal-client] ✅ Video generated (${tier}): ${result.video.url.substring(0, 80)}...`);
    return {
      videoUrl: result.video.url,
      contentType: result.video.content_type,
      fileSize: result.video.file_size,
    };
  } catch (error) {
    console.error(`[fal-client] Video generation error (${request.tier}):`, error);
    return null;
  }
}

// ==================== LIPSYNC ====================

/**
 * Aplica lipsync ao vídeo usando Kling Lipsync via fal.ai.
 * Requer vídeo + áudio (TTS via ElevenLabs).
 */
export async function applyLipsyncWithFal(
  apiKey: string,
  request: FalLipsyncRequest,
): Promise<FalVideoResult | null> {
  try {
    console.log(`[fal-client] Applying lipsync...`);
    const input = {
      video_url: request.videoUrl,
      audio_url: request.audioUrl,
    };

    const requestId = await submitToQueue(apiKey, FAL_MODELS.KLING_LIPSYNC, input);
    await pollStatus(apiKey, FAL_MODELS.KLING_LIPSYNC, requestId, 300_000, 5_000);

    const result = await fetchResult<{
      video?: { url: string; content_type?: string; file_size?: number };
    }>(apiKey, FAL_MODELS.KLING_LIPSYNC, requestId);

    if (!result.video?.url) {
      console.warn("[fal-client] Lipsync returned no video");
      return null;
    }

    console.log(`[fal-client] ✅ Lipsync applied: ${result.video.url.substring(0, 80)}...`);
    return {
      videoUrl: result.video.url,
      contentType: result.video.content_type,
      fileSize: result.video.file_size,
    };
  } catch (error) {
    console.error("[fal-client] Lipsync error:", error);
    return null;
  }
}

// ==================== HELPER: GET API KEY ====================

/**
 * Obtém a FAL_API_KEY via platform_credentials ou env var.
 */
export async function getFalApiKey(
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<string | null> {
  return falApiKey(supabaseUrl, supabaseServiceKey);
}

/**
 * Download de uma imagem de URL e converte para base64.
 * Útil para integrar com o pipeline existente que espera base64.
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[fal-client] Image download failed: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Manual base64 encoding for Deno
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error("[fal-client] Image download error:", error);
    return null;
  }
}
