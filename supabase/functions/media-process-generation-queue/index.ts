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
}

// Download image and convert to base64
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

// Generate image using text-to-image (standard)
async function generateTextToImage(
  openaiApiKey: string,
  prompt: string,
  size: string
): Promise<string | null> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI text-to-image error:", errorText);
    return null;
  }

  const data = await response.json();
  return data.data?.[0]?.b64_json || null;
}

// Generate image using image-to-image (with reference)
async function generateImageToImage(
  openaiApiKey: string,
  prompt: string,
  referenceImageBase64: string,
  size: string
): Promise<string | null> {
  // OpenAI's gpt-image-1 supports image editing via the images/edits endpoint
  // We need to send the image as a file in multipart/form-data
  
  // Convert base64 to Blob
  const binaryString = atob(referenceImageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const imageBlob = new Blob([bytes], { type: 'image/png' });

  const formData = new FormData();
  formData.append('model', 'gpt-image-1');
  formData.append('image', imageBlob, 'reference.png');
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', size);
  formData.append('response_format', 'b64_json');

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI image-to-image error:", errorText);
    // Fallback to text-to-image if edit fails
    console.log("Falling back to text-to-image...");
    return null;
  }

  const data = await response.json();
  return data.data?.[0]?.b64_json || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiApiKey) {
    console.error("OPENAI_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "OpenAI API key não configurada" }),
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
        const usePackshot = settings.use_packshot || false;
        const packshotUrl = settings.packshot_url;

        // Determine image size based on content type
        let size = "1024x1024";
        if (contentType === "reel" || contentType === "story") {
          size = "1024x1792"; // Vertical for reels/stories
        }

        // Check if we should use image-to-image with packshot
        let packshotBase64: string | null = null;
        if (usePackshot && packshotUrl) {
          console.log(`Downloading packshot from: ${packshotUrl}`);
          packshotBase64 = await downloadImageAsBase64(packshotUrl);
          if (packshotBase64) {
            console.log("Packshot downloaded successfully, using image-to-image mode");
          } else {
            console.log("Failed to download packshot, falling back to text-to-image");
          }
        }

        // Generate variants
        const variantCount = Math.min(generation.variant_count || 4, 4);
        const variants: Array<{ index: number; base64: string }> = [];

        // Enhanced prompt for packshot mode
        let finalPrompt = generation.prompt_final;
        if (packshotBase64) {
          finalPrompt = `${generation.prompt_final}

IMPORTANTE: A imagem de referência contém o produto real. 
- PRESERVE exatamente o rótulo, cores e design do produto
- NÃO altere texto, logos ou elementos da embalagem
- Apenas crie um cenário/contexto ao redor do produto
- Mantenha o produto como elemento central e inalterado`;
        }

        for (let i = 0; i < variantCount; i++) {
          try {
            let imageBase64: string | null = null;

            // Try image-to-image if packshot is available
            if (packshotBase64) {
              imageBase64 = await generateImageToImage(
                openaiApiKey,
                finalPrompt,
                packshotBase64,
                size
              );
            }

            // Fallback to text-to-image
            if (!imageBase64) {
              imageBase64 = await generateTextToImage(
                openaiApiKey,
                generation.prompt_final,
                size
              );
            }

            if (imageBase64) {
              variants.push({ index: i + 1, base64: imageBase64 });
            }
          } catch (variantError) {
            console.error(`Error generating variant ${i}:`, variantError);
          }
        }

        if (variants.length === 0) {
          throw new Error("Nenhuma variante gerada com sucesso");
        }

        // Get pricing for cost tracking
        const { data: pricing } = await supabase
          .from("ai_model_pricing")
          .select("cost_per_image")
          .eq("provider", "openai")
          .eq("model", "gpt-image-1")
          .is("effective_until", null)
          .single();

        const costPerImage = pricing?.cost_per_image || 0.04;
        const totalCost = variants.length * costPerImage;

        // Upload variants to storage
        for (const variant of variants) {
          try {
            // Decode base64 to binary
            const binaryData = Uint8Array.from(atob(variant.base64), c => c.charCodeAt(0));
            
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
                width: size === "1024x1792" ? 1024 : 1024,
                height: size === "1024x1792" ? 1792 : 1024,
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
              used_packshot: !!packshotBase64,
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
