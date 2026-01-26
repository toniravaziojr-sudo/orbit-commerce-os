import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingRequest {
  text: string | string[];
  tenant_id?: string;
}

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ai-generate-embedding] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, tenant_id }: EmbeddingRequest = await req.json();

    if (!text || (Array.isArray(text) && text.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Text is required", code: "MISSING_TEXT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalizar para array
    const texts = Array.isArray(text) ? text : [text];
    
    // Limpar textos (remover espaços extras, limitar tamanho)
    const cleanedTexts = texts.map(t => 
      t.trim().slice(0, 8000) // OpenAI aceita até ~8K tokens por texto
    ).filter(t => t.length > 0);

    if (cleanedTexts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid text provided", code: "EMPTY_TEXT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-generate-embedding] Generating embeddings for ${cleanedTexts.length} text(s), tenant: ${tenant_id || 'unknown'}`);

    // Chamar OpenAI Embeddings API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: cleanedTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai-generate-embedding] OpenAI API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded", code: "RATE_LIMIT" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Error generating embedding", code: "EMBEDDING_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.error("[ai-generate-embedding] No embeddings returned from OpenAI");
      return new Response(
        JSON.stringify({ success: false, error: "No embeddings returned", code: "EMPTY_RESPONSE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTokens = data.usage?.total_tokens || 0;

    // Registrar uso de tokens para billing (se tenant_id fornecido)
    if (tenant_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Custo de embedding: ~$0.02/1M tokens = 0.00002/token = 0.002 cents/1K tokens
        const costCents = Math.ceil((totalTokens / 1000) * 0.002);
        
        if (costCents > 0) {
          await supabase.rpc("record_ai_usage", {
            p_tenant_id: tenant_id,
            p_usage_cents: costCents,
          });
        }
      } catch (usageError) {
        console.error("[ai-generate-embedding] Failed to record usage:", usageError);
      }
    }

    // Retornar embeddings
    const embeddings: EmbeddingResult[] = data.data.map((item: { embedding: number[]; index: number }) => ({
      embedding: item.embedding,
      tokens: Math.ceil(totalTokens / data.data.length), // Aproximado por item
    }));

    // Se foi um único texto, retornar embedding diretamente
    if (!Array.isArray(text)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          embedding: embeddings[0].embedding,
          tokens: totalTokens,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se foi array, retornar array de embeddings
    return new Response(
      JSON.stringify({ 
        success: true, 
        embeddings: embeddings.map(e => e.embedding),
        tokens: totalTokens,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-generate-embedding] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
