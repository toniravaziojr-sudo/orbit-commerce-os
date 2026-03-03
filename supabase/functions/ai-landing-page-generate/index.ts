// =============================================
// AI LANDING PAGE GENERATE
// Edge function para gerar landing pages com IA
// Usa ai-router (Gemini/OpenAI) para geração de HTML
// v3.1.0: Gera criativos de imagem via Gemini Image antes do HTML
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "3.3.0"; // Drive access for tenant media assets

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ========== CREATIVE IMAGE GENERATION ==========

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("[AI-LP-Generate] Failed to download image:", e);
    return null;
  }
}

async function callImageModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceBase64: string,
): Promise<string | null> {
  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + lovableApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,' + referenceBase64 }
          }
        ]
      }],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[AI-LP-Generate] " + model + " error: " + response.status, errText.substring(0, 300));
    return null;
  }

  const data = await response.json();
  const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  return imageDataUrl || null;
}

async function uploadCreativeToStorage(
  supabase: any,
  tenantId: string,
  dataUrl: string,
  productName: string,
): Promise<string | null> {
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
    const filePath = tenantId + '/lp-creatives/hero-' + safeName + '-' + timestamp + '.png';

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(filePath, bytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error("[AI-LP-Generate] Upload error:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('store-assets')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;
    console.log("[AI-LP-Generate] Creative uploaded: " + publicUrl);
    return publicUrl || null;
  } catch (error) {
    console.error("[AI-LP-Generate] Upload creative error:", error);
    return null;
  }
}

async function generateHeroCreative(
  supabase: any,
  lovableApiKey: string,
  tenantId: string,
  productName: string,
  productImageUrl: string,
  storeName: string,
): Promise<string | null> {
  try {
    console.log('[AI-LP-Generate] Generating hero creative for "' + productName + '"...');

    const referenceBase64 = await imageUrlToBase64(productImageUrl);
    if (!referenceBase64) {
      console.warn("[AI-LP-Generate] Could not download reference image, skipping creative generation");
      return null;
    }

    const prompt = 'FOTOGRAFIA PUBLICITÁRIA DE ALTO IMPACTO para landing page de venda.\n\n' +
      'PRODUTO: "' + productName + '" pela marca "' + storeName + '"\n\n' +
      'OBJETIVO: Criar uma imagem hero profissional de alta conversão para landing page.\n\n' +
      'REGRAS ABSOLUTAS:\n' +
      '1. O produto na imagem de referência DEVE ser mantido EXATAMENTE como é — mesmo rótulo, mesmas cores, mesmo formato\n' +
      '2. NÃO altere o texto do rótulo, marca ou embalagem do produto\n' +
      '3. NÃO invente novos produtos ou embalagens\n\n' +
      'COMPOSIÇÃO:\n' +
      '- Produto em destaque central ou em posição hero (leve ângulo 3/4)\n' +
      '- Background profissional premium (gradiente escuro, superfície reflexiva, ou ambiente contextual)\n' +
      '- Iluminação de estúdio dramática com rim light sutil\n' +
      '- Sombra de contato realista\n' +
      '- Efeitos de brilho/reflexo sutis para transmitir qualidade premium\n' +
      '- Aspect ratio: 16:9 (paisagem) para hero banner\n\n' +
      'ESTILO: Fotografia de produto premium para e-commerce de alta conversão.\n' +
      'Qualidade de catálogo profissional. Ultra realista, sem aparência de IA.';

    // Try primary model
    let imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', prompt, referenceBase64);

    // Fallback to flash model
    if (!imageDataUrl) {
      console.log("[AI-LP-Generate] Trying fallback model google/gemini-2.5-flash-image...");
      imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', prompt, referenceBase64);
    }

    if (!imageDataUrl) {
      console.warn("[AI-LP-Generate] All image models failed");
      return null;
    }

    return await uploadCreativeToStorage(supabase, tenantId, imageDataUrl, productName);
  } catch (error) {
    console.error("[AI-LP-Generate] Creative generation error:", error);
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  landingPageId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  promptType: 'initial' | 'adjustment' | 'regenerate';
  referenceUrl?: string;
  productIds?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-Generate v${VERSION}] Starting...`);

  try {
    const body: GenerateRequest = await req.json();
    let { landingPageId, tenantId, userId, prompt, promptType, referenceUrl, productIds } = body;

    if (!landingPageId || !tenantId || !userId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ALWAYS fetch the landing page to get saved productIds and referenceUrl
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, current_version")
      .eq("id", landingPageId)
      .single();

    if (lpError) {
      console.error("[AI-LP-Generate] Error fetching landing page:", lpError);
      throw new Error("Landing page not found");
    }

    // Use saved values if not provided in request (important for adjustments!)
    productIds = productIds && productIds.length > 0 ? productIds : (savedLandingPage?.product_ids || []);
    referenceUrl = referenceUrl || savedLandingPage?.reference_url || undefined;

    console.log(`[AI-LP-Generate] Using ${productIds?.length || 0} products, referenceUrl: ${referenceUrl ? 'yes' : 'no'}`);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, contact_phone, contact_email, published_template_id")
      .eq("tenant_id", tenantId)
      .single();

    // Fetch published theme colors from template set (the REAL brand colors)
    let themeColors: Record<string, string> = {};
    if (storeSettings?.published_template_id) {
      const { data: templateSet } = await supabase
        .from("storefront_template_sets")
        .select("published_content")
        .eq("id", storeSettings.published_template_id)
        .eq("tenant_id", tenantId)
        .single();

      if (templateSet?.published_content) {
        const pc = templateSet.published_content as Record<string, any>;
        const ts = pc?.themeSettings?.colors;
        if (ts) {
          themeColors = ts;
          console.log("[AI-LP-Generate] Found published theme colors:", JSON.stringify(ts).substring(0, 200));
        }
      }
    }

    // ===== BUSINESS CONTEXT: Fetch reviews & creative assets =====
    let reviewsInfo = "";
    let creativesInfo = "";

    // Fetch product reviews for social proof context
    if (productIds && productIds.length > 0) {
      const { data: reviews } = await supabase
        .from("product_reviews")
        .select("reviewer_name, rating, comment, product_id")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("rating", { ascending: false })
        .limit(10);

      if (reviews && reviews.length > 0) {
        reviewsInfo = reviews.map(r => 
          `- ⭐ ${r.rating}/5 — "${r.comment}" (${r.reviewer_name || 'Cliente'})`
        ).join("\n");
        console.log(`[AI-LP-Generate] Found ${reviews.length} product reviews for context`);
      }
    }

    // Fetch recent creative assets for marketing tone/style
    const { data: creatives } = await supabase
      .from("ads_creative_assets")
      .select("headline, copy_text, angle, funnel_stage, format")
      .eq("tenant_id", tenantId)
      .in("status", ["ready", "published"])
      .not("copy_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (creatives && creatives.length > 0) {
      creativesInfo = creatives.map(c => {
        const parts = [];
        if (c.headline) parts.push(`Headline: "${c.headline}"`);
        if (c.copy_text) parts.push(`Copy: "${c.copy_text.slice(0, 200)}"`);
        if (c.angle) parts.push(`Ângulo: ${c.angle}`);
        if (c.funnel_stage) parts.push(`Estágio: ${c.funnel_stage}`);
        return `- ${parts.join(" | ")}`;
      }).join("\n");
      console.log(`[AI-LP-Generate] Found ${creatives.length} creative assets for tone context`);
    }

    // ===== DRIVE: Fetch tenant media assets from Drive =====
    let driveAssetsInfo = "";
    try {
      const { data: driveFiles } = await supabase
        .from("files")
        .select("filename, original_name, storage_path, mime_type, metadata")
        .eq("tenant_id", tenantId)
        .eq("is_folder", false)
        .like("mime_type", "image/%")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (driveFiles && driveFiles.length > 0) {
        // Only include files from public buckets (store-assets, media-assets)
        const publicAssets = driveFiles.filter(f => {
          const path = f.storage_path || "";
          const meta = f.metadata as Record<string, any> | null;
          const bucket = meta?.bucket || "";
          // Files in store-assets or media-assets are public
          return bucket === "store-assets" || bucket === "media-assets" || 
                 path.startsWith("tenants/");
        });

        if (publicAssets.length > 0) {
          const assetUrls = publicAssets.map(f => {
            const meta = f.metadata as Record<string, any> | null;
            // Use the URL from metadata if available, otherwise construct it
            if (meta?.url) return { name: f.original_name || f.filename, url: meta.url };
            
            const bucket = meta?.bucket || "store-assets";
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(f.storage_path!);
            return { name: f.original_name || f.filename, url: urlData?.publicUrl || "" };
          }).filter(a => a.url);

          if (assetUrls.length > 0) {
            driveAssetsInfo = assetUrls.map((a, i) => `  ${i + 1}. ${a.name}: ${a.url}`).join("\n");
            console.log(`[AI-LP-Generate] Found ${assetUrls.length} Drive assets for context`);
          }
        }
      }
    } catch (driveErr) {
      console.warn("[AI-LP-Generate] Drive fetch error (non-blocking):", driveErr);
    }

    // Fetch products if provided - include ALL relevant fields!
    let productsInfo = "";
    let productImages: string[] = [];
    if (productIds && productIds.length > 0) {
      console.log(`[AI-LP-Generate] Fetching product data for IDs: ${productIds.join(', ')}`);
      
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(`
          id, name, slug, sku, description, short_description,
          price, compare_at_price, cost_price,
          brand, vendor, product_type, tags,
          weight, width, height, depth,
          seo_title, seo_description
        `)
        .in("id", productIds);

      if (productsError) {
        console.error("[AI-LP-Generate] Error fetching products:", productsError);
      }

      if (products && products.length > 0) {
        console.log(`[AI-LP-Generate] Found ${products.length} products`);
        
        // Fetch ALL product images
        const { data: images, error: imagesError } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, alt_text, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (imagesError) {
          console.error("[AI-LP-Generate] Error fetching images:", imagesError);
        }

        console.log(`[AI-LP-Generate] Found ${images?.length || 0} product images`);

        const imagesByProduct = new Map<string, { url: string; alt_text: string | null; is_primary: boolean }[]>();
        images?.forEach(img => {
          if (!imagesByProduct.has(img.product_id)) {
            imagesByProduct.set(img.product_id, []);
          }
          imagesByProduct.get(img.product_id)!.push({ 
            url: img.url, 
            alt_text: img.alt_text,
            is_primary: img.is_primary 
          });
        });

        productsInfo = products.map(p => {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImage = prodImages.find(img => img.is_primary)?.url || prodImages[0]?.url;
          const allImageUrls = prodImages.map(img => img.url);
          
          // Collect all image URLs for the prompt
          if (primaryImage) productImages.push(primaryImage);
          allImageUrls.forEach(url => {
            if (url && !productImages.includes(url)) productImages.push(url);
          });

          // Prices are in REAIS (decimal) - DO NOT divide by 100
          const priceInReais = p.price;
          const compareAtPriceInReais = p.compare_at_price || null;
          
          const discountPercent = compareAtPriceInReais && compareAtPriceInReais > priceInReais
            ? Math.round(((compareAtPriceInReais - priceInReais) / compareAtPriceInReais) * 100)
            : null;

          return `
### Produto: ${p.name}
- **SKU**: ${p.sku || "N/A"}
- **Slug (URL)**: ${p.slug || "N/A"}
- **Descrição Curta**: ${p.short_description || "Sem descrição curta"}
- **Descrição Completa**: ${p.description || "Sem descrição disponível"}
- **Preço de Venda**: R$ ${priceInReais.toFixed(2).replace('.', ',')}
${compareAtPriceInReais ? `- **Preço Original (riscado)**: R$ ${compareAtPriceInReais.toFixed(2).replace('.', ',')}` : ""}
${discountPercent ? `- **Desconto**: ${discountPercent}% OFF` : ""}
${p.brand ? `- **Marca**: ${p.brand}` : ""}
${p.vendor ? `- **Fornecedor/Fabricante**: ${p.vendor}` : ""}
${p.product_type ? `- **Tipo de Produto**: ${p.product_type}` : ""}
${p.tags && p.tags.length > 0 ? `- **Tags**: ${p.tags.join(", ")}` : ""}
${p.weight ? `- **Peso**: ${p.weight}g` : ""}
${p.width && p.height && p.depth ? `- **Dimensões**: ${p.width} x ${p.height} x ${p.depth} cm` : ""}
${p.seo_title ? `- **SEO Title**: ${p.seo_title}` : ""}
${p.seo_description ? `- **SEO Description**: ${p.seo_description}` : ""}
- **Imagem Principal**: ${primaryImage || "SEM IMAGEM"}
- **TODAS AS IMAGENS REAIS DO PRODUTO**: 
${allImageUrls.length > 0 ? allImageUrls.map((url, i) => `  ${i + 1}. ${url}`).join("\n") : "  NENHUMA IMAGEM ENCONTRADA"}
          `;
        }).join("\n\n");
      }
    }

    // ===== GENERATE HERO CREATIVE IMAGE =====
    let generatedCreativeUrls: string[] = [];
    if (promptType !== "adjustment" && productImages.length > 0) {
      console.log(`[AI-LP-Generate] Starting hero creative generation...`);
      
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        // Get primary product name for the creative
        let primaryProductName = "Produto";
        if (productIds && productIds.length > 0) {
          const { data: primaryProd } = await supabase
            .from("products")
            .select("name")
            .eq("id", productIds[0])
            .single();
          if (primaryProd) primaryProductName = primaryProd.name;
        }
        
        const heroCreativeUrl = await generateHeroCreative(
          supabase,
          lovableApiKey,
          tenantId,
          primaryProductName,
          productImages[0], // Use primary product image as reference
          storeSettings?.store_name || "Loja",
        );
        
        if (heroCreativeUrl) {
          generatedCreativeUrls.push(heroCreativeUrl);
          console.log(`[AI-LP-Generate] Hero creative generated: ${heroCreativeUrl}`);
        } else {
          console.warn(`[AI-LP-Generate] Hero creative generation failed, will use catalog images`);
        }
      } else {
        console.warn(`[AI-LP-Generate] LOVABLE_API_KEY not found, skipping creative generation`);
      }
    }

    // Fetch current HTML if adjustment
    let currentHtml = "";
    if (promptType === "adjustment") {
      const { data: current } = await supabase
        .from("ai_landing_pages")
        .select("generated_html, current_version")
        .eq("id", landingPageId)
        .single();

      currentHtml = current?.generated_html || "";
    }

    // ===== BUILD SYSTEM PROMPT WITH DESIGN SYSTEM =====
    const primaryColor = storeSettings?.primary_color || "#6366f1";

    const systemPrompt = `Você é um diretor criativo e desenvolvedor front-end de elite, especialista em landing pages de altíssima conversão. Você cria páginas que parecem feitas por agências premium de R$50.000+.

## 🎯 PILAR 1 — DIREÇÃO CRIATIVA INTELIGENTE

Analise os dados do produto (tipo, tags, descrição, marca) e ESCOLHA uma direção visual que faça sentido para o nicho:

**Saúde / Beleza / Masculino** → Dark premium (#0a0a0a, #111), acentos dourados (#c9a96e), tipografia autoritária, badges de "Dermatologicamente testado", visual de autoridade médica
**Moda / Acessórios / Lifestyle** → Branco editorial, whitespace generoso, tipografia serifa elegante, grid assimétrico, visual de revista
**Tech / Eletrônicos / Gadgets** → Gradientes neon (purple→blue), glassmorphism, specs em grid, dark mode, visual futurista
**Alimentos / Bebidas / Orgânicos** → Tons quentes (terracota, verde oliva), texturas orgânicas, fotografia sensorial, visual artesanal
**Casa / Decoração / Artesanato** → Paleta neutra sofisticada, serif fonts, visual Pinterest-worthy
**Default (não identificado)** → Clean moderno com a cor primária da marca como acento forte

A direção DEVE ser coerente do Hero ao Footer. NÃO misture estilos.

## 🎨 COR PRIMÁRIA DA MARCA (OBRIGATÓRIO!)

A cor primária da marca é: **${primaryColor}**
${storeSettings?.secondary_color ? `A cor secundária da marca é: **${storeSettings.secondary_color}**` : ""}
${storeSettings?.accent_color ? `A cor de acento da marca é: **${storeSettings.accent_color}**` : ""}
${themeColors.buttonPrimaryBg ? `Cor do botão primário: **${themeColors.buttonPrimaryBg}**` : ""}
${themeColors.buttonPrimaryText ? `Texto do botão primário: **${themeColors.buttonPrimaryText}**` : ""}
${themeColors.textPrimary ? `Cor de texto principal: **${themeColors.textPrimary}**` : ""}
${themeColors.accentColor ? `Cor de acento do tema: **${themeColors.accentColor}**` : ""}
${themeColors.priceColor ? `Cor do preço: **${themeColors.priceColor}**` : ""}

### REGRAS DE CORES:
- **USE as cores acima** como base para CTAs, badges, destaques, gradientes e acentos visuais
- Os botões CTA DEVEM usar a cor primária da marca (ou cor do botão primário se disponível)
- Gradientes devem ser construídos a PARTIR das cores da marca (ex: primary → primary escurecido, ou primary → secondary)
- **NÃO invente cores aleatórias** como roxo, azul neon, ou cores que não fazem parte da identidade visual
- A paleta de cores da LP deve parecer uma EXTENSÃO natural do site/loja do cliente

## 🎯 PILAR 2 — COPY PERSUASIVO DE ALTA CONVERSÃO

### Hero — Use a técnica PAS (Problem → Agitation → Solution):
- **Headline principal**: Frase de impacto que ataca a DOR do cliente (ex: "Cansado de [problema]?" ou "[Número]% das pessoas sofrem com [problema]")
- **Sub-headline**: Agite o problema e apresente a solução com o produto
- **CTA primário**: Verbo de ação + benefício (ex: "Quero Resolver Agora", "Garantir Meu Desconto")

### Regras de Copy:
- Headlines com NÚMEROS ESPECÍFICOS e power words (Exclusivo, Comprovado, Garantido, Revolucionário)
- Micro-copy de URGÊNCIA nos CTAs: "Últimas unidades", "Oferta por tempo limitado", "Apenas hoje"
- Seção "Antes vs Depois" ou "Com vs Sem" para criar CONTRASTE EMOCIONAL
- Bullets de benefícios com ✓ verde — foque em RESULTADOS, não features
- Texto de garantia junto ao preço: "Garantia incondicional de 30 dias"
- NUNCA use texto genérico como "Lorem ipsum" ou "Texto aqui"

## 🎯 PILAR 3 — COMPOSIÇÃO VISUAL DE PRODUTO

### Tratamento de Imagens (OBRIGATÓRIO):
- **Hero**: Imagem principal do produto como background com gradient overlay (30-60% opacidade) + texto sobreposto. OU: layout split (texto à esquerda, produto à direita com sombra flutuante)
- **Mockup contextual**: CSS transform (rotateY 5-10deg, perspective 1000px) + box-shadow dramática para efeito 3D sutil
- **Galeria**: Grid assimétrico (1 imagem grande 60% + 2 pequenas 40% empilhadas) em vez de grid uniforme
- **Tratamento visual**: border sutil (2px) na cor primária, glow effect (box-shadow com cor primária em 20% opacidade), badges sobrepostos ("Mais Vendido", "-30%")

### Background Composicional:
\`\`\`css
.hero {
  background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%), url('IMAGEM_PRODUTO');
  background-size: cover;
  background-position: center;
  min-height: 90vh;
  display: flex;
  align-items: center;
}
\`\`\`

## 🎯 PILAR 4 — ESTRUTURA COMERCIAL DE ALTA CONVERSÃO

Gere as seções EXATAMENTE nesta ordem (adapte o conteúdo ao produto):

1. **🔥 HERO DE IMPACTO** (min-height: 90vh)
   - Headline PAS + sub-headline emocional
   - Imagem do produto em composição (background ou split layout)
   - CTA primário grande + trust indicators inline (🛡️ Garantia | 🚚 Frete Grátis | ⭐ 4.9/5)

2. **📊 BARRA DE CONFIANÇA** (background levemente destacado)
   - 4 ícones com texto: Frete Grátis / Garantia 30 dias / Pagamento Seguro / Satisfação Garantida

3. **💡 TRANSFORMAÇÃO (Problema → Solução)** (layout 2 colunas)
   - Lado esquerdo: "SEM [produto]" com lista de dores (❌ ícones vermelhos)
   - Lado direito: "COM [produto]" com lista de benefícios (✅ ícones verdes)

4. **🏆 PRODUTO EM DESTAQUE** (fundo alternado)
   - Foto grande do produto (com tratamento 3D/sombra)
   - Lista de benefícios em bullets visuais
   - Preço com âncora (De R$XX ~~riscado~~ Por R$XX) + badge de desconto
   - CTA secundário

5. **⭐ PROVA SOCIAL** (cards de depoimento)
   - Cards com nome, foto placeholder circular, estrelas visuais (★★★★★), quote em destaque
   - Destaque visual em frases-chave do depoimento (negrito ou cor primária)
   - Se houver reviews reais, USE-OS. Senão, crie 3 fictícios realistas

6. **🆚 COMPARATIVO DE VALOR** (tabela visual ou cards lado a lado)
   - "Por que [produto] vs alternativas genéricas"
   - 5-7 critérios com ✅ para o produto e ❌ para alternativas

7. **💰 OFERTA IRRESISTÍVEL** (card destacado com background especial)
   - Card de preço centralizado com sombra dramática
   - Preço com âncora + economia calculada
   - Selos de garantia + pagamento seguro
   - CTA GRANDE com animação pulse
   - Micro-copy: "🔒 Compra 100% segura"

8. **❓ FAQ ESTRATÉGICO** (accordion visual)
   - 5-7 perguntas que são objeções comuns transformadas em perguntas
   - Estilo: click para expandir com ícone + / -

9. **🎯 CTA FINAL** (background gradiente dramático)
   - Headline de fechamento urgente
   - Último CTA + reforço de garantia
   - "Garantia incondicional de 30 dias. Se não gostar, devolvemos seu dinheiro."

## 🎯 PILAR 5 — EFEITOS VISUAIS PREMIUM

### CSS Obrigatório no <style>:
\`\`\`css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: 'Inter', system-ui, sans-serif; color: #111827; line-height: 1.7; overflow-x: hidden; }
h1, h2, h3, h4 { font-family: 'Sora', sans-serif; line-height: 1.15; }
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; }

/* Gradient text for headlines */
.gradient-text {
  background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Floating product effect */
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(2deg); }
}

/* Fade in up animation */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Pulse CTA */
@keyframes pulse-cta {
  0%, 100% { box-shadow: 0 4px 20px rgba(${primaryColor === '#6366f1' ? '99,102,241' : '0,0,0'}, 0.3); }
  50% { box-shadow: 0 8px 40px rgba(${primaryColor === '#6366f1' ? '99,102,241' : '0,0,0'}, 0.5); transform: scale(1.02); }
}

/* Section animations */
.animate-section { animation: fadeInUp 0.8s ease-out both; }
.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.2s; }
.delay-3 { animation-delay: 0.3s; }
.delay-4 { animation-delay: 0.4s; }

/* Glassmorphism cards */
.glass-card {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
}

/* Container */
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
@media (min-width: 768px) { .section { padding: 100px 0; } }
@media (min-width: 1024px) { .section { padding: 120px 0; } }

/* Responsive */
@media (max-width: 768px) {
  h1 { font-size: 2rem !important; }
  h2 { font-size: 1.5rem !important; }
  .section { padding: 60px 0; }
}
\`\`\`

### Detalhes Visuais:
- **Cards**: border-radius 20px, background branco, box-shadow: 0 8px 32px rgba(0,0,0,0.08), hover: translateY(-6px) + sombra mais intensa
- **CTAs**: padding 20px 56px, border-radius 14px, font-weight 700, font-size 18px, background gradiente, animation: pulse-cta 2s infinite
- **Badges/Pills**: padding 8px 20px, border-radius 50px, font-size 13px, letter-spacing 0.05em
- **Divider waves**: SVG path sutil entre seções para fluidez visual
- **Stats numbers**: font-size 48px, font-weight 800, gradient text

## ⚠️ REGRAS CRÍTICAS ABSOLUTAS

### LOGO DA LOJA
- Se a logo for usada na página (ex: tabela comparativa, seção de marca), **NÃO APLIQUE NENHUM FILTRO CSS** — nada de opacity, filter:brightness, filter:grayscale, filter:invert, mix-blend-mode, backdrop-filter ou qualquer efeito visual
- A logo DEVE ser renderizada com \`<img src="URL" style="display:block; max-width:160px; height:auto;">\` sem NENHUM outro estilo que altere sua aparência
- Em tabelas comparativas: coloque a logo dentro de um \`<div style="background:#fff; padding:12px 16px; border-radius:8px; display:inline-block;">\`
- **TESTE MENTAL**: Se a logo original tem vermelho, verde e preto, ela DEVE aparecer com vermelho, verde e preto na LP. Se aparece acinzentada, você violou esta regra.

### IMAGENS DOS PRODUTOS — DISCIPLINA DE USO
- **HERO/DESTAQUE**: Use APENAS a imagem criativa gerada (se disponível nas "IMAGENS CRIATIVAS GERADAS" abaixo) ou a imagem principal do catálogo com gradient overlay
- **SEÇÕES DO CORPO (Transformação, Prova Social, FAQ, CTA Final, etc.)**: **NÃO USE imagens de catálogo do produto!** Essas seções devem usar APENAS ícones, emojis, badges, CSS visual, e texto — sem \`<img>\` de produto
- **EXCEÇÃO ÚNICA**: Imagens de catálogo podem aparecer APENAS em grids de produtos/ofertas que linkem para compra (ex: "Kits Promocionais", "Outros produtos")
- **USE OBRIGATORIAMENTE** as URLs de imagem fornecidas abaixo — COPIE E COLE exatamente
- **NUNCA** use placeholder.com, via.placeholder.com, unsplash ou imagens genéricas
- A imagem principal DEVE aparecer em COMPOSIÇÃO no Hero (como background OU em layout split com tratamento visual)

### CORES DA MARCA
- **USE as cores da marca fornecidas** (cor primária, secundária, acento, botões) em CTAs, badges, gradientes e destaques
- Os botões CTA DEVEM usar as cores da marca, não cores inventadas
- A paleta visual da landing page deve ser uma extensão natural da identidade visual da loja
- **NÃO use cores aleatórias** que não tenham relação com a marca

### DADOS DOS PRODUTOS
- USE EXCLUSIVAMENTE os produtos listados abaixo
- NÃO invente nomes, preços ou descrições — use os EXATOS fornecidos
- Preços já estão em Reais (R$) — NÃO divida por 100

### HTML LIMPO
- **NUNCA** deixe tags HTML visíveis como texto (ex: \`</section>\`, \`<div>\` aparecendo como texto na página)
- Todas as tags devem estar corretamente fechadas e aninhadas
- Sem comentários HTML visíveis ao usuário
- Teste mental: se o usuário vê texto como "section>" na tela, o HTML está quebrado

### URL DE REFERÊNCIA
Se fornecida, use APENAS como inspiração de layout/estilo. **NUNCA COPIE** conteúdo.

### OUTPUT
- Retorne APENAS HTML completo (começando com \`<!DOCTYPE html>\`)
- CSS em tag \`<style>\` no \`<head>\` (NÃO use CSS externo além do Google Fonts)
- O HTML deve ser 100% self-contained e RESPONSIVO
- **NÃO** inclua explicações, markdown ou comentários fora do HTML

---

## Informações da Loja
- **Nome**: \${storeSettings?.store_name || "Loja"}
- **Logo**: \${storeSettings?.logo_url || "Sem logo"}
- **Cor Principal da Marca**: \${primaryColor}
\${storeSettings?.secondary_color ? \`- **Cor Secundária**: \${storeSettings.secondary_color}\` : ""}
\${storeSettings?.accent_color ? \`- **Cor de Acento**: \${storeSettings.accent_color}\` : ""}
\${themeColors.buttonPrimaryBg ? \`- **Cor Botão Primário (tema publicado)**: \${themeColors.buttonPrimaryBg}\` : ""}
\${themeColors.buttonPrimaryText ? \`- **Texto Botão Primário**: \${themeColors.buttonPrimaryText}\` : ""}
\${themeColors.buttonSecondaryBg ? \`- **Cor Botão Secundário**: \${themeColors.buttonSecondaryBg}\` : ""}
\${themeColors.accentColor ? \`- **Cor Acento do Tema**: \${themeColors.accentColor}\` : ""}
\${themeColors.priceColor ? \`- **Cor do Preço**: \${themeColors.priceColor}\` : ""}
- **Telefone**: \${storeSettings?.contact_phone || ""}
- **Email**: \${storeSettings?.contact_email || ""}

⚠️ A logo acima NUNCA deve ser alterada visualmente. Renderize com <img> simples, sem CSS filters. Em fundos escuros, use container branco.

\${productsInfo ? \`## PRODUTOS A SEREM DESTACADOS:\\n\${productsInfo}\` : "## ATENÇÃO: Nenhum produto selecionado. Crie uma landing page genérica para a loja."}

\${productImages.length > 0 ? \`## ⚠️ IMAGENS DOS PRODUTOS — USE APENAS NO HERO E EM GRIDS DE OFERTA:\\n\${productImages.map((url, i) => \`\${i + 1}. \${url}\`).join("\\n")}\\n\\n**IMPORTANTE:** NÃO espalhe imagens de catálogo por todas as seções. Use-as APENAS no Hero e em grids de produto/oferta. Seções de texto (Transformação, FAQ, CTA) devem ser visuais com CSS, ícones e badges — sem <img> de produto.\` : ""}

\${generatedCreativeUrls.length > 0 ? \`## 🎨 IMAGENS CRIATIVAS GERADAS (HERO/DESTAQUE — PRIORIDADE MÁXIMA!)
USE ESTAS imagens geradas profissionalmente como IMAGEM PRINCIPAL no HERO e na seção de PRODUTO EM DESTAQUE.
Elas foram criadas especificamente para esta landing page com composição publicitária premium.
\${generatedCreativeUrls.map((url, i) => \`\${i + 1}. \${url}\`).join("\\n")}

As imagens de catálogo NÃO devem ser usadas no corpo da página, apenas em grids de oferta se necessário.\` : ""}

\${reviewsInfo ? \`## AVALIAÇÕES REAIS DE CLIENTES (USE COMO PROVA SOCIAL!):\\n\${reviewsInfo}\\n\\n> Use estes depoimentos reais na seção de prova social. Mantenha os nomes e ratings exatos. Se houver poucos, complemente com depoimentos fictícios mas realistas.\` : "## PROVA SOCIAL:\\nNão há avaliações reais disponíveis. Crie depoimentos fictícios mas realistas e convincentes."}

\${creativesInfo ? \`## REFERÊNCIAS DE MARKETING (TOM, ESTILO E HEADLINES DO NEGÓCIO):\\n\${creativesInfo}\\n\\n> Use estas referências para alinhar o tom de voz, estilo de copywriting e abordagem da landing page com o que o negócio já usa em suas campanhas.\` : ""}

\${driveAssetsInfo ? \`## 📁 IMAGENS DO DRIVE DO LOJISTA (ASSETS ADICIONAIS DISPONÍVEIS)
O lojista possui estas imagens no Drive que podem ser usadas como recursos visuais complementares na landing page (ex: banners, lifestyle, ambientação, ícones customizados):
\${driveAssetsInfo}

> Use estas imagens quando fizerem sentido para enriquecer visualmente a página (ex: fotos de lifestyle, banners, texturas). **NÃO substitua** as imagens de produto do catálogo por estas. Elas são complementares.\` : ""}

\${referenceUrl ? \`## URL DE REFERÊNCIA (APENAS INSPIRAÇÃO VISUAL/ESTRUTURAL!):\\n\${referenceUrl}\\n⚠️ COPIE APENAS O LAYOUT E ESTILO! USE OS DADOS DOS PRODUTOS ACIMA!\` : ""}

\${currentHtml ? \`## HTML ATUAL (para ajustes):\\n\${currentHtml}\` : ""}

IMPORTANTE: Retorne APENAS o HTML completo, sem explicações ou markdown. O HTML DEVE começar com <!DOCTYPE html>.`;

    // Check if user attached media in the prompt
    const hasUserMedia = prompt.includes("[Imagem:") || prompt.includes("[Vídeo:");
    const userMediaNote = hasUserMedia ? `

## ⚠️ MÍDIA ANEXADA PELO USUÁRIO - USE OBRIGATORIAMENTE!
O usuário anexou imagens/vídeos no prompt abaixo. As URLs estão marcadas como [Imagem: URL] ou [Vídeo: URL].
**VOCÊ DEVE usar essas URLs exatas** no HTML onde o usuário indicou. Para vídeos, use <video src="URL"> com controles.` : "";

    const userPrompt = promptType === "adjustment"
      ? `Faça os seguintes ajustes na landing page atual:\n\n${prompt}${userMediaNote}\n\nRetorne o HTML completo atualizado.`
      : `Crie uma landing page baseada nas seguintes instruções:\n\n${prompt}${userMediaNote}\n\nRetorne o HTML completo.`;

    console.log(`[AI-LP-Generate] Calling AI via centralized router for ${promptType}...`);
    resetAIRouterCache();

    const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey: supabaseKey,
      logPrefix: "[AI-LP-Generate]",
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[AI-LP-Generate] AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let generatedHtml = aiData.choices?.[0]?.message?.content || "";

    // Clean up the response - remove markdown code blocks if present
    generatedHtml = generatedHtml
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    console.log(`[AI-LP-Generate] Generated ${generatedHtml.length} chars of HTML`);

    // Get current version
    const { data: currentPage } = await supabase
      .from("ai_landing_pages")
      .select("current_version")
      .eq("id", landingPageId)
      .single();

    const newVersion = (currentPage?.current_version || 0) + 1;

    // Update landing page
    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_html: generatedHtml,
        current_version: newVersion,
        status: "draft",
      })
      .eq("id", landingPageId);

    if (updateError) {
      console.error("[AI-LP-Generate] Update error:", updateError);
      throw updateError;
    }

    // Create version history
    const { error: versionError } = await supabase
      .from("ai_landing_page_versions")
      .insert({
        landing_page_id: landingPageId,
        tenant_id: tenantId,
        version: newVersion,
        prompt,
        prompt_type: promptType,
        html_content: generatedHtml,
        created_by: userId,
        generation_metadata: {
          model: "google/gemini-2.5-pro",
          html_length: generatedHtml.length,
          had_reference: !!referenceUrl,
          product_count: productIds?.length || 0,
          reviews_count: reviewsInfo ? reviewsInfo.split("\n").length : 0,
          creatives_count: creativesInfo ? creativesInfo.split("\n").length : 0,
          drive_assets_count: driveAssetsInfo ? driveAssetsInfo.split("\n").length : 0,
        },
      });

    if (versionError) {
      console.error("[AI-LP-Generate] Version history error:", versionError);
    }

    console.log(`[AI-LP-Generate] Success! Version ${newVersion} created`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        htmlLength: generatedHtml.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Generate] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
