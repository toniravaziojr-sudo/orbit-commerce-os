import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v1.3.0"; // Retry + validação robusta para evitar títulos truncados
// ===================

const MAX_TITLE_LENGTH = 60;
const MIN_TITLE_LENGTH = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const sliced = value.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const bounded = lastSpace > 15 ? sliced.slice(0, lastSpace) : sliced;
  return bounded.replace(/[\s\-_,;:.]+$/g, "").trim();
}

function sanitizeGeneratedTitle(rawTitle: string): string {
  const firstLine = rawTitle.split("\n")[0] || "";
  const noDecorators = firstLine.replace(/^['"*`\-\s]+|['"*`\-\s]+$/g, "");
  const normalized = normalizeWhitespace(noDecorators);
  return truncateAtWordBoundary(normalized, MAX_TITLE_LENGTH);
}

function isValidGeneratedTitle(title: string): boolean {
  if (!title) return false;
  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) return false;
  if (/[-,/:;]$/.test(title)) return false;
  if (title.split(/\s+/).length < 3) return false;

  const lastWord = title.split(/\s+/).pop()?.toLowerCase() || "";
  const danglingWords = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "por", "a", "o", "em"]);
  if (danglingWords.has(lastWord)) return false;

  return true;
}

function extractBenefitKeyword(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("anti-queda") || lower.includes("antiqueda")) return "Anti-queda";
  if (lower.includes("hidrat")) return "Hidratante";
  if (lower.includes("fortalec")) return "Fortalecedor";
  if (lower.includes("cresciment")) return "Crescimento Capilar";
  if (lower.includes("limpeza")) return "Limpeza Profunda";
  if (lower.includes("vitamina c")) return "Vitamina C";
  return "Uso Diário";
}

