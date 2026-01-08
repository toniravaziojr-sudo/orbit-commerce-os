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
    console.log("Downloading image from:", url.substring(0, 100));
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to download image:", response.status);
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
    console.log(`Image downloaded: ${uint8Array.length} bytes, type: ${contentType}`);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

// Generate image using OpenAI GPT-Image-1 with product reference
async function generateImageWithOpenAI(
  openaiApiKey: string,
  prompt: string,
  referenceImageDataUrl: string,
  size: string = "1024x1024"
): Promise<{ imageDataUrl: string | null; model: string; error?: string }> {
  try {
    console.log("=== OpenAI GPT-Image-1 Generation ===");
    console.log("Prompt length:", prompt.length);
    console.log("Size:", size);
    
    // Convert data URL to binary blob
    const base64Match = referenceImageDataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!base64Match) {
      console.error("Invalid data URL format");
      return { imageDataUrl: null, model: "gpt-image-1", error: "Invalid image format" };
    }
    
    const mimeType = base64Match[1];
    const base64Data = base64Match[2];
    
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: `image/${mimeType}` });
    console.log("Image blob size:", imageBlob.size);
    
    // Build multipart/form-data for image edit
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", imageBlob, `product.${mimeType === 'jpeg' ? 'jpg' : mimeType}`);
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", size);
    
    console.log("Calling OpenAI images/edits endpoint...");
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      // Try DALL-E 3 as fallback (without reference)
      console.log("Falling back to DALL-E 3...");
      return await generateWithDallE3(openaiApiKey, prompt, size);
    }

    const data = await response.json();
    const imageB64 = data.data?.[0]?.b64_json;
    if (imageB64) {
      console.log("GPT-Image-1 returned base64 image successfully");
      return { imageDataUrl: `data:image/png;base64,${imageB64}`, model: "gpt-image-1" };
    }
    
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log("GPT-Image-1 returned URL, downloading...");
      const downloaded = await downloadImageAsDataUrl(imageUrl);
      return { imageDataUrl: downloaded, model: "gpt-image-1" };
    }
    
    console.error("No image in GPT-Image-1 response");
    return await generateWithDallE3(openaiApiKey, prompt, size);
  } catch (error) {
    console.error("Error in generateImageWithOpenAI:", error);
    return { imageDataUrl: null, model: "gpt-image-1", error: String(error) };
  }
}

// Generate image using DALL-E 3 (no reference image support, higher quality)
async function generateWithDallE3(
  openaiApiKey: string,
  prompt: string,
  size: string = "1024x1024"
): Promise<{ imageDataUrl: string | null; model: string; error?: string }> {
  try {
    console.log("=== DALL-E 3 Generation ===");
    
    // DALL-E 3 only supports specific sizes
    const validSize = size === "1024x1792" ? "1024x1792" : "1024x1024";
    
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: validSize,
        quality: "hd",
        style: "natural",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DALL-E 3 API error:", response.status, errorText);
      return { imageDataUrl: null, model: "dall-e-3", error: errorText };
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log("DALL-E 3 returned URL, downloading...");
      const downloaded = await downloadImageAsDataUrl(imageUrl);
      return { imageDataUrl: downloaded, model: "dall-e-3" };
    }

    return { imageDataUrl: null, model: "dall-e-3", error: "No image in response" };
  } catch (error) {
    console.error("Error in generateWithDallE3:", error);
    return { imageDataUrl: null, model: "dall-e-3", error: String(error) };
  }
}

