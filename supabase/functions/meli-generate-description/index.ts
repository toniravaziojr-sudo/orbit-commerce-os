import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION =====
const VERSION = "v2.0.0"; // Improved title gen: min length 60%, openai provider, better prompts
// ===================

const DEFAULT_MAX_TITLE_LENGTH = 120;

// Fetch the real max_title_length from ML category API
async function getCategoryMaxTitleLength(categoryId: string | null): Promise<number> {
  if (!categoryId) return DEFAULT_MAX_TITLE_LENGTH;
  try {
    const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`);
    if (res.ok) {
      const data = await res.json();
      const maxLen = data.settings?.max_title_length;
      if (maxLen && typeof maxLen === 'number' && maxLen > 0) {
        return maxLen;
      }
    }
  } catch (err) {
    console.warn(`[meli-generate-description] Failed to fetch category max_title_length:`, err);
  }
  return DEFAULT_MAX_TITLE_LENGTH;
}

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

function sanitizeGeneratedTitle(rawTitle: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string {
  const firstLine = rawTitle.split("\n")[0] || "";
  const noDecorators = firstLine.replace(/^['"*`\-\s]+|['"*`\-\s]+$/g, "");
  const normalized = normalizeWhitespace(noDecorators);
  return truncateAtWordBoundary(normalized, maxLength);
}

function isValidGeneratedTitle(title: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH, minLengthPct: number = 0.6): boolean {
  if (!title) return false;
  if (title.length > maxLength) return false;

  // Dynamic minimum: 60% of max length (e.g., 36 for 60-char categories)
  const dynamicMin = Math.max(10, Math.floor(maxLength * minLengthPct));
  if (title.length < dynamicMin) return false;

  if (/[-,/:;]$/.test(title)) return false;
  if (title.split(/\s+/).length < 2) return false;

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
    const { tenantId, productId, generateTitle, categoryId: bodyCategoryId, listingId } = body;
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
    let userPromptFinal: string = `Converta a seguinte descrição HTML do produto para texto plano compatível com o Mercado Livre:\n\nProduto: ${productName || "Produto"}\n\n${htmlDescription}`;

    if (generateTitle) {
      // Resolve category_id: from body, listing, or skip
      let categoryId = bodyCategoryId || null;
      if (!categoryId && listingId) {
        const { data: listingData } = await supabase
          .from("meli_listings")
          .select("category_id")
          .eq("id", listingId)
          .single();
        categoryId = listingData?.category_id || null;
      }

      // Fetch category-specific max title length
      const maxTitleLen = await getCategoryMaxTitleLength(categoryId);
      const minTitleLen = Math.max(10, Math.floor(maxTitleLen * 0.6));
      console.log(`[meli-generate-description][${VERSION}] Using max_title_length=${maxTitleLen}, minTitleLen=${minTitleLen} for category=${categoryId || "none"}`);

      systemPromptFinal = `Você é um copywriter especialista em títulos de anúncios para o Mercado Livre Brasil. Seu objetivo é criar títulos que VENDEM e são encontrados nas buscas.

TAREFA: Gere exatamente UM título otimizado para buscas, completo e natural.

FORMATO DO TÍTULO:
[Tipo do Produto] [Marca] [Função/Benefício Principal] [Detalhe Diferenciador] [Peso/Quantidade]

REGRAS OBRIGATÓRIAS:
1. O título DEVE começar pelo TIPO DE PRODUTO (ex: Balm, Sérum, Kit, Camiseta), nunca pela marca sozinha
2. A marca deve aparecer depois do tipo de produto
3. Inclua o principal benefício/função extraído da descrição (Antiqueda, Hidratante, Crescimento, etc.)
4. Inclua peso/volume/quantidade quando disponível (60g, 30ml, 500ml, etc.)
5. NÃO truncar palavras no final — todas as palavras devem estar COMPLETAS
6. Sem emojis, sem CAPS LOCK excessivo, sem preço/promoção, sem código de barras
7. Sem repetir palavras
8. O título DEVE ter entre ${minTitleLen} e ${maxTitleLen} caracteres — PREENCHA O ESPAÇO DISPONÍVEL
9. Priorize termos que compradores realmente usam na busca do Mercado Livre
${maxTitleLen <= 60 ? '10. ATENÇÃO: Limite curto! Seja conciso: tipo + marca + benefício + peso/volume.' : '10. Aproveite o espaço: tipo + marca + benefício + detalhe + peso/volume.'}

EXEMPLOS CORRETOS (observe como preenchem o espaço):
- "Balm Pós-Banho Respeite o Homem Antiqueda Crescimento 60g" (57 chars ✓)
- "Sérum Facial Vitamina C Anti-idade Clareador Uniformizador 30ml" (63 chars ✓)
- "Kit 3 Camisetas Básicas Algodão Premium Masculina Slim Fit M" (61 chars ✓)

EXEMPLOS ERRADOS (NÃO FAÇA ISSO):
- "Balm Respeite o Homem Pós" (25 chars ✗ — MUITO CURTO, desperdiça espaço)
- "Balm Pós-Banho Cabelo Bar" (25 chars ✗ — truncado)
- "⭐ SUPER PROMOÇÃO Camiseta ⭐" (✗ — emojis/caps)

Retorne APENAS o título, sem aspas e sem explicações.`;

      userPromptFinal = `Gere UM título otimizado para o Mercado Livre.

REQUISITOS DE TAMANHO: O título DEVE ter entre ${minTitleLen} e ${maxTitleLen} caracteres. Preencha o espaço disponível com informações relevantes do produto.

${productName ? `Produto: ${productName}` : ""}
${productTitle ? `Título atual: ${productTitle}` : ""}
${htmlDescription ? `Descrição/Contexto: ${htmlDescription.slice(0, 700)}` : ""}

Retorne APENAS o título completo, sem aspas e sem explicações.`;

      const MAX_ATTEMPTS = 3;
      let finalTitle = "";
      let lastCandidate = "";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let attemptFeedback = "";
        if (attempt > 1 && lastCandidate) {
          const shortReason = lastCandidate.length < minTitleLen
            ? `MUITO CURTO (${lastCandidate.length} chars, mínimo ${minTitleLen}). Adicione mais palavras-chave, benefícios e detalhes do produto.`
            : `Rejeitado por qualidade (palavra final cortada ou incompleta).`;
          attemptFeedback = `\n\nTENTATIVA ANTERIOR REJEITADA: "${lastCandidate}" — ${shortReason}\nGere uma versão DIFERENTE e COMPLETA com entre ${minTitleLen} e ${maxTitleLen} caracteres.`;
        }

        const aiResponse = await aiChatCompletion(
          "google/gemini-2.5-pro",
          {
            messages: [
              { role: "system", content: systemPromptFinal },
              { role: "user", content: `${userPromptFinal}${attemptFeedback}` },
            ],
            max_tokens: 256,
            temperature: attempt === 1 ? 0.5 : attempt === 2 ? 0.65 : 0.8,
          },
          {
            supabaseUrl,
            supabaseServiceKey,
            preferProvider: 'openai',
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
        const candidate = sanitizeGeneratedTitle(rawTitle, maxTitleLen);
        lastCandidate = candidate;

        const isValid = isValidGeneratedTitle(candidate, maxTitleLen);
        console.log(`[meli-generate-description][${VERSION}] attempt ${attempt}/${MAX_ATTEMPTS} title="${candidate}" (${candidate.length}/${maxTitleLen} chars, min=${minTitleLen}, valid=${isValid})`);

        if (isValid) {
          finalTitle = candidate;
          break;
        }
      }

      if (!finalTitle) {
        finalTitle = buildFallbackTitle(productName || productTitle || "Produto", htmlDescription || "");
        // Ensure fallback also respects limit
        if (finalTitle.length > maxTitleLen) {
          finalTitle = truncateAtWordBoundary(finalTitle, maxTitleLen);
        }
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
    return errorResponse(error, corsHeaders, { module: 'mercadolivre', action: 'generate-description' });
  }
});
