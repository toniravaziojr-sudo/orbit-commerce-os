// =============================================
// AI LANDING PAGE GENERATE
// Edge function para gerar landing pages com IA
// Usa Lovable AI Gateway (Gemini) para geração
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "1.4.0"; // Use centralized ai-router (Gemini/OpenAI native priority)

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

    if (!LOVABLE_API_KEY) {
      console.error("[AI-LP-Generate] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

          // Calculate discount percentage if compare_at_price exists
          // IMPORTANT: Prices in database are stored in CENTS (integer) OR in REAIS (decimal)
          // Check if price seems like cents (> 1000 for R$10+) or reais (< 1000 for R$10+)
          const priceIsInCents = p.price > 1000; // If price > 1000, it's likely cents
          const priceInReais = priceIsInCents ? (p.price / 100) : p.price;
          const compareAtPriceInReais = p.compare_at_price 
            ? (priceIsInCents ? (p.compare_at_price / 100) : p.compare_at_price)
            : null;
          
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
- **Imagem Principal**: ${primaryImage || "SEM IMAGEM - ERRO!"}
- **TODAS AS IMAGENS REAIS DO PRODUTO (USE ESTAS!)**: 
${allImageUrls.length > 0 ? allImageUrls.map((url, i) => `  ${i + 1}. ${url}`).join("\n") : "  NENHUMA IMAGEM ENCONTRADA"}
- **Imagem Principal**: ${primaryImage || "Sem imagem"}
${allImageUrls.length > 1 ? `- **Galeria de Imagens** (${allImageUrls.length} imagens):\n${allImageUrls.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}` : ""}
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

    // Build system prompt with CLEAR instructions about reference vs product data
    const systemPrompt = `Você é um especialista em criar landing pages de alta conversão. Seu trabalho é gerar HTML completo e estilizado para landing pages.

## REGRAS CRÍTICAS - OBRIGATÓRIO SEGUIR:
1. Gere APENAS HTML válido e completo, pronto para renderização (começando com <!DOCTYPE html>)
2. Use CSS inline ou em tags <style> dentro do HTML
3. O design deve ser moderno, responsivo e otimizado para conversão
4. Inclua CTAs claros e visíveis (botões de compra devem linkar para /cart ou /p/{slug-do-produto})
5. Use as cores e identidade visual da marca quando fornecidas
6. Inclua seções típicas de landing pages de alta conversão:
   - Hero com headline impactante e IMAGEM DO PRODUTO
   - Benefícios/Features
   - Prova social (depoimentos fictícios mas realistas)
   - Garantias
   - FAQ
   - CTA final
7. O HTML deve ser self-contained (não depender de arquivos externos exceto Google Fonts)
8. Use fontes do Google Fonts via @import se necessário
9. Mantenha o código limpo e organizado

## ⚠️⚠️⚠️ REGRA ABSOLUTAMENTE OBRIGATÓRIA - IMAGENS DOS PRODUTOS ⚠️⚠️⚠️
**VOCÊ DEVE OBRIGATORIAMENTE USAR AS IMAGENS FORNECIDAS!**
- As imagens dos produtos estão listadas abaixo com URLs REAIS
- COPIE E COLE essas URLs exatas nas tags <img src="URL">
- NÃO use placeholder.com, via.placeholder.com ou qualquer outra imagem genérica
- NÃO invente URLs de imagens
- A imagem principal do produto DEVE aparecer em destaque no Hero
- Use as outras imagens na galeria ou seções de detalhes

## ⚠️⚠️⚠️ REGRA ABSOLUTAMENTE OBRIGATÓRIA - PRODUTOS ⚠️⚠️⚠️
**USE EXCLUSIVAMENTE OS PRODUTOS LISTADOS ABAIXO!**
- NÃO invente produtos ou nomes de produtos
- NÃO copie produtos de URLs de referência
- Use EXATAMENTE o nome, descrição, preço que estão listados abaixo
- Se a URL de referência mostra outro produto, IGNORE e use os dados abaixo

## ⚠️ REGRA SOBRE URL DE REFERÊNCIA:
Se uma URL de referência for fornecida, use-a APENAS como inspiração para:
- Estrutura/layout da página (como as seções estão organizadas)
- Estilo visual (cores, tipografia, espaçamento, sombras, bordas)
- Tipos de animações ou efeitos visuais
**NUNCA COPIE: nomes de produtos, preços, descrições, imagens ou textos da URL de referência!**

## Informações da Loja:
- Nome: ${storeSettings?.store_name || "Loja"}
- Cor Principal: ${storeSettings?.primary_color || "#6366f1"}
- Telefone: ${storeSettings?.contact_phone || ""}
- Email: ${storeSettings?.contact_email || ""}

${productsInfo ? `## PRODUTOS A SEREM DESTACADOS (USE ESTES DADOS!):\n${productsInfo}` : "## ATENÇÃO: Nenhum produto foi selecionado. Crie uma landing page genérica para a loja."}

${productImages.length > 0 ? `## ⚠️ IMAGENS DOS PRODUTOS - USE ESTAS URLs EXATAS! ⚠️
COPIE E COLE estas URLs nas tags <img>. NÃO use placeholder ou imagens genéricas:
${productImages.map((url, i) => `${i + 1}. ${url}`).join("\n")}` : ""}

${referenceUrl ? `## URL de Referência (APENAS PARA INSPIRAÇÃO VISUAL/ESTRUTURAL!):\n${referenceUrl}\n⚠️ COPIE APENAS O LAYOUT E ESTILO! USE OS DADOS DOS PRODUTOS ACIMA!` : ""}

${currentHtml ? `## HTML Atual (para ajustes):\n${currentHtml}` : ""}

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

    const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey,
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
          model: "google/gemini-2.5-flash",
          html_length: generatedHtml.length,
          had_reference: !!referenceUrl,
          product_count: productIds?.length || 0,
        },
      });

    if (versionError) {
      console.error("[AI-LP-Generate] Version history error:", versionError);
      // Don't throw - main content was saved
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
