import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerationSettings {
  use_packshot?: boolean;
  content_type?: string;
  packshot_url?: string;
  reference_source?: string;
  matched_products?: Array<{ id: string; name: string; image_url: string | null; is_kit?: boolean }>;
  needs_product_image?: boolean;
  is_kit_scenario?: boolean;
  image_size?: string;
}

// Download image and convert to base64 data URL
async function downloadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    console.log("📥 Downloading image from:", url.substring(0, 100));
    const response = await fetch(url);
    if (!response.ok) {
      console.error("❌ Failed to download image:", response.status);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    console.log(`✅ Image downloaded: ${uint8Array.length} bytes, type: ${contentType}`);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("❌ Error downloading image:", error);
    return null;
  }
}

// Extract base64 from data URL
function extractBase64FromDataUrl(dataUrl: string): string | null {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return matches ? matches[2] : null;
}

/**
 * GERAÇÃO COM FAL.AI - gpt-image-1.5/edit (IMAGE-TO-IMAGE)
 * Usa a imagem REAL do produto e cria uma cena/contexto
 */
async function editWithFalAI(
  falApiKey: string,
  prompt: string,
  productImageBase64: string
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  try {
    console.log("🎨 === Fal.AI gpt-image-1.5/edit - PRODUTO REAL ===");
    
    const response = await fetch("https://queue.fal.run/fal-ai/gpt-image-1.5/edit", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: `data:image/png;base64,${productImageBase64}`,
        quality: "high",
        output_format: "png",
        safety_tolerance: "6",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Fal.AI edit error:", response.status, errorText);
      return { imageDataUrl: null, model: "gpt-image-1.5/edit", error: `HTTP ${response.status}: ${errorText}`, usedReference: true };
    }

    const data = await response.json();
    console.log("📦 Fal.AI response:", JSON.stringify(data, null, 2).substring(0, 500));
    
    // Handle queue response - get result URL
    if (data.request_id) {
      console.log("⏳ Fal.AI queued, polling for result...");
      return await pollFalAIResult(falApiKey, data.request_id, "gpt-image-1.5/edit", true);
    }

    // Direct response
    const imageUrl = data.images?.[0]?.url || data.image?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in Fal.AI response:", data);
      return { imageDataUrl: null, model: "gpt-image-1.5/edit", error: "No image in response", usedReference: true };
    }

    // Download the generated image
    const generatedImageDataUrl = await downloadImageAsDataUrl(imageUrl);
    if (!generatedImageDataUrl) {
      return { imageDataUrl: null, model: "gpt-image-1.5/edit", error: "Failed to download generated image", usedReference: true };
    }

    console.log("✅ Fal.AI edit with product reference - SUCCESS");
    return { imageDataUrl: generatedImageDataUrl, model: "gpt-image-1.5/edit", usedReference: true };
  } catch (error) {
    console.error("❌ Error calling Fal.AI edit:", error);
    return { imageDataUrl: null, model: "gpt-image-1.5/edit", error: String(error), usedReference: true };
  }
}

/**
 * GERAÇÃO COM FAL.AI - gpt-image-1.5 (TEXT-TO-IMAGE)
 * Usado quando não há produto específico
 */
