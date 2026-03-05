// =============================================
// AI LANDING PAGE GENERATE — V7.0 ENGINE
// Motor V7: Schema-First + React Renderer
// IA generates structured JSON schema, NOT HTML
// Frontend renders with real React components
// V6 HTML fallback preserved for legacy pages
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { isPromptIncomplete, selectBestFallback } from "../_shared/marketing/fallback-prompts.ts";
import {
  resolveEnginePlan,
  type BriefingInput,
} from "../_shared/marketing/engine-plan.ts";
import {
  assembleLandingPage,
  type PageTemplateInput,
  type ProductData,
  type ReviewData,
} from "../_shared/landing-page-templates.ts";
import { getNicheImages, getNicheImage } from "../_shared/landing-page-stock-images.ts";
import { resolveLandingPageAssets, type ResolvedAssets } from "../_shared/landing-page-asset-resolver.ts";

const VERSION = "7.0.0"; // Engine V7: Schema-First

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

// ========== COLOR SCHEME PRESETS (same as V6) ==========

function getColorScheme(visualWeight: string, primaryColor: string) {
  switch (visualWeight) {
    case 'premium':
      return {
        bg: '#0a0a0a', bgAlt: '#111111', text: '#ffffff', textMuted: 'rgba(255,255,255,0.7)',
        accent: '#c9a96e', ctaBg: '#c9a96e', ctaText: '#0a0a0a',
        cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
        priceCurrent: '#c9a96e', priceOld: 'rgba(255,255,255,0.4)',
        badgeBg: 'rgba(201,169,110,0.15)', badgeText: '#c9a96e',
        shadow: 'rgba(0,0,0,0.5)', divider: 'rgba(255,255,255,0.06)',
        fontDisplay: "'Playfair Display', Georgia, serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap',
      };
    case 'comercial':
      return {
        bg: '#ffffff', bgAlt: '#f8f9fa', text: '#111827', textMuted: '#6b7280',
        accent: primaryColor || '#ef4444', ctaBg: primaryColor || '#ef4444', ctaText: '#ffffff',
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#16a34a', priceOld: '#9ca3af',
        badgeBg: '#fef2f2', badgeText: '#dc2626',
        shadow: 'rgba(0,0,0,0.1)', divider: '#f3f4f6',
        fontDisplay: "'Montserrat', -apple-system, sans-serif",
        fontBody: "'Open Sans', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;500;600&display=swap',
      };
    case 'minimalista':
      return {
        bg: '#fafafa', bgAlt: '#ffffff', text: '#1a1a1a', textMuted: '#666666',
        accent: primaryColor || '#1a1a1a', ctaBg: '#1a1a1a', ctaText: '#ffffff',
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#1a1a1a', priceOld: '#bbbbbb',
        badgeBg: '#f5f5f5', badgeText: '#333333',
        shadow: 'rgba(0,0,0,0.06)', divider: '#eeeeee',
        fontDisplay: "'Sora', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
      };
    default: // 'direto'
      return {
        bg: '#ffffff', bgAlt: '#f9fafb', text: '#111827', textMuted: '#4b5563',
        accent: primaryColor || '#2563eb', ctaBg: primaryColor || '#2563eb', ctaText: '#ffffff',
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#16a34a', priceOld: '#9ca3af',
        badgeBg: `${primaryColor || '#2563eb'}15`, badgeText: primaryColor || '#2563eb',
        shadow: 'rgba(0,0,0,0.08)', divider: '#f3f4f6',
        fontDisplay: "'Inter', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
      };
  }
}

// ========== SCHEMA BUILDER (deterministic, no AI) ==========

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function installments(price: number, n = 12): string {
  const inst = price / n;
  return `${n}x de R$ ${inst.toFixed(2).replace('.', ',')}`;
}

