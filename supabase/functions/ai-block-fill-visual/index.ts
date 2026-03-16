// =============================================
// AI BLOCK FILL VISUAL v3.0.0 — Visual Engine Integration
// Uses shared visual engine + block adapters architecture
// Server-side registry: backend resolve contrato internamente
// Frontend envia: blockType, mode, scope, collectedData, tenantId
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";
import { generateForRequest, uploadToStorage } from "../_shared/visual-engine.ts";
import { BannerAdapter } from "../_shared/visual-adapters/banner-adapter.ts";
import { ImageAdapter } from "../_shared/visual-adapters/image-adapter.ts";
import { ContentColumnsAdapter } from "../_shared/visual-adapters/content-columns-adapter.ts";
import { BannerProductsAdapter } from "../_shared/visual-adapters/banner-products-adapter.ts";
import type {
  ProductContext,
  CategoryContext,
  StoreContext,
  SlideContext,
  AdapterInput,
  OutputMode,
  ImageStyle,
} from "../_shared/visual-adapters/types.ts";

const VERSION = "3.0.0";
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
      { key: 'imageDesktop', width: 1920, height: 800 },
      { key: 'imageMobile', width: 750, height: 940 },
    ],
  },
  'Banner:carousel': {
    aiGenerates: ['slides'],
    imageSpecs: [
      { key: 'imageDesktop', width: 1920, height: 800 },
      { key: 'imageMobile', width: 750, height: 940 },
    ],
    maxSlides: 3,
  },
  'Image': {
    aiGenerates: ['imageDesktop', 'imageMobile'],
    imageSpecs: [
      { key: 'imageDesktop', width: 1200, height: 800 },
      { key: 'imageMobile', width: 800, height: 1000 },
    ],
  },
  'ContentColumns': {
    aiGenerates: ['imageDesktop', 'imageMobile'],
    imageSpecs: [
      { key: 'imageDesktop', width: 800, height: 600 },
      { key: 'imageMobile', width: 600, height: 800 },
    ],
  },
  'BannerProducts': {
    aiGenerates: ['imageDesktop', 'imageMobile', 'title', 'description'],
    imageSpecs: [
      { key: 'imageDesktop', width: 600, height: 400 },
      { key: 'imageMobile', width: 400, height: 500 },
    ],
  },
};

function resolveContract(blockType: string, mode?: string): ServerContract | null {
  const key = mode ? `${blockType}:${mode}` : blockType;
  return SERVER_CONTRACTS[key] || null;
}

// =============================================
// ADAPTER REGISTRY
// =============================================

const bannerAdapter = new BannerAdapter();
const imageAdapter = new ImageAdapter();
const contentColumnsAdapter = new ContentColumnsAdapter();
const bannerProductsAdapter = new BannerProductsAdapter();

function getAdapter(blockType: string) {
  switch (blockType) {
    case 'Banner': return bannerAdapter;
    case 'Image': return imageAdapter;
    case 'ContentColumns': return contentColumnsAdapter;
    case 'BannerProducts': return bannerProductsAdapter;
    default: return null;
  }
}

// =============================================
// PRODUCT/CATEGORY DATA FETCHER (Source of Truth)
// =============================================

async function fetchProductContext(supabase: any, productId: string): Promise<ProductContext | null> {
  const { data: product } = await supabase
    .from("products")
    .select("name, description, slug, price, compare_at_price")
    .eq("id", productId)
    .single();
  if (!product) return null;
  
  const { data: images } = await supabase
    .from("product_images")
    .select("url, is_primary, sort_order")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1);
  
  const mainImageUrl = images?.[0]?.url || undefined;
  
  return {
    name: product.name,
    description: product.description || undefined,
    slug: product.slug || undefined,
    price: product.price || undefined,
    compareAtPrice: product.compare_at_price || undefined,
    mainImageUrl,
  };
}