// Generate image using Lovable AI (Gemini) - for non-product images
async function generateImageWithLovableAI(
  lovableApiKey: string,
  prompt: string
): Promise<{ imageDataUrl: string | null; model: string; error?: string }> {
  try {
    console.log("=== Lovable AI (Gemini) Generation ===");
    
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
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", errorText);
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: errorText };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in Lovable AI response");
      return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: "No image in response" };
    }

    console.log("Lovable AI returned image successfully");
    return { imageDataUrl: imageUrl, model: "gemini-2.5-flash-image-preview" };
  } catch (error) {
    console.error("Error calling Lovable AI:", error);
    return { imageDataUrl: null, model: "gemini-2.5-flash-image-preview", error: String(error) };
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
    console.error("Error converting data URL to binary:", error);
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
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!lovableApiKey) {
    console.error("LOVABLE_API_KEY not configured");
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
      console.error("Error fetching queued generations:", fetchError);
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

    console.log(`Processing ${generations.length} queued generations`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const generation of generations) {
      const genStartTime = Date.now();
      try {
        // Mark as generating
        await supabase
          .from("media_asset_generations")
          .update({ status: "generating" })
          .eq("id", generation.id);

        console.log(`\n========== Processing generation ${generation.id} ==========`);

        // Parse settings
        const settings = (generation.settings || {}) as GenerationSettings;
        const contentType = settings.content_type || "image";
        const needsProductImage = settings.needs_product_image ?? false;
        const matchedProducts = settings.matched_products || [];
        const packshotUrl = settings.packshot_url;
        const isKitScenario = settings.is_kit_scenario ?? false;
        const imageSize = settings.image_size || "1024x1024";

        console.log("Settings:", {
          contentType,
          needsProductImage,
          matchedProductsCount: matchedProducts.length,
          isKitScenario,
          imageSize,
          hasPackshot: !!packshotUrl,
        });

        // Determine provider based on whether we have product images
        const productWithImage = matchedProducts.find(p => p.image_url);
        const hasOpenAI = !!openaiApiKey;
        const useOpenAI = hasOpenAI && needsProductImage && productWithImage;

        console.log(`Provider decision: useOpenAI=${useOpenAI}, hasOpenAI=${hasOpenAI}, needsProductImage=${needsProductImage}`);

        let finalPrompt = generation.prompt_final;

        // Download product reference image if using OpenAI
        let productReferenceDataUrl: string | null = null;
        
        if (useOpenAI && productWithImage?.image_url) {
          console.log(`Downloading product image: ${productWithImage.name}`);
          productReferenceDataUrl = await downloadImageAsDataUrl(productWithImage.image_url);
          
          if (productReferenceDataUrl) {
            console.log("Product reference downloaded successfully");
            
            // Enhanced prompt for OpenAI with product context
            const kitInstruction = isKitScenario 
              ? "CENÁRIO DE KIT: Apresentar produtos em bancada elegante ou flatlay. NÃO colocar múltiplos produtos nas mãos de modelo."
              : "Pode mostrar modelo segurando o produto de forma natural (máximo 1 produto por mão).";
            
            finalPrompt = `INSTRUÇÃO CRÍTICA: A imagem anexada é a foto REAL do produto "${productWithImage.name}".

VOCÊ DEVE:
1. Usar EXATAMENTE este produto na imagem gerada
2. Preservar o rótulo/embalagem EXATAMENTE como mostrado
3. Manter as cores e design EXATAMENTE como mostrado
4. Manter a forma e proporções EXATAMENTE como mostradas

${kitInstruction}

${generation.prompt_final}

REGRAS ABSOLUTAS:
- O produto gerado deve ser IDÊNTICO ao produto da foto de referência
- NÃO invente, modifique ou redesenhe o rótulo/embalagem
- NÃO altere as cores do produto
- NÃO adicione texto sobreposto na imagem
- Estilo: fotografia profissional de produto, qualidade editorial
- Iluminação suave e premium`;
          } else {
            console.warn("Failed to download product image, falling back to Lovable AI");
          }
        }

        // Generate the image
        let result: { imageDataUrl: string | null; model: string; error?: string };
        
        if (useOpenAI && openaiApiKey && productReferenceDataUrl) {
          result = await generateImageWithOpenAI(openaiApiKey, finalPrompt, productReferenceDataUrl, imageSize);
        } else if (hasOpenAI && !productReferenceDataUrl) {
          // Use DALL-E 3 without reference
          console.log("Using DALL-E 3 without reference");
          result = await generateWithDallE3(openaiApiKey!, finalPrompt, imageSize);
        } else {
          result = await generateImageWithLovableAI(lovableApiKey!, finalPrompt);
        }

        if (!result.imageDataUrl) {
          throw new Error(result.error || "Falha ao gerar imagem");
        }

        console.log(`Image generated successfully with model: ${result.model}`);

        // Get pricing for cost tracking
        const provider = result.model.startsWith("gpt") || result.model.startsWith("dall") ? "openai" : "google";
        
        const { data: pricing } = await supabase
          .from("ai_model_pricing")
          .select("cost_per_image")
          .eq("provider", provider)
          .eq("model", result.model)
          .is("effective_until", null)
          .single();

        // Cost estimates
        const costEstimates: Record<string, number> = {
          "gpt-image-1": 0.08,
          "dall-e-3": 0.08,
          "gemini-2.5-flash-image-preview": 0.01,
        };
        const costPerImage = pricing?.cost_per_image || costEstimates[result.model] || 0.05;

        // Upload to storage
        const binaryData = dataUrlToUint8Array(result.imageDataUrl);
        
        if (!binaryData) {
          throw new Error("Failed to convert image to binary");
        }
        
        const storagePath = `${generation.tenant_id}/${generation.id}/variant_1.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("media-assets")
          .upload(storagePath, binaryData, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("Falha ao salvar imagem");
        }

        // Create variant record
        const { error: variantError } = await supabase
          .from("media_asset_variants")
          .insert({
            generation_id: generation.id,
            variant_index: 1,
            storage_path: storagePath,
            mime_type: "image/png",
            file_size: binaryData.length,
            width: parseInt(imageSize.split("x")[0]) || 1024,
            height: parseInt(imageSize.split("x")[1]) || 1024,
          });

        if (variantError) {
          console.error("Variant record error:", variantError);
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
            console.error("Error updating calendar item:", updateItemError);
          } else {
            console.log(`Updated calendar item ${generation.calendar_item_id} with asset`);
          }
        }

        const elapsedMs = Date.now() - genStartTime;

        // Mark as succeeded
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
            provider: provider,
            model: result.model,
            settings: {
              ...settings,
              actual_variant_count: 1,
              cost_estimate: costPerImage,
              ai_provider_used: provider,
              processing_time_ms: elapsedMs,
              used_product_reference: !!productReferenceDataUrl,
            },
          })
          .eq("id", generation.id);

        processed++;
        results.push({
          id: generation.id,
          status: "succeeded",
          model: result.model,
          cost: costPerImage,
          timeMs: elapsedMs,
        });
        console.log(`Generation ${generation.id} completed (model: ${result.model}, cost: $${costPerImage.toFixed(4)}, time: ${elapsedMs}ms)`);

      } catch (genError) {
        console.error(`Error processing generation ${generation.id}:`, genError);
        
        // Mark as failed with error details
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "failed",
            error_message: genError instanceof Error ? genError.message : "Erro desconhecido",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        failed++;
        results.push({
          id: generation.id,
          status: "failed",
          error: genError instanceof Error ? genError.message : "Unknown error",
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
    console.error("Error in media-process-generation-queue:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
