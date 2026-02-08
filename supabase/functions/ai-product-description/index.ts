import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Geração de descrições de produto via IA
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log(`[ai-product-description][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[ai-product-description] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "API de IA não configurada" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { type, productName, fullDescription, userPrompt } = body;

    console.log(`[ai-product-description][${VERSION}] type=${type}, product=${productName}`);

    if (!type || !productName) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt: string;
    let userContent: string;

    if (type === "short_description") {
      // Gerar descrição curta a partir da completa
      if (!fullDescription) {
        return new Response(
          JSON.stringify({ success: false, error: "A descrição completa é necessária para gerar a descrição curta" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      systemPrompt = `Você é um copywriter profissional especializado em e-commerce brasileiro.
Sua tarefa é criar uma DESCRIÇÃO CURTA para um produto a partir da descrição completa fornecida.

REGRAS:
- Máximo 2-3 frases (até 300 caracteres idealmente)
- Deve capturar a essência e principal benefício do produto
- Linguagem persuasiva e direta
- Foco no público-alvo e resultado que o produto entrega
- NÃO use markdown, apenas texto simples
- NÃO repita o nome do produto no início
- Escreva em português brasileiro`;

      userContent = `Produto: ${productName}\n\nDescrição completa:\n${fullDescription}`;

    } else if (type === "full_description") {
      // Gerar ou melhorar descrição completa
      systemPrompt = `Você é um copywriter profissional especializado em e-commerce brasileiro, com vasta experiência em criar descrições de produtos que convertem.

Sua tarefa é criar uma DESCRIÇÃO COMPLETA e PROFISSIONAL para um produto de e-commerce.

ESTRUTURA OBRIGATÓRIA (use HTML formatado):
1. <h2>NOME DO PRODUTO</h2> — Título principal
2. <p><em>Subtítulo/Tagline</em></p> — Uma frase de impacto
3. <p>Parágrafo introdutório</p> — Apresentação geral breve e informativa do produto
4. <hr> (separador)
5. <h3>DESCRIÇÃO:</h3> — 2-3 parágrafos descrevendo o produto, como funciona, para quem é
6. <hr>
7. <h3>AÇÃO / FUNCIONALIDADES:</h3> — Lista numerada (<ol>) com as principais funcionalidades/ações do produto com destaque em negrito nos títulos
8. <hr>
9. <h3>BENEFÍCIOS PRINCIPAIS:</h3> — Lista com bullets (<ul>) dos benefícios mais importantes
10. <hr>
11. <h3>BENEFÍCIOS ADICIONAIS:</h3> — Lista com bullets (<ul>) de benefícios secundários
12. <hr>
13. <h3>ESPECIFICAÇÕES:</h3> — Detalhes técnicos se aplicável (tamanho, peso, composição, etc.)

REGRAS DE ESTILO:
- Use HTML semântico (h2, h3, p, ul, ol, li, strong, em, hr)
- Negrito (<strong>) para termos-chave e nomes de funcionalidades
- Itálico (<em>) para destaques sutis
- Separadores (<hr>) entre seções
- Linguagem persuasiva mas informativa
- Tom profissional e confiável
- Adapte a estrutura ao tipo de produto (nem todos precisam de todas as seções)
- Se o produto tiver composição/ingredientes, inclua
- Se tiver modo de uso, inclua como seção extra
- Escreva em português brasileiro
- NÃO use markdown, use HTML`;

      if (fullDescription) {
        // Melhorar descrição existente
        userContent = `Produto: ${productName}\n\nDescrição atual (reorganize e melhore):\n${fullDescription}`;
      } else if (userPrompt) {
        // Gerar do zero com informações do usuário
        userContent = `Produto: ${productName}\n\nInformações fornecidas pelo lojista:\n${userPrompt}`;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Forneça informações sobre o produto ou preencha a descrição existente" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Tipo de geração inválido" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-product-description][${VERSION}] Calling AI gateway...`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error(`[ai-product-description] AI gateway error: ${status} - ${errorText}`);

      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos de IA insuficientes. Adicione créditos na sua conta." }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar descrição. Tente novamente." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      console.error("[ai-product-description] No content in AI response");
      return new Response(
        JSON.stringify({ success: false, error: "IA não retornou conteúdo" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-product-description][${VERSION}] Generated ${generatedText.length} chars`);

    return new Response(
      JSON.stringify({ success: true, description: generatedText }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[ai-product-description] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao gerar descrição" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
