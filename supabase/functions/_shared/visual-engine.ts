// =============================================
// VISUAL ENGINE — Shared image generation motor
// v3.0.0: GPT Image 1 (edit-image) priority hierarchy
// Provides: resilient generation cascade, QA scoring,
// image download, upload to storage + Drive registration
//
// HIERARQUIA v9.0:
// 1. GPT Image 1 edit-image (fal.ai) — image-to-image com referência
// 2. Gemini Nativa — fallback com referência base64
// 3. OpenAI Nativa — fallback
// 4. Lovable AI Gateway — último recurso
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

// ===== RESILIENT GENERATE — Quality-First with Per-Slot Timeout =====

/**
 * Wraps a promise with a timeout. Rejects with 'TIMEOUT' if exceeded.
 */
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

/**
 * Quality-first generation cascade per slot:
 *   1. Pro model with 70s timeout
 *   2. Flash model (no aggressive timeout)
 *   3. Simplified prompt + Flash model (last resort)
 *
 * The same creative brief/prompt is used for steps 1 and 2.
 * Only step 3 simplifies the prompt as a final fallback.
 *
 * Returns which model was used and whether fallback occurred.
 */
/**
 * HIERARQUIA OBRIGATÓRIA v9.0:
 * 1. GPT Image 1 edit-image (fal.ai) — usa FAL_API_KEY + referência URL
 * 2. Gemini Nativa (API direta Google AI Studio) — usa GEMINI_API_KEY
 * 3. OpenAI Nativa — usa OPENAI_API_KEY
 * 4. Lovable AI Gateway (Pro → Flash → Simplified) — último recurso
 */
