import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateVideoRequest {
  calendar_item_id: string;
  duration?: number; // 5 or 10 seconds
  aspect_ratio?: string; // "16:9", "9:16", "1:1"
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
 * CRÍTICO: Precisa encontrar o produto correto para usar imagem REAL como primeiro frame
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
 */
function detectKitScenario(matchedProducts: ProductMatch[]): boolean {
  if (matchedProducts.some(p => p.is_kit)) return true;
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

    const { 
      calendar_item_id, 
      duration = 5,
      aspect_ratio = "16:9" 
    }: GenerateVideoRequest = await req.json();

    if (!calendar_item_id) {
      return new Response(
        JSON.stringify({ success: false, error: "calendar_item_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n🎬 === media-generate-video START ===`);
    console.log(`📅 Calendar item: ${calendar_item_id}`);
    console.log(`⏱️ Duration: ${duration}s, Aspect: ${aspect_ratio}`);

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

    // ============ PRODUCT DETECTION (CRÍTICO PARA VIDEO) ============
    // Sora 2 Image-to-Video PRECISA de uma imagem de primeiro frame
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

    // Para Sora 2 Image-to-Video, OBRIGATÓRIO ter imagem
    const productWithImage = matchedProducts.find(p => p.image_url);
    
    if (!productWithImage) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Geração de vídeo com Sora 2 requer uma imagem de produto como primeiro frame. Cadastre uma imagem para o produto mencionado ou gere primeiro uma imagem do criativo." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isKitScenario = detectKitScenario(matchedProducts);
    console.log(`📦 Kit scenario: ${isKitScenario}`);

    // Build video prompt
    const promptParts: string[] = [];

    // Contexto base para vídeo
    promptParts.push("GERAÇÃO DE VÍDEO PREMIUM COM SORA 2 (Image-to-Video)");
    promptParts.push(`Duração: ${duration} segundos`);
    promptParts.push(`Formato: ${aspect_ratio}`);

    // Regras para vídeo
    const videoRules = [
      "Animação suave e cinematográfica partindo da imagem de referência",
      "Movimentos sutis e naturais (slow pan, zoom suave, partículas)",
      "Preservar 100% a fidelidade do produto (rótulo, cores, design)",
      "NÃO alterar o produto durante a animação",
      "NÃO adicionar texto ou overlays",
      "Iluminação consistente com a imagem original",
      "Transições fluidas, sem cortes bruscos",
    ];

    // REGRA: Kit - movimentos mais complexos, showcase
    if (isKitScenario) {
      promptParts.push("CENÁRIO DE KIT:");
      promptParts.push("- Câmera passando pelos produtos em sequência");
      promptParts.push("- Movimento de reveal/showcase elegante");
      promptParts.push("- Produtos devem permanecer estáticos na superfície");
    } else {
      promptParts.push("CENÁRIO DE PRODUTO ÚNICO:");
      promptParts.push("- Rotação sutil 3D do produto OU");
      promptParts.push("- Zoom in lento destacando detalhes OU");
      promptParts.push("- Movimento de câmera ao redor do produto");
    }

    // Context from brand
    if (brandContext) {
      if (brandContext.visual_style_guidelines) {
        promptParts.push(`Estilo visual: ${brandContext.visual_style_guidelines}`);
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
      promptParts.push(`Contexto: ${calendarItem.copy.substring(0, 200)}`);
    }

    // Build final prompt
    const promptFinal = [
      ...promptParts,
      "",
      "REGRAS OBRIGATÓRIAS PARA VÍDEO:",
      ...videoRules.map(r => `• ${r}`),
      "",
      "EVITAR:",
      "• Distorção do produto durante movimento",
      "• Alteração de cores ou design",
      "• Movimentos bruscos ou irreais",
      "• Deformação da embalagem/rótulo",
      "• Áudio descoordenado com visual",
    ].join("\n");

    console.log("📝 Final video prompt length:", promptFinal.length);

    // Create generation record (status: queued)
    const { data: generation, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: tenantId,
        calendar_item_id: calendar_item_id,
        provider: "fal-ai",
        model: "sora-2/image-to-video/pro", // Sora 2 Pro
        prompt_final: promptFinal,
        brand_context_snapshot: brandContext || null,
        settings: {
          asset_type: "video",
          duration,
          aspect_ratio,
          source_image_url: productWithImage.image_url,
          reference_source: "product",
          matched_products: matchedProducts,
          content_type: calendarItem.content_type,
          is_kit_scenario: isKitScenario,
          needs_product_image: true,
          product_name: productWithImage.name,
        },
        status: "queued",
        variant_count: 1,
        created_by: user.id,
      })
      .select()
      .single();

    if (genError || !generation) {
      console.error("❌ Generation insert error:", genError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar geração de vídeo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Video generation queued: ${generation.id}`);
    console.log(`   - Model: sora-2/image-to-video/pro`);
    console.log(`   - Product: ${productWithImage.name}`);
    console.log(`   - Duration: ${duration}s`);

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
        model: "sora-2/image-to-video/pro",
        product_name: productWithImage.name,
        duration,
        aspect_ratio,
        message: `Vídeo ${duration}s em geração com produto: ${productWithImage.name}` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in media-generate-video:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