function buildFallbackTitle(productName: string, context: string): string {
  const base = sanitizeGeneratedTitle(productName || "Produto");
  if (isValidGeneratedTitle(base)) return base;

  const benefit = extractBenefitKeyword(context);
  const withBenefit = sanitizeGeneratedTitle(`${base} ${benefit}`);
  if (isValidGeneratedTitle(withBenefit)) return withBenefit;

  const finalFallback = sanitizeGeneratedTitle(`${base} Produto Original`);
  return finalFallback || "Produto Original";
}

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
    const { tenantId, productId, generateTitle } = body;
    let { htmlDescription, productName, productTitle } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If productId provided but no htmlDescription, fetch from DB
    if (productId && !htmlDescription) {
      const { data: product } = await supabase
        .from("products")
        .select("name, description, short_description, brand, sku, weight, width, height, depth, gtin, barcode")
        .eq("id", productId)
        .single();

      if (product) {
        const rawDesc = product.description || product.short_description || "";
        htmlDescription = rawDesc || product.name || "Produto";
        if (!productName) productName = product.name;
        // Build richer context for title generation
        if (generateTitle) {
          const parts = [`Produto: ${product.name}`];
          if (product.brand) parts.push(`Marca: ${product.brand}`);
          if (product.sku) parts.push(`SKU: ${product.sku}`);
          if (product.weight) parts.push(`Peso: ${product.weight}g`);
          if (product.width && product.height && product.depth) {
            parts.push(`Dimensões: ${product.width}x${product.height}x${product.depth}cm`);
          }
          const shortDesc = (product.short_description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
          if (shortDesc) parts.push(`Resumo/Benefícios: ${shortDesc}`);
          const cleanDesc = rawDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
          if (cleanDesc) parts.push(`Descrição completa: ${cleanDesc}`);
          htmlDescription = parts.join("\n");
        }
        console.log(`[meli-generate-description] Fetched product data for ${productId}: ${productName}`);
      }
    }

    if (!htmlDescription) {
      return new Response(
        JSON.stringify({ success: false, error: "Descrição do produto não encontrada" }),
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
4. PROIBIDO incluir: códigos de barras, EAN, GTIN (esses dados vão como atributos separados do anúncio)
5. PROIBIDO mencionar: formas de pagamento fora do ML, promoções condicionais
6. PROIBIDO incluir: dados de contato do vendedor de qualquer tipo
7. Use quebras de linha (\\n) para organizar o texto em seções
8. Use letras MAIÚSCULAS para títulos de seções
9. Máximo recomendado: 5000 caracteres

ESTRUTURA RECOMENDADA:
- Parágrafo de abertura com benefícios principais
- Seção "O QUE VOCÊ RECEBE" ou "CONTEÚDO" (se for kit)
- Seção "CARACTERÍSTICAS" com especificações técnicas (peso, dimensões — sem código de barras)
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
      systemPromptFinal = `Você é um especialista em SEO de títulos para o Mercado Livre Brasil.

TAREFA: Gere exatamente UM título otimizado para buscas, com no máximo 60 caracteres.

REGRAS OBRIGATÓRIAS:
1. MÁXIMO 60 CARACTERES (limite absoluto do ML)
2. O título DEVE ter entre 30 e 60 caracteres — aproveite o espaço para incluir diferenciais e benefícios
3. O título DEVE começar pelo TIPO DE PRODUTO (ex: Balm, Sérum, Kit, Camiseta), NUNCA pela marca sozinha
4. A marca deve aparecer DEPOIS do tipo de produto
5. SEMPRE adicione o principal BENEFÍCIO ou FUNÇÃO do produto (ex: Anti-queda, Hidratante, Fortalecedor)
6. Use informações da descrição e resumo para identificar o que o produto FAZ e inclua no título
7. NÃO usar emojis, caracteres especiais, pontuação excessiva
8. NÃO usar palavras em CAPS LOCK (exceto siglas como USB, LED)
9. NÃO incluir: preço, frete grátis, promoção, desconto, código de barras, EAN, GTIN
10. NÃO repetir palavras
11. NUNCA truncar nomes ou marcas — se não cabe, omita a marca em vez de cortar pela metade
12. Priorize termos de busca que compradores usariam

EXEMPLOS CORRETOS:
- Balm Pós-Banho Anti-queda Calvície Zero 60g (44 chars) — inclui benefício
- Kit 3 Camisetas Básicas Algodão Masculina Slim Fit (51 chars)
- Sérum Facial Vitamina C 30ml Anti-idade Clareador (50 chars) — inclui benefícios

EXEMPLOS ERRADOS (NÃO FAÇA ISSO):
- "Balm Pós-Banho Calvície Zero Dia" (sem benefício, genérico)
- "Balm Respeite o" (truncado, incompleto — PROIBIDO)
- "Nike Tênis" (marca antes do produto)
- ⭐ SUPER PROMOÇÃO Camiseta BARATA ⭐ (emojis, caps, preço)`;

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

    if (generateTitle) {
      const MAX_ATTEMPTS = 3;
      let finalTitle = "";
      let lastCandidate = "";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const attemptFeedback = attempt > 1
          ? `\n\nA tentativa anterior foi rejeitada por qualidade: "${lastCandidate || "(vazio)"}". Gere uma nova versão COMPLETA, sem truncamento e entre 30-60 caracteres.`
          : "";

        const aiResponse = await aiChatCompletion(
          "google/gemini-2.5-flash",
          {
            messages: [
              { role: "system", content: systemPromptFinal },
              { role: "user", content: `${userPromptFinal}${attemptFeedback}` },
            ],
            max_tokens: 256,
            temperature: attempt === 1 ? 0.35 : attempt === 2 ? 0.5 : 0.65,
          },
          {
            supabaseUrl,
            supabaseServiceKey,
            logPrefix: "[meli-generate-description]",
          }
        );

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[meli-generate-description][${VERSION}] AI error on attempt ${attempt}:`, errText);
          continue;
        }

        const aiData = await aiResponse.json();
        const rawTitle = aiData.choices?.[0]?.message?.content?.trim() || "";
        const candidate = sanitizeGeneratedTitle(rawTitle);
        lastCandidate = candidate;

        const isValid = isValidGeneratedTitle(candidate);
        console.log(`[meli-generate-description][${VERSION}] attempt ${attempt}/${MAX_ATTEMPTS} title="${candidate}" (${candidate.length} chars, valid=${isValid})`);

        if (isValid) {
          finalTitle = candidate;
          break;
        }
      }

      if (!finalTitle) {
        finalTitle = buildFallbackTitle(productName || productTitle || "Produto", htmlDescription || "");
        console.log(`[meli-generate-description][${VERSION}] fallback title used: "${finalTitle}"`);
      }

      return new Response(
        JSON.stringify({ success: true, title: finalTitle }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await aiChatCompletion(
      "google/gemini-2.5-flash",
      {
        messages: [
          { role: "system", content: systemPromptFinal },
          { role: "user", content: userPromptFinal },
        ],
        max_tokens: 4096,
        temperature: 0.3,
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

    console.log(`[meli-generate-description][${VERSION}] Generated ${generatedText.length} chars, mode=description`);

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
