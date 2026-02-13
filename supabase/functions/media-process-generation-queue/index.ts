/**
 * Media Process Generation Queue — v4.0 (Lovable AI Gateway)
 * 
 * Migrado de Fal.AI para Lovable AI Gateway (Gemini + OpenAI)
 * Mesma abordagem do creative-image-generate (dual provider)
 * 
 * Suporta:
 * - Gemini (google/gemini-2.5-flash-image) — padrão, rápido
 * - OpenAI images API — quando disponível
 * - Geração com referência de produto (image editing)
 * - Geração sem produto (text-to-image)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '4.0.0';

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
  asset_type?: "image" | "video";
  duration?: number;
  aspect_ratio?: string;
  source_image_url?: string;
  product_name?: string;
}

// Download image and convert to base64 data URL
async function downloadImageAsBase64Url(url: string): Promise<string | null> {
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

/**
 * Generate image with Gemini via Lovable AI Gateway
 * Supports both text-to-image and image editing (with reference)
 */
async function generateWithGemini(
  apiKey: string,
  prompt: string,
  referenceImageUrl?: string | null
): Promise<{ imageDataUrl: string | null; model: string; error?: string; usedReference: boolean }> {
  const model = "google/gemini-2.5-flash-image";
  
  try {
    console.log(`🎨 === Gemini Image Generation (ref: ${!!referenceImageUrl}) ===`);
    
    const messages: any[] = [];
    
    if (referenceImageUrl) {
      // Image editing mode: send reference image + prompt
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: referenceImageUrl } }
        ]
      });
    } else {
      // Text-to-image mode
      messages.push({
        role: "user",
        content: prompt
      });
    }
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return { imageDataUrl: null, model, error: "Rate limit atingido. Tente novamente em alguns segundos.", usedReference: !!referenceImageUrl };
      }
      if (response.status === 402) {
        return { imageDataUrl: null, model, error: "Créditos insuficientes. Adicione créditos ao workspace.", usedReference: !!referenceImageUrl };
      }
      
      return { imageDataUrl: null, model, error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`, usedReference: !!referenceImageUrl };
    }

    const data = await response.json();
    
    // Extract image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("❌ No image in Gemini response");
      return { imageDataUrl: null, model, error: "IA não retornou imagem. Tente com um prompt diferente.", usedReference: !!referenceImageUrl };
    }

    console.log("✅ Gemini image generated successfully");
    return { imageDataUrl: imageUrl, model, usedReference: !!referenceImageUrl };
    
  } catch (error) {
    console.error("❌ Error calling Gemini:", error);
    return { imageDataUrl: null, model, error: String(error), usedReference: !!referenceImageUrl };
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
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
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

    console.log(`[media-process-generation-queue v${VERSION}] Processing ${generations.length} queued generations`);

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

        const settings = (generation.settings || {}) as GenerationSettings;
        const assetType = settings.asset_type || "image";
        const contentType = settings.content_type || "image";
        const needsProductImage = settings.needs_product_image ?? false;
        const matchedProducts = settings.matched_products || [];
        const isKitScenario = settings.is_kit_scenario ?? false;
        const imageSize = settings.image_size || "1024x1024";

        console.log("📋 Settings:", JSON.stringify({
          assetType, contentType, needsProductImage,
          matchedProductsCount: matchedProducts.length,
          isKitScenario, imageSize,
        }));

        // Skip video generation for now (needs separate provider)
        if (assetType === "video") {
          throw new Error("Geração de vídeo não está disponível no momento. Use o Gestor de Criativos para vídeos.");
        }

        // ============ IMAGE GENERATION via Lovable AI ============
        const productWithImage = matchedProducts.find(p => p.image_url);
        let referenceImageUrl: string | null = null;
        let finalPrompt = generation.prompt_final;

        // If product has image, download it for reference
        if (needsProductImage && productWithImage?.image_url) {
          console.log(`📦 Product: "${productWithImage.name}" - downloading reference...`);
          referenceImageUrl = await downloadImageAsBase64Url(productWithImage.image_url);
          
          if (!referenceImageUrl) {
            throw new Error(`Não foi possível baixar a imagem do produto "${productWithImage.name}".`);
          }
          
          console.log("✅ Product reference downloaded");

          // Build product-specific prompt
          const kitInstruction = isKitScenario 
            ? `CENÁRIO DE KIT (${matchedProducts.length} produtos):
- PROIBIDO: pessoa segurando múltiplos produtos na mão
- OBRIGATÓRIO: apresentar em bancada, flatlay ou ambiente lifestyle
- Produtos APOIADOS em superfície, organizados elegantemente`
            : `CENÁRIO DE PRODUTO ÚNICO:
- Pode mostrar modelo segurando de forma natural
- Máximo 1 produto por mão, pose elegante`;

          finalPrompt = `A imagem anexada mostra o produto REAL "${productWithImage.name}".
Crie uma CENA/CONTEXTO profissional com este produto EXATO.
O produto DEVE ser IDÊNTICO à referência (mesma embalagem, rótulo, cores).

${kitInstruction}

ESTILO: Fotografia profissional editorial/UGC, iluminação premium.
FORMATO: ${contentType === "story" || contentType === "reel" ? "Vertical 9:16" : "Quadrado 1:1"}

PROIBIÇÕES: NÃO inventar rótulos/logos, NÃO alterar cores/design, NÃO duplicar produto, NÃO adicionar texto sobreposto.

BRIEFING: ${generation.prompt_final}`;
        }

        // Generate with Gemini
        const result = await generateWithGemini(lovableApiKey, finalPrompt, referenceImageUrl);

        if (!result.imageDataUrl) {
          throw new Error(result.error || "Falha ao gerar imagem");
        }

        console.log(`✅ Image generated (model: ${result.model}, ref: ${result.usedReference})`);

        // Upload to storage
        const binaryData = dataUrlToUint8Array(result.imageDataUrl);
        
        if (!binaryData) {
          throw new Error("Falha ao processar imagem gerada");
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
        await supabase
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

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("media-assets")
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;

        // Update calendar item with asset URL
        if (publicUrl && generation.calendar_item_id) {
          await supabase
            .from("media_calendar_items")
            .update({ asset_url: publicUrl, asset_thumbnail_url: publicUrl })
            .eq("id", generation.calendar_item_id);
          
          console.log(`✅ Calendar item ${generation.calendar_item_id} updated`);
        }

        const elapsedMs = Date.now() - genStartTime;

        // Mark as succeeded
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
            provider: "lovable-ai",
            model: result.model,
            settings: {
              ...settings,
              actual_variant_count: 1,
              ai_provider_used: "lovable-ai",
              processing_time_ms: elapsedMs,
              used_product_reference: result.usedReference,
              product_asset_url: productWithImage?.image_url || null,
            },
          })
          .eq("id", genId);

        processed++;
        results.push({
          id: genId, status: "succeeded", type: "image",
          model: result.model, timeMs: elapsedMs,
          usedProductReference: result.usedReference,
          productName: productWithImage?.name || null,
        });
        console.log(`✅ Generation ${genId} done (${elapsedMs}ms)`);

      } catch (genError) {
        console.error(`❌ Error processing ${genId}:`, genError);
        
        const errorMessage = genError instanceof Error ? genError.message : "Erro desconhecido";
        
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", genId);

        failed++;
        results.push({ id: genId, status: "failed", error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, failed, results,
        message: `${processed} gerações processadas, ${failed} falhas` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[media-process-generation-queue v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
