/**
 * video-engine.ts — Motor Único de Geração de Vídeo
 * 
 * Classificador de intenção por keywords + cascata de fallback por qualidade.
 * Todos os módulos devem importar `resilientVideoGenerate()` daqui.
 * 
 * Cascata:
 * 1. Kling v3 Pro I2V (product_showcase, ugc_scene) — melhor fidelidade
 * 2. Veo 3.1 (narrated, text_only) — áudio nativo
 * 3. Wan 2.6 I2V (draft, fallback) — econômico
 */

import { getCredential } from "./platform-credentials.ts";
import {
  generateVideoWithFal,
  type VideoTier,
  type FalVideoResult,
} from "./fal-client.ts";

// ==================== TYPES ====================

export type VideoIntent =
  | "product_showcase"
  | "ugc_scene"
  | "narrated"
  | "creative_vfx"
  | "text_only"
  | "draft";

export interface VideoGenerateRequest {
  prompt: string;
  referenceImageUrl?: string;
  duration?: string; // "5" | "10"
  aspectRatio?: string; // "9:16" | "16:9" | "1:1"
  resolution?: string; // "720p" | "1080p"
  generateAudio?: boolean;
  timeoutMs?: number;
}

export interface VideoGenerateResult {
  videoUrl: string;
  intent: VideoIntent;
  selectedModel: string;
  actualProvider: string;
  fallbackReason?: string;
  contentType?: string;
  fileSize?: number;
  duration?: number;
}

// ==================== INTENT CLASSIFIER ====================

const INTENT_KEYWORDS: Record<VideoIntent, string[]> = {
  product_showcase: [
    "girando", "rotação", "showcase", "360", "spinning", "rotating",
    "produto girando", "girar", "mesa giratória", "turntable",
    "zoom", "close-up", "detalhe", "embalagem", "rótulo",
  ],
  ugc_scene: [
    "pessoa", "segurando", "usando", "ugc", "mão", "mãos",
    "unboxing", "review", "demonstração", "demo", "aplicando",
    "mostrando", "holding", "using", "person",
  ],
  narrated: [
    "narração", "narrando", "fala", "áudio", "voz", "falando",
    "narrated", "voice", "audio", "speaking", "som", "música",
    "comentário", "explicação", "narrador",
  ],
  creative_vfx: [
    "mascote", "personagem", "animação", "animado", "cartoon",
    "efeito", "efeitos", "vfx", "explosão", "partícula", "partículas",
    "cinematic", "cinematográfico", "fantasia", "mágico", "magia",
    "futurista", "neon", "holográfico", "3d", "motion graphics",
    "character", "mascot", "animated", "fantasy", "magical",
    "glitch", "transição", "transition", "sparks", "faíscas",
    "fumaça", "smoke", "fogo", "fire", "raio", "lightning",
  ],
  text_only: [],
  draft: [
    "teste", "rascunho", "rápido", "draft", "test", "quick",
    "preview", "protótipo", "econômico", "barato",
  ],
};

/**
 * Classifica a intenção do prompt do usuário com base em keywords.
 * Retorna o intent com maior pontuação de match.
 */
export function classifyIntent(
  prompt: string,
  hasReferenceImage: boolean,
): VideoIntent {
  if (!prompt || prompt.trim().length === 0) {
    return hasReferenceImage ? "product_showcase" : "text_only";
  }

  const promptLower = prompt.toLowerCase();
  const scores: Record<VideoIntent, number> = {
    product_showcase: 0,
    ugc_scene: 0,
    narrated: 0,
    creative_vfx: 0,
    text_only: 0,
    draft: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (promptLower.includes(kw)) {
        scores[intent as VideoIntent]++;
      }
    }
  }

  // Find highest scoring intent
  let bestIntent: VideoIntent = hasReferenceImage ? "product_showcase" : "text_only";
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as VideoIntent;
    }
  }

  return bestIntent;
}

