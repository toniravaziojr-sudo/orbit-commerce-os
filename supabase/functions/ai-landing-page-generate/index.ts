// =============================================
// AI LANDING PAGE GENERATE
// Edge function para gerar landing pages com IA
// Usa ai-router (Gemini/OpenAI) para geração
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "2.0.0"; // Design System prompt + business context + gemini-2.5-pro

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
      .select("store_name, logo_url, primary_color, contact_phone, contact_email")
      .eq("tenant_id", tenantId)
      .single();

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

    const systemPrompt = `Você é um designer e desenvolvedor front-end especialista em landing pages de alta conversão. Seu trabalho é gerar HTML + CSS completo, profissional e visualmente impressionante.

## DESIGN SYSTEM OBRIGATÓRIO

### Tipografia
- Importe Google Fonts: Sora (headlines) + Inter (corpo)
- Hero headline: 48-64px, font-weight 800, letter-spacing -0.02em
- H2 de seção: 32-40px, font-weight 700
- Body: 16-18px, line-height 1.7
- Subtítulos/badges: 13-14px, font-weight 600, text-transform uppercase, letter-spacing 0.05em

### Paleta de Cores
- Cor primária da marca: ${primaryColor}
- Derive automaticamente: variações mais claras (fundo), mais escuras (hover), complementar
- Fundo das seções: alterne entre branco (#ffffff), cinza muito claro (#f8f9fa), e variação suave da cor primária (opacidade 5-8%)
- Textos: #111827 (títulos), #4b5563 (corpo), #9ca3af (auxiliar)
- CTAs: cor primária com gradiente sutil, texto branco

### Layout e Espaçamento
- Container: max-width 1200px, margin auto, padding 0 24px
- Padding vertical entre seções: 80-120px
- Grid gaps: 32-48px
- Hero: full-width com background (gradiente ou imagem), conteúdo centralizado
- Seções com backgrounds alternados para ritmo visual

### Componentes Visuais
- **Cards**: border-radius 16px, background branco, box-shadow: 0 4px 24px rgba(0,0,0,0.06), hover: translateY(-4px) com sombra mais intensa
- **Botões CTA**: padding 18px 48px, border-radius 12px, font-weight 700, font-size 18px, background gradiente da cor primária, box-shadow: 0 4px 16px rgba(cor primária, 0.3), hover: scale(1.02) + sombra mais intensa
- **Badges/Pills**: padding 6px 16px, border-radius 50px, font-size 13px, background cor primária com opacidade 10%, cor primária no texto
- **Ícones**: SVG inline (checkmarks ✓ verdes, estrelas ⭐, escudos 🛡️) em vez de emojis - use elementos visuais estilizados
- **Divisores entre seções**: wave SVG path ou gradiente diagonal sutil
- **Barra de confiança**: ícones + texto em linha, fundo levemente destacado

### Animações CSS (OBRIGATÓRIO)
Inclua estas animações no <style>:
\`\`\`css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.3); }
  50% { box-shadow: 0 0 40px rgba(var(--primary-rgb), 0.5); }
}
\`\`\`
- Aplique \`animation: fadeInUp 0.8s ease-out\` nos cards e seções (com \`animation-delay\` incrementando 0.1s)
- Hover em cards: \`transition: transform 0.3s ease, box-shadow 0.3s ease\`
- Hover em CTAs: \`transition: all 0.3s ease\` com scale e shadow

### Responsividade (Mobile-First)
- Breakpoints: 768px (tablet) e 1024px (desktop)
- Hero: stack vertical no mobile, padding reduzido
- Grids: 3 colunas desktop → 2 colunas tablet → 1 coluna mobile
- Font sizes: reduza 20-30% no mobile
- CTAs: width 100% no mobile
- Imagens: width 100%, object-fit cover, border-radius mantido

### ESTRUTURA OBRIGATÓRIA DA PÁGINA (SEGUIR ESTA ORDEM)
1. **Sticky header fino** (60px altura): logo da loja à esquerda, botão CTA à direita, background semitransparente com backdrop-filter blur
2. **Hero section full-width**: headline bold + subtítulo + CTA + imagem do produto em destaque, background com gradiente
3. **Barra de confiança**: 3-4 ícones com texto (Frete Grátis, Garantia, Pagamento Seguro, Satisfação), background levemente destacado
4. **Seção de benefícios**: grid de 3-4 cards com ícone + título + descrição
5. **Seção Problema → Solução**: layout 2 colunas mostrando a dor do cliente e como o produto resolve
6. **Galeria do produto**: imagens reais do produto em grid visual atraente
7. **Prova social**: cards de depoimento estilizados com nome, estrelas e comentário
8. **Seção comparativa**: "Por que escolher [produto]?" vs alternativas genéricas (tabela ou cards lado a lado)
9. **Oferta com preço**: card destacado com preço, desconto (se houver), condições de pagamento, CTAs
10. **FAQ accordion**: perguntas frequentes com toggle visual (+ / -)
11. **CTA final**: seção de fechamento com garantia reforçada + último CTA
12. **Footer mínimo**: nome da loja, contato, copyright

### CSS BASE (INCLUA NO <style>)
\`\`\`css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: 'Inter', system-ui, sans-serif; color: #111827; line-height: 1.7; }
h1, h2, h3, h4 { font-family: 'Sora', sans-serif; line-height: 1.2; }
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
@media (min-width: 768px) { .section { padding: 100px 0; } }
@media (min-width: 1024px) { .section { padding: 120px 0; } }
\`\`\`

## REGRAS CRÍTICAS

### ⚠️ IMAGENS DOS PRODUTOS
- **USE OBRIGATORIAMENTE** as URLs de imagem fornecidas abaixo
- COPIE E COLE as URLs exatas nas tags \`<img src="URL">\`
- **NUNCA** use placeholder.com, via.placeholder.com ou imagens genéricas
- A imagem principal DEVE aparecer em destaque no Hero
- Use todas as imagens na galeria ou seções de detalhes

### ⚠️ DADOS DOS PRODUTOS
- USE EXCLUSIVAMENTE os produtos listados abaixo
- NÃO invente nomes, preços ou descrições
- NÃO copie dados de URLs de referência
- Preços já estão em Reais (R$) — NÃO divida por 100

### ⚠️ URL DE REFERÊNCIA
Se fornecida, use APENAS como inspiração de layout/estilo visual.
**NUNCA COPIE** conteúdo, textos, produtos ou imagens da referência.

### ⚠️ OUTPUT
- Retorne APENAS HTML completo (começando com \`<!DOCTYPE html>\`)
- CSS inline em tag \`<style>\` no \`<head>\`
- Google Fonts via \`<link>\` no \`<head>\`
- O HTML deve ser 100% self-contained
- **NÃO** inclua explicações, markdown ou comentários fora do HTML

---

## Informações da Loja
- **Nome**: ${storeSettings?.store_name || "Loja"}
- **Logo**: ${storeSettings?.logo_url || "Sem logo"}
- **Cor Principal**: ${primaryColor}
- **Telefone**: ${storeSettings?.contact_phone || ""}
- **Email**: ${storeSettings?.contact_email || ""}

${productsInfo ? `## PRODUTOS A SEREM DESTACADOS:\n${productsInfo}` : "## ATENÇÃO: Nenhum produto selecionado. Crie uma landing page genérica para a loja."}

