import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { getCredential } from "../_shared/platform-credentials.ts";
import { withCreditMotor, isMotorEnabledForTenant } from "../_shared/credits/with-motor.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = await getCredential(supabaseUrl, supabaseServiceKey, "OPENAI_API_KEY");
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

    // ─── Motor Universal de Créditos ─────────────
    const SERVICE_KEY = "openai.text-embedding-3-small.per_1m_tokens";
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const useMotor = !!tenant_id && (await isMotorEnabledForTenant(supabaseService, tenant_id, SERVICE_KEY));

    // Estimativa: ~1 token por 4 chars (heurística OpenAI)
    const estimatedTokens = cleanedTexts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);

    const callProvider = async () => {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: cleanedTexts, dimensions: EMBEDDING_DIMENSIONS }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI embeddings ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      if (!data.data || data.data.length === 0) throw new Error("No embeddings returned");
      return data;
    };

    let providerData: any;
    let creditsCharged = 0;

    if (useMotor) {
      const motorResult = await withCreditMotor(
        {
          tenantId: tenant_id!,
          serviceKey: SERVICE_KEY,
          units: { tokens: estimatedTokens },
          jobId: crypto.randomUUID(),
          feature: "ai-generate-embedding",
          metadata: { batch_size: cleanedTexts.length },
        },
        async () => {
          const data = await callProvider();
          const actualTokens = data.usage?.total_tokens || estimatedTokens;
          return {
            providerResult: data,
            actualUnits: { tokens: actualTokens },
          };
        },
      );

      if (!motorResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: motorResult.userMessage,
            code: motorResult.errorCode === "insufficient_balance" ? "INSUFFICIENT_CREDITS" : "MOTOR_ERROR",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      providerData = motorResult.providerResult;
      creditsCharged = motorResult.creditsCharged;
    } else {
      try {
        providerData = await callProvider();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("429")) {
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
    }

    const data = providerData;
    const totalTokens = data.usage?.total_tokens || 0;


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
    return errorResponse(error, corsHeaders, { module: 'ai', action: 'generate-embedding' });
  }
});
