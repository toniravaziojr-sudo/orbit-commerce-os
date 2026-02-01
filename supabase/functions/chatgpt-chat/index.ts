import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "2.0.0"; // Multi-mode support

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMode = "chat" | "thinking" | "search";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, hasAttachments, mode = "chat" } = await req.json();
    
    console.log(`[v${VERSION}] ChatGPT request - mode: ${mode}, messages: ${messages?.length}, hasAttachments: ${hasAttachments}`);

    // Route based on mode
    if (mode === "search") {
      return await handleSearchMode(messages);
    } else if (mode === "thinking") {
      return await handleThinkingMode(messages);
    } else {
      return await handleChatMode(messages, hasAttachments);
    }
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

// Standard chat mode using Lovable AI Gateway
async function handleChatMode(messages: any[], hasAttachments?: boolean) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  // Check if any message has image content
  const hasImageContent = messages?.some((m: any) => {
    if (Array.isArray(m.content)) {
      return m.content.some((c: any) => c.type === "image_url");
    }
    return false;
  });

  // Use gemini-2.5-pro for vision capabilities when images are present
  const model = hasImageContent ? "google/gemini-2.5-pro" : "openai/gpt-5";
  
  console.log("Chat mode - Using model:", model, "hasImageContent:", hasImageContent);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
- Analisar imagens quando enviadas
- Processar e entender áudios transcritos

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
- Responda sempre no idioma da pergunta do usuário
- Quando receber imagens, descreva e analise o conteúdo
- Quando receber referência a áudio, indique que está processando`,
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    return handleAIError(response);
  }

  // Return streaming response
  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

// Thinking mode using OpenAI o3-mini directly
async function handleThinkingMode(messages: any[]) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log("Thinking mode - Using OpenAI o3-mini for reasoning");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de IA especializado em raciocínio profundo e resolução de problemas complexos.

Suas capacidades especiais:
- Raciocínio em cadeia (chain-of-thought)
- Análise multi-etapas de problemas complexos
- Decomposição de problemas em partes menores
- Verificação lógica de conclusões
- Matemática avançada e lógica formal

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- SEMPRE use formatação Markdown nas suas respostas
- Use ## para títulos de seções
- Use **texto** para destacar pontos importantes
- Mostre seu raciocínio passo a passo
- Use listas numeradas para etapas de raciocínio
- Separe análise de conclusão claramente

Diretrizes:
- Pense cuidadosamente antes de responder
- Mostre seu processo de raciocínio
- Verifique sua lógica
- Admita incertezas quando existirem
- Responda no idioma da pergunta`,
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    
    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "OpenAI API error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

// Search mode using Firecrawl + AI synthesis
async function handleSearchMode(messages: any[]) {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured. Please enable the Firecrawl connector.");
  }
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  // Get the last user message as search query
  const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
  const query = typeof lastUserMessage?.content === "string" 
    ? lastUserMessage.content 
    : lastUserMessage?.content?.[0]?.text || "";

  console.log("Search mode - Query:", query);

  // Step 1: Search the web using Firecrawl
  const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error("Firecrawl search error:", searchResponse.status, errorText);
    throw new Error("Failed to search the web");
  }

  const searchResults = await searchResponse.json();
  console.log("Search results count:", searchResults.data?.length || 0);

  // Step 2: Build context from search results
  const searchContext = searchResults.data?.map((result: any, idx: number) => {
    return `## Fonte ${idx + 1}: ${result.title || "Sem título"}
URL: ${result.url}

${result.markdown || result.description || "Sem conteúdo disponível"}

---`;
  }).join("\n\n") || "Nenhum resultado encontrado.";

  // Step 3: Use AI to synthesize the response
  const synthesisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de pesquisa que analisa resultados de busca na internet e sintetiza respostas precisas e bem fundamentadas.

## REGRAS OBRIGATÓRIAS:
1. Use APENAS as informações fornecidas nos resultados de busca
2. Cite as fontes no texto usando [Fonte 1], [Fonte 2], etc.
3. Se os resultados não contiverem a informação, diga claramente
4. Use formatação Markdown rica para organizar a resposta
5. **SEMPRE inclua a seção "## 🔗 Fontes Consultadas" no final com os links clicáveis**
6. Seja objetivo e factual
7. Responda no idioma da pergunta

## FORMATO DA RESPOSTA (siga exatamente):

## 📋 Resumo

[Síntese principal da informação encontrada em 2-3 parágrafos]

---

## 📌 Detalhes

[Informações organizadas por tópico com subtítulos ### quando necessário]

- Use listas para facilitar a leitura
- Destaque pontos importantes com **negrito**
- Cite as fontes relevantes [Fonte 1], [Fonte 2], etc.

---

## 🔗 Fontes Consultadas

1. [Título da Fonte 1](URL_COMPLETA_1)
2. [Título da Fonte 2](URL_COMPLETA_2)
3. [Título da Fonte 3](URL_COMPLETA_3)

**IMPORTANTE**: A seção de fontes é OBRIGATÓRIA e deve conter links clicáveis no formato Markdown.`,
        },
        {
          role: "user",
          content: `**Pergunta do usuário:** "${query}"

---

## RESULTADOS DA BUSCA NA WEB:

${searchContext}

---

**Instruções:** Com base nos resultados acima, responda à pergunta do usuário de forma completa e precisa. Lembre-se de incluir a seção de fontes com links clicáveis no final.`,
        },
      ],
      stream: true,
    }),
  });

  if (!synthesisResponse.ok) {
    return handleAIError(synthesisResponse);
  }

  return new Response(synthesisResponse.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

// Helper to handle AI errors
async function handleAIError(response: Response) {
  console.error("AI gateway error:", response.status, await response.text());
  
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "Payment required, please add funds." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  return new Response(
    JSON.stringify({ error: "AI gateway error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