interface BuildSchemaInput {
  storeName: string;
  primaryColor: string;
  visualWeight: string;
  mainProduct: ProductData;
  allProducts: ProductData[];
  kits: ProductData[];
  reviews: ReviewData[];
  assets: ResolvedAssets;
  ctaText: string;
  ctaUrl: string;
  showHeader: boolean;
  showFooter: boolean;
  storeBaseUrl: string; // e.g. https://loja.example.com or empty
}

function buildBaseSchema(input: BuildSchemaInput) {
  const c = getColorScheme(input.visualWeight, input.primaryColor);
  const p = input.mainProduct;
  
  const sections: any[] = [];

  // Hero
  sections.push({
    id: 'hero',
    type: 'hero',
    props: {
      badge: p.brand || input.storeName,
      title: p.name,
      subtitle: p.shortDescription || p.description?.substring(0, 150) || 'Descubra por que milhares de pessoas já escolheram este produto.',
      benefits: [
        p.shortDescription || 'Resultados comprovados por milhares de clientes',
        'Fórmula exclusiva de alta performance',
        'Satisfação garantida ou seu dinheiro de volta',
      ],
      ctaText: input.ctaText,
      ctaUrl: input.ctaUrl,
      productImageUrl: input.assets.heroImageUrl,
      backgroundImageUrl: input.assets.heroBackgroundUrl || undefined,
      priceDisplay: p.compareAtPrice && p.compareAtPrice > p.price
        ? `De <s>${formatPrice(p.compareAtPrice)}</s> por <strong>${formatPrice(p.price)}</strong>`
        : undefined,
    },
  });

  // Benefits
  const benefitItems = [
    { label: 'QUALIDADE PREMIUM', title: 'Desenvolvido com os melhores ingredientes', description: 'Cada detalhe foi pensado para entregar o máximo resultado. Tecnologia avançada combinada com ingredientes selecionados.', imageUrl: input.assets.benefitImages[0] || '' },
    { label: 'RESULTADO COMPROVADO', title: 'Aprovado por quem mais entende', description: 'Milhares de clientes satisfeitos comprovam a eficácia. Resultados visíveis desde as primeiras utilizações.', imageUrl: input.assets.benefitImages[1] || '' },
    { label: 'FÁCIL DE USAR', title: 'Praticidade no seu dia a dia', description: 'Integre facilmente na sua rotina. Simples, rápido e eficiente — sem complicação.', imageUrl: input.assets.benefitImages[2] || '' },
  ];
  sections.push({ id: 'benefits', type: 'benefits', props: { items: benefitItems } });

  // Testimonials (if reviews exist)
  if (input.reviews.length > 0) {
    const displayReviews = input.reviews.slice(0, 6);
    const avgRating = (displayReviews.reduce((s, r) => s + r.rating, 0) / displayReviews.length).toFixed(1);
    sections.push({
      id: 'testimonials',
      type: 'testimonials',
      props: {
        badge: 'AVALIAÇÕES REAIS',
        title: 'O que nossos clientes dizem',
        subtitle: `Nota média: ${avgRating}/5 — ${displayReviews.length}+ avaliações verificadas`,
        items: displayReviews.map(r => ({ name: r.name, rating: r.rating, comment: r.comment })),
      },
    });
  }

  // Social Proof (if images exist)
  if (input.assets.socialProofImages.length > 0) {
    sections.push({
      id: 'social_proof',
      type: 'social_proof',
      props: {
        badge: 'RESULTADOS REAIS',
        title: 'Transformações de quem já usa',
        imageUrls: input.assets.socialProofImages.slice(0, 12),
      },
    });
  }

  // Pricing
  const pricingProducts = input.kits.length > 0 ? [...input.kits] : [input.mainProduct];
  pricingProducts.sort((a, b) => a.price - b.price);
  const featuredIdx = pricingProducts.length === 3 ? 1 :
    pricingProducts.reduce((best, prod, i) => (prod.discountPercent || 0) > (pricingProducts[best].discountPercent || 0) ? i : best, 0);

  sections.push({
    id: 'pricing',
    type: 'pricing',
    props: {
      badge: 'OFERTAS ESPECIAIS',
      title: 'Escolha a melhor opção para você',
      subtitle: 'Quanto maior o kit, maior a economia',
      cards: pricingProducts.map((prod, i) => {
        // Build product URL: /p/{slug} for storefront
        const productUrl = prod.slug && input.storeBaseUrl
          ? `${input.storeBaseUrl}/p/${prod.slug}`
          : (prod.slug ? `/p/${prod.slug}` : input.ctaUrl);
        
        return {
        name: prod.name,
        imageUrl: (prod.id && input.assets.offerCardImages[prod.id]) || prod.primaryImage || input.assets.heroImageUrl,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice || null,
        discountPercent: prod.discountPercent || null,
        installments: installments(prod.price),
        ctaText: input.ctaText,
        ctaUrl: productUrl,
        isFeatured: i === featuredIdx,
        featuredBadge: i === featuredIdx ? '🔥 MAIS VENDIDO' : undefined,
        };
      }),
    },
  });

  // FAQ
  sections.push({
    id: 'faq',
    type: 'faq',
    props: {
      badge: 'DÚVIDAS FREQUENTES',
      title: 'Perguntas Frequentes',
      items: [
        { question: `O ${p.name} realmente funciona?`, answer: 'Sim! Nosso produto é testado e aprovado por milhares de clientes satisfeitos. Os resultados são comprovados por avaliações reais.' },
        { question: 'Qual o prazo de entrega?', answer: 'Enviamos em até 24h úteis após a confirmação do pagamento. O prazo de entrega varia de acordo com a sua região.' },
        { question: 'Posso parcelar minha compra?', answer: `Sim! Parcelamos em até 12x no cartão de crédito. O ${p.name} por apenas ${installments(p.price)} sem juros.` },
        { question: 'Tem garantia?', answer: 'Oferecemos garantia de satisfação. Se não ficar satisfeito, devolvemos seu dinheiro.' },
        { question: 'O produto é original?', answer: `Sim, 100% original e com nota fiscal. Somos ${input.storeName}, revendedor autorizado.` },
      ],
    },
  });

  // Guarantee
  sections.push({
    id: 'guarantee',
    type: 'guarantee',
    props: {
      title: 'Garantia de Satisfação',
      description: `Sua compra é 100% segura. Se por qualquer motivo você não ficar satisfeito com o ${p.name}, devolvemos seu dinheiro integralmente. Sem burocracia, sem perguntas.`,
      badges: ['✓ Compra Segura', '✓ Pagamento Protegido', '✓ Envio Garantido'],
    },
  });

  // CTA Final
  sections.push({
    id: 'cta_final',
    type: 'cta_final',
    props: {
      title: 'Não perca essa oportunidade',
      description: `Garanta o seu ${p.name} agora mesmo com condições especiais.`,
      productImageUrl: input.assets.heroImageUrl,
      priceDisplay: p.compareAtPrice && p.compareAtPrice > p.price
        ? `<span style="text-decoration:line-through;color:${c.priceOld}">De ${formatPrice(p.compareAtPrice)}</span><br/><span style="font-size:2.4rem;font-weight:800;color:${c.priceCurrent}">${formatPrice(p.price)}</span>`
        : `<span style="font-size:2.4rem;font-weight:800;color:${c.priceCurrent}">${formatPrice(p.price)}</span>`,
      ctaText: input.ctaText,
      ctaUrl: input.ctaUrl,
    },
  });

  return {
    version: '7.0' as const,
    visualStyle: (input.visualWeight || 'premium') as any,
    colorScheme: c,
    showHeader: input.showHeader,
    showFooter: input.showFooter,
    sections,
  };
}

