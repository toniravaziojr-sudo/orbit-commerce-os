import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  calendar_item_id: string;
  variant_count?: number;
  use_packshot?: boolean;
}

interface ProductMatch {
  id: string;
  name: string;
  image_url: string | null;
  is_kit: boolean;
  sku: string | null;
}

/**
 * Busca produtos no texto baseado em nome, SKU e palavras-chave
 * CRÍTICO: Precisa encontrar o produto correto para usar imagem REAL
 */
async function findProductsInText(
  supabase: any,
  tenantId: string,
  text: string
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];
  
  // Get all active products for this tenant with their images
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      sku,
      product_images(url, is_primary, sort_order)
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name");

  if (error || !products || products.length === 0) {
    console.log("⚠️ No products found for tenant:", tenantId);
    return matches;
  }

  const textLower = text.toLowerCase();
  console.log(`🔍 Searching for products in text (${text.length} chars), ${products.length} products to check`);

  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    
    // Método 1: Match exato do nome
    if (textLower.includes(productNameLower)) {
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const sortedImages = [...images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const imageUrl = primaryImage?.url || sortedImages[0]?.url || null;
      const isKit = productNameLower.includes("kit");
      
      matches.push({ id: product.id, name: product.name, image_url: imageUrl, is_kit: isKit, sku: product.sku });
      console.log(`✅ EXACT match: "${product.name}" (kit: ${isKit}, hasImage: ${!!imageUrl})`);
      continue;
    }
    
    // Método 2: Match por palavras significativas (>3 chars)
    const productWords = productNameLower
      .replace(/[()]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3);
    
    let matchCount = 0;
    for (const word of productWords) {
      if (textLower.includes(word)) matchCount++;
    }
    
    // Threshold: pelo menos metade das palavras ou 2, o que for maior
    const matchThreshold = Math.max(2, Math.ceil(productWords.length / 2));
    
    if (productWords.length > 0 && matchCount >= matchThreshold) {
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const sortedImages = [...images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const imageUrl = primaryImage?.url || sortedImages[0]?.url || null;
      const isKit = productNameLower.includes("kit");
      
      matches.push({ id: product.id, name: product.name, image_url: imageUrl, is_kit: isKit, sku: product.sku });
      console.log(`✅ WORD match: "${product.name}" (${matchCount}/${productWords.length} words, kit: ${isKit})`);
    }
  }

  return matches;
}

/**
 * Detecta se é cenário de KIT (múltiplos produtos)
 * CRÍTICO: Kit NÃO pode ser segurado na mão
 */
