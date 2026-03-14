// =============================================
// AI BLOCK FILL VISUAL v1.0.0 — Geração visual para blocos do Builder (Fase 3.2)
// Server-side registry: backend resolve contrato internamente
// Frontend envia apenas: blockType, mode, collectedData, tenantId
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "1.0.0";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BRIEFING_LENGTH = 500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================
// SERVER-SIDE CONTRACT REGISTRY (source of truth)
// Frontend NEVER sends this — backend resolves internally
// =============================================

interface ServerImageSpec {
  key: string;
  width: number;
  height: number;
}

interface ServerContract {
  aiGenerates: string[];
  imageSpecs: ServerImageSpec[];
  maxSlides?: number;
}

const SERVER_CONTRACTS: Record<string, ServerContract> = {
  'Banner:single': {
    aiGenerates: ['imageDesktop', 'imageMobile', 'title', 'subtitle', 'buttonText'],
    imageSpecs: [
      { key: 'imageDesktop', width: 1920, height: 700 },
      { key: 'imageMobile', width: 750, height: 420 },
    ],
  },
  'Banner:carousel': {
    aiGenerates: ['slides'],
    imageSpecs: [
      { key: 'imageDesktop', width: 1920, height: 700 },
      { key: 'imageMobile', width: 750, height: 420 },
    ],
    maxSlides: 3,
  },
};

function resolveContract(blockType: string, mode?: string): ServerContract | null {
  const key = mode ? `${blockType}:${mode}` : blockType;
  return SERVER_CONTRACTS[key] || null;
}

// =============================================
// IMAGE GENERATION HELPERS
// =============================================

async function callImageModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
): Promise<string | null> {
  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + lovableApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai-block-fill-visual] ${model} error: ${response.status}`, errText.substring(0, 300));
    return null;
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function uploadImageToStorage(
  supabase: any,
  tenantId: string,
  dataUrl: string,
  label: string,
): Promise<string | null> {
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const timestamp = Date.now();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    const filename = `block-${safeName}-${timestamp}.png`;
    const filePath = `${tenantId}/block-creatives/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(filePath, bytes, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error("[ai-block-fill-visual] Upload error:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('store-assets')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.error("[ai-block-fill-visual] Upload error:", error);
    return null;
  }
}

// =============================================
// IMAGE PROMPT BUILDER
// =============================================

function buildBannerImagePrompt(
  spec: ServerImageSpec,
  context: {
    briefing?: string;
    associationName?: string;
    associationType?: string;
    storeName: string;
    slideIndex?: number;
  }
): string {
  const isDesktop = spec.key === 'imageDesktop';
  const orientation = isDesktop
    ? `HORIZONTAL PAISAGEM (${spec.width}x${spec.height}px, ultra-wide)`
    : `VERTICAL RETRATO (${spec.width}x${spec.height}px)`;

  const contextLine = context.associationName
    ? `Contexto: ${context.associationType === 'product' ? 'Produto' : 'Categoria'} "${context.associationName}".`
    : 'Banner institucional/promocional.';

  const briefingLine = context.briefing
    ? `Briefing do usuário: "${context.briefing}".`
    : '';

  const slideNote = context.slideIndex !== undefined
    ? `Este é o slide ${context.slideIndex + 1} do carrossel — varie o cenário/atmosfera em relação aos outros slides.`
    : '';

  return `BANNER PROFISSIONAL PARA E-COMMERCE — ${orientation}

TAREFA: Criar uma imagem fotorrealista premium para banner de loja virtual.
Loja: "${context.storeName}".
${contextLine}
${briefingLine}
${slideNote}

COMPOSIÇÃO (${orientation}):
${isDesktop
    ? `- Layout ultra-wide (21:9 aprox). Cenário profissional de e-commerce.
- Lado esquerdo (60%) mais escuro/com gradiente para acomodar texto branco sobreposto.
- Lado direito (40%) com elementos visuais relevantes ao contexto.`
    : `- Layout vertical para mobile.
- Terço superior levemente mais escuro para texto sobreposto.
- Centro e inferior com elementos visuais relevantes.`}

ESTILO:
- Fotografia comercial profissional, iluminação de estúdio
- Cores vibrantes mas harmônicas
- Profundidade de campo com bokeh suave
- Qualidade 4K, sem ruído, sem artefatos

PROIBIDO:
- ❌ NÃO incluir texto, lettering, logos ou badges na imagem
- ❌ NÃO incluir mãos, pessoas ou modelos
- ❌ NÃO usar fundo branco chapado — o cenário deve ser rico e premium`;
}

