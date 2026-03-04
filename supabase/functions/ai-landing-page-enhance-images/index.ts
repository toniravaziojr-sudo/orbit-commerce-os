// =============================================
// AI LANDING PAGE ENHANCE IMAGES — V1.0.0
// Step 2: Generates hero/lifestyle images via AI and updates existing blocks
// Runs AFTER ai-landing-page-generate completes (async, no timeout pressure on page gen)
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const VERSION = "1.0.0";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ========== IMAGE HELPERS ==========

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("[AI-LP-Enhance] Failed to download image:", e);
    return null;
  }
}

async function callImageModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceBase64: string,
  additionalReferences?: string[],
): Promise<string | null> {
  const content: any[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,' + referenceBase64 } },
  ];
  if (additionalReferences && additionalReferences.length > 0) {
    for (const refB64 of additionalReferences.slice(0, 2)) {
      content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + refB64 } });
    }
  }
  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + lovableApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error("[AI-LP-Enhance] " + model + " error: " + response.status, errText.substring(0, 300));
    return null;
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function ensureDriveFolder(supabase: any, tenantId: string, userId: string): Promise<string | null> {
  try {
    const folderName = "Criativos de página";
    const { data: existing } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("is_folder", true).eq("filename", folderName).limit(1).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase.from("files").insert({
      tenant_id: tenantId, filename: folderName, original_name: folderName,
      storage_path: `drive/${tenantId}/criativos-de-pagina`,
      is_folder: true, is_system_folder: true, created_by: userId,
      metadata: { source: "ai_landing_page_enhance", system_managed: true },
    }).select("id").single();
    if (error) { console.error("[AI-LP-Enhance] Error creating folder:", error); return null; }
    return created?.id || null;
  } catch (e) { console.error("[AI-LP-Enhance] Folder ensure error:", e); return null; }
}

async function uploadCreativeToStorage(
  supabase: any, tenantId: string, dataUrl: string, label: string,
  userId?: string, driveFolderId?: string | null,
): Promise<string | null> {
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }
    const timestamp = Date.now();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
    const filename = 'hero-' + safeName + '-' + timestamp + '.png';
    const filePath = tenantId + '/lp-creatives/' + filename;
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(filePath, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) { console.error("[AI-LP-Enhance] Upload error:", uploadError); return null; }
    const { data: publicUrlData } = supabase.storage.from('store-assets').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (publicUrl && driveFolderId && userId) {
      await supabase.from("files").insert({
        tenant_id: tenantId, folder_id: driveFolderId, filename, original_name: filename,
        storage_path: filePath, mime_type: 'image/png', size_bytes: bytes.length,
        is_folder: false, is_system_folder: false, created_by: userId,
        metadata: { source: "ai_landing_page_enhance", url: publicUrl, bucket: "store-assets", system_managed: true },
      });
    }
    return publicUrl || null;
  } catch (error) { console.error("[AI-LP-Enhance] Upload creative error:", error); return null; }
}

// ========== BLOCK TREE UPDATER ==========

