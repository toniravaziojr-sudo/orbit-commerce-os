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

// Generate image using Lovable AI (Gemini model)
async function generateImageWithLovableAI(
  lovableApiKey: string,
  prompt: string,
  referenceImageDataUrl?: string
): Promise<string | null> {
  try {
    // Build message content
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    
    // If we have a reference image, include it
    if (referenceImageDataUrl) {
      content.push({
        type: "text",
        text: prompt,
      });
      content.push({
        type: "image_url",
        image_url: {
          url: referenceImageDataUrl,
        },
      });
    } else {
      content.push({
        type: "text",
        text: prompt,
      });
    }

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
            content: referenceImageDataUrl ? content : prompt,
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
    
    // Extract the generated image from the response
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
    // Extract base64 part from data URL
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
        const referenceSource = settings.reference_source;
        const packshotUrl = settings.packshot_url;

        // Check if we should use image-to-image with reference image
        let referenceDataUrl: string | null = null;
        if (packshotUrl) {
          console.log(`Downloading reference image (${referenceSource}) from: ${packshotUrl}`);
          referenceDataUrl = await downloadImageAsDataUrl(packshotUrl);
          if (referenceDataUrl) {
            console.log(`Reference image downloaded successfully (source: ${referenceSource}), using image-to-image mode`);
          } else {
            console.log("Failed to download reference image, falling back to text-to-image");
          }
        }

        // Generate variants
        const variantCount = Math.min(generation.variant_count || 1, 4);
        const variants: Array<{ index: number; dataUrl: string }> = [];

        // Enhanced prompt for reference image mode
        let finalPrompt = generation.prompt_final;
        if (referenceDataUrl) {
          finalPrompt = `${generation.prompt_final}

IMPORTANTE: A imagem de referência contém o produto REAL da loja do cliente. 
- PRESERVE exatamente o rótulo, cores, logo e design do produto
- NÃO altere texto, logos ou elementos da embalagem
- NÃO invente um produto diferente - USE o produto mostrado na referência
- Apenas crie um cenário/contexto ao redor do produto
- Mantenha o produto como elemento central e inalterado`;
        }

        // Add content type context to prompt
        if (contentType === "reel" || contentType === "story") {
          finalPrompt = `${finalPrompt}\n\nFormato: Imagem vertical (9:16) otimizada para Stories/Reels.`;
        } else if (contentType === "carrossel") {
          finalPrompt = `${finalPrompt}\n\nFormato: Imagem quadrada (1:1) otimizada para carrossel.`;
        }

        for (let i = 0; i < variantCount; i++) {
          try {
            console.log(`Generating variant ${i + 1} of ${variantCount}...`);
            
            const imageDataUrl = await generateImageWithLovableAI(
              lovableApiKey,
              finalPrompt,
              referenceDataUrl || undefined
            );

            if (imageDataUrl) {
              variants.push({ index: i + 1, dataUrl: imageDataUrl });
              console.log(`Variant ${i + 1} generated successfully`);
            } else {
              console.log(`Variant ${i + 1} failed to generate`);
            }
          } catch (variantError) {
            console.error(`Error generating variant ${i + 1}:`, variantError);
          }
        }

        if (variants.length === 0) {
          throw new Error("Nenhuma variante gerada com sucesso");
        }

        // Get pricing for cost tracking
        const { data: pricing } = await supabase
          .from("ai_model_pricing")
          .select("cost_per_image")
          .eq("provider", "google")
          .eq("model", "gemini-2.5-flash-image-preview")
          .is("effective_until", null)
          .single();

        const costPerImage = pricing?.cost_per_image || 0.01; // Gemini is typically cheaper
        const totalCost = variants.length * costPerImage;

        // Upload variants to storage
        for (const variant of variants) {
          try {
            // Convert data URL to binary
            const binaryData = dataUrlToUint8Array(variant.dataUrl);
            
            if (!binaryData) {
              console.error(`Failed to convert variant ${variant.index} to binary`);
              continue;
            }
            
            // Generate storage path
            const storagePath = `${generation.tenant_id}/${generation.id}/variant_${variant.index}.png`;
            
            // Upload to private bucket
            const { error: uploadError } = await supabase.storage
              .from("media-assets")
              .upload(storagePath, binaryData, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error(`Upload error for variant ${variant.index}:`, uploadError);
              continue;
            }

            // Create variant record
            const { error: variantError } = await supabase
              .from("media_asset_variants")
              .insert({
                generation_id: generation.id,
                variant_index: variant.index,
                storage_path: storagePath,
                mime_type: "image/png",
                file_size: binaryData.length,
                width: 1024,
                height: contentType === "reel" || contentType === "story" ? 1792 : 1024,
              });

            if (variantError) {
              console.error(`Variant record error for ${variant.index}:`, variantError);
            }
          } catch (uploadErr) {
            console.error(`Error uploading variant ${variant.index}:`, uploadErr);
          }
        }

        // Mark as succeeded with cost tracking
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
            settings: {
              ...settings,
              actual_variant_count: variants.length,
              cost_estimate: totalCost,
              used_reference: !!referenceDataUrl,
              reference_source: referenceSource,
            },
          })
          .eq("id", generation.id);

        processed++;
        console.log(`Generation ${generation.id} completed with ${variants.length} variants (cost: $${totalCost.toFixed(4)})`);

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
