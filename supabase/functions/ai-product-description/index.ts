import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.1.0"; // Fix: max_tokens para evitar truncamento + prompt melhorado
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ========== SYSTEM PROMPTS ==========

const SYSTEM_PROMPT_SHORT = `Você é um copywriter profissional especializado em e-commerce brasileiro.
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

const SYSTEM_PROMPT_FULL = `Você é um copywriter profissional especializado em e-commerce brasileiro.

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

const SYSTEM_PROMPT_FROM_LINK = `Você é um copywriter profissional especializado em e-commerce brasileiro.

Você receberá o conteúdo extraído de uma página de produto de outro site.
Sua tarefa: criar uma descrição HTML COMPLETA e DETALHADA para este produto usando TODAS as informações extraídas.

REGRAS ABSOLUTAS — SIGA RIGOROSAMENTE:
1. Retorne APENAS o HTML da descrição. NADA MAIS.
2. NÃO inclua saudações, introduções, explicações, comentários ou qualquer texto fora do HTML.
3. NÃO escreva frases como "Com certeza!", "Aqui está", "Preparei para você" etc.
4. A primeira linha da sua resposta DEVE ser uma tag HTML (ex: <h2>).
5. A última linha DEVE ser uma tag HTML de fechamento.
6. Reescreva o conteúdo com suas próprias palavras — NÃO copie textualmente.
7. Extraia TODAS as informações relevantes: ingredientes, modo de uso, especificações, benefícios, composição, registro ANVISA, etc.
8. NÃO OMITA nenhuma seção. Inclua TODAS as seções que fizerem sentido para o produto.
9. A descrição deve ser COMPLETA — não pare no meio. Gere TODO o conteúdo até o final.

ESTRUTURA HTML OBRIGATÓRIA (inclua TODAS as seções aplicáveis):
<h2>NOME DO PRODUTO</h2>
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
<h3>COMPOSIÇÃO</h3> (se aplicável)
<ul>
<li><strong>Ingrediente:</strong> Função.</li>
</ul>
<hr>
<h3>MODO DE USO</h3> (se aplicável)
<p>Instruções passo a passo.</p>
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
- Adapte seções ao tipo de produto — inclua TODAS que forem relevantes
- Se tiver composição/ingredientes, modo de uso, registro ANVISA ou qualquer info técnica, OBRIGATÓRIO incluir
- Escreva em português brasileiro
- GERE A DESCRIÇÃO COMPLETA — NÃO TRUNCE`;

const SYSTEM_PROMPT_KIT = `Você é um copywriter profissional especializado em e-commerce brasileiro.

Você receberá as descrições de cada produto que compõe este kit/combo.
Sua tarefa: criar UMA descrição unificada do kit que:

1. Mantenha TODAS as informações importantes de cada produto componente
2. Destaque o DIFERENCIAL e a VANTAGEM de comprar o kit completo (economia, praticidade, resultado potencializado)
3. NÃO repita informações redundantes entre os produtos
4. Organize de forma lógica: primeiro o kit como um todo, depois cada produto

REGRAS ABSOLUTAS — SIGA RIGOROSAMENTE:
1. Retorne APENAS o HTML da descrição. NADA MAIS.
2. NÃO inclua saudações, introduções, explicações ou qualquer texto fora do HTML.
3. A primeira linha da sua resposta DEVE ser uma tag HTML (ex: <h2>).
4. A última linha DEVE ser uma tag HTML de fechamento.

ESTRUTURA HTML OBRIGATÓRIA:
<h2>NOME DO KIT</h2>
<p><em>Frase de impacto sobre o kit completo</em></p>
<p>Parágrafo apresentando o kit e por que comprar junto é melhor.</p>
<hr>
<h3>O QUE VEM NO KIT</h3>
<ul>
<li><strong>Produto 1:</strong> Breve descrição</li>
<li><strong>Produto 2:</strong> Breve descrição</li>
</ul>
<hr>
<h3>BENEFÍCIOS DO KIT</h3>
<ul>
<li><strong>Benefício:</strong> Explicação de por que juntos são melhores.</li>
</ul>
<hr>
(Para cada produto do kit, adicionar seção com detalhes relevantes)
<h3>PRODUTO X — DETALHES</h3>
<p>Informações específicas deste produto.</p>
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
- NUNCA use markdown
- Escreva em português brasileiro`;