// ==================== MODEL SELECTOR ====================

/**
 * Mapeia intent → tier (modelo) ideal + fallback.
 */
function getModelCascade(
  intent: VideoIntent,
  hasReferenceImage: boolean,
): VideoTier[] {
  switch (intent) {
    case "product_showcase":
      // Kling v3 (melhor fidelidade) → Wan 2.6 (econômico)
      return ["premium", "economic"];

    case "ugc_scene":
      // Kling v3 (composição pessoa+produto) → Wan 2.6
      return ["premium", "economic"];

    case "narrated":
      // Veo 3.1 (áudio nativo) → Kling + TTS externo
      return hasReferenceImage
        ? ["audio_native", "premium", "economic"]
        : ["audio_native", "economic"];

    case "text_only":
      // Veo 3.1 (text-to-video) → Wan 2.6 T2V
      return ["audio_native", "economic"];

    case "draft":
      // Wan 2.6 direto (sem fallback caro)
      return ["economic"];

    default:
      return hasReferenceImage ? ["premium", "economic"] : ["audio_native", "economic"];
  }
}

// ==================== RESILIENT GENERATE ====================

/**
 * Motor principal de geração de vídeo com classificação automática e fallback.
 * 
 * Fluxo:
 * 1. Classifica intenção do prompt
 * 2. Seleciona cascata de modelos
 * 3. Tenta cada modelo na ordem
 * 4. Retorna resultado + metadados de observabilidade
 */
export async function resilientVideoGenerate(
  supabaseUrl: string,
  supabaseServiceKey: string,
  request: VideoGenerateRequest,
): Promise<VideoGenerateResult> {
  const logPrefix = "[video-engine]";
  
  // Get API key
  const falApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "FAL_API_KEY");
  if (!falApiKey) {
    throw new Error("FAL_API_KEY não configurada");
  }

  const hasReference = !!request.referenceImageUrl;
  const intent = classifyIntent(request.prompt, hasReference);
  const cascade = getModelCascade(intent, hasReference);

  console.log(`${logPrefix} Intent: ${intent}, hasRef: ${hasReference}, cascade: [${cascade.join(", ")}]`);

  const tierLabels: Record<VideoTier, string> = {
    premium: "Kling v3 Pro I2V",
    audio_native: "Veo 3.1",
    economic: "Wan 2.6 I2V",
  };

  let lastError = "";

  for (let i = 0; i < cascade.length; i++) {
    const tier = cascade[i];
    const modelLabel = tierLabels[tier];
    const isFallback = i > 0;

    console.log(`${logPrefix} Trying tier ${i + 1}/${cascade.length}: ${modelLabel}${isFallback ? " (fallback)" : ""}`);

    try {
      const result = await generateVideoWithFal(falApiKey, {
        tier,
        prompt: request.prompt,
        startImageUrl: request.referenceImageUrl || "",
        duration: request.duration || "5",
        generateAudio: tier === "audio_native" ? (request.generateAudio ?? true) : false,
        aspectRatio: request.aspectRatio || "16:9",
        resolution: request.resolution || "1080p",
      });

      if (result?.videoUrl) {
        console.log(`${logPrefix} ✅ Success with ${modelLabel}${isFallback ? ` (fallback from ${tierLabels[cascade[0]]})` : ""}`);
        return {
          videoUrl: result.videoUrl,
          intent,
          selectedModel: modelLabel,
          actualProvider: `fal-ai/${tier}`,
          fallbackReason: isFallback ? `${tierLabels[cascade[0]]} failed: ${lastError}` : undefined,
          contentType: result.contentType,
          fileSize: result.fileSize,
          duration: result.duration,
        };
      }

      lastError = "No video URL returned";
      console.warn(`${logPrefix} ${modelLabel} returned no video, trying next...`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`${logPrefix} ${modelLabel} failed:`, lastError);
    }
  }

  throw new Error(`All video models failed. Last error: ${lastError}`);
}