// ========== AI COPY REFINEMENT FOR SCHEMA ==========

function buildSchemaRefinementPrompt(params: {
  storeName: string;
  productName: string;
  niche: string;
  visualWeight: string;
  prompt: string;
  currentSchema: any;
}): { system: string; user: string } {
  const { storeName, productName, niche, visualWeight, prompt, currentSchema } = params;

  const system = `Você é um copywriter de elite especializado em landing pages de alta conversão.

## SUA FUNÇÃO
Você recebe o schema JSON de uma landing page com seções, títulos, descrições, benefícios, FAQs, etc.
Sua tarefa é melhorar APENAS os TEXTOS (títulos, subtítulos, descrições, benefícios, FAQs, badges, CTAs).

## REGRAS ABSOLUTAS
1. RETORNE o schema JSON COMPLETO e VÁLIDO — com a mesma estrutura
2. NÃO mude URLs de imagem
3. NÃO mude preços ou dados numéricos
4. NÃO adicione ou remova seções
5. NÃO mude o campo "type" de nenhuma seção
6. NÃO mude os IDs das seções
7. NÃO mude o colorScheme, visualStyle ou version
8. NÃO mude showHeader/showFooter
9. NÃO invente URLs
10. Melhore os textos para serem mais persuasivos, específicos ao nicho e orientados a conversão
11. NUNCA use markdown nos textos — proibido usar **, *, ##, __, \`\` ou qualquer formatação markdown
12. Todos os textos devem ser plain text puro, sem nenhuma marcação de formatação
13. Use CAPS LOCK para dar ênfase, nunca asteriscos
14. REGRA DE CTA: Todos os ctaText DEVEM ser CURTOS (máximo 20 caracteres). Exemplos corretos: "Comprar agora", "Quero meu kit", "Aproveitar oferta", "Garantir o meu". PROIBIDO usar frases longas ou explicativas nos botões.

## CONTEXTO
- Loja: ${storeName}
- Produto: ${productName}
- Nicho: ${niche}
- Estilo: ${visualWeight}

## FORMATO DE SAÍDA
Retorne APENAS o JSON completo do schema, sem markdown code fences, sem explicações.`;

  const user = `Melhore os textos deste schema de landing page conforme a direção criativa:

DIREÇÃO: ${prompt}

SCHEMA ATUAL:
${JSON.stringify(currentSchema, null, 2)}

Retorne o JSON completo com os textos melhorados.`;

  return { system, user };
}

