// =============================================
// AI BLOCK FILL VISUAL v2.3.0 — Banner Quality Phase (Track A)
// Fixes: art direction, copy quality, legibility defaults
// Server-side registry: backend resolve contrato internamente
// Frontend envia: blockType, mode, scope, collectedData, tenantId
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "2.3.0";
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
  price?: number;
  compareAtPrice?: number;
  mainImageUrl?: string;
}

interface CategoryContext {
  name: string;
  slug?: string;
}

interface StoreContext {
  storeName: string;
  storeDescription?: string;
}

async function fetchProductContext(supabase: any, productId: string): Promise<ProductContext | null> {
  // Fetch product base data
  const { data: product } = await supabase
    .from("products")
    .select("name, description, slug, price, compare_at_price")
    .eq("id", productId)
    .single();
  if (!product) return null;
  
  // Fetch primary image from product_images table (source of truth)
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
// IMAGE GENERATION HELPERS
// =============================================

async function callImageModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceImageUrl?: string,
): Promise<string | null> {
  // Build content: text-only or multimodal (text + image reference)
  let content: any;
  if (referenceImageUrl) {
    content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: referenceImageUrl } },
    ];
  } else {
    content = prompt;
  }

  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + lovableApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
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
// IMAGE PROMPT BUILDER — Uses real product data + store context
// =============================================

function buildBannerImagePrompt(
  spec: ServerImageSpec,
  context: {
    briefing?: string;
    product?: ProductContext | null;
    category?: CategoryContext | null;
    associationType?: string;
    store: StoreContext;
    slideIndex?: number;
  }
): string {
  const isDesktop = spec.key === 'imageDesktop';

  // Build rich product context
  let subjectDescription = 'Produtos variados da loja em composição premium.';
  let productImageNote = '';
  if (context.product) {
    subjectDescription = `O produto "${context.product.name}"`;
    if (context.product.description) {
      subjectDescription += ` — ${context.product.description.substring(0, 200)}`;
    }
    subjectDescription += '.';
    if (context.product.mainImageUrl) {
      productImageNote = `REFERÊNCIA VISUAL: Uma foto do produto real foi anexada. Reproduza FIELMENTE a cor, forma, embalagem e textura do produto na composição do banner. O produto no banner deve ser reconhecível como o mesmo da foto.`;
    }
  } else if (context.category) {
    subjectDescription = `Produtos da categoria "${context.category.name}" em composição premium.`;
  }

  // Store identity
  let storeIdentity = `Loja: "${context.store.storeName}".`;
  if (context.store.storeDescription) {
    storeIdentity += ` ${context.store.storeDescription.substring(0, 200)}.`;
  }

  const briefingLine = context.briefing ? `Briefing: "${context.briefing}".` : '';
  const slideNote = context.slideIndex !== undefined
    ? `Slide ${context.slideIndex + 1} do carrossel — varie cenário/atmosfera.`
    : '';

  if (isDesktop) {
    return `CRIE UM BANNER HORIZONTAL DE E-COMMERCE. Proporção exata: ${spec.width}x${spec.height}px (21:7 ultra-wide).

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}

COMPOSIÇÃO OBRIGATÓRIA (DESKTOP):
- O PRODUTO deve ocupar o TERÇO DIREITO da imagem (~30-40% da largura), bem enquadrado e em destaque.
- O TERÇO ESQUERDO (~60% da largura) DEVE ter fundo escuro, gradiente natural ou área de baixo contraste. Esta zona será usada para overlay de texto branco — ela PRECISA ser escura o suficiente para texto branco ser legível.
- O gradiente deve ser NATURAL e integrado ao cenário (iluminação lateral, sombra ambiente, fundo escurecido), não um retângulo de cor sólida.
- Transição suave entre a zona escura e a zona do produto.

DIREÇÃO DE ARTE:
- Fotografia comercial profissional, iluminação de estúdio com dramática lateral.
- Fundo contextual rico (superfície, textura, ambiente) — NUNCA fundo branco chapado.
- Profundidade de campo com bokeh suave no fundo.
- Cores vibrantes e harmônicas. Qualidade 4K.

PROIBIÇÕES ABSOLUTAS:
- ❌ NENHUM texto, letra, número, logo ou badge na imagem
- ❌ NENHUMA pessoa, mão ou modelo
- ❌ NENHUM fundo branco ou cinza claro chapado
- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras)`;
  } else {
    return `CRIE UM BANNER VERTICAL PARA MOBILE. Proporção exata: ${spec.width}x${spec.height}px.

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}

COMPOSIÇÃO OBRIGATÓRIA (MOBILE):
- O TERÇO SUPERIOR da imagem DEVE ser escuro/gradiente natural para receber texto branco sobreposto.
- O PRODUTO deve estar no CENTRO-INFERIOR (~50-60% inferior), bem enquadrado e protagonista.
- O gradiente escuro no topo deve ser NATURAL (iluminação de cima, sombra ambiente), integrado ao cenário.
- Transição suave entre a zona escura superior e a zona do produto.

DIREÇÃO DE ARTE:
- Fotografia comercial profissional, iluminação de estúdio.
- Fundo contextual (superfície, textura) — NUNCA fundo branco chapado.
- Enquadramento pensado para tela estreita. Produto centralizado.
- Cores vibrantes e harmônicas. Qualidade 4K.

PROIBIÇÕES ABSOLUTAS:
- ❌ NENHUM texto, letra, número, logo ou badge na imagem
- ❌ NENHUMA pessoa, mão ou modelo
- ❌ NENHUM fundo branco ou cinza claro chapado
- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras)`;
  }
}

