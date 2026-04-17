// =============================================
// AI LANDING PAGE GENERATE — V5.4 HTML-LIBRE ENGINE
// Experimental: AI generates full HTML/CSS
// Same data pipeline as V7, different output format
// For A/B comparison only (feature flag)
// =============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { isPromptIncomplete, selectBestFallback } from "../_shared/marketing/fallback-prompts.ts";
import {
  resolveEnginePlan,
  type BriefingInput,
} from "../_shared/marketing/engine-plan.ts";
import type { ProductData, ReviewData } from "../_shared/landing-page-templates.ts";
import { resolveLandingPageAssets } from "../_shared/landing-page-asset-resolver.ts";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "5.4.0"; // HTML Libre Engine

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  landingPageId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  productIds?: string[];
  briefing?: BriefingInput;
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function installments(price: number, n = 12): string {
  const inst = price / n;
  return `${n}x de R$ ${inst.toFixed(2).replace('.', ',')}`;
}

// ========== HTML GENERATION PROMPT ==========

function buildHtmlPrompt(params: {
  storeName: string;
  productName: string;
  productDescription: string;
  niche: string;
  visualWeight: string;
  prompt: string;
  heroImageUrl: string;
  heroBackgroundUrl: string;
  benefitImages: string[];
  socialProofImages: string[];
  pricingCards: { name: string; price: number; compareAtPrice?: number | null; discountPercent?: number | null; installments: string; imageUrl: string; ctaUrl: string; isFeatured: boolean }[];
  reviews: ReviewData[];
  storeBaseUrl: string;
}): { system: string; user: string } {
  const { storeName, productName, productDescription, niche, visualWeight, prompt, heroImageUrl, heroBackgroundUrl, benefitImages, socialProofImages, pricingCards, reviews, storeBaseUrl } = params;

  const colorDirections: Record<string, string> = {
    premium: `Fundo escuro (#0a0a0a / #111), acentos dourados (#c9a96e), texto branco. Fontes: Playfair Display para títulos, Inter para corpo. Sombras profundas, glass effects, backdrop-filter.`,
    comercial: `Fundo branco/cinza claro, cores vibrantes para CTAs (vermelho, laranja). Fontes: Montserrat bold para títulos, Open Sans para corpo. Urgência visual.`,
    minimalista: `Fundo #fafafa, texto escuro, acentos sutis. Fontes: Sora para títulos, Inter para corpo. Espaçamento generoso, sem ruído.`,
    direto: `Fundo branco, azul como acento, layout funcional. Fontes: Inter. Direto ao ponto, sem firulas.`,
  };

  const system = `Você é um web designer de elite especializado em landing pages de alta conversão para e-commerce brasileiro.

## SUA MISSÃO
Gerar o HTML e CSS COMPLETO de uma landing page de vendas premium. Você tem CONTROLE TOTAL sobre:
- Layout (grids, flexbox, posicionamento)
- Tipografia (tamanhos, pesos, espaçamentos, fontes Google)
- Cores (gradientes, opacidades, sombras)
- Composição visual (como imagens se integram ao design)
- Espaçamentos (padding, margin por seção)
- Efeitos (glass, blur, sombras, animações CSS)
- Responsividade (desktop e mobile)

## DIREÇÃO VISUAL: ${visualWeight.toUpperCase()}
${colorDirections[visualWeight] || colorDirections.premium}

## REGRAS ABSOLUTAS
1. Retorne APENAS o conteúdo HTML (seções + <style>) — NÃO inclua <!DOCTYPE>, <html>, <head>, <body>
2. O sistema vai injetar o HTML dentro de um document shell automaticamente
3. NÃO use JavaScript — apenas HTML + CSS
4. NÃO use markdown — é HTML puro
5. NÃO invente URLs de imagem — use APENAS as URLs fornecidas abaixo
6. NÃO crie <footer> ou <header> — o sistema os injeta separadamente
7. NÃO use position:fixed ou position:sticky
8. NÃO use iframes ou scripts externos
9. Todas as imagens devem ter max-width:100% e height:auto
10. CTAs devem ter max-width:400px, padding generoso (16px 40px), border-radius:8px
11. CTAs devem ser CURTOS (max 20 caracteres): "Comprar agora", "Quero meu kit", "Garantir o meu"
12. Mobile: use @media (max-width: 768px) para adaptar layouts
13. Use Google Fonts via @import no início do <style>
14. Cada seção deve ter padding vertical generoso (80px desktop, 48px mobile)
15. A imagem do produto deve ser INTEGRADA ao design (não "colada" em um fundo branco). Use composição: a imagem como parte de um layout com gradiente atrás, ou flutuando sobre a seção, ou em grid com textos.

## COMPOSIÇÃO VISUAL (CRÍTICO)
- O HERO deve ser uma composição visual completa: imagem do produto com gradiente de fundo, tipografia premium, badge + CTA proeminente
- Se houver imagem de background, use-a como background-image com overlay escuro e o produto sobreposto
- Seção de BENEFÍCIOS: cards com bordas sutis, ícones ou imagens, espaçamento uniforme
- Seção de PROVA SOCIAL: grid/carrossel com imagens reais dos clientes, bordas arredondadas, sombra
- Seção de PREÇOS/OFERTAS: cards lado a lado, destaque visual no card "mais vendido" (borda dourada, badge, escala)
- Seção de FAQ: accordion visual com bordas sutis
- Seção de GARANTIA: ícones de segurança + texto persuasivo
- Seção de CTA FINAL: fundo com gradiente, botão grande e proeminente

## RESPONSIVIDADE
- Desktop: layouts multi-coluna, imagens grandes, tipografia generosa
- Mobile: tudo em coluna única, fontes menores, padding reduzido, CTAs full-width
- Transição suave entre breakpoints

## NICHO
O produto é do nicho: ${niche}. Adapte a linguagem, cores e composição para este público.`;

  // Build data section
  let dataSection = `## DADOS DO PRODUTO
- Nome: ${productName}
- Loja: ${storeName}
- Descrição: ${productDescription || 'Produto de alta qualidade'}

## IMAGENS DISPONÍVEIS (use APENAS estas URLs)
- Imagem principal do produto: ${heroImageUrl || '(nenhuma)'}
- Background/ambiente: ${heroBackgroundUrl || '(nenhuma)'}`;

  if (benefitImages.filter(Boolean).length > 0) {
    dataSection += `\n- Imagens para benefícios: ${benefitImages.filter(Boolean).join(', ')}`;
  }

  if (socialProofImages.length > 0) {
    dataSection += `\n- Provas sociais (fotos de clientes): ${socialProofImages.join(', ')}`;
  }

  dataSection += `\n\n## OFERTAS/KITS (criar cards de preço para cada)`;
  for (const card of pricingCards) {
    dataSection += `\n- ${card.name}: ${formatPrice(card.price)}`;
    if (card.compareAtPrice) dataSection += ` (de ${formatPrice(card.compareAtPrice)}, ${card.discountPercent}% OFF)`;
    dataSection += ` | ${card.installments}`;
    dataSection += ` | CTA → ${card.ctaUrl}`;
    if (card.isFeatured) dataSection += ` | ⭐ DESTAQUE (mais vendido)`;
    dataSection += ` | Imagem: ${card.imageUrl}`;
  }

  if (reviews.length > 0) {
    dataSection += `\n\n## AVALIAÇÕES REAIS (usar nos depoimentos)`;
    for (const r of reviews.slice(0, 6)) {
      dataSection += `\n- ${r.name} (${r.rating}★): "${r.comment}"`;
    }
  }

  const user = `${prompt}

${dataSection}

Gere o HTML + CSS completo da landing page. Lembre: retorne APENAS as seções HTML + tag <style>, sem document shell.`;

  return { system, user };
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-HTML v${VERSION}] Starting...`);

  try {
    const body: GenerateRequest = await req.json();
    const { landingPageId, tenantId, userId, prompt, productIds: inputProductIds, briefing: inputBriefing } = body;

    if (!landingPageId || !tenantId || !userId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the landing page
    const { data: savedLP, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, show_header, show_footer, briefing, is_published, current_version")
      .eq("id", landingPageId)
      .single();

    if (lpError) throw new Error("Landing page not found");

    const productIds = inputProductIds?.length ? inputProductIds : (savedLP?.product_ids || []);
    const briefing = inputBriefing || (savedLP?.briefing as BriefingInput | null) || undefined;

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, primary_color")
      .eq("tenant_id", tenantId)
      .single();

    const storeName = storeSettings?.store_name || "Loja";

    // ===== FETCH PRODUCTS (same as V7) =====
    const allProducts: ProductData[] = [];
    const kits: ProductData[] = [];
    const reviews: ReviewData[] = [];
    let firstProduct: ProductData | null = null;
    let reviewCount = 0;
    const kitProductIds: string[] = [];

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, product_type, tags")
        .in("id", productIds);

      if (products?.length) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        const imagesByProduct = new Map<string, string[]>();
        const primaryImageByProduct = new Map<string, string>();
        images?.forEach((img: any) => {
          if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
          imagesByProduct.get(img.product_id)!.push(img.url);
          if (img.is_primary && !primaryImageByProduct.has(img.product_id))
            primaryImageByProduct.set(img.product_id, img.url);
        });

        for (const p of products) {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImg = primaryImageByProduct.get(p.id) || prodImages[0] || '';
          const compareAt = p.compare_at_price || null;
          const discount = compareAt && compareAt > p.price ? Math.round(((compareAt - p.price) / compareAt) * 100) : null;

          const pd: ProductData = {
            id: p.id, name: p.name, slug: p.slug, price: p.price,
            compareAtPrice: compareAt, discountPercent: discount,
            primaryImage: primaryImg, allImages: prodImages,
            shortDescription: p.short_description || undefined,
            description: p.description || undefined,
            brand: p.brand || undefined,
          };
          allProducts.push(pd);
          if (!firstProduct) firstProduct = pd;
        }

        // Auto-discover kits (same logic as V7)
        try {
          const { data: relatedKits } = await supabase
            .from("product_components")
            .select("parent_product_id, component_product_id")
            .in("component_product_id", productIds);

          if (relatedKits?.length) {
            const candidateKitIds = [...new Set(relatedKits.map((r: any) => r.parent_product_id))]
              .filter((kitId: string) => !productIds.includes(kitId));

            if (candidateKitIds.length > 0) {
              const { data: allKitComponents } = await supabase
                .from("product_components")
                .select("parent_product_id, component_product_id")
                .in("parent_product_id", candidateKitIds);

              const fullKitComponentMap = new Map<string, Set<string>>();
              for (const r of (allKitComponents || [])) {
                if (!fullKitComponentMap.has(r.parent_product_id)) fullKitComponentMap.set(r.parent_product_id, new Set());
                fullKitComponentMap.get(r.parent_product_id)!.add(r.component_product_id);
              }

              const strictKitIds = [...fullKitComponentMap.entries()]
                .filter(([_, allComponents]) => {
                  for (const compId of allComponents) { if (!productIds.includes(compId)) return false; }
                  return allComponents.size > 0;
                })
                .map(([parentId]) => parentId).slice(0, 3);

              if (strictKitIds.length > 0) {
                const { data: kitProducts } = await supabase
                  .from("products")
                  .select("id, name, slug, price, compare_at_price")
                  .in("id", strictKitIds)
                  .eq("product_format", "with_composition")
                  .in("status", ["active", "inactive"])
                  .is("deleted_at", null);

                if (kitProducts?.length) {
                  const kitIds = kitProducts.map((k: any) => k.id);
                  kitProductIds.push(...kitIds);
                  const { data: kitImages } = await supabase
                    .from("product_images")
                    .select("product_id, url, is_primary")
                    .in("product_id", kitIds)
                    .order("is_primary", { ascending: false });
                  const kitPrimaryImage = new Map<string, string>();
                  kitImages?.forEach((img: any) => {
                    if (!kitPrimaryImage.has(img.product_id)) kitPrimaryImage.set(img.product_id, img.url);
                  });
                  for (const kit of kitProducts) {
                    const compareAt = kit.compare_at_price || null;
                    const discount = compareAt && compareAt > kit.price ? Math.round(((compareAt - kit.price) / compareAt) * 100) : null;
                    kits.push({
                      id: kit.id, name: kit.name, slug: kit.slug, price: kit.price,
                      compareAtPrice: compareAt, discountPercent: discount,
                      primaryImage: kitPrimaryImage.get(kit.id) || '', isKit: true,
                    });
                  }
                }
              }
            }
          }
        } catch { /* non-blocking */ }

        // Fetch reviews
        const { data: reviewsData } = await supabase
          .from("product_reviews")
          .select("reviewer_name, rating, comment")
          .in("product_id", productIds)
          .eq("status", "approved")
          .order("rating", { ascending: false })
          .limit(10);

        if (reviewsData?.length) {
          for (const r of reviewsData) reviews.push({ name: r.reviewer_name || 'Cliente', rating: r.rating, comment: r.comment });
          reviewCount = reviewsData.length;
        }
      }
    }

    if (!firstProduct) throw new Error("No products found");

    // ===== RESOLVE ENGINE PLAN =====
    let effectiveBriefing = briefing || null;
    if (!effectiveBriefing?.visualStyle && prompt) {
      const pl = prompt.toLowerCase();
      let ds: string | undefined;
      if (pl.includes('premium') || pl.includes('luxo') || pl.includes('dark')) ds = 'premium';
      else if (pl.includes('minimalista') || pl.includes('clean')) ds = 'minimalista';
      else if (pl.includes('comercial') || pl.includes('agressiv')) ds = 'comercial';
      if (ds) effectiveBriefing = { ...(effectiveBriefing || { objective: 'sale' as const, trafficTemp: 'cold' as const, trafficSource: 'meta' as const, awarenessLevel: 'pain_aware' as const }), visualStyle: ds as any };
    }

    const enginePlan = resolveEnginePlan({
      briefing: effectiveBriefing, productType: null, tags: null,
      description: firstProduct.description || null, price: firstProduct.price || null, reviewCount,
    });

    // ===== RESOLVE ASSETS =====
    const nicheKey = enginePlan.resolvedNiche || 'geral';
    const assets = await resolveLandingPageAssets({
      supabase, tenantId, productIds, kitProductIds, niche: nicheKey,
    });

    // Resolve store base URL
    let storeBaseUrl = '';
    try {
      const { data: tenantData } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
      const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
      storeBaseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantData?.slug ? `https://${tenantData.slug}.shops.comandocentral.com.br` : '');
    } catch { /* non-blocking */ }

    // Build pricing cards
    const pricingProducts = kits.length > 0 ? [...kits] : [firstProduct];
    pricingProducts.sort((a, b) => a.price - b.price);
    const featuredIdx = pricingProducts.length === 3 ? 1 :
      pricingProducts.reduce((best, prod, i) => (prod.discountPercent || 0) > (pricingProducts[best].discountPercent || 0) ? i : best, 0);

    const pricingCards = pricingProducts.map((prod, i) => {
      const productUrl = prod.slug && storeBaseUrl ? `${storeBaseUrl}/p/${prod.slug}` : (prod.slug ? `/p/${prod.slug}` : '#ofertas');
      return {
        name: prod.name,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice || null,
        discountPercent: prod.discountPercent || null,
        installments: installments(prod.price),
        imageUrl: (prod.id && assets.offerCardImages[prod.id]) || prod.primaryImage || assets.heroImageUrl,
        ctaUrl: productUrl,
        isFeatured: i === featuredIdx,
      };
    });

    // ===== GENERATE HTML VIA AI =====
    const enrichedPrompt = isPromptIncomplete(prompt)
      ? `${prompt}\n\nDIREÇÃO: ${selectBestFallback(null, null, firstProduct.description || null, firstProduct.name).prompt}`
      : prompt;

    const { system, user } = buildHtmlPrompt({
      storeName,
      productName: firstProduct.name,
      productDescription: firstProduct.description || firstProduct.shortDescription || '',
      niche: enginePlan.resolvedNiche,
      visualWeight: enginePlan.resolvedVisualWeight,
      prompt: enrichedPrompt,
      heroImageUrl: assets.heroImageUrl,
      heroBackgroundUrl: assets.heroBackgroundUrl,
      benefitImages: assets.benefitImages,
      socialProofImages: assets.socialProofImages,
      pricingCards,
      reviews,
      storeBaseUrl,
    });

    console.log(`[AI-LP-HTML] Calling AI for HTML generation...`);
    resetAIRouterCache();
    
    const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey: supabaseKey,
      logPrefix: "[AI-LP-HTML-Gen]",
    });

    if (!aiResponse.ok) throw new Error(`AI request failed: ${aiResponse.status}`);

    const aiData = await aiResponse.json();
    let generatedHtml = aiData.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    generatedHtml = generatedHtml.trim();
    if (generatedHtml.startsWith('```html')) {
      generatedHtml = generatedHtml.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (generatedHtml.startsWith('```')) {
      generatedHtml = generatedHtml.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Safety: remove document shell if AI included it anyway
    generatedHtml = generatedHtml
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?head[^>]*>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<title>[^<]*<\/title>/gi, '');

    console.log(`[AI-LP-HTML] Generated HTML length: ${generatedHtml.length} chars`);

    // ===== PERSIST =====
    const newVersion = (savedLP?.current_version || 0) + 1;
    const isCurrentlyPublished = savedLP?.is_published === true;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_html: generatedHtml,
        generated_css: null,
        generated_schema: null, // HTML mode, clear schema
        generated_blocks: null,
        current_version: newVersion,
        status: isCurrentlyPublished ? "published" : "draft",
        metadata: {
          engineVersion: "v5.4",
          htmlLibre: true,
          visualWeight: enginePlan.resolvedVisualWeight,
          niche: enginePlan.resolvedNiche,
          productCount: allProducts.length,
          kitCount: kits.length,
          reviewCount,
          socialProofCount: assets.socialProofImages.length,
          htmlLength: generatedHtml.length,
        },
      })
      .eq("id", landingPageId);

    if (updateError) throw updateError;

    // Save version
    await supabase.from("ai_landing_page_versions").insert({
      landing_page_id: landingPageId,
      tenant_id: tenantId,
      version: newVersion,
      prompt,
      prompt_type: 'initial',
      html_content: generatedHtml,
      css_content: null,
      schema_content: null,
      created_by: userId,
      generation_metadata: {
        engineVersion: "v5.4",
        htmlLibre: true,
        model: "google/gemini-2.5-pro",
        visualWeight: enginePlan.resolvedVisualWeight,
        htmlLength: generatedHtml.length,
      },
    });

    console.log(`[AI-LP-HTML v${VERSION}] Success! Version ${newVersion}, ${generatedHtml.length} chars`);

    return new Response(
      JSON.stringify({ success: true, version: newVersion, engineVersion: "v5.4", htmlLibre: true, htmlLength: generatedHtml.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'ai', action: 'landing-page-generate-html' });
  }
});
