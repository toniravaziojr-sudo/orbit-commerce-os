import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        // Determine image size based on content type
        const settings = generation.settings as Record<string, unknown> || {};
        const contentType = settings.content_type as string || "image";
        
        let size = "1024x1024";
        if (contentType === "reel" || contentType === "story") {
          size = "1024x1792"; // Vertical for reels/stories
        }

        // Generate images using OpenAI
        const variantCount = Math.min(generation.variant_count || 4, 4); // Max 4 per request
        const variants: Array<{ index: number; base64: string }> = [];

        // OpenAI gpt-image-1 generates one image at a time, so we loop
        for (let i = 0; i < variantCount; i++) {
          try {
            const response = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-image-1",
                prompt: generation.prompt_final,
                n: 1,
                size: size,
                response_format: "b64_json",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`OpenAI error for variant ${i}:`, errorText);
              continue;
            }

            const data = await response.json();
            if (data.data && data.data[0] && data.data[0].b64_json) {
              variants.push({ index: i + 1, base64: data.data[0].b64_json });
            }
          } catch (variantError) {
            console.error(`Error generating variant ${i}:`, variantError);
          }
        }

        if (variants.length === 0) {
          throw new Error("Nenhuma variante gerada com sucesso");
        }

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

        // Mark as succeeded
        await supabase
          .from("media_asset_generations")
          .update({ 
            status: "succeeded",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        processed++;
        console.log(`Generation ${generation.id} completed with ${variants.length} variants`);

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
