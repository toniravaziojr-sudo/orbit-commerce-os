/**
 * Image Service Key Resolver — Motor de Créditos v2 (shadow Fase 3B)
 *
 * Mapeia (provider, model, size, quality) → service_key existente em service_pricing
 * para o piloto shadow de IA Imagem.
 *
 * Escopo Fase 3B: APENAS Fal.AI/gpt-image-1.5.
 * Demais provedores retornam skip controlado (não erro).
 */

export interface ResolveImageKeyArgs {
  provider?: string | null;        // provider configurado
  actualProvider?: string | null;  // provider que efetivamente respondeu (do visual-engine)
  model?: string | null;
  size?: string | null;            // ex: "1024x1024", "1024x1536", "1536x1024"
  quality?: string | null;         // "low" | "medium" | "high"
  resolution?: string | null;      // alias para size
}

export interface ResolvedImageKey {
  resolved: true;
  service_key: string;
  category: "ai_image";
  provider: "fal";
  model: string;
  resolution: string;
  quality: string;
}

export interface SkippedImageKey {
  resolved: false;
  skip_reason:
    | "pricing_not_ready"
    | "legacy_provider_not_in_pilot"
    | "provider_out_of_pilot"
    | "size_out_of_pilot";
  detail: string;
}

export type ImageKeyResolution = ResolvedImageKey | SkippedImageKey;

function normalizeProvider(p?: string | null): string {
  return (p || "").toLowerCase().trim();
}

function normalizeSize(s?: string | null): string {
  if (!s) return "1024";
  const v = s.toLowerCase().replace(/\s+/g, "");
  if (v === "1024x1024") return "1024";
  if (v === "1024x1536") return "1024x1536";
  if (v === "1536x1024") return "1536x1024";
  if (v === "1024") return "1024";
  return v;
}

function normalizeQuality(q?: string | null): "low" | "medium" | "high" {
  const v = (q || "medium").toLowerCase();
  if (v === "low" || v === "high" || v === "medium") return v;
  return "medium";
}

/**
 * Service keys ativas em service_pricing (Fal.AI / gpt-image-1.5):
 *  - fal.gpt-image-1.5.per_image.low_1024
 *  - fal.gpt-image-1.5.per_image.low_other
 *  - fal.gpt-image-1.5.per_image.medium_1024
 *  - fal.gpt-image-1.5.per_image.medium_1024x1536
 *  - fal.gpt-image-1.5.per_image.medium_1536x1024
 *  - fal.gpt-image-1.5.per_image.high_1024
 *  - fal.gpt-image-1.5.per_image.high_1024x1536
 *  - fal.gpt-image-1.5.per_image.high_1536x1024
 */
export function resolveImageServiceKey(args: ResolveImageKeyArgs): ImageKeyResolution {
  const provider = normalizeProvider(args.actualProvider || args.provider);
  const model = (args.model || "").toLowerCase();
  const size = normalizeSize(args.size || args.resolution);
  const quality = normalizeQuality(args.quality);

  // Gemini / Nano Banana → pricing futuro
  if (provider.includes("gemini") || model.includes("gemini") || model.includes("nano-banana")) {
    return {
      resolved: false,
      skip_reason: "pricing_not_ready",
      detail: `Gemini/Nano Banana sem service_pricing ativo (provider=${provider}, model=${model}).`,
    };
  }

  // OpenAI legacy → fora do piloto inicial
  if (provider === "openai") {
    return {
      resolved: false,
      skip_reason: "legacy_provider_not_in_pilot",
      detail: `OpenAI legacy fora do piloto Fase 3B (provider=${provider}, model=${model}).`,
    };
  }

  // Fal.AI / gpt-image-1.5 → escopo do piloto
  const isFal = provider === "fal" || provider === "fal-ai" || provider.startsWith("fal");
  const isGptImage = model.includes("gpt-image-1.5") || model.includes("gpt-image-1");

  if (isFal && isGptImage) {
    let suffix: string;
    if (size === "1024") {
      suffix = `${quality}_1024`;
    } else if (size === "1024x1536" || size === "1536x1024") {
      // low não tem variantes retangulares: cair em low_other
      if (quality === "low") {
        suffix = "low_other";
      } else {
        suffix = `${quality}_${size}`;
      }
    } else {
      // tamanho fora das chaves catalogadas
      if (quality === "low") {
        suffix = "low_other";
      } else {
        return {
          resolved: false,
          skip_reason: "size_out_of_pilot",
          detail: `Tamanho ${size} fora das service_keys ativas (Fal.AI/${model}).`,
        };
      }
    }

    return {
      resolved: true,
      service_key: `fal.gpt-image-1.5.per_image.${suffix}`,
      category: "ai_image",
      provider: "fal",
      model: "gpt-image-1.5",
      resolution: size,
      quality,
    };
  }

  // Lovable / unknown → fora do piloto
  return {
    resolved: false,
    skip_reason: "provider_out_of_pilot",
    detail: `Provider fora do piloto Fase 3B (provider=${provider}, model=${model}).`,
  };
}

/**
 * Constrói idempotency key determinística para shadow v2 de IA Imagem.
 */
export function buildImageShadowIdempotencyKey(args: {
  tenantId: string;
  jobId: string;
  variationIndex: number;
  serviceKey: string;
  providerResponseId?: string | null;
}): string {
  return [
    "ai-image-shadow-v2",
    args.tenantId,
    args.jobId,
    `v${args.variationIndex}`,
    args.serviceKey,
    args.providerResponseId || "no-resp",
  ].join("|");
}