// ========== HELPERS ==========

function cleanGeneratedHtml(text: string): string {
  // Remove everything before the first HTML tag
  const firstTagIndex = text.indexOf('<');
  if (firstTagIndex > 0) {
    text = text.substring(firstTagIndex);
  }
  // Remove trailing markdown fences
  text = text.replace(/```$/g, '').trim();
  return text;
}

async function scrapeUrl(url: string): Promise<{ success: boolean; markdown?: string; error?: string }> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    return { success: false, error: "Firecrawl não configurado. Contate o suporte." };
  }

  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  console.log(`[ai-product-description][${VERSION}] Scraping URL: ${formattedUrl}`);

  const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: formattedUrl,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });

  const scrapeData = await scrapeRes.json();

  if (!scrapeRes.ok || !scrapeData.success) {
    console.error(`[ai-product-description] Firecrawl error:`, scrapeData);
    return { success: false, error: "Não foi possível acessar a página. Verifique o link e tente novamente." };
  }

  const markdown = scrapeData.data?.markdown || scrapeData.markdown;
  if (!markdown || markdown.trim().length < 50) {
    return { success: false, error: "A página não contém conteúdo suficiente para gerar uma descrição." };
  }

  return { success: true, markdown };
}

// ========== MAIN HANDLER ==========

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
    const { type, productName, fullDescription, userPrompt, referenceLinks, mode, url: linkUrl, components } = body;

    console.log(`[ai-product-description][${VERSION}] type=${type}, mode=${mode || 'default'}, product=${productName}`);

    if (!type || !productName) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt: string;
    let userContent: string;

    // ===== SHORT DESCRIPTION =====
    if (type === "short_description") {
      if (!fullDescription) {
        return new Response(
          JSON.stringify({ success: false, error: "A descrição completa é necessária para gerar a descrição curta" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      systemPrompt = SYSTEM_PROMPT_SHORT;
      userContent = `Produto: ${productName}\n\nDescrição completa:\n${fullDescription}`;

    // ===== FULL DESCRIPTION — FROM LINK =====
    } else if (type === "full_description" && mode === "from_link") {
      if (!linkUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "URL é obrigatória para gerar descrição por link" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const scrapeResult = await scrapeUrl(linkUrl);
      if (!scrapeResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: scrapeResult.error }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      systemPrompt = SYSTEM_PROMPT_FROM_LINK;
      userContent = `Produto: ${productName}\n\nConteúdo extraído da página de referência (${linkUrl}):\n\n${scrapeResult.markdown}`;
      if (userPrompt?.trim()) {
        userContent += `\n\nInstruções adicionais do lojista:\n${userPrompt}`;
      }

    // ===== FULL DESCRIPTION — FROM KIT =====
    } else if (type === "full_description" && mode === "from_kit") {
      if (!components || !Array.isArray(components) || components.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Componentes do kit são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      systemPrompt = SYSTEM_PROMPT_KIT;
      const componentsText = components.map((c: { name: string; description: string }, i: number) =>
        `--- PRODUTO ${i + 1}: ${c.name} ---\n${c.description}`
      ).join('\n\n');
      userContent = `Kit: ${productName}\n\nProdutos que compõem o kit:\n\n${componentsText}`;

    // ===== FULL DESCRIPTION — DEFAULT (legacy) =====
    } else if (type === "full_description") {
      systemPrompt = SYSTEM_PROMPT_FULL;

      // Build reference links context
      let referencesContext = "";
      if (referenceLinks && referenceLinks.length > 0) {
        referencesContext = `\n\nLINKS DE REFERÊNCIA (use como inspiração de estrutura e conteúdo):\n${referenceLinks.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")}`;
      }

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
      max_tokens: 8192,
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

    // Clean HTML output for full descriptions
    if (generatedText && type === "full_description") {
      generatedText = cleanGeneratedHtml(generatedText);
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
