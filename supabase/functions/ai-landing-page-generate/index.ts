// =============================================
// AI LANDING PAGE GENERATE — V6.0 ENGINE
// Motor V6: Templates Pré-Prontos + IA para Copy
// Fase 1: Monta página a partir de templates HTML profissionais
// Fase 2: IA refina copy/headlines (opcional, não afeta layout)
// Fase 3: enhance-images gera composições visuais (assíncrono)
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
import { getNicheImages } from "../_shared/landing-page-stock-images.ts";

const VERSION = "6.0.0"; // Engine V6: Templates + AI Copy

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

// ========== AI COPY REFINEMENT PROMPT ==========

function buildCopyRefinementPrompt(params: {
  storeName: string;
  productName: string;
  niche: string;
  visualWeight: string;
  prompt: string;
  currentHtml: string;
}): { system: string; user: string } {
  const { storeName, productName, niche, visualWeight, prompt, currentHtml } = params;

  const system = `Você é um copywriter de elite especializado em landing pages de alta conversão.

## SUA FUNÇÃO
Você recebe uma landing page HTML COMPLETA e profissional. Sua ÚNICA tarefa é melhorar os TEXTOS (headlines, subtítulos, descrições, benefícios, FAQs, CTAs).

## REGRAS ABSOLUTAS (NÃO NEGOCIÁVEL)
1. MANTENHA toda a estrutura HTML/CSS intacta — NÃO mude classes, tags, estilos, grid, layout
2. MANTENHA todas as URLs de imagem EXATAMENTE como estão
3. MANTENHA todos os preços, nomes de produto e dados comerciais EXATAMENTE como estão
4. MANTENHA as tags <style> INTACTAS — não modifique CSS
5. NÃO adicione novas seções, divs, ou elementos estruturais
6. NÃO remova seções existentes
7. NÃO adicione <!DOCTYPE>, <html>, <head>, <body>, <footer>
8. NÃO invente URLs de imagem
9. NÃO mude nomes de produto

## O QUE VOCÊ PODE MUDAR
- Títulos (h1, h2, h3) — torne mais persuasivos e específicos ao nicho
- Subtítulos e descrições (p) — mais envolventes e orientados a benefícios
- Itens de lista (li) — benefícios mais específicos e tangíveis
- Texto dos FAQs — respostas mais completas e convincentes
- Texto de garantia — mais tranquilizador
- Badges e labels — mais atraentes
- Texto dos CTAs — mais urgentes e direcionados

## CONTEXTO
- Loja: ${storeName}
- Produto: ${productName}
- Nicho: ${niche}
- Estilo: ${visualWeight}

## FORMATO DE SAÍDA
Retorne o HTML COMPLETO (incluindo <style>) com APENAS os textos melhorados. Estrutura idêntica.`;

  const user = `Melhore os textos desta landing page conforme a direção criativa abaixo:

DIREÇÃO: ${prompt}

HTML ATUAL:
\`\`\`html
${currentHtml}
\`\`\`

Retorne o HTML completo com os textos melhorados. Mantenha TODA a estrutura e CSS intactos.`;

  return { system, user };
}

// ========== ADJUSTMENT PROMPT ==========