function detectKitScenario(matchedProducts: ProductMatch[]): boolean {
  // Se algum produto é explicitamente um kit
  if (matchedProducts.some(p => p.is_kit)) return true;
  // Se há mais de 1 produto diferente mencionado
  if (matchedProducts.length > 1) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
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
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { calendar_item_id, variant_count = 1, use_packshot = false }: GenerateRequest = await req.json();

    if (!calendar_item_id) {
      return new Response(
        JSON.stringify({ success: false, error: "calendar_item_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n🚀 === media-generate-image START ===`);
    console.log(`📅 Calendar item: ${calendar_item_id}`);

    // Get calendar item with campaign info
    const { data: calendarItem, error: itemError } = await supabase
      .from("media_calendar_items")
      .select(`
        *,
        campaign:media_campaigns!inner(
          id,
          name,
          tenant_id,
          prompt
        )
      `)
      .eq("id", calendar_item_id)
      .single();

    if (itemError || !calendarItem) {
      console.error("❌ Calendar item error:", itemError);
      return new Response(
        JSON.stringify({ success: false, error: "Item não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REGRA: Blog não gera imagem
    if (calendarItem.content_type === "text") {
      console.log("ℹ️ Blog content - no image needed");
      return new Response(
        JSON.stringify({ success: false, error: "Blog não precisa de imagem" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = calendarItem.campaign.tenant_id;
    console.log(`🏢 Tenant: ${tenantId}`);

    // Verify user belongs to tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get brand context if exists
    const { data: brandContext } = await supabase
      .from("tenant_brand_context")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    // ============ PRODUCT DETECTION (CRÍTICO) ============
    const searchText = [
      calendarItem.campaign.prompt || "",
      calendarItem.generation_prompt || "",
      calendarItem.copy || "",
      calendarItem.campaign.name || "",
      calendarItem.title || "",
    ].join(" ");

    console.log("🔍 Search text preview:", searchText.substring(0, 300));
    
    const matchedProducts = await findProductsInText(supabase, tenantId, searchText);
    console.log(`📦 Found ${matchedProducts.length} product matches:`, matchedProducts.map(p => `${p.name} (img: ${!!p.image_url})`));

    // Verificar se o produto tem imagem
    const productWithImage = matchedProducts.find(p => p.image_url);
    const hasProductWithoutImage = matchedProducts.some(p => !p.image_url);
    
    // REGRA: Se encontrou produto mas não tem imagem, BLOQUEAR
    if (matchedProducts.length > 0 && !productWithImage) {
      const productNames = matchedProducts.map(p => p.name).join(", ");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Produto(s) "${productNames}" encontrado(s), mas nenhum tem imagem cadastrada. Cadastre a imagem primeiro para garantir fidelidade.` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detecta cenário de kit
    const isKitScenario = detectKitScenario(matchedProducts);
    console.log(`📦 Kit scenario: ${isKitScenario}`);

    // Build the final prompt
    const promptParts: string[] = [];

    // Regras base anti-alucinação
    const baseRules = [
      "Fotografia profissional em alta resolução, qualidade editorial de revista",
      "PRODUTO IMUTÁVEL: o produto é SAGRADO — NÃO redesenhe, recrie, reimagine ou altere de nenhuma forma",
      "NÃO crie variações do produto (frascos diferentes, tamanhos diferentes, embalagens fictícias)",
      "NÃO inclua NENHUM texto, letras, números ou logotipos sobrepostos na imagem",
      "NÃO invente, altere ou recrie rótulos, embalagens ou designs de produtos",
      "NÃO distorça cores, proporções ou identidade visual do produto",
      "NÃO adicione selos, certificações, claims ou promessas",
      "NÃO duplique o produto sem instrução explícita do briefing",
      "PERMITIDO: mudar ambiente, cenário, iluminação, fundo — NUNCA o produto em si",
      "Iluminação profissional de estúdio, suave e premium",
      "Evite claims médicos, antes/depois ou promessas de resultado",
    ];

    // REGRA CRÍTICA: Kit NÃO pode ser segurado na mão
    if (isKitScenario) {
      promptParts.push("CENÁRIO DE KIT/MÚLTIPLOS PRODUTOS:");
      promptParts.push("- PROIBIDO: pessoa segurando múltiplos produtos nas mãos");
      promptParts.push("- OBRIGATÓRIO: apresentar em bancada, flatlay, prateleira ou ambiente lifestyle");
      promptParts.push("- Os produtos devem estar APOIADOS em superfície, organizados elegantemente");
      baseRules.push("NUNCA colocar kit ou múltiplos produtos nas mãos de modelo");
    } else if (productWithImage) {
      promptParts.push("CENÁRIO DE PRODUTO ÚNICO:");
      promptParts.push("- Pode mostrar modelo segurando o produto de forma natural");
      promptParts.push("- Máximo 1 produto por mão (total máximo 2 se usar ambas as mãos)");
      baseRules.push("Se mostrar mãos: pose natural e elegante, produto claramente visível");
    }

    // Context from brand
    if (brandContext) {
      if (brandContext.tone_of_voice) {
        promptParts.push(`Tom de voz da marca: ${brandContext.tone_of_voice}`);
      }
      if (brandContext.visual_style_guidelines) {
        promptParts.push(`Estilo visual: ${brandContext.visual_style_guidelines}`);
      }
      if (brandContext.banned_claims && brandContext.banned_claims.length > 0) {
        baseRules.push(`PROIBIDO mencionar/mostrar: ${brandContext.banned_claims.join(", ")}`);
      }
    }

    // Campaign context
    if (calendarItem.campaign.prompt) {
      promptParts.push(`Briefing da campanha: ${calendarItem.campaign.prompt}`);
    }

    // Item specific prompt
    if (calendarItem.generation_prompt) {
      promptParts.push(`Briefing específico do criativo: ${calendarItem.generation_prompt}`);
    } else if (calendarItem.copy) {
      promptParts.push(`Contexto do post: ${calendarItem.copy.substring(0, 300)}`);
    }

    // Content type/format
    const contentTypeConfig: Record<string, { prompt: string; size: string }> = {
      image: { prompt: "Imagem quadrada 1:1 para feed", size: "1024x1024" },
      carousel: { prompt: "Imagem quadrada 1:1 para carrossel", size: "1024x1024" },
      reel: { prompt: "Imagem vertical 9:16 para Reels", size: "1024x1792" },
      story: { prompt: "Imagem vertical 9:16 para Stories", size: "1024x1792" },
    };

    const contentConfig = contentTypeConfig[calendarItem.content_type] || contentTypeConfig.image;
    promptParts.push(`Formato: ${contentConfig.prompt}`);

    // Build final prompt
    const promptFinal = [
      ...promptParts,
      "",
      "REGRAS OBRIGATÓRIAS (seguir rigorosamente):",
      ...baseRules.map(r => `• ${r}`),
      "",
      "EVITAR:",
      "• Caixas genéricas, rótulos inventados, texto ilegível",
      "• Produto diferente do de referência",
      "• Qualidade baixa, blur, distorções",
      "• Múltiplos produtos em uma mão",
      "• Duplicação do mesmo produto na cena",
    ].join("\n");

    console.log("📝 Final prompt length:", promptFinal.length);

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: tenantId,
        calendar_item_id: calendar_item_id,
        provider: "fal-ai", // Fal.AI para geração de imagens
        model: productWithImage ? "gpt-image-1.5/edit" : "gpt-image-1.5",
        prompt_final: promptFinal,
        brand_context_snapshot: brandContext || null,
        settings: {
          use_packshot,
          packshot_url: productWithImage?.image_url || null,
          reference_source: productWithImage ? "product" : null,
          matched_products: matchedProducts,
          content_type: calendarItem.content_type,
          is_kit_scenario: isKitScenario,
          needs_product_image: !!productWithImage,
          image_size: contentConfig.size,
        },
        status: "queued",
        variant_count,
        created_by: user.id,
      })
      .select()
      .single();

    if (genError || !generation) {
      console.error("❌ Generation insert error:", genError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar geração" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Generation queued: ${generation.id}`);
    console.log(`   - Product: ${productWithImage?.name || "none"}`);
    console.log(`   - Kit: ${isKitScenario}`);
    console.log(`   - Needs reference: ${!!productWithImage}`);

    // Trigger processing
    try {
      const processUrl = `${supabaseUrl}/functions/v1/media-process-generation-queue`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }).catch(err => console.error("⚠️ Error triggering process queue:", err));
    } catch (triggerError) {
      console.error("⚠️ Error triggering queue processing:", triggerError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generation_id: generation.id,
        matched_products: matchedProducts.map(p => p.name),
        is_kit_scenario: isKitScenario,
        product_with_image: productWithImage?.name || null,
        message: productWithImage 
          ? `Geração iniciada com produto real: ${productWithImage.name}${isKitScenario ? " (kit)" : ""}` 
          : "Geração iniciada (sem produto específico)" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'media', action: 'generate-image' });
  }
});
