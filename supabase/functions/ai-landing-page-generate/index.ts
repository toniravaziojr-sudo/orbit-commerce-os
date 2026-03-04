// =============================================
// AI LANDING PAGE GENERATE — V5.4 ENGINE
// Motor V5.4: HTML Livre + Timeout Resolvido
// Volta ao HTML/CSS livre (como V4) para máxima qualidade visual
// Imagens são geradas assíncronamente pelo enhance-images (Etapa 2)
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { isPromptIncomplete, selectBestFallback } from "../_shared/marketing/fallback-prompts.ts";
import {
  resolveEnginePlan,
  getNicheRules,
  getTrafficRules,
  getAwarenessCopyRules,
  type BriefingInput,
  type EnginePlanInput,
} from "../_shared/marketing/engine-plan.ts";

const VERSION = "5.4.0"; // Engine V5.4: HTML Livre + Timeout Resolvido

// ========== CORS ==========

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== REQUEST TYPE ==========

interface GenerateRequest {
  landingPageId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  promptType: 'initial' | 'adjustment' | 'regenerate';
  referenceUrl?: string;
  productIds?: string[];
  briefing?: BriefingInput;
}

// ========== HTML SYSTEM PROMPT BUILDER ==========

function buildHtmlSystemPrompt(params: {
  enginePlan: EnginePlanInput;
  storeName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  themeColors: Record<string, string>;
  productsInfo: string;
  productImages: string[];
  productNames: string[];
  productPrimaryImageMap: Record<string, string>;
  reviewsInfo: string;
  creativesInfo: string;
  socialProofImageUrls: string[];
  referenceUrl?: string;
  currentHtml?: string;
}): string {
  const {
    enginePlan, storeName, logoUrl, primaryColor, secondaryColor, accentColor,
    themeColors, productsInfo, productImages, productNames, productPrimaryImageMap,
    reviewsInfo, creativesInfo, socialProofImageUrls,
    referenceUrl, currentHtml,
  } = params;

  const sections: string[] = [];

  // === A. ROLE ===
  sections.push(`Você é um diretor criativo de elite, especialista em criar landing pages de altíssima conversão com HTML/CSS livre.
Você gera HTML e CSS COMPLETOS, com total controle sobre layout, tipografia, cores, gradientes, efeitos visuais e espaçamentos.
Você NÃO está preso a componentes genéricos — você tem liberdade criativa total para criar páginas premium e únicas.

## FORMATO DE SAÍDA (OBRIGATÓRIO)

Retorne APENAS o conteúdo do <body> — NÃO inclua <!DOCTYPE>, <html>, <head> ou <body> tags.
O sistema vai envolver seu HTML em um documento completo automaticamente.

Inclua seus estilos CSS em uma tag <style> no INÍCIO do conteúdo.

Exemplo de formato correto:
\`\`\`
<style>
  /* Seus estilos aqui */
  .hero { background: linear-gradient(...); }
</style>
<section class="hero">...</section>
<section class="benefits">...</section>
\`\`\`

PROIBIDO retornar <!DOCTYPE>, <html>, <head>, <body>, <footer> ou qualquer shell de documento.`);

  // === B. AUTHORITATIVE CONTEXT ===
  sections.push(`## ⚡ CONTEXTO AUTORITATIVO (NÃO NEGOCIÁVEL)

- **Arquétipo**: ${enginePlan.resolvedArchetype} (${TEMPLATE_REGISTRY_NAMES[enginePlan.resolvedArchetype]})
- **Nicho**: ${enginePlan.resolvedNiche}
- **Profundidade**: ${enginePlan.resolvedDepth} ${enginePlan.resolvedDepth === 'short' ? '(3-5 seções)' : enginePlan.resolvedDepth === 'medium' ? '(5-8 seções)' : '(8-12 seções)'}
- **Peso Visual**: ${enginePlan.resolvedVisualWeight}
- **Força de Prova**: ${enginePlan.proofStrength}
- **CTA Padrão**: "${enginePlan.defaultCTA}"
- **Seções Obrigatórias**: ${enginePlan.requiredSections.join(', ')}
- **Seções Opcionais**: ${enginePlan.optionalSections.join(', ')}
- **Ordem Preferida**: ${enginePlan.preferredOrder.join(' → ')}
- **Objetivo**: ${enginePlan.briefing.objective}
- **Temperatura do Tráfego**: ${enginePlan.briefing.trafficTemp}
- **Fonte de Tráfego**: ${enginePlan.briefing.trafficSource}
- **Nível de Consciência**: ${enginePlan.briefing.awarenessLevel}
${enginePlan.briefing.restrictions?.length ? `- **Restrições**: ${enginePlan.briefing.restrictions.join(', ')}` : ''}`);

  // === C. VISUAL GUIDELINES ===
  sections.push(`## 🎨 DIRETRIZES VISUAIS PREMIUM

### Peso Visual: ${enginePlan.resolvedVisualWeight}
${enginePlan.resolvedVisualWeight === 'premium' ? `
- Fundo escuro (#0a0a0a ou #0d0d0d) com acentos dourados (#c9a96e ou #d4af37)
- Tipografia: Use Google Fonts premium — @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600&display=swap')
- Playfair Display para headlines (bold, letter-spacing: 1-2px)
- Inter para corpo de texto
- Cards com backdrop-filter: blur(12px), sombras profundas (0 8px 32px rgba(0,0,0,0.4))
- Botões CTA com gradiente dourado, padding generoso (18px 48px), border-radius: 8px
- Seções com padding: 80px-120px vertical
- Glass morphism: background: rgba(255,255,255,0.05), border: 1px solid rgba(255,255,255,0.1)` : ''}
${enginePlan.resolvedVisualWeight === 'comercial' ? `
- Cores vibrantes nos CTAs, badges de desconto grandes
- Preço em destaque com compare-at-price riscado
- Banners coloridos para urgência/oferta
- Layout energético e direto
- Tipografia: @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap')` : ''}
${enginePlan.resolvedVisualWeight === 'minimalista' ? `
- Fundo claro (#ffffff ou #fafafa), muito espaço em branco
- Tipografia elegante e leve
- Poucos elementos, cada um com propósito claro
- @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&family=Inter:wght@300;400&display=swap')` : ''}
${enginePlan.resolvedVisualWeight === 'direto' ? `
- Layout limpo e objetivo
- CTAs claros e prominentes
- Sem ornamentos desnecessários
- @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` : ''}

### Cores da Marca
- Cor Primária: ${primaryColor}
${secondaryColor ? `- Cor Secundária: ${secondaryColor}` : ''}
${accentColor ? `- Cor de Acento: ${accentColor}` : ''}
${themeColors.buttonPrimaryBg ? `- Botão Primário BG: ${themeColors.buttonPrimaryBg}` : ''}
${themeColors.buttonPrimaryText ? `- Botão Primário Text: ${themeColors.buttonPrimaryText}` : ''}
${themeColors.priceColor ? `- Cor do Preço: ${themeColors.priceColor}` : ''}

### Regras de CSS
- Use classes semânticas (.hero, .benefits, .testimonials, .pricing, .faq, .cta-final)
- Todas as imagens DEVEM ter max-width: 100% e height: auto
- Grids com grid-template-columns devem usar fr units
- CTAs: use a classe .cta-button para botões de ação
- Animações sutis: fadeInUp com animation-delay escalonado (max 1.5s)
- Mobile: inclua @media (max-width: 768px) para responsividade
- NUNCA use position: fixed ou position: sticky`);

  // === C2. PRODUCT IMAGE INTEGRATION (CRITICAL) ===
  if (productImages.length > 0) {
    sections.push(`## 📸 INTEGRAÇÃO VISUAL DO PRODUTO (OBRIGATÓRIO)

O PRODUTO deve ser o PROTAGONISTA VISUAL da página. Não basta listar imagens pequenas —
a imagem do produto deve estar integrada organicamente no layout, como em landing pages profissionais de DTC (Öko Living, Spot & Tango, etc).

### PADRÕES OBRIGATÓRIOS:

**1. HERO com Produto (seção principal)**
O hero DEVE usar a imagem principal do produto de forma proeminente. Use um destes layouts:
- **Split Hero (recomendado)**: Texto + CTA à esquerda (ou direita), imagem do produto GRANDE do outro lado (50/50 ou 40/60)
- **Hero com Background**: Imagem do produto como fundo com overlay gradiente suave + texto sobre
- **Hero Angulado**: Produto flutuando ao lado do texto com sombra dramática

CSS obrigatório para split hero:
\`\`\`
.hero { display: grid; grid-template-columns: 1fr 1fr; align-items: center; min-height: 80vh; gap: 40px; }
.hero-image { display: flex; align-items: center; justify-content: center; }
.hero-image img { width: 100%; max-width: 600px; height: auto; object-fit: contain; }
@media (max-width: 768px) { .hero { grid-template-columns: 1fr; text-align: center; } .hero-image { order: -1; } }
\`\`\`

**2. SEÇÕES DE BENEFÍCIOS com Produto**
Cada benefício principal DEVE ter a imagem do produto ao lado, alternando posição:
- Seção 1: texto-esquerda + imagem-direita
- Seção 2: imagem-esquerda + texto-direita  
- Use imagens diferentes do produto quando disponíveis (ângulos variados)
- Imagem do produto com pelo menos 40% da largura do container

**3. SEÇÃO DE OFERTA/PREÇO com Produto**
O card de pricing DEVE incluir a imagem principal do produto visualmente.
NUNCA mostre preço sem o produto visualmente presente.

**4. CTA FINAL com Produto**
A seção final de CTA deve reforçar visualmente o produto com imagem média/grande.

### REGRAS DE IMAGEM:
- Imagens de produto: use object-fit: contain (preserva proporção, sem corte)
- Imagens lifestyle/background: use object-fit: cover
- Tamanho mínimo da imagem do produto: 250px x 250px em qualquer seção
- A imagem primária DEVE aparecer no mínimo 3x na página (hero, benefícios, CTA/pricing)
- NUNCA mostre a imagem menor que 200px de largura
- Sombras suaves: box-shadow: 0 20px 60px rgba(0,0,0,0.15)
- Em fundo escuro: filter: drop-shadow(0 0 30px rgba(primária, 0.3))

### ANTI-PADRÕES (PROIBIDO):
- ❌ Página só com texto e ícones genéricos sem fotos do produto
- ❌ Imagem do produto pequena (< 200px) escondida no canto
- ❌ Seções de benefícios com apenas bullet points sem imagem
- ❌ Hero sem imagem do produto
- ❌ object-fit: cover em imagens de produto (corta o produto)`);
  }

  // === D. NICHE + TRAFFIC RULES ===
  sections.push(getNicheRules(enginePlan.resolvedNiche));
  sections.push(getTrafficRules(enginePlan.briefing.trafficSource));
  sections.push(getAwarenessCopyRules(enginePlan.briefing.awarenessLevel));

  // === E. ANTI-PADRÕES ===
  const restrictionRules = enginePlan.briefing.restrictions?.map(r => {
    if (r === 'no_countdown') return '- NÃO inclua countdown timers';
    if (r === 'no_video') return '- NÃO inclua seções de vídeo';
    if (r === 'no_comparisons') return '- NÃO inclua tabelas comparativas';
    return '';
  }).filter(Boolean).join('\n') || '';

  sections.push(`## 🚫 REGRAS ABSOLUTAS

- NUNCA invente nomes de produto — use EXATAMENTE: ${productNames.map(n => `"${n}"`).join(', ')}
- NUNCA invente URLs de imagem — use APENAS as fornecidas abaixo
- NUNCA use Lorem ipsum ou textos placeholder
- Use EXATAMENTE os preços fornecidos nos dados
- NÃO crie urgência artificial (estoque falso, countdown sem dados reais)
- NÃO inclua Header nem Footer — são adicionados automaticamente pela plataforma
- NÃO inclua tags de documento (<html>, <head>, <body>, <!DOCTYPE>)
- NÃO inclua <footer> com informações de empresa, CNPJ, redes sociais etc.
- NÃO use imagens de hosts externos (imgur, cloudinary, placeholder.com etc.)
- NÃO use position: fixed ou position: sticky
${restrictionRules}`);

  // === F. DATA ===
  const dataSections: string[] = [];

  dataSections.push(`## Loja: ${storeName}
- Logo: ${logoUrl || 'Sem logo'}
- Cor Principal: ${primaryColor}`);

  if (productsInfo) dataSections.push(`## PRODUTOS:\n${productsInfo}`);

  // Asset slots
  const assetSlots: string[] = [];

  if (productImages.length > 0) {
    assetSlots.push(`### IMAGENS DE PRODUTO DISPONÍVEIS (use nos blocos visuais):
${productImages.map((url, i) => `${i + 1}. ${url}`).join('\n')}`);
  }

  const primaryMapEntries = Object.entries(productPrimaryImageMap);
  if (primaryMapEntries.length > 0) {
    assetSlots.push(`### IMAGEM PRINCIPAL POR PRODUTO:
${primaryMapEntries.map(([name, url]) => `- "${name}": ${url}`).join('\n')}`);
  }

  if (socialProofImageUrls.length > 0) {
    assetSlots.push(`### PROVA SOCIAL REAL (use em seções de depoimentos/resultados):
${socialProofImageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`);
  }

  if (assetSlots.length > 0) {
    dataSections.push(`## 🎯 ASSETS DISPONÍVEIS:\n${assetSlots.join('\n\n')}`);
  }

  if (reviewsInfo) dataSections.push(`## AVALIAÇÕES REAIS (use em seção de depoimentos):\n${reviewsInfo}`);
  if (creativesInfo) dataSections.push(`## REFERÊNCIAS DE MARKETING:\n${creativesInfo}`);
  if (referenceUrl) dataSections.push(`## URL DE REFERÊNCIA (apenas inspiração de layout):\n${referenceUrl}`);
  if (currentHtml) dataSections.push(`## HTML ATUAL (para ajustes — modifique o necessário):\n\`\`\`html\n${currentHtml.substring(0, 8000)}\n\`\`\``);

  return `${sections.join('\n\n---\n\n')}

---

${dataSections.join('\n\n')}

---

IMPORTANTE: Retorne APENAS HTML/CSS (conteúdo do body). NÃO inclua shell de documento. NÃO escreva explicações — apenas o código HTML/CSS.`;
}