function updateHeroImageInBlocks(blocks: any, heroImageUrl: string): boolean {
  if (!blocks || !blocks.children) return false;
  let updated = false;

  function walk(node: any) {
    // Update Banner blocks (hero)
    if (node.type === 'Banner' && node.props) {
      if (node.props.slides && Array.isArray(node.props.slides) && node.props.slides.length > 0) {
        node.props.slides[0].imageDesktop = heroImageUrl;
        if (!node.props.slides[0].imageMobile) {
          node.props.slides[0].imageMobile = heroImageUrl;
        }
        updated = true;
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(blocks);
  return updated;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-Enhance v${VERSION}] Starting image enhancement...`);

  try {
    const body = await req.json();
    const { landingPageId, tenantId, userId } = body;

    if (!landingPageId || !tenantId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch landing page with generated blocks
    const { data: lp, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("id, product_ids, generated_blocks, current_version")
      .eq("id", landingPageId)
      .single();

    if (lpError || !lp) {
      console.error("[AI-LP-Enhance] LP not found:", lpError);
      return new Response(
        JSON.stringify({ success: false, error: "Landing page not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lp.generated_blocks) {
      return new Response(
        JSON.stringify({ success: false, error: "No blocks to enhance — generate page first" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = lp.product_ids || [];
    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No products linked to landing page" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch first product + primary image
    const { data: products } = await supabase
      .from("products")
      .select("id, name, product_type, tags")
      .in("id", productIds)
      .limit(1);

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Products not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const product = products[0];

    const { data: images } = await supabase
      .from("product_images")
      .select("url, is_primary")
      .eq("product_id", product.id)
      .order("is_primary", { ascending: false })
      .limit(1);

    const primaryImageUrl = images?.[0]?.url;
    if (!primaryImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Product has no image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch store name
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .single();

    const storeName = storeSettings?.store_name || "Loja";

    // 4. Fetch Drive references for this product
    let driveReferenceBase64s: string[] = [];
    try {
      const searchTerm = product.name.split(' ').slice(0, 3).join(' ');
      const { data: driveFiles } = await supabase
        .from("files")
        .select("storage_path, metadata")
        .eq("tenant_id", tenantId)
        .eq("is_folder", false)
        .ilike("mime_type", "image/%")
        .ilike("original_name", `%${searchTerm}%`)
        .limit(3);

      if (driveFiles && driveFiles.length > 0) {
        for (const file of driveFiles.slice(0, 2)) {
          const meta = file.metadata as Record<string, any> | null;
          const bucket = (meta?.bucket as string) || 'tenant-files';
          let url: string | undefined;
          if (bucket === 'tenant-files') {
            const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
            url = signedData?.signedUrl;
          } else {
            const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
            url = pubData?.publicUrl;
          }
          if (url) {
            const b64 = await imageUrlToBase64(url);
            if (b64) driveReferenceBase64s.push(b64);
          }
        }
        console.log(`[AI-LP-Enhance] Loaded ${driveReferenceBase64s.length} Drive references`);
      }
    } catch (e) {
      console.warn("[AI-LP-Enhance] Drive reference fetch error (non-blocking):", e);
    }

    // 5. Ensure drive folder
    const driveFolderId = await ensureDriveFolder(supabase, tenantId, userId);

    // 6. Generate hero image
    console.log(`[AI-LP-Enhance] Generating hero image for "${product.name}"...`);
    const referenceBase64 = await imageUrlToBase64(primaryImageUrl);
    if (!referenceBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not download product image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heroPrompt = `FOTOGRAFIA PUBLICITÁRIA DE ALTO IMPACTO para landing page de venda.

PRODUTO: "${product.name}" pela marca "${storeName}"

OBJETIVO: Criar uma imagem hero profissional de alta conversão para landing page.

REGRAS ABSOLUTAS:
1. O produto na imagem de referência DEVE ser mantido EXATAMENTE como é — mesmo rótulo, mesmas cores, mesmo formato
2. NÃO altere o texto do rótulo, marca ou embalagem do produto
3. NÃO invente novos produtos ou embalagens

COMPOSIÇÃO:
- Produto em destaque central ou em posição hero (leve ângulo 3/4)
- Sombra de contato realista
- Efeitos de brilho/reflexo sutis para transmitir qualidade premium
- Aspect ratio: 16:9 (paisagem) para hero banner

CENÁRIO E AMBIENTAÇÃO (baseado no nicho do produto):
- Cosméticos/Saúde/Beleza: bancada de banheiro premium com iluminação natural dourada
- Suplementos/Fitness/Masculino: superfície de concreto polido escuro, iluminação dramática lateral
- Tech/Eletrônicos/Gadgets: mesa de escritório moderna, iluminação LED azulada sutil
- Alimentos/Bebidas/Orgânicos: mesa de madeira rústica, ingredientes frescos ao redor
- Moda/Acessórios: fundo de tecido nobre, iluminação de estúdio suave
- Default: superfície minimalista escura com gradiente de luz lateral suave

ESTILO VISUAL: Coerência com landing page dark/premium. Use backgrounds escuros ou médios. Qualidade de catálogo profissional. Ultra realista.${driveReferenceBase64s.length > 0 ? '\n\nREFERÊNCIAS VISUAIS ADICIONAIS: As imagens extras anexadas são referências visuais do Drive do lojista para este produto. Use-as como inspiração de estilo, ângulo e composição, mas GERE uma imagem NOVA e ORIGINAL.' : ''}`;

    // Try pro model first, then flash
    let imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', heroPrompt, referenceBase64, driveReferenceBase64s);
    if (!imageDataUrl) {
      console.log("[AI-LP-Enhance] Pro model failed, trying flash...");
      imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', heroPrompt, referenceBase64, driveReferenceBase64s);
    }

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Image generation failed on all models" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Upload to storage
    const heroUrl = await uploadCreativeToStorage(supabase, tenantId, imageDataUrl, product.name, userId, driveFolderId);
    if (!heroUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload generated image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AI-LP-Enhance] Hero image uploaded: ${heroUrl.substring(0, 80)}...`);

    // 8. Update hero block in generated_blocks
    const blocks = JSON.parse(JSON.stringify(lp.generated_blocks)); // deep clone
    const wasUpdated = updateHeroImageInBlocks(blocks, heroUrl);

    if (!wasUpdated) {
      console.warn("[AI-LP-Enhance] No Banner block found to update — saving image URL in metadata only");
    }

    // 9. Persist updated blocks
    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_blocks: blocks,
        metadata: {
          heroImageEnhanced: true,
          heroImageUrl: heroUrl,
          enhancedAt: new Date().toISOString(),
        },
      })
      .eq("id", landingPageId);

    if (updateError) {
      console.error("[AI-LP-Enhance] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save enhanced blocks" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AI-LP-Enhance v${VERSION}] Success! Hero image applied to blocks.`);

    return new Response(
      JSON.stringify({
        success: true,
        heroImageUrl: heroUrl,
        blocksUpdated: wasUpdated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Enhance] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
