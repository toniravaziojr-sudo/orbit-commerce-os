import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Extract product references from text and search for matches
async function findProductsInText(
  supabase: any,
  tenantId: string,
  text: string
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];
  
  // Get all products for this tenant with their images
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
    console.log("No products found for tenant:", tenantId);
    return matches;
  }

  const textLower = text.toLowerCase();

  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    
    // Check if the product name (or significant parts) appears in the text
    const productWords = productNameLower
      .replace(/[()]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3);
    
    let matchCount = 0;
    for (const word of productWords) {
      if (textLower.includes(word)) {
        matchCount++;
      }
    }
    
    const matchThreshold = productWords.length <= 2 ? 1 : 2;
    
    if (matchCount >= matchThreshold) {
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const firstImage = images.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0];
      const imageUrl = primaryImage?.url || firstImage?.url || null;
      
      // Detecta se é um kit (contém "kit" no nome)
      const isKit = productNameLower.includes("kit");
      
      matches.push({
        id: product.id,
        name: product.name,
        image_url: imageUrl,
        is_kit: isKit,
        sku: product.sku,
      });
      
      console.log(`Product match: "${product.name}" (kit: ${isKit}, ${matchCount}/${productWords.length} words)`);
    }
  }

  return matches;
}

// Detecta se o prompt envolve múltiplos produtos (kit)
function detectKitScenario(matchedProducts: ProductMatch[]): boolean {
  // Se algum produto é explicitamente um kit
  if (matchedProducts.some(p => p.is_kit)) return true;
  // Se há mais de 1 produto diferente mencionado
  if (matchedProducts.length > 1) return true;
  return false;
}

