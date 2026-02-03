// =============================================
// AI LANDING PAGE GENERATE
// Edge function para gerar landing pages com IA
// Usa Lovable AI Gateway (Gemini) para geração
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const VERSION = "1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
    const { landingPageId, tenantId, userId, prompt, promptType, referenceUrl, productIds } = body;

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

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, contact_phone, contact_email")
      .eq("tenant_id", tenantId)
      .single();

    // Fetch products if provided - include images!
    let productsInfo = "";
    let productImages: string[] = [];
    if (productIds && productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, description, price, compare_at_price, image_url, benefits")
        .in("id", productIds);

      if (products && products.length > 0) {
        // Fetch product images
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, alt_text")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false });

        const imagesByProduct = new Map<string, { url: string; alt_text: string | null }[]>();
        images?.forEach(img => {
          if (!imagesByProduct.has(img.product_id)) {
            imagesByProduct.set(img.product_id, []);
          }
          imagesByProduct.get(img.product_id)!.push({ url: img.url, alt_text: img.alt_text });
        });

        productsInfo = products.map(p => {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImage = prodImages[0]?.url || p.image_url;
          const allImageUrls = prodImages.map(img => img.url);
          
          // Collect all image URLs for the prompt
          if (primaryImage) productImages.push(primaryImage);
          allImageUrls.forEach(url => {
            if (url && !productImages.includes(url)) productImages.push(url);
          });

          return `
### Produto: ${p.name}
- **Descrição**: ${p.description || "Sem descrição disponível"}
- **Preço de Venda**: R$ ${(p.price / 100).toFixed(2)}
${p.compare_at_price ? `- **Preço Original (riscado)**: R$ ${(p.compare_at_price / 100).toFixed(2)}` : ""}
- **Benefícios**: ${p.benefits || "N/A"}
- **Imagem Principal**: ${primaryImage || "Sem imagem"}
${allImageUrls.length > 1 ? `- **Outras Imagens**: ${allImageUrls.slice(1).join(", ")}` : ""}
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

## REGRAS CRÍTICAS:
1. Gere APENAS HTML válido e completo, pronto para renderização
2. Use CSS inline ou em tags <style> dentro do HTML
3. O design deve ser moderno, responsivo e otimizado para conversão
4. Inclua CTAs claros e visíveis (botões de compra devem linkar para /cart ou página do produto)
5. Use as cores e identidade visual da marca quando fornecidas
6. Inclua seções típicas de landing pages de alta conversão:
   - Hero com headline impactante
   - Benefícios/Features
   - Prova social (depoimentos fictícios mas realistas)
   - Garantias
   - FAQ
   - CTA final
7. O HTML deve ser self-contained (não depender de arquivos externos exceto Google Fonts)
8. Use fontes do Google Fonts via @import se necessário
9. Mantenha o código limpo e organizado

## ⚠️ REGRA MAIS IMPORTANTE - PRODUTOS:
**USE EXCLUSIVAMENTE OS PRODUTOS LISTADOS ABAIXO!**
- NÃO invente produtos
- NÃO copie produtos de URLs de referência
- Use APENAS o nome, descrição, preço e imagens dos produtos fornecidos
- As imagens dos produtos DEVEM ser usadas no HTML (tags <img src="URL">)

## ⚠️ REGRA SOBRE URL DE REFERÊNCIA:
Se uma URL de referência for fornecida, use-a APENAS como inspiração para:
- Estrutura/layout da página
- Estilo visual (cores, tipografia, espaçamento)
- Tipos de seções e organização
**NUNCA COPIE O CONTEÚDO, TEXTOS OU PRODUTOS DA URL DE REFERÊNCIA!**

## Informações da Loja:
- Nome: ${storeSettings?.store_name || "Loja"}
- Cor Principal: ${storeSettings?.primary_color || "#6366f1"}
- Telefone: ${storeSettings?.contact_phone || ""}
- Email: ${storeSettings?.contact_email || ""}

${productsInfo ? `## PRODUTOS A SEREM DESTACADOS (USE ESTES E APENAS ESTES!):\n${productsInfo}` : "## ATENÇÃO: Nenhum produto foi selecionado. Crie uma landing page genérica para a loja."}

${productImages.length > 0 ? `## IMAGENS DOS PRODUTOS (USE NO HTML!):\n${productImages.map((url, i) => `${i + 1}. ${url}`).join("\n")}` : ""}

${referenceUrl ? `## URL de Referência (APENAS PARA INSPIRAÇÃO VISUAL/ESTRUTURAL!):\n${referenceUrl}\n⚠️ USE APENAS A ESTRUTURA E ESTILO, NÃO O CONTEÚDO!` : ""}

${currentHtml ? `## HTML Atual (para ajustes):\n${currentHtml}` : ""}

IMPORTANTE: Retorne APENAS o HTML, sem explicações ou markdown. O HTML deve começar com <!DOCTYPE html>.`;

    const userPrompt = promptType === "adjustment"
      ? `Faça os seguintes ajustes na landing page atual:\n\n${prompt}\n\nRetorne o HTML completo atualizado.`
      : `Crie uma landing page baseada nas seguintes instruções:\n\n${prompt}\n\nRetorne o HTML completo.`;

    console.log(`[AI-LP-Generate] Calling AI Gateway for ${promptType}...`);

    // Call Lovable AI Gateway
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 16000,
      }),
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
