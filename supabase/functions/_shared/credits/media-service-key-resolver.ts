/**
 * Media Service Key Resolver — Motor de Créditos v2 (Fase 3C)
 *
 * Mapeia o `model_id` interno usado pelos pipelines de mídia (creative-process,
 * media-generate-video) para a `service_key` canônica registrada em
 * `service_pricing`. É a ÚNICA tradução permitida — nada de inventar chaves.
 *
 * Função pura. Nunca lança. Retorna `null` quando não há pricing canônico
 * confiável (ex.: pixverse, f5-tts, sync-lipsync) — caller faz skip controlado.
 *
 * VERSÃO: 0.1.0
 */

export const MEDIA_RESOLVER_VERSION = "0.1.0" as const;

export type MediaResolverCategory = "ai_video" | "ai_image" | "ai_audio";

export interface MediaResolveResult {
  service_key: string;
  category: MediaResolverCategory;
  provider: string;
  unit: "second" | "image" | "request";
  units_json: Record<string, unknown>;
  /** seconds para vídeo, null para image/request */
  seconds: number | null;
}

export interface ResolveOpts {
  /** Duração real medida do vídeo, quando aplicável. */
  seconds?: number | null;
  /** Variante do veo (fast|standard|4k.standard) — default: fast.audio. */
  veoVariant?: "fast.audio" | "fast.noaudio" | "standard.audio" | "standard.noaudio" | "4k.standard.audio" | "4k.standard.noaudio";
  /** Resolução solicitada para imagens. Default: medium_1024. */
  imageQualityKey?: string;
}

/**
 * Resolve `model_id` interno (usado por `creative-process`) para `{service_key, units}`.
 * Retorna `null` quando não há pricing canônico seedado.
 */
export function resolveMediaServiceKey(
  modelId: string,
  opts: ResolveOpts = {},
): MediaResolveResult | null {
  if (!modelId || typeof modelId !== "string") return null;
  const id = modelId.toLowerCase().trim();
  const sec = typeof opts.seconds === "number" && opts.seconds > 0 ? Math.ceil(opts.seconds) : null;

  // ===== VÍDEO =====
  if (id === "kling-i2v-pro") {
    if (!sec) return null; // sem duração não dá pra cobrar por segundo com confiança
    return {
      service_key: "fal.kling-video.per_second.pro",
      category: "ai_video",
      provider: "fal",
      unit: "second",
      units_json: { seconds: sec, model_id: id },
      seconds: sec,
    };
  }

  if (id === "kling-avatar" || id === "kling-avatar-mascot-pro") {
    if (!sec) return null;
    return {
      service_key: "fal.kling-avatar-v2-pro.per_second",
      category: "ai_video",
      provider: "fal",
      unit: "second",
      units_json: { seconds: sec, model_id: id },
      seconds: sec,
    };
  }

  if (id === "veo31-text-video") {
    if (!sec) return null;
    const variant = opts.veoVariant || "fast.audio";
    return {
      service_key: `fal.veo-3.1.per_second.${variant}`,
      category: "ai_video",
      provider: "fal",
      unit: "second",
      units_json: { seconds: sec, model_id: id, variant },
      seconds: sec,
    };
  }

  // ===== IMAGEM (gpt-image-bg via fal) =====
  if (id === "gpt-image-bg") {
    const quality = opts.imageQualityKey || "medium_1024";
    return {
      service_key: `fal.gpt-image-1.5.per_image.${quality}`,
      category: "ai_image",
      provider: "fal",
      unit: "image",
      units_json: { images: 1, model_id: id, quality },
      seconds: null,
    };
  }

  // ===== SEM PRICING CANÔNICO (pixverse, f5-tts, sync-lipsync, kling-avatar-mascot-std) =====
  return null;
}

/**
 * Lista de model_ids reconhecidos mas sem pricing canônico — uteis para log
 * estruturado de skip.
 */
export const UNPRICED_MEDIA_MODELS = new Set<string>([
  "pixverse-swap-person",
  "pixverse-swap-bg",
  "f5-tts",
  "sync-lipsync",
  "kling-avatar-mascot-std",
]);