function buildAdjustmentPrompt(params: {
  storeName: string;
  productName: string;
  prompt: string;
  currentHtml: string;
}): { system: string; user: string } {
  const { storeName, productName, prompt, currentHtml } = params;

  const system = `Você é um editor de landing pages. Você recebe uma página HTML completa e uma solicitação de ajuste.

## REGRAS
1. Faça APENAS o ajuste solicitado
2. MANTENHA toda a estrutura que não precisa mudar
3. MANTENHA todas as URLs de imagem como estão
4. MANTENHA preços e nomes de produto como estão (exceto se o ajuste pedir mudança)
5. MANTENHA as tags <style> e CSS (exceto se o ajuste pedir mudança de cor/estilo)
6. NÃO adicione <!DOCTYPE>, <html>, <head>, <body>, <footer>
7. NÃO invente URLs de imagem

## CONTEXTO
- Loja: ${storeName}
- Produto: ${productName}

## FORMATO DE SAÍDA
Retorne o HTML COMPLETO atualizado com o ajuste aplicado.`;

  const user = `Ajuste esta landing page:

SOLICITAÇÃO: ${prompt}

HTML ATUAL:
\`\`\`html
${currentHtml}
\`\`\`

Retorne o HTML completo com o ajuste aplicado.`;

  return { system, user };
}

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

  // Enforce body-only contract
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

  // Extract CSS
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  const cssBlocks: string[] = [];
  while ((match = styleRegex.exec(html)) !== null) {
    cssBlocks.push(match[1].trim());
  }
  if (cssBlocks.length > 0) {
    css = cssBlocks.join('\n\n');
  }

  // Strip <footer>
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

    // Fetch the landing page
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, generated_css, current_version, show_header, show_footer, briefing")
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
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, published_template_id")
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

        // Auto-discover kits
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
                .select("id, name, slug, price, compare_at_price, product_format, status")
                .in("id", kitParentIds)
                .eq("product_format", "with_composition")
                .eq("status", "active")
                .is("deleted_at", null);

              if (kitProducts && kitProducts.length > 0) {
                const kitIds = kitProducts.map((k: any) => k.id);
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
          }
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

    // Fetch social proof images
    let socialProofImages: string[] = [];
    if (productIds && productIds.length > 0 && promptType !== "adjustment") {
      try {
        const { data: proofFolders } = await supabase
          .from("files")
          .select("id, filename, storage_path")
          .eq("tenant_id", tenantId)
          .eq("is_folder", true)
          .or("filename.ilike.%feedback%,filename.ilike.%review%,filename.ilike.%prova%,filename.ilike.%resultado%,filename.ilike.%depoimento%")
          .limit(10);

        if (proofFolders && proofFolders.length > 0) {
          const folderPaths = proofFolders.map((f: any) => f.storage_path || `drive/${tenantId}/${f.filename}`);
          const orConditions = folderPaths.map((fp: string) => `storage_path.like.${fp}/%`).join(",");
          const { data: proofFiles } = await supabase
            .from("files")
            .select("id, storage_path, mime_type, metadata")
            .eq("tenant_id", tenantId)
            .eq("is_folder", false)
            .ilike("mime_type", "image/%")
            .or(orConditions)
            .order("created_at", { ascending: false })
            .limit(5);

          if (proofFiles) {
            for (const file of proofFiles) {
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
                if (imageUrl) socialProofImages.push(imageUrl);
              } catch (e) { /* non-blocking */ }
            }
          }
        }
      } catch (e) { /* non-blocking */ }
    }

    // ===== STEP 2: RESOLVE ENGINE PLAN =====
    const fpProduct = allProducts[0];
    const enginePlan = resolveEnginePlan({
      briefing: briefing || null,
      productType: null,
      tags: null,
      description: fpProduct?.description || null,
      price: fpProduct?.price || null,
      reviewCount,
    });

    console.log(`[AI-LP-Generate] Engine Plan: visual=${enginePlan.resolvedVisualWeight}, niche=${enginePlan.resolvedNiche}`);

    // ===== STEP 3: DETERMINE CTA =====
    const ctaText = enginePlan.defaultCTA || "COMPRAR AGORA";
    const ctaUrl = "#ofertas";

    // ===== STEP 4: BUILD PAGE FROM TEMPLATES =====
    
    let finalHtml = "";
    let finalCss = "";
    let parseError: string | undefined;
    let aiRefinementUsed = false;

    if (promptType === "adjustment" && savedLandingPage?.generated_html) {
      // ── ADJUSTMENT MODE: AI edits existing HTML ──
      console.log(`[AI-LP-Generate] Adjustment mode — sending current HTML to AI for editing`);
      
      const { system, user } = buildAdjustmentPrompt({
        storeName,
        productName: firstProduct?.name || 'Produto',
        prompt,
        currentHtml: savedLandingPage.generated_html.substring(0, 15000),
      });

      resetAIRouterCache();
      const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
      }, {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        logPrefix: "[AI-LP-Adjust]",
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        if (rawContent.length > 100) {
          const parsed = parseHtmlResponse(rawContent);
          finalHtml = parsed.html;
          finalCss = parsed.css;
          parseError = parsed.parseError;
          aiRefinementUsed = true;
        } else {
          // AI returned too-short response, keep existing
          finalHtml = savedLandingPage.generated_html;
          finalCss = savedLandingPage.generated_css || '';
          parseError = 'AI adjustment returned too-short response, kept existing';
        }
      } else {
        // AI failed, keep existing
        finalHtml = savedLandingPage.generated_html;
        finalCss = savedLandingPage.generated_css || '';
        parseError = `AI adjustment failed: ${aiResponse.status}`;
      }

    } else {
      // ── GENERATION MODE: Templates + AI Copy Refinement ──
      console.log(`[AI-LP-Generate] Generation mode — assembling from templates`);

      if (!firstProduct) {
        throw new Error("No products found to generate landing page");
      }

      // Phase 1: Assemble from templates (instant, no AI needed)
      // Resolve stock images for the niche
      const nicheKey = enginePlan.resolvedNiche || 'geral';
      const stockImages = getNicheImages(nicheKey);
      console.log(`[AI-LP-Generate] Stock images resolved for niche: ${nicheKey}`);

      const templateInput: PageTemplateInput = {
        storeName,
        primaryColor,
        secondaryColor: storeSettings?.secondary_color || undefined,
        accentColor: storeSettings?.accent_color || undefined,
        visualWeight: enginePlan.resolvedVisualWeight as any || 'premium',
        mainProduct: firstProduct,
        allProducts,
        kits,
        reviews,
        socialProofImages,
        ctaText,
        ctaUrl,
        niche: nicheKey,
        stockImages,
      };

      const assembled = assembleLandingPage(templateInput);
      console.log(`[AI-LP-Generate] Templates assembled: ${assembled.html.length} chars, ${assembled.sectionOrder.length} sections: ${assembled.sectionOrder.join(', ')}`);

      // Phase 2: AI refines copy (enhances headlines and descriptions)
      try {
        const enrichedPrompt = isPromptIncomplete(prompt)
          ? `${prompt}\n\nDIREÇÃO: ${selectBestFallback(null, null, firstProduct.description || null, firstProduct.name).prompt}`
          : prompt;

        const { system, user } = buildCopyRefinementPrompt({
          storeName,
          productName: firstProduct.name,
          niche: enginePlan.resolvedNiche,
          visualWeight: enginePlan.resolvedVisualWeight,
          prompt: enrichedPrompt,
          currentHtml: assembled.html,
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
          logPrefix: "[AI-LP-Copy]",
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "";
          if (rawContent.length > 200) {
            const parsed = parseHtmlResponse(rawContent);
            // Validate AI didn't destroy the page
            if (parsed.html.length > assembled.html.length * 0.5) {
              finalHtml = parsed.html;
              finalCss = parsed.css || assembled.css;
              parseError = parsed.parseError;
              aiRefinementUsed = true;
              console.log(`[AI-LP-Generate] AI copy refinement applied: ${parsed.html.length} chars`);
            } else {
              console.warn("[AI-LP-Generate] AI output too short vs template, using template baseline");
              finalHtml = assembled.html;
              finalCss = assembled.css;
              parseError = 'AI copy refinement too short, used template baseline';
            }
          } else {
            console.warn("[AI-LP-Generate] AI returned short response, using template baseline");
            finalHtml = assembled.html;
            finalCss = assembled.css;
            parseError = 'AI copy too short';
          }
        } else {
          console.warn(`[AI-LP-Generate] AI copy refinement failed (${aiResponse.status}), using template baseline`);
          finalHtml = assembled.html;
          finalCss = assembled.css;
          parseError = `AI copy failed: ${aiResponse.status}`;
        }
      } catch (aiErr) {
        console.warn("[AI-LP-Generate] AI copy error, using template baseline:", aiErr);
        finalHtml = assembled.html;
        finalCss = assembled.css;
        parseError = 'AI copy error';
      }
    }

    if (!finalHtml || finalHtml.length < 50) {
      throw new Error("Generated HTML is empty or too short");
    }

    // ===== STEP 5: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_html: finalHtml,
        generated_css: finalCss || null,
        generated_blocks: null,
        current_version: newVersion,
        status: "draft",
        metadata: {
          engineVersion: "v6.0",
          templateBased: true,
          aiRefinementUsed,
          visualWeight: enginePlan.resolvedVisualWeight,
          niche: enginePlan.resolvedNiche,
          htmlLength: finalHtml.length,
          cssLength: finalCss.length,
          parseError: parseError || null,
          productCount: allProducts.length,
          kitCount: kits.length,
          reviewCount,
          socialProofCount: socialProofImages.length,
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
        html_content: finalHtml,
        css_content: finalCss || null,
        blocks_content: null,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v6.0",
          templateBased: true,
          aiRefinementUsed,
          model: aiRefinementUsed ? "google/gemini-2.5-flash" : "none",
          html_length: finalHtml.length,
          product_count: allProducts.length,
          kit_count: kits.length,
          reviews_count: reviewCount,
          parseError: parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate v${VERSION}] Success! Version ${newVersion}, HTML ${finalHtml.length} chars, AI refined: ${aiRefinementUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        htmlLength: finalHtml.length,
        engineVersion: "v6.0",
        templateBased: true,
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