// =============================================
// COPY QUALITY HELPERS
// =============================================

/** Detect creative tone from context — promotional, institutional, premium, or category */
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
  // Default: institutional/brand
  if (!product && !category) return {
    tone: 'institucional',
    toneInstruction: 'TOM INSTITUCIONAL: Confiança + identidade de marca. Use valores da loja. Palavras como "Qualidade", "Cuidado", "Confiança". CTA genérico mas firme (ex: "Visitar loja", "Ver novidades").',
  };
  // Product without promo/premium
  return {
    tone: 'produto',
    toneInstruction: 'TOM DE PRODUTO: Benefício + ação direta. Destaque o que o produto faz de especial. CTA específico ao produto (ex: "Comprar Sérum", "Ver detalhes"). NUNCA use "Comprar agora" se o nome do produto está disponível.',
  };
}

/** System prompt for copy generation — enforces quality, tone, and char limits */
function COPY_SYSTEM_PROMPT(storeInfo: string, contextInfo: string, briefing?: string, toneInstruction?: string): string {
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

${toneInstruction || ''}

VARIAÇÃO OBRIGATÓRIA:
- NUNCA comece 2 ou mais titles com o mesmo verbo (especialmente "Descubra" ou "Conheça").
- NUNCA use "Saiba mais" ou "Comprar agora" como CTA se existe o nome do produto/categoria disponível. Prefira CTAs específicos (ex: "Comprar Sérum", "Ver Linha Solar").
- Cada slide (se carousel) DEVE ter abordagem e vocabulário distintos.

${storeInfo}
${contextInfo}
${briefing ? `Briefing: "${briefing}".` : ''}

EXEMPLOS DE BOA COPY:
- title: "Novo Sérum Facial" (18 chars) ✅
- title: "Descubra o poder da hidratação profunda para sua pele" (54 chars) ❌ MUITO LONGO
- subtitle: "Hidratação profunda por 24h" (27 chars) ✅
- buttonText: "Comprar Sérum" (13 chars) ✅ (específico)
- buttonText: "Comprar agora" (13 chars) ⚠️ (genérico, evitar se nome disponível)
- buttonText: "Aproveite esta oferta incrível" (30 chars) ❌ MUITO LONGO`;
}

/** Truncate texts as safety net — model should respect limits but this guarantees it */
function truncateTexts(result: any): any {
  if (result.title && typeof result.title === 'string') {
    result.title = result.title.substring(0, 30);
  }
  if (result.subtitle && typeof result.subtitle === 'string') {
    result.subtitle = result.subtitle.substring(0, 60);
  }
  if (result.buttonText && typeof result.buttonText === 'string') {
    result.buttonText = result.buttonText.substring(0, 15);
  }
  if (Array.isArray(result.slides)) {
    result.slides = result.slides.map((s: any) => ({
      ...s,
      title: s.title ? String(s.title).substring(0, 30) : '',
      subtitle: s.subtitle ? String(s.subtitle).substring(0, 60) : '',
      buttonText: s.buttonText ? String(s.buttonText).substring(0, 15) : '',
    }));
  }
  return result;
}

// =============================================
// TEXT GENERATION — Uses real product data
// =============================================

/** Build context info string from product/category data */
function buildContextInfo(product?: ProductContext | null, category?: CategoryContext | null): string {
  if (product) {
    let info = `Produto REAL: "${product.name}".`;
    if (product.description) {
      info += ` Descrição: "${product.description.substring(0, 300)}".`;
    }
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

interface SlideContext {
  product?: ProductContext | null;
  category?: CategoryContext | null;
  associationType?: string;
  briefing?: string;
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
  if (context.store.storeDescription) {
    storeInfo += ` Sobre: "${context.store.storeDescription.substring(0, 200)}".`;
  }

  if (context.mode === 'carousel' && context.slideCount && context.slideContexts) {
    // Build per-slide context info for the prompt
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
                  title: { type: "string", description: "Headline curta e impactante. MÁXIMO 30 caracteres. Verbo de ação ou benefício direto." },
                  subtitle: { type: "string", description: "Texto de apoio. MÁXIMO 60 caracteres. Complementar ao title, sem repetir." },
                  buttonText: { type: "string", description: "Texto do botão CTA. MÁXIMO 15 caracteres. Ação clara e específica ao produto/categoria do slide." },
                  altText: { type: "string", description: "Texto alt acessível descrevendo a imagem do banner." },
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

    // Use first slide's context for overall tone detection
    const firstSlideCtx = context.slideContexts[0];
    const tone = detectCreativeTone(firstSlideCtx?.product, firstSlideCtx?.category, context.briefing, firstSlideCtx?.associationType);
    const systemPrompt = COPY_SYSTEM_PROMPT(storeInfo, perSlideContexts, context.briefing, tone.toneInstruction);

    const { data } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere textos para ${context.slideCount} slides de banner. CADA SLIDE tem seu próprio contexto (produto ou categoria diferente). Os textos de cada slide DEVEM refletir o produto/categoria específico daquele slide. Varie verbos e abordagem entre slides. Respeite os limites de caracteres rigorosamente.` },
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
          title: { type: "string", description: "Headline curta e impactante. MÁXIMO 30 caracteres. Verbo de ação ou benefício direto. Use o nome real do produto." },
          subtitle: { type: "string", description: "Texto de apoio. MÁXIMO 60 caracteres. Complementar ao title, sem repetir. Destaque benefício ou oferta." },
          buttonText: { type: "string", description: "Texto do botão CTA. MÁXIMO 15 caracteres. Ação específica ao produto/categoria (ex: 'Comprar Sérum', não 'Comprar agora')." },
          altText: { type: "string", description: "Texto alt acessível descrevendo a imagem do banner." },
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

    // --- Store context (name + description) ---
    const storeCtx = await fetchStoreContext(supabase, tenantId);
    console.log(`[ai-block-fill-visual] Store: "${storeCtx.storeName}", desc: ${storeCtx.storeDescription ? 'yes' : 'no'}`);

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
            store: storeCtx,
          });

          // Pass product image as multimodal reference when available
          const refImage = productCtx?.mainImageUrl || undefined;
          let dataUrl = await callImageModel(lovableApiKey, "google/gemini-3-pro-image-preview", prompt, refImage);
          if (!dataUrl) {
            console.log(`[ai-block-fill-visual] Pro failed for ${spec.key}, trying 3.1-flash...`);
            dataUrl = await callImageModel(lovableApiKey, "google/gemini-3.1-flash-image-preview", prompt, refImage);
          }
          if (!dataUrl) {
            console.log(`[ai-block-fill-visual] 3.1-flash failed for ${spec.key}, trying 2.5-flash...`);
            dataUrl = await callImageModel(lovableApiKey, "google/gemini-2.5-flash-image", prompt, refImage);
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
          store: storeCtx,
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

      // System-derived legibility props when generating image + text together
      if (generateImages && generateTextsFlag) {
        generatedProps.overlayOpacity = 35;
        generatedProps.alignment = 'left';
      } else if (generateImages) {
        // Even image-only: set overlay for future text additions
        generatedProps.overlayOpacity = 35;
        generatedProps.alignment = 'left';
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
                  store: storeCtx,
                  slideIndex: i,
                });

                // Pass product image as multimodal reference when available
                const refImage = slideContexts[i]?.product?.mainImageUrl || undefined;
                let dataUrl = await callImageModel(lovableApiKey, "google/gemini-3-pro-image-preview", prompt, refImage);
                if (!dataUrl) {
                  console.log(`[ai-block-fill-visual] Pro failed for slide ${i} ${spec.key}, trying 3.1-flash...`);
                  dataUrl = await callImageModel(lovableApiKey, "google/gemini-3.1-flash-image-preview", prompt, refImage);
                }
                if (!dataUrl) {
                  console.log(`[ai-block-fill-visual] 3.1-flash failed for slide ${i} ${spec.key}, trying 2.5-flash...`);
                  dataUrl = await callImageModel(lovableApiKey, "google/gemini-2.5-flash-image", prompt, refImage);
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
          store: storeCtx,
          slideCount,
          slideContexts,
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
