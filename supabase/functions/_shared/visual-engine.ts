// =============================================
// VISUAL ENGINE — Unified Image Generation Motor
// v4.0.0: Single resilientGenerate for ALL modules
// 
// HIERARQUIA UNIFICADA v10.0:
// 1. GPT Image 1 edit-image (fal.ai) — image-to-image com referência
// 2. Gemini Nativa — fallback com referência base64
// 3. OpenAI Nativa — fallback
// 4. Lovable AI Gateway (Pro → Flash → Simplified) — último recurso
//
// CONSUMERS:
// - creative-image-generate (thumbs produto 1:1)
// - media-process-generation-queue (calendário)
// - ai-landing-page-enhance-images (landing pages)
// - store-builder visual blocks (banners)
// =============================================

import type {
  VisualGenerationRequest,
  VisualGenerationResult,
  GeneratedAsset,
  QAScores,
  VisualSlot,
} from './visual-adapters/types.ts';

import { buildFinalPrompt, buildCreativeBrief } from './creative-brief-builder.ts';
import { tryNativeGemini } from './native-gemini.ts';
import { generateImageWithGptImage1, downloadImageAsBase64 as falDownloadImage } from './fal-client.ts';

// ===== CONSTANTS =====

const LOVABLE_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const OPENAI_CHAT_API = 'https://api.openai.com/v1/chat/completions';

export const LOVABLE_MODELS = {
  primary: 'google/gemini-3-pro-image-preview',
  fast: 'google/gemini-3.1-flash-image-preview',
  fallback: 'google/gemini-2.5-flash-image',
} as const;

// ===== RE-EXPORT for backward compatibility =====
export { buildFinalPrompt, buildCreativeBrief } from './creative-brief-builder.ts';

// ===== IMAGE INTENT CLASSIFIER =====

export type ImageIntent =
  | "product_photo"
  | "lifestyle_scene"
  | "creative_vfx"
  | "banner_promo"
  | "social_post"
  | "generic";

const IMAGE_INTENT_KEYWORDS: Record<ImageIntent, string[]> = {
  product_photo: [
    "produto", "embalagem", "rótulo", "close-up", "detalhe", "packshot",
    "fundo branco", "catálogo", "e-commerce", "product", "packaging", "label",
    "white background", "catalog",
  ],
  lifestyle_scene: [
    "pessoa", "segurando", "usando", "lifestyle", "cenário", "ambiente",
    "mesa", "cozinha", "praia", "jardim", "mão", "mãos", "holding",
    "using", "scene", "outdoor", "indoor",
  ],
  creative_vfx: [
    "mascote", "personagem", "animação", "cartoon", "ilustração",
    "efeito", "efeitos", "vfx", "explosão", "partícula", "neon",
    "holográfico", "3d", "fantasia", "mágico", "magia", "futurista",
    "character", "mascot", "animated", "illustration", "fantasy",
    "magical", "glitch", "sparks", "faíscas", "fumaça", "smoke",
    "fogo", "fire", "raio", "lightning", "surreal", "abstrato",
  ],
  banner_promo: [
    "banner", "promoção", "desconto", "oferta", "sale", "promo",
    "black friday", "natal", "páscoa", "dia das mães", "campanha",
    "anúncio", "ad", "cta", "call to action",
  ],
  social_post: [
    "post", "instagram", "reels", "stories", "feed", "tiktok",
    "social", "carrossel", "carousel", "thumbnail", "thumb",
  ],
  generic: [],
};

export function classifyImageIntent(
  prompt: string,
  hasReferenceImage: boolean,
): ImageIntent {
  if (!prompt || prompt.trim().length === 0) {
    return hasReferenceImage ? "product_photo" : "generic";
  }

  const promptLower = prompt.toLowerCase();
  const scores: Record<ImageIntent, number> = {
    product_photo: 0,
    lifestyle_scene: 0,
    creative_vfx: 0,
    banner_promo: 0,
    social_post: 0,
    generic: 0,
  };

  for (const [intent, keywords] of Object.entries(IMAGE_INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (promptLower.includes(kw)) {
        scores[intent as ImageIntent]++;
      }
    }
  }

  let bestIntent: ImageIntent = hasReferenceImage ? "product_photo" : "generic";
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as ImageIntent;
    }
  }

  return bestIntent;
}

