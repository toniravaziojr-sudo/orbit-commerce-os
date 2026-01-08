import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

/**
 * GERAÇÃO COM LOVABLE AI (Gemini) - SEM IMAGEM DE REFERÊNCIA
 * Usado quando não há produto específico ou para cenas genéricas
 */
async function generateWithLovableAI(
  lovableApiKey: string,
  prompt: string
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  try {
    console.log("🎨 === Lovable AI (Gemini) Text-to-Image ===");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Lovable AI error:", errorText);
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: errorText, usedReference: false };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in Lovable AI response");
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: "No image in response", usedReference: false };
    }

    console.log("✅ Lovable AI generated image successfully");
    return { imageDataUrl: imageUrl, model: "gemini-2.5-flash-image-preview", usedReference: false };
  } catch (error) {
    console.error("❌ Error calling Lovable AI:", error);
    return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: String(error), usedReference: false };
  }
}

/**
 * EDIÇÃO COM LOVABLE AI (Gemini) - COM IMAGEM DE REFERÊNCIA DO PRODUTO
 * Usa a imagem REAL do produto e pede para criar uma cena/contexto
 * 
 * CRÍTICO: Esta é a forma correta de garantir fidelidade ao produto real
 */
async function editWithLovableAI(
  lovableApiKey: string,
  prompt: string,
  productImageDataUrl: string
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  try {
    console.log("🎨 === Lovable AI (Gemini) Image Edit - PRODUTO REAL ===");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { url: productImageDataUrl }
              }
            ]
          }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Lovable AI edit error:", errorText);
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: errorText, usedReference: true };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in Lovable AI edit response");
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: "No image in response", usedReference: true };
    }

    console.log("✅ Lovable AI edit with product reference - SUCCESS");
    return { imageDataUrl: imageUrl, model: "gemini-2.5-flash-image-preview", usedReference: true };
  } catch (error) {
    console.error("❌ Error calling Lovable AI edit:", error);
    return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: String(error), usedReference: true };
  }
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
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    console.error("❌ LOVABLE_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "Lovable API key não configurada" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`🚀 Processing ${generations.length} queued generations`);

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

        console.log(`\n========== 🎬 Processing generation ${genId} ==========`);

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

        // Find product with image
        const productWithImage = matchedProducts.find(p => p.image_url);
        
        let result: { imageDataUrl: string | null; model: string; error?: string; usedReference: boolean };
        let productReferenceDataUrl: string | null = null;
        let finalPrompt = generation.prompt_final;

        // DECISÃO CRÍTICA: Se temos produto com imagem, DEVEMOS usar edição
        if (needsProductImage && productWithImage?.image_url) {
          console.log(`📦 Product detected: "${productWithImage.name}" - Downloading image...`);
          productReferenceDataUrl = await downloadImageAsDataUrl(productWithImage.image_url);
          
          if (!productReferenceDataUrl) {
            // FALHA CRÍTICA: Não conseguiu baixar a imagem do produto
            // NÃO fazer fallback silencioso - falhar explicitamente
            throw new Error(`FALHA CRÍTICA: Não foi possível baixar a imagem do produto "${productWithImage.name}". Verifique se o produto tem imagem cadastrada corretamente.`);
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

          // Usar Lovable AI com imagem de referência
          result = await editWithLovableAI(lovableApiKey!, finalPrompt, productReferenceDataUrl);
          
        } else {
          // Sem produto específico - geração genérica
          console.log("ℹ️ No specific product - using text-to-image generation");
          result = await generateWithLovableAI(lovableApiKey!, finalPrompt);
        }

        // Verificar resultado
        if (!result.imageDataUrl) {
          // FALHA EXPLÍCITA - não gerar lixo
          throw new Error(result.error || "Falha ao gerar imagem - resposta vazia da IA");
        }

        console.log(`✅ Image generated successfully with model: ${result.model}, usedReference: ${result.usedReference}`);

        // Cost estimates (Lovable AI)
        const costPerImage = 0.01; // Gemini é mais barato

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
          // Non-fatal, continue
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
            provider: "google",
            model: result.model,
            settings: {
              ...settings,
              actual_variant_count: 1,
              cost_estimate: costPerImage,
              ai_provider_used: "lovable-ai",
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
        
        // Mark as failed with error details - SEM FALLBACK SILENCIOSO
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
            settings: {
              ...((generation.settings || {}) as GenerationSettings),
              fallback_used: false, // Explicitamente indicar que não usou fallback
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
        message: `Processadas ${processed} gerações, ${failed} falhas` 
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
