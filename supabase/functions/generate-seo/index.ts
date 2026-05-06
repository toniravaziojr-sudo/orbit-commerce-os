// =============================================
// EDGE FUNCTION: Generate SEO with AI
// Generates optimized SEO title and description based on content
// Integrado com Motor Universal de Créditos v2.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { withCreditMotor, isMotorEnabledForTenant } from "../_shared/credits/with-motor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeoInput {
  type: 'product' | 'category' | 'blog' | 'page';
  name: string;
  description?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  imageUrl?: string;
  price?: number;
  storeName?: string;
  tenant_id?: string;
}

const MODEL = "google/gemini-2.5-flash";
const SERVICE_KEY = "gemini.gemini-2.5-flash.per_1m_tokens_in";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    resetAIRouterCache();
    const input: SeoInput = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Build context for AI
    const contextParts: string[] = [];
    contextParts.push(`Tipo: ${input.type}`);
    contextParts.push(`Nome/Título: ${input.name}`);
    if (input.description) contextParts.push(`Descrição: ${input.description}`);
    if (input.content) {
      const cleanContent = input.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      if (cleanContent) contextParts.push(`Conteúdo: ${cleanContent}`);
    }
    if (input.excerpt) contextParts.push(`Resumo: ${input.excerpt}`);
    if (input.tags && input.tags.length > 0) contextParts.push(`Tags: ${input.tags.join(', ')}`);
    if (input.price) contextParts.push(`Preço: R$ ${Number(input.price).toFixed(2)}`);
    if (input.storeName) contextParts.push(`Loja: ${input.storeName}`);
    const contextText = contextParts.join('\n');

    const systemPrompt = `Você é um especialista em SEO para e-commerce brasileiro. Sua tarefa é gerar um título SEO e uma meta descrição otimizados para mecanismos de busca.

REGRAS IMPORTANTES:
1. Título SEO: máximo 60 caracteres, inclua palavras-chave relevantes no início
2. Meta Descrição: máximo 160 caracteres, seja persuasivo e inclua call-to-action quando apropriado
3. Use português brasileiro natural
4. Para produtos: destaque benefícios e diferenciais
5. Para categorias: seja descritivo sobre o que o cliente encontrará
6. Para blog: desperte curiosidade e prometa valor
7. Para páginas institucionais: seja claro e profissional
8. NUNCA ultrapasse os limites de caracteres

RESPONDA APENAS com JSON válido no formato:
{
  "seo_title": "título aqui",
  "seo_description": "descrição aqui"
}`;

    const userPrompt = `Gere título SEO e meta descrição otimizados para o seguinte conteúdo:\n\n${contextText}\n\nLembre-se: título máximo 60 caracteres, descrição máximo 160 caracteres.`;

    // Estimativa: contexto + prompt (~ tokens_in) + ~200 tokens_out
    const estTokensIn = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const estTokensOut = 200;

    const callProvider = async () => {
      const response = await aiChatCompletion(MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }, { supabaseUrl, supabaseServiceKey, logPrefix: "[generate-seo]" });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI ${response.status}: ${errText}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const usage = data.usage || {};
      return { data, content, usage };
    };

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const tenantId = input.tenant_id;
    const useMotor = !!tenantId && (await isMotorEnabledForTenant(supabaseService, tenantId, SERVICE_KEY));

    let aiContent = "";

    if (useMotor) {
      const motorResult = await withCreditMotor(
        {
          tenantId: tenantId!,
          serviceKey: SERVICE_KEY,
          units: { tokens_in: estTokensIn, tokens_out: estTokensOut },
          jobId: crypto.randomUUID(),
          feature: "generate-seo",
          metadata: { content_type: input.type, name: input.name?.slice(0, 80) },
        },
        async () => {
          const r = await callProvider();
          const tIn = r.usage?.prompt_tokens ?? r.usage?.input_tokens ?? estTokensIn;
          const tOut = r.usage?.completion_tokens ?? r.usage?.output_tokens ?? estTokensOut;
          return {
            providerResult: r.content,
            actualUnits: { tokens_in: tIn, tokens_out: tOut },
          };
        },
      );
      if (!motorResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: motorResult.userMessage, code: motorResult.errorCode }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      aiContent = motorResult.providerResult;
    } else {
      const r = await callProvider();
      aiContent = r.content;
    }

    // Parse JSON
    let seoResult: { seo_title: string; seo_description: string };
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      seoResult = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : JSON.parse(aiContent.trim());
    } catch {
      const titleMatch = aiContent.match(/"seo_title"\s*:\s*"([^"]+)"/);
      const descMatch = aiContent.match(/"seo_description"\s*:\s*"([^"]+)"/);
      if (titleMatch && descMatch) {
        seoResult = { seo_title: titleMatch[1], seo_description: descMatch[1] };
      } else {
        throw new Error("Failed to parse SEO from AI response");
      }
    }

    seoResult.seo_title = (seoResult.seo_title || "").substring(0, 60);
    seoResult.seo_description = (seoResult.seo_description || "").substring(0, 160);

    return new Response(JSON.stringify(seoResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-seo] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