// ===== TYPES =====

export type ActualProvider = 'fal-ai' | 'gemini' | 'openai' | 'lovable' | 'unknown';

export interface ResilientGenerateOptions {
  /** Lovable API Key (required, always available) */
  lovableApiKey: string;
  /** OpenAI API Key (optional) */
  openaiApiKey?: string | null;
  /** Gemini API Key (optional) */
  geminiApiKey?: string | null;
  /** fal.ai API Key (optional) */
  falApiKey?: string | null;
  /** The prompt to generate */
  prompt: string;
  /** Product reference image as base64 (for Gemini/OpenAI/Gateway) */
  referenceImageBase64?: string | null;
  /** Product reference image URL (for GPT Image 1 fal.ai) */
  referenceImageUrl?: string | null;
  /** Output image size for fal.ai (default: '1024x1024') */
  outputSize?: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  /** Additional style reference images as base64 (for Gateway, e.g. landing pages) */
  styleReferences?: string[];
  /** Timeout for GPT Image 1 polling in ms (default: 60000) */
  gptTimeoutMs?: number;
  /** Timeout for Gateway Pro model in ms (default: 70000) */
  gatewayProTimeoutMs?: number;
  /** Label for logging (e.g. 'desktop', 'mobile', 'thumb-1') */
  slotLabel?: string;
}

export interface ResilientGenerateResult {
  imageBase64: string | null;
  model: string;
  actualProvider: ActualProvider;
  imageIntent?: ImageIntent;
  fallbackReason?: string;
  error?: string;
}

// ===== PROMPT BUILDING (delegates to creative-brief-builder) =====

/**
 * @deprecated Use buildFinalPrompt from creative-brief-builder.ts directly.
 * Kept for backward compatibility.
 */
export function buildPromptForSlot(
  request: VisualGenerationRequest,
  slot: VisualSlot,
): string {
  return buildFinalPrompt(request, slot);
}

// ===== GENERATE WITH LOVABLE GATEWAY (Gemini) =====

export async function generateWithLovableGateway(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceImageBase64: string | null,
  styleReferences?: string[],
): Promise<{ imageBase64: string | null; error?: string }> {
  try {
    console.log(`[visual-engine] Generating with ${model}...`);
    
    const content: any[] = [{ type: 'text', text: prompt }];
    if (referenceImageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }
    // Add style references (for landing pages)
    if (styleReferences?.length) {
      for (const refB64 of styleReferences.slice(0, 2)) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${refB64}` },
        });
      }
    }

    const response = await fetch(LOVABLE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[visual-engine] ${model} error: ${response.status}`, errorText.substring(0, 300));
      if (response.status === 429) return { imageBase64: null, error: `Rate limit ${model}` };
      if (response.status === 402) return { imageBase64: null, error: 'Créditos insuficientes' };
      return { imageBase64: null, error: `${model} error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.warn(`[visual-engine] ${model} returned no image`);
      return { imageBase64: null, error: `${model} não retornou imagem` };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      if (imageUrl.startsWith('data:')) {
        const b64 = imageUrl.split(',')[1];
        if (b64) return { imageBase64: b64 };
      }
      return { imageBase64: null, error: `Formato inválido ${model}` };
    }

    console.log(`[visual-engine] ${model} OK (${base64Match[1].length} chars)`);
    return { imageBase64: base64Match[1] };
  } catch (error) {
    console.error(`[visual-engine] ${model} error:`, error);
    return { imageBase64: null, error: String(error) };
  }
}

// ===== GENERATE WITH REAL OPENAI =====

export async function generateWithRealOpenAI(
  openaiApiKey: string,
  prompt: string,
  referenceImageBase64: string | null,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  const model = 'gpt-image-1';
  try {
    console.log(`[visual-engine] Generating with real OpenAI ${model}...`);
    const userContent: any[] = [{ type: 'text', text: prompt }];
    if (referenceImageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }

    const response = await fetch(OPENAI_CHAT_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[visual-engine] OpenAI ${model} error: ${response.status}`, errorText.substring(0, 300));
      return { imageBase64: null, model, error: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    let b64: string | null = null;

    const outputImages = data.choices?.[0]?.message?.output_images;
    if (outputImages?.length > 0) {
      const imgUrl = outputImages[0]?.url || outputImages[0];
      if (typeof imgUrl === 'string') {
        b64 = imgUrl.startsWith('data:') ? imgUrl.split(',')[1] : imgUrl;
      }
    }

    if (!b64) {
      const content = data.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            b64 = part.image_url.url.startsWith('data:') ? part.image_url.url.split(',')[1] : part.image_url.url;
            break;
          }
        }
      }
    }

    if (!b64) {
      const images = data.choices?.[0]?.message?.images;
      if (images?.length > 0) {
        const url = images[0]?.image_url?.url;
        if (url) b64 = url.startsWith('data:') ? url.split(',')[1] : url;
      }
    }

    if (!b64) {
      return { imageBase64: null, model, error: 'OpenAI não retornou imagem' };
    }
    console.log(`[visual-engine] OpenAI OK (${b64.length} chars)`);
    return { imageBase64: b64, model };
  } catch (error) {
    console.error(`[visual-engine] OpenAI error:`, error);
    return { imageBase64: null, model, error: String(error) };
  }
}

