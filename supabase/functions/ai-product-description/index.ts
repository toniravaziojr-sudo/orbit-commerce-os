import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.5.0"; // Fix: alinhar SYSTEM_PROMPT_FULL e SYSTEM_PROMPT_KIT com padrão <h2> + <br>
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
3. A primeira linha da sua resposta DEVE ser uma tag HTML (ex: <h2>).
4. A última linha DEVE ser uma tag HTML de fechamento.

ESTRUTURA HTML OBRIGATÓRIA — EXEMPLO:

<h2>NOME DO PRODUTO</h2>
<p><em>Frase de impacto / tagline persuasiva</em></p>
<p>Parágrafo introdutório apresentando o produto de forma envolvente.</p>
<br>
<h2>DESCRIÇÃO:</h2>
<p>Primeiro parágrafo descrevendo o produto, como funciona, para quem é indicado.</p>
<p>Segundo parágrafo com mais detalhes.</p>
<br>
<h2>FUNCIONALIDADES:</h2>
<ol>
<li><strong>Nome da funcionalidade:</strong> Explicação detalhada.</li>
<li><strong>Outra funcionalidade:</strong> Explicação detalhada.</li>
</ol>
<br>
<h2>BENEFÍCIOS PRINCIPAIS:</h2>
<ul>
<li><strong>Benefício:</strong> Explicação.</li>
<li><strong>Outro benefício:</strong> Explicação.</li>
</ul>
<br>
<h2>BENEFÍCIOS ADICIONAIS:</h2>
<ul>
<li>Benefício secundário.</li>
</ul>
<br>
<h2>ESPECIFICAÇÕES:</h2>
<ul>
<li><strong>Item:</strong> Valor</li>
</ul>