export async function resilientGenerate(
  lovableApiKey: string,
  openaiApiKey: string | null,
  prompt: string,
  referenceImageBase64: string | null,
  preferOpenAI: boolean = false,
  slotLabel: string = 'slot',
  geminiApiKey: string | null = null,
  falApiKey: string | null = null,
  referenceImageUrl: string | null = null,
): Promise<{ imageBase64: string | null; model: string; fallbackReason?: string; error?: string }> {
  const PRO_TIMEOUT_MS = 70_000;

  // ===== STEP 1: GPT Image 1 edit-image via fal.ai (PRIORIDADE MÁXIMA) =====
  if (falApiKey && referenceImageUrl) {
    console.log(`[visual-engine] [${slotLabel}] Step 1: GPT Image 1 edit-image (prioridade máxima)...`);
    const gptResult = await generateImageWithGptImage1(
      falApiKey,
      prompt,
      [referenceImageUrl],
      '1024x1024',
    );
    if (gptResult?.imageUrl) {
      const b64 = await falDownloadImage(gptResult.imageUrl);
      if (b64) {
        console.log(`[visual-engine] [${slotLabel}] ✅ GPT Image 1 edit-image succeeded`);
        return { imageBase64: b64, model: 'fal-ai/gpt-image-1/edit-image', fallbackReason: undefined };
      }
    }
    console.warn(`[visual-engine] [${slotLabel}] GPT Image 1 failed. Falling back to Gemini Nativa...`);
  } else if (!falApiKey) {
    console.warn(`[visual-engine] [${slotLabel}] FAL_API_KEY not available. Skipping GPT Image 1.`);
  } else {
    console.warn(`[visual-engine] [${slotLabel}] No reference image URL. Skipping GPT Image 1.`);
  }

  // ===== STEP 2: Gemini Nativa (FALLBACK SEGURO) =====
  if (geminiApiKey) {
    const nativeResult = await tryNativeGemini(geminiApiKey, prompt, referenceImageBase64, slotLabel);
    if (nativeResult.imageBase64) {
      console.log(`[visual-engine] [${slotLabel}] ✅ Gemini Nativa succeeded`);
      return { ...nativeResult, fallbackReason: falApiKey ? 'gpt_image_1_failed' : 'no_fal_key' };
    }
    console.warn(`[visual-engine] [${slotLabel}] Gemini Nativa failed: ${nativeResult.error}. Trying OpenAI...`);
  } else {
    console.warn(`[visual-engine] [${slotLabel}] GEMINI_API_KEY not available. Skipping native Gemini.`);
  }

  // ===== STEP 3: OpenAI Nativa =====
  if (openaiApiKey) {
    const openaiResult = await generateWithRealOpenAI(openaiApiKey, prompt, referenceImageBase64);
    if (openaiResult.imageBase64) {
      console.log(`[visual-engine] [${slotLabel}] ✅ OpenAI Nativa succeeded`);
      return { ...openaiResult, fallbackReason: 'native_providers_failed' };
    }
    console.warn(`[visual-engine] [${slotLabel}] OpenAI failed: ${openaiResult.error}. Trying Lovable Gateway...`);
  } else {
    console.warn(`[visual-engine] [${slotLabel}] OPENAI_API_KEY not available. Skipping OpenAI.`);
  }

  // ===== STEP 4: Lovable AI Gateway (ÚLTIMO RECURSO) =====
  console.log(`[visual-engine] [${slotLabel}] Step 4 (fallback): ${LOVABLE_MODELS.primary} via Lovable Gateway (timeout ${PRO_TIMEOUT_MS}ms)`);
  try {
    const proResult = await withTimeout(
      generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.primary, prompt, referenceImageBase64),
      PRO_TIMEOUT_MS,
      `${slotLabel}:pro`,
    );
    if (proResult.imageBase64) {
      console.log(`[visual-engine] [${slotLabel}] ✅ Lovable Gateway Pro succeeded (fallback)`);
      return { imageBase64: proResult.imageBase64, model: `${LOVABLE_MODELS.primary} (Lovable fallback)`, fallbackReason: 'native_providers_failed' };
    }
    console.warn(`[visual-engine] [${slotLabel}] Lovable Pro returned no image: ${proResult.error}`);
  } catch (err: any) {
    const reason = err?.message === 'TIMEOUT' ? 'timeout' : 'error';
    console.warn(`[visual-engine] [${slotLabel}] Lovable Pro failed (${reason}). Trying Flash...`);
  }

  // Step 4b: Flash model via Lovable
  console.log(`[visual-engine] [${slotLabel}] Step 4b: ${LOVABLE_MODELS.fast} via Lovable Gateway`);
  const flashResult = await generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.fast, prompt, referenceImageBase64);
  if (flashResult.imageBase64) {
    console.warn(`[visual-engine] [${slotLabel}] ⚠️ FALLBACK: Lovable Flash used`);
    return {
      imageBase64: flashResult.imageBase64,
      model: `${LOVABLE_MODELS.fast} (Lovable fallback)`,
      fallbackReason: 'all_native_failed_lovable_flash',
    };
  }

  // Step 4c: Simplified prompt — ABSOLUTE LAST RESORT
  console.warn(`[visual-engine] [${slotLabel}] Step 4c: Simplified prompt (absolute last resort)`);
  const productName = prompt.match(/"([^"]+)"/)?.[1] || 'produto';
  const hasNoTextRule = prompt.includes('ZERO TEXT') || prompt.includes('ZERO TEXTO');
  const noTextSuffix = hasNoTextRule ? ' A imagem NÃO pode conter NENHUM texto, letra, número ou tipografia.' : '';
  const simplifiedPrompt = `Crie uma fotografia profissional do produto "${productName}" em fundo escuro elegante. O produto deve ser IDÊNTICO à imagem de referência. Qualidade editorial.${noTextSuffix}`;
  const lastResort = await generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.fast, simplifiedPrompt, referenceImageBase64);
  if (lastResort.imageBase64) {
    console.warn(`[visual-engine] [${slotLabel}] ⚠️ FALLBACK: Simplified prompt used`);
    return {
      imageBase64: lastResort.imageBase64,
      model: `${LOVABLE_MODELS.fast} (simplified, Lovable fallback)`,
      fallbackReason: 'all_failed_simplified',
    };
  }

  return { imageBase64: null, model: LOVABLE_MODELS.primary, error: 'All generation attempts failed (Gemini Nativa → OpenAI → Lovable Gateway)' };
}

// ===== QA SCORER =====