// ===== TIMEOUT HELPER =====

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[visual-engine] ⏱ TIMEOUT (${ms}ms) for ${label}`);
      reject(new Error('TIMEOUT'));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ===== HELPER: Detect actual provider from model string =====

export function getActualProviderFromModel(model: string): ActualProvider {
  const normalized = model.toLowerCase();
  if (normalized.startsWith('fal-ai/')) return 'fal-ai';
  if (normalized.includes('lovable fallback') || normalized.includes('lovable gateway')) return 'lovable';
  if (normalized.includes('gemini nativa') || (normalized.includes('gemini') && !normalized.includes('lovable'))) return 'gemini';
  if (normalized.includes('openai') || normalized === 'gpt-image-1') return 'openai';
  if (normalized.includes('google/')) return 'lovable';
  return 'unknown';
}

// ===== RESILIENT GENERATE v10.0 — UNIFIED FOR ALL MODULES =====

/**
 * HIERARQUIA OBRIGATÓRIA v10.0 (UNIFICADA):
 * 1. GPT Image 1 edit-image (fal.ai) — usa FAL_API_KEY + referência URL
 * 2. Gemini Nativa (API direta Google AI Studio) — usa GEMINI_API_KEY
 * 3. OpenAI Nativa — usa OPENAI_API_KEY
 * 4. Lovable AI Gateway (Pro → Flash → Simplified) — último recurso
 * 
 * Returns standardized result with actualProvider for tracking.
 */
export async function resilientGenerate(opts: ResilientGenerateOptions): Promise<ResilientGenerateResult>;
/**
 * @deprecated Legacy signature — use options object instead.
 */
export async function resilientGenerate(
  lovableApiKey: string,
  openaiApiKey: string | null,
  prompt: string,
  referenceImageBase64: string | null,
  preferOpenAI?: boolean,
  slotLabel?: string,
  geminiApiKey?: string | null,
  falApiKey?: string | null,
  referenceImageUrl?: string | null,
): Promise<ResilientGenerateResult>;
export async function resilientGenerate(
  lovableApiKeyOrOpts: string | ResilientGenerateOptions,
  openaiApiKey?: string | null,
  prompt?: string,
  referenceImageBase64?: string | null,
  _preferOpenAI?: boolean,
  slotLabel?: string,
  geminiApiKey?: string | null,
  falApiKey?: string | null,
  referenceImageUrl?: string | null,
): Promise<ResilientGenerateResult> {
  // Normalize to options object
  let opts: ResilientGenerateOptions;
  if (typeof lovableApiKeyOrOpts === 'string') {
    opts = {
      lovableApiKey: lovableApiKeyOrOpts,
      openaiApiKey,
      geminiApiKey,
      falApiKey,
      prompt: prompt!,
      referenceImageBase64,
      referenceImageUrl,
      slotLabel,
    };
  } else {
    opts = lovableApiKeyOrOpts;
  }

  const {
    lovableApiKey: apiKey,
    openaiApiKey: oaiKey,
    geminiApiKey: gemKey,
    falApiKey: falKey,
    prompt: finalPrompt,
    referenceImageBase64: refBase64,
    referenceImageUrl: refUrl,
    outputSize = '1024x1024',
    styleReferences,
    gptTimeoutMs = 60_000,
    gatewayProTimeoutMs = 70_000,
    slotLabel: label = 'slot',
  } = opts;

  // Classify image intent for observability
  const imageIntent = classifyImageIntent(finalPrompt, !!refUrl || !!refBase64);
  console.log(`[visual-engine] [${label}] ═══ resilientGenerate v10.0 START ═══`);
  console.log(`[visual-engine] [${label}] Intent: ${imageIntent} | Keys: FAL=${!!falKey} GEMINI=${!!gemKey} OPENAI=${!!oaiKey} LOVABLE=✅ | size=${outputSize}`);

  // ===== STEP 1: GPT Image 1 edit-image via fal.ai (PRIORIDADE MÁXIMA) =====
  if (falKey && refUrl) {
    console.log(`[visual-engine] [${label}] Step 1: GPT Image 1 edit-image (prioridade máxima)...`);
    try {
      const gptResult = await withTimeout(
        generateImageWithGptImage1(falKey, finalPrompt, [refUrl], outputSize),
        gptTimeoutMs,
        `${label}:gpt-image-1`,
      );
      if (gptResult?.imageUrl) {
        const b64 = await falDownloadImage(gptResult.imageUrl);
        if (b64) {
          console.log(`[visual-engine] [${label}] ✅ GPT Image 1 edit-image succeeded`);
          return { imageBase64: b64, model: 'fal-ai/gpt-image-1/edit-image', actualProvider: 'fal-ai' };
        }
      }
      console.warn(`[visual-engine] [${label}] GPT Image 1 returned no usable image. Falling back...`);
    } catch (err: any) {
      const reason = err?.message === 'TIMEOUT' ? 'timeout' : 'error';
      console.warn(`[visual-engine] [${label}] GPT Image 1 failed (${reason}): ${err?.message}. Falling back...`);
    }
  } else if (!falKey) {
    console.warn(`[visual-engine] [${label}] FAL_API_KEY not available. Skipping GPT Image 1.`);
  } else {
    console.warn(`[visual-engine] [${label}] No reference image URL. Skipping GPT Image 1.`);
  }

  // ===== STEP 2: Gemini Nativa (FALLBACK SEGURO) =====
  if (gemKey) {
    const nativeResult = await tryNativeGemini(gemKey, finalPrompt, refBase64 || null, label);
    if (nativeResult.imageBase64) {
      console.log(`[visual-engine] [${label}] ✅ Gemini Nativa succeeded`);
      return {
        imageBase64: nativeResult.imageBase64,
        model: nativeResult.model,
        actualProvider: 'gemini',
        fallbackReason: falKey ? 'gpt_image_1_failed' : 'no_fal_key',
      };
    }
    console.warn(`[visual-engine] [${label}] Gemini Nativa failed: ${nativeResult.error}. Trying OpenAI...`);
  } else {
    console.warn(`[visual-engine] [${label}] GEMINI_API_KEY not available. Skipping native Gemini.`);
  }

  // ===== STEP 3: OpenAI Nativa =====
  if (oaiKey) {
    const openaiResult = await generateWithRealOpenAI(oaiKey, finalPrompt, refBase64 || null);
    if (openaiResult.imageBase64) {
      console.log(`[visual-engine] [${label}] ✅ OpenAI Nativa succeeded`);
      return {
        imageBase64: openaiResult.imageBase64,
        model: openaiResult.model,
        actualProvider: 'openai',
        fallbackReason: 'native_providers_failed',
      };
    }
    console.warn(`[visual-engine] [${label}] OpenAI failed: ${openaiResult.error}. Trying Lovable Gateway...`);
  } else {
    console.warn(`[visual-engine] [${label}] OPENAI_API_KEY not available. Skipping OpenAI.`);
  }

  // ===== STEP 4: Lovable AI Gateway (ÚLTIMO RECURSO) =====
  // 4a: Pro model with timeout
  console.log(`[visual-engine] [${label}] Step 4a: ${LOVABLE_MODELS.primary} via Lovable Gateway (timeout ${gatewayProTimeoutMs}ms)`);
  try {
    const proResult = await withTimeout(
      generateWithLovableGateway(apiKey, LOVABLE_MODELS.primary, finalPrompt, refBase64 || null, styleReferences),
      gatewayProTimeoutMs,
      `${label}:pro`,
    );
    if (proResult.imageBase64) {
      console.log(`[visual-engine] [${label}] ✅ Lovable Gateway Pro succeeded (fallback)`);
      return {
        imageBase64: proResult.imageBase64,
        model: `${LOVABLE_MODELS.primary} (Lovable fallback)`,
        actualProvider: 'lovable',
        fallbackReason: 'native_providers_failed',
      };
    }
    console.warn(`[visual-engine] [${label}] Lovable Pro returned no image: ${proResult.error}`);
  } catch (err: any) {
    const reason = err?.message === 'TIMEOUT' ? 'timeout' : 'error';
    console.warn(`[visual-engine] [${label}] Lovable Pro failed (${reason}). Trying Flash...`);
  }

  // 4b: Flash model
  console.log(`[visual-engine] [${label}] Step 4b: ${LOVABLE_MODELS.fast} via Lovable Gateway`);
  const flashResult = await generateWithLovableGateway(apiKey, LOVABLE_MODELS.fast, finalPrompt, refBase64 || null, styleReferences);
  if (flashResult.imageBase64) {
    console.warn(`[visual-engine] [${label}] ⚠️ FALLBACK: Lovable Flash used`);
    return {
      imageBase64: flashResult.imageBase64,
      model: `${LOVABLE_MODELS.fast} (Lovable fallback)`,
      actualProvider: 'lovable',
      fallbackReason: 'all_native_failed_lovable_flash',
    };
  }

  // 4c: Simplified prompt — ABSOLUTE LAST RESORT
  console.warn(`[visual-engine] [${label}] Step 4c: Simplified prompt (absolute last resort)`);
  const productName = finalPrompt.match(/"([^"]+)"/)?.[1] || 'produto';
  const hasNoTextRule = finalPrompt.includes('ZERO TEXT') || finalPrompt.includes('ZERO TEXTO');
  const noTextSuffix = hasNoTextRule ? ' A imagem NÃO pode conter NENHUM texto, letra, número ou tipografia.' : '';
  const simplifiedPrompt = `Crie uma fotografia profissional do produto "${productName}" em fundo escuro elegante. O produto deve ser IDÊNTICO à imagem de referência. Qualidade editorial.${noTextSuffix}`;
  const lastResort = await generateWithLovableGateway(apiKey, LOVABLE_MODELS.fast, simplifiedPrompt, refBase64 || null);
  if (lastResort.imageBase64) {
    console.warn(`[visual-engine] [${label}] ⚠️ FALLBACK: Simplified prompt used`);
    return {
      imageBase64: lastResort.imageBase64,
      model: `${LOVABLE_MODELS.fast} (simplified, Lovable fallback)`,
      actualProvider: 'lovable',
      fallbackReason: 'all_failed_simplified',
    };
  }

  console.error(`[visual-engine] [${label}] ═══ ALL GENERATION ATTEMPTS FAILED ═══`);
  return {
    imageBase64: null,
    model: 'all-failed',
    actualProvider: 'unknown',
    error: 'All generation attempts failed (GPT Image 1 → Gemini Nativa → OpenAI → Lovable Gateway)',
  };
}

// ===== QA SCORER =====

export async function scoreImageForRealism(
  lovableApiKey: string,
  imageBase64: string,
  originalProductBase64: string | null,
  productName: string,
): Promise<QAScores> {
  console.log(`[visual-engine] Scoring image for realism...`);
  try {
    const content: any[] = [
      {
        type: 'text',
        text: `Você é um juiz especialista em avaliar FIDELIDADE de imagens de produto geradas por IA.