REGRAS DE FORMATAÇÃO CRÍTICAS:
- Títulos de seção SEMPRE em <h2> com texto em MAIÚSCULO seguido de dois pontos (ex: <h2>BENEFÍCIOS PRINCIPAIS:</h2>)
- NUNCA use <h3> — use SEMPRE <h2> para títulos de seção
- Use <br> (tag de quebra de linha) ENTRE CADA seção para dar espaçamento visual
- Cada parágrafo em sua PRÓPRIA tag <p> — NUNCA junte múltiplos parágrafos em um único <p>
- Quando há lista de itens, SEMPRE use <ul> com <li> — NUNCA coloque como parágrafos <p> separados
- <strong> para labels/nomes de funcionalidades
- <em> para taglines/frases de destaque
- NUNCA use markdown (**, ##, -, etc.)
- Adapte seções ao tipo de produto (nem todos precisam de todas)
- Se tiver composição/ingredientes ou modo de uso, adicione como seção extra
- Escreva em português brasileiro`;

const SYSTEM_PROMPT_FROM_LINK = `Você é um formatador de conteúdo para e-commerce.

Você receberá o conteúdo extraído (markdown) de uma página de produto de outro site.
Sua tarefa: CONVERTER esse conteúdo em HTML semântico bem formatado, PRESERVANDO FIELMENTE todo o texto original.

REGRAS ABSOLUTAS — SIGA RIGOROSAMENTE:
1. Retorne APENAS o HTML. NADA MAIS.
2. NÃO inclua saudações, introduções, explicações ou comentários.
3. A primeira linha DEVE ser uma tag HTML (ex: <h2>).
4. A última linha DEVE ser uma tag HTML de fechamento.
5. NÃO reescreva, NÃO resuma, NÃO invente. COPIE o conteúdo original fielmente.
6. Apenas FORMATE o conteúdo existente em HTML — o texto deve ser o MESMO da página original.
7. Inclua TODAS as seções que existem na página. NÃO OMITA nenhuma seção ou informação.
8. GERE O HTML COMPLETO — NÃO TRUNCE.

ESTRUTURA HTML — EXEMPLO COMPLETO REAL:

<h2>FAST UPGRADE</h2>
<p><em>Frasco com 5g – Resultado em segundos</em></p>
<p>O Fast Upgrade da Respeite o Homem é o produto ideal para quem quer melhorar instantaneamente a aparência do cabelo.</p>
<p>Com tecnologia em pó ultrafino e ação 4 em 1, ele aumenta o volume, escurece os fios, modela o cabelo e camufla falhas visíveis.</p>
<p>Perfeito para quem tem entradas, rarefação, fios brancos ou cabelos finos e sem forma, o Fast Upgrade devolve densidade e confiança em poucos segundos.</p>
<br>
<h2>AÇÃO 4 EM 1:</h2>
<ul>
<li><strong>Aumenta o volume:</strong> partículas leves que aderem aos fios, deixando o cabelo mais cheio.</li>
<li><strong>Escurece naturalmente:</strong> tonaliza fios brancos e falhas sem manchar.</li>
<li><strong>Modela o cabelo:</strong> mantém o penteado firme e natural durante o dia.</li>
<li><strong>Camufla falhas:</strong> preenche áreas ralas e dá aparência de cabelo mais denso.</li>
</ul>
<br>
<h2>BENEFÍCIOS PRINCIPAIS:</h2>
<ul>
<li>Resultado imediato em menos de 1 minuto</li>
<li>Efeito seco e natural, sem brilho artificial</li>
<li>Fixa ao couro cabeludo e aos fios sem escorrer</li>
<li>Ideal para uso diário e eventos</li>
</ul>
<br>
<h2>MODO DE USO:</h2>
<p>Com o cabelo seco, aplique uma pequena quantidade do pó sobre os cabelos secos ou molhados.</p>
<p>Espalhe com os dedos ou pente até atingir o efeito desejado.</p>
<p>Finalize modelando normalmente.</p>
<p>O resultado é imediato e dura até a próxima lavagem.</p>
<br>
<h2>COMPOSIÇÃO:</h2>
<p>Pó mineral ultrafino de fixação capilar, pigmentos vegetais de coloração natural.</p>
<p><strong>Peso líquido:</strong> 5g</p>
<p><strong>Registro ANVISA:</strong> 25351130726202583</p>
<br>
<h2>OBSERVAÇÃO:</h2>
<p>O Fast Upgrade é um produto cosmético de ação estética imediata.</p>
<p>Para fortalecimento e crescimento real dos fios, recomenda-se o uso conjunto com outros produtos da linha.</p>

REGRAS DE FORMATAÇÃO CRÍTICAS:
- Títulos de seção SEMPRE em <h2> com texto em MAIÚSCULO seguido de dois pontos (ex: <h2>BENEFÍCIOS PRINCIPAIS:</h2>)
- NUNCA use <h3> — use SEMPRE <h2> para títulos de seção
- Use <br> (tag de quebra de linha) ENTRE CADA seção para dar espaçamento visual
- Cada parágrafo em sua PRÓPRIA tag <p> — NUNCA junte múltiplos parágrafos em um único <p>
- Quando há lista de itens (benefícios, funcionalidades, etc.), SEMPRE use <ul> com <li> — NUNCA coloque como parágrafos <p> separados
- Cada passo do "modo de uso" em seu PRÓPRIO <p>
- <strong> para labels/nomes de funcionalidades (ex: <strong>Aumenta o volume:</strong>)
- <em> para taglines/frases de destaque
- NUNCA use markdown (**, ##, -, etc.)
- Se a página tem itens numerados (1, 2, 3...) use <ol>, se não numerados use <ul>
- Escreva em português brasileiro`;

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

ESTRUTURA HTML OBRIGATÓRIA — EXEMPLO:

<h2>NOME DO KIT</h2>
<p><em>Frase de impacto sobre o kit completo</em></p>
<p>Parágrafo apresentando o kit e por que comprar junto é melhor.</p>
<br>
<h2>O QUE VEM NO KIT:</h2>
<ul>
<li><strong>Produto 1:</strong> Breve descrição</li>
<li><strong>Produto 2:</strong> Breve descrição</li>
</ul>
<br>
<h2>BENEFÍCIOS DO KIT:</h2>
<ul>
<li><strong>Benefício:</strong> Explicação de por que juntos são melhores.</li>
</ul>
<br>
<h2>PRODUTO X — DETALHES:</h2>
<p>Informações específicas deste produto.</p>
<br>
<h2>ESPECIFICAÇÕES:</h2>
<ul>
<li><strong>Item:</strong> Valor</li>
</ul>

REGRAS DE FORMATAÇÃO CRÍTICAS:
- Títulos de seção SEMPRE em <h2> com texto em MAIÚSCULO seguido de dois pontos (ex: <h2>BENEFÍCIOS DO KIT:</h2>)
- NUNCA use <h3> — use SEMPRE <h2> para títulos de seção
- Use <br> (tag de quebra de linha) ENTRE CADA seção para dar espaçamento visual
- Cada parágrafo em sua PRÓPRIA tag <p> — NUNCA junte múltiplos parágrafos em um único <p>
- Quando há lista de itens, SEMPRE use <ul> com <li> — NUNCA coloque como parágrafos <p> separados
- <strong> para labels/nomes de funcionalidades
- <em> para taglines/frases de destaque
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
