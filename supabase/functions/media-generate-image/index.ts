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
      product_images!inner(url, is_primary, sort_order)
    `)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (error || !products || products.length === 0) {
    console.log("No products found for tenant:", tenantId);
    return matches;
  }

  const textLower = text.toLowerCase();

  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    
    // Check if the product name (or significant parts) appears in the text
    // Split product name into words and check for matches
    const productWords = productNameLower
      .replace(/[()]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3); // Ignore small words like "de", "com", etc.
    
    // Calculate how many significant words match
    let matchCount = 0;
    for (const word of productWords) {
      if (textLower.includes(word)) {
        matchCount++;
      }
    }
    
    // If at least 2 significant words match OR if product name is short and matches
    const matchThreshold = productWords.length <= 2 ? 1 : 2;
    
    if (matchCount >= matchThreshold) {
      // Get the primary image or the first image
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const firstImage = images.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0];
      const imageUrl = primaryImage?.url || firstImage?.url || null;
      
      matches.push({
        id: product.id,
        name: product.name,
        image_url: imageUrl,
      });
      
      console.log(`Product match found: "${product.name}" (${matchCount}/${productWords.length} words matched)`);
    }
  }

  return matches;
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
    // Combine all text sources to search for product references
    const searchText = [
      calendarItem.campaign.prompt || "",
      calendarItem.generation_prompt || "",
      calendarItem.copy || "",
      calendarItem.campaign.name || "",
    ].join(" ");

    console.log("Searching for products in:", searchText);
    
    const matchedProducts = await findProductsInText(supabase, tenantId, searchText);
    console.log(`Found ${matchedProducts.length} product matches`);

    // Get the primary product image if we found matches
    const productImageUrl = matchedProducts.length > 0 ? matchedProducts[0].image_url : null;
    const productNames = matchedProducts.map(p => p.name);

    // Build the final prompt
    const promptParts: string[] = [];

    // Base rules (anti-error) - mais rígidas
    const baseRules = [
      "Fotografia profissional em alta resolução, estilo editorial",
      "NÃO inclua NENHUM texto sobreposto na imagem",
      "NÃO invente, altere ou crie rótulos, logos ou embalagens",
      "NÃO mostre mãos segurando produtos diretamente",
      "NÃO distorça proporções ou cores do produto",
      "NÃO adicione selos, certificações ou claims",
      "PRESERVE exatamente a identidade visual do produto se fornecido",
      "Mantenha iluminação profissional de estúdio",
      "Evite qualquer claim médico, antes/depois ou promessa de resultado",
      "Estilo editorial limpo, moderno e premium",
    ];

    // Add matched products context
    if (productNames.length > 0) {
      promptParts.push(`PRODUTOS REAIS DA LOJA (usar imagem de referência fornecida): ${productNames.join(", ")}`);
      promptParts.push("IMPORTANTE: A imagem de referência mostra o produto REAL. Preserve EXATAMENTE o rótulo, cores, design e identidade visual do produto.");
    }

    // Add brand context if available
    if (brandContext) {
      if (brandContext.tone_of_voice) {
        promptParts.push(`Tom de voz: ${brandContext.tone_of_voice}`);
      }
      if (brandContext.visual_style_guidelines) {
        promptParts.push(`Estilo visual: ${brandContext.visual_style_guidelines}`);
      }
      if (brandContext.banned_claims && brandContext.banned_claims.length > 0) {
        baseRules.push(`PROIBIDO mencionar: ${brandContext.banned_claims.join(", ")}`);
      }
      if (brandContext.do_not_do && brandContext.do_not_do.length > 0) {
        baseRules.push(...brandContext.do_not_do.map((r: string) => `NÃO ${r}`));
      }
    }

    // Add campaign context
    if (calendarItem.campaign.prompt) {
      promptParts.push(`Contexto da campanha: ${calendarItem.campaign.prompt}`);
    }

    // Add item specific prompt
    if (calendarItem.generation_prompt) {
      promptParts.push(calendarItem.generation_prompt);
    } else if (calendarItem.copy) {
      promptParts.push(`Tema: ${calendarItem.copy}`);
    }

    // Content type specific adjustments
    const contentTypePrompts: Record<string, string> = {
      image: "Imagem única para post de feed, proporção 1:1",
      carousel: "Imagem para carrossel, composição limpa, proporção 1:1",
      reel: "Imagem vertical 9:16 para Reels/Stories",
      story: "Imagem vertical 9:16 para Stories",
    };

    if (calendarItem.content_type && contentTypePrompts[calendarItem.content_type]) {
      promptParts.push(contentTypePrompts[calendarItem.content_type]);
    }

    // Build final prompt
    const promptFinal = [
      ...promptParts,
      "",
      "REGRAS OBRIGATÓRIAS (seguir rigorosamente):",
      ...baseRules,
    ].join("\n");

    // Determine which reference image to use
    // Priority: 1) Matched product image, 2) Brand packshot (if enabled), 3) None
    let referenceImageUrl: string | null = null;
    let referenceSource: string | null = null;

    if (productImageUrl) {
      referenceImageUrl = productImageUrl;
      referenceSource = "product";
      console.log("Using product image as reference:", productImageUrl);
    } else if (use_packshot && brandContext?.packshot_url) {
      referenceImageUrl = brandContext.packshot_url;
      referenceSource = "packshot";
      console.log("Using brand packshot as reference:", brandContext.packshot_url);
    }

    // Create generation record with status 'queued'
    const { data: generation, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: tenantId,
        calendar_item_id: calendar_item_id,
        provider: "lovable",
        model: "gemini-2.5-flash-image-preview",
        prompt_final: promptFinal,
        brand_context_snapshot: brandContext || null,
        settings: {
          use_packshot,
          packshot_url: referenceImageUrl,
          reference_source: referenceSource,
          matched_products: matchedProducts,
          content_type: calendarItem.content_type,
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

    console.log(`Generation queued: ${generation.id}, reference: ${referenceSource || "none"}`);

    // Trigger the processing function immediately (fire and forget)
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
        message: matchedProducts.length > 0 
          ? `Geração iniciada com produto real: ${matchedProducts[0].name}` 
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
