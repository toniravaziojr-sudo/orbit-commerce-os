// =============================================
// AI BLOCK FILL VISUAL v2.1.0 — Phase 3.3 Grounding Fix
// Fixes: real product images, enriched tenant context, multimodal reference
// Server-side registry: backend resolve contrato internamente
// Frontend envia: blockType, mode, scope, collectedData, tenantId
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "2.1.0";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BRIEFING_LENGTH = 500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================
// SERVER-SIDE CONTRACT REGISTRY
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
// PRODUCT/CATEGORY DATA FETCHER (Source of Truth)
// =============================================

interface ProductContext {
  name: string;
  description?: string;
  slug?: string;
  mainImageUrl?: string;
}

interface CategoryContext {
  name: string;
  slug?: string;
}

async function fetchProductContext(supabase: any, productId: string): Promise<ProductContext | null> {
  const { data } = await supabase
    .from("products")
    .select("name, description, slug, images")
    .eq("id", productId)
    .single();
  if (!data) return null;
  
  let mainImageUrl: string | undefined;
  if (Array.isArray(data.images) && data.images.length > 0) {
    mainImageUrl = data.images[0]?.url || data.images[0];
  }
  
  return {
    name: data.name,
    description: data.description || undefined,
    slug: data.slug || undefined,
    mainImageUrl,
  };
}