async function generateWithFalAI(
  falApiKey: string,
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  try {
    console.log("🎨 === Fal.AI gpt-image-1.5 Text-to-Image ===");
    
    const response = await fetch("https://queue.fal.run/fal-ai/gpt-image-1.5", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        aspect_ratio: aspectRatio,
        quality: "high",
        output_format: "png",
        safety_tolerance: "6",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Fal.AI error:", response.status, errorText);
      return { imageDataUrl: null, model: "gpt-image-1.5", error: `HTTP ${response.status}: ${errorText}`, usedReference: false };
    }

    const data = await response.json();
    console.log("📦 Fal.AI response:", JSON.stringify(data, null, 2).substring(0, 500));
    
    // Handle queue response
    if (data.request_id) {
      console.log("⏳ Fal.AI queued, polling for result...");
      return await pollFalAIResult(falApiKey, data.request_id, "gpt-image-1.5", false);
    }

    // Direct response
    const imageUrl = data.images?.[0]?.url || data.image?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in Fal.AI response:", data);
      return { imageDataUrl: null, model: "gpt-image-1.5", error: "No image in response", usedReference: false };
    }

    const generatedImageDataUrl = await downloadImageAsDataUrl(imageUrl);
    if (!generatedImageDataUrl) {
      return { imageDataUrl: null, model: "gpt-image-1.5", error: "Failed to download generated image", usedReference: false };
    }

    console.log("✅ Fal.AI text-to-image - SUCCESS");
    return { imageDataUrl: generatedImageDataUrl, model: "gpt-image-1.5", usedReference: false };
  } catch (error) {
    console.error("❌ Error calling Fal.AI:", error);
    return { imageDataUrl: null, model: "gpt-image-1.5", error: String(error), usedReference: false };
  }
}

/**
 * Poll Fal.AI queue for result
 */