TAREFA: Avaliar se a IMAGEM GERADA mantém o produto IDÊNTICO ao original e se parece uma FOTO REAL.
PRODUTO ESPERADO: "${productName}"

REGRA CRÍTICA: Se o produto foi ALTERADO, REDESENHADO ou tem VARIAÇÕES que não existem na referência, a nota de LABEL deve ser 0-2.

Avalie de 0 a 10:
1. REALISM (Parece foto real?)
2. QUALITY (Qualidade técnica)
3. COMPOSITION (Composição)
4. LABEL (Fidelidade do produto — CRITÉRIO MAIS IMPORTANTE)

Responda APENAS em JSON:
{"realism":<0-10>,"quality":<0-10>,"composition":<0-10>,"label":<0-10>,"reasoning":"<breve>"}`,
      },
    ];

    if (originalProductBase64) {
      content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${originalProductBase64}` } });
    }
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } });

    const response = await fetch(LOVABLE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };

    const scores = JSON.parse(jsonMatch[0]);
    const realism = Math.min(10, Math.max(0, Number(scores.realism) || 5));
    const quality = Math.min(10, Math.max(0, Number(scores.quality) || 5));
    const composition = Math.min(10, Math.max(0, Number(scores.composition) || 5));
    const label = Math.min(10, Math.max(0, Number(scores.label) || 5));
    const overall = (realism / 10) * 0.40 + (quality / 10) * 0.20 + (composition / 10) * 0.15 + (label / 10) * 0.25;

    console.log(`[visual-engine] Scores: r=${realism}, q=${quality}, c=${composition}, l=${label}, o=${overall.toFixed(2)}`);
    return { realism, quality, composition, label, overall };
  } catch (error) {
    console.error(`[visual-engine] Scorer error:`, error);
    return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
  }
}