async function fetchStoreContext(supabase: any, tenantId: string): Promise<StoreContext> {
  const { data } = await supabase
    .from("store_settings")
    .select("store_name, store_description")
    .eq("tenant_id", tenantId)
    .single();
  return {
    storeName: data?.store_name || "Loja",
    storeDescription: data?.store_description || undefined,
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
// COPY QUALITY HELPERS
// =============================================

function detectCreativeTone(
  product?: ProductContext | null,
  category?: CategoryContext | null,
  briefing?: string,
  associationType?: string,
): { tone: string; toneInstruction: string } {
  const briefingLower = (briefing || '').toLowerCase();
  const hasDiscount = product?.compareAtPrice && product?.price && product.compareAtPrice > product.price;
  const isPromo = briefingLower.includes('oferta') || briefingLower.includes('desconto') || briefingLower.includes('promoção') || briefingLower.includes('promo') || hasDiscount;
  const isPremium = briefingLower.includes('premium') || briefingLower.includes('luxo') || briefingLower.includes('exclusiv');
  const isCategory = associationType === 'category' || (category && !product);

  if (isPromo) return {
    tone: 'promocional',
    toneInstruction: 'TOM PROMOCIONAL: Urgência + benefício direto. Destaque preço/desconto se disponível. Use verbos como "Aproveite", "Garanta", "Economize". CTA com ação específica (ex: "Comprar Sérum", não "Comprar agora").',
  };
  if (isPremium) return {
    tone: 'premium',
    toneInstruction: 'TOM PREMIUM: Exclusividade + craft. Use linguagem sofisticada sem ser rebuscada. Palavras como "Edição limitada", "Formulação exclusiva", "Experiência única". CTA elegante (ex: "Experimentar", "Conhecer linha").',
  };
  if (isCategory) return {
    tone: 'categoria',
    toneInstruction: 'TOM DE CATEGORIA: Exploração + variedade. Convide a descobrir a coleção. Use verbos como "Explore", "Encontre", "Confira". CTA direcionado (ex: "Ver coleção", "Explorar linha").',
  };
  if (!product && !category) return {
    tone: 'institucional',
    toneInstruction: 'TOM INSTITUCIONAL: Confiança + identidade de marca. Use valores da loja. Palavras como "Qualidade", "Cuidado", "Confiança". CTA genérico mas firme (ex: "Visitar loja", "Ver novidades").',
  };
  return {
    tone: 'produto',
    toneInstruction: 'TOM DE PRODUTO: Benefício + ação direta. Destaque o que o produto faz de especial. CTA específico ao produto (ex: "Comprar Sérum", "Ver detalhes"). NUNCA use "Comprar agora" se o nome do produto está disponível.',
  };
}

function COPY_SYSTEM_PROMPT(storeInfo: string, contextInfo: string, briefing?: string, toneInstruction?: string): string {
  const briefingLower = (briefing || '').toLowerCase();
  const hasOffer = /\d+%|desconto|oferta|promoção|frete grátis|cupom/.test(briefingLower);
  const hasCampaign = /páscoa|natal|black friday|dia das mães|dia dos pais|dia dos namorados|carnaval|ano novo/.test(briefingLower);

  let briefingDirective = '';
  if (hasOffer || hasCampaign) {
    briefingDirective = `
REGRA CRÍTICA DE BRIEFING:
- O briefing do usuário contém informação de ${hasOffer ? 'OFERTA/DESCONTO' : 'CAMPANHA'} que DEVE aparecer na headline ou subtitle.
- ${hasOffer ? 'A informação de desconto/oferta (ex: "até 35% OFF", "Frete Grátis") DEVE aparecer de forma proeminente na headline OU subtitle.' : ''}
- ${hasCampaign ? 'O nome/tema da campanha (ex: "Páscoa", "Black Friday") DEVE aparecer na headline OU subtitle.' : ''}
- O banner deve parecer peça de CAMPANHA COMERCIAL REAL, não descrição genérica de produto.`;
  }

  return `Você é um copywriter SÊNIOR de e-commerce brasileiro. Gere textos para banners de loja virtual.

REGRAS OBRIGATÓRIAS:
1. Português brasileiro CORRETO, sem erros gramaticais.
2. Tom profissional e direto. Sem gírias, sem emojis, sem exageros.
3. LIMITES RÍGIDOS DE CARACTERES (conte cuidadosamente):
   - title (headline): MÁXIMO 30 caracteres. Curta, impactante, com verbo de ação ou benefício.
   - subtitle: MÁXIMO 60 caracteres. Complementar ao title, SEM repetir palavras do title.
   - buttonText (CTA): MÁXIMO 15 caracteres. Ação clara e direta.
4. Use o nome REAL do produto/categoria fornecido. NUNCA invente nomes ou características.
5. Se houver preço/oferta, destaque naturalmente (ex: "A partir de R$ X").
6. Cada campo deve funcionar SOZINHO — não depender dos outros para fazer sentido.
7. O banner deve parecer PEÇA COMERCIAL PROFISSIONAL — com impacto visual e força de venda.

${toneInstruction || ''}
${briefingDirective}

VARIAÇÃO OBRIGATÓRIA:
- NUNCA comece 2 ou mais titles com o mesmo verbo (especialmente "Descubra" ou "Conheça").
- NUNCA use "Saiba mais" ou "Comprar agora" como CTA se existe o nome do produto/categoria disponível. Prefira CTAs específicos (ex: "Comprar Sérum", "Ver Linha Solar").
- Cada slide (se carousel) DEVE ter abordagem e vocabulário distintos.

${storeInfo}
${contextInfo}
${briefing ? `Briefing do usuário: "${briefing}". ESTA É A DIREÇÃO CRIATIVA PRIMÁRIA — os textos devem refletir este briefing.` : ''}

EXEMPLOS DE BOA COPY:
- title: "Páscoa até 35% OFF" (19 chars) ✅ (campanha + oferta)
- title: "Novo Sérum Facial" (18 chars) ✅
- subtitle: "Ofertas especiais por tempo limitado" (35 chars) ✅
- buttonText: "Comprar Sérum" (13 chars) ✅ (específico)
- buttonText: "Comprar agora" (13 chars) ⚠️ (genérico, evitar se nome disponível)`;
}

/**
 * Strip any HTML tags, entities, and garbage from AI-generated text.
 */
function sanitizeText(text: unknown): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/&[a-zA-Z]+;/g, '')       // Remove HTML entities
    .replace(/&\#\d+;/g, '')           // Remove numeric entities
    .replace(/[\u0000-\u001F]/g, '')   // Remove control characters
    .trim();
}

function truncateTexts(result: any): any {
  if (result.title && typeof result.title === 'string') result.title = sanitizeText(result.title).substring(0, 30);
  if (result.subtitle && typeof result.subtitle === 'string') result.subtitle = sanitizeText(result.subtitle).substring(0, 60);
  if (result.buttonText && typeof result.buttonText === 'string') result.buttonText = sanitizeText(result.buttonText).substring(0, 15);
  if (Array.isArray(result.slides)) {
    result.slides = result.slides.map((s: any) => ({
      ...s,
      title: sanitizeText(s.title).substring(0, 30),
      subtitle: sanitizeText(s.subtitle).substring(0, 60),
      buttonText: sanitizeText(s.buttonText).substring(0, 15),
    }));
  }
  return result;
}

// =============================================
// TEXT GENERATION
// =============================================

function buildContextInfo(product?: ProductContext | null, category?: CategoryContext | null): string {
  if (product) {
    let info = `Produto REAL: "${product.name}".`;
    if (product.description) info += ` Descrição: "${product.description.substring(0, 300)}".`;
    if (product.price) {
      const formatted = `R$ ${product.price.toFixed(2).replace('.', ',')}`;
      info += ` Preço: ${formatted}.`;
      if (product.compareAtPrice && product.compareAtPrice > product.price) {
        const oldFormatted = `R$ ${product.compareAtPrice.toFixed(2).replace('.', ',')}`;
        info += ` De ${oldFormatted} por ${formatted}.`;
      }
    }
    info += ' IMPORTANTE: Use o nome EXATO do produto. Não invente outro nome ou produto.';
    return info;
  } else if (category) {
    return `Categoria REAL: "${category.name}". Use o nome EXATO da categoria.`;
  }
  return '';
}

async function generateTexts(
  contract: ServerContract,
  context: {
    blockType: string;
    mode: string;
    briefing?: string;
    product?: ProductContext | null;
    category?: CategoryContext | null;
    associationType?: string;
    store: StoreContext;
    slideCount?: number;
    slideContexts?: SlideContext[];
  },
  options: { supabaseUrl: string; supabaseServiceKey: string },
): Promise<Record<string, unknown>> {
  resetAIRouterCache();

  let storeInfo = `Loja: "${context.store.storeName}".`;
  if (context.store.storeDescription) storeInfo += ` Sobre: "${context.store.storeDescription.substring(0, 200)}".`;

  if (context.mode === 'carousel' && context.slideCount && context.slideContexts) {
    const perSlideContexts = context.slideContexts.map((sc, i) => {
      const info = buildContextInfo(sc.product, sc.category);
      const tone = detectCreativeTone(sc.product, sc.category, sc.briefing, sc.associationType);
      return `SLIDE ${i + 1}: ${info || 'Sem produto/categoria vinculado (use tom institucional).'}
Tom: ${tone.toneInstruction}`;
    }).join('\n\n');

    const tools = [{
      type: "function",
      function: {
        name: "generate_carousel_texts",
        description: `Generate compelling marketing text for ${context.slideCount} banner slides for an e-commerce store. Each slide has its own product/category context.`,
        parameters: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Headline curta e impactante. MÁXIMO 30 caracteres." },
                  subtitle: { type: "string", description: "Texto de apoio. MÁXIMO 60 caracteres." },
                  buttonText: { type: "string", description: "Texto do botão CTA. MÁXIMO 15 caracteres." },
                  altText: { type: "string", description: "Texto alt acessível." },
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

    const firstSlideCtx = context.slideContexts[0];
    const tone = detectCreativeTone(firstSlideCtx?.product, firstSlideCtx?.category, context.briefing, firstSlideCtx?.associationType);
    const systemPrompt = COPY_SYSTEM_PROMPT(storeInfo, perSlideContexts, context.briefing, tone.toneInstruction);

    const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere textos para ${context.slideCount} slides de banner. CADA SLIDE tem seu próprio contexto. Varie verbos e abordagem entre slides.` },
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
      return truncateTexts(parsed);
    }
    return { slides: [] };
  }

  // Single banner text generation
  const contextInfo = buildContextInfo(context.product, context.category);
  const tone = detectCreativeTone(context.product, context.category, context.briefing, context.associationType);

  const tools = [{
    type: "function",
    function: {
      name: "generate_banner_texts",
      description: "Generate compelling marketing text for a banner in an e-commerce store.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Headline curta e impactante. MÁXIMO 30 caracteres." },
          subtitle: { type: "string", description: "Texto de apoio. MÁXIMO 60 caracteres." },
          buttonText: { type: "string", description: "Texto do botão CTA. MÁXIMO 15 caracteres." },
          altText: { type: "string", description: "Texto alt acessível." },
        },
        required: ["title", "subtitle", "buttonText", "altText"],
        additionalProperties: false,
      },
    },
  }];

  const systemPrompt = COPY_SYSTEM_PROMPT(storeInfo, contextInfo, context.briefing, tone.toneInstruction);

  const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Gere textos para este banner hero. Respeite os limites de caracteres rigorosamente." },
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
    return truncateTexts(parsed);
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

    if (!tenantId || !blockType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenantId or blockType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scope: string = ['images', 'texts', 'all'].includes(requestedScope) ? requestedScope : 'all';
    const generateImages = scope === 'images' || scope === 'all';
    const generateTextsFlag = scope === 'texts' || scope === 'all';

    const contract = resolveContract(blockType, mode);
    if (!contract) {
      return new Response(
        JSON.stringify({ success: false, error: `Bloco não suportado: ${blockType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const briefing = typeof collectedData?.briefing === 'string'
      ? collectedData.briefing.replace(/<[^>]*>/g, '').substring(0, MAX_BRIEFING_LENGTH).trim()
      : undefined;

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
    const storeCtx = await fetchStoreContext(supabase, tenantId);
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || null;

    // Extract outputMode and creativeStyle from collectedData (Phase 1)
    const bannerModeData = collectedData?.bannerMode;
    const outputMode: OutputMode = bannerModeData?.outputMode || 'editable';
    const creativeStyle: ImageStyle = bannerModeData?.creativeStyle || 'product_natural';
    const styleConfig: Record<string, unknown> = bannerModeData?.styleConfig || {};

    // Debug: log full payload to verify propagation
    console.log(`[ai-block-fill-visual] PAYLOAD: blockType=${blockType} mode=${mode} scope=${scope} outputMode=${outputMode} creativeStyle=${creativeStyle}`);
    console.log(`[ai-block-fill-visual] styleConfig=${JSON.stringify(styleConfig)}`);
    console.log(`[ai-block-fill-visual] briefing="${briefing || '(none)'}"`);
    console.log(`[ai-block-fill-visual] bannerModeData=${JSON.stringify(bannerModeData)}`);
    console.log(`[ai-block-fill-visual] creativeStyleRaw=${JSON.stringify(collectedData?.creativeStyle)}`);

    // Resolve association context
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
    // BANNER — Uses Visual Engine + Adapter
    // =============================================
    if (blockType === 'Banner') {
      const adapter = getAdapter('Banner')!;
      const isSingle = !mode || mode === 'single';
      const isCarousel = mode === 'carousel';

      // Build slide contexts
      const slideContexts: SlideContext[] = [];

      if (isCarousel) {
        let slideCount = typeof collectedData?.slideCount === 'number' ? collectedData.slideCount : 2;
        slideCount = Math.min(slideCount, contract.maxSlides || 3);
        slideCount = Math.max(slideCount, 1);

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

          slideContexts.push({ product, category, associationType: type, briefing });
        }
      } else {
        slideContexts.push({ product: productCtx, category: categoryCtx, associationType, briefing });
      }

      const generatedProps: Record<string, unknown> = {};

      // ===== IMAGE GENERATION via Visual Engine =====
      if (generateImages) {
        const adapterInput: AdapterInput = {
          mode: mode || 'single',
          outputMode,
          creativeStyle,
          styleConfig,
          briefing: briefing || '',
          contexts: slideContexts,
          store: storeCtx,
          enableQA: false,
        };

        const requests = adapter.adapt(adapterInput);
        console.log(`[ai-block-fill-visual] Banner:${mode || 'single'} generating ${requests.length} request(s) via visual engine`);

        const results = await Promise.all(
          requests.map(r => generateForRequest(r, supabase, tenantId, lovableApiKey, openaiApiKey))
        );

        // Merge visual results back into props
        const mergedVisual = adapter.mergeResults(results, adapterInput);
        Object.assign(generatedProps, mergedVisual);
      }

      // ===== TEXT GENERATION (only for editable mode or when scope includes texts) =====
      if (generateTextsFlag && outputMode !== 'complete') {
        if (isCarousel) {
          const slideCount = slideContexts.length;
          const textResult = await generateTexts(contract, {
            blockType,
            mode: 'carousel',
            briefing,
            product: slideContexts[0]?.product,
            category: slideContexts[0]?.category,
            associationType: slideContexts[0]?.associationType,
            store: storeCtx,
            slideCount,
            slideContexts,
          }, { supabaseUrl, supabaseServiceKey });

          const textSlides = (textResult as any).slides || [];

          // Merge texts into existing slides from image generation
          if (Array.isArray(generatedProps.slides)) {
            const existingSlides = generatedProps.slides as any[];
            for (let i = 0; i < existingSlides.length; i++) {
              const texts = textSlides[i] || {};
              existingSlides[i].title = texts.title || '';
              existingSlides[i].subtitle = texts.subtitle || '';
              existingSlides[i].buttonText = texts.buttonText || '';
              existingSlides[i].altText = texts.altText || `Banner ${i + 1}`;

              // Derive linkUrl from association
              const slideData = collectedData?.[`slideAssociations_${i}`];
              if (slideData) {
                if (slideData.associationType === 'product' && slideData.productId) {
                  const ctx = slideContexts[i]?.product;
                  existingSlides[i].linkUrl = ctx?.slug ? `/produto/${ctx.slug}` : `__product:${slideData.productId}`;
                } else if (slideData.associationType === 'category' && slideData.categoryId) {
                  const ctx = slideContexts[i]?.category;
                  existingSlides[i].linkUrl = ctx?.slug ? `/categoria/${ctx.slug}` : `__category:${slideData.categoryId}`;
                } else if (slideData.associationType === 'url' && slideData.manualUrl) {
                  existingSlides[i].linkUrl = slideData.manualUrl;
                }
              }
            }
          } else if (generateImages) {
            // Images generated but no slides array — shouldn't happen for carousel
          } else {
            // Text-only carousel
            const slides = textSlides.map((t: any, i: number) => {
              const slideData = collectedData?.[`slideAssociations_${i}`];
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
              return {
                id: crypto.randomUUID(),
                imageDesktop: '',
                imageMobile: '',
                title: t.title || '',
                subtitle: t.subtitle || '',
                buttonText: t.buttonText || '',
                altText: t.altText || `Banner ${i + 1}`,
                linkUrl,
              };
            });
            generatedProps.slides = slides;
          }
        } else {
          // Single banner text
          const textResult = await generateTexts(contract, {
            blockType,
            mode: 'single',
            briefing,
            product: productCtx,
            category: categoryCtx,
            associationType,
            store: storeCtx,
          }, { supabaseUrl, supabaseServiceKey });

          if (contract.aiGenerates.includes('title')) generatedProps.title = textResult.title || '';
          if (contract.aiGenerates.includes('subtitle')) generatedProps.subtitle = textResult.subtitle || '';
          if (contract.aiGenerates.includes('buttonText')) generatedProps.buttonText = textResult.buttonText || '';
        }
      }

      // Complete mode: explicitly clear text fields and overlay
      if (outputMode === 'complete') {
        if (isSingle) {
          generatedProps._renderMode = 'baked';
          generatedProps._hideOverlayText = true;
          generatedProps.overlayOpacity = 0;
          generatedProps.title = '';
          generatedProps.subtitle = '';
          generatedProps.buttonText = '';
        }
        // For carousel, _renderMode and _hideOverlayText are set by the adapter mergeResults
      } else if (generateImages) {
        // Editable mode: set overlay + high-contrast button defaults for legibility
        if (isSingle) {
          generatedProps.overlayOpacity = 40;
          generatedProps.alignment = 'left';
          generatedProps.textColor = '#ffffff';
          generatedProps.buttonColor = '#ffffff';
          generatedProps.buttonTextColor = '#1a1a1a';
          generatedProps.buttonHoverBgColor = '#e0e0e0';
          generatedProps.buttonHoverTextColor = '#000000';
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Banner:${mode || 'single'} done in ${elapsed}ms (outputMode=${outputMode})`);

      try {
        const slideCount = isCarousel ? slideContexts.length : 1;
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

    // =============================================
    // IMAGE — Pure image block, no text generation
    // =============================================
    if (blockType === 'Image') {
      const adapter = getAdapter('Image')!;
      const generatedProps: Record<string, unknown> = {};

      // Pass aspectRatio from currentProps to adapter via styleConfig
      const imageStyleConfig = { ...styleConfig, _aspectRatio: collectedData?.currentProps?.aspectRatio || 'auto' };

      const adapterInput: AdapterInput = {
        outputMode: 'editable',
        creativeStyle,
        styleConfig: imageStyleConfig,
        briefing: briefing || '',
        contexts: [{ product: productCtx, category: categoryCtx, associationType }],
        store: storeCtx,
        enableQA: false,
      };

      const requests = adapter.adapt(adapterInput);
      console.log(`[ai-block-fill-visual] Image generating ${requests.length} request(s) via visual engine`);

      const results = await Promise.all(
        requests.map(r => generateForRequest(r, supabase, tenantId, lovableApiKey, openaiApiKey))
      );

      Object.assign(generatedProps, adapter.mergeResults(results, adapterInput));

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] Image done in ${elapsed}ms`);

      try {
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: 8 });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =============================================
    // CONTENT COLUMNS — Image-only (texts via aiFillable)
    // =============================================
    if (blockType === 'ContentColumns') {
      const adapter = getAdapter('ContentColumns')!;
      const generatedProps: Record<string, unknown> = {};

      const adapterInput: AdapterInput = {
        outputMode: 'editable',
        creativeStyle,
        styleConfig,
        briefing: briefing || '',
        contexts: [{ product: productCtx, category: categoryCtx, associationType }],
        store: storeCtx,
        enableQA: false,
      };

      const requests = adapter.adapt(adapterInput);
      console.log(`[ai-block-fill-visual] ContentColumns generating ${requests.length} request(s) via visual engine`);

      const results = await Promise.all(
        requests.map(r => generateForRequest(r, supabase, tenantId, lovableApiKey, openaiApiKey))
      );

      Object.assign(generatedProps, adapter.mergeResults(results, adapterInput));

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] ContentColumns done in ${elapsed}ms`);

      try {
        await supabase.rpc('record_ai_usage', { p_tenant_id: tenantId, p_usage_cents: 8 });
      } catch (e) {
        console.warn("[ai-block-fill-visual] Failed to record usage:", e);
      }

      return new Response(
        JSON.stringify({ success: true, generatedProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =============================================
    // BANNER PRODUCTS — Image + text generation
    // Grounding: first product from block's selection, or category
    // =============================================
    if (blockType === 'BannerProducts') {
      const adapter = getAdapter('BannerProducts')!;
      const generatedProps: Record<string, unknown> = {};

      // Resolve grounding from block's current products
      let bpProductCtx: ProductContext | null = null;
      let bpCategoryCtx: CategoryContext | null = null;

      const currentProps = collectedData?.currentProps || {};
      const source = currentProps.source || 'manual';

      if (source === 'manual' && Array.isArray(currentProps.productIds) && currentProps.productIds.length > 0) {
        // Use FIRST product as primary grounding (documented rule)
        bpProductCtx = await fetchProductContext(supabase, currentProps.productIds[0]);
        console.log(`[ai-block-fill-visual] BannerProducts grounding: first product "${bpProductCtx?.name || 'not found'}" (of ${currentProps.productIds.length} total)`);
      } else if (source === 'category' && currentProps.categoryId) {
        bpCategoryCtx = await fetchCategoryContext(supabase, currentProps.categoryId);
        console.log(`[ai-block-fill-visual] BannerProducts grounding: category "${bpCategoryCtx?.name || 'not found'}"`);
      }

      // Image generation
      if (generateImages) {
        const adapterInput: AdapterInput = {
          outputMode: 'editable',
          creativeStyle,
          styleConfig,
          briefing: briefing || '',
          contexts: [{ product: bpProductCtx, category: bpCategoryCtx }],
          store: storeCtx,
          enableQA: false,
        };

        const requests = adapter.adapt(adapterInput);
        console.log(`[ai-block-fill-visual] BannerProducts generating ${requests.length} request(s) via visual engine`);

        const results = await Promise.all(
          requests.map(r => generateForRequest(r, supabase, tenantId, lovableApiKey, openaiApiKey))
        );

        Object.assign(generatedProps, adapter.mergeResults(results, adapterInput));
      }

      // Text generation (title + description)
      if (generateTextsFlag) {
        const bpContract = resolveContract('BannerProducts')!;
        const textResult = await generateBannerProductsTexts(
          bpProductCtx,
          bpCategoryCtx,
          storeCtx,
          briefing,
          { supabaseUrl: supabaseUrl!, supabaseServiceKey: supabaseServiceKey! },
        );
        if (bpContract.aiGenerates.includes('title')) generatedProps.title = textResult.title || '';
        if (bpContract.aiGenerates.includes('description')) generatedProps.description = textResult.description || '';
      }

      const elapsed = Date.now() - startTime;
      console.log(`[ai-block-fill-visual] BannerProducts done in ${elapsed}ms`);

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