const TEMPLATE_REGISTRY_NAMES: Record<string, string> = {
  lp_captura: 'Lead Capture Curta',
  lp_whatsapp: 'WhatsApp Push',
  lp_produto_fisico: 'Produto Físico / DTC',
  lp_click_through: 'Click-Through para Checkout',
  sales_page_longa: 'Sales Page Longa',
  lp_servico_premium: 'Serviço / Consultoria Premium',
  lp_saas: 'SaaS / Software',
};

// ========== HTML RESPONSE PARSER ==========

function parseHtmlResponse(raw: string): { html: string; css: string; parseError?: string } {
  let html = raw.trim();
  let css = '';
  let parseError: string | undefined;

  // Remove markdown code fences if present
  if (html.startsWith('```html')) {
    html = html.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (html.startsWith('```')) {
    html = html.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Enforce body-only contract — strip document shell if AI violated it
  const hasShell = /<!DOCTYPE|<html[\s>]|<head[\s>]/i.test(html);
  if (hasShell) {
    console.warn("[AI-LP-Generate] outputContractViolation: AI sent document shell, stripping...");
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      html = bodyMatch[1].trim();
    } else {
      html = html
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .trim();
    }
    parseError = 'outputContractViolation: stripped document shell';
  }

  // Extract <style> blocks into separate CSS
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  const cssBlocks: string[] = [];
  while ((match = styleRegex.exec(html)) !== null) {
    cssBlocks.push(match[1].trim());
  }
  if (cssBlocks.length > 0) {
    css = cssBlocks.join('\n\n');
    // Keep <style> tags in the HTML for self-contained rendering
  }

  // Strip <footer> tags (governance rule)
  html = html.replace(/<footer[\s\S]*?<\/footer>/gi, '');

  return { html, css, parseError };
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-Generate v${VERSION}] Starting...`);

  try {
    const body: GenerateRequest = await req.json();
    let { landingPageId, tenantId, userId, prompt, promptType, referenceUrl, productIds, briefing } = body;

    if (!landingPageId || !tenantId || !userId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ALWAYS fetch the landing page
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, generated_css, current_version, show_header, show_footer, briefing")
      .eq("id", landingPageId)
      .single();

    if (lpError) { console.error("[AI-LP-Generate] Error fetching landing page:", lpError); throw new Error("Landing page not found"); }

    productIds = productIds && productIds.length > 0 ? productIds : (savedLandingPage?.product_ids || []);
    referenceUrl = referenceUrl || savedLandingPage?.reference_url || undefined;
    briefing = briefing || (savedLandingPage?.briefing as BriefingInput | null) || undefined;

    console.log(`[AI-LP-Generate] Using ${productIds?.length || 0} products, referenceUrl: ${referenceUrl ? 'yes' : 'no'}, briefing: ${briefing ? 'provided' : 'defaults'}`);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, contact_phone, contact_email, published_template_id")
      .eq("tenant_id", tenantId)
      .single();

    // Fetch published theme colors
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
        if (ts) { themeColors = ts; }
      }
    }

    // ===== STEP 1: FETCH PRODUCTS =====
    let productsInfo = "";
    let productImages: string[] = [];
    let productNames: string[] = [];
    let productPrimaryImageMap: Record<string, string> = {};
    let firstProduct: { name: string; product_type: string | null; tags: string[] | null; description: string | null; price: number | null } | null = null;
    let reviewCount = 0;

    if (productIds && productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, slug, sku, description, short_description, price, compare_at_price, cost_price, brand, vendor, product_type, tags, weight, width, height, depth, seo_title, seo_description")
        .in("id", productIds);

      if (productsError) console.error("[AI-LP-Generate] Error fetching products:", productsError);

      if (products && products.length > 0) {
        productNames = products.map(p => p.name);
        const fp = products[0];
        firstProduct = { name: fp.name, product_type: fp.product_type, tags: fp.tags, description: fp.description, price: fp.price };

        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, alt_text, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        const imagesByProduct = new Map<string, { url: string; alt_text: string | null; is_primary: boolean }[]>();
        images?.forEach(img => {
          if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
          imagesByProduct.get(img.product_id)!.push({ url: img.url, alt_text: img.alt_text, is_primary: img.is_primary });
        });

        productsInfo = products.map(p => {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImage = prodImages.find(img => img.is_primary)?.url || prodImages[0]?.url;
          const allImageUrls = prodImages.map(img => img.url);
          if (primaryImage) {
            productImages.push(primaryImage);
            productPrimaryImageMap[p.name] = primaryImage;
          }
          allImageUrls.forEach(url => { if (url && !productImages.includes(url)) productImages.push(url); });

          const priceInReais = p.price;
          const compareAtPriceInReais = p.compare_at_price || null;
          const discountPercent = compareAtPriceInReais && compareAtPriceInReais > priceInReais
            ? Math.round(((compareAtPriceInReais - priceInReais) / compareAtPriceInReais) * 100)
            : null;

          return `### Produto: ${p.name}
- **SKU**: ${p.sku || "N/A"}
- **Slug (URL)**: ${p.slug || "N/A"}
- **Descrição Curta**: ${p.short_description || "Sem descrição curta"}
- **Descrição Completa**: ${p.description || "Sem descrição disponível"}
- **Preço de Venda**: R$ ${priceInReais.toFixed(2).replace('.', ',')}
${compareAtPriceInReais ? `- **Preço Original (riscado)**: R$ ${compareAtPriceInReais.toFixed(2).replace('.', ',')}` : ""}
${discountPercent ? `- **Desconto**: ${discountPercent}% OFF` : ""}
${p.brand ? `- **Marca**: ${p.brand}` : ""}
${p.vendor ? `- **Fornecedor**: ${p.vendor}` : ""}
${p.product_type ? `- **Tipo de Produto**: ${p.product_type}` : ""}
${p.tags && p.tags.length > 0 ? `- **Tags**: ${p.tags.join(", ")}` : ""}
${p.weight ? `- **Peso**: ${p.weight}g` : ""}
- **Imagem Principal**: ${primaryImage || "SEM IMAGEM"}
- **TODAS AS IMAGENS**: 
${allImageUrls.length > 0 ? allImageUrls.map((url, i) => `  ${i + 1}. ${url}`).join("\n") : "  NENHUMA IMAGEM"}`;
        }).join("\n\n");

        // ===== STEP 1B: AUTO-DISCOVER RELATED KITS =====
        try {
          const { data: relatedKits } = await supabase
            .from("product_components")
            .select("parent_product_id, quantity, component_product_id")
            .in("component_product_id", productIds);

          if (relatedKits && relatedKits.length > 0) {
            const kitParentIds = [...new Set(relatedKits.map((r: any) => r.parent_product_id))].filter(
              (id: string) => !productIds!.includes(id)
            ).slice(0, 6);

            if (kitParentIds.length > 0) {
              const { data: kitProducts } = await supabase
                .from("products")
                .select("id, name, slug, sku, price, compare_at_price, product_format, status")
                .in("id", kitParentIds)
                .eq("product_format", "with_composition")
                .eq("status", "active")
                .is("deleted_at", null);

              if (kitProducts && kitProducts.length > 0) {
                const kitIds = kitProducts.map((k: any) => k.id);
                const { data: kitImages } = await supabase
                  .from("product_images")
                  .select("product_id, url, is_primary, sort_order")
                  .in("product_id", kitIds)
                  .order("is_primary", { ascending: false })
                  .order("sort_order", { ascending: true });

                const kitImageMap = new Map<string, string>();
                kitImages?.forEach((img: any) => {
                  if (!kitImageMap.has(img.product_id)) {
                    kitImageMap.set(img.product_id, img.url);
                  }
                });

                const kitInfoParts: string[] = [];
                for (const kit of kitProducts) {
                  const kitPrimaryImage = kitImageMap.get(kit.id);
                  if (kitPrimaryImage) {
                    productPrimaryImageMap[kit.name] = kitPrimaryImage;
                    if (!productImages.includes(kitPrimaryImage)) productImages.push(kitPrimaryImage);
                  }
                  if (!productNames.includes(kit.name)) productNames.push(kit.name);

                  const kitCompare = kit.compare_at_price || null;
                  const kitDiscount = kitCompare && kitCompare > kit.price
                    ? Math.round(((kitCompare - kit.price) / kitCompare) * 100)
                    : null;

                  kitInfoParts.push(`### Kit Relacionado: ${kit.name}
- **SKU**: ${kit.sku || "N/A"}
- **Preço de Venda**: R$ ${kit.price.toFixed(2).replace('.', ',')}
${kitCompare ? `- **Preço Original (riscado)**: R$ ${kitCompare.toFixed(2).replace('.', ',')}` : ""}
${kitDiscount ? `- **Desconto**: ${kitDiscount}% OFF` : ""}
- **Formato**: Kit com composição
- **Imagem Principal**: ${kitPrimaryImage || "SEM IMAGEM"}`);
                }

                if (kitInfoParts.length > 0) {
                  productsInfo += "\n\n## KITS QUE CONTÊM ESTE PRODUTO (use nas ofertas/pricing):\n\n" + kitInfoParts.join("\n\n");
                }

                console.log(`[AI-LP-Generate] Auto-discovered ${kitProducts.length} related kits with images`);
              }
            }
          }
        } catch (kitErr) {
          console.warn("[AI-LP-Generate] Kit discovery error (non-blocking):", kitErr);
        }
      }
    }

    // ===== STEP 2: BUSINESS CONTEXT =====
    let reviewsInfo = "";
    let creativesInfo = "";

    if (productIds && productIds.length > 0) {
      const { data: reviews } = await supabase
        .from("product_reviews")
        .select("reviewer_name, rating, comment, product_id")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("rating", { ascending: false })
        .limit(10);

      if (reviews && reviews.length > 0) {
        reviewsInfo = reviews.map(r => `- ⭐ ${r.rating}/5 — "${r.comment}" (${r.reviewer_name || 'Cliente'})`).join("\n");
        reviewCount = reviews.length;
      }
    }

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
        return `- ${parts.join(" | ")}`;
      }).join("\n");
    }

    // ===== STEP 3: SOCIAL PROOF =====
    let socialProofImageUrls: string[] = [];

    if (productIds && productIds.length > 0 && promptType !== "adjustment") {
      try {
        const { data: proofFolders } = await supabase
          .from("files")
          .select("id, filename, storage_path")
          .eq("tenant_id", tenantId)
          .eq("is_folder", true)
          .or("filename.ilike.%feedback%,filename.ilike.%review%,filename.ilike.%prova%,filename.ilike.%resultado%,filename.ilike.%depoimento%,filename.ilike.%antes%depois%")
          .limit(10);

        if (proofFolders && proofFolders.length > 0) {
          console.log(`[AI-LP-Generate] Found ${proofFolders.length} social proof folders`);
          const folderPaths = proofFolders.map((f: any) => f.storage_path || `drive/${tenantId}/${f.filename}`);
          
          const orConditions = folderPaths.map((fp: string) => `storage_path.like.${fp}/%`).join(",");
          const { data: proofFiles } = await supabase
            .from("files")
            .select("id, original_name, storage_path, mime_type, metadata")
            .eq("tenant_id", tenantId)
            .eq("is_folder", false)
            .ilike("mime_type", "image/%")
            .or(orConditions)
            .order("created_at", { ascending: false })
            .limit(10);

          if (proofFiles && proofFiles.length > 0) {
            for (const file of proofFiles.slice(0, 5)) {
              try {
                const meta = file.metadata as Record<string, any> | null;
                let imageUrl = meta?.url as string | undefined;
                if (!imageUrl) {
                  const bucket = (meta?.bucket as string) || 'tenant-files';
                  if (bucket === 'tenant-files') {
                    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
                    imageUrl = signedData?.signedUrl;
                  } else {
                    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
                    imageUrl = pubData?.publicUrl;
                  }
                }
                if (imageUrl) {
                  socialProofImageUrls.push(imageUrl);
                }
              } catch (spErr) { console.warn("[AI-LP-Generate] Social proof file error:", spErr); }
            }
            console.log(`[AI-LP-Generate] Found ${socialProofImageUrls.length} social proof images`);
          }
        }
      } catch (spSearchErr) { console.warn("[AI-LP-Generate] Social proof search error:", spSearchErr); }
    }

    // ===== STEP 7: RESOLVE ENGINE PLAN =====
    const enginePlan = resolveEnginePlan({
      briefing: briefing || null,
      productType: firstProduct?.product_type,
      tags: firstProduct?.tags,
      description: firstProduct?.description,
      price: firstProduct?.price,
      reviewCount,
    });

    console.log(`[AI-LP-Generate] Engine Plan: archetype=${enginePlan.resolvedArchetype}, niche=${enginePlan.resolvedNiche}, depth=${enginePlan.resolvedDepth}, visual=${enginePlan.resolvedVisualWeight}, proof=${enginePlan.proofStrength}, assumptions=${enginePlan.assumptions.length}`);

    // ===== STEP 8: BUILD HTML PROMPT =====
    let currentHtml = "";
    if (promptType === "adjustment" && savedLandingPage?.generated_html) {
      currentHtml = savedLandingPage.generated_html;
    }

    const systemPrompt = buildHtmlSystemPrompt({
      enginePlan,
      storeName: storeSettings?.store_name || "Loja",
      logoUrl: storeSettings?.logo_url || "",
      primaryColor: storeSettings?.primary_color || "#6366f1",
      secondaryColor: storeSettings?.secondary_color,
      accentColor: storeSettings?.accent_color,
      themeColors,
      productsInfo,
      productImages,
      productNames,
      productPrimaryImageMap,
      reviewsInfo,
      creativesInfo,
      socialProofImageUrls,
      referenceUrl,
      currentHtml,
    });

    // ===== STEP 9: ENRICH PROMPT IF INCOMPLETE =====
    let enrichedPrompt = prompt;
    let fallbackUsed: string | null = null;

    if (promptType !== "adjustment" && isPromptIncomplete(prompt)) {
      const bestFallback = selectBestFallback(
        firstProduct?.product_type,
        firstProduct?.tags,
        firstProduct?.description,
        firstProduct?.name,
      );
      fallbackUsed = bestFallback.id;
      enrichedPrompt = `${prompt}\n\nDIREÇÃO CRIATIVA: ${bestFallback.prompt}`;
      console.log(`[AI-LP-Generate] Prompt enriched with fallback "${bestFallback.id}"`);
    }

    const hasUserMedia = prompt.includes("[Imagem:") || prompt.includes("[Vídeo:");
    const userMediaNote = hasUserMedia ? `\nAs URLs marcadas como [Imagem: URL] DEVEM ser usadas no HTML.` : "";

    const userPrompt = promptType === "adjustment"
      ? `Ajuste a landing page conforme solicitado:\n\n${prompt}${userMediaNote}\n\nRetorne o HTML/CSS COMPLETO atualizado (conteúdo do body).`
      : `Crie uma landing page de alta conversão:\n\n${enrichedPrompt}${userMediaNote}\n\nRetorne APENAS o HTML/CSS (conteúdo do body, sem shell de documento).`;

    // ===== STEP 10: CALL AI (HTML generation, NO tool calling) =====
    console.log(`[AI-LP-Generate v${VERSION}] Calling AI for HTML generation (${promptType})...`);
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
      console.error("[AI-LP-Generate] AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    if (!rawContent || rawContent.trim().length < 50) {
      throw new Error("AI returned empty or too-short response");
    }

    // ===== STEP 11: PARSE HTML RESPONSE =====
    const { html, css, parseError } = parseHtmlResponse(rawContent);

    if (!html || html.length < 50) {
      throw new Error("Parsed HTML is too short: " + (parseError || "empty output"));
    }

    console.log(`[AI-LP-Generate] HTML parsed: ${html.length} chars, CSS: ${css.length} chars`);

    // ===== STEP 12: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_html: html,
        generated_css: css || null,
        generated_blocks: null, // V5.4: HTML takes priority, clear blocks
        current_version: newVersion,
        status: "draft",
        metadata: {
          engineVersion: "v5.4",
          briefingSchemaVersion: "1.0",
          enginePlanInput: enginePlan,
          htmlLength: html.length,
          cssLength: css.length,
          parseError: parseError || null,
          fallbackPromptUsed: fallbackUsed,
        },
      })
      .eq("id", landingPageId);

    if (updateError) { console.error("[AI-LP-Generate] Update error:", updateError); throw updateError; }

    const { error: versionError } = await supabase
      .from("ai_landing_page_versions")
      .insert({
        landing_page_id: landingPageId,
        tenant_id: tenantId,
        version: newVersion,
        prompt,
        prompt_type: promptType,
        html_content: html,
        css_content: css || null,
        blocks_content: null,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v5.4",
          model: "google/gemini-2.5-pro",
          tool_calling: false,
          html_length: html.length,
          css_length: css.length,
          product_count: productIds?.length || 0,
          reviews_count: reviewCount,
          fallback_prompt_used: fallbackUsed,
          parseError: parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate v${VERSION}] Success! Version ${newVersion}, HTML ${html.length} chars`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        htmlLength: html.length,
        engineVersion: "v5.4",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Generate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