// =============================================
// TEXT GENERATION
// =============================================

async function generateTexts(
  contract: ServerContract,
  context: {
    blockType: string;
    mode: string;
    briefing?: string;
    associationName?: string;
    associationType?: string;
    storeName: string;
    slideCount?: number;
  },
  options: { supabaseUrl: string; supabaseServiceKey: string },
): Promise<Record<string, unknown>> {
  resetAIRouterCache();

  if (context.mode === 'carousel' && context.slideCount) {
    // For carousel: generate text for each slide
    const tools = [{
      type: "function",
      function: {
        name: "generate_carousel_texts",
        description: `Generate compelling marketing text for ${context.slideCount} banner slides for an e-commerce store.`,
        parameters: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short, impactful headline (max 40 chars)" },
                  subtitle: { type: "string", description: "Supporting text (max 80 chars)" },
                  buttonText: { type: "string", description: "CTA button text (max 20 chars)" },
                  altText: { type: "string", description: "Accessible alt text for banner image" },
                },
                required: ["title", "subtitle", "buttonText", "altText"],
                additionalProperties: false,
              },
              minItems: context.slideCount,
              maxItems: context.slideCount,
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    }];

    const systemPrompt = `Você é um copywriter de e-commerce profissional. Gere textos em português brasileiro para banners de loja virtual. Os textos devem ser concisos, impactantes e adequados para banners hero.
Loja: "${context.storeName}".
${context.briefing ? `Briefing: "${context.briefing}".` : ''}
${context.associationName ? `Contexto: ${context.associationType === 'product' ? 'Produto' : 'Categoria'} "${context.associationName}".` : ''}
Cada slide deve ter textos distintos e complementares entre si.`;

    const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere textos para ${context.slideCount} slides de banner.` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "generate_carousel_texts" } },
    }, {
      supabaseUrl: options.supabaseUrl,
      supabaseServiceKey: options.supabaseServiceKey,
      logPrefix: '[ai-block-fill-visual]',
    });

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      return parsed;
    }
    return { slides: [] };
  }

  // Single banner text generation
  const tools = [{
    type: "function",
    function: {
      name: "generate_banner_texts",
      description: "Generate compelling marketing text for a banner in an e-commerce store.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short, impactful headline (max 40 chars)" },
          subtitle: { type: "string", description: "Supporting text (max 80 chars)" },
          buttonText: { type: "string", description: "CTA button text (max 20 chars)" },
          altText: { type: "string", description: "Accessible alt text for banner image" },
        },
        required: ["title", "subtitle", "buttonText", "altText"],
        additionalProperties: false,
      },
    },
  }];

  const systemPrompt = `Você é um copywriter de e-commerce profissional. Gere textos em português brasileiro para um banner hero de loja virtual. Os textos devem ser concisos e impactantes.
Loja: "${context.storeName}".
${context.briefing ? `Briefing: "${context.briefing}".` : ''}
${context.associationName ? `Contexto: ${context.associationType === 'product' ? 'Produto' : 'Categoria'} "${context.associationName}".` : ''}`;

  const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Gere textos para este banner." },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "generate_banner_texts" } },
  }, {
    supabaseUrl: options.supabaseUrl,
    supabaseServiceKey: options.supabaseServiceKey,
    logPrefix: '[ai-block-fill-visual]',
  });

  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;
    return parsed;
  }
  return {};
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[ai-block-fill-visual v${VERSION}] Starting...`);

  try {
    const body = await req.json();
    const { tenantId, blockType, mode, collectedData } = body;

    // --- Validation ---
    if (!tenantId || !blockType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenantId or blockType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Resolve contract server-side (NEVER trust frontend) ---
    const contract = resolveContract(blockType, mode);
    if (!contract) {
      console.error(`[ai-block-fill-visual] Unknown blockType/mode: ${blockType}:${mode}`);
      return new Response(
        JSON.stringify({ success: false, error: `Bloco não suportado: ${blockType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Sanitize collectedData ---
    const briefing = typeof collectedData?.briefing === 'string'
      ? collectedData.briefing.replace(/<[^>]*>/g, '').substring(0, MAX_BRIEFING_LENGTH).trim()
      : undefined;

    // --- Environment ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Store name ---
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .single();
    const storeName = storeSettings?.store_name || "Loja";

    // --- Resolve association context (backend extracts names, ignores derivedLinkUrl) ---
    let associationName: string | undefined;
    let associationType: string | undefined;

    if (mode === 'single' || !mode) {
      const assoc = collectedData?.association;
      if (assoc) {
        associationType = assoc.associationType;
        if (assoc.associationType === 'product' && assoc.productId) {
          const { data: prod } = await supabase
            .from("products")
            .select("name")
            .eq("id", assoc.productId)
            .single();
          associationName = prod?.name;
        } else if (assoc.associationType === 'category' && assoc.categoryId) {
          const { data: cat } = await supabase
            .from("categories")
            .select("name")
            .eq("id", assoc.categoryId)
            .single();
          associationName = cat?.name;
        }
      }
    }

    // =============================================
    // BANNER SINGLE
    // =============================================
    if (blockType === 'Banner' && (!mode || mode === 'single')) {
      console.log(`[ai-block-fill-visual] Generating Banner:single...`);

      // Generate images in parallel (desktop + mobile)
      const imagePromises = contract.imageSpecs.map(async (spec) => {
        const prompt = buildBannerImagePrompt(spec, {
          briefing,
          associationName,
          associationType,
          storeName,
        });

        // Try pro model first, fallback to flash
        let dataUrl = await callImageModel(lovableApiKey, "google/gemini-3-pro-image-preview", prompt);
        if (!dataUrl) {
          console.log(`[ai-block-fill-visual] Pro failed for ${spec.key}, trying flash...`);
          dataUrl = await callImageModel(lovableApiKey, "google/gemini-2.5-flash-image", prompt);
        }
        if (!dataUrl) {
          throw new Error(`Failed to generate image: ${spec.key}`);
        }

        const publicUrl = await uploadImageToStorage(supabase, tenantId, dataUrl, spec.key);
        if (!publicUrl) {
          throw new Error(`Failed to upload image: ${spec.key}`);
        }

        return { key: spec.key, url: publicUrl };
      });

      // Generate text in parallel with images
      const textPromise = generateTexts(contract, {
        blockType,
        mode: 'single',
        briefing,
        associationName,
        associationType,
        storeName,
      }, { supabaseUrl, supabaseServiceKey });

      const [imageResults, textResult] = await Promise.all([
        Promise.all(imagePromises),
        textPromise,
      ]);

      // Build generated props (only keys in aiGenerates)
      const generatedProps: Record<string, unknown> = {};
      for (const img of imageResults) {
        if (contract.aiGenerates.includes(img.key)) {
          generatedProps[img.key] = img.url;
        }
      }
      if (contract.aiGenerates.includes('title')) {
        generatedProps.title = textResult.title || '';
      }
      if (contract.aiGenerates.includes('subtitle')) {
        generatedProps.subtitle = textResult.subtitle || '';
      }
      if (contract.aiGenerates.includes('buttonText')) {
        generatedProps.buttonText = textResult.buttonText || '';
      }

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Banner:single done in ${elapsed}ms`);

      // Record AI usage
      try {
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: 10 });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps, altText: textResult.altText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =============================================
    // BANNER CAROUSEL
    // =============================================
    if (blockType === 'Banner' && mode === 'carousel') {
      // Enforce max slides from server contract
      let slideCount = typeof collectedData?.slideCount === 'number' ? collectedData.slideCount : 1;
      slideCount = Math.min(slideCount, contract.maxSlides || 3);
      slideCount = Math.max(slideCount, 1);

      console.log(`[ai-block-fill-visual] Generating Banner:carousel with ${slideCount} slides...`);

      // Resolve per-slide associations
      const slideAssociations: Array<{
        associationName?: string;
        associationType?: string;
        briefing?: string;
      }> = [];

      for (let i = 0; i < slideCount; i++) {
        const slideData = collectedData?.[`slideAssociations_${i}`];
        let name: string | undefined;
        let type: string | undefined;
        let slideBriefing: string | undefined;

        if (slideData) {
          type = slideData.associationType;
          if (slideData.associationType === 'product' && slideData.productId) {
            const { data: prod } = await supabase
              .from("products").select("name").eq("id", slideData.productId).single();
            name = prod?.name;
          } else if (slideData.associationType === 'category' && slideData.categoryId) {
            const { data: cat } = await supabase
              .from("categories").select("name").eq("id", slideData.categoryId).single();
            name = cat?.name;
          }
        }

        // Check for per-slide briefing (from expanded steps)
        const slideBriefingKey = `briefing_${i}`;
        if (typeof collectedData?.[slideBriefingKey] === 'string') {
          slideBriefing = collectedData[slideBriefingKey].replace(/<[^>]*>/g, '').substring(0, MAX_BRIEFING_LENGTH).trim();
        }

        slideAssociations.push({
          associationName: name,
          associationType: type,
          briefing: slideBriefing || briefing,
        });
      }

      // Generate all images in parallel (slideCount × 2 images each)
      const imagePromises: Array<Promise<{ slideIndex: number; key: string; url: string }>> = [];

      for (let i = 0; i < slideCount; i++) {
        for (const spec of contract.imageSpecs) {
          imagePromises.push(
            (async () => {
              const prompt = buildBannerImagePrompt(spec, {
                briefing: slideAssociations[i]?.briefing,
                associationName: slideAssociations[i]?.associationName,
                associationType: slideAssociations[i]?.associationType,
                storeName,
                slideIndex: i,
              });

              let dataUrl = await callImageModel(lovableApiKey, "google/gemini-3-pro-image-preview", prompt);
              if (!dataUrl) {
                console.log(`[ai-block-fill-visual] Pro failed for slide ${i} ${spec.key}, trying flash...`);
                dataUrl = await callImageModel(lovableApiKey, "google/gemini-2.5-flash-image", prompt);
              }
              if (!dataUrl) {
                throw new Error(`Failed to generate image: slide ${i} ${spec.key}`);
              }

              const publicUrl = await uploadImageToStorage(supabase, tenantId, dataUrl, `slide${i}-${spec.key}`);
              if (!publicUrl) {
                throw new Error(`Failed to upload image: slide ${i} ${spec.key}`);
              }

              return { slideIndex: i, key: spec.key, url: publicUrl };
            })()
          );
        }
      }

      // Generate text for all slides in parallel with images
      const textPromise = generateTexts(contract, {
        blockType,
        mode: 'carousel',
        briefing,
        associationName: slideAssociations[0]?.associationName,
        associationType: slideAssociations[0]?.associationType,
        storeName,
        slideCount,
      }, { supabaseUrl, supabaseServiceKey });

      const [imageResults, textResult] = await Promise.all([
        Promise.all(imagePromises),
        textPromise,
      ]);

      // Organize images by slide
      const slideImages: Record<number, Record<string, string>> = {};
      for (const img of imageResults) {
        if (!slideImages[img.slideIndex]) slideImages[img.slideIndex] = {};
        slideImages[img.slideIndex][img.key] = img.url;
      }

      // Build slides array
      const textSlides = (textResult as any).slides || [];
      const slides = [];

      for (let i = 0; i < slideCount; i++) {
        const images = slideImages[i] || {};
        const texts = textSlides[i] || {};
        const assocData = collectedData?.[`slideAssociations_${i}`];

        // linkUrl is derived by the SYSTEM from the association, NEVER by AI
        let linkUrl = '';
        if (assocData) {
          if (assocData.associationType === 'product' && assocData.productId) {
            // Frontend will derive the actual product URL
            linkUrl = `__product:${assocData.productId}`;
          } else if (assocData.associationType === 'category' && assocData.categoryId) {
            linkUrl = `__category:${assocData.categoryId}`;
          } else if (assocData.associationType === 'url' && assocData.manualUrl) {
            linkUrl = assocData.manualUrl;
          }
        }

        slides.push({
          id: crypto.randomUUID(),
          imageDesktop: images.imageDesktop || '',
          imageMobile: images.imageMobile || '',
          title: texts.title || '',
          subtitle: texts.subtitle || '',
          buttonText: texts.buttonText || '',
          altText: texts.altText || `Banner ${i + 1}`,
          linkUrl,
        });
      }

      const generatedProps = { slides };

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Banner:carousel done in ${elapsed}ms (${slideCount} slides)`);

      // Record AI usage
      try {
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: 10 * slideCount });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Unknown block/mode that passed contract check but has no handler
    return new Response(
      JSON.stringify({ success: false, error: "Handler not implemented for this block type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ai-block-fill-visual] Error after ${elapsed}ms:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro inesperado na geração",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