// ===== IMAGE DOWNLOAD =====

export async function downloadImageAsBase64(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[visual-engine] Downloading (attempt ${attempt}/3): ${url.substring(0, 100)}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VisualEngine/1.0)' },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
      return btoa(binary);
    } catch (error: any) {
      console.error(`[visual-engine] Download error (attempt ${attempt}):`, error?.message);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      return null;
    }
  }
  return null;
}

// ===== UPLOAD TO STORAGE =====

interface UploadContext {
  productName?: string;
  device?: string;
  width?: number;
  height?: number;
}

function getCreativeSubfolder(context?: UploadContext): string {
  const root = 'criativos-builder';
  if (context?.width && context?.height) {
    return `${root}/${context.width}x${context.height}`;
  }
  return root;
}

function buildCreativeFilename(label: string, context?: UploadContext): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const shortId = Date.now().toString(36).slice(-5);

  const parts: string[] = [];

  if (context?.productName) {
    const safeProd = context.productName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    if (safeProd) parts.push(safeProd);
  }

  if (context?.device) {
    parts.push(context.device);
  } else {
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
    parts.push(safeLabel);
  }

  parts.push(date);
  parts.push(shortId);

  return `${parts.join('-')}.png`;
}

export async function uploadToStorage(
  supabase: any,
  tenantId: string,
  imageData: string,
  label: string,
  bucket: string = 'store-assets',
  subfolder?: string,
  context?: UploadContext,
  driveSource?: string,
): Promise<string | null> {
  try {
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const resolvedFolder = subfolder || getCreativeSubfolder(context);
    const filename = buildCreativeFilename(label, context);
    const filePath = `${tenantId}/${resolvedFolder}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('[visual-engine] Upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || null;
    console.log(`[visual-engine] Uploaded: ${filePath}`);

    if (publicUrl) {
      try {
        const { resolveAndEnsureFolderEdge, registerFileToDriveEdge } = await import('./drive-register.ts');
        const source = driveSource || 'ai_creative_storefront';
        const folderId = await resolveAndEnsureFolderEdge(supabase, tenantId, tenantId, source);
        if (folderId) {
          await registerFileToDriveEdge(supabase, {
            tenantId,
            userId: tenantId,
            folderId,
            storagePath: filePath,
            originalName: filename,
            publicUrl,
            mimeType: 'image/png',
            sizeBytes: bytes.length,
            source,
            bucket,
            extraMetadata: context?.productName ? { product_name: context.productName } : undefined,
          });
          console.log(`[visual-engine] 📁 Registered in Drive: ${source}`);
        }
      } catch (driveErr) {
        console.warn('[visual-engine] Drive registration failed (non-blocking):', driveErr);
      }
    }

    return publicUrl;
  } catch (error) {
    console.error('[visual-engine] Upload error:', error);
    return null;
  }
}

// ===== HIGH-LEVEL: GENERATE FOR A SINGLE REQUEST =====

export async function generateForRequest(
  request: VisualGenerationRequest,
  supabase: any,
  tenantId: string,
  lovableApiKey: string,
  openaiApiKey: string | null,
  geminiApiKey: string | null = null,
  falApiKey: string | null = null,
): Promise<VisualGenerationResult> {
  const startTime = Date.now();
  const assets: GeneratedAsset[] = [];

  const briefForLog = buildCreativeBrief({
    creativeStyle: request.creativeStyle,
    styleConfig: request.styleConfig,
    briefing: request.briefing,
    product: request.product,
    category: request.category,
    store: request.store,
    outputMode: request.outputMode,
    slideIndex: request.slideIndex,
  });
  console.log(`[visual-engine] ══ CREATIVE BRIEF ══\n${briefForLog.substring(0, 800)}...`);

  let referenceBase64: string | null = null;
  if (request.product?.mainImageUrl) {
    referenceBase64 = await downloadImageAsBase64(request.product.mainImageUrl);
  }

  const slotPromises = request.slots.map(async (slot) => {
    const prompt = buildFinalPrompt(request, slot);
    const isDesktop = slot.composition.includes('desktop');
    const slotLabel = isDesktop ? 'desktop' : 'mobile';
    console.log(`[visual-engine] ══ FINAL PROMPT (${slotLabel.toUpperCase()}) ══\n${prompt.substring(0, 500)}...`);

    const result = await resilientGenerate({
      lovableApiKey,
      openaiApiKey,
      geminiApiKey,
      falApiKey,
      prompt,
      referenceImageBase64: referenceBase64,
      referenceImageUrl: request.product?.mainImageUrl || null,
      outputSize: `${slot.width}x${slot.height}` as any || '1024x1024',
      slotLabel,
    });

    if (result.fallbackReason) {
      console.warn(`[visual-engine] 📊 AUDIT [${slotLabel}]: model=${result.model}, provider=${result.actualProvider}, fallbackReason=${result.fallbackReason}`);
    } else {
      console.log(`[visual-engine] 📊 AUDIT [${slotLabel}]: model=${result.model}, provider=${result.actualProvider}, fallback=none`);
    }

    if (!result.imageBase64) {
      console.error(`[visual-engine] Failed to generate slot: ${slot.key}`);
      return null;
    }

    const publicUrl = await uploadToStorage(supabase, tenantId, result.imageBase64, slot.key, 'store-assets', undefined, {
      productName: request.product?.name,
      device: slotLabel,
      width: slot.width,
      height: slot.height,
    }, 'ai_creative_storefront');
    if (!publicUrl) {
      console.error(`[visual-engine] Failed to upload slot: ${slot.key}`);
      return null;
    }

    const asset: GeneratedAsset = {
      slotKey: slot.key,
      publicUrl,
      model: result.model,
    };

    if (request.enableQA && referenceBase64 && request.product) {
      asset.score = await scoreImageForRealism(
        lovableApiKey,
        result.imageBase64,
        referenceBase64,
        request.product.name,
      );
    }

    return asset;
  });

  const results = await Promise.all(slotPromises);
  for (const r of results) {
    if (r) assets.push(r);
  }

  const elapsed = Date.now() - startTime;
  const renderMode = request.outputMode === 'complete' ? 'baked' : 'overlay';

  return {
    assets,
    renderMode,
    metadata: {
      model: assets[0]?.model || LOVABLE_MODELS.primary,
      elapsed,
      qaEnabled: !!request.enableQA,
      outputMode: request.outputMode,
      creativeStyle: request.creativeStyle,
    },
  };
}
