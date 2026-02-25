import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial: AI-powered ML description generator
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
    const { tenantId, htmlDescription, productName, productTitle } = body;

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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Chave de IA não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const userPrompt = `Converta a seguinte descrição HTML de produto para texto plano compatível com o Mercado Livre.

Produto: ${productName || productTitle || "Produto"}
${productTitle ? `Título do anúncio: ${productTitle}` : ""}

Descrição HTML original:
${htmlDescription}

Gere APENAS o texto plano da descrição, sem explicações adicionais.`;

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

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

    console.log(`[meli-generate-description][${VERSION}] Generated ${generatedText.length} chars`);

    return new Response(
      JSON.stringify({ success: true, description: generatedText }),
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
