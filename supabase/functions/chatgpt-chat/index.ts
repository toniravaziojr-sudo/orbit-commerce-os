import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("ChatGPT chat request - messages count:", messages?.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de IA altamente capaz e prestativo, similar ao ChatGPT.

Suas capacidades incluem:
- Responder perguntas sobre qualquer assunto
- Ajudar com pesquisas e análises
- Gerar textos, resumos e conteúdo
- Auxiliar com cálculos e lógica
- Fornecer explicações claras e detalhadas
- Ajudar com programação e código
- Traduzir textos entre idiomas

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- SEMPRE use formatação Markdown nas suas respostas
- Use ## ou ### para títulos de seções
- Use **texto** para destacar informações importantes
- Use listas com - ou números (1., 2., 3.) para listar itens
- Separe seções com linhas em branco
- Use \`código\` para termos técnicos inline
- Use blocos de código com \`\`\` para exemplos de código
- Organize a resposta de forma hierárquica e visualmente clara
- NÃO envie respostas como blocos de texto contínuo sem formatação

Diretrizes:
- Seja conciso mas completo nas respostas
- Se não souber algo, diga honestamente
- Mantenha um tom profissional mas amigável
- Responda sempre no idioma da pergunta do usuário`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { 
            status: 402, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    console.error("ChatGPT chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