export async function scoreImageForRealism(
  lovableApiKey: string,
  imageBase64: string,
  originalProductBase64: string,
  productName: string,
): Promise<QAScores> {
  console.log(`[visual-engine] Scoring image for realism...`);
  try {
    const response = await fetch(LOVABLE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é um juiz especialista em avaliar REALISMO de imagens geradas por IA.\n\nTAREFA: Avaliar se a IMAGEM GERADA parece uma FOTO REAL.\nPRODUTO ESPERADO: "${productName}"\n\nAvalie de 0 a 10:\n1. REALISM\n2. QUALITY\n3. COMPOSITION\n4. LABEL\n\nResponda APENAS em JSON:\n{"realism":<0-10>,"quality":<0-10>,"composition":<0-10>,"label":<0-10>,"reasoning":"<breve>"}`
            },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${originalProductBase64}` } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
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
  /** Product name for semantic file naming */
  productName?: string;
  /** Slot device label (e.g. 'desktop', 'mobile') */
  device?: string;
  /** Slot dimensions for folder organization */
  width?: number;
  height?: number;
}

/**
 * Builds the subfolder path: criativos-builder/{WIDTHxHEIGHT}
 * Rule: All AI creatives go under one root folder, organized by dimensions.
 */
function getCreativeSubfolder(context?: UploadContext): string {
  const root = 'criativos-builder';
  if (context?.width && context?.height) {
    return `${root}/${context.width}x${context.height}`;
  }
  return root;
}

/**
 * Builds a semantic filename: {product}-{device}-{YYYY-MM-DD}-{shortId}.png
 */
function buildCreativeFilename(label: string, context?: UploadContext): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const shortId = Date.now().toString(36).slice(-5);

  const parts: string[] = [];

  // Product name (sanitized)
  if (context?.productName) {
    const safeProd = context.productName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    if (safeProd) parts.push(safeProd);
  }

  // Device label (desktop/mobile)
  if (context?.device) {
    parts.push(context.device);
  } else {
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
    parts.push(safeLabel);
  }

  // Date + short unique id
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

    // Register in Drive (fire-and-forget)
    if (publicUrl) {
      try {
        const { resolveAndEnsureFolderEdge, registerFileToDriveEdge } = await import('./drive-register.ts');
        const source = driveSource || 'ai_creative_storefront';
        const folderId = await resolveAndEnsureFolderEdge(supabase, tenantId, tenantId, source);
        if (folderId) {
          await registerFileToDriveEdge(supabase, {
            tenantId,
            userId: tenantId, // fallback: tenantId as creator (no user context in edge)
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

/**
 * Generates all slots for a single VisualGenerationRequest.
 * Uses resilient cascade, downloads product reference, uploads results.
 * 
 * v2.0.0: Now logs the consolidated creative brief for diagnostics.
 */
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

  // Log the consolidated creative brief ONCE per request
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

  // Download product reference image if available
  let referenceBase64: string | null = null;
  if (request.product?.mainImageUrl) {
    referenceBase64 = await downloadImageAsBase64(request.product.mainImageUrl);
  }

  const preferOpenAI = !!openaiApiKey && request.outputMode === 'complete';

  // Generate all slots in parallel — each slot has its own quality-first cascade
  const slotPromises = request.slots.map(async (slot) => {
    const prompt = buildFinalPrompt(request, slot);
    
    // Determine slot label for logging/audit
    const isDesktop = slot.composition.includes('desktop');
    const slotLabel = isDesktop ? 'desktop' : 'mobile';
    console.log(`[visual-engine] ══ FINAL PROMPT (${slotLabel.toUpperCase()}) ══\n${prompt.substring(0, 500)}...`);

    const result = await resilientGenerate(
      lovableApiKey,
      openaiApiKey,
      prompt,
      referenceBase64,
      preferOpenAI,
      slotLabel,
      geminiApiKey,
      falApiKey,
      request.product?.mainImageUrl || null,
    );

    // Log fallback audit trail
    if (result.fallbackReason) {
      console.warn(`[visual-engine] 📊 AUDIT [${slotLabel}]: model=${result.model}, fallbackReason=${result.fallbackReason}`);
    } else {
      console.log(`[visual-engine] 📊 AUDIT [${slotLabel}]: model=${result.model}, fallback=none`);
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
