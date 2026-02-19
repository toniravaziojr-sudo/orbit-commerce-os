// =============================================
// EDGE FUNCTION: Generate SEO with AI
// Generates optimized SEO title and description based on content
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeoInput {
  type: 'product' | 'category' | 'blog' | 'page';
  name: string;
  description?: string;
  content?: string; // For blog/pages - can be HTML or plain text
  excerpt?: string;
  tags?: string[];
  imageUrl?: string;
  price?: number;
  storeName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: SeoInput = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for AI
    let contextParts: string[] = [];
    
    contextParts.push(`Tipo: ${input.type}`);
    contextParts.push(`Nome/Título: ${input.name}`);
    
    if (input.description) {
      contextParts.push(`Descrição: ${input.description}`);
    }
    
    if (input.content) {
      // Strip HTML tags for cleaner content
      const cleanContent = input.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit content length
      if (cleanContent) {
        contextParts.push(`Conteúdo: ${cleanContent}`);
      }
    }
    
    if (input.excerpt) {
      contextParts.push(`Resumo: ${input.excerpt}`);
    }
    
    if (input.tags && input.tags.length > 0) {
      contextParts.push(`Tags: ${input.tags.join(', ')}`);
    }
    
    if (input.price) {
      contextParts.push(`Preço: R$ ${Number(input.price).toFixed(2)}`);
    }
    
    if (input.storeName) {
      contextParts.push(`Loja: ${input.storeName}`);
    }

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

    const userPrompt = `Gere título SEO e meta descrição otimizados para o seguinte conteúdo:

${contextText}

Lembre-se: título máximo 60 caracteres, descrição máximo 160 caracteres.`;

    console.log("[generate-seo] Calling AI with context:", contextText.substring(0, 500));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-seo] AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("[generate-seo] AI response:", content);

    // Parse JSON from response
    let seoResult: { seo_title: string; seo_description: string };
    
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        seoResult = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try direct JSON parse
        seoResult = JSON.parse(content.trim());
      }
    } catch (parseError) {
      console.error("[generate-seo] Failed to parse AI response:", parseError);
      
      // Fallback: try to extract title and description manually
      const titleMatch = content.match(/"seo_title"\s*:\s*"([^"]+)"/);
      const descMatch = content.match(/"seo_description"\s*:\s*"([^"]+)"/);
      
      if (titleMatch && descMatch) {
        seoResult = {
          seo_title: titleMatch[1],
          seo_description: descMatch[1],
        };
      } else {
        throw new Error("Failed to parse SEO from AI response");
      }
    }

    // Validate and truncate if needed
    seoResult.seo_title = (seoResult.seo_title || "").substring(0, 60);
    seoResult.seo_description = (seoResult.seo_description || "").substring(0, 160);

    console.log("[generate-seo] Final result:", seoResult);

    return new Response(JSON.stringify(seoResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-seo] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar SEO" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
