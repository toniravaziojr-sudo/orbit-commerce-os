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
  matched_products?: Array<{ id: string; name: string; image_url: string | null }>;
  needs_product_image?: boolean;
}

// Download image and convert to base64 data URL
async function downloadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

// Generate image using OpenAI GPT-Image-1 (supports image input for product reference)
async function generateImageWithOpenAI(
  openaiApiKey: string,
  prompt: string,
  referenceImageDataUrl?: string
): Promise<string | null> {
  try {
    // If we have a reference image, use the images/edits endpoint with gpt-image-1
    if (referenceImageDataUrl) {
      console.log("Using GPT-Image-1 with product reference image");
      
      // Convert data URL to base64 (remove the data:image/xxx;base64, prefix)
      const base64Match = referenceImageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        console.error("Invalid data URL format");
        return null;
      }
      const base64Data = base64Match[1];
      
      // Use the OpenAI images API with gpt-image-1
      // This endpoint accepts image input and generates based on it
      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          image: base64Data,
          prompt: prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GPT-Image-1 API error:", response.status, errorText);
        
        // Try alternative approach using chat completions with image modality
        console.log("Trying chat completions approach...");
        return await generateWithChatCompletions(openaiApiKey, prompt, referenceImageDataUrl);
      }

      const data = await response.json();
      const imageB64 = data.data?.[0]?.b64_json;
      if (imageB64) {
        return `data:image/png;base64,${imageB64}`;
      }
      
      const imageUrl = data.data?.[0]?.url;
      if (imageUrl) {
        return await downloadImageAsDataUrl(imageUrl);
      }
      
      console.error("No image in GPT-Image-1 response");
      return null;
    }

    // Without reference image, use DALL-E 3 for best quality
    console.log("Using DALL-E 3 without reference image");
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
        size: "1024x1024",
        quality: "hd",
        style: "natural",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DALL-E 3 API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      return await downloadImageAsDataUrl(imageUrl);
    }

    return null;
  } catch (error) {
    console.error("Error in generateImageWithOpenAI:", error);
    return null;
  }
}

// Alternative: Use GPT-4o chat completions with image generation
async function generateWithChatCompletions(
  openaiApiKey: string,
  prompt: string,
  referenceImageDataUrl: string
): Promise<string | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: referenceImageDataUrl,
                },
              },
            ],
          },
        ],
        modalities: ["text", "image"],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GPT-4o chat completions error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    // Check for image in response
    const message = data.choices?.[0]?.message;
    if (message?.images?.[0]?.image_url?.url) {
      return message.images[0].image_url.url;
    }
    
    // Some responses may have the image in content array
    if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          return part.image_url.url;
        }
      }
    }

    console.error("No image in GPT-4o response:", JSON.stringify(data).substring(0, 500));
    return null;
  } catch (error) {
    console.error("Error in generateWithChatCompletions:", error);
    return null;
  }
}