async function fetchCategoryContext(supabase: any, categoryId: string): Promise<CategoryContext | null> {
  const { data } = await supabase
    .from("categories")
    .select("name, slug")
    .eq("id", categoryId)
    .single();
  if (!data) return null;
  return { name: data.name, slug: data.slug || undefined };
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
// IMAGE PROMPT BUILDER — Uses real product data
// =============================================

function buildBannerImagePrompt(
  spec: ServerImageSpec,
  context: {
    briefing?: string;
    product?: ProductContext | null;
    category?: CategoryContext | null;
    associationType?: string;
    storeName: string;
    slideIndex?: number;
  }
): string {
  const isDesktop = spec.key === 'imageDesktop';
  const orientation = isDesktop
    ? `HORIZONTAL PAISAGEM (${spec.width}x${spec.height}px, ultra-wide)`
    : `VERTICAL RETRATO (${spec.width}x${spec.height}px)`;

  let contextLine = 'Banner institucional/promocional.';
  if (context.product) {
    contextLine = `Produto: "${context.product.name}".`;
    if (context.product.description) {
      contextLine += ` Descrição: "${context.product.description.substring(0, 200)}".`;
    }
  } else if (context.category) {
    contextLine = `Categoria: "${context.category.name}".`;
  }

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
// TEXT GENERATION — Uses real product data
// =============================================

async function generateTexts(
  contract: ServerContract,
  context: {
    blockType: string;
    mode: string;
    briefing?: string;
    product?: ProductContext | null;
    category?: CategoryContext | null;
    associationType?: string;
    storeName: string;
    slideCount?: number;
  },
  options: { supabaseUrl: string; supabaseServiceKey: string },
): Promise<Record<string, unknown>> {
  resetAIRouterCache();

  // Build rich context from real data
  let contextInfo = '';
  if (context.product) {
    contextInfo = `Produto REAL: "${context.product.name}".`;
    if (context.product.description) {
      contextInfo += ` Descrição: "${context.product.description.substring(0, 300)}".`;
    }
    contextInfo += ' IMPORTANTE: Use o nome EXATO do produto. Não invente outro nome.';
  } else if (context.category) {
    contextInfo = `Categoria REAL: "${context.category.name}". Use o nome EXATO da categoria.`;
  }

  if (context.mode === 'carousel' && context.slideCount) {
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

    const systemPrompt = `Você é um copywriter de e-commerce profissional. Gere textos em português brasileiro para banners de loja virtual.
Loja: "${context.storeName}".
${context.briefing ? `Briefing: "${context.briefing}".` : ''}
${contextInfo}
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

  const systemPrompt = `Você é um copywriter de e-commerce profissional. Gere textos em português brasileiro para um banner hero de loja virtual.
Loja: "${context.storeName}".
${context.briefing ? `Briefing: "${context.briefing}".` : ''}
${contextInfo}`;

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
    const { tenantId, blockType, mode, scope: requestedScope, collectedData } = body;

    // --- Validation ---
    if (!tenantId || !blockType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenantId or blockType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Scope: images | texts | all (default: all)
    const scope: string = ['images', 'texts', 'all'].includes(requestedScope) ? requestedScope : 'all';
    const generateImages = scope === 'images' || scope === 'all';
    const generateTextsFlag = scope === 'texts' || scope === 'all';

    // --- Resolve contract server-side ---
    const contract = resolveContract(blockType, mode);
    if (!contract) {
      console.error(`[ai-block-fill-visual] Unknown blockType/mode: ${blockType}:${mode}`);
      return new Response(
        JSON.stringify({ success: false, error: `Bloco não suportado: ${blockType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Sanitize briefing ---
    const briefing = typeof collectedData?.briefing === 'string'
      ? collectedData.briefing.replace(/<[^>]*>/g, '').substring(0, MAX_BRIEFING_LENGTH).trim()
      : undefined;

    // --- Environment ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração do servidor incompleta (Supabase)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Chave de IA não configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Store name ---
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .single();
    const storeName = storeSettings?.store_name || "Loja";

    // --- Resolve association context with FULL product/category data ---
    let productCtx: ProductContext | null = null;
    let categoryCtx: CategoryContext | null = null;
    let associationType: string | undefined;

    if (mode === 'single' || !mode) {
      const assoc = collectedData?.association;
      if (assoc) {
        associationType = assoc.associationType;
        if (assoc.associationType === 'product' && assoc.productId) {
          productCtx = await fetchProductContext(supabase, assoc.productId);
        } else if (assoc.associationType === 'category' && assoc.categoryId) {
          categoryCtx = await fetchCategoryContext(supabase, assoc.categoryId);
        }
      }
    }

    // =============================================
    // BANNER SINGLE
    // =============================================
    if (blockType === 'Banner' && (!mode || mode === 'single')) {
      console.log(`[ai-block-fill-visual] Banner:single scope=${scope}`);

      const generatedProps: Record<string, unknown> = {};

      // Generate images (only if scope includes images)
      if (generateImages) {
        const imagePromises = contract.imageSpecs.map(async (spec) => {
          const prompt = buildBannerImagePrompt(spec, {
            briefing,
            product: productCtx,
            category: categoryCtx,
            associationType,
            storeName,
          });

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

        const imageResults = await Promise.all(imagePromises);
        for (const img of imageResults) {
          if (contract.aiGenerates.includes(img.key)) {
            generatedProps[img.key] = img.url;
          }
        }
      }

      // Generate texts (only if scope includes texts)
      if (generateTextsFlag) {
        const textResult = await generateTexts(contract, {
          blockType,
          mode: 'single',
          briefing,
          product: productCtx,
          category: categoryCtx,
          associationType,
          storeName,
        }, { supabaseUrl, supabaseServiceKey });

        if (contract.aiGenerates.includes('title')) {
          generatedProps.title = textResult.title || '';
        }
        if (contract.aiGenerates.includes('subtitle')) {
          generatedProps.subtitle = textResult.subtitle || '';
        }
        if (contract.aiGenerates.includes('buttonText')) {
          generatedProps.buttonText = textResult.buttonText || '';
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Banner:single done in ${elapsed}ms`);

      try {
        const usageCents = (generateImages ? 8 : 0) + (generateTextsFlag ? 2 : 0);
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: usageCents });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =============================================
    // BANNER CAROUSEL
    // =============================================
    if (blockType === 'Banner' && mode === 'carousel') {
      let slideCount = typeof collectedData?.slideCount === 'number' ? collectedData.slideCount : 1;
      slideCount = Math.min(slideCount, contract.maxSlides || 3);
      slideCount = Math.max(slideCount, 1);

      console.log(`[ai-block-fill-visual] Banner:carousel slides=${slideCount} scope=${scope}`);

      // Resolve per-slide associations with full data
      const slideContexts: Array<{
        product?: ProductContext | null;
        category?: CategoryContext | null;
        associationType?: string;
        briefing?: string;
      }> = [];

      for (let i = 0; i < slideCount; i++) {
        const slideData = collectedData?.[`slideAssociations_${i}`];
        let product: ProductContext | null = null;
        let category: CategoryContext | null = null;
        let type: string | undefined;

        if (slideData) {
          type = slideData.associationType;
          if (slideData.associationType === 'product' && slideData.productId) {
            product = await fetchProductContext(supabase, slideData.productId);
          } else if (slideData.associationType === 'category' && slideData.categoryId) {
            category = await fetchCategoryContext(supabase, slideData.categoryId);
          }
        }

        slideContexts.push({
          product,
          category,
          associationType: type,
          briefing: briefing,
        });
      }

      const generatedSlides: any[] = [];

      // Generate images for all slides (if scope includes images)
      let slideImages: Record<number, Record<string, string>> = {};
      if (generateImages) {
        const imagePromises: Array<Promise<{ slideIndex: number; key: string; url: string }>> = [];

        for (let i = 0; i < slideCount; i++) {
          for (const spec of contract.imageSpecs) {
            imagePromises.push(
              (async () => {
                const prompt = buildBannerImagePrompt(spec, {
                  briefing: slideContexts[i]?.briefing,
                  product: slideContexts[i]?.product,
                  category: slideContexts[i]?.category,
                  associationType: slideContexts[i]?.associationType,
                  storeName,
                  slideIndex: i,
                });

                let dataUrl = await callImageModel(lovableApiKey, "google/gemini-3-pro-image-preview", prompt);
                if (!dataUrl) {
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

        const imageResults = await Promise.all(imagePromises);
        for (const img of imageResults) {
          if (!slideImages[img.slideIndex]) slideImages[img.slideIndex] = {};
          slideImages[img.slideIndex][img.key] = img.url;
        }
      }

      // Generate texts for all slides (if scope includes texts)
      let textSlides: any[] = [];
      if (generateTextsFlag) {
        const textResult = await generateTexts(contract, {
          blockType,
          mode: 'carousel',
          briefing,
          product: slideContexts[0]?.product,
          category: slideContexts[0]?.category,
          associationType: slideContexts[0]?.associationType,
          storeName,
          slideCount,
        }, { supabaseUrl, supabaseServiceKey });
        textSlides = (textResult as any).slides || [];
      }

      // Build slides array
      for (let i = 0; i < slideCount; i++) {
        const images = slideImages[i] || {};
        const texts = textSlides[i] || {};
        const slideData = collectedData?.[`slideAssociations_${i}`];

        // linkUrl derived by SYSTEM from association
        let linkUrl = '';
        if (slideData) {
          if (slideData.associationType === 'product' && slideData.productId) {
            const ctx = slideContexts[i]?.product;
            linkUrl = ctx?.slug ? `/produto/${ctx.slug}` : `__product:${slideData.productId}`;
          } else if (slideData.associationType === 'category' && slideData.categoryId) {
            const ctx = slideContexts[i]?.category;
            linkUrl = ctx?.slug ? `/categoria/${ctx.slug}` : `__category:${slideData.categoryId}`;
          } else if (slideData.associationType === 'url' && slideData.manualUrl) {
            linkUrl = slideData.manualUrl;
          }
        }

        generatedSlides.push({
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

      const generatedProps = { slides: generatedSlides };

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Banner:carousel done in ${elapsed}ms (${slideCount} slides)`);

      try {
        const usageCents = (generateImages ? 8 * slideCount : 0) + (generateTextsFlag ? 2 : 0);
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: usageCents });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
