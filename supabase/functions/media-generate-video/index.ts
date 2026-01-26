import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Durações suportadas pelo Sora 2 (em segundos)
// Nota: Para vídeos maiores, Sora 2 suporta até 20s nativo
// Para 1 minuto, faremos geração em chunks se necessário
const SUPPORTED_DURATIONS = [5, 10, 15, 20] as const;
type SupportedDuration = typeof SUPPORTED_DURATIONS[number];

interface ProductMatch {
  id: string;
  name: string;
  image_url: string | null;
  is_kit: boolean;
  sku: string | null;
}

/**
 * Busca produtos no texto baseado em nome e palavras-chave.
 * A imagem do produto será usada como REFERÊNCIA CRIATIVA para a IA,
 * permitindo que ela crie cenas com pessoas segurando o produto, etc.
 */
async function findProductsInText(
  supabase: any,
  tenantId: string,
  text: string
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];
  
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
    console.log("[media-generate-video] No products found for tenant:", tenantId);
    return matches;
  }

  const textLower = text.toLowerCase();
  console.log(`[media-generate-video] Searching for products in text (${text.length} chars)`);

  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    
    // Match exato do nome
    if (textLower.includes(productNameLower)) {
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const sortedImages = [...images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const imageUrl = primaryImage?.url || sortedImages[0]?.url || null;
      const isKit = productNameLower.includes("kit");
      
      matches.push({ id: product.id, name: product.name, image_url: imageUrl, is_kit: isKit, sku: product.sku });
      console.log(`[media-generate-video] EXACT match: "${product.name}" (kit: ${isKit}, hasImage: ${!!imageUrl})`);
      continue;
    }
    
    // Match por palavras significativas (>3 chars)
    const productWords = productNameLower
      .replace(/[()]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3);
    
    let matchCount = 0;
    for (const word of productWords) {
      if (textLower.includes(word)) matchCount++;
    }
    
    const matchThreshold = Math.max(2, Math.ceil(productWords.length / 2));
    
    if (productWords.length > 0 && matchCount >= matchThreshold) {
      const images = product.product_images || [];
      const primaryImage = images.find((img: any) => img.is_primary);
      const sortedImages = [...images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const imageUrl = primaryImage?.url || sortedImages[0]?.url || null;
      const isKit = productNameLower.includes("kit");
      
      matches.push({ id: product.id, name: product.name, image_url: imageUrl, is_kit: isKit, sku: product.sku });
      console.log(`[media-generate-video] WORD match: "${product.name}" (${matchCount}/${productWords.length} words)`);
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

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { 
      calendar_item_id, 
      duration = 5, 
      aspect_ratio = "16:9" 
    } = await req.json();

    if (!calendar_item_id) {
      return new Response(JSON.stringify({ success: false, error: "calendar_item_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate duration (max 20s per generation - Sora 2 limit)
    const validDuration = SUPPORTED_DURATIONS.includes(duration as SupportedDuration) 
      ? duration 
      : 5;

    console.log(`\n[media-generate-video] === START ===`);
    console.log(`[media-generate-video] Calendar item: ${calendar_item_id}`);
    console.log(`[media-generate-video] Duration: ${validDuration}s, Aspect: ${aspect_ratio}`);

    // Check FAL_API_KEY
    const falApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "FAL_API_KEY");
    if (!falApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "FAL_API_KEY não configurada. Configure em Integrações da Plataforma > IA > Fal.AI" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      console.error("[media-generate-video] Calendar item error:", itemError);
      return new Response(JSON.stringify({ success: false, error: "Item não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = calendarItem.campaign.tenant_id;
    console.log(`[media-generate-video] Tenant: ${tenantId}`);

    // Verify user belongs to tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(JSON.stringify({ success: false, error: "Sem permissão para este tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get brand context if exists
    const { data: brandContext } = await supabase
      .from("tenant_brand_context")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // ============ PRODUCT DETECTION ============
    // Buscar produtos mencionados no prompt para usar imagem como REFERÊNCIA CRIATIVA
    // (não necessariamente como primeiro frame fixo)
    const searchText = [
      calendarItem.campaign.prompt || "",
      calendarItem.generation_prompt || "",
      calendarItem.copy || "",
      calendarItem.campaign.name || "",
      calendarItem.title || "",
    ].join(" ");

    console.log("[media-generate-video] Search text preview:", searchText.substring(0, 200));
    
    const matchedProducts = await findProductsInText(supabase, tenantId, searchText);
    console.log(`[media-generate-video] Found ${matchedProducts.length} product matches`);

    // Buscar produto com imagem para usar como referência criativa
    const productWithImage = matchedProducts.find(p => p.image_url);
    
    // Se produto foi mencionado mas não tem imagem, bloquear
    if (matchedProducts.length > 0 && !productWithImage) {
      const productNames = matchedProducts.map(p => p.name).join(", ");
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Produto(s) "${productNames}" não possui(em) imagem cadastrada. Cadastre uma imagem primeiro para gerar vídeo com fidelidade ao produto.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isKitScenario = matchedProducts.some(p => p.is_kit) || matchedProducts.length > 1;

    // Build video prompt
    // A imagem do produto é usada como REFERÊNCIA CRIATIVA - a IA pode criar
    // cenas com pessoas segurando o produto, ambientes, etc.
    const promptParts: string[] = [];

    promptParts.push("GERAÇÃO DE VÍDEO PREMIUM COM SORA 2 (Image-to-Video Pro)");
    promptParts.push(`Duração: ${validDuration} segundos`);
    promptParts.push(`Formato: ${aspect_ratio}`);

    if (productWithImage) {
      promptParts.push("");
      promptParts.push(`PRODUTO REAL EM REFERÊNCIA: "${productWithImage.name}"`);
      promptParts.push("A imagem do produto fornecida é uma REFERÊNCIA CRIATIVA.");
      promptParts.push("Use-a para manter FIDELIDADE VISUAL do produto em toda a cena:");
      promptParts.push("- Pode criar cenas com pessoas segurando o produto");
      promptParts.push("- Pode colocar o produto em superfícies, ambientes lifestyle");
      promptParts.push("- Pode adicionar movimento de câmera, partículas, efeitos");
      promptParts.push("- DEVE preservar cores, rótulo, design exato do produto");
      promptParts.push("- NÃO inventar ou alterar textos na embalagem");
    }

    // Regras anti-alucinação
    const videoRules = [
      "Preservar 100% a fidelidade do produto (rótulo, cores, design)",
      "NÃO distorcer ou alterar o produto durante animação",
      "NÃO adicionar texto sobreposto ou logos fictícios",
      "Iluminação coerente com estilo da marca",
      "Movimentos cinematográficos suaves",
      "Transições fluidas, sem cortes bruscos",
    ];

    if (isKitScenario) {
      promptParts.push("");
      promptParts.push("CENÁRIO DE KIT (múltiplos produtos):");
      promptParts.push("- Produtos devem estar em superfície (não nas mãos)");
      promptParts.push("- Movimento de câmera revelando cada item");
    }

    // Brand context
    if (brandContext?.visual_style_guidelines) {
      promptParts.push("");
      promptParts.push(`Estilo visual da marca: ${brandContext.visual_style_guidelines}`);
    }

    // Campaign context
    if (calendarItem.campaign.prompt) {
      promptParts.push("");
      promptParts.push(`Briefing da campanha: ${calendarItem.campaign.prompt}`);
    }

    if (calendarItem.generation_prompt) {
      promptParts.push(`Briefing específico: ${calendarItem.generation_prompt}`);
    } else if (calendarItem.copy) {
      promptParts.push(`Contexto: ${calendarItem.copy.substring(0, 200)}`);
    }

    const promptFinal = [
      ...promptParts,
      "",
      "REGRAS OBRIGATÓRIAS:",
      ...videoRules.map(r => `• ${r}`),
    ].join("\n");

    console.log("[media-generate-video] Final prompt length:", promptFinal.length);

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: tenantId,
        calendar_item_id: calendar_item_id,
        provider: "fal.ai",
        model: "sora-2/image-to-video/pro",
        prompt_final: promptFinal,
        brand_context_snapshot: brandContext || null,
        settings: {
          asset_type: "video",
          duration: validDuration,
          aspect_ratio,
          // Imagem usada como REFERÊNCIA CRIATIVA (não frame fixo)
          product_reference_image_url: productWithImage?.image_url || null,
          product_name: productWithImage?.name || null,
          matched_products: matchedProducts,
          is_kit_scenario: isKitScenario,
          content_type: calendarItem.content_type,
        },
        status: "queued",
        variant_count: 1,
        created_by: userId,
      })
      .select()
      .single();

    if (genError || !generation) {
      console.error("[media-generate-video] Generation insert error:", genError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao criar geração de vídeo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[media-generate-video] Video generation queued: ${generation.id}`);
    console.log(`[media-generate-video] - Model: sora-2/image-to-video/pro`);
    console.log(`[media-generate-video] - Product reference: ${productWithImage?.name || "none"}`);
    console.log(`[media-generate-video] - Duration: ${validDuration}s`);

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
      }).catch(err => console.error("[media-generate-video] Error triggering queue:", err));
    } catch (triggerError) {
      console.error("[media-generate-video] Error triggering queue:", triggerError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      generation_id: generation.id,
      model: "sora-2/image-to-video/pro",
      product_name: productWithImage?.name || null,
      has_product_reference: !!productWithImage,
      duration: validDuration,
      aspect_ratio,
      message: productWithImage 
        ? `Vídeo ${validDuration}s em geração com referência de produto: ${productWithImage.name}`
        : `Vídeo ${validDuration}s em geração`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[media-generate-video] Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