// Generate image using Lovable AI (Gemini model) - for non-product images
async function generateImageWithLovableAI(
  lovableApiKey: string,
  prompt: string
): Promise<string | null> {
  try {
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
      console.error("Lovable AI image generation error:", errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in Lovable AI response:", JSON.stringify(data).substring(0, 500));
      return null;
    }

    return imageUrl;
  } catch (error) {
    console.error("Error calling Lovable AI:", error);
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
    // Fetch queued generations (limit 3 for concurrency control)
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

    for (const generation of generations) {
      try {
        // Mark as generating
        await supabase
          .from("media_asset_generations")
          .update({ status: "generating" })
          .eq("id", generation.id);

        console.log(`Processing generation ${generation.id}`);

        // Parse settings
        const settings = (generation.settings || {}) as GenerationSettings;
        const contentType = settings.content_type || "image";
        const needsProductImage = settings.needs_product_image ?? false;
        const matchedProducts = settings.matched_products || [];
        const packshotUrl = settings.packshot_url;

        // Determine which AI to use based on whether we need product images
        // OpenAI for product images (uses real product image as reference)
        // Lovable AI for non-product images (landscapes, concepts, etc.)
        const hasProductWithImage = matchedProducts.some(p => p.image_url);
        const useOpenAI = openaiApiKey && hasProductWithImage;
        
        console.log(`Using ${useOpenAI ? "OpenAI GPT-Image" : "Lovable AI"} for generation (hasProductWithImage: ${hasProductWithImage})`);

        // Build the final prompt
        let finalPrompt = generation.prompt_final;

        // Download product reference image if available
        let productReferenceDataUrl: string | null = null;
        
        if (useOpenAI && hasProductWithImage) {
          const productWithImage = matchedProducts.find(p => p.image_url);
          if (productWithImage?.image_url) {
            console.log(`Downloading product image for reference: ${productWithImage.name}`);
            productReferenceDataUrl = await downloadImageAsDataUrl(productWithImage.image_url);
            
            if (productReferenceDataUrl) {
              console.log("Product reference image downloaded successfully");
              // Enhanced prompt for OpenAI with product context
              finalPrompt = `INSTRUÇÃO CRÍTICA: A imagem anexada é a foto REAL do produto "${productWithImage.name}". 
Você DEVE usar exatamente este produto na imagem gerada, preservando:
- O rótulo/embalagem EXATAMENTE como mostrado
- As cores e design do produto EXATAMENTE como mostrado  
- A forma e proporções do produto EXATAMENTE como mostradas

${generation.prompt_final}

REGRAS ABSOLUTAS:
- O produto na imagem gerada deve ser IDÊNTICO ao produto da foto de referência
- NÃO invente, modifique ou redesenhe o rótulo/embalagem
- NÃO altere as cores do produto
- Mantenha o produto em destaque, bem iluminado
- Estilo: fotografia profissional de produto, qualidade editorial
- SEM texto adicional sobreposto na imagem`;
            }
          }
        }

        // Add content type context to prompt
        if (contentType === "carousel") {
          finalPrompt = `${finalPrompt}\n\nFormato: Imagem quadrada (1:1) otimizada para carrossel.`;
        }

        // Generate the image
        let imageDataUrl: string | null = null;
        
        if (useOpenAI && openaiApiKey && productReferenceDataUrl) {
          // Use OpenAI GPT-Image with the actual product image as reference
          imageDataUrl = await generateImageWithOpenAI(openaiApiKey, finalPrompt, productReferenceDataUrl);
        } else if (useOpenAI && openaiApiKey) {
          // OpenAI without reference (fallback)
          imageDataUrl = await generateImageWithOpenAI(openaiApiKey, finalPrompt);
        } else {
          imageDataUrl = await generateImageWithLovableAI(lovableApiKey!, finalPrompt);
        }

        if (!imageDataUrl) {
          throw new Error("Falha ao gerar imagem");
        }

        const usedOpenAI = useOpenAI;
        console.log(`Image generated successfully using ${usedOpenAI ? "OpenAI GPT-Image" : "Lovable AI"}${productReferenceDataUrl ? " with product reference" : ""}`);

        // Get pricing for cost tracking
        const provider = usedOpenAI ? "openai" : "google";
        const model = usedOpenAI ? "gpt-image-1" : "gemini-2.5-flash-image-preview";
        
        const { data: pricing } = await supabase
          .from("ai_model_pricing")
          .select("cost_per_image")
          .eq("provider", provider)
          .eq("model", model)
          .is("effective_until", null)
          .single();

        // OpenAI DALL-E 3 HD is about $0.08 per image, Gemini is ~$0.01
        const costPerImage = pricing?.cost_per_image || (useOpenAI ? 0.08 : 0.01);

        // Upload to storage
        const binaryData = dataUrlToUint8Array(imageDataUrl);
        
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
            width: 1024,
            height: 1024,
          });

        if (variantError) {
          console.error("Variant record error:", variantError);
        }

        // Get public URL for the uploaded image
        const { data: publicUrlData } = supabase.storage
          .from("media-assets")
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;

        // Update the calendar item with the generated asset URL
        if (publicUrl && generation.calendar_item_id) {
          const { error: updateItemError } = await supabase
            .from("media_calendar_items")
            .update({ 
              asset_url: publicUrl,
              asset_thumbnail_url: publicUrl 
            })
            .eq("id", generation.calendar_item_id);

          if (updateItemError) {
            console.error("Error updating calendar item with asset URL:", updateItemError);
          } else {
            console.log(`Updated calendar item ${generation.calendar_item_id} with asset URL`);
          }
        }

        // Mark as succeeded with cost tracking
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
            provider: provider,
            model: model,
            settings: {
              ...settings,
              actual_variant_count: 1,
              cost_estimate: costPerImage,
              ai_provider_used: useOpenAI ? "openai" : "lovable",
            },
          })
          .eq("id", generation.id);

        processed++;
        console.log(`Generation ${generation.id} completed (cost: $${costPerImage.toFixed(4)})`);

      } catch (genError) {
        console.error(`Error processing generation ${generation.id}:`, genError);
        
        // Mark as failed
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "failed",
            error_message: genError instanceof Error ? genError.message : "Erro desconhecido",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        failed,
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