// ========== AI ADJUSTMENT FOR SCHEMA ==========

function buildSchemaAdjustmentPrompt(params: {
  storeName: string;
  productName: string;
  prompt: string;
  currentSchema: any;
}): { system: string; user: string } {
  const { storeName, productName, prompt, currentSchema } = params;

  const system = `Você é um editor de landing pages de alta conversão. Você recebe o schema JSON de uma landing page e uma solicitação de ajuste.

## SUAS CAPACIDADES
Você pode fazer QUALQUER tipo de ajuste na landing page:
- Alterar textos, títulos, descrições, CTAs, badges
- Alterar cores, estilos visuais
- Adicionar, remover ou reordenar seções inteiras
- Trocar produtos/ofertas na seção de pricing (substituir cards inteiros)
- Criar novas seções (hero, benefits, testimonials, social_proof, pricing, faq, guarantee, cta_final)
- Reconstruir seções existentes com novo conteúdo
- Alterar a estrutura dos cards de oferta

## REGRAS
1. RETORNE o schema JSON COMPLETO e VÁLIDO — com todas as seções
2. NÃO invente URLs de imagem — mantenha as existentes ou use "" se não houver
3. NÃO mude colorScheme, version ou visualStyle a menos que solicitado
4. NUNCA use markdown nos textos — proibido usar **, *, ##, __, \`\` ou qualquer formatação
5. Todos os textos devem ser plain text puro
6. Use CAPS LOCK para dar ênfase, nunca asteriscos
7. Quando solicitado trocar um produto/oferta no pricing, altere o nome, preço, CTA e demais campos do card
8. Quando solicitado criar uma seção, use a estrutura de seções existentes como referência
9. REGRA DE CTA: Todos os ctaText DEVEM ser CURTOS (máximo 20 caracteres). Exemplos: "Comprar agora", "Quero meu kit", "Aproveitar oferta". PROIBIDO frases longas.

## TIPOS DE SEÇÃO SUPORTADOS
- hero: { badge, title, subtitle, benefits[], ctaText, ctaUrl, productImageUrl, backgroundImageUrl, priceDisplay }
- benefits: { items[{ label, title, description, imageUrl }] }
- testimonials: { badge, title, subtitle, items[{ name, rating, comment }] }
- social_proof: { badge, title, imageUrls[] }
- pricing: { badge, title, subtitle, cards[{ name, imageUrl, price, compareAtPrice, discountPercent, installments, ctaText, ctaUrl, isFeatured, featuredBadge }] }
- faq: { badge, title, items[{ question, answer }] }
- guarantee: { title, description, badges[] }
- cta_final: { title, description, productImageUrl, priceDisplay, ctaText, ctaUrl }

## CONTEXTO
- Loja: ${storeName}
- Produto principal: ${productName}

## FORMATO DE SAÍDA
Retorne APENAS o JSON completo do schema atualizado, sem markdown code fences, sem explicações.`;

  const user = `Ajuste este schema de landing page conforme a solicitação abaixo.

SOLICITAÇÃO DO USUÁRIO: ${prompt}

SCHEMA ATUAL:
${JSON.stringify(currentSchema, null, 2)}

Retorne o JSON completo atualizado.`;

  return { system, user };
}

