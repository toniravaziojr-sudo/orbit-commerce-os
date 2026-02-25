import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v1.1.0"; // Use ai-router for multi-provider fallback
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[meli-generate-description][${VERSION}] Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, htmlDescription, productName, productTitle, generateTitle } = body;

    if (!tenantId || !htmlDescription) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId e htmlDescription são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant access
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI to generate ML-compliant description
    resetAIRouterCache();

    const systemPrompt = `Você é um especialista em criação de anúncios para o Mercado Livre Brasil.

REGRAS OBRIGATÓRIAS DO MERCADO LIVRE PARA DESCRIÇÕES:
1. APENAS TEXTO PLANO - Sem HTML, sem Markdown, sem formatação especial
2. PROIBIDO incluir: telefones, WhatsApp, e-mails, links externos, URLs, redes sociais
3. PROIBIDO incluir: emojis, caracteres especiais decorativos
4. PROIBIDO mencionar: formas de pagamento fora do ML, promoções condicionais
5. PROIBIDO incluir: dados de contato do vendedor de qualquer tipo
6. Use quebras de linha (\\n) para organizar o texto em seções
7. Use letras MAIÚSCULAS para títulos de seções
8. Máximo recomendado: 5000 caracteres

ESTRUTURA RECOMENDADA:
- Parágrafo de abertura com benefícios principais
- Seção "O QUE VOCÊ RECEBE" ou "CONTEÚDO" (se for kit)
- Seção "CARACTERÍSTICAS" com especificações técnicas
- Seção "MODO DE USO" (se aplicável)
- Seção "GARANTIA" (se aplicável)
- Informações regulatórias (ANVISA, etc.) se presentes no original

INSTRUÇÕES:
- Preserve TODAS as informações técnicas, ingredientes, registros ANVISA, composições do texto original
- Converta HTML para texto plano mantendo a organização lógica
- Remova qualquer dado de contato, link ou informação proibida
- O texto deve ser persuasivo e profissional
- Não invente informações que não estejam no original`;

    let systemPromptFinal = systemPrompt;
    let userPromptFinal: string;

    if (generateTitle) {
      systemPromptFinal = `Você é um especialista em criação de títulos de anúncios para o Mercado Livre Brasil.

REGRAS OBRIGATÓRIAS PARA TÍTULOS DO MERCADO LIVRE:
1. MÁXIMO 60 CARACTERES (limite absoluto do ML)
2. NÃO usar emojis, caracteres especiais, pontuação excessiva
3. NÃO usar palavras em CAPS LOCK (exceto siglas como ML, USB, LED)
4. NÃO incluir: preço, frete grátis, promoção, desconto
5. NÃO repetir palavras
6. INCLUIR: marca + modelo/tipo + característica principal + diferencial
7. Palavras-chave relevantes para SEO dentro do ML
8. Linguagem clara e direta

EXEMPLOS BONS:
- Kit 3 Camisetas Básicas Algodão Masculina Slim Fit
- Tênis Nike Air Max 90 Masculino Original Preto
- Sérum Facial Vitamina C 30ml Anti-idade Clareador

EXEMPLOS RUINS:
- ⭐ SUPER PROMOÇÃO Camiseta BARATA ⭐ (emojis, caps, preço)
- Camiseta Camiseta Algodão Algodão (repetição)`;

      userPromptFinal = `Gere UM título otimizado para o Mercado Livre com no máximo 60 caracteres.

Produto: ${productName || "Produto"}
${productTitle ? `Título atual: ${productTitle}` : ""}
${htmlDescription ? `Descrição: ${htmlDescription.slice(0, 500)}` : ""}

Retorne APENAS o título, sem explicações, sem aspas.`;
    } else {
      userPromptFinal = `Converta a seguinte descrição HTML de produto para texto plano compatível com o Mercado Livre.

Produto: ${productName || productTitle || "Produto"}
${productTitle ? `Título do anúncio: ${productTitle}` : ""}

Descrição HTML original:
${htmlDescription}

Gere APENAS o texto plano da descrição, sem explicações adicionais.`;
    }

    const aiResponse = await aiChatCompletion(
      "google/gemini-2.5-flash",
      {
        messages: [
          { role: "system", content: systemPromptFinal },
          { role: "user", content: userPromptFinal },
        ],
        max_tokens: generateTitle ? 128 : 4096,
        temperature: generateTitle ? 0.5 : 0.3,
      },
      {
        supabaseUrl,
        supabaseServiceKey,
        logPrefix: "[meli-generate-description]",
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[meli-generate-description] AI API error:`, errText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar descrição com IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!generatedText) {
      return new Response(
        JSON.stringify({ success: false, error: "IA não retornou conteúdo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meli-generate-description][${VERSION}] Generated ${generatedText.length} chars, mode=${generateTitle ? 'title' : 'description'}`);

    const responseBody = generateTitle
      ? { success: true, title: generatedText.slice(0, 60) }
      : { success: true, description: generatedText };

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meli-generate-description] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
