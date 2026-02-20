import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

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
    resetAIRouterCache();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { type, productName, fullDescription, userPrompt, referenceLinks } = body;

    console.log(`[ai-product-description][${VERSION}] type=${type}, product=${productName}`);

    if (!type || !productName) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build reference links context
    let referencesContext = "";
    if (referenceLinks && referenceLinks.length > 0) {
      referencesContext = `\n\nLINKS DE REFERÊNCIA (use como inspiração de estrutura e conteúdo):\n${referenceLinks.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")}`;
    }

    let systemPrompt: string;
    let userContent: string;

    if (type === "short_description") {
      if (!fullDescription) {
        return new Response(
          JSON.stringify({ success: false, error: "A descrição completa é necessária para gerar a descrição curta" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      systemPrompt = `Você é um copywriter profissional especializado em e-commerce brasileiro.
Crie uma DESCRIÇÃO CURTA para o produto a partir da descrição completa fornecida.

REGRAS ABSOLUTAS:
- Máximo 2-3 frases (até 300 caracteres)
- Capture a essência e principal benefício do produto
- Linguagem persuasiva e direta
- NÃO use markdown, apenas texto simples
- NÃO repita o nome do produto no início
- NÃO inclua saudações, introduções ou explicações sobre o que você fez
- Retorne APENAS o texto da descrição curta, nada mais
- Escreva em português brasileiro`;

      userContent = `Produto: ${productName}\n\nDescrição completa:\n${fullDescription}`;

    } else if (type === "full_description") {
      systemPrompt = `Você é um copywriter profissional especializado em e-commerce brasileiro.

REGRAS ABSOLUTAS — SIGA RIGOROSAMENTE:
1. Retorne APENAS o HTML da descrição. NADA MAIS.
2. NÃO inclua saudações, introduções, explicações, comentários ou qualquer texto fora do HTML.
3. NÃO escreva frases como "Com certeza!", "Aqui está", "Preparei para você" etc.
4. A primeira linha da sua resposta DEVE ser uma tag HTML (ex: <h2>).
5. A última linha DEVE ser uma tag HTML de fechamento.

ESTRUTURA HTML OBRIGATÓRIA:
<h2>NOME DO PRODUTO (versão/variação se aplicável)</h2>
<p><em>Frase de impacto / tagline persuasiva</em></p>
<p>Parágrafo introdutório apresentando o produto de forma envolvente.</p>
<hr>
<h3>DESCRIÇÃO</h3>
<p>2-3 parágrafos descrevendo o produto, como funciona, para quem é indicado.</p>
<hr>
<h3>AÇÃO / FUNCIONALIDADES</h3>
<ol>
<li><strong>Nome da funcionalidade:</strong> Explicação detalhada.</li>
</ol>
<hr>
<h3>BENEFÍCIOS PRINCIPAIS</h3>
<ul>
<li><strong>Benefício:</strong> Explicação.</li>
</ul>
<hr>
<h3>BENEFÍCIOS ADICIONAIS</h3>
<ul>
<li>Benefício secundário.</li>
</ul>
<hr>
<h3>ESPECIFICAÇÕES</h3>
<ul>
<li><strong>Item:</strong> Valor</li>
</ul>

REGRAS DE FORMATAÇÃO:
- Use APENAS HTML semântico (h2, h3, p, ul, ol, li, strong, em, hr)
- Separadores <hr> entre TODAS as seções
- Negrito (<strong>) para termos-chave
- Itálico (<em>) apenas para tagline
- NUNCA use markdown (**, ##, -, etc.)
- Adapte seções ao tipo de produto (nem todos precisam de todas)
- Se tiver composição/ingredientes ou modo de uso, adicione como seção extra
- Escreva em português brasileiro`;

      if (fullDescription) {
        userContent = `Produto: ${productName}\n\nReorganize e melhore esta descrição existente mantendo as informações:\n${fullDescription}${referencesContext}`;
      } else if (userPrompt) {
        userContent = `Produto: ${productName}\n\nInformações base fornecidas pelo lojista:\n${userPrompt}${referencesContext}`;
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

    console.log(`[ai-product-description][${VERSION}] Calling AI...`);

    const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: "[ai-product-description]",
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
    let generatedText = aiData.choices?.[0]?.message?.content;

    // Strip any conversational preamble the LLM may have added
    if (generatedText && type === "full_description") {
      // Remove everything before the first HTML tag
      const firstTagIndex = generatedText.indexOf('<');
      if (firstTagIndex > 0) {
        generatedText = generatedText.substring(firstTagIndex);
      }
      // Remove trailing markdown fences
      generatedText = generatedText.replace(/```$/g, '').trim();
    }

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