// ========== JSON RESPONSE PARSER ==========

function parseJsonResponse(raw: string): any | null {
  let text = raw.trim();
  
  // Remove markdown code fences
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('[AI-LP-Generate] Failed to parse JSON response');
    return null;
  }
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

    // Fetch the landing page
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, generated_css, generated_schema, current_version, show_header, show_footer, briefing, is_published")
      .eq("id", landingPageId)
      .single();

    if (lpError) { console.error("[AI-LP-Generate] Error fetching landing page:", lpError); throw new Error("Landing page not found"); }

    productIds = productIds && productIds.length > 0 ? productIds : (savedLandingPage?.product_ids || []);
    referenceUrl = referenceUrl || savedLandingPage?.reference_url || undefined;
    briefing = briefing || (savedLandingPage?.briefing as BriefingInput | null) || undefined;

    console.log(`[AI-LP-Generate] Using ${productIds?.length || 0} products, promptType: ${promptType}`);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url")
      .eq("tenant_id", tenantId)
      .single();

    const storeName = storeSettings?.store_name || "Loja";
    const primaryColor = storeSettings?.primary_color || "#6366f1";

    // ===== STEP 1: FETCH PRODUCTS =====
    const allProducts: ProductData[] = [];
    const kits: ProductData[] = [];
    const reviews: ReviewData[] = [];
    let firstProduct: ProductData | null = null;
    let reviewCount = 0;
    const kitProductIds: string[] = [];

    if (productIds && productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, product_type, tags")
        .in("id", productIds);

      if (products && products.length > 0) {
        // Fetch images
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
          if (img.is_primary && !primaryImageByProduct.has(img.product_id)) {
            primaryImageByProduct.set(img.product_id, img.url);
          }
        });

        for (const p of products) {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImg = primaryImageByProduct.get(p.id) || prodImages[0] || '';
          const compareAt = p.compare_at_price || null;
          const discount = compareAt && compareAt > p.price
            ? Math.round(((compareAt - p.price) / compareAt) * 100)
            : null;

          const pd: ProductData = {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compareAtPrice: compareAt,
            discountPercent: discount,
            primaryImage: primaryImg,
            allImages: prodImages,
            shortDescription: p.short_description || undefined,
            description: p.description || undefined,
            brand: p.brand || undefined,
          };

          allProducts.push(pd);
          if (!firstProduct) firstProduct = pd;
        }

        // Auto-discover kits — STRICT: only kits where ALL components are from selected products
        try {
          // Step 1: Find kits that contain at least one of the selected products
          const { data: relatedKits } = await supabase
            .from("product_components")
            .select("parent_product_id, component_product_id")
            .in("component_product_id", productIds);

          if (relatedKits && relatedKits.length > 0) {
            // Get unique parent kit IDs (candidates)
            const candidateKitIds = [...new Set(relatedKits.map((r: any) => r.parent_product_id))]
              .filter((kitId: string) => !productIds!.includes(kitId));

            if (candidateKitIds.length > 0) {
              // Step 2: Fetch ALL components for each candidate kit (not just the matching ones)
              const { data: allKitComponents } = await supabase
                .from("product_components")
                .select("parent_product_id, component_product_id")
                .in("parent_product_id", candidateKitIds);

              // Group ALL components by kit
              const fullKitComponentMap = new Map<string, Set<string>>();
              for (const r of (allKitComponents || [])) {
                if (!fullKitComponentMap.has(r.parent_product_id)) {
                  fullKitComponentMap.set(r.parent_product_id, new Set());
                }
                fullKitComponentMap.get(r.parent_product_id)!.add(r.component_product_id);
              }

              // Step 3: STRICT filter — ALL components of the kit must be from selected products
              const strictKitIds = [...fullKitComponentMap.entries()]
                .filter(([_parentId, allComponents]) => {
                  // Every single component must be one of the selected products
                  for (const compId of allComponents) {
                    if (!productIds!.includes(compId)) return false;
                  }
                  return allComponents.size > 0;
                })
                .map(([parentId]) => parentId)
                .slice(0, 3); // Max 3 kits

              console.log(`[AI-LP-Generate] Kit discovery: ${candidateKitIds.length} candidates → ${strictKitIds.length} strict matches`);

            if (strictKitIds.length > 0) {
              const { data: kitProducts } = await supabase
                .from("products")
                .select("id, name, slug, price, compare_at_price, product_format, status")
                .in("id", strictKitIds)
                .eq("product_format", "with_composition")
                .in("status", ["active", "inactive"])
                .is("deleted_at", null);

              if (kitProducts && kitProducts.length > 0) {
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
                  const discount = compareAt && compareAt > kit.price
                    ? Math.round(((compareAt - kit.price) / compareAt) * 100)
                    : null;
                  kits.push({
                    id: kit.id,
                    name: kit.name,
                    slug: kit.slug,
                    price: kit.price,
                    compareAtPrice: compareAt,
                    discountPercent: discount,
                    primaryImage: kitPrimaryImage.get(kit.id) || '',
                    isKit: true,
                  });
                }
                console.log(`[AI-LP-Generate] Auto-discovered ${kits.length} kits`);
              }
            }
            } // end candidateKitIds.length > 0
          } // end relatedKits
        } catch (kitErr) {
          console.warn("[AI-LP-Generate] Kit discovery error:", kitErr);
        }

        // Fetch reviews
        const { data: reviewsData } = await supabase
          .from("product_reviews")
          .select("reviewer_name, rating, comment")
          .in("product_id", productIds)
          .eq("status", "approved")
          .order("rating", { ascending: false })
          .limit(10);

        if (reviewsData && reviewsData.length > 0) {
          for (const r of reviewsData) {
            reviews.push({ name: r.reviewer_name || 'Cliente', rating: r.rating, comment: r.comment });
          }
          reviewCount = reviewsData.length;
        }
      }
    }

    // ===== STEP 2: RESOLVE ENGINE PLAN =====
    const fpProduct = allProducts[0];
    
    // Auto-detect visual style from prompt if no briefing.visualStyle
    let effectiveBriefing = briefing || null;
    if (!effectiveBriefing?.visualStyle && prompt) {
      const promptLower = prompt.toLowerCase();
      let detectedStyle: string | undefined;
      if (promptLower.includes('premium') || promptLower.includes('luxo') || promptLower.includes('sofisticad') || promptLower.includes('elegante') || promptLower.includes('dark') || promptLower.includes('escur')) {
        detectedStyle = 'premium';
      } else if (promptLower.includes('minimalista') || promptLower.includes('clean') || promptLower.includes('limpo')) {
        detectedStyle = 'minimalista';
      } else if (promptLower.includes('comercial') || promptLower.includes('agressiv') || promptLower.includes('vend')) {
        detectedStyle = 'comercial';
      } else if (promptLower.includes('direto') || promptLower.includes('simples') || promptLower.includes('objetivo')) {
        detectedStyle = 'direto';
      }
      if (detectedStyle) {
        effectiveBriefing = { 
          ...(effectiveBriefing || { objective: 'sale' as const, trafficTemp: 'cold' as const, trafficSource: 'meta' as const, awarenessLevel: 'pain_aware' as const }),
          visualStyle: detectedStyle as any,
        };
        console.log(`[AI-LP-Generate] Auto-detected visualStyle from prompt: ${detectedStyle}`);
      }
    }
    
    const enginePlan = resolveEnginePlan({
      briefing: effectiveBriefing,
      productType: null,
      tags: null,
      description: fpProduct?.description || null,
      price: fpProduct?.price || null,
      reviewCount,
    });

    console.log(`[AI-LP-Generate] Engine Plan: visual=${enginePlan.resolvedVisualWeight}, niche=${enginePlan.resolvedNiche}`);

    const ctaText = "COMPRAR AGORA";
    const ctaUrl = "#ofertas";
    const showHeader = savedLandingPage?.show_header ?? false;
    const showFooter = savedLandingPage?.show_footer ?? false;

    // Resolve store base URL for product links
    let storeBaseUrl = '';
    try {
      const { data: tenantData } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
      const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
      storeBaseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantData?.slug ? `https://${tenantData.slug}.shops.comandocentral.com.br` : '');
    } catch { /* non-blocking */ }

    // ===== V7: SCHEMA-FIRST GENERATION =====

    let finalSchema: any = null;
    let finalHtml: string | null = null;
    let finalCss: string | null = null;
    let aiRefinementUsed = false;
    let parseError: string | undefined;

    if (promptType === "adjustment" && savedLandingPage?.generated_schema) {
      // ── ADJUSTMENT MODE: AI edits existing SCHEMA ──
      console.log(`[AI-LP-Generate] V7 Schema adjustment mode`);
      
      const { system, user } = buildSchemaAdjustmentPrompt({
        storeName,
        productName: firstProduct?.name || 'Produto',
        prompt,
        currentSchema: savedLandingPage.generated_schema,
      });

      resetAIRouterCache();
      const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
      }, {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        logPrefix: "[AI-LP-Schema-Adjust]",
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        const parsed = parseJsonResponse(rawContent);
        if (parsed && parsed.sections && parsed.sections.length > 0) {
          finalSchema = parsed;
          aiRefinementUsed = true;
          console.log(`[AI-LP-Generate] Schema adjustment applied: ${parsed.sections.length} sections`);
        } else {
          finalSchema = savedLandingPage.generated_schema;
          parseError = 'AI schema adjustment returned invalid JSON, kept existing';
        }
      } else {
        finalSchema = savedLandingPage.generated_schema;
        parseError = `AI schema adjustment failed: ${aiResponse.status}`;
      }

    } else {
      // ── GENERATION MODE: Build base schema + AI copy refinement ──
      console.log(`[AI-LP-Generate] V7 Schema generation mode`);

      if (!firstProduct) {
        throw new Error("No products found to generate landing page");
      }

      // Resolve assets deterministically
      const nicheKey = enginePlan.resolvedNiche || 'geral';
      const assets = await resolveLandingPageAssets({
        supabase,
        tenantId,
        productIds: productIds || [],
        kitProductIds,
        niche: nicheKey,
      });

      // Build base schema from templates (instant, no AI)
      const baseSchema = buildBaseSchema({
        storeName,
        primaryColor,
        visualWeight: enginePlan.resolvedVisualWeight,
        mainProduct: firstProduct,
        allProducts,
        kits,
        reviews,
        assets,
        ctaText,
        ctaUrl,
        showHeader,
        showFooter,
        storeBaseUrl,
      });

      // AI refines copy in the schema
      try {
        const enrichedPrompt = isPromptIncomplete(prompt)
          ? `${prompt}\n\nDIREÇÃO: ${selectBestFallback(null, null, firstProduct.description || null, firstProduct.name).prompt}`
          : prompt;

        const { system, user } = buildSchemaRefinementPrompt({
          storeName,
          productName: firstProduct.name,
          niche: enginePlan.resolvedNiche,
          visualWeight: enginePlan.resolvedVisualWeight,
          prompt: enrichedPrompt,
          currentSchema: baseSchema,
        });

        resetAIRouterCache();
        const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.6,
        }, {
          supabaseUrl,
          supabaseServiceKey: supabaseKey,
          logPrefix: "[AI-LP-Schema-Copy]",
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "";
          const parsed = parseJsonResponse(rawContent);
          if (parsed && parsed.sections && parsed.sections.length >= baseSchema.sections.length * 0.5) {
            finalSchema = parsed;
            aiRefinementUsed = true;
            console.log(`[AI-LP-Generate] AI copy refinement applied to schema`);
          } else {
            console.warn("[AI-LP-Generate] AI schema output invalid, using base schema");
            finalSchema = baseSchema;
            parseError = 'AI schema refinement invalid';
          }
        } else {
          console.warn(`[AI-LP-Generate] AI schema refinement failed, using base schema`);
          finalSchema = baseSchema;
          parseError = `AI schema copy failed: ${aiResponse.status}`;
        }
      } catch (aiErr) {
        console.warn("[AI-LP-Generate] AI schema error, using base schema:", aiErr);
        finalSchema = baseSchema;
        parseError = 'AI schema error';
      }
    }

    if (!finalSchema || !finalSchema.sections || finalSchema.sections.length === 0) {
      throw new Error("Generated schema is empty");
    }

    // Ensure version field
    finalSchema.version = '7.0';

    // ===== STEP 5: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    // Preserve published status if page was already published
    const isCurrentlyPublished = savedLandingPage?.is_published === true;
    
    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_schema: finalSchema,
        generated_html: null, // V7 uses schema, clear HTML
        generated_css: null,
        generated_blocks: null,
        current_version: newVersion,
        status: isCurrentlyPublished ? "published" : "draft",
        metadata: {
          engineVersion: "v7.0",
          schemaFirst: true,
          aiRefinementUsed,
          visualWeight: enginePlan.resolvedVisualWeight,
          niche: enginePlan.resolvedNiche,
          sectionCount: finalSchema.sections.length,
          parseError: parseError || null,
          productCount: allProducts.length,
          kitCount: kits.length,
          reviewCount,
          socialProofCount: finalSchema.sections.find((s: any) => s.type === 'social_proof')?.props?.imageUrls?.length || 0,
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
        html_content: '', // V7 doesn't generate HTML
        css_content: null,
        blocks_content: null,
        schema_content: finalSchema,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v7.0",
          schemaFirst: true,
          aiRefinementUsed,
          model: aiRefinementUsed ? "google/gemini-2.5-flash" : "none",
          section_count: finalSchema.sections.length,
          product_count: allProducts.length,
          kit_count: kits.length,
          reviews_count: reviewCount,
          parseError: parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate v${VERSION}] Success! Version ${newVersion}, ${finalSchema.sections.length} sections, AI refined: ${aiRefinementUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        engineVersion: "v7.0",
        schemaFirst: true,
        sectionCount: finalSchema.sections.length,
        aiRefinementUsed,
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