serve(async (req) => {
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
      console.error("Calendar item error:", itemError);
      return new Response(
        JSON.stringify({ success: false, error: "Item não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REGRA: Blog não gera imagem
    if (calendarItem.content_type === "text") {
      return new Response(
        JSON.stringify({ success: false, error: "Blog não precisa de imagem" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = calendarItem.campaign.tenant_id;

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

    // ============ PRODUCT DETECTION ============
    const searchText = [
      calendarItem.campaign.prompt || "",
      calendarItem.generation_prompt || "",
      calendarItem.copy || "",
      calendarItem.campaign.name || "",
      calendarItem.title || "",
    ].join(" ");

    console.log("Searching for products in:", searchText.substring(0, 200));
    
    const matchedProducts = await findProductsInText(supabase, tenantId, searchText);
    console.log(`Found ${matchedProducts.length} product matches`);

    // REGRA: Se não encontrou produto com imagem, bloqueia geração
    const productWithImage = matchedProducts.find(p => p.image_url);
    if (!productWithImage && matchedProducts.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Produto "${matchedProducts[0].name}" encontrado, mas não tem imagem cadastrada. Cadastre a imagem primeiro.` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detecta cenário de kit
    const isKitScenario = detectKitScenario(matchedProducts);
    console.log(`Kit scenario detected: ${isKitScenario}`);

    // Build the final prompt
    const promptParts: string[] = [];

    // Base rules - CRÍTICAS para qualidade
    const baseRules = [
      "Fotografia profissional em alta resolução, qualidade editorial de revista",
      "NÃO inclua NENHUM texto, letras, números ou logotipos sobrepostos na imagem",
      "NÃO invente, altere ou recrie rótulos, embalagens ou designs de produtos",
      "NÃO distorça cores, proporções ou identidade visual do produto",
      "NÃO adicione selos, certificações, claims ou promessas",
      "PRESERVE exatamente a identidade visual do produto da imagem de referência",
      "Iluminação profissional de estúdio, suave e premium",
      "Evite claims médicos, antes/depois ou promessas de resultado",
      "Fundo limpo ou contextualizado conforme briefing",
    ];

    // REGRA CRÍTICA: Kit não pode ser segurado na mão
    if (isKitScenario) {
      baseRules.push("PROIBIDO: pessoa segurando múltiplos produtos ou kit na mão");
      baseRules.push("Para kit/múltiplos produtos: use composição flatlay, bancada, prateleira ou ambiente lifestyle");
      baseRules.push("Apresente os produtos organizados em superfície, NÃO em mãos");
      promptParts.push("CENÁRIO: Kit de produtos. Apresentar em bancada de banheiro elegante, flatlay minimalista ou prateleira lifestyle. NÃO colocar na mão de modelo.");
    } else if (productWithImage) {
      // Produto único pode ser segurado
      promptParts.push("CENÁRIO: Pode mostrar modelo segurando o produto (apenas 1 produto por mão, máximo 2 produtos se um em cada mão).");
      baseRules.push("Se mostrar mãos: apenas 1 produto por mão, pose natural e elegante");
    }

    // Product context - FUNDAMENTAL
    if (productWithImage) {
      promptParts.push(`PRODUTO REAL (OBRIGATÓRIO USAR A IMAGEM DE REFERÊNCIA): ${productWithImage.name}`);
      promptParts.push("INSTRUÇÃO CRÍTICA: A imagem de referência mostra o produto REAL. Você DEVE usar EXATAMENTE este produto, preservando rótulo, cores, formato e design. NÃO invente um produto diferente.");
      
      if (matchedProducts.length > 1) {
        const otherProducts = matchedProducts.filter(p => p.id !== productWithImage.id).map(p => p.name);
        promptParts.push(`Outros produtos do kit/campanha: ${otherProducts.join(", ")}`);
      }
    }

    // Brand context
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
      if (brandContext.do_not_do && brandContext.do_not_do.length > 0) {
        baseRules.push(...brandContext.do_not_do.map((r: string) => `NÃO ${r}`));
      }
    }

    // Campaign context
    if (calendarItem.campaign.prompt) {
      promptParts.push(`Briefing da campanha: ${calendarItem.campaign.prompt}`);
    }

    // Item specific prompt
    if (calendarItem.generation_prompt) {
      promptParts.push(`Briefing específico: ${calendarItem.generation_prompt}`);
    } else if (calendarItem.copy) {
      promptParts.push(`Contexto do post: ${calendarItem.copy.substring(0, 300)}`);
    }

    // Content type adjustments
    const contentTypeConfig: Record<string, { prompt: string; size: string }> = {
      image: { prompt: "Imagem quadrada 1:1 para feed", size: "1024x1024" },
      carousel: { prompt: "Imagem quadrada 1:1 para carrossel", size: "1024x1024" },
      reel: { prompt: "Imagem vertical 9:16 para Reels", size: "1024x1792" },
      story: { prompt: "Imagem vertical 9:16 para Stories", size: "1024x1792" },
    };

    const contentConfig = contentTypeConfig[calendarItem.content_type] || contentTypeConfig.image;
    promptParts.push(`Formato: ${contentConfig.prompt}`);

    // Negatives - O que NÃO fazer
    const negatives = [
      "Evitar: caixas genéricas, rótulos inventados, texto ilegível",
      "Evitar: produto diferente do de referência",
      "Evitar: qualidade baixa, blur, distorções",
      "Evitar: múltiplos produtos em uma mão",
    ];

    // Build final prompt
    const promptFinal = [
      ...promptParts,
      "",
      "REGRAS OBRIGATÓRIAS (seguir rigorosamente):",
      ...baseRules,
      "",
      "EVITAR:",
      ...negatives,
    ].join("\n");

    // Determine reference image
    let referenceImageUrl: string | null = null;
    let referenceSource: string | null = null;

    if (productWithImage?.image_url) {
      referenceImageUrl = productWithImage.image_url;
      referenceSource = "product";
      console.log("Using product image as reference:", productWithImage.name);
    } else if (use_packshot && brandContext?.packshot_url) {
      referenceImageUrl = brandContext.packshot_url;
      referenceSource = "packshot";
      console.log("Using brand packshot as reference");
    }

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: tenantId,
        calendar_item_id: calendar_item_id,
        provider: referenceImageUrl ? "openai" : "lovable",
        model: referenceImageUrl ? "gpt-image-1" : "gemini-2.5-flash-image-preview",
        prompt_final: promptFinal,
        brand_context_snapshot: brandContext || null,
        settings: {
          use_packshot,
          packshot_url: referenceImageUrl,
          reference_source: referenceSource,
          matched_products: matchedProducts,
          content_type: calendarItem.content_type,
          is_kit_scenario: isKitScenario,
          needs_product_image: !!referenceImageUrl,
          image_size: contentConfig.size,
        },
        status: "queued",
        variant_count,
        created_by: user.id,
      })
      .select()
      .single();

    if (genError || !generation) {
      console.error("Generation insert error:", genError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar geração" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generation queued: ${generation.id}, provider: ${referenceImageUrl ? "openai" : "lovable"}, kit: ${isKitScenario}`);

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
      }).catch(err => console.error("Error triggering process queue:", err));
    } catch (triggerError) {
      console.error("Error triggering queue processing:", triggerError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generation_id: generation.id,
        matched_products: matchedProducts.map(p => p.name),
        is_kit_scenario: isKitScenario,
        provider: referenceImageUrl ? "openai" : "lovable",
        message: productWithImage 
          ? `Geração iniciada com produto real: ${productWithImage.name}${isKitScenario ? " (kit)" : ""}` 
          : "Geração iniciada" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-generate-image:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