async function pollFalAIResult(
  falApiKey: string,
  requestId: string,
  model: string,
  usedReference: boolean,
  maxAttempts: number = 60
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  const statusUrl = `https://queue.fal.run/fal-ai/${model.replace('/', '-')}/requests/${requestId}/status`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    try {
      const statusResponse = await fetch(statusUrl, {
        headers: { "Authorization": `Key ${falApiKey}` },
      });
      
      if (!statusResponse.ok) {
        console.log(`⏳ Polling attempt ${attempt + 1}/${maxAttempts}...`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      console.log(`📊 Status: ${statusData.status}`);
      
      if (statusData.status === "COMPLETED") {
        // Get result
        const resultUrl = `https://queue.fal.run/fal-ai/${model.replace('/', '-')}/requests/${requestId}`;
        const resultResponse = await fetch(resultUrl, {
          headers: { "Authorization": `Key ${falApiKey}` },
        });
        
        if (!resultResponse.ok) {
          return { imageDataUrl: null, model, error: "Failed to fetch result", usedReference };
        }
        
        const resultData = await resultResponse.json();
        const imageUrl = resultData.images?.[0]?.url || resultData.image?.url;
        
        if (!imageUrl) {
          return { imageDataUrl: null, model, error: "No image in completed result", usedReference };
        }
        
        const generatedImageDataUrl = await downloadImageAsDataUrl(imageUrl);
        if (!generatedImageDataUrl) {
          return { imageDataUrl: null, model, error: "Failed to download generated image", usedReference };
        }
        
        console.log("✅ Fal.AI polling complete - SUCCESS");
        return { imageDataUrl: generatedImageDataUrl, model, usedReference };
      }
      
      if (statusData.status === "FAILED") {
        return { imageDataUrl: null, model, error: statusData.error || "Generation failed", usedReference };
      }
    } catch (pollError) {
      console.error(`⚠️ Polling error (attempt ${attempt + 1}):`, pollError);
    }
  }
  
  return { imageDataUrl: null, model, error: "Polling timeout", usedReference };
}

// Convert data URL to binary
function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    
    const base64 = matches[2];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("❌ Error converting data URL to binary:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get Fal.AI API key from platform credentials
  const falApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "FAL_API_KEY");
  
  if (!falApiKey) {
    console.error("❌ FAL_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "Fal.AI API key não configurada. Configure em Integrações da Plataforma > IA" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch queued generations (limit 3)
    const { data: generations, error: fetchError } = await supabase
      .from("media_asset_generations")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error("❌ Error fetching queued generations:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar fila" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!generations || generations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Fila vazia", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Processing ${generations.length} queued generations with Fal.AI`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const generation of generations) {
      const genStartTime = Date.now();
      const genId = generation.id;
      
      try {
        // Mark as generating
        await supabase
          .from("media_asset_generations")
          .update({ status: "generating" })
          .eq("id", genId);

        console.log(`\n========== 🎬 Processing generation ${genId} with Fal.AI ==========`);

        // Parse settings
        const settings = (generation.settings || {}) as GenerationSettings;
        const contentType = settings.content_type || "image";
        const needsProductImage = settings.needs_product_image ?? false;
        const matchedProducts = settings.matched_products || [];
        const isKitScenario = settings.is_kit_scenario ?? false;
        const imageSize = settings.image_size || "1024x1024";

        console.log("📋 Settings:", JSON.stringify({
          contentType,
          needsProductImage,
          matchedProductsCount: matchedProducts.length,
          isKitScenario,
          imageSize,
        }, null, 2));

        // Determine aspect ratio for Fal.AI
        const aspectRatio = contentType === "story" || contentType === "reel" ? "9:16" : "1:1";

        // Find product with image
        const productWithImage = matchedProducts.find(p => p.image_url);
        
        let result: { imageDataUrl: string | null; model: string; error?: string; usedReference: boolean };
        let productReferenceBase64: string | null = null;
        let finalPrompt = generation.prompt_final;

        // DECISÃO CRÍTICA: Se temos produto com imagem, DEVEMOS usar edição (image-to-image)
        if (needsProductImage && productWithImage?.image_url) {
          console.log(`📦 Product detected: "${productWithImage.name}" - Downloading image...`);
          const productReferenceDataUrl = await downloadImageAsDataUrl(productWithImage.image_url);
          
          if (!productReferenceDataUrl) {
            throw new Error(`FALHA CRÍTICA: Não foi possível baixar a imagem do produto "${productWithImage.name}". Verifique se o produto tem imagem cadastrada corretamente.`);
          }
          
          productReferenceBase64 = extractBase64FromDataUrl(productReferenceDataUrl);
          if (!productReferenceBase64) {
            throw new Error(`FALHA CRÍTICA: Não foi possível processar a imagem do produto "${productWithImage.name}".`);
          }
          
          console.log("✅ Product image downloaded successfully");
          
          // Build edit prompt specifically for product placement
          const kitInstruction = isKitScenario 
            ? `CENÁRIO DE KIT (${matchedProducts.length} produtos):
- PROIBIDO: pessoa segurando múltiplos produtos na mão
- OBRIGATÓRIO: apresentar em bancada elegante, flatlay, prateleira ou ambiente lifestyle
- Os produtos devem estar APOIADOS em superfície, nunca flutuando ou em mãos`
            : `CENÁRIO DE PRODUTO ÚNICO:
- Pode mostrar modelo segurando o produto de forma natural
- Máximo 1 produto por mão (total máximo 2 se usar ambas as mãos)
- Pose natural e elegante`;

          finalPrompt = `INSTRUÇÃO CRÍTICA - IMAGEM DE REFERÊNCIA:
A imagem anexada mostra o produto REAL "${productWithImage.name}".

SEU TRABALHO:
1. Criar uma CENA/CONTEXTO profissional com este produto EXATO
2. O produto na imagem final DEVE ser IDÊNTICO ao da referência (mesma embalagem, rótulo, cores, design)
3. NÃO recrie, redesenhe ou invente um novo produto - USE O QUE ESTÁ NA REFERÊNCIA

${kitInstruction}

ESTILO VISUAL:
- Fotografia profissional de alta qualidade, estilo editorial/UGC
- Iluminação suave e premium (estúdio ou luz natural)
- Fundo contextualizado (banheiro, quarto, lifestyle) ou limpo

PROIBIÇÕES ABSOLUTAS:
- NÃO inventar rótulos, logos ou textos na embalagem
- NÃO alterar cores ou design do produto
- NÃO duplicar o produto (gerar múltiplas cópias)
- NÃO adicionar texto sobreposto na imagem
- NÃO criar produtos genéricos ou "parecidos"
- NÃO mostrar caixas se o produto não tem caixa

CONTEXTO DO BRIEFING:
${generation.prompt_final}

FORMATO: ${contentType === "story" || contentType === "reel" ? "Vertical 9:16" : "Quadrado 1:1"}`;

          // Usar Fal.AI com imagem de referência (image-to-image)
          result = await editWithFalAI(falApiKey, finalPrompt, productReferenceBase64);
          
        } else {
          // Sem produto específico - geração genérica (text-to-image)
          console.log("ℹ️ No specific product - using text-to-image generation");
          result = await generateWithFalAI(falApiKey, finalPrompt, aspectRatio);
        }

        // Verificar resultado
        if (!result.imageDataUrl) {
          throw new Error(result.error || "Falha ao gerar imagem - resposta vazia da IA");
        }

        console.log(`✅ Image generated successfully with model: ${result.model}, usedReference: ${result.usedReference}`);

        // Cost estimates (Fal.AI)
        const costPerImage = 0.02; // Estimate for gpt-image-1.5

        // Upload to storage
        const binaryData = dataUrlToUint8Array(result.imageDataUrl);
        
        if (!binaryData) {
          throw new Error("Failed to convert image to binary for storage");
        }
        
        const storagePath = `${generation.tenant_id}/${genId}/variant_1.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("media-assets")
          .upload(storagePath, binaryData, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error("❌ Upload error:", uploadError);
          throw new Error("Falha ao salvar imagem no storage");
        }

        // Create variant record
        const { error: variantError } = await supabase
          .from("media_asset_variants")
          .insert({
            generation_id: genId,
            variant_index: 1,
            storage_path: storagePath,
            mime_type: "image/png",
            file_size: binaryData.length,
            width: parseInt(imageSize.split("x")[0]) || 1024,
            height: parseInt(imageSize.split("x")[1]) || 1024,
          });

        if (variantError) {
          console.error("⚠️ Variant record error:", variantError);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("media-assets")
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;

        // Update calendar item with asset URL
        if (publicUrl && generation.calendar_item_id) {
          const { error: updateItemError } = await supabase
            .from("media_calendar_items")
            .update({ 
              asset_url: publicUrl,
              asset_thumbnail_url: publicUrl 
            })
            .eq("id", generation.calendar_item_id);

          if (updateItemError) {
            console.error("⚠️ Error updating calendar item:", updateItemError);
          } else {
            console.log(`✅ Updated calendar item ${generation.calendar_item_id} with asset`);
          }
        }

        const elapsedMs = Date.now() - genStartTime;

        // Mark as succeeded with detailed logging
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
            provider: "fal-ai",
            model: result.model,
            settings: {
              ...settings,
              actual_variant_count: 1,
              cost_estimate: costPerImage,
              ai_provider_used: "fal-ai",
              processing_time_ms: elapsedMs,
              used_product_reference: result.usedReference,
              product_asset_url: productWithImage?.image_url || null,
              fallback_used: false,
            },
          })
          .eq("id", genId);

        processed++;
        results.push({
          id: genId,
          status: "succeeded",
          model: result.model,
          cost: costPerImage,
          timeMs: elapsedMs,
          usedProductReference: result.usedReference,
          productName: productWithImage?.name || null,
        });
        console.log(`✅ Generation ${genId} completed (model: ${result.model}, usedRef: ${result.usedReference}, time: ${elapsedMs}ms)`);

      } catch (genError) {
        console.error(`❌ Error processing generation ${genId}:`, genError);
        
        const errorMessage = genError instanceof Error ? genError.message : "Erro desconhecido";
        
        // Mark as failed with error details
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
            settings: {
              ...((generation.settings || {}) as GenerationSettings),
              fallback_used: false,
              failure_reason: errorMessage,
            },
          })
          .eq("id", genId);

        failed++;
        results.push({
          id: genId,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        failed,
        results,
        message: `Processadas ${processed} gerações com Fal.AI, ${failed} falhas` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in media-process-generation-queue:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