${productImages.length > 0 ? `## ⚠️ IMAGENS DOS PRODUTOS — USE ESTAS URLs EXATAS:\n${productImages.map((url, i) => `${i + 1}. ${url}`).join("\n")}` : ""}

${reviewsInfo ? `## AVALIAÇÕES REAIS DE CLIENTES (USE COMO PROVA SOCIAL!):\n${reviewsInfo}\n\n> Use estes depoimentos reais na seção de prova social. Mantenha os nomes e ratings exatos. Se houver poucos, complemente com depoimentos fictícios mas realistas.` : "## PROVA SOCIAL:\nNão há avaliações reais disponíveis. Crie depoimentos fictícios mas realistas e convincentes."}

${creativesInfo ? `## REFERÊNCIAS DE MARKETING (TOM, ESTILO E HEADLINES DO NEGÓCIO):\n${creativesInfo}\n\n> Use estas referências para alinhar o tom de voz, estilo de copywriting e abordagem da landing page com o que o negócio já usa em suas campanhas.` : ""}

${referenceUrl ? `## URL DE REFERÊNCIA (APENAS INSPIRAÇÃO VISUAL/ESTRUTURAL!):\n${referenceUrl}\n⚠️ COPIE APENAS O LAYOUT E ESTILO! USE OS DADOS DOS PRODUTOS ACIMA!` : ""}

${currentHtml ? `## HTML ATUAL (para ajustes):\n${currentHtml}` : ""}

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
